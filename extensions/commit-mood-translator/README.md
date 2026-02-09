# Commit Mood Translator

Commit Mood Translator turns a raw commit message into a mood-specific style so your history feels more expressive.

## What it does
- Reads the current commit message from Source Control.
- Lets you pick a mood.
- Rewrites the message with a mood tag + emoji + tone shift.
- UI strings and default moods follow your VS Code language (English/Spanish).

## Usage
1. Open Source Control and type a commit message.
2. Run **Commit Mood Translator: Translate Commit** from the Command Palette.
3. Pick a mood and your message updates instantly.

## Development
From the repo root:
```bash
cd unnecessary-vscode-extensions/extensions/commit-mood-translator
npm install
npm run watch
```
Then press `F5` in VS Code to launch the Extension Development Host.

## Settings
Optional custom moods:
```json
"commitMoodTranslator.moods": [
  {
    "label": "Chill",
    "template": "[Chill] 😌 {message}"
  }
]
```
If empty, the defaults are used.

### OpenAI integration (optional)
You can enable OpenAI to personalize the commit rewrite. Two options to set the key:
1. Run `Commit Mood Translator: Set OpenAI API Key` (stored securely).
2. Or set `commitMoodTranslator.openAI.apiKey` in settings (not recommended).

Settings example:
```json
"commitMoodTranslator.openAI.enabled": true,
"commitMoodTranslator.openAI.model": "gpt-4o-mini",
"commitMoodTranslator.openAI.promptTemplate": "Rewrite this git commit message in a {mood} tone. Keep it short, imperative, single line. Include a mood tag and emoji. Original: {message}"
```

## Commands
- `Commit Mood Translator: Translate Commit`
- `Commit Mood Translator: Set OpenAI API Key`

## Tests
```bash
npm test
```

## Example
Raw:
```
fix login flow
```
Translated (Optimistic):
```
[Optimistic] ✨ Fix login flow (should be smoother now)
```
