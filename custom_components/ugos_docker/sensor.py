"""Sensors for UGREEN Docker."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, NAME
from .coordinator import UgosDockerData


def _device(entry: ConfigEntry) -> DeviceInfo:
    return DeviceInfo(identifiers={(DOMAIN, entry.entry_id)}, name=f"{NAME} ({entry.title})", manufacturer="UGREEN", model="UGOS NAS")


class UgosDockerSensor(CoordinatorEntity[UgosDockerData], SensorEntity):
    _attr_has_entity_name = True
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, entry: ConfigEntry, key: str, name: str, icon: str, getter: Callable[[UgosDockerData], Any], attributes: bool = False) -> None:
        super().__init__(entry.runtime_data)
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_translation_key = key
        self._attr_name = name
        self._attr_icon = icon
        self._attr_device_info = _device(entry)
        self._getter = getter
        self._attributes = attributes

    @property
    def native_value(self) -> Any:
        return self._getter(self.coordinator.data)

    @property
    def available(self) -> bool:
        return super().available and self.native_value is not None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if not self._attributes:
            return None
        data = self.coordinator.data
        if self._attr_translation_key == "container_updates":
            return {"containers": data.update_containers, "detail_status": data.detail_error} if data.detail_error else {"containers": data.update_containers}
        return {"projects": data.update_projects, "detail_status": data.detail_error} if data.detail_error else {"projects": data.update_projects}


class LastSyncSensor(UgosDockerSensor):
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_state_class = None


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([
        UgosDockerSensor(entry, "container_updates", "Container updates", "mdi:package-up", lambda d: d.container_updates, True),
        UgosDockerSensor(entry, "project_updates", "Project updates", "mdi:package-variant-closed-plus", lambda d: d.project_updates, True),
        UgosDockerSensor(entry, "containers", "Containers", "mdi:docker", lambda d: d.containers),
        UgosDockerSensor(entry, "projects", "Projects", "mdi:docker-compose", lambda d: d.projects),
        UgosDockerSensor(entry, "running_containers", "Running containers", "mdi:play-circle-outline", lambda d: d.running),
        UgosDockerSensor(entry, "stopped_containers", "Stopped containers", "mdi:stop-circle-outline", lambda d: d.stopped),
        UgosDockerSensor(entry, "errors", "Container errors", "mdi:alert-circle-outline", lambda d: d.errors),
        LastSyncSensor(entry, "last_sync", "Last successful sync", "mdi:clock-check-outline", lambda d: d.updated_at),
    ])
