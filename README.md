# Unnecessary VS Code Extensions

A collection of intentionally unnecessary VS Code extensions built for fun, learning, and developer sanity.

## Why this repo exists
This repository is built in public to:
- Learn the VS Code Extension API
- Practice TypeScript through small, complete projects
- Ship consistently, one tiny extension at a time
- Have fun while doing it

## Extensions
| Name | Description | Status |
|-----|------------|--------|
| Self Esteem Linter | Encouraging messages when your code breaks | ✅ Ready |
| Rubber Duck Copilot | Thoughtful rubber duck questions when you save or hit errors | ✅ Ready |

## Structure
```text
extensions/
  ├── self-esteem-linter/
  ├── rubber-duck-copilot/
```

## Publishing (Self Esteem Linter)
This repo publishes the extension when a version tag is pushed.

Steps:
1. Create a VS Code Marketplace Personal Access Token (PAT) and add it as the GitHub secret `VSCE_PAT`.
2. Tag a release like `self-esteem-linter/v1.0.0` and push the tag:
   `git tag self-esteem-linter/v1.0.0` then `git push origin self-esteem-linter/v1.0.0`
3. The GitHub Actions workflow publishes via `vsce publish`.

Local dry run:
```bash
cd unnecessary-vscode-extensions/extensions/self-esteem-linter
npx @vscode/vsce package
```
