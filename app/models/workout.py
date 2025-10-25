from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

# Global workout templates (individual exercises)
class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))  # "Bench Press", "Bicep Curls"
    description = Column(Text)  # How to perform the exercise
    muscle_group = Column(String(50))  # "Chest", "Biceps", etc.
    sets = Column(Integer, default=3)
    reps = Column(String(20), default="8-12")  # "8-12" or "10" or "8,10,12"
    picture_url = Column(String(500))  # URL to exercise picture
    video_url = Column(String(500))   # URL to exercise video

# Workout plans (ABC, AB, etc.) - simplified structure
class WorkoutPlan(Base):
    __tablename__ = "workout_plans"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50))  # "ABC Plan", "AB Plan"
    description = Column(Text)  # Description of the plan
    created_by_coach_id = Column(Integer, ForeignKey("users.id"))
    
    # Day muscle groups (5 days max)
    day_a = Column(String(100))  # "Chest + Triceps"
    day_b = Column(String(100))  # "Back + Biceps" 
    day_c = Column(String(100))  # "Legs + Shoulders"
    day_d = Column(String(100))  # "Arms + Abs"
    day_e = Column(String(100))  # "Full Body"
    
    creator = relationship("User", foreign_keys=[created_by_coach_id])
