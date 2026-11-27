"""Read-only client for the documented/reverse-engineered UGOS Docker API.

No Docker socket, registry request, update check, or mutating endpoint is used here.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode

import aiohttp
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_create_clientsession

from .const import CONF_HOST, CONF_PORT, CONF_USE_SSL, CONF_VERIFY_SSL

_LOGGER = logging.getLogger(__name__)
_TIMEOUT = aiohttp.ClientTimeout(total=20)


class UgosError(Exception):
    """A safe, user-presentable UGOS error."""

    def __init__(self, message: str, *, authentication: bool = False) -> None:
        super().__init__(message)
        self.authentication = authentication


class UgosAuthError(UgosError):
    """Credentials or session are invalid."""

    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message, authentication=True)


class UgosDockerClient:
    """Maintain one cookie-and-query-token session for a UGOS config entry."""

    def __init__(self, hass: HomeAssistant, config: Mapping[str, Any]) -> None:
        self._host = str(config[CONF_HOST]).strip()
        self._port = int(config[CONF_PORT])
        self._username = str(config[CONF_USERNAME])
        self._password = str(config[CONF_PASSWORD])
        scheme = "https" if config.get(CONF_USE_SSL, True) else "http"
        self._base_url = f"{scheme}://{self._host}:{self._port}/ugreen/v1"
        # unsafe is necessary because UGOS commonly serves an IP address and its
        # token cookie must be retained for IP hosts too.
        self._session = async_create_clientsession(
            hass,
            verify_ssl=bool(config.get(CONF_VERIFY_SSL, True)),
            cookie_jar=aiohttp.CookieJar(unsafe=True),
        )
        self._token: str | None = None
        self._login_lock = asyncio.Lock()

    @property
    def host(self) -> str:
        return self._host

    async def async_validate(self) -> dict[str, Any]:
        """Authenticate and verify that the Docker application answers."""
        await self._async_login()
        return await self.async_get("docker/view/ObtainOverviewInfo")

    async def async_get(self, path: str, params: Mapping[str, Any] | None = None) -> Any:
        return await self._async_request("GET", path, params=params)

    async def async_post(self, path: str, body: Mapping[str, Any]) -> Any:
        return await self._async_request("POST", path, body=body)

    async def _async_request(
        self, method: str, path: str, *, params: Mapping[str, Any] | None = None,
        body: Mapping[str, Any] | None = None,
    ) -> Any:
        """Make an authenticated request; renew exactly once on session expiry."""
        for attempt in range(2):
            if not self._token:
                await self._async_login()
            query = dict(params or {})
            query["token"] = self._token
            try:
                async with self._session.request(
                    method, f"{self._base_url}/{path}", params=query, json=body,
                    timeout=_TIMEOUT,
                ) as response:
                    if response.status in (401, 403):
                        error = UgosAuthError("UGOS session was rejected")
                    elif response.status >= 400:
                        raise UgosError(f"UGOS HTTP {response.status} at {path}")
                    else:
                        try:
                            payload = await response.json(content_type=None)
                        except (aiohttp.ContentTypeError, json.JSONDecodeError) as err:
                            raise UgosError(f"Invalid response from UGOS at {path}") from err
                        error = self._envelope_error(payload, path)
                        if error is None:
                            return payload["data"]
            except (aiohttp.ClientError, asyncio.TimeoutError) as err:
                # Do not expose a URL: it includes the query token.
                raise UgosError(f"Cannot reach UGOS at {path}") from err

            if not error.authentication or attempt:
                raise error
            self._token = None
            await self._async_login()
        raise UgosError("UGOS request failed")  # defensive; loop always returns/raises

    @staticmethod
    def _envelope_error(payload: Any, path: str) -> UgosError | None:
        if not isinstance(payload, dict):
            return UgosError(f"Malformed response from UGOS at {path}")
        code = payload.get("code")
        if code == 200:
            if "data" not in payload:
                return UgosError(f"Malformed response from UGOS at {path}")
            return None
        if code in (1003, 1024):
            return UgosAuthError()
        return UgosError(f"UGOS API error {code!s} at {path}")

    async def _async_login(self) -> None:
        """Login once for simultaneous callers; no retry loop on bad credentials."""
        async with self._login_lock:
            if self._token:
                return
            try:
                async with self._session.post(
                    f"{self._base_url}/verify/check", json={"username": self._username},
                    timeout=_TIMEOUT,
                ) as response:
                    rsa_token = response.headers.get("x-rsa-token")
                    if response.status >= 400 or not rsa_token:
                        raise UgosAuthError("UGOS did not provide a login key")
                try:
                    key = serialization.load_pem_public_key(base64.b64decode(rsa_token))
                    encrypted = base64.b64encode(
                        key.encrypt(self._password.encode(), padding.PKCS1v15())
                    ).decode()
                except (ValueError, TypeError, AttributeError) as err:
                    raise UgosError("UGOS returned an invalid login key") from err
                async with self._session.post(
                    f"{self._base_url}/verify/login",
                    json={"username": self._username, "password": encrypted,
                          "keepalive": True, "otp": True, "is_simple": False},
                    timeout=_TIMEOUT,
                ) as response:
                    if response.status >= 400:
                        raise UgosAuthError()
                    payload = await response.json(content_type=None)
            except (aiohttp.ClientError, asyncio.TimeoutError) as err:
                raise UgosError("Cannot connect to UGOS") from err
            error = self._envelope_error(payload, "verify/login")
            if error:
                raise error
            data = payload["data"]
            if not isinstance(data, dict) or not isinstance(data.get("token"), str):
                # 2FA is intentionally unsupported: a long-lived unattended
                # integration cannot safely complete its interactive challenge.
                raise UgosAuthError("UGOS login requires unsupported two-factor authentication")
            self._token = data["token"]
