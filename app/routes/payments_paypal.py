# routes/payments.py
# PayPal-based payment processing routes

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import csv
from io import StringIO
from fastapi.responses import Response
import os

from database import get_db
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.schemas.payment import CreateCheckout, CheckoutResponse, PaymentOut, PaymentStatusManual, ManualPaymentCreate
from app.crud import payment as payment_crud
from app.auth.permissions import require_client_role, require_accountant_role, get_current_user_dependency
from app.services.subscriptions import get_plan, has_active_subscription
from app.integrations.paypal import paypal_client

router = APIRouter()

@router.get("/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    from app.services.subscriptions import PLANS
    return {"plans": PLANS}

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    checkout_data: CreateCheckout,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_role)
):
    """Create PayPal checkout session for CLIENT users"""
    
    # Get plan details
    plan = get_plan(checkout_data.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan_id")
    
    # Create payment record
    payment = Payment(
        client_id=current_user.id,
        client_email=current_user.email,
        client_phone=getattr(current_user, 'phone', None),
        plan_id=plan["id"],
        plan_name=plan["name"],
        amount=Decimal(str(plan["amount"])),
        currency="ILS",  # Fixed: Currency is always ILS
        duration_months=plan["months"],  # Fixed: Use 'months' from plan structure
        status=PaymentStatus.INITIATED,
        provider="PAYPAL"
    )
    
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    try:
        # Use frontend URLs if provided, otherwise fall back to environment variables
        return_urls = {
            "success": checkout_data.return_url or os.getenv("FRONTEND_SUCCESS_URL", "http://localhost:5173/dashboard?payment=success"),
            "cancel": checkout_data.cancel_url or os.getenv("FRONTEND_CANCEL_URL", "http://localhost:5173/dashboard?payment=cancelled")
        }
        
        # Create PayPal order
        approval_url, order_id = paypal_client.create_order(plan, return_urls)
        
        # Update payment with PayPal order ID and status
        payment.paypal_order_id = order_id
        payment.status = PaymentStatus.REQUIRES_PAYMENT
        db.commit()
        db.refresh(payment)
        
        return CheckoutResponse(
            checkout_url=approval_url,
            payment=PaymentOut.from_payment(payment)
        )
        
    except Exception as e:
        # Clean up payment record on failure
        db.delete(payment)
        db.commit()
        raise HTTPException(status_code=500, detail=f"PayPal checkout creation failed: {str(e)}")

@router.get("/me", response_model=List[PaymentOut])
async def get_my_payments(
    status: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    limit: int = Query(10, le=50),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_role)
):
    """Get current user's payments"""
    payments = payment_crud.get_client_payments(
        db=db,
        client_id=current_user.id,
        status=status,
        active=active,
        limit=limit,
        offset=offset
    )
    return [PaymentOut.from_payment(p) for p in payments]

@router.get("/reports", response_model=List[PaymentOut])
async def get_payment_reports(
    client_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    min_amount: Optional[Decimal] = Query(None),
    max_amount: Optional[Decimal] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accountant_role)
):
    """Get payment reports (accountants only)"""
    payments = payment_crud.get_all_payments(
        db=db,
        client_id=client_id,
        status=status,
        active=active,
        from_date=from_date,
        to_date=to_date,
        min_amount=min_amount,
        max_amount=max_amount,
        limit=limit,
        offset=offset
    )
    return [PaymentOut.from_payment(p) for p in payments]

@router.get("/all", response_model=List[PaymentOut])
async def get_all_payments_route(
    limit: int = Query(100, le=500, description="Maximum number of payments to return"),
    offset: int = Query(0, description="Number of payments to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accountant_role)
):
    """Get all payments (accountants only) - simplified endpoint for dashboard"""
    payments = payment_crud.get_all_payments(
        db=db,
        limit=limit,
        offset=offset
    )
    return [PaymentOut.from_payment(p) for p in payments]

@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency())
):
    """Get payment by ID (client can see own, accountant can see any)"""
    payment = payment_crud.get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Check permissions
    user_role_str = str(getattr(current_user, 'role'))
    if user_role_str == "UserRole.CLIENT":
        if payment.client_id != getattr(current_user, 'id'):
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_role_str != "UserRole.ACCOUNTANT":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return PaymentOut.from_payment(payment)

