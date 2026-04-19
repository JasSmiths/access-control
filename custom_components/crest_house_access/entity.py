from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

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


def get_on_site_people(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return deduplicated on-site people keyed by contractor id."""
    seen: Set[int] = set()
    people: List[Dict[str, Any]] = []

    for session in get_open_sessions(data):
        contractor_id = session.get("contractor_id")
        if not isinstance(contractor_id, int) or contractor_id in seen:
            continue
        seen.add(contractor_id)
        people.append(
            {
                "contractor_id": contractor_id,
                "contractor_name": session.get("contractor_name"),
                "contractor_role": session.get("contractor_role"),
                "started_at": session.get("started_at"),
            }
        )

    return people


def get_person_catalog(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return deduplicated people seen in sessions/events."""
    catalog: Dict[int, Dict[str, Any]] = {}

    for person in get_on_site_people(data):
        contractor_id = person.get("contractor_id")
        if isinstance(contractor_id, int):
            catalog[contractor_id] = person

    for event in get_recent_events(data):
        contractor_id = event.get("contractor_id")
        if not isinstance(contractor_id, int):
            continue
        if contractor_id not in catalog:
            catalog[contractor_id] = {
                "contractor_id": contractor_id,
                "contractor_name": event.get("contractor_name"),
                "contractor_role": event.get("contractor_role"),
            }

    return sorted(
        catalog.values(),
        key=lambda item: str(item.get("contractor_name") or "").lower(),
    )


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
        for person in get_on_site_people(data)
        if str(person.get("contractor_name") or "").strip()
    ]
    return sorted(names)
