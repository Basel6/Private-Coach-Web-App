# models/schedule.py
# Database models for CP-SAT scheduling system

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, func, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
import enum

class PlanType(enum.Enum):
    AB = "AB"         # 2 sessions/week
    ABC = "ABC"       # 3 sessions/week  
    PPL = "PPL"       # 3 sessions/week (Push/Pull/Legs)
    FIVE_DAY = "5DAY" # 5 sessions/week

class PlanRequestStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class ScheduleSlot(Base):
    """Pre-seeded weekly recurring time slots for group sessions"""
    __tablename__ = "schedule_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_hour = Column(Integer, nullable=False)   # 10-21 (10:00-21:00)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    capacity = Column(Integer, nullable=False, default=10)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    coach = relationship("User", foreign_keys=[coach_id])
    bookings = relationship("Booking", back_populates="slot")
    
    # Ensure unique slots per day/hour/coach
    __table_args__ = (
        UniqueConstraint('day_of_week', 'start_hour', 'coach_id', name='unique_slot'),
    )
    
    def __repr__(self):
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return f"<ScheduleSlot {days[self.day_of_week]} {self.start_hour}:00 (Coach {self.coach_id})>"

class ClientPlan(Base):
    """Client workout plans with sessions per week and assigned coach"""
    __tablename__ = "client_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_type = Column(SQLEnum(PlanType), nullable=False)
    sessions_per_week = Column(Integer, nullable=False)
    assigned_coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    client = relationship("User", foreign_keys=[client_id])
    assigned_coach = relationship("User", foreign_keys=[assigned_coach_id])
    
    # One plan per client
    __table_args__ = (
        UniqueConstraint('client_id', name='unique_client_plan'),
    )
    
    @property
    def sessions_count_by_plan(self):
        """Map plan types to sessions per week"""
        plan_sessions = {
            PlanType.AB: 2,
            PlanType.ABC: 3,
            PlanType.PPL: 3,
            PlanType.FIVE_DAY: 5
        }
        return plan_sessions.get(self.plan_type, 2)
    
    def __repr__(self):
        return f"<ClientPlan Client:{self.client_id} {self.plan_type.value} {self.sessions_per_week}x/week>"

class ClientPreference(Base):
    """Client scheduling preferences for time windows"""
    __tablename__ = "client_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    preferred_start_hour = Column(Integer, nullable=True)  # NULL if flexible
    preferred_end_hour = Column(Integer, nullable=True)    # NULL if flexible  
    is_flexible = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    client = relationship("User", foreign_keys=[client_id])
    
    # One preference per client
    __table_args__ = (
        UniqueConstraint('client_id', name='unique_client_prefs'),
    )
    
    def is_within_preference(self, hour: int) -> bool:
        """Check if given hour is within client's preferred time window"""
        if self.is_flexible:
            return True
        if self.preferred_start_hour is None or self.preferred_end_hour is None:
            return True
        return self.preferred_start_hour <= hour <= self.preferred_end_hour
    
    def get_preference_score(self, hour: int) -> int:
        """Get preference score for given hour (2=perfect, 1=adjacent, 0=outside)"""
        if self.is_flexible:
            return 1  # Baseline for flexible
        
        if self.preferred_start_hour is None or self.preferred_end_hour is None:
            return 1  # Baseline for no preferences
        
        if self.preferred_start_hour <= hour <= self.preferred_end_hour:
            return 2  # Perfect match
        
        # Adjacent hour bonus
        if (hour == self.preferred_start_hour - 1 or 
            hour == self.preferred_end_hour + 1):
            return 1  # Close match
        
        return 0  # Outside preference
    
    def __repr__(self):
        if self.is_flexible:
            return f"<ClientPreference Client:{self.client_id} Flexible>"
        return f"<ClientPreference Client:{self.client_id} {self.preferred_start_hour}-{self.preferred_end_hour}>"


class PlanRequest(Base):
    """Client requests for workout plan assignment from coach"""
    __tablename__ = "plan_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String(500), nullable=True)  # Optional message from client
    status = Column(SQLEnum(PlanRequestStatus), default=PlanRequestStatus.PENDING, nullable=False)
    response_message = Column(String(500), nullable=True)  # Coach's response
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    client = relationship("User", foreign_keys=[client_id])
    coach = relationship("User", foreign_keys=[coach_id])
    
    def __repr__(self):
        return f"<PlanRequest Client:{self.client_id} → Coach:{self.coach_id} [{self.status}]>"