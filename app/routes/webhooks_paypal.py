# routes/webhooks_paypal.py
# PayPal webhook handling for payment events

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import json
import logging

from database import get_db
from app.models.payment import Payment, PaymentStatus
from app.integrations.paypal import paypal_client
from app.crud import payment as payment_crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/paypal")

# Reuse existing processed_events table for deduplication
from app.models.processed_event import ProcessedEvent

@router.post("/webhook", include_in_schema=False)
async def handle_paypal_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle PayPal webhook events (internal use only - called by PayPal)"""
    
    print("🚀 DEBUG: PayPal webhook received!")
    
    try:
        # Get raw webhook body
        webhook_body = await request.body()
        
        # Parse webhook event
        try:
            event = json.loads(webhook_body.decode())
        except json.JSONDecodeError:
            logger.error("Invalid JSON in PayPal webhook")
            raise HTTPException(status_code=400, detail="Invalid JSON")
        
        # Extract event details
        event_id = event.get("id")
        event_type = event.get("event_type")
        
        if not event_id or not event_type:
            logger.error("Missing event_id or event_type in PayPal webhook")
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Check if we've already processed this event (idempotency)
        existing_event = db.query(ProcessedEvent).filter_by(event_id=event_id).first()
        if existing_event:
            logger.info(f"PayPal webhook event {event_id} already processed")
            return {"status": "already_processed"}
        
        # Verify webhook signature
        if not paypal_client.verify_webhook(request, webhook_body):
            logger.error(f"PayPal webhook signature verification failed for event {event_id}")
            raise HTTPException(status_code=400, detail="Webhook signature verification failed")
        
        # Process the webhook event
        result = await process_paypal_event(db, event)
        
        # Mark event as processed
        processed_event = ProcessedEvent(
            event_id=event_id
        )
        db.add(processed_event)
        db.commit()
        
        logger.info(f"PayPal webhook event {event_id} processed successfully")
        return {"status": "processed", "result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing PayPal webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def process_paypal_event(db: Session, event: dict) -> dict:
    """Process individual PayPal webhook events"""
    
    event_type = event.get("event_type")
    resource = event.get("resource", {})
    
    # Debug logging
    print(f"🔥 DEBUG: Processing PayPal event: {event_type}")
    print(f"🔥 DEBUG: Resource ID: {resource.get('id', 'N/A')}")
    logger.info(f"Processing PayPal event: {event_type}")
    logger.info(f"Resource ID: {resource.get('id', 'N/A')}")
    
    if event_type == "CHECKOUT.ORDER.APPROVED":
        # Optional: Order approved but not yet captured
        return await handle_order_approved(db, event, resource)
        
    elif event_type == "PAYMENT.CAPTURE.COMPLETED":
        # Payment captured successfully
        return await handle_payment_captured(db, event, resource)
        
    elif event_type == "PAYMENT.CAPTURE.DENIED":
        # Payment capture denied
        return await handle_payment_denied(db, event, resource)
        
    elif event_type == "PAYMENT.CAPTURE.REFUNDED":
        # Payment refunded
        return await handle_payment_refunded(db, event, resource)
        
    elif event_type == "CHECKOUT.ORDER.CANCELLED":
        # Order cancelled
        return await handle_order_cancelled(db, event, resource)
        
    else:
        # Unhandled event type
        logger.info(f"Unhandled PayPal webhook event type: {event_type}")
        return {"status": "ignored", "reason": "unhandled_event_type"}

async def handle_order_approved(db: Session, event: dict, resource: dict) -> dict:
    """Handle CHECKOUT.ORDER.APPROVED event"""
    order_id = resource.get("id")
    
    if not order_id:
        logger.error("Missing order ID in CHECKOUT.ORDER.APPROVED event")
        return {"status": "error", "reason": "missing_order_id"}
    
    # Find payment by PayPal order ID
    payment = db.query(Payment).filter_by(paypal_order_id=order_id).first()
    
    if not payment:
        logger.warning(f"Payment not found for PayPal order {order_id}")
        return {"status": "warning", "reason": "payment_not_found"}
    
    # Order approved - capture the payment immediately
    print(f"💳 DEBUG: Auto-capturing PayPal order {order_id}")
    
    try:
        # Capture the payment using PayPal API
        capture_response = paypal_client.capture_order(order_id)
        
        if capture_response.get("status") == "COMPLETED":
            # Update payment status to PAID
            payment.status = PaymentStatus.PAID
            payment.paid_at = datetime.now(timezone.utc)
            payment.active_until = payment.paid_at + timedelta(days=payment.duration_months * 30)
            
            db.commit()
            db.refresh(payment)
            
            print(f"✅ DEBUG: Payment {payment.id} captured and marked as PAID")
            logger.info(f"PayPal order {order_id} captured and payment {payment.id} marked as PAID")
            return {"status": "payment_captured", "payment_id": payment.id}
        else:
            print(f"❌ DEBUG: PayPal capture failed: {capture_response}")
            return {"status": "capture_failed", "response": capture_response}
            
    except Exception as e:
        print(f"❌ DEBUG: Error capturing payment: {e}")
        logger.error(f"Error capturing PayPal payment {order_id}: {e}")
        return {"status": "capture_error", "error": str(e)}

async def handle_payment_captured(db: Session, event: dict, resource: dict) -> dict:
    """Handle PAYMENT.CAPTURE.COMPLETED event"""
    
    # Extract order ID from the resource or supplementary data
    order_id = None
    
    # Method 1: Check supplementary_data for related order ID
    supplementary_data = resource.get("supplementary_data", {})
    related_ids = supplementary_data.get("related_ids", {})
    order_id = related_ids.get("order_id")
    
    # Method 2: Check links for order reference
    if not order_id:
        links = resource.get("links", [])
        for link in links:
            if link.get("rel") == "up":
                # Extract order ID from URL like /v2/checkout/orders/ORDER_ID
                href = link.get("href", "")
                if "/orders/" in href:
                    order_id = href.split("/orders/")[-1]
                    break
    
    if not order_id:
        logger.error("Could not extract order ID from PAYMENT.CAPTURE.COMPLETED event")
        return {"status": "error", "reason": "missing_order_id"}
    
    # Find payment by PayPal order ID
    print(f"🔍 DEBUG: Looking for payment with PayPal order ID: {order_id}")
    logger.info(f"Looking for payment with PayPal order ID: {order_id}")
    payment = db.query(Payment).filter_by(paypal_order_id=order_id).first()
    
    if not payment:
        logger.warning(f"Payment not found for PayPal order {order_id}")
        # Debug: Let's see what payments exist
        all_payments = db.query(Payment).limit(5).all()
        for p in all_payments:
            logger.info(f"Existing payment {p.id}: order_id={p.paypal_order_id}, status={p.status}")
        return {"status": "warning", "reason": "payment_not_found"}
    
    # Check if payment is already in terminal state
    if payment.status in [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.REFUNDED]:
        logger.info(f"Payment {payment.id} already in terminal state: {payment.status}")
        return {"status": "already_terminal", "payment_id": payment.id}
    
    # Update payment to PAID status
    payment.status = PaymentStatus.PAID
    payment.paypal_capture_id = resource.get("id")
    
    # Set paid_at from event or current time
    event_time = event.get("create_time")
    if event_time:
        try:
            payment.paid_at = datetime.fromisoformat(event_time.replace("Z", "+00:00"))
        except ValueError:
            payment.paid_at = datetime.now(timezone.utc)
    else:
        payment.paid_at = datetime.now(timezone.utc)
    
    # Calculate active_until based on duration
    payment.active_until = payment.paid_at + timedelta(days=payment.duration_months * 30)
    
    # Set receipt URL if available
    links = resource.get("links", [])
    for link in links:
        if link.get("rel") == "self":
            payment.receipt_url = link.get("href")
            break
    
    db.commit()
    db.refresh(payment)
    
    logger.info(f"Payment {payment.id} marked as PAID via PayPal capture {payment.paypal_capture_id}")
    return {"status": "payment_completed", "payment_id": payment.id}

async def handle_payment_denied(db: Session, event: dict, resource: dict) -> dict:
    """Handle PAYMENT.CAPTURE.DENIED event"""
    
    # Similar order ID extraction logic
    order_id = None
    supplementary_data = resource.get("supplementary_data", {})
    related_ids = supplementary_data.get("related_ids", {})
    order_id = related_ids.get("order_id")
    
    if not order_id:
        links = resource.get("links", [])
        for link in links:
            if link.get("rel") == "up" and "/orders/" in link.get("href", ""):
                order_id = link.get("href", "").split("/orders/")[-1]
                break
    
    if not order_id:
        logger.error("Could not extract order ID from PAYMENT.CAPTURE.DENIED event")
        return {"status": "error", "reason": "missing_order_id"}
    
    # Find and update payment
    payment = db.query(Payment).filter_by(paypal_order_id=order_id).first()
    
    if not payment:
        logger.warning(f"Payment not found for PayPal order {order_id}")
        return {"status": "warning", "reason": "payment_not_found"}
    
    payment.status = PaymentStatus.FAILED
    db.commit()
    
    logger.info(f"Payment {payment.id} marked as FAILED due to capture denial")
    return {"status": "payment_failed", "payment_id": payment.id}

async def handle_payment_refunded(db: Session, event: dict, resource: dict) -> dict:
    """Handle PAYMENT.CAPTURE.REFUNDED event"""
    
    # For refunds, we need to find the original capture ID
    capture_id = resource.get("id")
    
    if not capture_id:
        logger.error("Missing capture ID in PAYMENT.CAPTURE.REFUNDED event")
        return {"status": "error", "reason": "missing_capture_id"}
    
    # Find payment by PayPal capture ID
    payment = db.query(Payment).filter_by(paypal_capture_id=capture_id).first()
    
    if not payment:
        logger.warning(f"Payment not found for PayPal capture {capture_id}")
        return {"status": "warning", "reason": "payment_not_found"}
    
    payment.status = PaymentStatus.REFUNDED
    db.commit()
    
    logger.info(f"Payment {payment.id} marked as REFUNDED via PayPal capture {capture_id}")
    return {"status": "payment_refunded", "payment_id": payment.id}

async def handle_order_cancelled(db: Session, event: dict, resource: dict) -> dict:
    """Handle CHECKOUT.ORDER.CANCELLED event"""
    
    order_id = resource.get("id")
    
    if not order_id:
        logger.error("Missing order ID in CHECKOUT.ORDER.CANCELLED event")
        return {"status": "error", "reason": "missing_order_id"}
    
    # Find payment by PayPal order ID
    payment = db.query(Payment).filter_by(paypal_order_id=order_id).first()
    
    if not payment:
        logger.warning(f"Payment not found for PayPal order {order_id}")
        return {"status": "warning", "reason": "payment_not_found"}
    
    # Only cancel if still pending
    if payment.status in [PaymentStatus.INITIATED, PaymentStatus.REQUIRES_PAYMENT]:
        payment.status = PaymentStatus.CANCELED
        db.commit()
        
        logger.info(f"Payment {payment.id} marked as CANCELED due to order cancellation")
        return {"status": "payment_cancelled", "payment_id": payment.id}
    else:
        logger.info(f"Payment {payment.id} not cancelled - already in state {payment.status}")
        return {"status": "not_cancelled", "payment_id": payment.id, "current_status": str(payment.status)}