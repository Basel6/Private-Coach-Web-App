# crud/payment.py

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal

def create_payment(
    db: Session,
    client_id: int,
    client_email: str,
    client_phone: Optional[str],
    plan_id: str,
    plan_name: str,
    amount: Decimal,
    currency: str,
    duration_months: int
) -> Payment:
    """Create a new payment record with plan information"""
    payment = Payment(
        client_id=client_id,
        client_email=client_email,
        client_phone=client_phone,
        plan_id=plan_id,
        plan_name=plan_name,
        amount=amount,
        currency=currency,
        duration_months=duration_months,
        status=PaymentStatus.INITIATED
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

def get_payment_by_id(db: Session, payment_id: int) -> Optional[Payment]:
    """Get payment by ID"""
    return db.query(Payment).filter(Payment.id == payment_id).first()

def update_payment_status(
    db: Session,
    payment: Payment,
    status: PaymentStatus,
    paid_at: Optional[datetime] = None,
    active_until: Optional[datetime] = None,
    receipt_url: Optional[str] = None
) -> Payment:
    """Update payment status and related fields"""
    setattr(payment, 'status', status)
    
    if paid_at is not None:
        setattr(payment, 'paid_at', paid_at)
    if active_until is not None:
        setattr(payment, 'active_until', active_until)
    if receipt_url is not None:
        setattr(payment, 'receipt_url', receipt_url)
    
    db.commit()
    db.refresh(payment)
    return payment

def get_client_payments(
    db: Session,
    client_id: int,
    status: Optional[str] = None,
    active: Optional[bool] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Payment]:
    """Get payments for a specific client with filters"""
    query = db.query(Payment).filter(Payment.client_id == client_id)
    
    if status:
        try:
            status_enum = PaymentStatus(status)
            query = query.filter(Payment.status == status_enum)
        except ValueError:
            pass  # Invalid status, ignore filter
    
    if active is not None:
        now = datetime.now(timezone.utc)
        if active:
            query = query.filter(
                and_(
                    Payment.status == PaymentStatus.PAID,
                    Payment.active_until >= now
                )
            )
        else:
            query = query.filter(
                or_(
                    Payment.status != PaymentStatus.PAID,
                    Payment.active_until < now
                )
            )
    
    if from_date:
        query = query.filter(Payment.paid_at >= from_date)
    if to_date:
        query = query.filter(Payment.paid_at <= to_date)
    
    return query.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()

def get_all_payments(
    db: Session,
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    active: Optional[bool] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Payment]:
    """Get all payments with filters (for accountants)"""
    query = db.query(Payment)
    
    if client_id:
        query = query.filter(Payment.client_id == client_id)
    
    if status:
        try:
            status_enum = PaymentStatus(status)
            query = query.filter(Payment.status == status_enum)
        except ValueError:
            pass  # Invalid status, ignore filter
    
    if active is not None:
        now = datetime.now(timezone.utc)
        if active:
            query = query.filter(
                and_(
                    Payment.status == PaymentStatus.PAID,
                    Payment.active_until >= now
                )
            )
        else:
            query = query.filter(
                or_(
                    Payment.status != PaymentStatus.PAID,
                    Payment.active_until < now
                )
            )
    
    if from_date:
        query = query.filter(Payment.paid_at >= from_date)
    if to_date:
        query = query.filter(Payment.paid_at <= to_date)
    
    if min_amount:
        query = query.filter(Payment.amount >= min_amount)
    if max_amount:
        query = query.filter(Payment.amount <= max_amount)
    
    return query.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()

def reconcile_expired_payments(db: Session) -> int:
    """Mark expired payments as EXPIRED"""
    now = datetime.now(timezone.utc)
    expired_count = db.query(Payment).filter(
        and_(
            Payment.status == PaymentStatus.PAID,
            Payment.active_until < now
        )
    ).update({Payment.status: PaymentStatus.EXPIRED})
    
    db.commit()
    return expired_count

def get_payments_for_export(db: Session) -> List[Payment]:
    """Get all payments for CSV export"""
    return db.query(Payment).order_by(Payment.created_at.desc()).all()