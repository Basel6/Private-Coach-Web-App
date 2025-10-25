# schemas/payment.py

from pydantic import BaseModel, Field
from typing import Optional, Literal, Annotated
from datetime import datetime
from decimal import Decimal

class CreateCheckout(BaseModel):
    plan_id: Literal["MONTHLY", "QUARTERLY", "YEARLY"]
    return_url: Optional[str] = Field(None, description="URL to redirect after successful payment")
    cancel_url: Optional[str] = Field(None, description="URL to redirect after cancelled payment")
    
    class Config:
        json_schema_extra = {
            "example": {
                "plan_id": "MONTHLY",
                "return_url": "http://localhost:5173/dashboard?payment=success",
                "cancel_url": "http://localhost:5173/dashboard?payment=cancelled"
            }
        }

class ManualPaymentCreate(BaseModel):
    client_id: int = Field(..., description="ID of the client")
    amount: Decimal = Field(..., gt=0, description="Payment amount")
    currency: str = Field(default="ILS", description="Currency code")
    plan_name: str = Field(..., description="Name/description of the payment")
    duration_months: int = Field(default=1, ge=1, description="Duration in months")
    status: Literal["INITIATED", "PAID", "FAILED"] = Field(default="PAID", description="Payment status")
    paid_at: Optional[datetime] = Field(None, description="When payment was completed")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    class Config:
        json_schema_extra = {
            "example": {
                "client_id": 1,
                "amount": 150.00,
                "currency": "ILS",
                "plan_name": "Monthly Personal Training",
                "duration_months": 1,
                "status": "PAID",
                "notes": "Cash payment received"
            }
        }

class PaymentOut(BaseModel):
    id: int
    client_id: int
    client_email: str
    client_phone: Optional[str] = None
    plan_id: str
    plan_name: str
    amount: str
    currency: str
    duration_months: int
    status: str
    paid_at: Optional[datetime] = None
    active_until: Optional[datetime] = None
    receipt_url: Optional[str] = None
    is_active: bool = False
    
    # PayPal fields (included when present)
    paypal_order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None
    
    @classmethod
    def from_payment(cls, payment):
        from datetime import datetime, timezone
        
        # Handle timezone-aware comparison
        now = datetime.now(timezone.utc)
        if payment.active_until:
            # Make active_until timezone-aware if it's naive
            active_until = payment.active_until
            if active_until.tzinfo is None:
                active_until = active_until.replace(tzinfo=timezone.utc)
            is_active = (
                str(payment.status) == "PaymentStatus.PAID" and 
                active_until >= now
            )
        else:
            is_active = False
        
        return cls(
            id=payment.id,
            client_id=payment.client_id,
            client_email=payment.client_email,
            client_phone=payment.client_phone,
            plan_id=payment.plan_id,
            plan_name=payment.plan_name,
            amount=str(payment.amount),
            currency=payment.currency,
            duration_months=payment.duration_months,
            status=str(payment.status).replace("PaymentStatus.", ""),
            paid_at=payment.paid_at,
            active_until=payment.active_until,
            receipt_url=payment.receipt_url,
            is_active=is_active,
            paypal_order_id=getattr(payment, 'paypal_order_id', None),
            paypal_capture_id=getattr(payment, 'paypal_capture_id', None)
        )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "client_id": 1,
                "client_email": "client@example.com",
                "client_phone": "+972-50-1234567",
                "plan_id": "MONTHLY",
                "plan_name": "Monthly",
                "amount": "700.00",
                "currency": "ILS",
                "duration_months": 1,
                "status": "PAID",
                "paid_at": "2024-01-15T10:30:00Z",
                "active_until": "2024-02-15T10:30:00Z",
                "receipt_url": "https://paypal.com/activity/payment/...",
                "is_active": True,
                "paypal_order_id": "5O190127TN364715T",
                "paypal_capture_id": "20G53990RR9087114"
            }
        }

class CheckoutResponse(BaseModel):
    checkout_url: str
    payment: PaymentOut
    
    class Config:
        json_schema_extra = {
            "example": {
                "checkout_url": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
                "payment": {
                    "id": 1,
                    "plan_id": "MONTHLY",
                    "status": "REQUIRES_PAYMENT",
                    "amount": "700.00",
                    "paypal_order_id": "5O190127TN364715T"
                }
            }
        }

class PaymentStatusManual(BaseModel):
    status: Literal['PAID', 'FAILED', 'REFUNDED', 'CANCELED', 'EXPIRED']
    paid_at: Optional[datetime] = None
    active_until: Optional[datetime] = None
    receipt_url: Optional[str] = None