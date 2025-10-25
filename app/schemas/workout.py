from pydantic import BaseModel
from typing import List, Optional

# Workout Template Schemas
class WorkoutTemplateCreate(BaseModel):
    name: str
    description: str
    muscle_group: str
    sets: int = 3
    reps: str = "8-12"
    picture_url: Optional[str] = None
    video_url: Optional[str] = None

class WorkoutTemplateShow(BaseModel):
    id: int
    name: str
    description: str
    muscle_group: str
    sets: int
    reps: str
    picture_url: Optional[str]
    video_url: Optional[str]

    class Config:
        from_attributes = True

# Workout Plan Schemas (Simplified)
class WorkoutPlanCreate(BaseModel):
    name: str
    description: str
    day_a: Optional[str] = None  # "Chest + Triceps"
    day_b: Optional[str] = None  # "Back + Biceps"
    day_c: Optional[str] = None  # "Legs + Shoulders"
    day_d: Optional[str] = None  # "Arms + Abs"
    day_e: Optional[str] = None  # "Full Body"

class WorkoutPlanShow(BaseModel):
    id: int
    name: str
    description: str
    created_by_coach_id: int
    day_a: Optional[str]
    day_b: Optional[str]
    day_c: Optional[str]
    day_d: Optional[str]
    day_e: Optional[str]

    class Config:
        from_attributes = True

# Plan Assignment (Simplified)
class AssignPlanToClient(BaseModel):
    client_id: int
    plan_name: str  # "ABC", "AB", etc.

# Booking Workout Selection (Simplified)
class BookingWorkoutSelect(BaseModel):
    booking_id: int
    workout_day: Optional[str] = None  # "A: Chest + Triceps" or None for coach decision

class CoachDecideWorkout(BaseModel):
    workout_day: str  # "A: Chest + Triceps"
    notes: Optional[str] = ""
