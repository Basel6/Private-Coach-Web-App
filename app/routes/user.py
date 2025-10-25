# routes/user.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import app.schemas.user as schemas
from app.schemas.user import UserUpdate, ProfileUpdate, PasswordChange, UserProfile
from app.models.user import UserRole
import app.crud.user as crud
from app.models.user import User

import database as database
import app.auth.jwt_handler as jwt_handler

from app.auth.jwt_handler import decode_access_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()

# Dependency to get DB session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security),
                           db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    user = crud.get_user_by_email(db, payload["sub"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

# Role-based dependencies
async def require_coach_role(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the user to have coach role"""
    if getattr(current_user, 'role') != UserRole.COACH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Coach privileges required."
        )
    return current_user

async def require_client_role(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the user to have client role"""
    if getattr(current_user, 'role') != UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Client privileges required."
        )
    return current_user

async def require_accountant_role(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the user to have accountant role"""
    if getattr(current_user, 'role') != UserRole.ACCOUNTANT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Accountant privileges required."
        )
    return current_user

async def require_coach_or_accountant_role(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the user to have coach or accountant role"""
    if getattr(current_user, 'role') not in [UserRole.COACH, UserRole.ACCOUNTANT]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Coach or Accountant privileges required."
        )
    return current_user

def check_self_or_coach_access(current_user: User, target_user_id: int) -> bool:
    """Check if user can access another user's data (self or if coach accessing client)"""
    # User can always access their own data
    if getattr(current_user, 'id') == target_user_id:
        return True
    
    # If current user is a coach, check if target user is their client
    if getattr(current_user, 'role') == UserRole.COACH:
        # Check if target_user_id is in the coach's clients
        client_ids = [getattr(client, 'id') for client in getattr(current_user, 'clients', [])]
        return target_user_id in client_ids
    
    return False

# ==== AUTHENTICATION ENDPOINTS ====

@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = crud.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    return crud.create_user(db=db, user=user)

@router.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = crud.authenticate_user(db, user.email, user.password)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Username or Password")
    
    token = jwt_handler.create_access_token(data={"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}

# ==== BASIC USER ENDPOINTS ====

@router.get("/me", response_model=schemas.UserOut)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserOut)
async def update_current_user(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.update_user(db, current_user, updates)

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crud.delete_user(db, current_user)
    return

# ==== PROFILE MANAGEMENT ENDPOINTS ====

@router.get("/profile", response_model=UserProfile)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user's detailed profile with time preferences"""
    # Convert user to profile format with time preferences
    time_preferences = None
    if hasattr(current_user, 'time_preferences') and current_user.time_preferences:
        # Parse time preferences from JSON if stored as string, or use directly if dict
        prefs = current_user.time_preferences
        if isinstance(prefs, str):
            import json
            try:
                prefs = json.loads(prefs)
            except:
                prefs = {}
        
        time_preferences = schemas.TimePreferences(
            preferred_start_time=prefs.get('preferred_start_time'),
            preferred_end_time=prefs.get('preferred_end_time'),
            preferred_days=prefs.get('preferred_days', [])
        )
    
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        avatar=getattr(current_user, 'avatar', None),
        time_preferences=time_preferences,
        created_at=current_user.created_at
    )

@router.put("/profile", response_model=UserProfile)
async def update_current_user_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile including time preferences"""
    # Update basic user fields
    update_data = {}
    if profile_update.username is not None:
        # Check if username is already taken by another user
        existing_user = crud.get_user_by_username(db, profile_update.username)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        update_data['username'] = profile_update.username
    
    if profile_update.first_name is not None:
        update_data['first_name'] = profile_update.first_name
    if profile_update.last_name is not None:
        update_data['last_name'] = profile_update.last_name
    if profile_update.phone is not None:
        update_data['phone'] = profile_update.phone
    if profile_update.avatar is not None:
        update_data['avatar'] = profile_update.avatar
    
    # Handle time preferences
    if profile_update.time_preferences is not None:
        import json
        time_prefs_dict = {
            'preferred_start_time': profile_update.time_preferences.preferred_start_time,
            'preferred_end_time': profile_update.time_preferences.preferred_end_time,
            'preferred_days': profile_update.time_preferences.preferred_days or []
        }
        update_data['time_preferences'] = json.dumps(time_prefs_dict)
    
    # Update user in database
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    # Return updated profile
    return await get_current_user_profile(current_user)

@router.put("/change-password")
async def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change user's password"""
    # Verify current password
    if not crud.verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Hash new password and update
    hashed_new_password = crud.get_password_hash(password_change.new_password)
    current_user.hashed_password = hashed_new_password
    db.commit()
    
    return {"message": "Password changed successfully"}

# ==== COACH-ONLY ENDPOINTS ====

@router.get("/coaches", response_model=List[schemas.CoachLimited])
async def get_all_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all coaches - accessible by any authenticated user"""
    coaches = crud.get_all_coaches(db)
    return coaches

@router.get("/clients", response_model=List[schemas.ClientOut])
async def get_all_clients(
    search: Optional[str] = Query(None, description="Search clients by name, username, or email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coach_or_accountant_role)
):
    """Get all clients - coach and accountant endpoint"""
    if search:
        clients = crud.search_users_by_role(db, UserRole.CLIENT, search)
    else:
        clients = crud.get_all_clients(db)
    
    # Convert to response model with assigned coach info
    result = []
    for client in clients:
        # Create client dict with assigned coach
        assigned_coach = None
        if client.coaches and len(client.coaches) > 0:
            coach = client.coaches[0]
            assigned_coach = {
                "id": coach.id,
                "username": coach.username,
                "first_name": coach.first_name,
                "last_name": coach.last_name,
                "phone": coach.phone
            }
        
        client_dict = {
            "id": client.id,
            "username": client.username,
            "email": client.email,
            "first_name": client.first_name,
            "last_name": client.last_name,
            "phone": client.phone,
            "created_at": client.created_at,
            "assigned_coach": assigned_coach
        }
        result.append(client_dict)
    
    return result

@router.get("/my-clients", response_model=List[schemas.ClientOut])
async def get_my_clients(
    current_user: User = Depends(require_coach_role),
    db: Session = Depends(get_db)
):
    """Get all clients assigned to the current coach"""
    clients = crud.get_coach_clients(db, getattr(current_user, 'id'))
    return clients

@router.post("/assign-client/{client_id}")
async def assign_client_to_me(
    client_id: int,
    current_user: User = Depends(require_coach_role),
    db: Session = Depends(get_db)
):
    """Assign a client to the current coach"""
    success = crud.assign_client_to_coach(db, getattr(current_user, 'id'), client_id)
    if success:
        return {"message": "Client assigned successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to assign client")

@router.post("/select-coach/{coach_id}")
async def select_coach_for_me(
    coach_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow a client to select and assign themselves to a coach"""
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Only clients can select coaches")
    
    # Verify the coach exists and is actually a coach
    coach = crud.get_user_by_id(db, coach_id)
    if not coach or coach.role != UserRole.COACH:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    success = crud.assign_client_to_coach(db, coach_id, getattr(current_user, 'id'))
    if success:
        return {"message": f"Successfully selected {coach.first_name} {coach.last_name} as your coach"}
    else:
        raise HTTPException(status_code=400, detail="Failed to assign coach")

@router.delete("/remove-client/{client_id}")
async def remove_client_from_me(
    client_id: int,
    current_user: User = Depends(require_coach_role),
    db: Session = Depends(get_db)
):
    """Remove a client from the current coach"""
    success = crud.remove_client_from_coach(db, getattr(current_user, 'id'), client_id)
    if success:
        return {"message": "Client removed successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to remove client")

# ==== CLIENT ENDPOINTS ====

@router.get("/my-coaches", response_model=List[schemas.CoachLimited])
async def get_my_coaches(
    current_user: User = Depends(require_client_role),
    db: Session = Depends(get_db)
):
    """Get all coaches assigned to the current client"""
    coaches = crud.get_client_coaches(db, getattr(current_user, 'id'))
    return coaches

# ==== MIXED ACCESS ENDPOINTS ====

@router.get("/profile/{user_id}", response_model=schemas.UserOut)
async def get_user_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user profile - accessible by self or assigned coach"""
    if not check_self_or_coach_access(current_user, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only view your own profile or your clients' profiles."
        )
    
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.get("/client-profile/{client_id}", response_model=schemas.ClientProfile)
async def get_client_profile_with_membership(
    client_id: int,
    current_user: User = Depends(require_coach_role),
    db: Session = Depends(get_db)
):
    """Get client profile with membership information - coach only"""
    from app.models.payment import Payment, PaymentStatus
    from sqlalchemy import desc
    from datetime import datetime
    
    # Check if the client is assigned to this coach
    client = crud.get_user_by_id(db, client_id)
    if not client or str(client.role) != "UserRole.CLIENT":
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if this coach has access to this client
    coach_clients = crud.get_coach_clients(db, getattr(current_user, 'id'))
    client_ids = [c.id for c in coach_clients]
    
    if client_id not in client_ids:
        raise HTTPException(
            status_code=403,
            detail="Access denied. You can only view your assigned clients' profiles."
        )
    
    # Get the latest paid membership/payment for this client
    latest_payment = db.query(Payment).filter(
        Payment.client_id == client_id,
        Payment.status == PaymentStatus.PAID
    ).order_by(desc(Payment.paid_at)).first()
    
    # Prepare membership info
    membership_info = None
    if latest_payment:
        membership_info = {
            "member_since": latest_payment.paid_at,
            "active_until": latest_payment.active_until,
            "plan_name": latest_payment.plan_name,
            "status": "Active"  # Simplified for now - can enhance later
        }
    
    # Prepare client profile response
    client_profile = {
        "id": client.id,
        "username": client.username,
        "email": client.email,
        "first_name": client.first_name,
        "last_name": client.last_name,
        "phone": client.phone,
        "created_at": client.created_at,
        "membership": membership_info
    }
    
    return client_profile

# Public endpoint for member statistics (for landing page)
@router.get("/stats/members")
def get_member_statistics(db: Session = Depends(get_db)):
    """Get public member statistics for landing page."""
    
    # Count total members (clients)
    total_members = db.query(User).filter(User.role == UserRole.CLIENT).count()
    
    # Count active members (clients with paid subscriptions that are still active)
    from app.models.payment import Payment, PaymentStatus
    from datetime import datetime
    
    active_members = db.query(User).filter(
        User.role == UserRole.CLIENT,
        User.id.in_(
            db.query(Payment.client_id).filter(
                Payment.status == PaymentStatus.PAID,
                Payment.active_until > datetime.now()
            ).distinct()
        )
    ).count()
    
    return {
        "total_members": total_members,
        "active_members": active_members
    }
