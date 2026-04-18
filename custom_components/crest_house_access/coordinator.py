from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_SCAN_INTERVAL
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import CrestHouseAccessApiClient, CrestHouseAccessApiError
from .const import DEFAULT_SCAN_INTERVAL_MINUTES, DOMAIN

_LOGGER = logging.getLogger(__name__)


class CrestHouseAccessDataUpdateCoordinator(DataUpdateCoordinator[Dict[str, Any]]):
    """Coordinator for Crest House Access API data."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
        self.api = CrestHouseAccessApiClient(
            async_get_clientsession(hass),
            entry.data["base_url"],
            entry.data["api_key"],
            entry.options.get("verify_ssl", entry.data.get("verify_ssl", True)),
        )

        update_minutes = entry.options.get(
            CONF_SCAN_INTERVAL,
            entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL_MINUTES),
        )

        super().__init__(
            hass,
            logger=_LOGGER,
            name=f"{DOMAIN}_{entry.entry_id}",
            update_interval=timedelta(minutes=update_minutes),
        )

    async def _async_update_data(self) -> Dict[str, Any]:
        try:
            return await self.api.async_get_status()
        except CrestHouseAccessApiError as err:
            raise UpdateFailed(str(err) or "Failed to fetch status") from err
