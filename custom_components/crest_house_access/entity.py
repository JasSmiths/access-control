from __future__ import annotations

from typing import Any, Dict, List, Optional

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


class CrestHouseAccessEntity(CoordinatorEntity):
    """Base entity for Crest House Access."""

    _attr_has_entity_name = True

    @property
    def device_info(self) -> DeviceInfo:
        """Return device metadata."""
        return DeviceInfo(
            identifiers={(DOMAIN, self.coordinator.entry.entry_id)},
            name=self.coordinator.entry.title,
            manufacturer="Crest House",
            model="Access Control System",
            configuration_url=self.coordinator.entry.data["base_url"],
        )


def get_open_sessions(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return the current open sessions list."""
    sessions = data.get("open_sessions", [])
    return sessions if isinstance(sessions, list) else []


def get_recent_events(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return the recent events list."""
    events = data.get("recent_events", [])
    return events if isinstance(events, list) else []


def get_people(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return the active people roster."""
    people = data.get("people", [])
    return people if isinstance(people, list) else []


def get_last_event_by_type(
    data: Dict[str, Any], event_type: str
) -> Optional[Dict[str, Any]]:
    """Return the most recent event of a given type."""
    for event in get_recent_events(data):
        if event.get("event_type") == event_type:
            return event
    return None


def get_on_site_names(data: Dict[str, Any]) -> List[str]:
    """Return sorted names of everybody currently on site."""
    names = [
        str(person.get("contractor_name")).strip()
        for person in get_people(data)
        if person.get("on_site") is True
        and str(person.get("contractor_name") or "").strip()
    ]
    return sorted(names)


def get_off_site_names(data: Dict[str, Any]) -> List[str]:
    """Return sorted names of everybody currently off site."""
    names = [
        str(person.get("contractor_name")).strip()
        for person in get_people(data)
        if person.get("on_site") is False
        and str(person.get("contractor_name") or "").strip()
    ]
    return sorted(names)
