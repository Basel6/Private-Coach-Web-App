# crud/schedule.py
# CRUD operations for scheduling system

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timedelta

from app.models.schedule import ScheduleSlot, ClientPlan, ClientPreference, PlanType, PlanRequestStatus
from app.models.user import User, UserRole
from app.models.booking import Booking


# ==================== SCHEDULE SLOTS ====================

def create_schedule_slot(db: Session, day_of_week: int, start_hour: int, coach_id: int) -> ScheduleSlot:
    """Create a new schedule slot"""
    slot = ScheduleSlot(
        day_of_week=day_of_week,
        start_hour=start_hour,
        coach_id=coach_id,
        capacity=10
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot

def get_schedule_slots(db: Session, day_of_week: Optional[int] = None, 
                      coach_id: Optional[int] = None, active_only: bool = True) -> List[ScheduleSlot]:
    """Get schedule slots with optional filters"""
    query = db.query(ScheduleSlot)
    
    if active_only:
        query = query.filter(ScheduleSlot.is_active == True)
    if day_of_week is not None:
        query = query.filter(ScheduleSlot.day_of_week == day_of_week)
    if coach_id is not None:
        query = query.filter(ScheduleSlot.coach_id == coach_id)
    
    return query.order_by(ScheduleSlot.day_of_week, ScheduleSlot.start_hour).all()

def get_slot_by_id(db: Session, slot_id: int) -> Optional[ScheduleSlot]:
    """Get schedule slot by ID"""
    return db.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id).first()

def get_available_slots_for_client(db: Session, client_id: int, week_start: datetime) -> List[ScheduleSlot]:
    """Get available slots for a client based on their assigned coach, existing bookings, and preferences"""
    # Get client's assigned coach
    client_plan = get_client_plan(db, client_id)
    if not client_plan:
        return []
    
    coach_id = client_plan.assigned_coach_id
    
    # Get client preferences
    client_preference = get_client_preference(db, client_id)
    
    # Get all slots for this coach
    slots = get_schedule_slots(db, coach_id=coach_id, active_only=True)
    
    # Filter slots that aren't at capacity for this week
    available_slots = []
    week_end = week_start + timedelta(days=7)
    
    for slot in slots:
        # Calculate the actual datetime for this slot in the given week
        slot_datetime = week_start + timedelta(
            days=slot.day_of_week,
            hours=slot.start_hour
        )
        
        if slot_datetime < week_start or slot_datetime >= week_end:
            continue
            
        # Count existing bookings for this slot in this week
        booking_count = db.query(Booking).filter(
            and_(
                Booking.slot_id == slot.id,
                Booking.date >= slot_datetime,
                Booking.date < slot_datetime + timedelta(hours=1),
                Booking.status != "cancelled"
            )
        ).count()
        
        if booking_count < slot.capacity:
            available_slots.append(slot)
    
    # Apply preference filtering if client has preferences
    if client_preference and client_preference.preferred_start_hour is not None and client_preference.preferred_end_hour is not None:
        preferred_start = client_preference.preferred_start_hour
        preferred_end = client_preference.preferred_end_hour
        
        if client_preference.is_flexible:
            # Flexible: Show preferred times + 1 hour buffer on each side
            filtered_slots = []
            for slot in available_slots:
                if (slot.start_hour >= preferred_start - 1 and 
                    slot.start_hour <= preferred_end + 1):
                    filtered_slots.append(slot)
            
            # Sort by preference: exact match first, then nearby
            def preference_score(slot):
                if slot.start_hour >= preferred_start and slot.start_hour <= preferred_end:
                    return 0  # Perfect match
                elif slot.start_hour == preferred_start - 1 or slot.start_hour == preferred_end + 1:
                    return 1  # Close match
                else:
                    return 2  # Other
            
            filtered_slots.sort(key=preference_score)
            return filtered_slots
        else:
            # Strict: Only show slots within preferred time range
            return [slot for slot in available_slots 
                   if slot.start_hour >= preferred_start and slot.start_hour <= preferred_end]
    
    # No preferences set - return all available slots
    return available_slots

