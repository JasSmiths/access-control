from __future__ import annotations

import asyncio
from contextlib import suppress
import logging
from datetime import timedelta
from typing import Any, Dict, Optional

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_SCAN_INTERVAL
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import CrestHouseAccessApiClient, CrestHouseAccessApiError
from .const import (
    DEFAULT_SCAN_INTERVAL_MINUTES,
    DOMAIN,
    STREAM_RECONNECT_DELAY_SECONDS,
)

_LOGGER = logging.getLogger(__name__)


class CrestHouseAccessDataUpdateCoordinator(DataUpdateCoordinator[Dict[str, Any]]):
    """Coordinator for Crest House Access API data."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
        self._stream_task: Optional[asyncio.Task] = None
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

    async def async_start_realtime(self) -> None:
        """Start the realtime stream listener."""
        if self._stream_task and not self._stream_task.done():
            return
        self._stream_task = self.hass.async_create_task(self._async_run_stream())

    async def async_stop_realtime(self) -> None:
        """Stop the realtime stream listener."""
        if not self._stream_task:
            return

        self._stream_task.cancel()
        with suppress(asyncio.CancelledError, asyncio.TimeoutError):
            await asyncio.wait_for(self._stream_task, timeout=2)
        self._stream_task = None

    async def _async_handle_snapshot(self, payload: Dict[str, Any]) -> None:
        """Apply a pushed snapshot to the coordinator."""
        self.async_set_updated_data(payload)

    async def _async_run_stream(self) -> None:
        """Maintain a persistent realtime stream."""
        while True:
            try:
                await self.api.async_stream_snapshots(self._async_handle_snapshot)
            except CrestHouseAccessApiError as err:
                _LOGGER.warning("Realtime stream disconnected: %s", err)
            except asyncio.CancelledError:
                raise
            except Exception:  # pragma: no cover - defensive logging
                _LOGGER.exception("Unexpected realtime stream failure")

            await asyncio.sleep(STREAM_RECONNECT_DELAY_SECONDS)
