import { ensureSchema, query } from '../_lib/db.js';
import { methodNotAllowed } from '../_lib/request.js';
import { clearSessionCookie, getSessionUserId } from '../_lib/session.js';

type Req = { method?: string; headers?: { cookie?: string } };
type Res = {
	status: (code: number) => Res;
	json: (payload: unknown) => void;
	setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res): Promise<void> {
	if (req.method !== 'GET') {
		methodNotAllowed(res, ['GET']);
		return;
	}

	try {
		await ensureSchema();
		const userId = await getSessionUserId(req);
		if (!userId) {
			res.status(401).json({ ok: false, error: 'Not authenticated.' });
			return;
		}

		const result = await query<{
			id: number;
			email: string;
			username: string;
		}>`
			SELECT id, email, username
			FROM users
			WHERE id = ${userId}
			LIMIT 1
		`;

		const user = result[0];
		if (!user) {
			clearSessionCookie(res);
			res.status(401).json({ ok: false, error: 'Session is invalid.' });
			return;
		}

		res.status(200).json({
			ok: true,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
			},
		});
	} catch (error) {
		console.error('Me endpoint error', error);
		res.status(500).json({ ok: false, error: 'Failed to read session.' });
	}
}
