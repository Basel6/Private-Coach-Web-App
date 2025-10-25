# scripts/seed_schedule.py
# Script to seed the database with initial scheduling data

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import sessionmaker
from database import engine

# Import all models to ensure proper relationship initialization
from app.models.user import User, UserRole
from app.models.payment import Payment  # Import Payment before using User relationships
from app.models.booking import Booking
from app.models.workout import WorkoutTemplate, WorkoutPlan
from app.models.processed_event import ProcessedEvent
from app.models.schedule import PlanType, ScheduleSlot, ClientPlan, ClientPreference

from app.crud.schedule import (
    seed_weekly_schedule, 
    create_client_plan, 
    create_or_update_client_preference
)

def setup_coach_shifts():
    """Set up coach shift hours for existing coaches"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🔄 Setting up coach shifts...")
        
        # Get all coaches
        coaches = db.query(User).filter(User.role == UserRole.COACH).all()
        
        if len(coaches) == 0:
            print("⚠️ No coaches found in database")
            return False
        
        # Set up shifts for coaches
        for i, coach in enumerate(coaches):
            if i == 0:  # First coach: Morning shift (10-15)
                setattr(coach, 'shift_start_hour', 10)
                setattr(coach, 'shift_end_hour', 15)
                shift_name = "Morning (10:00-15:00)"
            else:  # Second coach: Evening shift (16-21)
                setattr(coach, 'shift_start_hour', 16)
                setattr(coach, 'shift_end_hour', 21)
                shift_name = "Evening (16:00-21:00)"
            
            print(f"   Set {coach.first_name} {coach.last_name} to {shift_name}")
        
        db.commit()
        print(f"✅ Set up shifts for {len(coaches)} coaches")
        return True
        
    except Exception as e:
        print(f"❌ Error setting up coach shifts: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def seed_sample_client_plans():
    """Create sample client plans for existing clients"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🔄 Creating sample client plans...")
        
        # Get all clients and coaches
        clients = db.query(User).filter(User.role == UserRole.CLIENT).all()
        coaches = db.query(User).filter(User.role == UserRole.COACH).all()
        
        if len(clients) == 0:
            print("⚠️ No clients found in database")
            return False
        
        if len(coaches) == 0:
            print("⚠️ No coaches found in database")
            return False
        
        plans_created = 0
        sample_plans = [
            PlanType.AB,     # 2 sessions/week
            PlanType.ABC,    # 3 sessions/week
            PlanType.PPL,    # 3 sessions/week
            PlanType.FIVE_DAY # 5 sessions/week
        ]
        
        for i, client in enumerate(clients):
            # Assign plans in rotation
            plan_type = sample_plans[i % len(sample_plans)]
            
            # Assign coaches in rotation (distribute clients between coaches)
            assigned_coach = coaches[i % len(coaches)]
            
            # Check if client already has a plan
            from app.crud.schedule import get_client_plan
            existing_plan = get_client_plan(db, client.id)
            if existing_plan:
                print(f"   Client {client.first_name} already has a plan, skipping")
                continue
            
            # Create the plan
            create_client_plan(db, client.id, plan_type, assigned_coach.id)
            plans_created += 1
            
            print(f"   Created {plan_type.value} plan for {client.first_name} (Coach: {assigned_coach.first_name})")
        
        print(f"✅ Created {plans_created} client plans")
        return True
        
    except Exception as e:
        print(f"❌ Error creating client plans: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def seed_sample_preferences():
    """Create sample client preferences"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🔄 Creating sample client preferences...")
        
        clients = db.query(User).filter(User.role == UserRole.CLIENT).all()
        
        if len(clients) == 0:
            print("⚠️ No clients found in database")
            return False
        
        preferences_created = 0
        sample_preferences = [
            {"start": 10, "end": 13, "flexible": False},  # Morning preference
            {"start": 17, "end": 20, "flexible": False},  # Evening preference
            {"start": None, "end": None, "flexible": True},  # Flexible
            {"start": 14, "end": 17, "flexible": False},  # Afternoon preference
        ]
        
        for i, client in enumerate(clients):
            pref = sample_preferences[i % len(sample_preferences)]
            
            create_or_update_client_preference(
                db=db,
                client_id=client.id,
                preferred_start_hour=pref["start"],
                preferred_end_hour=pref["end"],
                is_flexible=pref["flexible"]
            )
            preferences_created += 1
            
            pref_desc = "Flexible" if pref["flexible"] else f"{pref['start']}:00-{pref['end']}:00"
            print(f"   Created preference for {client.first_name}: {pref_desc}")
        
        print(f"✅ Created {preferences_created} client preferences")
        return True
        
    except Exception as e:
        print(f"❌ Error creating client preferences: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def main():
    """Main seeding function"""
    print("🌱 Starting scheduling system database seeding...")
    print("=" * 50)
    
    success_count = 0
    total_steps = 4
    
    # Step 1: Set up coach shifts
    if setup_coach_shifts():
        success_count += 1
    
    # Step 2: Seed weekly schedule slots
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        print("🔄 Creating weekly schedule slots...")
        if seed_weekly_schedule(db):
            success_count += 1
        else:
            print("❌ Failed to create schedule slots")
    finally:
        db.close()
    
    # Step 3: Create sample client plans
    if seed_sample_client_plans():
        success_count += 1
    
    # Step 4: Create sample client preferences
    if seed_sample_preferences():
        success_count += 1
    
    print("=" * 50)
    print(f"🎯 Seeding completed: {success_count}/{total_steps} steps successful")
    
    if success_count == total_steps:
        print("🎉 Scheduling system is ready for use!")
        print("\nNext steps:")
        print("1. Test the schedule endpoints")
        print("2. Try the AI booking suggestions")
        print("3. Monitor slot occupancy")
    else:
        print("⚠️ Some seeding steps failed. Check the logs above.")
        return False
    
    return True

if __name__ == "__main__":
    main()