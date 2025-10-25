from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.routes.user import get_db
from app.schemas.booking import BookingCreate, BookingShow
from app.crud.booking import create_booking, get_bookings, get_booking, update_booking_status, delete_booking
from app.models.booking import Booking
from app.routes.user import require_client_role, get_current_user, require_coach_role
from app.services.subscriptions import has_active_subscription
from app.models.payment import Payment

router = APIRouter()


# Create a new booking (only clients with active subscription)
@router.post("/", response_model=BookingShow)
def add_booking(booking: BookingCreate, db: Session = Depends(get_db), current_user=Depends(require_client_role)):
    from app.crud.user import get_user_by_id
    
    # Check if client has active subscription
    if not has_active_subscription(current_user.id, db):
        raise HTTPException(
            status_code=403, 
            detail="Active subscription required to book sessions."
        )
    
    # Check client is booking for themselves
    if booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only book for yourself.")
    # Check coach exists and is a coach
    coach = get_user_by_id(db, booking.coach_id)
    if not coach or str(coach.role) != "UserRole.COACH":
        raise HTTPException(status_code=400, detail="Selected coach is not a coach.")
    # Prevent client from booking more than once per day
    booking_day = booking.date.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day = booking_day.replace(day=booking_day.day+1)
    existing = db.query(Booking).filter(
        Booking.client_id == current_user.id,
        Booking.date >= booking_day,
        Booking.date < next_day
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You can only book once per day.")

    # Check max clients per hour (2 for demo)
    booking_hour = booking.date.replace(minute=0, second=0, microsecond=0)
    next_hour = booking_hour.replace(hour=booking_hour.hour+1)
    count = db.query(Booking).filter(
        Booking.date >= booking_hour,
        Booking.date < next_hour
    ).count()
    if count >= 2:
        raise HTTPException(status_code=400, detail="The studio is full at this time, sorry.")
    # Save booking
    booked = create_booking(db, booking)
    return booked
 # Get available booking slots for a day (dropdown)
@router.get("/slots")
def get_available_slots(date: str, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    # Opening hours: 10:00 to 22:00
    try:
        day = datetime.strptime(date.strip(), "%d-%m-%Y")
    except Exception:
        raise HTTPException(status_code=422, detail="Date format should be DD-MM-YYYY (example: 18-07-2025)")
    slots = []
    for hour in range(10, 22):
        slot_start = day.replace(hour=hour, minute=0, second=0, microsecond=0)
        slot_end = slot_start + timedelta(hours=1)
        count = db.query(Booking).filter(
            Booking.date >= slot_start,
            Booking.date < slot_end
        ).count()
        if count < 2:
            slots.append(slot_start.strftime("%H:%M"))
    return {"available_slots": slots}

# Get client's available workout days for booking
@router.get("/{booking_id}/available-workouts")
def get_available_workouts(booking_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check permissions
    if str(current_user.role) == "UserRole.CLIENT" and str(booking.client_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only view your own bookings.")
    elif str(current_user.role) == "UserRole.COACH" and str(booking.coach_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only view bookings assigned to you.")
    
    # Get client's assigned plan using the new simplified system
    from app.crud.workout import get_client_plan
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
    
    available_workouts.append({
        "workout": "Let Coach Decide",
        "description": "Coach will choose the workout"
    })
    
    return {"available_workouts": available_workouts}



# Get pending bookings (for coaches to approve/reject)
@router.get("/pending", response_model=list[BookingShow])
def get_pending_bookings(db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    """Get all pending bookings for the current coach"""
    from sqlalchemy.orm import joinedload
    return db.query(Booking).options(
        joinedload(Booking.client),
        joinedload(Booking.coach)
    ).filter(
        Booking.coach_id == current_user.id,
        Booking.status == "pending"
    ).all()

# Get coach bookings (all bookings for current coach)
@router.get("/coach-bookings", response_model=list[BookingShow])
def get_coach_bookings(db: Session = Depends(get_db), current_user=Depends(require_coach_role)):
    """Get all bookings for the current coach"""
    from sqlalchemy.orm import joinedload
    return db.query(Booking).options(
        joinedload(Booking.client),
        joinedload(Booking.coach)
    ).filter(Booking.coach_id == current_user.id).all()

# Get client bookings (all bookings for current client)
@router.get("/client-bookings", response_model=list[BookingShow])
def get_client_bookings(db: Session = Depends(get_db), current_user=Depends(require_client_role)):
    """Get all bookings for the current client"""
    return db.query(Booking).filter(Booking.client_id == current_user.id).all()

# Get my bookings (alias for /bookings/ for frontend compatibility)
@router.get("/my-bookings", response_model=list[BookingShow])
def read_my_bookings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    # Clients can only see their own bookings
    if str(current_user.role) == "UserRole.CLIENT":
        return db.query(Booking).options(
            joinedload(Booking.client),
            joinedload(Booking.coach)
        ).filter(Booking.client_id == current_user.id).all()
    # Coaches can see all bookings
    elif str(current_user.role) == "UserRole.COACH":
        return db.query(Booking).options(
            joinedload(Booking.client),
            joinedload(Booking.coach)
        ).all()
    else:
        return []

# Get all bookings (clients see their own, coaches see all)
@router.get("/", response_model=list[BookingShow])
def read_bookings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Coaches can see all bookings
    if str(current_user.role) == "UserRole.COACH":
        return get_bookings(db)
    # Clients can only see their own bookings
    else:
        return db.query(Booking).filter(Booking.client_id == current_user.id).all()



# Get booking by id (clients see their own, coaches see all)
@router.get("/{booking_id}", response_model=BookingShow)
def read_booking(booking_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Clients can only see their own bookings
    if str(current_user.role) == "UserRole.CLIENT" and booking.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own bookings.")
    return booking



# Update booking status (only coaches)
class BookingStatusUpdate(BaseModel):
    status: str
    coach_notes: Optional[str] = None

class BookingWorkoutUpdate(BaseModel):
    workout_day: str

@router.put("/{booking_id}/workout", response_model=BookingShow)
def update_booking_workout(
    booking_id: int,
    workout_update: BookingWorkoutUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update the workout day for a booking (by client who made it or coach assigned to it)"""
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if the current user is either the client who made this booking or the coach assigned to it
    if booking.client_id != current_user.id and booking.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update bookings you're involved in")
    
    # Update the workout field
    setattr(booking, 'workout', workout_update.workout_day)
    db.commit()
    db.refresh(booking)
    
    return booking

@router.put("/{booking_id}", response_model=BookingShow)
def update_booking_status_endpoint(
    booking_id: int, 
    status_update: BookingStatusUpdate, 
    db: Session = Depends(get_db), 
    current_user=Depends(require_coach_role)
):
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Coach can only update bookings where they are the assigned coach
    if booking.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update bookings assigned to you.")
    
    # Update status
    updated_booking = update_booking_status(db, booking_id, status_update.status)
    
    # Update coach notes if provided
    if status_update.coach_notes is not None:
        setattr(updated_booking, 'coach_notes', status_update.coach_notes)
        db.commit()
        db.refresh(updated_booking)
    
    return updated_booking



# Delete a booking (clients can cancel pending bookings, coaches can delete any)
@router.delete("/{booking_id}")
def remove_booking(booking_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    booking = get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Client can only cancel their own pending bookings
    if str(current_user.role) == "UserRole.CLIENT":
        if booking.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only cancel your own bookings.")
        if str(booking.status) != "pending":
            raise HTTPException(status_code=400, detail="You can only cancel pending bookings. Contact your coach for confirmed bookings.")
        # Change status to cancelled instead of deleting
        updated_booking = update_booking_status(db, booking_id, "cancelled")
        return {"message": "Booking cancelled successfully"}
    
    # Coach can delete bookings where they are the assigned coach
    elif str(current_user.role) == "UserRole.COACH":
        if booking.coach_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only delete bookings assigned to you.")
        delete_booking(db, booking_id)
        return {"message": "Booking deleted successfully"}
    
    else:
        raise HTTPException(status_code=403, detail="Not allowed to delete bookings.")

