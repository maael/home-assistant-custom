# UGREEN Docker integration

`ugos_docker` is a local, **read-only** Home Assistant integration for the UGOS Docker application. UGOS is its sole update authority: it does not use Docker's socket, query registries, compare tags, pull images, restart containers, or change NAS settings.

## Install and configure

For a step-by-step Home Assistant OS/manual installation guide, prerequisites, credential explanation, and troubleshooting, see [UGREEN Docker setup](ugos-docker-setup.md).

This repository's HACS entry is a **Dashboard** repository. HACS cannot install this Python integration from that entry without breaking existing frontend distribution, so install it manually:

1. Copy `custom_components/ugos_docker` into `<Home Assistant config>/custom_components/ugos_docker`.
2. Restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration**, choose **UGREEN Docker**, and enter the NAS host, web API port, UGOS username, and password.
4. HTTPS port 9443 and certificate verification are defaults. Use HTTP/9999 only deliberately. Configure the polling interval (default: 300 seconds) from the integration's **Configure** action.

To update, replace that directory and restart. To remove it, remove the integration first, then delete the directory and restart. Use reauthentication after password/account changes; Configure changes host, port, TLS, and polling settings.

Use a dedicated least-privilege UGOS account where available. Credentials are stored in Home Assistant config entries; session cookies/tokens are memory-only. TLS verification is enabled by default.

## Entities and semantics

One NAS device groups `sensor.*_container_updates`, `project_updates`, `containers`, `projects`, `running_containers`, `stopped_containers`, `errors`, `last_successful_sync`, and `binary_sensor.*_connected`.

`GetUpdateContainerCount` and `GetUpdateProjectCount` are authoritative and intentionally separate: a project can contain containers, so they must not be added. `imgHasUpdate` flags from container/project lists provide compact attributes (container name/ID/image/tag/project; project name/ID/listed containers). A container with no supplied project name is standalone. `errors` only counts explicit UGOS `error`, `dead`, `failed`, and `failure` states; stopped containers are not errors.

If native counts disagree with detail flags, native counts remain sensor state and `detail_status` reports the discrepancy. Failed native count/overview requests make coordinator entities unavailable, never zero. Detail-list failure keeps authoritative counts but adds `detail_status`; totals/errors without reliable data are unavailable.

## Docker Status Badge / WUD migration

The existing badge already supports arbitrary entities and does not treat unavailable as zero:

```yaml
type: custom:docker-status-badge
total_entity: sensor.lovelace_containers
updates_entity: sensor.lovelace_container_updates
errors_entity: sensor.lovelace_container_errors
```

Replace WUD IDs with these entities. Keep project updates in `sensor.lovelace_project_updates` separately (for example another badge or card); do not combine counts. Existing WUD badge configuration stays compatible. See [Docker Status Badge](docker-status-badge.md).

## API, security, and firmware compatibility

The integration uses `POST /verify/check`, RSA PKCS#1 v1.5 password encryption, `POST /verify/login`, the returned cookie/token, and read-only `GetUpdateContainerCount`, `GetUpdateProjectCount`, `ObtainOverviewInfo`, `ContainerListV2`, `ShowContainerDetailListV2`, and `GetProjectListV3`. It renews an expired session once. Interactive TOTP is unsupported for unattended polling.

The UGOS API is reverse engineered and can change with firmware. Its implementation is based on [metaneutrons/ugos-cli](https://github.com/metaneutrons/ugos-cli) and its [Docker API reference](https://github.com/metaneutrons/ugos-cli/blob/main/docs/api-docker.md). Live validation against this NAS was not performed because no credentials were provided. Check port, certificate, permissions, Docker app availability, and firmware if setup fails. Share only redacted diagnostics—never passwords, cookies, tokens, or authenticated URLs.
