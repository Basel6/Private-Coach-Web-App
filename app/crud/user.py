# crud/user.py
from app.schemas.user import UserCreate, UserUpdate
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from passlib.context import CryptContext
from typing import List, Optional
from fastapi import HTTPException


# Setup bcrypt hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Utility to hash password
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Utility to check if user already exists
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

# Create and save a new user by using the db session which is from SQLAlchemy which let us add and commit and refresh the user object
def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        plan=user.plan
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Function to verify password
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# Function to authenticate user by checking email and password
def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def update_user(db: Session, db_user: User, user_update: UserUpdate) -> User:
    data = user_update.dict(exclude_unset=True)

    # if they passed password, hash it
    if "password" in data:
        data["hashed_password"] = get_password_hash(data.pop("password"))

    # apply other fields (username, email, first_name, last_name, phone)
    for field, value in data.items():
        setattr(db_user, field, value)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, db_user: User) -> None:
    db.delete(db_user)
    db.commit()

# ==== COACH-CLIENT RELATIONSHIP FUNCTIONS ====

def get_all_coaches(db: Session) -> List[User]:
    """Get all users with coach role"""
    return db.query(User).filter(User.role == UserRole.COACH).all()

def get_all_clients(db: Session) -> List[User]:
    """Get all users with client role"""
    # Load clients first, then access coaches relationship as needed
    # This avoids potential circular loading issues with Payment model
    return db.query(User).filter(User.role == UserRole.CLIENT).all()

def get_coach_clients(db: Session, coach_id: int) -> List[User]:
    """Get all clients for a specific coach"""
    coach = db.query(User).filter(User.id == coach_id, User.role == UserRole.COACH).first()
    if not coach:
        return []
    return coach.clients

def get_client_coaches(db: Session, client_id: int) -> List[User]:
    """Get all coaches for a specific client"""
    client = db.query(User).filter(User.id == client_id, User.role == UserRole.CLIENT).first()
    if not client:
        return []
    return client.coaches

def assign_client_to_coach(db: Session, coach_id: int, client_id: int) -> bool:
    """Assign a client to a coach (one client can only have one coach)"""
    coach = db.query(User).filter(User.id == coach_id, User.role == UserRole.COACH).first()
    client = db.query(User).filter(User.id == client_id, User.role == UserRole.CLIENT).first()
    
    if not coach or not client:
        raise HTTPException(status_code=404, detail="Coach or client not found")
    
    # Check if client already has a coach
    if client.coaches:
        current_coach = client.coaches[0]
        if current_coach.id == coach_id:
            raise HTTPException(status_code=400, detail="Client is already assigned to this coach")
        else:
            raise HTTPException(status_code=400, detail=f"Client is already assigned to coach: {current_coach.first_name} {current_coach.last_name}")
    
    coach.clients.append(client)
    db.commit()
    return True

def remove_client_from_coach(db: Session, coach_id: int, client_id: int) -> bool:
    """Remove a client from a coach"""
    coach = db.query(User).filter(User.id == coach_id, User.role == UserRole.COACH).first()
    client = db.query(User).filter(User.id == client_id, User.role == UserRole.CLIENT).first()
    
    if not coach or not client:
        raise HTTPException(status_code=404, detail="Coach or client not found")
    
    if client not in coach.clients:
        raise HTTPException(status_code=400, detail="Client is not assigned to this coach")
    
    coach.clients.remove(client)
    db.commit()
    return True

def is_coach_client_relationship(db: Session, coach_id: int, client_id: int) -> bool:
    """Check if a client belongs to a specific coach or still new"""
    coach = db.query(User).filter(User.id == coach_id, User.role == UserRole.COACH).first()
    if not coach:
        return False
    
    client = db.query(User).filter(User.id == client_id, User.role == UserRole.CLIENT).first()
    if not client:
        return False
    
    return client in coach.clients

def search_users_by_role(db: Session, role: UserRole, search_term: Optional[str] = None) -> List[User]:
    """Search users by role and optional search term"""
    query = db.query(User).filter(User.role == role)
    
    if search_term:
        search_filter = f"%{search_term}%"
        query = query.filter(
            (User.username.like(search_filter)) |
            (User.email.like(search_filter)) |
            (User.first_name.like(search_filter)) |
            (User.last_name.like(search_filter))
        )
    
    return query.all()