# models/user.py

from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(enum.Enum):
    CLIENT = "CLIENT"
    COACH = "COACH"
    ACCOUNTANT = "ACCOUNTANT"

# Association table for coach-client relationships
coach_client_association = Table(
    'coach_clients',
    Base.metadata,
    Column('coach_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('client_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CLIENT)
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    phone = Column(String(20), nullable=True)
    plan = Column(String(50), nullable=True)  # Plan assigned to client (e.g., "ABC", "AB")
    avatar = Column(String(255), nullable=True)  # Profile picture URL or path
    time_preferences = Column(String(500), nullable=True)  # JSON string for time preferences
    
    # Coach shift hours for scheduling (NULL for non-coaches)
    shift_start_hour = Column(Integer, nullable=True)  # 10-21, e.g., 10 for 10:00 AM
    shift_end_hour = Column(Integer, nullable=True)    # 10-21, e.g., 15 for 3:00 PM
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships for coach-client
    # As a coach, this user can have many clients
    clients = relationship(
        "User",
        secondary=coach_client_association,
        primaryjoin=id == coach_client_association.c.coach_id,
        secondaryjoin=id == coach_client_association.c.client_id,
        back_populates="coaches"
    )
    
    # As a client, this user can have many coaches
    coaches = relationship(
        "User",
        secondary=coach_client_association,
        primaryjoin=id == coach_client_association.c.client_id,
        secondaryjoin=id == coach_client_association.c.coach_id,
        back_populates="clients"
    )
    
    # Payments relationship (for clients)
    payments = relationship("Payment", back_populates="client")
