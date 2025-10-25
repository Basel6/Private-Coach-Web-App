"""
Schedule management routes for the Personal Trainer API.
Provides endpoints for schedule slots, client plans, preferences, and AI booking suggestions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta

import database as database
from app.crud import schedule as schedule_crud, user as user_crud
from app.schemas import schedule as schedule_schemas
from app.schemas.ai_booking import SelectiveBookingRequest, ReSuggestionRequest, SuggestionResponse, SessionBasedBookingRequest, IndividualReSuggestionRequest
from app.auth.permissions import require_coach_role, require_accountant_role, get_current_user_import
from app.models.user import User, UserRole
from app.services.scheduler import CPSATScheduler
from app.models.schedule import PlanType, ClientPreference, PlanRequestStatus

router = APIRouter()

# Dependency to get DB session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Simplified auth dependencies
require_auth = get_current_user_import()
require_coach = require_coach_role
require_admin = require_accountant_role

# ============================================================================
# SCHEDULE SLOTS ENDPOINTS
# ============================================================================

@router.get("/slots", response_model=List[schedule_schemas.ScheduleSlotOut])
def get_schedule_slots(
    date_from: Optional[date] = Query(None, description="Filter slots from this date"),
    date_to: Optional[date] = Query(None, description="Filter slots until this date"),
    coach_id: Optional[int] = Query(None, description="Filter by coach ID"),
    day_of_week: Optional[int] = Query(None, ge=0, le=6, description="Filter by day of week (0=Monday, 6=Sunday)"),
    hour: Optional[int] = Query(None, ge=0, le=23, description="Filter by hour"),
    available_only: bool = Query(False, description="Show only available slots"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get schedule slots with optional filtering."""
    
    # Use the basic function signature that exists in CRUD
    slots = schedule_crud.get_schedule_slots(
        db,
        day_of_week=day_of_week,
        coach_id=coach_id
    )
    
    return slots

