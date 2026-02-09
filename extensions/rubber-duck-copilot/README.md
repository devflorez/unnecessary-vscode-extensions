# Rubber Duck Copilot

Rubber Duck Copilot is a playful debugging companion. When you save a file or hit errors, it asks a thoughtful question to help you reason out loud.

## What it does
- Picks short, curated prompts across understanding, assumptions, boundaries, observability, and clarity.
- Avoids repeating the same prompt twice in a row.
- Includes cooldowns, session caps, and a 10-minute mute.
- Includes a Duck Panel in the sidebar with a cute duck and quick actions.
- Prompts and UI labels follow your VS Code display language (English/Spanish).

## Development
From the repo root:
```bash
cd /Users/cristiandavidflorez/Documents/TRABAJO/DEVFLOREZ/unnecessary-vscode-extensions/extensions/rubber-duck-copilot
npm install
npm run watch
```
Then press `F5` in VS Code to launch the Extension Development Host.
Open the Rubber Duck view from the Activity Bar (duck icon).

## Settings
| Setting | Type | Default | Description |
|---|---|---|---|
| `rubberDuckCopilot.enabled` | boolean | `true` | Enable or disable Rubber Duck Copilot. |
| `rubberDuckCopilot.triggerOnSave` | boolean | `true` | Show prompts when files are saved. |
| `rubberDuckCopilot.triggerOnErrors` | boolean | `true` | Show prompts when the active file has errors. |
| `rubberDuckCopilot.cooldownSeconds` | number | `30` | Minimum seconds between prompts. |
| `rubberDuckCopilot.maxPromptsPerSession` | number | `5` | Maximum prompts per VS Code session. |
| `rubberDuckCopilot.muteMinutesDefault` | number | `10` | Default mute duration in minutes. |

## Commands
- `Rubber Duck Copilot: Toggle Enabled`
- `Rubber Duck Copilot: New Prompt`
- `Rubber Duck Copilot: Open Duck Panel`
- `Rubber Duck Copilot: Mute 10 Minutes`
- `Rubber Duck Copilot: Reset Session Count`

## Demo
Add a GIF or screenshot here if you want:
```
![Rubber Duck Copilot demo](images/demo.gif)
```
