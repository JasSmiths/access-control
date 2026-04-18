from __future__ import annotations

from typing import Any, Dict
from urllib.parse import urlparse

from aiohttp import ClientError, ClientResponseError, ClientSession

from .const import COORDINATOR_TIMEOUT_SECONDS


class CrestHouseAccessApiError(Exception):
    """Base API error."""


class CrestHouseAccessCannotConnect(CrestHouseAccessApiError):
    """Raised when the integration cannot connect."""


class CrestHouseAccessInvalidAuth(CrestHouseAccessApiError):
    """Raised when auth is rejected."""


def normalize_base_url(base_url: str) -> str:
    """Validate and normalize a base URL."""
    cleaned = base_url.strip().rstrip("/")
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("invalid_url")
    return cleaned


class CrestHouseAccessApiClient:
    """Small API client for Crest House Access Control."""

    def __init__(
        self,
        session: ClientSession,
        base_url: str,
        api_key: str,
        verify_ssl: bool,
    ) -> None:
        self._session = session
        self._base_url = normalize_base_url(base_url)
        self._api_key = api_key.strip()
        self._verify_ssl = verify_ssl

    async def async_get_status(self) -> Dict[str, Any]:
        """Fetch the Home Assistant status payload."""
        try:
            async with self._session.get(
                f"{self._base_url}/api/v1/status",
                headers={"Authorization": f"Bearer {self._api_key}"},
                ssl=self._verify_ssl,
                timeout=COORDINATOR_TIMEOUT_SECONDS,
            ) as response:
                if response.status == 401:
                    raise CrestHouseAccessInvalidAuth

                response.raise_for_status()
                payload = await response.json()
        except CrestHouseAccessInvalidAuth:
            raise
        except ClientResponseError as err:
            raise CrestHouseAccessCannotConnect from err
        except ClientError as err:
            raise CrestHouseAccessCannotConnect from err

        if not isinstance(payload, dict) or payload.get("ok") is not True:
            raise CrestHouseAccessCannotConnect

        return payload
