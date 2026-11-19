"""Engagement API: break challenges, progression, Debug of the Day and verified share cards."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from nexora.api.context import AppContext, get_ctx, get_session, get_student
from nexora.core.errors import bad_request, not_found
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import Achievement, ChallengeAttempt, DailySession, Experiment, Student
from nexora.modules.achievements import rules as achievements
from nexora.modules.challenges import engine as challenges
from nexora.modules.daily import engine as daily
from nexora.modules.learning import engine as learning
from nexora.modules.progression import engine as progression
from nexora.modules.sharing import cards
from nexora.modules.simulations.registry import SIMULATIONS

router = APIRouter()


