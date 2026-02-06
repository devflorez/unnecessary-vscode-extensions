# Self Esteem Linter

Self Esteem Linter offers supportive messages when your current file is full of errors. It tracks an error streak per file and celebrates when you recover.

## Usage
- Open any file and introduce errors.
- The streak increments each time diagnostics report at least one error in the active editor.
- Clear all errors to reset the streak (and celebrate, if enabled).
- The streak is tracked per file. Switching files keeps separate streaks.

The status bar shows the current streak as `SEL: <streak>` when enabled, or `SEL: OFF` when disabled.
An optional sidebar view (Self Esteem) can show an image, history, and stats alongside the message.

## Sidebar View
- Click the heart icon in the Activity Bar to open the Self Esteem view.
- Enable `selfEsteemLinter.showMedia` to show a **View image** button in notifications that jumps to the sidebar.
- The sidebar shows the latest message, image, history, and basic stats.

## Custom Messages
You can customize the text with `{streak}` and `{file}` tokens:

```json
{
  "selfEsteemLinter.messages.threshold1": "Uy, {file} va en {streak}. Respira y sigue.",
  "selfEsteemLinter.messages.threshold2": "{streak} seguidas. Tu depurador confía en ti.",
  "selfEsteemLinter.messages.recovery": "Errores en cero en {file}. Bien ahí."
}
```

## Focus Mode and Sound
- Focus Mode enforces a minimum time between messages (in minutes).
- Optional recovery sound plays when the sidebar view has been opened at least once.

## Settings
This extension contributes the following settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `selfEsteemLinter.enabled` | boolean | `true` | Enable or disable the extension. |
| `selfEsteemLinter.streakThreshold1` | number | `3` | First streak threshold for a supportive warning. |
| `selfEsteemLinter.streakThreshold2` | number | `5` | Second streak threshold for a supportive info message. |
| `selfEsteemLinter.cooldownSeconds` | number | `10` | Minimum seconds between any two messages. |
| `selfEsteemLinter.celebrateOnRecovery` | boolean | `true` | Celebrate when errors drop to zero after a streak. |
| `selfEsteemLinter.showMedia` | boolean | `false` | Show a button that opens the encouragement view in the sidebar. |
| `selfEsteemLinter.focusMode.enabled` | boolean | `false` | Reduce notifications by enforcing a minimum interval between messages. |
| `selfEsteemLinter.focusMode.intervalMinutes` | number | `5` | Minimum minutes between messages while Focus Mode is enabled. |
| `selfEsteemLinter.soundOnRecovery` | boolean | `false` | Play a soft sound when recovering (requires sidebar view opened at least once). |
| `selfEsteemLinter.messages.threshold1` | string | `""` | Custom message for threshold 1. Use `{streak}` and `{file}`. |
| `selfEsteemLinter.messages.threshold2` | string | `""` | Custom message for threshold 2. Use `{streak}` and `{file}`. |
| `selfEsteemLinter.messages.recovery` | string | `""` | Custom message for recovery. Use `{streak}` and `{file}`. |

## Commands
- `Self Esteem Linter: Toggle Enabled`
- `Self Esteem Linter: Reset Streak`
- `Self Esteem Linter: Show Status`

## Notes
- Messages are rate-limited by the cooldown.
- Each threshold message fires once per streak.
- Enable the media button to open the sidebar encouragement view with each message.
- The sidebar includes a small history and stats for the current session.
