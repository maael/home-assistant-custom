"""UGREEN OS Docker integration."""
from __future__ import annotations

from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .api import UgosDockerClient, UgosError
from .const import CONF_SCAN_INTERVAL, DOMAIN, NAME, PLATFORMS
from .coordinator import UgosDockerData, async_update_data


type UgosDockerConfigEntry = ConfigEntry[DataUpdateCoordinator[UgosDockerData]]


async def async_setup_entry(hass: HomeAssistant, entry: UgosDockerConfigEntry) -> bool:
    """Set up UGREEN Docker from a config entry."""
    client = UgosDockerClient(hass, {**entry.data, **entry.options})
    coordinator = DataUpdateCoordinator[
        UgosDockerData
    ](
        hass,
        logger=__import__("logging").getLogger(__name__),
        name=NAME,
        update_method=lambda: async_update_data(client),
        update_interval=timedelta(seconds=entry.options.get(CONF_SCAN_INTERVAL, 300)),
    )
    try:
        await coordinator.async_config_entry_first_refresh()
    except UgosError as err:
        # Invalid credentials are deliberately not converted to empty values.
        if err.authentication:
            entry.async_start_reauth(hass)
        raise

    entry.runtime_data = coordinator
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: UgosDockerConfigEntry) -> bool:
    """Unload the platforms and discard the in-memory session."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        entry.runtime_data = None
    return unloaded


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
