# schemas/schedule.py
# Pydantic schemas for scheduling system

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

class PlanTypeEnum(str, Enum):
    AB = "AB"
    ABC = "ABC"
    PPL = "PPL"
    FIVE_DAY = "5DAY"

# ==================== SCHEDULE SLOT SCHEMAS ====================

class ScheduleSlotBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_hour: int = Field(..., ge=8, le=21, description="Hour in 24h format (8-21)")
    coach_id: int
    capacity: int = Field(default=10, ge=1, le=20)
    is_active: bool = True

class ScheduleSlotCreate(ScheduleSlotBase):
    pass

class ScheduleSlotOut(ScheduleSlotBase):
    id: int
    created_at: datetime
    
    # Calculated fields
    current_occupancy: Optional[int] = None
    available_spots: Optional[int] = None
    
    class Config:
        from_attributes = True

class ScheduleSlotUpdate(BaseModel):
    capacity: Optional[int] = Field(None, ge=1, le=20)
    is_active: Optional[bool] = None

# ==================== CLIENT PLAN SCHEMAS ====================

class ClientPlanBase(BaseModel):
    client_id: int
    plan_type: PlanTypeEnum
    assigned_coach_id: int

class ClientPlanCreate(ClientPlanBase):
    pass

class ClientPlanOut(ClientPlanBase):
    id: int
    sessions_per_week: int
    created_at: datetime
    updated_at: datetime
    
    # Add coach information (will be populated manually)
    coach_name: Optional[str] = None
    coach_username: Optional[str] = None
    
    class Config:
        from_attributes = True

class ClientPlanUpdate(BaseModel):
    plan_type: Optional[PlanTypeEnum] = None
    assigned_coach_id: Optional[int] = None

# ==================== CLIENT PREFERENCE SCHEMAS ====================

class ClientPreferenceBase(BaseModel):
    client_id: int
    preferred_start_hour: Optional[int] = Field(None, ge=8, le=21)
    preferred_end_hour: Optional[int] = Field(None, ge=8, le=22)
    is_flexible: bool = False
    
    @validator('preferred_end_hour')
    def validate_time_range(cls, v, values):
        if v is not None and 'preferred_start_hour' in values:
            start_hour = values['preferred_start_hour']
            if start_hour is not None and v < start_hour:
                raise ValueError('preferred_end_hour must be >= preferred_start_hour')
        return v

class ClientPreferenceCreate(ClientPreferenceBase):
    pass

class ClientPreferenceOut(ClientPreferenceBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ClientPreferenceUpdate(BaseModel):
    preferred_start_hour: Optional[int] = Field(None, ge=8, le=21)
    preferred_end_hour: Optional[int] = Field(None, ge=8, le=22)
    is_flexible: Optional[bool] = None
    
    @validator('preferred_end_hour')
    def validate_time_range(cls, v, values):
        if v is not None and 'preferred_start_hour' in values:
            start_hour = values['preferred_start_hour']
            if start_hour is not None and v < start_hour:
                raise ValueError('preferred_end_hour must be >= preferred_start_hour')
        return v

# ==================== SCHEDULE ANALYTICS SCHEMAS ====================

class SlotOccupancyOut(BaseModel):
    slot_id: int
    day_of_week: int
    start_hour: int
    coach_id: int
    capacity: int
    current_occupancy: int
    available_spots: int
    utilization_rate: float
    
    class Config:
        from_attributes = True

class WeekScheduleSummary(BaseModel):
    week_start: str  # ISO format
    total_slots: int
    total_bookings: int
    total_capacity: int
    utilization_rate: float
    available_spots: int
    
    # Breakdown by day
    daily_breakdown: Optional[List[dict]] = None
    
    # Most/least popular slots
    busiest_slots: Optional[List[SlotOccupancyOut]] = None
    available_slots: Optional[List[SlotOccupancyOut]] = None

# ==================== ADMIN SCHEMAS ====================

class BulkSlotCreate(BaseModel):
    coach_id: int
    days_of_week: List[int] = Field(..., description="List of days (0=Monday, 6=Sunday)")
    start_hours: List[int] = Field(..., description="List of hours (8-21)")
    capacity: int = Field(default=10, ge=1, le=20)
    
    @validator('days_of_week')
    def validate_days(cls, v):
        if not all(0 <= day <= 6 for day in v):
            raise ValueError('All days must be between 0 (Monday) and 6 (Sunday)')
        return v
    
    @validator('start_hours')
    def validate_hours(cls, v):
        if not all(8 <= hour <= 21 for hour in v):
            raise ValueError('All hours must be between 8 and 21')
        return v

class BulkSlotCreateResponse(BaseModel):
    created_slots: int
    skipped_existing: int
    total_requested: int
    created_slot_ids: List[int]

# ==================== SEED DATA SCHEMAS ====================

class SeedScheduleRequest(BaseModel):
    force_recreate: bool = Field(default=False, description="Delete existing slots and recreate")
    
class SeedScheduleResponse(BaseModel):
    success: bool
    message: str
    slots_created: int
    coaches_processed: int

# ==================== PLAN REQUEST SCHEMAS ====================

class PlanRequestBase(BaseModel):
    client_id: int
    coach_id: int
    message: Optional[str] = Field(None, max_length=500, description="Optional message from client")

class PlanRequestCreate(PlanRequestBase):
    pass

class PlanRequestOut(PlanRequestBase):
    id: int
    status: str = Field(..., description="PENDING, APPROVED, or REJECTED")
    response_message: Optional[str] = Field(None, description="Coach's response")
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class PlanRequestUpdate(BaseModel):
    status: str = Field(..., description="APPROVED or REJECTED")
    response_message: Optional[str] = Field(None, max_length=500, description="Coach's response")
    plan_type: Optional[str] = Field(None, description="Plan type if approved: AB, ABC, PPL, or FIVE_DAY")