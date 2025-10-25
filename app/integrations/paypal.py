# integrations/paypal.py
# PayPal REST API integration for order creation and webhook verification

import os
import json
import time
import requests
from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException, Request
import logging

logger = logging.getLogger(__name__)

class PayPalConfig:
    def __init__(self):
        self.env = os.getenv("PAYPAL_ENVIRONMENT", "sandbox")  # Match your .env file
        self.client_id = os.getenv("PAYPAL_CLIENT_ID")
        self.client_secret = os.getenv("PAYPAL_CLIENT_SECRET")
        self.webhook_id = os.getenv("PAYPAL_WEBHOOK_ID")
        
        if not all([self.client_id, self.client_secret]):
            raise ValueError("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set")
        
        # Set base URLs based on environment
        if self.env == "live":
            self.base_url = "https://api-m.paypal.com"
            self.web_url = "https://www.paypal.com"
        else:
            self.base_url = "https://api-m.sandbox.paypal.com"
            self.web_url = "https://www.sandbox.paypal.com"

class PayPalClient:
    def __init__(self):
        self.config = PayPalConfig()
        self._access_token = None
        self._token_expires_at = 0
    
    def _get_access_token(self) -> str:
        """Get or refresh PayPal access token using client credentials flow"""
        # Check if token is still valid (with 5 minute buffer)
        if self._access_token and time.time() < (self._token_expires_at - 300):
            return self._access_token
        
        # Request new token
        url = f"{self.config.base_url}/v1/oauth2/token"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en_US",
        }
        data = "grant_type=client_credentials"
        
        try:
            response = requests.post(
                url,
                headers=headers,
                data=data,
                auth=(self.config.client_id, self.config.client_secret),
                timeout=30
            )
            response.raise_for_status()
            
            token_data = response.json()
            self._access_token = token_data["access_token"]
            # Set expiration time (expires_in is in seconds)
            self._token_expires_at = time.time() + token_data.get("expires_in", 3600)
            
            logger.info("PayPal access token refreshed successfully")
            return self._access_token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get PayPal access token: {e}")
            raise HTTPException(status_code=500, detail="PayPal authentication failed")
    
    def create_order(self, plan: Dict[str, Any], return_urls: Dict[str, str]) -> Tuple[str, str]:
        """
        Create a PayPal order for the given plan
        Returns: (approval_url, order_id)
        """
        access_token = self._get_access_token()
        
        url = f"{self.config.base_url}/v2/checkout/orders"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "PayPal-Request-Id": f"order-{int(time.time())}-{plan['id']}"  # Idempotency
        }
        
        # Create order payload
        order_data = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": plan["id"],
                    "description": f"{plan['name']} Subscription - {plan['months']} months",
                    "amount": {
                        "currency_code": "ILS",  # Always use ILS for Israeli market
                        "value": str(plan["amount"])
                    },
                    "custom_id": plan["id"]  # For tracking in webhooks
                }
            ],
            "application_context": {
                "brand_name": "Personal Trainer",
                "landing_page": "BILLING",
                "user_action": "PAY_NOW",
                "return_url": return_urls["success"],
                "cancel_url": return_urls["cancel"]
            }
        }
        
        try:
            response = requests.post(url, headers=headers, json=order_data, timeout=30)
            response.raise_for_status()
            
            order = response.json()
            order_id = order["id"]
            
            # Find approval URL
            approval_url = None
            for link in order.get("links", []):
                if link.get("rel") == "approve":
                    approval_url = link.get("href")
                    break
            
            if not approval_url:
                raise HTTPException(status_code=500, detail="PayPal approval URL not found")
            
            logger.info(f"PayPal order created: {order_id}")
            return approval_url, order_id
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create PayPal order: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"PayPal error response: {e.response.text}")
            raise HTTPException(status_code=500, detail="PayPal order creation failed")
    
    def capture_order(self, order_id: str) -> Dict[str, Any]:
        """
        Capture a PayPal order (used for webhook confirmation fallback)
        Returns: capture details
        """
        access_token = self._get_access_token()
        
        url = f"{self.config.base_url}/v2/checkout/orders/{order_id}/capture"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "PayPal-Request-Id": f"capture-{order_id}-{int(time.time())}"  # Idempotency
        }
        
        try:
            response = requests.post(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            capture_data = response.json()
            logger.info(f"PayPal order captured: {order_id}")
            return capture_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to capture PayPal order {order_id}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"PayPal error response: {e.response.text}")
            raise e  # Re-raise to let caller handle it
    
    def verify_webhook(self, request: Request, webhook_body: bytes) -> bool:
        """
        Verify PayPal webhook signature using PayPal's webhook verification API
        Returns: True if verified, False otherwise
        """
        if not self.config.webhook_id:
            logger.warning("PAYPAL_WEBHOOK_ID not configured, skipping webhook verification")
            return False
        
        access_token = self._get_access_token()
        
        # Extract required headers
        headers_dict = dict(request.headers)
        required_headers = [
            "paypal-transmission-id",
            "paypal-transmission-time", 
            "paypal-cert-url",
            "paypal-transmission-sig",
            "paypal-auth-algo"
        ]
        
        # Check if all required headers are present
        for header in required_headers:
            if header not in headers_dict:
                logger.error(f"Missing required webhook header: {header}")
                return False
        
        # Prepare verification request
        verification_url = f"{self.config.base_url}/v1/notifications/verify-webhook-signature"
        verification_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        verification_data = {
            "transmission_id": headers_dict["paypal-transmission-id"],
            "cert_url": headers_dict["paypal-cert-url"],
            "auth_algo": headers_dict["paypal-auth-algo"],
            "transmission_time": headers_dict["paypal-transmission-time"],
            "transmission_sig": headers_dict["paypal-transmission-sig"],
            "webhook_id": self.config.webhook_id,
            "webhook_event": json.loads(webhook_body.decode())
        }
        
        try:
            response = requests.post(
                verification_url,
                headers=verification_headers,
                json=verification_data,
                timeout=30
            )
            response.raise_for_status()
            
            verification_result = response.json()
            is_verified = verification_result.get("verification_status") == "SUCCESS"
            
            if is_verified:
                logger.info("PayPal webhook signature verified successfully")
            else:
                logger.warning("PayPal webhook signature verification failed")
            
            return is_verified
            
        except requests.exceptions.RequestException as e:
            logger.error(f"PayPal webhook verification failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"PayPal verification error response: {e.response.text}")
            return False

# Global PayPal client instance
paypal_client = PayPalClient()