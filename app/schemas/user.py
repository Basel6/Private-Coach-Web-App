# schemas/user.py

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    CLIENT = "CLIENT"
    COACH = "COACH"
    ACCOUNTANT = "ACCOUNTANT"

# Time preferences for clients
class TimePreferences(BaseModel):
    preferred_start_time: Optional[str] = None  # e.g., "09:00"
    preferred_end_time: Optional[str] = None    # e.g., "18:00"
    preferred_days: Optional[List[str]] = None  # e.g., ["monday", "wednesday", "friday"]

    class Config:
        from_attributes = True

# Request body for registration
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.CLIENT
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    plan: Optional[str] = None  # Plan assigned to client (e.g., "ABC", "AB")

# Response data sent back to client
class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Limited coach information (i dont want users to see coach emial for exmaple...)
class CoachLimited(BaseModel):
    id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    shift_start_hour: Optional[int] = None
    shift_end_hour: Optional[int] = None

    class Config:
        from_attributes = True
        
# For login request
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True

# Enhanced profile update with time preferences
class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    time_preferences: Optional[TimePreferences] = None

    class Config:
        from_attributes = True

# Password change schema
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Enhanced user profile response with time preferences
class UserProfile(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    time_preferences: Optional[TimePreferences] = None
    created_at: datetime

    class Config:
        from_attributes = True

# For coach-client relationships
class ClientOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    assigned_coach: Optional['CoachLimited'] = None

    class Config:
        from_attributes = True

class CoachOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Membership information for client profiles
class MembershipInfo(BaseModel):
    member_since: Optional[datetime] = None
    active_until: Optional[datetime] = None  
    plan_name: Optional[str] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True

# Enhanced client profile with membership info
class ClientProfile(ClientOut):
    membership: Optional[MembershipInfo] = None

class UserWithRelationships(UserOut):
    clients: List[ClientOut] = []
    coaches: List[CoachOut] = []        