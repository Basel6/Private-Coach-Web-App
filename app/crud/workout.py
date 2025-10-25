from sqlalchemy.orm import Session
from typing import Optional
from app.models.workout import WorkoutTemplate, WorkoutPlan
from app.models.user import User
from app.models.booking import Booking
from app.schemas.workout import WorkoutTemplateCreate, WorkoutPlanCreate

# Workout Template CRUD
def create_workout_template(db: Session, template: WorkoutTemplateCreate):
    db_template = WorkoutTemplate(**template.dict())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

def get_workout_templates(db: Session):
    return db.query(WorkoutTemplate).all()

def get_workout_template(db: Session, template_id: int):
    return db.query(WorkoutTemplate).filter(WorkoutTemplate.id == template_id).first()

def get_templates_by_muscle_group(db: Session, muscle_group: str):
    return db.query(WorkoutTemplate).filter(WorkoutTemplate.muscle_group == muscle_group).all()

# Workout Plan CRUD (Simplified)
def create_workout_plan(db: Session, plan: WorkoutPlanCreate, coach_id: int):
    db_plan = WorkoutPlan(
        name=plan.name,
        description=plan.description,
        created_by_coach_id=coach_id,
        day_a=plan.day_a,
        day_b=plan.day_b,
        day_c=plan.day_c,
        day_d=plan.day_d,
        day_e=plan.day_e
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

def get_workout_plans(db: Session, coach_id: Optional[int] = None):
    if coach_id:
        return db.query(WorkoutPlan).filter(WorkoutPlan.created_by_coach_id == coach_id).all()
    return db.query(WorkoutPlan).all()

def get_workout_plan(db: Session, plan_id: int):
    return db.query(WorkoutPlan).filter(WorkoutPlan.id == plan_id).first()

def get_workout_plan_by_name(db: Session, plan_name: str):
    return db.query(WorkoutPlan).filter(WorkoutPlan.name == plan_name).first()

# User Plan Assignment (Simplified)
def assign_plan_to_client(db: Session, client_id: int, plan_name: str):
    user = db.query(User).filter(User.id == client_id).first()
    if user:
        setattr(user, 'plan', plan_name)
        db.commit()
        db.refresh(user)
    return user

def get_client_plan(db: Session, client_id: int):
    user = db.query(User).filter(User.id == client_id).first()
    if user and str(user.plan or ""):
        return get_workout_plan_by_name(db, str(user.plan))
    return None

def get_clients_with_plan(db: Session, plan_name: str):
    return db.query(User).filter(User.plan == plan_name).all()

# Booking Workout CRUD (Simplified)
def update_booking_workout(db: Session, booking_id: int, workout_day: Optional[str] = None, 
                          coach_decision: str = "no", notes: str = ""):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking:
        if workout_day:
            setattr(booking, 'workout', workout_day)
        setattr(booking, 'coach_decision_requested', coach_decision)
        if notes:
            setattr(booking, 'coach_notes', notes)
        # Set plan from client's assigned plan
        client = db.query(User).filter(User.id == booking.client_id).first()
        if client and str(client.plan or ""):
            setattr(booking, 'plan', str(client.plan))
        db.commit()
        db.refresh(booking)
    return booking

def get_pending_coach_decisions(db: Session, coach_id: int):
    return db.query(Booking).filter(
        Booking.coach_id == coach_id,
        Booking.coach_decision_requested == "yes"
    ).all()
