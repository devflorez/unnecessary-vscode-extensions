# EOL Guardian

EOL Guardian detects and (optionally) fixes line endings (LF vs CRLF) based on your settings and `.editorconfig`.

## What it does
- Detects EOL mismatches on open/save.
- Supports three modes: detect-only, ask-before-fix, or fix-on-save.
- Honors `.editorconfig` `end_of_line` when enabled (with common glob patterns like `**` and `{a,b}`).
- Allows per-language or per-pattern overrides.
- Supports ignore patterns.
- Adds a status bar indicator with mismatch warnings and source.

## Modes
- `detectOnly` (default): shows a warning if EOL mismatches.
- `askBeforeFix`: prompts with **Convert** / **Ignore**.
- `fixOnSave`: converts to expected EOL automatically when saving.

## Settings
| Setting | Type | Default | Description |
|---|---|---|---|
| `eolGuardian.enabled` | boolean | `true` | Enable or disable the extension. |
| `eolGuardian.expectedEOL` | string | `auto` | `auto`, `lf`, or `crlf`. |
| `eolGuardian.detectOnOpen` | boolean | `true` | Detect on open. |
| `eolGuardian.detectOnSave` | boolean | `true` | Detect on save. |
| `eolGuardian.mode` | string | `detectOnly` | `detectOnly`, `askBeforeFix`, `fixOnSave`. |
| `eolGuardian.cooldownSeconds` | number | `60` | Cooldown per file. |
| `eolGuardian.respectEditorConfig` | boolean | `true` | Use `.editorconfig` if present. |
| `eolGuardian.overrides` | array | `[]` | Override EOL by language id or glob pattern. |
| `eolGuardian.ignore` | array | `[]` | Glob patterns to ignore. |

Example overrides:
```json
"eolGuardian.overrides": [
  { "languageId": "powershell", "eol": "crlf" },
  { "pattern": "**/*.sh", "eol": "lf" }
],
"eolGuardian.ignore": [
  "dist/**",
  "**/*.min.js"
]
```

## Commands
- `EOL Guardian: Fix Current File EOL`
- `EOL Guardian: Show Current File EOL`
- `EOL Guardian: Toggle Enabled`
- `EOL Guardian: Set Mode`
- `EOL Guardian: Fix Workspace EOL`

## Development
From the repo root:
```bash
cd /Users/cristiandavidflorez/Documents/TRABAJO/DEVFLOREZ/unnecessary-vscode-extensions/extensions/eol-guardian
npm install
npm run watch
```
Then press `F5` in VS Code to launch the Extension Development Host.

## Tests
```bash
npm test
```