@router.get("/slots/availability", response_model=List[schedule_schemas.ScheduleSlotOut])
def get_available_slots_for_client(
    client_id: int = Query(..., description="Client ID"),
    date_from: Optional[date] = Query(None, description="Search from this date"),
    days_ahead: int = Query(7, ge=1, le=30, description="Number of days to search ahead"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get available slots for a specific client based on their plan and preferences."""
    
    # Authorization check - clients can only see their own availability
    if getattr(current_user, 'role') != UserRole.COACH and getattr(current_user, 'id') != client_id:
        raise HTTPException(
            status_code=403, 
            detail="Access denied: You can only view your own available slots"
        )
    
    # Calculate week_start based on date_from or today
    target_date = date_from or date.today()
    week_start = datetime.combine(target_date, datetime.min.time())
    
    slots = schedule_crud.get_available_slots_for_client(
        db,
        client_id=client_id,
        week_start=week_start
    )
    
    return slots


@router.get("/slots/{slot_id}", response_model=schedule_schemas.ScheduleSlotOut)
def get_schedule_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get a specific schedule slot by ID."""
    
    slot = schedule_crud.get_slot_by_id(db, slot_id)
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule slot not found"
        )
    
    return slot

# ============================================================================
# CLIENT PLANS ENDPOINTS
# ============================================================================

@router.get("/plans", response_model=List[schedule_schemas.ClientPlanOut])
def get_client_plans(
    client_id: Optional[str] = Query(None, description="Filter by client ID (use 'me' for current user)"),
    coach_id: Optional[int] = Query(None, description="Filter by coach ID"),
    active_only: bool = Query(True, description="Show only active plans"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get client plans with optional filtering."""
    
    # Handle "me" parameter for current user
    if client_id == "me" or getattr(current_user, 'role') == UserRole.CLIENT:
        # Force client to see only their own plans
        actual_client_id = getattr(current_user, 'id')
        plan = schedule_crud.get_client_plan(db, actual_client_id)
        if plan:
            # Add coach information
            coach = user_crud.get_user_by_id(db, getattr(plan, 'assigned_coach_id'))
            plan_dict = {
                **plan.__dict__,
                'coach_name': f"{getattr(coach, 'first_name', '')} {getattr(coach, 'last_name', '')}".strip() if coach else None,
                'coach_username': getattr(coach, 'username', None) if coach else None
            }
            return [schedule_schemas.ClientPlanOut(**plan_dict)]
        return []
    elif client_id and client_id.isdigit():
        # Handle numeric client_id
        actual_client_id = int(client_id)
        # Authorization check for accessing other user's plans
        if getattr(current_user, 'role') == UserRole.CLIENT and actual_client_id != getattr(current_user, 'id'):
            raise HTTPException(
                status_code=403,
                detail="You can only view your own plan"
            )
        plan = schedule_crud.get_client_plan(db, actual_client_id)
        if plan:
            # Add coach information
            coach = user_crud.get_user_by_id(db, getattr(plan, 'assigned_coach_id'))
            plan_dict = {
                **plan.__dict__,
                'coach_name': f"{getattr(coach, 'first_name', '')} {getattr(coach, 'last_name', '')}".strip() if coach else None,
                'coach_username': getattr(coach, 'username', None) if coach else None
            }
            return [schedule_schemas.ClientPlanOut(**plan_dict)]
        return []
    elif coach_id:
        # Only coaches can filter by coach_id
        if getattr(current_user, 'role') != UserRole.COACH:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Only coaches can view plans by coach"
            )
        plans = schedule_crud.get_clients_for_coach(db, coach_id)
        return plans
    else:
        # Only coaches can see all plans
        if getattr(current_user, 'role') != UserRole.COACH:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Only coaches can view all plans"
            )
        # This function doesn't exist in CRUD, so return empty for now
        return []

@router.post("/plans", response_model=schedule_schemas.ClientPlanOut)
def create_client_plan(
    plan: schedule_schemas.ClientPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach)
):
    """Create a new client plan."""
    
    db_plan = schedule_crud.create_client_plan(
        db, 
        client_id=plan.client_id,
        plan_type=PlanType(plan.plan_type.value),  # Convert enum properly
        assigned_coach_id=plan.assigned_coach_id
    )
    return db_plan

@router.put("/plans/{plan_id}")
def update_client_plan(
    plan_id: int,
    plan: schedule_schemas.ClientPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach)
):
    """Update an existing client plan - Not implemented in CRUD yet."""
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Update client plan not implemented yet"
    )

@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach)
):
    """Delete a client plan - Not implemented in CRUD yet."""
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Delete client plan not implemented yet"
    )


# ============================================================================
# PLAN REQUESTS ENDPOINTS
# ============================================================================

@router.post("/plan-requests", response_model=schedule_schemas.PlanRequestOut)
def create_plan_request(
    request: schedule_schemas.PlanRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a plan request from client to coach."""
    
    # Authorization: Only clients can create plan requests for themselves
    if getattr(current_user, 'role') != UserRole.CLIENT:
        raise HTTPException(
            status_code=403,
            detail="Only clients can request plans"
        )
    
    if request.client_id != getattr(current_user, 'id'):
        raise HTTPException(
            status_code=403,
            detail="You can only request plans for yourself"
        )
    
    # Verify coach exists and is actually a coach
    coach = user_crud.get_user_by_id(db, request.coach_id)
    if not coach or getattr(coach, 'role') != UserRole.COACH:
        raise HTTPException(
            status_code=400,
            detail="Invalid coach ID"
        )
    
    # Check if client already has a plan
    existing_plan = schedule_crud.get_client_plan(db, request.client_id)
    if existing_plan:
        raise HTTPException(
            status_code=400,
            detail="You already have a plan assigned. Contact your coach to modify it."
        )
    
    # Check for existing pending request
    from app.models.schedule import PlanRequest
    existing_request = db.query(PlanRequest).filter(
        PlanRequest.client_id == request.client_id,
        PlanRequest.coach_id == request.coach_id,
        PlanRequest.status == PlanRequestStatus.PENDING
    ).first()
    
    if existing_request:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending plan request with this coach. Please wait for a response."
        )
    
    plan_request = schedule_crud.create_plan_request(
        db,
        client_id=request.client_id,
        coach_id=request.coach_id,
        message=request.message
    )
    
    return plan_request

@router.get("/plan-requests/my-requests", response_model=List[schedule_schemas.PlanRequestOut])
def get_my_plan_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get plan requests for current user (client sees their requests, coach sees requests to them)."""
    
    if getattr(current_user, 'role') == UserRole.CLIENT:
        requests = schedule_crud.get_plan_requests_for_client(db, getattr(current_user, 'id'))
    elif getattr(current_user, 'role') == UserRole.COACH:
        requests = schedule_crud.get_plan_requests_for_coach(db, getattr(current_user, 'id'))
    else:
        raise HTTPException(
            status_code=403,
            detail="Only clients and coaches can view plan requests"
        )
    
    return requests

@router.get("/plan-requests/pending", response_model=List[schedule_schemas.PlanRequestOut])
def get_pending_plan_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach)
):
    """Get pending plan requests for current coach."""
    
    requests = schedule_crud.get_plan_requests_for_coach(
        db, 
        getattr(current_user, 'id'), 
        status="PENDING"
    )
    
    return requests

@router.put("/plan-requests/{request_id}", response_model=schedule_schemas.PlanRequestOut)
def update_plan_request(
    request_id: int,
    update_data: schedule_schemas.PlanRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach)
):
    """Approve or reject a plan request (coaches only)."""
    
    # Get the request first
    from app.models.schedule import PlanRequest
    plan_request = db.query(PlanRequest).filter(PlanRequest.id == request_id).first()
    
    if not plan_request:
        raise HTTPException(
            status_code=404,
            detail="Plan request not found"
        )
    
    # Verify this coach owns the request
    if plan_request.coach_id != getattr(current_user, 'id'):
        raise HTTPException(
            status_code=403,
            detail="You can only respond to plan requests sent to you"
        )
    
    # Verify status is valid
    if update_data.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be APPROVED or REJECTED"
        )
    
    # Update the request
    updated_request = schedule_crud.update_plan_request(
        db,
        request_id=request_id,
        status=update_data.status,
        response_message=update_data.response_message
    )
    
    # If approved, create a plan for the client
    if update_data.status == "APPROVED":
        try:
            # Use the chosen plan type or default to ABC
            from app.models.schedule import PlanType
            
            plan_type_mapping = {
                "AB": PlanType.AB,
                "ABC": PlanType.ABC,
                "PPL": PlanType.PPL,
                "FIVE_DAY": PlanType.FIVE_DAY
            }
            
            chosen_plan_type = plan_type_mapping.get(
                update_data.plan_type or "ABC", 
                PlanType.ABC
            )
            
            schedule_crud.create_client_plan(
                db,
                client_id=getattr(plan_request, 'client_id'),
                plan_type=chosen_plan_type,
                assigned_coach_id=getattr(plan_request, 'coach_id')
            )
        except Exception as e:
            # If plan creation fails, update request status back
            schedule_crud.update_plan_request(
                db,
                request_id=request_id,
                status="PENDING",
                response_message="Error creating plan. Please try again."
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to create plan after approval"
            )
    
    return updated_request

# ============================================================================
# CLIENT PREFERENCES ENDPOINTS
# ============================================================================

@router.get("/preferences", response_model=List[schedule_schemas.ClientPreferenceOut])
def get_client_preferences(
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get client preferences with optional filtering."""
    
    # Authorization: Clients can only see their own preferences, coaches can see all
    if getattr(current_user, 'role') == UserRole.CLIENT:
        # Force client to see only their own preferences
        client_id = getattr(current_user, 'id')
    
    if client_id:
        preference = schedule_crud.get_client_preference(db, client_id)
        return [preference] if preference else []
    else:
        # Only coaches can see all preferences
        if getattr(current_user, 'role') != UserRole.COACH:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Only coaches can view all preferences"
            )
        preferences = schedule_crud.get_all_client_preferences(db)
        return preferences

@router.post("/preferences", response_model=schedule_schemas.ClientPreferenceOut)
def create_client_preference(
    preference: schedule_schemas.ClientPreferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create a new client preference."""
    
    # Authorization: Clients can only create their own preferences, coaches can create for any client
    if getattr(current_user, 'role') == UserRole.CLIENT:
        if preference.client_id != getattr(current_user, 'id'):
            raise HTTPException(
                status_code=403,
                detail="Access denied: You can only create preferences for yourself"
            )
    
    # Check if user exists and is a client
    client = db.query(User).filter(User.id == preference.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if preference already exists
    existing_preference = schedule_crud.get_client_preference(db, preference.client_id)
    if existing_preference:
        raise HTTPException(
            status_code=409, 
            detail=f"Client {preference.client_id} already has preferences. Use PUT to update existing preferences."
        )
    
    # Create the preference
    created_preference = schedule_crud.create_or_update_client_preference(
        db=db,
        client_id=preference.client_id,
        preferred_start_hour=preference.preferred_start_hour,
        preferred_end_hour=preference.preferred_end_hour,
        is_flexible=preference.is_flexible
    )
    
    return created_preference

@router.put("/preferences/{preference_id}", response_model=schedule_schemas.ClientPreferenceOut)
def update_client_preference(
    preference_id: int,
    preference: schedule_schemas.ClientPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update an existing client preference."""
    
    # Get the existing preference
    from app.models.schedule import ClientPreference
    existing_preference = db.query(ClientPreference).filter(ClientPreference.id == preference_id).first()
    if not existing_preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    
    # Authorization: Clients can only update their own preferences, coaches can update any  
    if getattr(current_user, 'role') == UserRole.CLIENT:
        if existing_preference.client_id != getattr(current_user, 'id'):
            raise HTTPException(
                status_code=403,
                detail="Access denied: You can only update your own preferences"
            )
    
    # Update using raw SQL to avoid typing issues
    from sqlalchemy import text
    update_query = text("""
        UPDATE client_preferences 
        SET preferred_start_hour = COALESCE(:start_hour, preferred_start_hour),
            preferred_end_hour = COALESCE(:end_hour, preferred_end_hour),
            is_flexible = COALESCE(:flexible, is_flexible)
        WHERE id = :pref_id
    """)
    
    db.execute(update_query, {
        'start_hour': preference.preferred_start_hour,
        'end_hour': preference.preferred_end_hour, 
        'flexible': preference.is_flexible,
        'pref_id': preference_id
    })
    db.commit()
    
    # Return the updated preference
    updated_preference = db.query(ClientPreference).filter(ClientPreference.id == preference_id).first()
    return updated_preference

@router.delete("/preferences/{preference_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_preference(
    preference_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete a client preference."""
    
    # Get the existing preference
    from app.models.schedule import ClientPreference
    existing_preference = db.query(ClientPreference).filter(ClientPreference.id == preference_id).first()
    if not existing_preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    
    # Authorization: Clients can only delete their own preferences, coaches can delete any
    if getattr(current_user, 'role') == UserRole.CLIENT:
        if existing_preference.client_id != getattr(current_user, 'id'):
            raise HTTPException(
                status_code=403,
                detail="Access denied: You can only delete your own preferences"
            )
    
    # Delete the preference
    db.delete(existing_preference)
    db.commit()
    
    return  # 204 No Content

# ============================================================================
# ANALYTICS AND MONITORING ENDPOINTS
# ============================================================================

@router.get("/analytics/occupancy")
def get_slot_occupancy_analytics(
    date_from: Optional[date] = Query(None, description="Start date for analytics"),
    date_to: Optional[date] = Query(None, description="End date for analytics"),
    coach_id: Optional[int] = Query(None, description="Filter by coach ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get slot occupancy analytics for monitoring utilization."""
    
    # Use the week summary function that exists
    target_date = date_from or date.today()
    week_start = datetime.combine(target_date, datetime.min.time())
    
    summary = schedule_crud.get_week_schedule_summary(db, week_start)
    
    return {
        "week_start": str(week_start.date()),
        "summary": summary,
        "message": "Basic occupancy analytics - full analytics coming in PR 2"
    }

@router.get("/analytics/utilization")
def get_coach_utilization(
    date_from: Optional[date] = Query(None, description="Start date for analytics"),
    date_to: Optional[date] = Query(None, description="End date for analytics"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach)
):
    """Get coach utilization statistics."""
    
    return {
        "message": "Coach utilization analytics will be implemented in PR 2",
        "date_from": str(date_from) if date_from else None,
        "date_to": str(date_to) if date_to else None
    }

# ============================================================================
# AI BOOKING SUGGESTIONS (Placeholder for future CP-SAT integration)
# ============================================================================

@router.post("/suggestions/booking", response_model=SuggestionResponse)
def suggest_optimal_booking(
    client_id: int = Query(..., description="Client ID"),
    preferred_date: Optional[date] = Query(None, description="Preferred booking date"),
    days_flexibility: int = Query(3, ge=1, le=14, description="Number of days flexibility"),
    num_sessions: int = Query(1, ge=1, le=5, description="Number of sessions to schedule"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    Get AI-powered booking suggestions with session management.
    
    Returns suggestions with a session token for later booking/re-suggestion.
    Session expires in 1 hour to maintain suggestion consistency.
    """
    
    import uuid
    from datetime import timedelta
    from app.models.suggestion_session import SuggestionSession
    
    try:
        # Initialize CP-SAT scheduler
        scheduler = CPSATScheduler(db)
        
        # Convert date to datetime for solver
        preferred_datetime = None
        if preferred_date:
            preferred_datetime = datetime.combine(preferred_date, datetime.min.time())
        
        # Get optimized suggestions using constraint programming
        scheduling_result = scheduler.suggest_optimal_bookings(
            client_id=client_id,
            num_sessions=num_sessions,
            preferred_date=preferred_datetime,
            days_flexibility=days_flexibility
        )
        
        # Create session token and store suggestions
        session_token = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(hours=1)
        
        suggestion_session = SuggestionSession(
            client_id=client_id,
            session_token=session_token,
            preferred_date=str(preferred_date) if preferred_date else None,
            days_flexibility=days_flexibility,
            num_sessions=num_sessions,
            expires_at=expires_at
        )
        suggestion_session.set_suggestions(scheduling_result.suggested_slots)
        
        db.add(suggestion_session)
        db.commit()
        
        # Format response with session management
        message = ""
        
        # Always include constraint explanations when available (for week status messages)
        if scheduling_result.constraints_satisfied:
            constraint_msg = scheduling_result.constraints_satisfied[0]  # Main constraint message
            if scheduling_result.total_suggestions == 0:
                message = constraint_msg  # Error case - use constraint as main message
            else:
                message = constraint_msg  # Use constraint info as main message
        elif scheduling_result.total_suggestions == 0:
            message = "No available suggestions found"
        
        return SuggestionResponse(
            message=message,
            algorithm="CP-SAT (Constraint Programming Satisfiability)",
            suggestions=scheduling_result.suggested_slots,
            total_suggestions=scheduling_result.total_suggestions,
            client_id=client_id,
            solver_status=scheduling_result.solver_status,
            solve_time_ms=scheduling_result.solve_time_ms,
            confidence_score=scheduling_result.confidence_score,
            session_token=session_token,
            expires_at=expires_at.isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI scheduling failed: {str(e)}")

# ============================================================================
# ============================================================================
# TESTING AND ADMIN ENDPOINTS
# ============================================================================

@router.post("/admin/seed-weekly-schedule", dependencies=[Depends(require_admin)])
def seed_weekly_schedule(
    coach_id: int = Query(..., description="Coach ID to seed schedule for"),
    weeks_ahead: int = Query(4, ge=1, le=12, description="Number of weeks to seed ahead"),
    db: Session = Depends(get_db)
):
    """Admin endpoint to seed weekly schedule for a coach."""
    
    # Use the existing seed function (it doesn't take coach_id parameter)
    success = schedule_crud.seed_weekly_schedule(db)
    
    return {
        "message": f"Seeded weekly schedule using existing function",
        "success": success,
        "note": "Current seed function seeds all coaches, not individual coach"
    }

# ============================================================================
# AI BOOKING INTEGRATION - STEP 3 
# ============================================================================

@router.post("/bookings/book-selected")
def book_selected_suggestions(
    booking_request: SessionBasedBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    Book selected suggestions using session token for consistency.
    
    Uses session token to retrieve the original suggestions and book only the selected ones.
    Validates each suggestion is still available before booking.
    """
    
    from app.models.booking import Booking
    from app.models.schedule import ScheduleSlot
    from app.models.suggestion_session import SuggestionSession
    from datetime import datetime
    from sqlalchemy import and_
    import json
    
    # Debug: Log the incoming session token
    print(f"🔍 DEBUG: Looking for session token: {booking_request.session_token}")
    print(f"🔍 DEBUG: Current user ID: {getattr(current_user, 'id', 'N/A')}")
    
    # Debug: Check what sessions exist in the database
    all_sessions = db.query(SuggestionSession).filter(SuggestionSession.is_active == True).all()
    print(f"🔍 DEBUG: Found {len(all_sessions)} active sessions in database:")
    for s in all_sessions:
        print(f"  - Token: {s.session_token}, Client: {s.client_id}, Expires: {s.expires_at}")
    
    # Get the session using the token
    session = db.query(SuggestionSession).filter(
        SuggestionSession.session_token == booking_request.session_token,
        SuggestionSession.is_active == True
    ).first()
    
    if not session:
        print(f"❌ DEBUG: Session not found for token: {booking_request.session_token}")
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Check if session belongs to current user
    if getattr(current_user, 'role') == UserRole.CLIENT and session.client_id != getattr(current_user, 'id'):
        raise HTTPException(status_code=403, detail="Access denied: Session belongs to another user")
    
    # Check if session is expired
    current_time = datetime.utcnow()
    expires_at = getattr(session, 'expires_at')
    if current_time > expires_at:
        raise HTTPException(status_code=410, detail="Session has expired")
    
    # Parse the suggestions from the session
    try:
        suggestions_json = getattr(session, 'suggestions_json')
        suggestions = json.loads(str(suggestions_json))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid session data")
    
    # Validate that requested slot IDs exist in the session
    session_slot_ids = [sugg.get('slot_id') for sugg in suggestions]
    invalid_slots = [sid for sid in booking_request.selected_slot_ids if sid not in session_slot_ids]
    if invalid_slots:
        raise HTTPException(
            status_code=400, 
            detail=f"Slot IDs {invalid_slots} not found in session suggestions"
        )
    
    successful_bookings = []
    failed_bookings = []
    
    try:
        for slot_id in booking_request.selected_slot_ids:
            # Find the suggestion for this slot
            suggestion = next((s for s in suggestions if s.get('slot_id') == slot_id), None)
            if not suggestion:
                failed_bookings.append({
                    "slot_id": slot_id,
                    "reason": "Suggestion not found in session"
                })
                continue
                
            try:
                # Parse datetime from suggestion (CP-SAT format: date_suggestion + hour)
                date_str = suggestion.get('date_suggestion')
                hour = suggestion.get('hour')
                
                if not date_str or hour is None:
                    failed_bookings.append({
                        "slot_id": slot_id,
                        "reason": "Invalid suggestion format - missing date or hour"
                    })
                    continue
                    
                # Parse the date and add the hour
                booking_date = datetime.fromisoformat(date_str)
                booking_datetime = booking_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                
                # Validate slot still exists and is available
                slot = db.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id).first()
                if not slot:
                    failed_bookings.append({
                        "slot_id": slot_id,
                        "reason": "Slot no longer exists"
                    })
                    continue
                
                # Check for existing booking on this slot
                existing_booking = db.query(Booking).filter(
                    Booking.slot_id == slot_id,
                    Booking.date == booking_datetime,
                    Booking.status.in_(["pending", "confirmed"])
                ).first()
                
                if existing_booking:
                    failed_bookings.append({
                        "slot_id": slot_id,
                        "reason": "Slot already booked"
                    })
                    continue
                
                # Check for client double-booking on same day
                same_day_booking = db.query(Booking).filter(
                    and_(
                        Booking.client_id == session.client_id,
                        Booking.date >= booking_datetime.date(),
                        Booking.date < booking_datetime.date() + timedelta(days=1),
                        Booking.status.in_(["pending", "confirmed"])
                    )
                ).first()
                
                if same_day_booking:
                    failed_bookings.append({
                        "slot_id": slot_id,
                        "reason": "Client already has booking on this day"
                    })
                    continue
                
                # Create the booking
                new_booking = Booking(
                    client_id=session.client_id,
                    coach_id=suggestion['coach_id'],
                    slot_id=slot_id,
                    date=booking_datetime,
                    status="pending",
                    ai_generated=True  # Mark as AI-generated
                )
                
                db.add(new_booking)
                db.flush()  # Get the ID without committing
                
                successful_bookings.append({
                    "booking_id": new_booking.id,
                    "client_id": new_booking.client_id,
                    "coach_id": new_booking.coach_id,
                    "slot_id": new_booking.slot_id,
                    "datetime": booking_datetime.isoformat(),
                    "date": suggestion['date_suggestion'],
                    "hour": suggestion['hour'],
                    "coach_name": suggestion.get('coach_name', 'Unknown'),
                    "status": new_booking.status,
                    "ai_generated": new_booking.ai_generated
                })
                
            except Exception as e:
                failed_bookings.append({
                    "slot_id": slot_id,
                    "reason": f"Booking error: {str(e)}"
                })
        
        # Commit all successful bookings
        if successful_bookings:
            db.commit()
        else:
            db.rollback()
        
        return {
            "message": "Session-based booking completed",
            "successful_bookings": successful_bookings,
            "failed_bookings": failed_bookings,
            "total_requested": len(booking_request.selected_slot_ids),
            "total_successful": len(successful_bookings),
            "total_failed": len(failed_bookings),
            "session_token": booking_request.session_token
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Booking operation failed: {str(e)}")

@router.post("/suggestions/re-suggest")
def re_suggest_alternatives(
    re_suggestion_request: ReSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    Generate new suggestions to replace unwanted ones.
    
    Keeps the suggestions the user likes and generates new alternatives
    for the ones they want to replace.
    """
    
    # Validate client access (simplified for now)
    # Note: Add proper role validation later
    
    try:
        # Initialize CP-SAT scheduler
        scheduler = CPSATScheduler(db)
        
        # Convert kept suggestions to exclude them from new search
        excluded_slots = [sugg.slot_id for sugg in re_suggestion_request.keep_suggestions]
        excluded_dates = [sugg.date_suggestion for sugg in re_suggestion_request.keep_suggestions]
        
        # Convert preferred date
        preferred_datetime = None
        if re_suggestion_request.preferred_date:
            preferred_datetime = datetime.strptime(re_suggestion_request.preferred_date, "%Y-%m-%d")
        
        # Get new suggestions (note: excluded_slot_ids parameter needs to be added to scheduler)
        scheduling_result = scheduler.suggest_optimal_bookings(
            client_id=re_suggestion_request.client_id,
            num_sessions=re_suggestion_request.replace_count,
            preferred_date=preferred_datetime,
            days_flexibility=re_suggestion_request.days_flexibility
        )
        
        # Filter out any suggestions that conflict with kept ones
        new_suggestions = []
        for suggestion in scheduling_result.suggested_slots:
            # Avoid same dates as kept suggestions to prevent conflicts
            if suggestion["date_suggestion"] not in excluded_dates:
                new_suggestions.append(suggestion)
        
        # If we don't have enough unique suggestions, take what we can get
        new_suggestions = new_suggestions[:re_suggestion_request.replace_count]
        
        return {
            "message": "Re-suggestion completed",
            "kept_suggestions": [sugg.dict() for sugg in re_suggestion_request.keep_suggestions],
            "new_suggestions": new_suggestions,
            "total_suggestions": len(re_suggestion_request.keep_suggestions) + len(new_suggestions),
            "algorithm": "CP-SAT (Constraint Programming Satisfiability)",
            "solver_status": scheduling_result.solver_status,
            "solve_time_ms": scheduling_result.solve_time_ms,
            "search_parameters": {
                "replace_count": re_suggestion_request.replace_count,
                "preferred_date": re_suggestion_request.preferred_date,
                "days_flexibility": re_suggestion_request.days_flexibility,
                "excluded_slots": excluded_slots
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-suggestion failed: {str(e)}")

@router.get("/suggestions/re-suggest-session")
def re_suggest_session_based(
    session_token: str = Query(..., description="Session token"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    Simple session-based re-suggestion endpoint.
    
    Regenerates suggestions for the same parameters as the original session.
    """
    
    import json
    from app.models.suggestion_session import SuggestionSession
    
    try:
        # Find the session
        session = db.query(SuggestionSession).filter(
            SuggestionSession.session_token == session_token,
            SuggestionSession.is_active == True
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        # Validate access
        if getattr(session, 'client_id') != getattr(current_user, 'id'):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check expiry
        current_time = datetime.utcnow()
        if current_time > getattr(session, 'expires_at'):
            raise HTTPException(status_code=410, detail="Session has expired")
        
        # Re-run suggestions with original parameters
        scheduler = CPSATScheduler(db)
        
        # Convert preferred date from session
        preferred_datetime = None
        session_preferred_date = getattr(session, 'preferred_date')
        if session_preferred_date:
            preferred_datetime = datetime.strptime(session_preferred_date, "%Y-%m-%d")
        
        # Get ALL previously suggested slots to avoid cycling
        excluded_slot_ids = []
        
        # First, add current suggestions to history
        current_suggestions_json = getattr(session, 'suggestions_json', None)
        current_slot_ids = []
        if current_suggestions_json:
            try:
                current_suggestions = json.loads(current_suggestions_json)
                current_slot_ids = [sugg.get('slot_id') for sugg in current_suggestions if sugg.get('slot_id')]
                # Add current suggestions to historical tracking
                session.add_to_suggested_history(current_slot_ids)
            except (json.JSONDecodeError, AttributeError) as e:
                print(f"🔍 RE-SUGGESTION DEBUG - Could not parse current suggestions: {e}")
        
        # Get all historically suggested slots to exclude them ALL
        excluded_slot_ids = session.get_all_suggested_slots()
        print(f"🔍 RE-SUGGESTION DEBUG - Excluding {len(excluded_slot_ids)} total historical suggestions: {excluded_slot_ids}")
        
        # Generate new suggestions with ALL excluded slots
        scheduling_result = scheduler.suggest_optimal_bookings(
            client_id=getattr(session, 'client_id'),
            num_sessions=getattr(session, 'num_sessions'),
            preferred_date=preferred_datetime,
            days_flexibility=getattr(session, 'days_flexibility'),
            excluded_slot_ids=excluded_slot_ids
        )
        
        # Add the NEW suggestions to history for next time
        if scheduling_result.suggested_slots:
            new_slot_ids = [sugg.get('slot_id') for sugg in scheduling_result.suggested_slots if sugg.get('slot_id')]
            session.add_to_suggested_history(new_slot_ids)
            print(f"🔍 RE-SUGGESTION DEBUG - Added {len(new_slot_ids)} new suggestions to history: {new_slot_ids}")
        
        # Update session with new suggestions
        session.suggestions_json = json.dumps(scheduling_result.suggested_slots)
        db.commit()
        
        # Return new suggestions in the same format as original
        return SuggestionResponse(
            message="Session-based re-suggestion completed",
            algorithm="CP-SAT (Constraint Programming Satisfiability)",
            suggestions=scheduling_result.suggested_slots,
            total_suggestions=scheduling_result.total_suggestions,
            client_id=getattr(session, 'client_id'),
            solver_status=scheduling_result.solver_status,
            solve_time_ms=scheduling_result.solve_time_ms,
            confidence_score=scheduling_result.confidence_score,
            session_token=session_token,
            expires_at=getattr(session, 'expires_at').isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session re-suggestion failed: {str(e)}")


@router.post("/suggestions/re-suggest-individual")
def re_suggest_individual_slot(
    request: IndividualReSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """
    Re-suggest a single slot while keeping other suggestions the same.
    
    Args:
        request: Individual re-suggestion request containing session_token and slot_id
    """
    
    import json
    from app.models.suggestion_session import SuggestionSession
    
    # Extract parameters from request
    session_token = request.session_token
    slot_id = request.slot_id
    
    try:
        # Find the session
        session = db.query(SuggestionSession).filter(
            SuggestionSession.session_token == session_token,
            SuggestionSession.is_active == True
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        # Validate access
        if getattr(session, 'client_id') != getattr(current_user, 'id'):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check expiry
        current_time = datetime.utcnow()
        if current_time > getattr(session, 'expires_at'):
            raise HTTPException(status_code=410, detail="Session has expired")
        
        # Get current suggestions
        current_suggestions = json.loads(getattr(session, 'suggestions_json'))
        
        # Find the suggestion to replace
        target_suggestion = None
        for sugg in current_suggestions:
            if sugg.get('slot_id') == slot_id:
                target_suggestion = sugg
                break
        
        if not target_suggestion:
            raise HTTPException(status_code=404, detail=f"Slot ID {slot_id} not found in current suggestions")
        
        print(f"🔍 INDIVIDUAL RE-SUGGESTION DEBUG - Replacing slot {slot_id}")
        
        # Get excluded slots: all historical + current other suggestions + the slot we want to replace
        excluded_slot_ids = session.get_all_suggested_slots()
        # Ensure the slot we want to replace is in the exclusion list
        if slot_id not in excluded_slot_ids:
            excluded_slot_ids.append(slot_id)
        
        print(f"🔍 INDIVIDUAL RE-SUGGESTION DEBUG - Excluding {len(excluded_slot_ids)} slots: {excluded_slot_ids}")
        
        # Generate ONE new suggestion to replace this slot
        scheduler = CPSATScheduler(db)
        
        # Convert preferred date from session
        preferred_datetime = None
        session_preferred_date = getattr(session, 'preferred_date')
        if session_preferred_date:
            preferred_datetime = datetime.strptime(session_preferred_date, "%Y-%m-%d")
        
        # Generate new suggestion for just 1 slot
        scheduling_result = scheduler.suggest_optimal_bookings(
            client_id=getattr(session, 'client_id'),
            num_sessions=1,  # Just 1 replacement slot
            preferred_date=preferred_datetime,
            days_flexibility=getattr(session, 'days_flexibility'),
            excluded_slot_ids=excluded_slot_ids
        )
        
        if not scheduling_result.suggested_slots:
            raise HTTPException(status_code=404, detail="No alternative slots available")
        
        # Replace the old suggestion with the new one
        new_suggestion = scheduling_result.suggested_slots[0]
        new_slot_id = new_suggestion.get('slot_id')
        
        # Update the suggestions list
        updated_suggestions = []
        for sugg in current_suggestions:
            if sugg.get('slot_id') == slot_id:
                updated_suggestions.append(new_suggestion)  # Replace with new suggestion
            else:
                updated_suggestions.append(sugg)  # Keep existing suggestions
        
        # Add the new slot to history
        session.add_to_suggested_history([new_slot_id])
        print(f"🔍 INDIVIDUAL RE-SUGGESTION DEBUG - Replaced slot {slot_id} with slot {new_slot_id}")
        
        # Update session with new suggestions
        session.suggestions_json = json.dumps(updated_suggestions)
        db.commit()
        
        # Return the single new suggestion
        return {
            "message": f"Individual slot re-suggestion completed",
            "suggestion": new_suggestion,
            "replaced_slot_id": slot_id,
            "new_slot_id": new_slot_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Individual re-suggestion failed: {str(e)}")