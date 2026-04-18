from __future__ import annotations

from datetime import timedelta
from typing import List

from homeassistant.const import Platform

DOMAIN = "crest_house_access"
DEFAULT_NAME = "Crest House Access"
DEFAULT_SCAN_INTERVAL_MINUTES = 1
MIN_SCAN_INTERVAL_MINUTES = 1

PLATFORMS: List[Platform] = [Platform.SENSOR, Platform.BINARY_SENSOR]

COORDINATOR_TIMEOUT_SECONDS = 10
DEFAULT_UPDATE_INTERVAL = timedelta(minutes=DEFAULT_SCAN_INTERVAL_MINUTES)
