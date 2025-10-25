# services/scheduler/__init__.py
# CP-SAT Scheduling Service Package

"""
Intelligent scheduling system using Google OR-Tools CP-SAT solver.

This package provides constraint programming based optimization for 
fitness studio session scheduling with the following capabilities:

- Capacity constraints (max 10 clients per slot)
- Recovery constraints (no consecutive strength training days)
- Client preference matching (time window preferences)
- Load balancing (even distribution across time slots)
- Coach shift compliance (clients assigned to their coach's hours)
- Weekly quota satisfaction (exact sessions per plan type)

Key Components:
- cp_sat_solver.py: Core optimization logic
- constraints.py: Constraint definitions
- objectives.py: Objective function components
- explainer.py: Human-readable explanation generation
"""

from .cp_sat_solver import (
    CPSATScheduler, 
    SchedulingResult, 
    SlotExplainer, 
    SuggestionReason, 
    ConstraintWeights
)

__all__ = [
    'CPSATScheduler',
    'SchedulingResult', 
    'SlotExplainer',
    'SuggestionReason',
    'ConstraintWeights'
]