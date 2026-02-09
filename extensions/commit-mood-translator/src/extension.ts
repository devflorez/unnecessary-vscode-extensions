import * as path from 'path';
import * as vscode from 'vscode';

import {
	getDefaultMoods,
	Mood,
	MoodConfig,
	resolveMoods,
	translateCommitMessage,
} from './core/translator';
import { requestOpenAICommitRewrite } from './core/openai';

const COMMAND_TRANSLATE = 'commit-mood-translator.translateCommit';
const COMMAND_SET_OPENAI_KEY = 'commit-mood-translator.setOpenAIKey';
const SECRET_OPENAI_KEY = 'commitMoodTranslator.openai.apiKey';

type OpenAIConfig = {
	enabled: boolean;
	apiKey: string;
	model: string;
	promptTemplate: string;
	systemPrompt: string;
	maxTokens: number;
	temperature: number;
};

interface GitExtension {
	getAPI(version: 1): GitAPI;
}

interface GitAPI {
	repositories: Repository[];
}

interface Repository {
	rootUri: vscode.Uri;
	inputBox: { value: string };
}

export function activate(context: vscode.ExtensionContext): void {
	const translateCommand = vscode.commands.registerCommand(COMMAND_TRANSLATE, async () => {
		const gitApi = await getGitApi();
		if (!gitApi) {
			await vscode.window.showErrorMessage(vscode.l10n.t('Git extension not available.'));
			return;
		}

		const repo = pickRepository(gitApi.repositories, vscode.window.activeTextEditor?.document.uri);
		if (!repo) {
			await vscode.window.showErrorMessage(vscode.l10n.t('No Git repository found.'));
			return;
		}

		const currentMessage = repo.inputBox.value.trim();
		if (!currentMessage) {
			await vscode.window.showErrorMessage(
				vscode.l10n.t('No commit message found in the Source Control input box.'),
			);
			return;
		}

		const moods = getConfiguredMoods();
		const selection = await vscode.window.showQuickPick(
			moods.map((mood) => ({
				label: mood.label,
				description: mood.description,
				mood,
			})),
			{
				placeHolder: vscode.l10n.t('Choose a commit mood'),
			},
		);

		if (!selection) {
			return;
		}

		const fallbackTranslation = translateCommitMessage(currentMessage, selection.mood);
		const openAIConfig = await getOpenAIConfig(context.secrets);

		if (!openAIConfig.enabled) {
			repo.inputBox.value = fallbackTranslation;
			await vscode.window.showInformationMessage(
				vscode.l10n.t('Commit message translated to {0}.', selection.mood.label),
			);
			return;
		}

		if (!openAIConfig.apiKey) {
			repo.inputBox.value = fallbackTranslation;
			await vscode.window.showWarningMessage(vscode.l10n.t('OpenAI API key is missing. Using local translation.'));
			return;
		}

		const userPrompt = openAIConfig.promptTemplate
			.replaceAll('{message}', currentMessage)
			.replaceAll('{mood}', selection.mood.label);

		try {
			const aiMessage = await requestOpenAICommitRewrite({
				apiKey: openAIConfig.apiKey,
				model: openAIConfig.model,
				systemPrompt: openAIConfig.systemPrompt,
				userPrompt,
				maxTokens: openAIConfig.maxTokens,
				temperature: openAIConfig.temperature,
			});

			repo.inputBox.value = aiMessage;
			await vscode.window.showInformationMessage(
				vscode.l10n.t('Commit message translated to {0}.', selection.mood.label),
			);
		} catch {
			repo.inputBox.value = fallbackTranslation;
			await vscode.window.showWarningMessage(vscode.l10n.t('OpenAI request failed. Using local translation.'));
		}
	});

	const setOpenAIKey = vscode.commands.registerCommand(COMMAND_SET_OPENAI_KEY, async () => {
		const value = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter OpenAI API key'),
			password: true,
			ignoreFocusOut: true,
		});
		if (!value) {
			return;
		}
		await context.secrets.store(SECRET_OPENAI_KEY, value.trim());
		await vscode.window.showInformationMessage(vscode.l10n.t('OpenAI API key saved.'));
	});

	context.subscriptions.push(translateCommand, setOpenAIKey);
}

export function deactivate(): void {
	// No cleanup required.
}

async function getGitApi(): Promise<GitAPI | undefined> {
	const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
	if (!extension) {
		return undefined;
	}
	if (!extension.isActive) {
		await extension.activate();
	}
	try {
		return extension.exports.getAPI(1);
	} catch {
		return undefined;
	}
}

function pickRepository(repositories: Repository[], activeUri: vscode.Uri | undefined): Repository | undefined {
	if (repositories.length === 0) {
		return undefined;
	}
	if (!activeUri) {
		return repositories[0];
	}
	const activePath = path.normalize(activeUri.fsPath);
	const found = repositories.find((repo) => {
		const rootPath = path.normalize(repo.rootUri.fsPath) + path.sep;
		return activePath === rootPath.slice(0, -1) || activePath.startsWith(rootPath);
	});
	return found ?? repositories[0];
}

function getConfiguredMoods(): Mood[] {
	const config = vscode.workspace.getConfiguration('commitMoodTranslator');
	const custom = config.get<MoodConfig[]>('moods');
	return resolveMoods(custom, getDefaultMoods(vscode.env.language));
}

async function getOpenAIConfig(secrets: vscode.SecretStorage): Promise<OpenAIConfig> {
	const config = vscode.workspace.getConfiguration('commitMoodTranslator');
	const openAIConfig = config.get<Record<string, unknown>>('openAI') ?? {};
	const storedKey = await secrets.get(SECRET_OPENAI_KEY);
	const apiKey = storedKey ?? (openAIConfig.apiKey as string | undefined) ?? '';
	const enabled = Boolean(openAIConfig.enabled);

	return {
		enabled,
		apiKey,
		model: (openAIConfig.model as string | undefined) ?? 'gpt-4o-mini',
		promptTemplate:
			(openAIConfig.promptTemplate as string | undefined) ??
			'Rewrite this git commit message in a {mood} tone. Keep it short, imperative, single line. Include a mood tag and emoji. Original: {message}',
		systemPrompt:
			(openAIConfig.systemPrompt as string | undefined) ??
			'You rewrite git commit messages. Return only the final commit message, no extra text.',
		maxTokens: (openAIConfig.maxTokens as number | undefined) ?? 60,
		temperature: (openAIConfig.temperature as number | undefined) ?? 0.4,
	};
}