def seed_weekly_schedule(db: Session) -> bool:
    """Seed the database with standard weekly schedule slots"""
    try:
        # Get coaches with their shifts
        coaches = db.query(User).filter(
            and_(
                User.role == UserRole.COACH,
                User.shift_start_hour.isnot(None),
                User.shift_end_hour.isnot(None)
            )
        ).all()
        
        if not coaches:
            print("⚠️ No coaches with shift hours found. Please set coach shifts first.")
            return False
        
        slots_created = 0
        for coach in coaches:
            shift_start = getattr(coach, 'shift_start_hour', 10)
            shift_end = getattr(coach, 'shift_end_hour', 21)
            
            # Create slots for each day of the week and each hour in coach's shift
            for day in range(7):  # Monday=0 to Sunday=6
                for hour in range(shift_start, shift_end + 1):
                    # Skip lunch break hours (12 PM - 2 PM, gym closed)
                    if hour >= 12 and hour <= 13:  # 12 PM (hour 12) and 1 PM (hour 13)
                        continue
                    
                    # Check if slot already exists
                    existing = db.query(ScheduleSlot).filter(
                        and_(
                            ScheduleSlot.day_of_week == day,
                            ScheduleSlot.start_hour == hour,
                            ScheduleSlot.coach_id == coach.id
                        )
                    ).first()
                    
                    if not existing:
                        create_schedule_slot(db, day, hour, coach.id)
                        slots_created += 1
        
        print(f"✅ Created {slots_created} schedule slots")
        return True
        
    except Exception as e:
        print(f"❌ Error seeding schedule: {e}")
        db.rollback()
        return False


# ==================== CLIENT PLANS ====================

def create_client_plan(db: Session, client_id: int, plan_type: PlanType, 
                      assigned_coach_id: int) -> ClientPlan:
    """Create or update client plan"""
    from app.models.user import User
    
    # Remove existing plan for this client
    existing = db.query(ClientPlan).filter(ClientPlan.client_id == client_id).first()
    if existing:
        db.delete(existing)

    # Map plan type to sessions per week
    sessions_map = {
        PlanType.AB: 2,
        PlanType.ABC: 3,
        PlanType.PPL: 3,
        PlanType.FIVE_DAY: 5
    }

    plan = ClientPlan(
        client_id=client_id,
        plan_type=plan_type,
        sessions_per_week=sessions_map[plan_type],
        assigned_coach_id=assigned_coach_id
    )
    db.add(plan)
    
    # Also update the Users table plan field
    user = db.query(User).filter(User.id == client_id).first()
    if user:
        user.plan = plan_type.value  # Store the enum value as string
    
    db.commit()
    db.refresh(plan)
    return plan

def get_client_plan(db: Session, client_id: int) -> Optional[ClientPlan]:
    """Get client's current plan"""
    return db.query(ClientPlan).filter(ClientPlan.client_id == client_id).first()

def get_clients_for_coach(db: Session, coach_id: int) -> List[ClientPlan]:
    """Get all clients assigned to a coach"""
    return db.query(ClientPlan).filter(ClientPlan.assigned_coach_id == coach_id).all()


# ==================== CLIENT PREFERENCES ====================

def create_or_update_client_preference(db: Session, client_id: int, 
                                     preferred_start_hour: Optional[int] = None,
                                     preferred_end_hour: Optional[int] = None,
                                     is_flexible: bool = False) -> ClientPreference:
    """Create or update client scheduling preferences"""
    # Remove existing preference
    existing = db.query(ClientPreference).filter(ClientPreference.client_id == client_id).first()
    if existing:
        db.delete(existing)
    
    preference = ClientPreference(
        client_id=client_id,
        preferred_start_hour=preferred_start_hour,
        preferred_end_hour=preferred_end_hour,
        is_flexible=is_flexible
    )
    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference

