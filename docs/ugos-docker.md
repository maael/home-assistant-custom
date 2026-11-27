# UGREEN Docker integration

The read-only **UGREEN Docker** backend integration has moved to its own HACS **Integration** repository:

<https://github.com/maael/home-assistant-custom-integration>

Install that repository through HACS using category **Integration**, then configure it from **Settings → Devices & services**. It owns the UGOS connection, credentials, update-count sensors, diagnostics, and its setup documentation.

This repository remains a HACS **Dashboard** repository. Its [Docker Status Badge](docker-status-badge.md) stays intentionally source-agnostic and can display the UGREEN Docker sensors:

```yaml
type: custom:docker-status-badge
total_entity: sensor.lovelace_containers
updates_entity: sensor.lovelace_container_updates
errors_entity: sensor.lovelace_container_errors
```

Keep `sensor.lovelace_project_updates` separate from container updates because their UGOS scopes can overlap.
