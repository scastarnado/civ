type AnyReq = {
	method?: string;
	body?: unknown;
	on?: (event: string, handler: (chunk: Buffer | string) => void) => void;
};

type AnyRes = {
	status: (code: number) => AnyRes;
	setHeader: (name: string, value: string) => void;
	json: (data: unknown) => void;
};

export function methodNotAllowed(res: AnyRes, allowed: string[]): void {
	res.setHeader('Allow', allowed.join(', '));
	res.status(405).json({ ok: false, error: 'Method not allowed.' });
}

export function badRequest(res: AnyRes, message: string): void {
	res.status(400).json({ ok: false, error: message });
}

export async function readJsonBody<T>(req: AnyReq): Promise<T> {
	if (req.body && typeof req.body === 'object') {
		return req.body as T;
	}

	const body = await new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		if (!req.on) {
			resolve('');
			return;
		}
		req.on('data', (chunk) => {
			const normalized = Buffer.isBuffer(chunk)
				? chunk
				: Buffer.from(chunk);
			chunks.push(normalized);
		});
		req.on('end', () => {
			resolve(Buffer.concat(chunks).toString('utf-8'));
		});
		req.on('error', reject);
	});

	if (!body) {
		return {} as T;
	}

	return JSON.parse(body) as T;
}
