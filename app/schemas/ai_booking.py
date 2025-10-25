# schemas/booking.py - AI Booking Schemas with Session Support

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class BookingSuggestion(BaseModel):
    """Single booking suggestion for selective booking"""
    slot_id: int
    coach_id: int
    date_suggestion: str
    hour: int
    confidence_score: float

class SuggestionResponse(BaseModel):
    """Enhanced suggestion response with session token"""
    message: str
    algorithm: str
    suggestions: List[dict]
    total_suggestions: int
    client_id: int
    solver_status: str
    solve_time_ms: int
    confidence_score: float
    
    # Session management
    session_token: str = Field(..., description="Unique session token for re-suggestions and booking")
    expires_at: str = Field(..., description="Session expiration time")
    
class SessionBasedBookingRequest(BaseModel):
    """Request to book using session token"""
    session_token: str = Field(..., description="Session token from previous suggestions")
    selected_slot_ids: List[int] = Field(..., description="Slot IDs to book from the session")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_token": "abc123-def456-ghi789",
                "selected_slot_ids": [5, 42]
            }
        }
    
class SelectiveBookingRequest(BaseModel):
    """Request to book only selected suggestions"""
    client_id: int
    selected_suggestions: List[BookingSuggestion] = Field(..., description="List of selected suggestions to book")
    
    class Config:
        json_schema_extra = {
            "example": {
                "client_id": 18,
                "selected_suggestions": [
                    {
                        "slot_id": 5,
                        "coach_id": 1,
                        "date_suggestion": "2025-10-20", 
                        "hour": 14,
                        "confidence_score": 1.0
                    }
                ]
            }
        }

class SimpleBookingRequest(BaseModel):
    """Simplified request to book by slot IDs only"""
    slot_ids: List[int] = Field(..., description="List of slot IDs to book")
    
    class Config:
        json_schema_extra = {
            "example": {
                "slot_ids": [5, 42]
            }
        }

class SelectiveBookingRequestDetailed(BaseModel):
    """Detailed request to book selected suggestions with validation"""
    client_id: int
    selected_suggestions: List[BookingSuggestion] = Field(..., description="List of selected suggestions to book")
    
    class Config:
        json_schema_extra = {
            "example": {
                "client_id": 18,
                "selected_suggestions": [
                    {
                        "slot_id": 5,
                        "coach_id": 1,
                        "date_suggestion": "2025-10-20", 
                        "hour": 14,
                        "confidence_score": 1.0
                    }
                ]
            }
        }

class ReSuggestionRequest(BaseModel):
    """Request to replace specific suggestions with new ones"""
    client_id: int
    keep_suggestions: List[BookingSuggestion] = Field(..., description="Suggestions to keep")
    exclude_suggestions: List[BookingSuggestion] = Field(default=[], description="Suggestions to exclude/replace")
    replace_count: int = Field(..., ge=1, le=5, description="Number of new suggestions to generate")
    preferred_date: Optional[str] = Field(None, description="Preferred date for new suggestions")
    days_flexibility: int = Field(3, ge=1, le=14, description="Days flexibility for new suggestions")
    
    class Config:
        json_schema_extra = {
            "example": {
                "client_id": 18,
                "keep_suggestions": [
                    {
                        "slot_id": 5,
                        "coach_id": 1,
                        "date_suggestion": "2025-10-20",
                        "hour": 14,
                        "confidence_score": 1.0
                    }
                ],
                "exclude_suggestions": [
                    {
                        "slot_id": 42,
                        "coach_id": 1,
                        "date_suggestion": "2025-10-19",
                        "hour": 15,
                        "confidence_score": 1.0
                    }
                ],
                "replace_count": 2,
                "preferred_date": "2025-10-21",
                "days_flexibility": 3
            }
        }

class BookingResult(BaseModel):
    """Result of booking operation"""
    booking_id: int
    client_id: int
    coach_id: int
    slot_id: int
    date: datetime
    status: str
    ai_generated: bool
    
class SelectiveBookingResponse(BaseModel):
    """Response for selective booking"""
    message: str
    successful_bookings: List[BookingResult]
    failed_bookings: List[dict]
    total_requested: int
    total_successful: int
    total_failed: int
    
class IndividualReSuggestionRequest(BaseModel):
    """Request to re-suggest a single slot"""
    session_token: str = Field(..., description="Session token from original suggestion")
    slot_id: int = Field(..., description="The specific slot ID to replace")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_token": "a61e962a-4c7b-4f51-b758-dd2c7285a0a2",
                "slot_id": 42
            }
        }

class ReSuggestionResponse(BaseModel):
    """Response for re-suggestion request"""
    message: str
    kept_suggestions: List[BookingSuggestion]
    new_suggestions: List[dict]  # Same format as original suggestions
    total_suggestions: int
    algorithm: str = "CP-SAT (Constraint Programming Satisfiability)"