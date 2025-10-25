from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from database import Base

# we need this to prevent processing the same webhook event multiple times (for example paying twice instead of once because of retries)

class ProcessedEvent(Base):
    __tablename__ = "processed_events"
    
    event_id = Column(String(255), primary_key=True, index=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())