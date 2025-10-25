# to run the FastAPI application, use the command: uvicorn app.main:app --reload --host
# to open the interactive API documentation, navigate to: http://localhost:8000/docs
# or PS: -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.routes import user
from app.routes import booking, workout, payments_paypal, webhooks_paypal, payment_pages, schedule
import os

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title="Personal Trainer API",
    description="Personal trainer management system with PayPal payments",
    version="1.0.0",
    openapi_tags=[
        {"name": "Users", "description": "User management and authentication"},
        {"name": "Bookings", "description": "Session booking management"},
        {"name": "Workouts", "description": "Workout templates and plans"},
        {"name": "Payments", "description": "PayPal payment processing and management"},
        {"name": "PayPal Webhooks", "description": "PayPal webhook handling"},
        {"name": "Schedule", "description": "AI-powered scheduling and slot management"}
    ]
)

# CORS Configuration - Restrict to specific origins
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5173").split(",")
if os.getenv("ENVIRONMENT") == "production":
    # In production, use only specific domains (no localhost)
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip() and not origin.startswith("http://localhost")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Security middleware for production
if os.getenv("ENVIRONMENT") == "production":
    # Force HTTPS in production
    app.add_middleware(HTTPSRedirectMiddleware)

# Trusted host middleware (always active for security)
allowed_hosts = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
allowed_hosts = [host.strip() for host in allowed_hosts if host.strip()]
if allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# Root endpoint - redirect to docs
@app.get("/")
async def root():
    """Root endpoint that provides API information and links to documentation"""
    return {
        "message": "Personal Trainer API",
        "version": "1.0.0",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "status": "active"
    }

app.include_router(user.router, prefix="/users", tags=["Users"])
app.include_router(booking.router, prefix="/bookings", tags=["Bookings"])
app.include_router(workout.router, prefix="/workouts", tags=["Workouts"])
app.include_router(payments_paypal.router, prefix="/payments", tags=["Payments"])
app.include_router(webhooks_paypal.router, tags=["PayPal Webhooks"])
app.include_router(payment_pages.router, tags=["Payment Pages"])
app.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])