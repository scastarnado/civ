import bcrypt from 'bcryptjs';

import { ensureSchema, query } from '../_lib/db.js';
import { badRequest, methodNotAllowed, readJsonBody } from '../_lib/request.js';
import { setSessionCookie } from '../_lib/session.js';

type Req = { method?: string; body?: unknown; on?: any };
type Res = {
	status: (code: number) => Res;
	json: (payload: unknown) => void;
	setHeader: (name: string, value: string) => void;
};

type LoginBody = {
	identifier?: string;
	password?: string;
};

export default async function handler(req: Req, res: Res): Promise<void> {
	if (req.method !== 'POST') {
		methodNotAllowed(res, ['POST']);
		return;
	}

	const body = await readJsonBody<LoginBody>(req);
	const identifier = (body.identifier || '').trim().toLowerCase();
	const password = body.password || '';

	if (!identifier || !password) {
		badRequest(res, 'Identifier and password are required.');
		return;
	}

	try {
		await ensureSchema();

		const found = await query<{
			id: number;
			email: string;
			username: string;
			password_hash: string;
		}>`
			SELECT id, email, username, password_hash
			FROM users
			WHERE lower(email) = ${identifier}
			   OR lower(username) = ${identifier}
			LIMIT 1
		`;

		const user = found[0];
		if (!user) {
			res.status(401).json({ ok: false, error: 'Invalid credentials.' });
			return;
		}

		const validPassword = await bcrypt.compare(password, user.password_hash);
		if (!validPassword) {
			res.status(401).json({ ok: false, error: 'Invalid credentials.' });
			return;
		}

		await query`
			UPDATE users
			SET last_login_at = NOW()
			WHERE id = ${user.id}
		`;

		await query`
			INSERT INTO player_stats (user_id)
			VALUES (${user.id})
			ON CONFLICT (user_id) DO NOTHING
		`;

		await setSessionCookie(res, user.id);
		res.status(200).json({
			ok: true,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
			},
		});
	} catch (error) {
		console.error('Login error', error);
		res.status(500).json({ ok: false, error: 'Failed to login.' });
	}
}
