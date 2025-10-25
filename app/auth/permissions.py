# auth/permissions.py

from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from typing import List

# Import get_current_user from user routes to avoid circular import issues
def get_current_user_import():
    """Delayed import to avoid circular dependency"""
    from app.routes.user import get_current_user
    return get_current_user

# Keep the old function name for backward compatibility
def get_current_user_dependency():
    """Import dependency dynamically to avoid circular imports - BACKWARD COMPATIBILITY"""
    from app.routes.user import get_current_user
    return get_current_user

async def require_coach_role(current_user: User = Depends(get_current_user_import())) -> User:
    """Dependency to ensure the current user is a coach"""
    if str(current_user.role) != "UserRole.COACH":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Coach role required."
        )
    return current_user

async def require_client_role(current_user: User = Depends(get_current_user_import())) -> User:
    """Dependency to ensure the current user is a client"""
    if str(current_user.role) != "UserRole.CLIENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Client role required."
        )
    return current_user

async def require_accountant_role(current_user: User = Depends(get_current_user_import())) -> User:
    """Dependency to ensure the current user is an accountant"""
    if str(current_user.role) != "UserRole.ACCOUNTANT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Accountant role required."
        )
    return current_user

def is_client(user: User) -> bool:
    """Helper to check if user is a client"""
    return getattr(user, 'role') == UserRole.CLIENT

def is_coach(user: User) -> bool:
    """Helper to check if user is a coach"""
    return getattr(user, 'role') == UserRole.COACH

def is_accountant(user: User) -> bool:
    """Helper to check if user is an accountant"""
    return getattr(user, 'role') == UserRole.ACCOUNTANT

def require_roles(allowed_roles: List[UserRole]):
    """Factory function to create a dependency that checks for specific roles"""
    def role_checker(current_user: User) -> User:
        user_role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        allowed_role_values = [role.value for role in allowed_roles]
        if user_role_value not in allowed_role_values:
            roles_str = ", ".join(allowed_role_values)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {roles_str}"
            )
        return current_user
    return role_checker

def check_coach_client_relationship(current_user: User, target_client_id: int) -> bool:
    """Check if a coach has access to a specific client"""
    user_role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if user_role_value == UserRole.COACH.value:
        # Check if the target client is in the coach's client list
        client_ids = [client.id for client in current_user.clients]
        return target_client_id in client_ids
    return False

def check_self_or_coach_access(current_user: User, target_user_id: int) -> bool:
    """Check if user can access target user (self access or coach-client relationship)"""
    # Users can always access their own data
    if getattr(current_user, 'id', None) == target_user_id:
        return True
    
    # Coaches can access their clients' data
    user_role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if user_role_value == UserRole.COACH.value:
        return check_coach_client_relationship(current_user, target_user_id)
    
    return False
