# models/payment.py

from sqlalchemy import Column, Integer, String, Numeric, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class PaymentStatus(enum.Enum):
    INITIATED = "INITIATED"
    REQUIRES_PAYMENT = "REQUIRES_PAYMENT"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELED = "CANCELED"
    EXPIRED = "EXPIRED"

class Payment(Base):
    __tablename__ = "payments"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Client information (snapshot)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    client_email = Column(String(255), nullable=False)
    client_phone = Column(String(50), nullable=True)
    
    # Plan information (server-side pricing)
    plan_id = Column(String(20), nullable=False, default="CUSTOM")
    plan_name = Column(String(50), nullable=False, default="Custom")
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), nullable=False)
    duration_months = Column(Integer, nullable=False)
    
    # Payment status and dates
    status = Column(Enum(PaymentStatus), default=PaymentStatus.INITIATED, nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    active_until = Column(DateTime(timezone=True), nullable=True)
    
    # Payment provider linkage
    provider = Column(String(20), default="PAYPAL")
    
    # PayPal fields
    paypal_order_id = Column(String(100), unique=True, nullable=True)
    paypal_capture_id = Column(String(100), unique=True, nullable=True)
    receipt_url = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship
    client = relationship("User", back_populates="payments")

# Add indexes
Index('idx_payments_client_id', Payment.client_id)
Index('idx_payments_status', Payment.status)
Index('idx_payments_paid_at', Payment.paid_at)
Index('idx_payments_active_until', Payment.active_until)
Index('idx_payments_plan_id', Payment.plan_id)