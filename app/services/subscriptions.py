# services/subscriptions.py

from decimal import Decimal
from typing import TypedDict
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.payment import Payment, PaymentStatus

class Plan(TypedDict):
    id: str
    name: str
    months: int
    amount: Decimal

PLANS: dict[str, Plan] = {
    "MONTHLY":   {"id": "MONTHLY",   "name": "Monthly",   "months": 1,  "amount": Decimal("700.00")},
    "QUARTERLY": {"id": "QUARTERLY", "name": "3 Months",  "months": 3,  "amount": Decimal("1500.00")},
    "YEARLY":    {"id": "YEARLY",    "name": "1 Year",    "months": 12, "amount": Decimal("4000.00")},
}

def get_plan(plan_id: str) -> Plan:
    """Get plan by ID, raises ValueError if not found"""
    p = PLANS.get(plan_id)
    if not p:
        raise ValueError(f"Unknown plan_id: {plan_id}")
    return p

def has_active_subscription(client_id: int, db: Session) -> bool:
    """Check if client has an active paid subscription"""
    now = datetime.now(timezone.utc)
    return db.query(Payment).filter(
        Payment.client_id == client_id,
        Payment.status == PaymentStatus.PAID,
        Payment.active_until >= now
    ).first() is not None

def infer_plan_from_legacy_payment(amount: Decimal, duration_months: int) -> tuple[str, str]:
    """Infer plan_id and plan_name from legacy payment data"""
    # Match against known plans
    for plan_id, plan in PLANS.items():
        if plan["months"] == duration_months and plan["amount"] == amount:
            return plan_id, plan["name"]
    
    # Default to custom if no match
    return "CUSTOM", "Custom"