def get_client_preference(db: Session, client_id: int) -> Optional[ClientPreference]:
    """Get client's scheduling preferences"""
    return db.query(ClientPreference).filter(ClientPreference.client_id == client_id).first()

def get_all_client_preferences(db: Session) -> List[ClientPreference]:
    """Get all client preferences"""
    return db.query(ClientPreference).all()


# ==================== SCHEDULING ANALYTICS ====================

def get_slot_occupancy(db: Session, slot_id: int, week_start: datetime) -> int:
    """Get current occupancy for a specific slot in a given week"""
    week_end = week_start + timedelta(days=7)
    
    slot = get_slot_by_id(db, slot_id)
    if not slot:
        return 0
    
    # Calculate the actual datetime for this slot in the given week
    slot_datetime = week_start + timedelta(
        days=slot.day_of_week,
        hours=slot.start_hour
    )
    
    if slot_datetime < week_start or slot_datetime >= week_end:
        return 0
    
    return db.query(Booking).filter(
        and_(
            Booking.slot_id == slot_id,
            Booking.date >= slot_datetime,
            Booking.date < slot_datetime + timedelta(hours=1),
            Booking.status != "cancelled"
        )
    ).count()

def get_week_schedule_summary(db: Session, week_start: datetime) -> Dict[str, any]:
    """Get summary statistics for a week's schedule"""
    week_end = week_start + timedelta(days=7)
    
    # Total slots available
    total_slots = db.query(ScheduleSlot).filter(ScheduleSlot.is_active == True).count()
    
    # Total bookings for the week
    total_bookings = db.query(Booking).filter(
        and_(
            Booking.date >= week_start,
            Booking.date < week_end,
            Booking.status != "cancelled"
        )
    ).count()
    
    # Capacity utilization
    total_capacity = total_slots * 10  # 10 clients per slot
    utilization_rate = (total_bookings / total_capacity * 100) if total_capacity > 0 else 0
    
    return {
        "week_start": week_start.isoformat(),
        "total_slots": total_slots,
        "total_bookings": total_bookings,
        "total_capacity": total_capacity,
        "utilization_rate": round(utilization_rate, 2),
        "available_spots": total_capacity - total_bookings
    }


# ==================== PLAN REQUESTS ====================

def create_plan_request(db: Session, client_id: int, coach_id: int, message: Optional[str] = None):
    """Create a plan request from client to coach"""
    from app.models.schedule import PlanRequest
    
    # Check if there's already a pending request
    existing = db.query(PlanRequest).filter(
        PlanRequest.client_id == client_id,
        PlanRequest.coach_id == coach_id,
        PlanRequest.status == PlanRequestStatus.PENDING
    ).first()
    
    if existing:
        return existing  # Return existing pending request
    
    request = PlanRequest(
        client_id=client_id,
        coach_id=coach_id,
        message=message,
        status=PlanRequestStatus.PENDING
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request

def get_plan_requests_for_coach(db: Session, coach_id: int, status: Optional[str] = None):
    """Get plan requests for a specific coach"""
    from app.models.schedule import PlanRequest
    
    query = db.query(PlanRequest).filter(PlanRequest.coach_id == coach_id)
    if status:
        query = query.filter(PlanRequest.status == status)
    return query.order_by(PlanRequest.created_at.desc()).all()

def get_plan_requests_for_client(db: Session, client_id: int):
    """Get plan requests made by a specific client"""
    from app.models.schedule import PlanRequest
    
    return db.query(PlanRequest).filter(
        PlanRequest.client_id == client_id
    ).order_by(PlanRequest.created_at.desc()).all()

def update_plan_request(db: Session, request_id: int, status: str, response_message: Optional[str] = None):
    """Update plan request status (approve/reject)"""
    from app.models.schedule import PlanRequest
    
    request = db.query(PlanRequest).filter(PlanRequest.id == request_id).first()
    if not request:
        return None
    
    setattr(request, 'status', status)
    if response_message:
        setattr(request, 'response_message', response_message)
    
    db.commit()
    db.refresh(request)
    return request