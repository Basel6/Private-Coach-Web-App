from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Schema for user info in bookings
class BookingUserInfo(BaseModel):
    id: int
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    email: str

    class Config:
        from_attributes = True

# Schema for creating a booking
class BookingCreate(BaseModel):
    client_id: int
    coach_id: int
    date: datetime
    plan: Optional[str] = None

# Schema for showing booking info
class BookingShow(BaseModel):
    id: int
    client_id: int
    coach_id: int
    date: Optional[datetime]
    status: str
    plan: Optional[str] = None
    workout: Optional[str] = None
    coach_decision_requested: Optional[str] = None
    coach_notes: Optional[str] = None
    slot_id: Optional[int] = None
    ai_generated: Optional[bool] = None
    
    # Related user information
    client: Optional[BookingUserInfo] = None
    coach: Optional[BookingUserInfo] = None

    class Config:
        from_attributes = True
