"""
CP-SAT Constraint Programming Solver for Personal Trainer Scheduling

This module implements intelligent scheduling using Google OR-Tools CP-SAT solver.
It considers multiple constraints simultaneously to find optimal booking suggestions.

Key Features:
- Capacity constraints (don't overbook slots)
- Recovery constraints (minimum time between client sessions)
- Client preference optimization (preferred time slots)
- Coach availability and shift compliance
- Load balancing across coaches
- Objective optimization for maximum satisfaction

Mathematical Model:
- Variables: Binary decision variables for each (client, slot, time) combination
- Constraints: Logical rules that must be satisfied
- Objective: Weighted scoring function to maximize preferences and balance load
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from app.models.schedule import ScheduleSlot, ClientPlan, ClientPreference, PlanType
from app.models.user import User, UserRole
from app.models.booking import Booking
from app.crud import schedule as schedule_crud


class SuggestionReason(Enum):
    """Reasons why a booking was suggested"""
    PERFECT_PREFERENCE_MATCH = "Perfect match with your preferred time"
    GOOD_PREFERENCE_MATCH = "Close to your preferred time"
    COACH_AVAILABILITY = "Your assigned coach is available"
    CAPACITY_AVAILABLE = "Slot has available capacity"
    RECOVERY_COMPLIANT = "Appropriate recovery time from last session"
    LOAD_BALANCING = "Helps balance coach workload"
    ONLY_OPTION = "Limited availability - best option found"


@dataclass
class SchedulingResult:
    """Result of CP-SAT scheduling optimization"""
    client_id: int
    suggested_slots: List[Dict[str, Any]]
    total_suggestions: int
    solver_status: str
    solve_time_ms: int
    confidence_score: float
    constraints_satisfied: List[str]
    reasons: List[SuggestionReason]
    alternative_dates: List[datetime] = None


@dataclass
class ConstraintWeights:
    """Weights for different objectives in the optimization"""
    preference_match: float = 10.0      # Weight for matching client preferences
    coach_load_balance: float = 5.0     # Weight for balancing coach workload
    capacity_utilization: float = 3.0   # Weight for efficient capacity usage
    recovery_time: float = 8.0          # Weight for proper recovery time
    time_continuity: float = 2.0        # Weight for scheduling sessions close together


class CPSATScheduler:
    """
    Constraint Programming Scheduler using Google OR-Tools CP-SAT
    
    This class implements intelligent scheduling by modeling the scheduling problem
    as a constraint satisfaction problem with optimization objectives.
    """
    
    def __init__(self, db: Session, weights: Optional[ConstraintWeights] = None):
        self.db = db
        self.weights = weights or ConstraintWeights()
        self.model = None
        self.solver = None
        
        # Constraint tracking for explanation
        self.constraint_explanations = []
        
        # Scheduling parameters
        self.min_recovery_hours = 24  # Minimum hours between sessions for same client
        self.max_suggestions = 5      # Maximum number of suggestions to return
        self.planning_horizon_days = 14  # Look ahead this many days
        
    def suggest_optimal_bookings(
        self, 
        client_id: int, 
        num_sessions: int = 1,
        preferred_date: Optional[datetime] = None,
        days_flexibility: int = 7,
        excluded_slot_ids: Optional[List[int]] = None
    ) -> SchedulingResult:
        """
        Find optimal booking suggestions for a client using CP-SAT solver
        
        Args:
            client_id: ID of the client requesting bookings
            num_sessions: Number of sessions to schedule
            preferred_date: Preferred starting date (default: today)
            days_flexibility: How many days flexibility for scheduling
            
        Returns:
            SchedulingResult with optimized suggestions and explanations
        """
        start_time = datetime.now()
        
        try:
            # Step 1: Gather scheduling data
            scheduling_data = self._gather_scheduling_data(
                client_id, preferred_date, days_flexibility
            )
            
            if not scheduling_data['available_slots']:
                print(f"🔍 SCHEDULER DEBUG - No available slots found, returning no suggestions")
                return self._create_no_availability_result(client_id, start_time)
            
            # Check weekly quota before proceeding
            weekly_limit = getattr(scheduling_data['client_plan'], 'sessions_per_week', 3)
            current_week_bookings = self._count_current_week_bookings(scheduling_data)
            remaining_quota = weekly_limit - current_week_bookings
            
            print(f"🔍 QUOTA DEBUG - Weekly limit: {weekly_limit}, Current week bookings: {current_week_bookings}, Remaining: {remaining_quota}")
            print(f"🔍 QUOTA DEBUG - Existing bookings total: {len(scheduling_data['existing_bookings'])}")
            
            if remaining_quota <= 0:
                print(f"🔍 SCHEDULER DEBUG - Weekly quota exceeded ({current_week_bookings}/{weekly_limit})")
                return self._create_quota_exceeded_result(client_id, start_time, weekly_limit, current_week_bookings)
            
            # Always generate weekly status message for user context
            week_status_msg = self._generate_week_status_message(client_id, scheduling_data)
            self.constraint_explanations = [week_status_msg]
            
            if num_sessions > remaining_quota:
                print(f"🔍 SCHEDULER DEBUG - Requested {num_sessions} sessions exceeds remaining quota {remaining_quota}")
                # Try with remaining quota instead
                num_sessions = remaining_quota
            
            print(f"🔍 SCHEDULER DEBUG - Step 2: Creating CP-SAT model with {len(scheduling_data['available_slots'])} slots")
            # Debug: Show available days
            available_days = set(slot.day_of_week for slot in scheduling_data['available_slots'])
            days_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            available_day_names = [days_names[day] for day in sorted(available_days)]
            print(f"🔍 SCHEDULER DEBUG - Available days: {available_day_names} (days {sorted(available_days)})")
            
            # Step 2: Create CP-SAT model
            self._create_model(scheduling_data, num_sessions)
            
            print(f"🔍 SCHEDULER DEBUG - Step 3: Adding constraints")
            # Step 3: Add constraints
            self._add_capacity_constraints(scheduling_data)
            self._add_recovery_constraints(scheduling_data, client_id)
            self._add_coach_availability_constraints(scheduling_data)
            self._add_current_time_constraints(scheduling_data)
            self._add_weekly_quota_constraints(scheduling_data, client_id)
            self._add_excluded_slots_constraints(scheduling_data, excluded_slot_ids or [])
            self._add_preference_constraints(scheduling_data, client_id)
            
            print(f"🔍 SCHEDULER DEBUG - Step 4: Defining objective function")
            # Step 4: Define objective function
            self._define_objective(scheduling_data, client_id)
            
            print(f"🔍 SCHEDULER DEBUG - Step 5: Solving model")
            # Step 5: Solve the model
            solver_result = self._solve_model()
            
            print(f"🔍 SCHEDULER DEBUG - Step 6: Solver status: {solver_result['status']}")
            
            # Step 6: Extract and format results
            if solver_result['status'] == 'NO_SOLUTION':
                # Try to find partial solutions (fewer sessions)
                return self._try_partial_solutions(client_id, start_time, scheduling_data, num_sessions)
            
            suggestions = self._extract_suggestions(scheduling_data, solver_result)
            
            solve_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return SchedulingResult(
                client_id=client_id,
                suggested_slots=suggestions,
                total_suggestions=len(suggestions),
                solver_status=solver_result['status'],
                solve_time_ms=int(solve_time),
                confidence_score=solver_result['confidence'],
                constraints_satisfied=self.constraint_explanations,
                reasons=self._generate_reasons(suggestions, scheduling_data, client_id)
            )
            
        except Exception as e:
            solve_time = (datetime.now() - start_time).total_seconds() * 1000
            return self._create_error_result(client_id, str(e), int(solve_time))
    
    def _gather_scheduling_data(
        self, 
        client_id: int, 
        preferred_date: Optional[datetime],
        days_flexibility: int
    ) -> Dict[str, Any]:
        """
        Gather all necessary data for scheduling optimization
        
        This includes:
        - Available time slots
        - Client preferences and plan
        - Coach availability and workload
        - Existing bookings and constraints
        """
        # Calculate time window
        start_date = preferred_date or datetime.now()
        end_date = start_date + timedelta(days=days_flexibility)
        
        # Get client data
        client_plan = schedule_crud.get_client_plan(self.db, client_id)
        client_preference = schedule_crud.get_client_preference(self.db, client_id)
        
        print(f"🔍 SCHEDULER DEBUG - Client {client_id}:")
        print(f"  - Client plan found: {client_plan is not None}")
        if client_plan:
            print(f"  - Assigned coach ID: {client_plan.assigned_coach_id}")
        print(f"  - Date range: {start_date.date()} to {end_date.date()}")
        
        if not client_plan:
            raise ValueError(f"No plan found for client {client_id}")
        
        # Get available slots for the client's assigned coach
        available_slots = schedule_crud.get_available_slots_for_client(
            self.db, client_id, start_date
        )
        
        print(f"  - Available slots found: {len(available_slots)}")
        if len(available_slots) > 0:
            print(f"  - Sample slots:")
            for i, slot in enumerate(available_slots[:3]):
                print(f"    {i+1}. Slot ID: {slot.id}, Coach: {getattr(slot, 'coach_id', 'N/A')}, Day: {getattr(slot, 'day_of_week', 'N/A')}, Hour: {getattr(slot, 'start_hour', 'N/A')}")
        else:
            print(f"  - No available slots found for coach {client_plan.assigned_coach_id}")
            print(f"  - This explains why 0 suggestions are returned!")
        
        # Get existing bookings for this client (for recovery constraint)
        existing_bookings = self._get_client_recent_bookings(client_id, start_date)
        
        # Get coach workload data for load balancing
        coach_workload = self._get_coach_workload_data(client_plan.assigned_coach_id, start_date, end_date)
        
        return {
            'client_id': client_id,
            'client_plan': client_plan,
            'client_preference': client_preference,
            'available_slots': available_slots,
            'existing_bookings': existing_bookings,
            'coach_workload': coach_workload,
            'time_window': (start_date, end_date),
            'planning_horizon': days_flexibility
        }
    
    def _create_model(self, scheduling_data: Dict[str, Any], num_sessions: int):
        """Create the CP-SAT model with decision variables"""
        self.model = cp_model.CpModel()
        self.variables = {}
        
        available_slots = scheduling_data['available_slots']
        
        # Create binary decision variables: x[slot_id] = 1 if slot is selected, 0 otherwise
        for slot in available_slots:
            var_name = f"select_slot_{slot.id}"
            self.variables[slot.id] = self.model.NewBoolVar(var_name)
        
        # Constraint: Select exactly num_sessions slots
        print(f"🔍 CONSTRAINT DEBUG - Must select exactly {num_sessions} sessions from {len(available_slots)} available slots")
        self.model.Add(
            sum(self.variables[slot.id] for slot in available_slots) == num_sessions
        )
        
    def _add_capacity_constraints(self, scheduling_data: Dict[str, Any]):
        """Add constraints to ensure slots don't exceed capacity"""
        # This is handled by get_available_slots_for_client() - only returns slots with available capacity
        # So we don't need additional capacity constraints here
        self.constraint_explanations.append("Capacity constraints: Only considering slots with available space")
        
    def _add_recovery_constraints(self, scheduling_data: Dict[str, Any], client_id: int):
        """Add constraints for minimum recovery time between sessions"""
        available_slots = scheduling_data['available_slots']
        existing_bookings = scheduling_data['existing_bookings']
        current_time = datetime.now()
        
        print(f"🔍 CONSTRAINT DEBUG - Recovery: Found {len(existing_bookings)} existing bookings")
        
        recovery_excluded_count = 0
        # Constraint 1: New sessions must maintain min_recovery_hours from ALL existing bookings
        # (both past and future within scheduling window)
        
        for booking in existing_bookings:
            # Apply recovery constraint to all bookings within reasonable time range
            # Skip only very old bookings (more than 7 days ago)
            days_old = (current_time - booking.date).days
            if days_old > 7:
                print(f"🔍 CONSTRAINT DEBUG - Skipping very old booking: {booking.date} ({days_old} days ago)")
                continue
                
            # For each booking, calculate the time windows where new sessions cannot be scheduled
            booking_start = booking.date
            booking_end = booking.date + timedelta(hours=1)  # Assume 1-hour sessions
            
            # No new sessions can be scheduled in these time windows:
            # 1. min_recovery_hours BEFORE the existing booking
            # 2. min_recovery_hours AFTER the existing booking
            forbidden_start = booking_start - timedelta(hours=self.min_recovery_hours)
            forbidden_end = booking_end + timedelta(hours=self.min_recovery_hours)
            
            print(f"🔍 CONSTRAINT DEBUG - Booking: {booking.date}, Forbidden window: {forbidden_start} to {forbidden_end}")
            
            for slot in available_slots:
                # Calculate the actual datetime for this slot (consistent with current time constraint logic)
                start_date = scheduling_data['time_window'][0]
                current_time = datetime.now()
                
                # Find next occurrence of this weekday
                days_until_slot = (slot.day_of_week - start_date.weekday()) % 7
                
                # If it's the same day, check if hour has passed
                if days_until_slot == 0:
                    slot_time_today = start_date.replace(hour=slot.start_hour, minute=0, second=0, microsecond=0)
                    if slot_time_today <= current_time:
                        # Hour has passed today, go to next week
                        days_until_slot = 7
                
                slot_date = start_date.date() + timedelta(days=days_until_slot)
                slot_datetime = datetime.combine(slot_date, datetime.min.time()) + timedelta(hours=slot.start_hour)
                
                # Check if this slot falls within the forbidden time window
                if forbidden_start <= slot_datetime <= forbidden_end:
                    # This slot violates recovery constraint
                    self.model.Add(self.variables[slot.id] == 0)
                    recovery_excluded_count += 1
                    if recovery_excluded_count <= 5:  # Show fewer for cleaner output
                        print(f"🔍 CONSTRAINT DEBUG - Excluded slot {slot.id} (Day {slot.day_of_week}, Hour {slot.start_hour}): {slot_datetime} conflicts with booking at {booking.date}")
                elif slot_datetime.date() == datetime(2025, 10, 24).date():  # Debug actual Oct 24 slots
                    print(f"🔍 CONSTRAINT DEBUG - Oct 24 slot {slot.id} (Day {slot.day_of_week}, Hour {slot.start_hour}): {slot_datetime} - Available")
        
        print(f"🔍 CONSTRAINT DEBUG - Recovery constraint excluded {recovery_excluded_count} slots")
        
        # Constraint 2: NEW SESSIONS must be at least min_recovery_hours apart from each other
        # This is the critical missing constraint that was causing the 3 continuous sessions bug
        for i, slot1 in enumerate(available_slots):
            for j, slot2 in enumerate(available_slots):
                if i >= j:  # Only check each pair once
                    continue
                
                # Calculate datetime for both slots
                slot1_datetime = scheduling_data['time_window'][0] + timedelta(
                    days=slot1.day_of_week,
                    hours=slot1.start_hour
                )
                slot2_datetime = scheduling_data['time_window'][0] + timedelta(
                    days=slot2.day_of_week,
                    hours=slot2.start_hour
                )
                
                # Check if slots are too close (less than min_recovery_hours apart)
                time_diff = abs((slot2_datetime - slot1_datetime).total_seconds() / 3600)  # Convert to hours
                
                if time_diff < self.min_recovery_hours:
                    # These slots are too close - can't select both
                    # Add constraint: if one is selected, the other cannot be selected
                    self.model.Add(self.variables[slot1.id] + self.variables[slot2.id] <= 1)
        
        self.constraint_explanations.append(f"Recovery constraint: {self.min_recovery_hours}h minimum between sessions (including newly scheduled sessions)")
        
    def _add_coach_availability_constraints(self, scheduling_data: Dict[str, Any]):
        """Add constraints for coach shift hours and existing commitments"""
        # This is handled by get_available_slots_for_client() - only returns slots during coach shifts
        # and without conflicting bookings
        self.constraint_explanations.append("Coach availability: Only considering slots during coach shifts")
        
    def _add_current_time_constraints(self, scheduling_data: Dict[str, Any]):
        """Add constraints to prevent scheduling sessions in the past"""
        available_slots = scheduling_data['available_slots']
        current_time = datetime.now()
        
        print(f"🔍 CONSTRAINT DEBUG - Current time: {current_time}")
        print(f"🔍 CONSTRAINT DEBUG - Start date: {scheduling_data['time_window'][0]}")
        
        # Don't suggest slots that have already passed
        excluded_count = 0
        for slot in available_slots:
            # Calculate the actual datetime for this slot
            # We need to find the next occurrence of this day_of_week and hour
            start_date = scheduling_data['time_window'][0]
            
            # Find next occurrence of this weekday
            days_until_slot = (slot.day_of_week - start_date.weekday()) % 7
            
            # If it's the same day, check if hour has passed
            if days_until_slot == 0:
                slot_time_today = start_date.replace(hour=slot.start_hour, minute=0, second=0, microsecond=0)
                if slot_time_today <= current_time:
                    # Hour has passed today, go to next week
                    days_until_slot = 7
            
            slot_date = start_date.date() + timedelta(days=days_until_slot)
            slot_datetime = datetime.combine(slot_date, datetime.min.time()) + timedelta(hours=slot.start_hour)
            
            # If slot time has already passed, exclude it
            if slot_datetime <= current_time:
                self.model.Add(self.variables[slot.id] == 0)
                excluded_count += 1
                if excluded_count <= 3:  # Only show first few for debugging
                    print(f"🔍 CONSTRAINT DEBUG - Excluded slot {slot.id} (Day {slot.day_of_week}, Hour {slot.start_hour}): {slot_datetime} <= {current_time}")
        
        print(f"🔍 CONSTRAINT DEBUG - Current time constraint excluded {excluded_count} out of {len(available_slots)} slots")
        self.constraint_explanations.append(f"Current time constraint: Excluded {excluded_count} past time slots")
        
    def _add_weekly_quota_constraints(self, scheduling_data: Dict[str, Any], client_id: int):
        """Add constraints for weekly session limits based on client plan"""
        available_slots = scheduling_data['available_slots']
        client_plan = scheduling_data['client_plan']
        existing_bookings = scheduling_data['existing_bookings']
        
        weekly_limit = getattr(client_plan, 'sessions_per_week', 3)  # Default to 3 if not set
        print(f"🔍 CONSTRAINT DEBUG - Weekly quota: {weekly_limit} sessions per week allowed")
        
        # Calculate current week's bookings
        start_date = scheduling_data['time_window'][0]
        week_start = start_date - timedelta(days=start_date.weekday())  # Monday of this week
        week_end = week_start + timedelta(days=7)
        
        current_week_bookings = 0
        for booking in existing_bookings:
            if week_start <= booking.date < week_end:
                current_week_bookings += 1
        
        print(f"🔍 CONSTRAINT DEBUG - Current week bookings: {current_week_bookings}/{weekly_limit}")
        
        # Check if we can book any more sessions this week
        remaining_quota = weekly_limit - current_week_bookings
        
        if remaining_quota <= 0:
            # Already at weekly limit - exclude all slots
            excluded_count = 0
            for slot in available_slots:
                self.model.Add(self.variables[slot.id] == 0)
                excluded_count += 1
            
            print(f"🔍 CONSTRAINT DEBUG - Weekly quota exceeded: excluded all {excluded_count} slots")
            self.constraint_explanations.append(f"Weekly quota constraint: Already used {current_week_bookings}/{weekly_limit} sessions this week")
        else:
            # Can book some sessions, but limit new bookings to remaining quota
            # Note: This is automatically handled by the "select exactly N sessions" constraint
            # But we need to ensure N doesn't exceed remaining quota
            print(f"🔍 CONSTRAINT DEBUG - Weekly quota allows {remaining_quota} more sessions this week")
            self.constraint_explanations.append(f"Weekly quota constraint: {remaining_quota} sessions remaining this week ({current_week_bookings}/{weekly_limit} used)")
        
    def _add_excluded_slots_constraints(self, scheduling_data: Dict[str, Any], excluded_slot_ids: List[int]):
        """Exclude specific slots from being selected (for re-suggestions)"""
        if not excluded_slot_ids:
            return
            
        available_slots = scheduling_data['available_slots']
        excluded_count = 0
        
        for slot in available_slots:
            if slot.id in excluded_slot_ids:
                # Force this slot to NOT be selected
                self.model.Add(self.variables[slot.id] == 0)
                excluded_count += 1
                print(f"🔍 CONSTRAINT DEBUG - Excluded slot {slot.id} (Day {slot.day_of_week}, Hour {slot.start_hour}) for re-suggestion")
        
        print(f"🔍 CONSTRAINT DEBUG - Re-suggestion excluded {excluded_count} previously suggested slots")
        if excluded_count > 0:
            self.constraint_explanations.append(f"Re-suggestion constraint: Excluded {excluded_count} previously suggested time slots to find alternatives")
        
    def _add_preference_constraints(self, scheduling_data: Dict[str, Any], client_id: int):
        """Add soft constraints and scoring for client preferences"""
        client_preference = scheduling_data['client_preference']
        if not client_preference:
            return
        
        # We'll handle preferences in the objective function rather than hard constraints
        # This allows the solver to find solutions even if perfect preferences aren't available
        self.constraint_explanations.append("Preference optimization: Prioritizing preferred time slots")
        
    def _define_objective(self, scheduling_data: Dict[str, Any], client_id: int):
        """Define the objective function to maximize scheduling quality"""
        available_slots = scheduling_data['available_slots']
        client_preference = scheduling_data['client_preference']
        
        objective_terms = []
        
        # Preference matching score
        if client_preference and client_preference.preferred_start_hour is not None:
            pref_start = client_preference.preferred_start_hour
            pref_end = client_preference.preferred_end_hour
            
            for slot in available_slots:
                if pref_start <= slot.start_hour <= pref_end:
                    # Perfect preference match
                    objective_terms.append(
                        self.variables[slot.id] * int(self.weights.preference_match * 100)
                    )
                elif (slot.start_hour == pref_start - 1 or 
                      slot.start_hour == pref_end + 1):
                    # Close preference match
                    objective_terms.append(
                        self.variables[slot.id] * int(self.weights.preference_match * 50)
                    )
        
        # Load balancing - prefer slots that help balance coach workload
        coach_workload = scheduling_data['coach_workload']
        avg_workload = sum(coach_workload.values()) / len(coach_workload) if coach_workload else 0
        
        for slot in available_slots:
            coach_id = slot.coach_id
            if coach_id in coach_workload:
                workload_diff = avg_workload - coach_workload[coach_id]
                if workload_diff > 0:  # This coach has below-average workload
                    objective_terms.append(
                        self.variables[slot.id] * int(self.weights.coach_load_balance * workload_diff * 10)
                    )
        
        # Date preference - prefer earlier dates (higher weight for sooner dates)
        start_date = scheduling_data['time_window'][0]
        current_time = datetime.now()
        
        for slot in available_slots:
            # Calculate slot datetime
            days_until_slot = (slot.day_of_week - start_date.weekday()) % 7
            if days_until_slot == 0:
                slot_time_today = start_date.replace(hour=slot.start_hour, minute=0, second=0, microsecond=0)
                if slot_time_today <= current_time:
                    days_until_slot = 7
            
            slot_date = start_date.date() + timedelta(days=days_until_slot)
            
            # Give higher score to earlier dates (max 7 days preference)
            days_from_start = (slot_date - start_date.date()).days
            date_score = max(0, 7 - days_from_start) * 20  # Earlier dates get higher scores
            
            objective_terms.append(
                self.variables[slot.id] * date_score
            )
        
        # Set objective to maximize total score
        if objective_terms:
            self.model.Maximize(sum(objective_terms))
        else:
            # Fallback: just select any valid solution
            self.model.Maximize(sum(self.variables[slot.id] for slot in available_slots))
    
    def _solve_model(self) -> Dict[str, Any]:
        """Solve the CP-SAT model and return results"""
        self.solver = cp_model.CpSolver()
        
        # Set solver parameters
        self.solver.parameters.max_time_in_seconds = 10.0  # 10-second timeout
        self.solver.parameters.enumerate_all_solutions = False
        
        # Solve the model
        status = self.solver.Solve(self.model)
        
        # Map status to string
        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE", 
            cp_model.INFEASIBLE: "NO_SOLUTION",
            cp_model.UNKNOWN: "TIMEOUT",
            cp_model.MODEL_INVALID: "INVALID"
        }
        
        confidence = 1.0 if status == cp_model.OPTIMAL else 0.8 if status == cp_model.FEASIBLE else 0.0
        
        return {
            'status': status_map.get(status, "UNKNOWN"),
            'confidence': confidence,
            'objective_value': self.solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else 0,
            'solve_time': self.solver.WallTime()
        }
    
    def _extract_suggestions(
        self, 
        scheduling_data: Dict[str, Any], 
        solver_result: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract selected slots from solver solution"""
        if solver_result['status'] in ['NO_SOLUTION', 'INVALID']:
            return []
        
        available_slots = scheduling_data['available_slots']
        suggestions = []
        
        for slot in available_slots:
            if self.solver.Value(self.variables[slot.id]) == 1:
                # This slot was selected by the solver
                coach = self.db.query(User).filter(User.id == slot.coach_id).first()
                
                # Calculate suggestion date correctly (same logic as constraint checking)
                base_date = scheduling_data['time_window'][0]
                days_until_slot = (slot.day_of_week - base_date.weekday()) % 7
                if days_until_slot == 0 and base_date.hour > slot.start_hour:
                    # If it's the same day but hour has passed, go to next week
                    days_until_slot = 7
                suggestion_date = base_date.date() + timedelta(days=days_until_slot)
                
                suggestion = {
                    'slot_id': slot.id,
                    'coach_id': slot.coach_id,
                    'coach_name': f"{coach.first_name} {coach.last_name}" if coach else "Unknown Coach",
                    'day_of_week': slot.day_of_week,
                    'hour': slot.start_hour,
                    'date_suggestion': suggestion_date.isoformat(),
                    'confidence_score': solver_result['confidence'] * 100,  # Convert to percentage for display
                    'capacity_available': slot.capacity,
                    'optimization_score': int(self.solver.ObjectiveValue()) if solver_result['objective_value'] else 0
                }
                suggestions.append(suggestion)
                print(f"🔍 SUGGESTION DEBUG - Added suggestion: {suggestion_date} {slot.start_hour}:00, confidence: {solver_result['confidence'] * 100}%")
        
        print(f"🔍 SUGGESTION DEBUG - Total suggestions extracted: {len(suggestions)}")
        
        # Sort by preference match and time
        suggestions.sort(key=lambda x: (x['hour'], x['day_of_week']))
        
        return suggestions[:self.max_suggestions]
    
    def _generate_reasons(
        self, 
        suggestions: List[Dict[str, Any]], 
        scheduling_data: Dict[str, Any], 
        client_id: int
    ) -> List[SuggestionReason]:
        """Generate human-readable reasons for the suggestions"""
        reasons = []
        client_preference = scheduling_data['client_preference']
        
        if not suggestions:
            reasons.append(SuggestionReason.ONLY_OPTION)
            return reasons
        
        # Analyze suggestions for reasons
        for suggestion in suggestions:
            hour = suggestion['hour']
            
            if client_preference and client_preference.preferred_start_hour is not None:
                pref_start = client_preference.preferred_start_hour
                pref_end = client_preference.preferred_end_hour
                
                if pref_start <= hour <= pref_end:
                    reasons.append(SuggestionReason.PERFECT_PREFERENCE_MATCH)
                elif hour == pref_start - 1 or hour == pref_end + 1:
                    reasons.append(SuggestionReason.GOOD_PREFERENCE_MATCH)
            
            reasons.append(SuggestionReason.COACH_AVAILABILITY)
            reasons.append(SuggestionReason.CAPACITY_AVAILABLE)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_reasons = []
        for reason in reasons:
            if reason not in seen:
                seen.add(reason)
                unique_reasons.append(reason)
        
        return unique_reasons
    
    def _get_client_recent_bookings(self, client_id: int, since_date: datetime) -> List[Booking]:
        """Get recent bookings for recovery constraint calculation"""
        cutoff_date = since_date - timedelta(days=7)  # Look back 7 days
        
        return self.db.query(Booking).filter(
            Booking.client_id == client_id,
            Booking.date >= cutoff_date,
            Booking.status != "cancelled"
        ).all()
    
    def _get_coach_workload_data(
        self, 
        coach_id: int, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[int, float]:
        """Get coach workload data for load balancing"""
        # Count bookings per coach in the time window
        from sqlalchemy import func
        
        workload_query = self.db.query(
            Booking.coach_id,
            func.count(Booking.id).label('booking_count')
        ).filter(
            Booking.date >= start_date,
            Booking.date <= end_date,
            Booking.status != "cancelled"
        ).group_by(Booking.coach_id)
        
        workload_data = {coach_id: float(count) for coach_id, count in workload_query.all()}
        
        # Ensure the assigned coach is in the data
        if coach_id not in workload_data:
            workload_data[coach_id] = 0.0
            
        return workload_data
    
    def _count_current_week_bookings(self, scheduling_data: Dict[str, Any]) -> int:
        """Count bookings for the current week"""
        existing_bookings = scheduling_data['existing_bookings']
        start_date = scheduling_data['time_window'][0]
        week_start = start_date - timedelta(days=start_date.weekday())  # Monday of this week
        week_end = week_start + timedelta(days=7)
        
        print(f"🔍 WEEK DEBUG - Start date: {start_date}")
        print(f"🔍 WEEK DEBUG - Week start: {week_start}, Week end: {week_end}")
        print(f"🔍 WEEK DEBUG - Total existing bookings: {len(existing_bookings)}")
        
        current_week_bookings = 0
        for booking in existing_bookings:
            print(f"🔍 WEEK DEBUG - Booking date: {booking.date}, in current week: {week_start <= booking.date < week_end}")
            if week_start <= booking.date < week_end:
                current_week_bookings += 1
                
        print(f"🔍 WEEK DEBUG - Current week bookings count: {current_week_bookings}")
        return current_week_bookings
    
    def _generate_week_status_message(self, client_id: int, scheduling_data: Dict[str, Any]) -> str:
        """Generate user-friendly week status message"""
        # Current week info
        weekly_limit = getattr(scheduling_data['client_plan'], 'sessions_per_week', 3)
        current_week_bookings = self._count_current_week_bookings(scheduling_data)
        current_week_remaining = weekly_limit - current_week_bookings
        
        # Next week info
        next_week_bookings = self._count_next_week_bookings(client_id, scheduling_data)
        next_week_remaining = weekly_limit - next_week_bookings
        
        # Generate messages
        messages = []
        
        # Current week status
        if current_week_remaining > 0:
            messages.append(f"📅 This Week: You have {current_week_remaining} session(s) left to finish your weekly goal.")
        else:
            messages.append(f"📅 This Week: Complete! You've booked all {weekly_limit}/{weekly_limit} sessions for this week.")
        
        # Next week status
        if next_week_bookings == 0:
            messages.append(f"📅 Next Week: Available - you can book up to {weekly_limit} sessions.")
        elif next_week_remaining > 0:
            messages.append(f"📅 Next Week: You have {next_week_bookings}/{weekly_limit} sessions booked, {next_week_remaining} slot(s) remaining.")
        else:
            messages.append(f"📅 Next Week: Full - you already booked all {weekly_limit}/{weekly_limit} sessions.")
        
        return " ".join(messages)
    
    def _count_next_week_bookings(self, client_id: int, scheduling_data: Dict[str, Any]) -> int:
        """Count bookings for next week"""
        start_date = scheduling_data['time_window'][0]
        current_week_start = start_date - timedelta(days=start_date.weekday())  # Monday of current week
        next_week_start = current_week_start + timedelta(days=7)  # Monday of next week
        next_week_end = next_week_start + timedelta(days=7)  # Monday of week after next
        
        next_week_bookings = 0
        existing_bookings = scheduling_data['existing_bookings']
        
        for booking in existing_bookings:
            if next_week_start <= booking.date < next_week_end:
                next_week_bookings += 1
                
        return next_week_bookings
    
    def _create_quota_exceeded_result(self, client_id: int, start_time: datetime, weekly_limit: int, current_bookings: int) -> SchedulingResult:
        """Create result when weekly quota is exceeded"""
        solve_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Generate comprehensive week status message
        # We need to reconstruct some scheduling data for the message
        from app.crud.schedule import get_client_plan
        
        client_plan = get_client_plan(self.db, client_id)
        if not client_plan:
            error_msg = f"❌ Weekly session limit reached: You've already booked {current_bookings}/{weekly_limit} sessions this week."
        else:
            # Get bookings for context
            today = datetime.now()
            start_date = today - timedelta(days=14)  # 2 weeks back
            bookings = self._get_client_recent_bookings(client_id, start_date)
            
            # Create minimal scheduling data for message generation
            temp_scheduling_data = {
                'client_plan': client_plan,
                'existing_bookings': bookings,
                'time_window': [datetime.combine(today.date(), datetime.min.time())]
            }
            
            week_status_msg = self._generate_week_status_message(client_id, temp_scheduling_data)
            error_msg = f"❌ Cannot book more sessions this week. {week_status_msg}"
        
        return SchedulingResult(
            client_id=client_id,
            suggested_slots=[],
            total_suggestions=0,
            solver_status="WEEKLY_QUOTA_EXCEEDED",
            solve_time_ms=int(solve_time),
            confidence_score=0.0,
            constraints_satisfied=[error_msg],
            reasons=[SuggestionReason.ONLY_OPTION]
        )
    
    def _create_no_availability_result(self, client_id: int, start_time: datetime) -> SchedulingResult:
        """Create result when no slots are available"""
        solve_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return SchedulingResult(
            client_id=client_id,
            suggested_slots=[],
            total_suggestions=0,
            solver_status="NO_AVAILABILITY",
            solve_time_ms=int(solve_time),
            confidence_score=0.0,
            constraints_satisfied=["No available slots found"],
            reasons=[SuggestionReason.ONLY_OPTION]
        )
    
    def _create_no_solution_result(self, client_id: int, start_time: datetime, scheduling_data: Dict[str, Any], num_sessions: int) -> SchedulingResult:
        """Create result with detailed explanation when solver finds no solution"""
        solve_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Analyze why no solution was found
        available_slots_count = len(scheduling_data['available_slots'])
        existing_bookings_count = len(scheduling_data['existing_bookings'])
        
        # Create user-friendly error message
        if existing_bookings_count > 0:
            next_booking = min(scheduling_data['existing_bookings'], key=lambda b: b.date)
            recovery_date = next_booking.date + timedelta(hours=25)  # 24h + 1h session
            
            error_msg = f"Cannot find {num_sessions} available sessions due to recovery constraints. " \
                       f"You have {existing_bookings_count} recent booking(s). " \
                       f"Next available booking time: {recovery_date.strftime('%Y-%m-%d %H:%M')} " \
                       f"(24-hour recovery period required between sessions)."
        else:
            error_msg = f"Cannot find {num_sessions} sessions that satisfy all constraints. " \
                       f"Found {available_slots_count} available slots, but constraints prevent valid combinations."
        
        return SchedulingResult(
            client_id=client_id,
            suggested_slots=[],
            total_suggestions=0,
            solver_status="NO_SOLUTION",
            solve_time_ms=int(solve_time),
            confidence_score=0.0,
            constraints_satisfied=[error_msg] + self.constraint_explanations,
            reasons=[SuggestionReason.ONLY_OPTION]
        )
    
    def _try_partial_solutions(self, client_id: int, start_time: datetime, scheduling_data: Dict[str, Any], original_sessions: int) -> SchedulingResult:
        """Try to find partial solutions when the original request fails"""
        print(f"🔍 PARTIAL SOLUTION - Original request for {original_sessions} sessions failed, trying fewer...")
        
        # Try reducing the number of sessions (from original-1 down to 1)
        for num_sessions in range(original_sessions - 1, 0, -1):
            print(f"🔍 PARTIAL SOLUTION - Trying {num_sessions} session(s)...")
            
            try:
                # Reset model and constraints for new attempt
                self.constraint_explanations = []
                self._create_model(scheduling_data, num_sessions)
                
                # Add constraints
                self._add_capacity_constraints(scheduling_data)
                self._add_recovery_constraints(scheduling_data, client_id)
                self._add_coach_availability_constraints(scheduling_data)
                self._add_current_time_constraints(scheduling_data)
                self._add_preference_constraints(scheduling_data, client_id)
                
                # Define objective
                self._define_objective(scheduling_data, client_id)
                
                # Solve
                solver_result = self._solve_model()
                
                if solver_result['status'] == 'OPTIMAL' or solver_result['status'] == 'FEASIBLE':
                    # Found partial solution!
                    suggestions = self._extract_suggestions(scheduling_data, solver_result)
                    solve_time = (datetime.now() - start_time).total_seconds() * 1000
                    
                    # Create warning message
                    warning_msg = f"⚠️ Could only find {num_sessions} session(s) instead of {original_sessions}. "
                    warning_msg += self._analyze_constraint_failures(scheduling_data, original_sessions, num_sessions)
                    
                    return SchedulingResult(
                        client_id=client_id,
                        suggested_slots=suggestions,
                        total_suggestions=len(suggestions),
                        solver_status=f"PARTIAL_SOLUTION_{num_sessions}",
                        solve_time_ms=int(solve_time),
                        confidence_score=solver_result['confidence'] * (num_sessions / original_sessions),  # Reduce confidence
                        constraints_satisfied=[warning_msg] + self.constraint_explanations,
                        reasons=self._generate_reasons(suggestions, scheduling_data, client_id)
                    )
                    
            except Exception as e:
                print(f"🔍 PARTIAL SOLUTION - Error trying {num_sessions} sessions: {e}")
                continue
        
        # No partial solutions found, return detailed analysis
        return self._create_detailed_failure_analysis(client_id, start_time, scheduling_data, original_sessions)
    
    def _analyze_constraint_failures(self, scheduling_data: Dict[str, Any], requested: int, found: int) -> str:
        """Analyze why we couldn't find the full number of requested sessions"""
        available_slots_count = len(scheduling_data['available_slots'])
        existing_bookings_count = len(scheduling_data['existing_bookings'])
        client_preference = scheduling_data['client_preference']
        
        reasons = []
        
        # Check recovery constraints
        if existing_bookings_count > 0:
            reasons.append(f"Recovery constraints from {existing_bookings_count} existing booking(s)")
        
        # Check preference constraints
        if client_preference and client_preference.preferred_start_hour is not None:
            pref_start = getattr(client_preference, 'preferred_start_hour')
            pref_end = getattr(client_preference, 'preferred_end_hour')
            is_flexible = getattr(client_preference, 'is_flexible', True)
            
            # Count slots that match preferences
            matching_slots = 0
            for slot in scheduling_data['available_slots']:
                slot_hour = getattr(slot, 'start_hour')
                if is_flexible:
                    if pref_start - 1 <= slot_hour <= pref_end + 1:
                        matching_slots += 1
                else:
                    if pref_start <= slot_hour <= pref_end:
                        matching_slots += 1
            
            if matching_slots < requested:
                flexibility_text = "flexible" if is_flexible else "strict"
                reasons.append(f"Preference constraints ({flexibility_text} hours {pref_start}-{pref_end}): only {matching_slots} matching slots")
        
        if reasons:
            return "Reasons: " + "; ".join(reasons) + "."
        else:
            return "Multiple constraints are limiting available combinations."
    
    def _create_detailed_failure_analysis(self, client_id: int, start_time: datetime, scheduling_data: Dict[str, Any], num_sessions: int) -> SchedulingResult:
        """Create detailed analysis when no solutions are possible"""
        solve_time = (datetime.now() - start_time).total_seconds() * 1000
        
        available_slots_count = len(scheduling_data['available_slots'])
        existing_bookings_count = len(scheduling_data['existing_bookings'])
        client_preference = scheduling_data['client_preference']
        
        # Detailed error analysis
        error_messages = []
        
        # 1. Check if no slots at all
        if available_slots_count == 0:
            error_messages.append("❌ No available time slots found for your assigned coach.")
        
        # 2. Check weekly quota constraints FIRST (highest priority)
        weekly_limit = getattr(scheduling_data['client_plan'], 'sessions_per_week', 3)
        current_week_bookings = self._count_current_week_bookings(scheduling_data)
        if current_week_bookings >= weekly_limit:
            week_status_msg = self._generate_week_status_message(client_id, scheduling_data)
            error_messages.append(f"❌ Weekly quota reached. {week_status_msg}")
        elif current_week_bookings + num_sessions > weekly_limit:
            week_status_msg = self._generate_week_status_message(client_id, scheduling_data)
            error_messages.append(f"❌ Weekly quota would be exceeded. {week_status_msg}")
        
        # 3. Check recovery constraints (only if not a quota issue)
        elif existing_bookings_count > 0:
            next_booking = min(scheduling_data['existing_bookings'], key=lambda b: b.date)
            recovery_date = next_booking.date + timedelta(hours=25)
            error_messages.append(f"❌ Recovery constraint: You have {existing_bookings_count} recent booking(s). Next available time: {recovery_date.strftime('%Y-%m-%d %H:%M')} (24-hour recovery required).")
        
        # 4. Check preference constraints
        if client_preference and client_preference.preferred_start_hour is not None:
            pref_start = getattr(client_preference, 'preferred_start_hour')
            pref_end = getattr(client_preference, 'preferred_end_hour')
            is_flexible = getattr(client_preference, 'is_flexible', True)
            
            # Get coach working hours
            coach_hours = []
            for slot in scheduling_data['available_slots']:
                coach_hours.append(getattr(slot, 'start_hour'))
            
            if coach_hours:
                coach_min_hour = min(coach_hours)
                coach_max_hour = max(coach_hours)
                
                # Check for preference-coach mismatch
                if not is_flexible and (pref_end < coach_min_hour or pref_start > coach_max_hour):
                    error_messages.append(f"❌ Preference mismatch: Your preferred hours ({pref_start}-{pref_end}) don't overlap with your coach's working hours ({coach_min_hour}-{coach_max_hour}). Consider making your preferences flexible.")
                elif not is_flexible:
                    overlap_start = max(pref_start, coach_min_hour)
                    overlap_end = min(pref_end, coach_max_hour)
                    if overlap_end - overlap_start < num_sessions:
                        error_messages.append(f"❌ Insufficient overlap: Your strict preferences ({pref_start}-{pref_end}) have limited overlap with coach hours ({coach_min_hour}-{coach_max_hour}). Consider flexible preferences.")
        
        # 4. If no specific issues found, general message
        if not error_messages:
            error_messages.append(f"❌ Cannot find {num_sessions} sessions that satisfy all scheduling constraints.")
        
        main_error = "\n".join(error_messages)
        
        return SchedulingResult(
            client_id=client_id,
            suggested_slots=[],
            total_suggestions=0,
            solver_status="NO_SOLUTION_DETAILED",
            solve_time_ms=int(solve_time),
            confidence_score=0.0,
            constraints_satisfied=[main_error] + self.constraint_explanations,
            reasons=[SuggestionReason.ONLY_OPTION]
        )
    
    def _create_error_result(self, client_id: int, error_msg: str, solve_time: int) -> SchedulingResult:
        """Create result when an error occurs"""
        return SchedulingResult(
            client_id=client_id,
            suggested_slots=[],
            total_suggestions=0,
            solver_status=f"ERROR: {error_msg}",
            solve_time_ms=solve_time,
            confidence_score=0.0,
            constraints_satisfied=[f"Error: {error_msg}"],
            reasons=[SuggestionReason.ONLY_OPTION]
        )


# Utility class for explaining scheduling decisions
class SlotExplainer:
    """
    Provides human-readable explanations for why specific slots were suggested or rejected
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def explain_suggestion(
        self, 
        slot_id: int, 
        client_id: int, 
        scheduling_result: SchedulingResult
    ) -> Dict[str, Any]:
        """
        Provide detailed explanation for why a specific slot was suggested
        """
        slot = self.db.query(ScheduleSlot).filter(ScheduleSlot.id == slot_id).first()
        if not slot:
            return {"error": "Slot not found"}
        
        client_preference = schedule_crud.get_client_preference(self.db, client_id)
        
        explanation = {
            'slot_id': slot_id,
            'slot_details': {
                'day_of_week': slot.day_of_week,
                'start_hour': slot.start_hour,
                'coach_id': slot.coach_id,
                'capacity': slot.capacity
            },
            'reasons': [],
            'preference_analysis': {},
            'constraints_met': [],
            'optimization_factors': []
        }
        
        # Analyze preference matching
        if client_preference and client_preference.preferred_start_hour is not None:
            pref_start = client_preference.preferred_start_hour
            pref_end = client_preference.preferred_end_hour
            # TODO: Fix slot attribute access - may need database query
            # slot_hour = slot.start_hour
            
            # if pref_start <= slot_hour <= pref_end:
            #     explanation['preference_analysis']['match_type'] = "perfect"
            #     explanation['preference_analysis']['message'] = "This slot perfectly matches your preferred time"
            # elif slot_hour == pref_start - 1 or slot_hour == pref_end + 1:
            #     explanation['preference_analysis']['match_type'] = "close"
            #     explanation['preference_analysis']['message'] = "This slot is close to your preferred time"
            # else:
            #     explanation['preference_analysis']['match_type'] = "poor"
            #     explanation['preference_analysis']['message'] = "This slot is outside your preferred time range"
            pass
        
        return explanation
    
    def explain_rejection(self, slot_id: int, client_id: int, constraints: List[str]) -> Dict[str, Any]:
        """
        Explain why a slot was not suggested
        """
        # This would analyze why certain slots were rejected
        # Implementation would check various constraints and provide explanations
        return {
            "slot_id": slot_id,
            "client_id": client_id,
            "rejected_constraints": constraints,
            "message": "Slot rejected due to constraint conflicts"
        }
        pass