from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select

from nexora.core.config import REPO_ROOT
from nexora.core.ids import utcnow
from nexora.infrastructure.database.models import DailySession, Experiment, XPTransaction
from nexora.modules.challenges.engine import ChallengeError, attempt, build_config, load_challenges
from nexora.modules.daily import engine as daily
from nexora.modules.progression import engine as progression
from nexora.modules.simulations import gradient_descent as gd
from nexora.modules.simulations import infrastructure as infra
from nexora.modules.simulations import neural_network as nn
from nexora.modules.simulations.events import classify
from tests.conftest import correct_answers, master

