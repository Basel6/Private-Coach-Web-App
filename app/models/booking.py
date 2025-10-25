from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base

# Booking model for storing client bookings
class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"))
    coach_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime)
    status = Column(String(20), default="pending")
    plan = Column(String(50), nullable=True)  # Plan type (ABC, AB, etc.)
    workout = Column(String(100), nullable=True)  # Selected workout day (A: Chest + Triceps)
    coach_decision_requested = Column(String(10), default="no")  # yes, no, decided
    coach_notes = Column(Text, nullable=True)  # Coach notes for the workout
    
    # AI Scheduling integration
    slot_id = Column(Integer, ForeignKey("schedule_slots.id"), nullable=True)
    ai_generated = Column(Boolean, default=False)  # True if booked via AI suggestions

    client = relationship("User", foreign_keys=[client_id])
    coach = relationship("User", foreign_keys=[coach_id])
    slot = relationship("ScheduleSlot", back_populates="bookings")
