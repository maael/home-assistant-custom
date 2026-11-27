"""Config and options flows for UGREEN Docker."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, OptionsFlow
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.data_entry_flow import FlowResult

from .api import UgosAuthError, UgosDockerClient, UgosError
from .const import (
    CONF_HOST, CONF_PORT, CONF_SCAN_INTERVAL, CONF_USE_SSL, CONF_VERIFY_SSL,
    DEFAULT_PORT_HTTPS, DEFAULT_SCAN_INTERVAL, DOMAIN, MIN_SCAN_INTERVAL,
)


def _schema(defaults: dict[str, Any], *, credentials: bool = True) -> vol.Schema:
    fields: dict[Any, Any] = {
        vol.Required(CONF_HOST, default=defaults.get(CONF_HOST, "")): str,
        vol.Required(CONF_PORT, default=defaults.get(CONF_PORT, DEFAULT_PORT_HTTPS)): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
        vol.Required(CONF_USE_SSL, default=defaults.get(CONF_USE_SSL, True)): bool,
        vol.Required(CONF_VERIFY_SSL, default=defaults.get(CONF_VERIFY_SSL, True)): bool,
    }
    if credentials:
        fields[vol.Required(CONF_USERNAME, default=defaults.get(CONF_USERNAME, ""))] = str
        fields[vol.Required(CONF_PASSWORD, default=defaults.get(CONF_PASSWORD, ""))] = str
    return vol.Schema(fields)


class UgosDockerConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input:
            cleaned = {**user_input, CONF_HOST: user_input[CONF_HOST].strip(), CONF_USERNAME: user_input[CONF_USERNAME].strip()}
            try:
                await UgosDockerClient(self.hass, cleaned).async_validate()
            except UgosAuthError:
                errors["base"] = "invalid_auth"
            except UgosError:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(f"{cleaned[CONF_HOST].lower()}:{cleaned[CONF_PORT]}")
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=cleaned[CONF_HOST], data=cleaned)
        return self.async_show_form(step_id="user", data_schema=_schema(user_input or {}), errors=errors)

    async def async_step_reauth(self, entry_data: dict[str, Any]) -> FlowResult:
        self._reauth_entry = self._get_reauth_entry()
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input:
            data = {**self._reauth_entry.data, **user_input}
            try:
                await UgosDockerClient(self.hass, data).async_validate()
            except UgosAuthError:
                errors["base"] = "invalid_auth"
            except UgosError:
                errors["base"] = "cannot_connect"
            else:
                return self.async_update_reload_and_abort(self._reauth_entry, data_updates=user_input)
        schema = vol.Schema({
            vol.Required(CONF_USERNAME, default=self._reauth_entry.data[CONF_USERNAME]): str,
            vol.Required(CONF_PASSWORD): str,
        })
        return self.async_show_form(step_id="reauth_confirm", data_schema=schema, errors=errors)

    @staticmethod
    def async_get_options_flow(config_entry):
        return UgosDockerOptionsFlow()


class UgosDockerOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input:
            return self.async_create_entry(title="", data=user_input)
        defaults = {**self.config_entry.data, **self.config_entry.options}
        schema = _schema(defaults, credentials=False).extend({
            vol.Required(CONF_SCAN_INTERVAL, default=defaults.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)): vol.All(vol.Coerce(int), vol.Range(min=MIN_SCAN_INTERVAL, max=86400)),
        })
        return self.async_show_form(step_id="init", data_schema=schema)
