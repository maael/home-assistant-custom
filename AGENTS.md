# Agent instructions

This repository is the HACS **Dashboard** distribution for frontend Home Assistant cards and badges. Keep it browser-only: do not add `custom_components`, Python backend integrations, credentials, API clients, or Home Assistant services here.

## Related backend repository

The read-only UGREEN Docker backend integration lives at:

`https://github.com/maael/home-assistant-custom-integration`

- Install it through HACS as an **Integration** repository.
- The `custom:docker-status-badge` in this repository remains source-agnostic and can consume its sensors, WUD sensors, or any other numeric Home Assistant entities.
- Do not move the badge into the backend repository or couple it to UGOS-specific entity IDs.

## Development

- Keep the HACS metadata and shared `home-assistant-custom.js` bundle compatible with existing Dashboard installs.
- Add/update JavaScript tests and documentation for frontend changes.
- Run `npm ci && npm test && npm run build` before release.
