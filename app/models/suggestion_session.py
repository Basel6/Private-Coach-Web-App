# models/suggestion_session.py
# Temporary storage for AI suggestions

from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text, Boolean, String
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy.sql import func
import json

class SuggestionSession(Base):
    """Stores AI suggestions temporarily for re-suggestion and booking"""
    __tablename__ = "suggestion_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_token = Column(String(255), nullable=False, unique=True)  # UUID for frontend
    
    # Original request parameters
    preferred_date = Column(String(50), nullable=True)
    days_flexibility = Column(Integer, nullable=False)
    num_sessions = Column(Integer, nullable=False)
    
    # Suggestions as JSON
    suggestions_json = Column(Text, nullable=False)  # JSON array of suggestions
    
    # Track all previously suggested slots to avoid cycling
    all_suggested_slots_json = Column(Text, nullable=True)  # JSON array of all slot IDs ever suggested
    
    # Status tracking
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)  # 1 hour expiry
    
    # Relationships
    client = relationship("User", foreign_keys=[client_id])
    
    def get_suggestions(self):
        """Parse suggestions from JSON"""
        return json.loads(str(self.suggestions_json))
    
    def set_suggestions(self, suggestions):
        """Store suggestions as JSON"""
        self.suggestions_json = json.dumps(suggestions)
    
    def add_to_suggested_history(self, new_slot_ids):
        """Add slot IDs to the history of all suggested slots"""
        try:
            existing_slots = json.loads(str(self.all_suggested_slots_json)) if self.all_suggested_slots_json else []
        except (json.JSONDecodeError, TypeError):
            existing_slots = []
        
        # Add new slot IDs to the list, avoiding duplicates
        for slot_id in new_slot_ids:
            if slot_id not in existing_slots:
                existing_slots.append(slot_id)
        
        self.all_suggested_slots_json = json.dumps(existing_slots)
    
    def get_all_suggested_slots(self):
        """Get all slot IDs that have been suggested in this session"""
        try:
            return json.loads(str(self.all_suggested_slots_json)) if self.all_suggested_slots_json else []
        except (json.JSONDecodeError, TypeError):
            return []
        
    def __repr__(self):
        return f"<SuggestionSession {self.session_token} for client {self.client_id}>"