from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.routes.user import get_db, require_coach_role, get_current_user
from app.schemas.workout import (
    WorkoutTemplateCreate, WorkoutTemplateShow,
    WorkoutPlanCreate, WorkoutPlanShow,
    AssignPlanToClient, BookingWorkoutSelect, CoachDecideWorkout
)
from app.crud.workout import (
    create_workout_template, get_workout_templates, get_workout_template,
    get_templates_by_muscle_group, create_workout_plan, get_workout_plans, 
    get_workout_plan, assign_plan_to_client, get_client_plan,
    update_booking_workout, get_pending_coach_decisions
)
from app.services.subscriptions import has_active_subscription

router = APIRouter()

# === WORKOUT TEMPLATES === (individual exercises)

# Create workout template (coaches only)
@router.post("/workout-templates/", response_model=WorkoutTemplateShow)
def add_workout_template(template: WorkoutTemplateCreate, db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    return create_workout_template(db, template)

# Get all workout templates
@router.get("/workout-templates/", response_model=List[WorkoutTemplateShow])
def read_workout_templates(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_workout_templates(db)

# Get workout templates by muscle group
@router.get("/workout-templates/muscle/{muscle_group}", response_model=List[WorkoutTemplateShow])
def read_templates_by_muscle(muscle_group: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_templates_by_muscle_group(db, muscle_group)

# === WORKOUT PLANS === (ABC, AB plans - 3 days a week, 2 days a week...)

# Create workout plan (coaches only)
@router.post("/workout-plans/", response_model=WorkoutPlanShow)
def add_workout_plan(plan: WorkoutPlanCreate, db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    return create_workout_plan(db, plan, current_user.id)

# Get workout plans (coaches see their own)
@router.get("/workout-plans/", response_model=List[WorkoutPlanShow])
def read_workout_plans(db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    return get_workout_plans(db, current_user.id)

# Get workout plan by id
@router.get("/workout-plans/{plan_id}", response_model=WorkoutPlanShow)
def read_workout_plan(plan_id: int, db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    plan = get_workout_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found")
    
    # Check if plan belongs to this coach
    if plan.created_by_coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own plans")
    
    return plan

# === CLIENT PLAN ASSIGNMENTS ===

# Assign plan to client (coaches only, requires client to have active subscription)
@router.post("/assign-plan/")
def assign_plan(assignment: AssignPlanToClient, db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    # Check if client exists and is a client
    from app.crud.user import get_user_by_id, is_coach_client_relationship
    client = get_user_by_id(db, assignment.client_id)
    if not client or str(client.role) != "UserRole.CLIENT":
        raise HTTPException(status_code=400, detail="Invalid client")
    
    # Check if client has active subscription
    if not has_active_subscription(assignment.client_id, db):
        raise HTTPException(
            status_code=403, 
            detail="Client must have an active subscription for plan assignment."
        )
    
    # Check if client belongs to this coach
    if not is_coach_client_relationship(db, current_user.id, assignment.client_id):
        raise HTTPException(status_code=403, detail="You can only assign plans to your own clients")
    
    # Assign plan to client
    updated_client = assign_plan_to_client(db, assignment.client_id, assignment.plan_name)
    if not updated_client:
        raise HTTPException(status_code=404, detail="Failed to assign plan")
    
    return {"message": f"Plan '{assignment.plan_name}' assigned to client successfully"}

# Get client's assigned plan
@router.get("/my-plan/", response_model=WorkoutPlanShow)
def read_my_plan(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if str(current_user.role) == "UserRole.CLIENT":
        plan = get_client_plan(db, current_user.id)
        if not plan:
            raise HTTPException(status_code=404, detail="No plan assigned")
        return plan
    else:
        raise HTTPException(status_code=403, detail="Only clients can view their assigned plan")

# Get assigned workouts for clients (placeholder endpoint)
@router.get("/assigned")
def get_assigned_workouts(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Get workouts assigned to the current client"""
    if str(current_user.role) != "UserRole.CLIENT":
        raise HTTPException(status_code=403, detail="Only clients can view their assigned workouts")
    
    # For now, return empty list as this feature needs to be implemented
    # This prevents the 404 error in the frontend
    return []

# === NEW WORKOUT CYCLE & TEMPLATE FEATURES ===

# Get all workout templates (public endpoint for landing page)
@router.get("/templates/public", response_model=List[WorkoutTemplateShow])
def get_public_workout_templates(
    muscle_group: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get workout templates for public viewing with optional muscle group filtering"""
    if muscle_group:
        return get_templates_by_muscle_group(db, muscle_group)
    return get_workout_templates(db)

# Get workout templates for specific booking based on workout cycle
@router.get("/booking/{booking_id}/suggested-templates")
def get_booking_workout_templates(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get workout templates for a specific booking based on workout cycle and muscle groups"""
    from app.crud.booking import get_booking
    from app.models.booking import Booking
    
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check permissions
    if str(current_user.role) == "UserRole.CLIENT" and str(booking.client_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only view your own bookings")
    
    client_id = int(str(booking.client_id))
    
    # Get client's plan
    plan = get_client_plan(db, client_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No workout plan assigned to client")
    
    # Calculate which day in the cycle this booking represents
    workout_day = calculate_workout_day_for_booking(db, client_id, booking_id)
    
    # Get muscle groups for this day
    muscle_groups = get_muscle_groups_for_day(plan, workout_day)
    
    if not muscle_groups:
        return {
            "workout_day": workout_day,
            "muscle_groups": [],
            "templates": [],
            "message": "No muscle groups defined for this day"
        }
    
    # Get workout templates for these muscle groups
    all_templates = []
    for muscle_group in muscle_groups:
        templates = get_templates_by_muscle_group(db, muscle_group.strip())
        all_templates.extend(templates)
    
    # Remove duplicates
    unique_templates = list({t.id: t for t in all_templates}.values())
    
    return {
        "workout_day": workout_day,
        "muscle_groups": muscle_groups,
        "templates": unique_templates,
        "total_templates": len(unique_templates)
    }

# Helper function to calculate workout day
def calculate_workout_day_for_booking(db: Session, client_id: int, booking_id: int) -> str:
    """Calculate which day (A, B, C, etc.) this booking represents in the workout cycle"""
    from app.models.booking import Booking
    from sqlalchemy import and_
    
    # Get all confirmed bookings for this client, ordered by date
    confirmed_bookings = db.query(Booking).filter(
        and_(
            Booking.client_id == client_id,
            Booking.status == 'confirmed'
        )
    ).order_by(Booking.date, Booking.id).all()
    
    # Find the position of current booking
    booking_position = 0
    for i, b in enumerate(confirmed_bookings):
        if b.id == booking_id:
            booking_position = i
            break
    
    # Get client's plan to know the cycle
    plan = get_client_plan(db, client_id)
    if not plan:
        return "A"  # Default to A if no plan
    
    # Determine cycle length based on plan type
    plan_name = str(plan.name).upper()
    if "ABC" in plan_name or "PPL" in plan_name:
        cycle_length = 3
        days = ["A", "B", "C"]
    elif "AB" in plan_name:
        cycle_length = 2
        days = ["A", "B"]
    elif "FIVE" in plan_name or "5" in plan_name:
        cycle_length = 5
        days = ["A", "B", "C", "D", "E"]
    else:
        cycle_length = 3  # Default to 3-day cycle
        days = ["A", "B", "C"]
    
    # Calculate day in cycle
    day_index = booking_position % cycle_length
    return days[day_index]

# Helper function to get muscle groups for a specific day
def get_muscle_groups_for_day(plan, day: str) -> List[str]:
    """Get muscle groups for a specific workout day"""
    day_mapping = {
        "A": plan.day_a,
        "B": plan.day_b,
        "C": plan.day_c,
        "D": plan.day_d,
        "E": plan.day_e
    }
    
    day_muscles = day_mapping.get(day, "")
    if not day_muscles:
        return []
    
    # Parse muscle groups (assume they're separated by + or ,)
    import re
    muscle_groups = re.split(r'[+,&]', str(day_muscles))
    return [mg.strip() for mg in muscle_groups if mg.strip()]

# === BOOKING WORKOUTS ===

# Get available workouts for booking (clients)
@router.get("/booking/{booking_id}/available-workouts")
def get_available_workouts(booking_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from app.crud.booking import get_booking
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check permissions
    if str(current_user.role) == "UserRole.CLIENT" and str(booking.client_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only view your own bookings")
    
    # Get client's plan
    client_id = int(str(booking.client_id))
    plan = get_client_plan(db, client_id)
    if not plan:
        return {"available_workouts": [{"workout": "Let Coach Decide", "description": "Coach will choose the workout"}]}
    
    available_workouts = []
    if str(plan.day_a or ""):
        available_workouts.append({"workout": f"A: {plan.day_a}", "description": f"Day A - {plan.day_a}"})
    if str(plan.day_b or ""):
        available_workouts.append({"workout": f"B: {plan.day_b}", "description": f"Day B - {plan.day_b}"})
    if str(plan.day_c or ""):
        available_workouts.append({"workout": f"C: {plan.day_c}", "description": f"Day C - {plan.day_c}"})
    if str(plan.day_d or ""):
        available_workouts.append({"workout": f"D: {plan.day_d}", "description": f"Day D - {plan.day_d}"})
    if str(plan.day_e or ""):
        available_workouts.append({"workout": f"E: {plan.day_e}", "description": f"Day E - {plan.day_e}"})
    
    available_workouts.append({"workout": "Let Coach Decide", "description": "Coach will choose the workout"})
    
    return {"available_workouts": available_workouts}

# Select workout for booking (clients)
@router.post("/select-workout/")
def select_workout(selection: BookingWorkoutSelect, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from app.crud.booking import get_booking
    booking = get_booking(db, selection.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check permissions
    if str(current_user.role) == "UserRole.CLIENT" and str(booking.client_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only select workouts for your own bookings")
    
    # Update booking with workout selection
    if selection.workout_day == "Let Coach Decide":
        updated_booking = update_booking_workout(db, selection.booking_id, None, "yes")
        return {"message": "Coach decision requested. Your coach will choose the workout."}
    else:
        updated_booking = update_booking_workout(db, selection.booking_id, selection.workout_day, "decided")
        return {"message": f"Workout selected: {selection.workout_day}"}

# Coach decides workout for client
@router.put("/coach-decide/{booking_id}")
def coach_decide_workout(booking_id: int, decision: CoachDecideWorkout, db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    from app.crud.booking import get_booking
    booking = get_booking(db, booking_id)
    if not booking or str(booking.coach_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only decide workouts for your own bookings")
    
    updated_booking = update_booking_workout(db, booking_id, decision.workout_day, "decided", decision.notes or "")
    return {"message": f"Workout decided: {decision.workout_day}"}

# Get pending coach decisions
@router.get("/pending-decisions/")
def read_pending_decisions(db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    pending = get_pending_coach_decisions(db, current_user.id)
    return {"pending_decisions": [{"booking_id": b.id, "client_id": str(b.client_id), "date": b.date} for b in pending]}
