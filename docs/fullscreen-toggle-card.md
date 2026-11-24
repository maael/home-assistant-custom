# Fullscreen Toggle Card

`custom:fullscreen-toggle-card` toggles the browser Fullscreen API. Its label, icon, and icon colour can be configured independently for normal and fullscreen states.

## Quick start

```yaml
type: custom:fullscreen-toggle-card
enter_text: Go fullscreen
exit_text: Exit fullscreen
enter_icon: mdi:fullscreen
exit_icon: mdi:fullscreen-exit
enter_icon_color: "#42a5f5"
exit_icon_color: "#ff9800"
```

The card listens for `fullscreenchange`, so its appearance also updates if fullscreen is exited with Escape or another browser control.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `enter_text` | `Go fullscreen` | Text shown when the page is not fullscreen. Set to `""` for an icon-only button. |
| `exit_text` | `Exit fullscreen` | Text shown while fullscreen. Set to `""` for an icon-only button. |
| `enter_icon` | `mdi:fullscreen` | Icon shown when not fullscreen. Set to `""` to hide it. |
| `exit_icon` | `mdi:fullscreen-exit` | Icon shown while fullscreen. Set to `""` to hide it. |
| `enter_icon_color` | `currentColor` | Any CSS colour used for the normal-state icon. |
| `exit_icon_color` | `currentColor` | Any CSS colour used for the fullscreen-state icon. |
| `background_color` | `var(--primary-color)` | Button background CSS colour. |
| `text_color` | `var(--text-primary-color, white)` | Button text CSS colour. |
| `icon_position` | `left` | `left` or `right`. |
| `card_padding` | `16px` | CSS length used around the button. |
| `button_height` | `48` | Minimum button height in pixels. |
| `enable_f11` | `false` | Intercept F11 while the card is connected and use it as the toggle. Browser policies may prevent this from working. |

The original `go_fullscreen` and `exit_fullscreen` text keys from KTibow's card are accepted as aliases, making migration easier:

```yaml
type: custom:fullscreen-toggle-card
go_fullscreen: Theatre mode
exit_fullscreen: Leave theatre mode
enter_icon: mdi:projector-screen
exit_icon: mdi:projector-screen-off
enter_icon_color: deepskyblue
exit_icon_color: orange
```

## Notes

- Fullscreen must be initiated by a user action; browsers intentionally block automatic entry.
- Escape generally exits fullscreen and cannot reliably be overridden.
- An optional visual editor is available in Home Assistant's card editor.
