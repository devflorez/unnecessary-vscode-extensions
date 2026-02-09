import * as https from 'https';
import { URL } from 'url';

export type OpenAIRequestConfig = {
	apiKey: string;
	model: string;
	systemPrompt: string;
	userPrompt: string;
	maxTokens: number;
	temperature: number;
};

export async function requestOpenAICommitRewrite(config: OpenAIRequestConfig): Promise<string> {
	const payload = {
		model: config.model,
		messages: [
			{ role: 'system', content: config.systemPrompt },
			{ role: 'user', content: config.userPrompt },
		],
		temperature: config.temperature,
		max_tokens: config.maxTokens,
	};

	const responseText = await postJson('https://api.openai.com/v1/chat/completions', config.apiKey, payload);
	const parsed = JSON.parse(responseText) as {
		choices?: Array<{ message?: { content?: string } }>;
		error?: { message?: string };
	};

	if (parsed.error?.message) {
		throw new Error(parsed.error.message);
	}

	const content = parsed.choices?.[0]?.message?.content?.trim();
	if (!content) {
		throw new Error('Empty response from OpenAI.');
	}
	return content;
}

function postJson(urlString: string, apiKey: string, payload: unknown): Promise<string> {
	return new Promise((resolve, reject) => {
		const url = new URL(urlString);
		const data = JSON.stringify(payload);

		const request = https.request(
			{
				protocol: url.protocol,
				hostname: url.hostname,
				path: url.pathname,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(data),
					Authorization: `Bearer ${apiKey}`,
				},
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk) => {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});
				response.on('end', () => {
					const body = Buffer.concat(chunks).toString('utf8');
					if (response.statusCode && response.statusCode >= 400) {
						reject(new Error(body));
						return;
					}
					resolve(body);
				});
			},
		);

		request.on('error', (error) => {
			reject(error);
		});

		request.write(data);
		request.end();
	});
}
