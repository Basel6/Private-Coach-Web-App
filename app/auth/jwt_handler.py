from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt
import os
from typing import cast, Optional


# Load from .env
JWT_SECRET = os.getenv("JWT_SECRET")
if JWT_SECRET is None:
    raise ValueError("JWT_SECRET is not set in the .env file")


JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_SECONDS = int(os.getenv("JWT_EXPIRATION_SECONDS", "3600"))

# create a JWT access token with an expiration and encoded data
def create_access_token(data: dict) -> str:
  
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(seconds=JWT_EXPIRATION_SECONDS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

# decode a JWT access token and return the payload if valid, or None if invalid
def decode_access_token(token: str) -> Optional[dict]:

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
