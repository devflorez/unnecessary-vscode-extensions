# Variable Name Therapist

A gentle, respectful linter that spots low-quality variable names and suggests more meaningful alternatives.

## What it does
- Analyzes the active file when you change, save, or switch editors
- Flags vague or suspicious variable names with friendly diagnostics
- Focuses on JS/TS without breaking other languages

## Supported languages
- TypeScript
- JavaScript
- TSX/JSX
 - Python (optional via regex fallback)
 - Go (optional via regex fallback)

## Example messages
- "Let's talk about this name: 'data' — what is it really?"
- "Temp is not a plan. Consider a more specific name."

## Commands
- Variable Name Therapist: Toggle Enabled
- Variable Name Therapist: Analyze Current File Now
- Variable Name Therapist: Show Naming Summary

## Settings
| Setting | Type | Default | Description |
|--------|------|---------|-------------|
| `variableNameTherapist.enabled` | boolean | `true` | Enable or disable the extension. |
| `variableNameTherapist.severity` | string | `warning` | Diagnostic severity (`warning` or `info`). |
| `variableNameTherapist.debounceMs` | number | `500` | Debounce time in ms. |
| `variableNameTherapist.allowSingleLetterInLoops` | boolean | `true` | Allow i/j/k in loops. |
| `variableNameTherapist.ignoredPrefixes` | array | `['_','$']` | Prefixes to ignore (e.g. `_private`, `$cache`). |
| `variableNameTherapist.ignoredNames` | array | `['ok','id']` | Names to ignore. |
| `variableNameTherapist.allowedLanguages` | array | `['typescript','typescriptreact','javascript','javascriptreact']` | Language IDs to analyze. |
| `variableNameTherapist.enableRegexFallback` | boolean | `false` | Use regex when AST parsing isn't available. |
| `variableNameTherapist.useDefaultNameLists` | boolean | `true` | Use built-in name lists and patterns. |
| `variableNameTherapist.genericNames` | array | `[]` | Extra generic names to flag. |
| `variableNameTherapist.genericPatterns` | array | `[]` | Extra regex patterns for generic names. |
| `variableNameTherapist.keyboardMashNames` | array | `[]` | Extra keyboard-mash names to flag. |
| `variableNameTherapist.versionedPatterns` | array | `[]` | Extra regex patterns for versioned names. |
| `variableNameTherapist.locale` | string | `auto` | Message language (`auto`, `en`, `es`). |

To enable Python or Go, add the language IDs to `allowedLanguages` and set
`variableNameTherapist.enableRegexFallback` to `true`.

You can also customize which names are flagged:

```json
{
  "variableNameTherapist.useDefaultNameLists": false,
  "variableNameTherapist.genericNames": ["payload", "stuff"],
  "variableNameTherapist.genericPatterns": ["^data_.*$"],
  "variableNameTherapist.versionedPatterns": ["^legacy_.*$"]
}
```

## Development
From the repo root:

```bash
cd extensions/variable-name-therapist
npm install
npm run watch
```

Press `F5` to launch the Extension Development Host.

## Testing
```bash
cd extensions/variable-name-therapist
npm test
```