@router.patch("/{payment_id}/status", response_model=PaymentOut)
async def update_payment_status(
    payment_id: int,
    status_data: PaymentStatusManual,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accountant_role)
):
    """Manually update payment status (accountants only)"""
    payment = payment_crud.get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Update payment status
    payment.status = PaymentStatus(status_data.status)
    if status_data.paid_at:
        payment.paid_at = status_data.paid_at
    if status_data.active_until:
        payment.active_until = status_data.active_until
    if status_data.receipt_url:
        payment.receipt_url = status_data.receipt_url
    
    # Auto-compute active_until if setting to PAID and not provided
    if status_data.status == "PAID" and not status_data.active_until:
        if not payment.paid_at:
            payment.paid_at = datetime.now(timezone.utc)
        payment.active_until = payment.paid_at + timedelta(days=payment.duration_months * 30)
    
    db.commit()
    db.refresh(payment)
    
    return PaymentOut.from_payment(payment)

@router.post("/manual", response_model=PaymentOut)
async def create_manual_payment(
    payment_data: ManualPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accountant_role)
):
    """Create a manual payment record (accountants only)"""
    
    # Verify client exists
    client = db.query(User).filter(User.id == payment_data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Create payment record
    payment = payment_crud.create_payment(
        db=db,
        client_id=payment_data.client_id,
        client_email=str(client.email),
        client_phone=getattr(client, 'phone', None),
        plan_id="MANUAL",
        plan_name=payment_data.plan_name,
        amount=payment_data.amount,
        currency=payment_data.currency,
        duration_months=payment_data.duration_months
    )
    
    # Update status and timing if specified
    if payment_data.status == "PAID":
        paid_at = payment_data.paid_at or datetime.now(timezone.utc)
        active_until = paid_at + timedelta(days=payment_data.duration_months * 30)
        
        payment_crud.update_payment_status(
            db=db,
            payment=payment,
            status=PaymentStatus.PAID,
            paid_at=paid_at,
            active_until=active_until
        )
    elif payment_data.status == "FAILED":
        payment_crud.update_payment_status(
            db=db,
            payment=payment,
            status=PaymentStatus.FAILED
        )
    
    return PaymentOut.from_payment(payment)

@router.get("/reports/export.csv")
async def export_payments_csv(
    client_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    min_amount: Optional[Decimal] = Query(None),
    max_amount: Optional[Decimal] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accountant_role)
):
    """Export payment reports as CSV (accountants only)"""
    
    payments = payment_crud.get_all_payments(
        db=db,
        client_id=client_id,
        status=status,
        active=active,
        from_date=from_date,
        to_date=to_date,
        min_amount=min_amount,
        max_amount=max_amount,
        limit=1000,  # Reasonable limit for CSV export
        offset=0
    )
    
    # Generate CSV content
    output = StringIO()
    writer = csv.writer(output)
    
    # Write header with CSV injection protection
    headers = [
        "ID", "Client ID", "Client Email", "Plan ID", "Plan Name", 
        "Amount", "Currency", "Duration (Months)", "Status", 
        "Paid At", "Active Until", "PayPal Order ID", "PayPal Capture ID",
        "Receipt URL", "Created At"
    ]
    writer.writerow(headers)
    
    # Write data rows with CSV injection protection
    for payment in payments:
        def safe_value(value):
            """Protect against CSV injection attacks"""
            if isinstance(value, str) and value.startswith(('=', '+', '-', '@')):
                return f"'{value}"  # Prefix with quote to neutralize formula
            return value
        
        row = [
            safe_value(payment.id),
            safe_value(payment.client_id),
            safe_value(payment.client_email),
            safe_value(payment.plan_id),
            safe_value(payment.plan_name),
            safe_value(str(payment.amount)),
            safe_value(payment.currency),
            safe_value(payment.duration_months),
            safe_value(str(payment.status).replace("PaymentStatus.", "")),
            safe_value(payment.paid_at.isoformat() if payment.paid_at else ""),
            safe_value(payment.active_until.isoformat() if payment.active_until else ""),
            safe_value(getattr(payment, 'paypal_order_id', '') or ''),
            safe_value(getattr(payment, 'paypal_capture_id', '') or ''),
            safe_value(payment.receipt_url or ''),
            safe_value(payment.created_at.isoformat() if payment.created_at else "")
        ]
        writer.writerow(row)
    
    csv_content = output.getvalue()
    output.close()
    
    # Return CSV response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payments_export.csv"}
    )