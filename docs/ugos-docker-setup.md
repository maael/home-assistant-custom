# UGREEN Docker setup

This is a UI-configured custom integration. Do **not** add `CONF_USERNAME`, `CONF_PASSWORD`, a token, or a Docker socket to `configuration.yaml`.

## Before starting

- Install the UGREEN **Docker** application on the NAS.
- Create or choose a UGOS account permitted to view Docker. Prefer a dedicated least-privilege account.
- Know the NAS hostname/IP and its UGOS web port. The usual defaults are HTTPS `9443` and HTTP `9999`.
- Ensure Home Assistant can reach that address. For the supplied environment this may be `https://lovelace:9443` or `https://192.168.4.204:9443`.
- If using HTTPS with a self-signed certificate, either install/trust the certificate authority in Home Assistant or explicitly disable certificate verification. Keep verification enabled whenever possible.
- The current integration cannot complete an interactive UGOS TOTP/2FA login. Use an account without interactive TOTP until unattended TOTP support is deliberately added.

## Install

The repository remains a HACS **Dashboard** repository for its frontend cards/badges. HACS therefore does not install this backend integration automatically.

1. Download/clone the same revision as the frontend repository.
2. Copy the complete `custom_components/ugos_docker` directory to:

   ```text
   /config/custom_components/ugos_docker
   ```

   `/config` is Home Assistant's configuration directory; use the equivalent path when editing through Samba, SSH, Studio Code Server, or the File editor.
3. Restart Home Assistant: **Settings → System → Restart Home Assistant**.

## Add the integration

1. Open **Settings → Devices & services**.
2. Select **Add integration** and search for **UGREEN Docker**.
3. Enter the host/IP, port, HTTPS choice, certificate-verification choice, UGOS username, and UGOS password.
4. Submit. Setup verifies an authenticated, read-only Docker overview request before creating the entry.
5. Open **Configure** on the created entry to set the polling interval (300 seconds by default; minimum 30 seconds) or change host/port/TLS settings.

The integration creates one UGREEN NAS device and its sensors. An authentication failure prompts Home Assistant's reauthentication flow; it does not create a new entry.

## First dashboard

After the first successful poll, use the generated entity IDs selected in the UI. A common badge configuration is:

```yaml
type: custom:docker-status-badge
total_entity: sensor.lovelace_containers
updates_entity: sensor.lovelace_container_updates
errors_entity: sensor.lovelace_container_errors
```

Keep `sensor.lovelace_project_updates` separate from container updates. They describe different UGOS scopes and may overlap.

## What `CONF_USERNAME` and `CONF_PASSWORD` mean

They are Home Assistant constants imported from `homeassistant.const`. Their values are simply the standard config-entry dictionary keys `"username"` and `"password"`; they are **not** environment variables, default credentials, API tokens, or values users should put in YAML. The config flow stores the values entered in the UI, and `api.py` reads them only to perform the UGOS RSA-encrypted login. Passwords, session cookies, and tokens are never logged or included in diagnostics.

## Update or remove

- **Update:** replace `/config/custom_components/ugos_docker` with the new version and restart Home Assistant.
- **Change password:** use the integration's reauthentication prompt after a rejected login. Do not create a duplicate entry.
- **Remove:** delete the UGREEN Docker entry from **Devices & services**, remove the component directory, then restart.

## Troubleshooting

- **Cannot connect:** confirm the selected protocol/port, routing from Home Assistant to NAS, and that the Docker application is installed/running.
- **Certificate error:** use the NAS hostname matching the certificate and trust its CA, rather than disabling verification permanently.
- **Invalid authentication:** verify the UGOS account/password and that interactive TOTP is not required.
- **Unavailable instead of zero:** this is intentional when a native UGOS request fails; inspect the connected binary sensor and redacted diagnostics.
- **Counts differ from the Docker application:** record UGOS version, endpoint response shape (with tokens/cookies removed), and the native app values. The API is reverse engineered and firmware changes can require integration updates.
