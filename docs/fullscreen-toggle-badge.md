# Fullscreen Toggle Badge

`custom:fullscreen-toggle-badge` is a compact dashboard badge that toggles the browser Fullscreen API. Its text, icon, and icon colour can be configured independently for normal and fullscreen states.

## Quick start

Add it to the **Badges** section of a dashboard view:

```yaml
type: custom:fullscreen-toggle-badge
enter_text: Go fullscreen
exit_text: Exit fullscreen
enter_icon: mdi:fullscreen
exit_icon: mdi:fullscreen-exit
enter_icon_color: "#42a5f5"
exit_icon_color: "#ff9800"
```

The badge listens for `fullscreenchange`, so its appearance also updates if fullscreen is exited with Escape or another browser control.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `enter_text` | `Go fullscreen` | Text shown when the page is not fullscreen. Set to `""` for an icon-only badge. |
| `exit_text` | `Exit fullscreen` | Text shown while fullscreen. Set to `""` for an icon-only badge. |
| `enter_icon` | `mdi:fullscreen` | Icon shown when not fullscreen. Set to `""` to hide it. |
| `exit_icon` | `mdi:fullscreen-exit` | Icon shown while fullscreen. Set to `""` to hide it. |
| `enter_icon_color` | `var(--primary-color)` | Any CSS colour used for the normal-state icon and interaction highlight. |
| `exit_icon_color` | `var(--primary-color)` | Any CSS colour used for the fullscreen-state icon and interaction highlight. |
| `background_color` | Theme default | Optional badge background CSS colour. |
| `text_color` | Theme default | Optional badge text CSS colour. |
| `badge_size` | `36px` | Badge height as a CSS length. |
| `enable_f11` | `false` | Intercept F11 while the badge is connected and use it as the toggle. Browser policies may prevent this from working. |

The original `go_fullscreen` and `exit_fullscreen` text keys from KTibow's card remain accepted as aliases:

```yaml
type: custom:fullscreen-toggle-badge
go_fullscreen: Theatre mode
exit_fullscreen: Leave theatre mode
enter_icon: mdi:projector-screen
exit_icon: mdi:projector-screen-off
enter_icon_color: deepskyblue
exit_icon_color: orange
```

## Migrating from v0.4.0

The fullscreen control is now a badge rather than a card. Move its configuration from the view's cards into its badges and change the type:

```diff
-type: custom:fullscreen-toggle-card
+type: custom:fullscreen-toggle-badge
```

The state-specific text, icon, colour, background, text colour, and F11 options continue to work. Card-only layout options such as `card_padding`, `button_height`, and `icon_position` are no longer used.

## Notes

- Fullscreen must be initiated by a user action; browsers intentionally block automatic entry.
- Escape generally exits fullscreen and cannot reliably be overridden.
- A visual editor is available in Home Assistant's badge editor.
