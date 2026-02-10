# Cinematic Errors

Turn common programming errors into dramatic, movie-trailer style messages so debugging feels a little more epic.

## What it does
- Watches diagnostics for the active editor
- Matches common error patterns (null/undefined, type mismatch, missing properties, index issues, syntax, missing modules, network, timeouts)
- Shows a short cinematic trailer message with a cooldown to avoid spam
- Respects VS Code language (English/Spanish)
- Sidebar shows a short history of recent trailers

## Example messages
```
In a world where null was never checked...
One missing guard would bring it all down.
This is that moment.
```

```
Two types. One impossible romance.
They were never meant to compile.
```

## Commands
- `Cinematic Errors: Enable / Disable`
- `Cinematic Errors: Show Last Error Trailer`
- `Cinematic Errors: Reset Cooldown`

## Settings
| Setting | Type | Default | Description |
|--------|------|---------|-------------|
| `cinematicErrors.enabled` | boolean | `true` | Enable Cinematic Errors. |
| `cinematicErrors.cooldownSeconds` | number | `30` | Cooldown between messages. |
| `cinematicErrors.showOnEveryError` | boolean | `false` | Trigger on any error change (still avoids repeats). |
| `cinematicErrors.useWebview` | boolean | `true` | Show a cinematic view instead of a toast. |
| `cinematicErrors.showInlineHover` | boolean | `false` | Show a cinematic hover on the error line. |
| `cinematicErrors.showGutterIcon` | boolean | `true` | Show a movie icon in the gutter for error lines. |
| `cinematicErrors.showInlineMessage` | boolean | `true` | Show a cinematic message above the first error line (uses CodeLens). |
| `cinematicErrors.viewLocation` | string | `panel` | Where to show the cinematic trailer view: `sidebar` or `panel`. |
| `cinematicErrors.autoRevealView` | boolean | `false` | Automatically reveal the cinematic view when a new trailer appears. |

## Development
From the repo root:

```bash
cd extensions/cinematic-errors
npm install
npm run watch
```

Press `F5` to open an Extension Development Host.

## Testing
```bash
cd extensions/cinematic-errors
npm test
```
