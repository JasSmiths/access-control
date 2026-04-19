from __future__ import annotations

from typing import Any, Dict, Set

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import DOMAIN
from .entity import CrestHouseAccessEntity, get_on_site_people, get_person_catalog


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([CrestHouseAccessOccupiedBinarySensor(coordinator)])

    known_people: Set[int] = set()

    @callback
    def _add_person_entities() -> None:
        new_entities = []
        for person in get_person_catalog(coordinator.data):
            contractor_id = person.get("contractor_id")
            if not isinstance(contractor_id, int) or contractor_id in known_people:
                continue
            known_people.add(contractor_id)
            new_entities.append(
                CrestHouseAccessPersonOnSiteBinarySensor(coordinator, person)
            )

        if new_entities:
            async_add_entities(new_entities)

    _add_person_entities()
    entry.async_on_unload(coordinator.async_add_listener(_add_person_entities))


class CrestHouseAccessOccupiedBinarySensor(CrestHouseAccessEntity, BinarySensorEntity):
    """Binary sensor for whether anybody is currently on site."""

    _attr_translation_key = "site_occupied"
    _attr_icon = "mdi:home-account"

    def __init__(self, coordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}_site_occupied"

    @property
    def is_on(self) -> bool:
        """Return true when one or more people are on site."""
        return int(self.coordinator.data.get("on_site", 0)) > 0

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Expose the current open sessions."""
        return {
            "generated_at": self.coordinator.data.get("generated_at"),
            "open_sessions": self.coordinator.data.get("open_sessions", []),
            "recent_events": self.coordinator.data.get("recent_events", []),
        }


class CrestHouseAccessPersonOnSiteBinarySensor(
    CrestHouseAccessEntity, BinarySensorEntity
):
    """Binary sensor for whether a specific person is currently on site."""

    _attr_device_class = None

    def __init__(self, coordinator, person: Dict[str, Any]) -> None:
        super().__init__(coordinator)
        self._contractor_id = int(person["contractor_id"])
        self._contractor_name = str(person.get("contractor_name") or self._contractor_id)
        self._contractor_role = person.get("contractor_role")
        self._attr_unique_id = (
            f"{coordinator.entry.entry_id}_person_{self._contractor_id}_on_site"
        )
        self._attr_name = f"{self._contractor_name} on site"
        self._attr_icon = "mdi:account-check"

    @property
    def is_on(self) -> bool:
        """Return true when this person currently has an open session."""
        return any(
            person.get("contractor_id") == self._contractor_id
            for person in get_on_site_people(self.coordinator.data)
        )

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Expose person metadata and latest session details."""
        current_session = next(
            (
                session
                for session in self.coordinator.data.get("open_sessions", [])
                if session.get("contractor_id") == self._contractor_id
            ),
            None,
        )
        return {
            "contractor_id": self._contractor_id,
            "contractor_name": self._contractor_name,
            "contractor_role": self._contractor_role,
            "current_session": current_session,
            "generated_at": self.coordinator.data.get("generated_at"),
        }
