"""Binary sensors for UGREEN Docker."""
from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, NAME


class UgosDockerConnectedSensor(CoordinatorEntity, BinarySensorEntity):
    _attr_has_entity_name = True
    _attr_name = "Connected"
    _attr_translation_key = "connected"
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_icon = "mdi:lan-connect"

    def __init__(self, entry: ConfigEntry) -> None:
        super().__init__(entry.runtime_data)
        self._attr_unique_id = f"{entry.entry_id}_connected"
        self._attr_device_info = {"identifiers": {(DOMAIN, entry.entry_id)}, "name": f"{NAME} ({entry.title})", "manufacturer": "UGREEN", "model": "UGOS NAS"}

    @property
    def is_on(self) -> bool:
        return self.coordinator.last_update_success


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([UgosDockerConnectedSensor(entry)])
