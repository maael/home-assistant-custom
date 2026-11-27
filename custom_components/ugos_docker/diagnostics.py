"""Diagnostics with credentials and session material removed."""
from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.redact import async_redact_data

from homeassistant.const import CONF_PASSWORD

TO_REDACT = {CONF_PASSWORD, "token", "static_token", "cookie", "set-cookie", "authorization"}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    """Return useful metadata without secrets or session material."""
    coordinator = entry.runtime_data
    data = coordinator.data
    return async_redact_data({
        "entry": {"data": dict(entry.data), "options": dict(entry.options)},
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "last_exception": str(coordinator.last_exception) if coordinator.last_exception else None,
            "data": {
                "container_updates": data.container_updates if data else None,
                "project_updates": data.project_updates if data else None,
                "containers": data.containers if data else None,
                "projects": data.projects if data else None,
                "detail_error": data.detail_error if data else None,
            },
        },
    }, TO_REDACT)
