# routes/payment_pages.py
# Simple HTML pages for PayPal payment completion

from fastapi import APIRouter, Request, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from database import get_db
from app.models.payment import Payment, PaymentStatus
from fastapi import Depends

router = APIRouter()

@router.get("/success", response_class=HTMLResponse)
async def payment_success(
    token: str = Query(None, description="PayPal token"),
    PayerID: str = Query(None, description="PayPal payer ID"),
    db: Session = Depends(get_db)
):
    """Success page after PayPal payment completion"""
    
    # Try to find the payment by PayPal order ID (token)
    payment = None
    if token:
        payment = db.query(Payment).filter(Payment.paypal_order_id == token).first()
    
    payment_info = ""
    if payment:
        status_color = "green" if payment.status == PaymentStatus.PAID else "orange"
        payment_info = f"""
        <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <h3>Payment Details</h3>
            <p><strong>Plan:</strong> {payment.plan_name}</p>
            <p><strong>Amount:</strong> {payment.amount} {payment.currency}</p>
            <p><strong>Status:</strong> <span style="color: {status_color}; font-weight: bold;">{payment.status.value}</span></p>
            <p><strong>Duration:</strong> {payment.duration_months} months</p>
            {f'<p><strong>Active Until:</strong> {payment.active_until.strftime("%Y-%m-%d %H:%M:%S") if payment.active_until else "Pending"}</p>' if payment.active_until else ""}
        </div>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Successful</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                text-align: center;
                background-color: #f5f5f5;
            }}
            .success-container {{
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .success-icon {{
                color: #28a745;
                font-size: 48px;
                margin-bottom: 20px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin-top: 20px;
            }}
            .button:hover {{
                background-color: #0056b3;
            }}
        </style>
    </head>
    <body>
        <div class="success-container">
            <div class="success-icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Thank you for your subscription to our Personal Training service.</p>
            <p>Your payment has been processed successfully and your subscription is now active.</p>
            
            {payment_info}
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                PayPal Transaction ID: {token if token else 'N/A'}<br>
                Payer ID: {PayerID if PayerID else 'N/A'}
            </p>
            
            <a href="http://localhost:8000/docs" class="button">Return to API Documentation</a>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@router.get("/cancel", response_class=HTMLResponse)
async def payment_cancel(
    token: str = Query(None, description="PayPal token")
):
    """Cancel page when user cancels PayPal payment"""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Payment Cancelled</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                text-align: center;
                background-color: #f5f5f5;
            }}
            .cancel-container {{
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            .cancel-icon {{
                color: #dc3545;
                font-size: 48px;
                margin-bottom: 20px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 10px;
            }}
            .button:hover {{
                background-color: #0056b3;
            }}
            .button.retry {{
                background-color: #28a745;
            }}
            .button.retry:hover {{
                background-color: #1e7e34;
            }}
        </style>
    </head>
    <body>
        <div class="cancel-container">
            <div class="cancel-icon">❌</div>
            <h1>Payment Cancelled</h1>
            <p>You have cancelled the payment process.</p>
            <p>Don't worry! You can try again anytime.</p>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Transaction ID: {token if token else 'N/A'}
            </p>
            
            <div>
                <a href="http://localhost:8000/docs" class="button retry">Try Payment Again</a>
                <a href="http://localhost:8000/docs" class="button">Return to API Documentation</a>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)