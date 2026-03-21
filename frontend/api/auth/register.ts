import bcrypt from 'bcryptjs';

import { ensureSchema, query } from '../_lib/db';
import { badRequest, methodNotAllowed, readJsonBody } from '../_lib/request';
import { setSessionCookie } from '../_lib/session';

type Req = { method?: string; body?: unknown; on?: any };
type Res = {
	status: (code: number) => Res;
	json: (payload: unknown) => void;
	setHeader: (name: string, value: string) => void;
};

type RegisterBody = {
	email?: string;
	username?: string;
	password?: string;
};

export default async function handler(req: Req, res: Res): Promise<void> {
	if (req.method !== 'POST') {
		methodNotAllowed(res, ['POST']);
		return;
	}

	const body = await readJsonBody<RegisterBody>(req);
	const email = (body.email || '').trim().toLowerCase();
	const username = (body.username || '').trim();
	const password = body.password || '';

	if (!email || !username || !password) {
		badRequest(res, 'Email, username and password are required.');
		return;
	}
	if (!email.includes('@')) {
		badRequest(res, 'Invalid email format.');
		return;
	}
	if (username.length < 3 || username.length > 32) {
		badRequest(res, 'Username must be between 3 and 32 characters.');
		return;
	}
	if (password.length < 8) {
		badRequest(res, 'Password must be at least 8 characters.');
		return;
	}

	try {
		await ensureSchema();

		const existing = await query<{ id: number }>`
			SELECT id
			FROM users
			WHERE lower(email) = ${email}
			   OR lower(username) = ${username.toLowerCase()}
			LIMIT 1
		`;

		if (existing.length > 0) {
			res.status(409).json({ ok: false, error: 'Email or username already exists.' });
			return;
		}

		const passwordHash = await bcrypt.hash(password, 12);
		const created = await query<{
			id: number;
			email: string;
			username: string;
		}>`
			INSERT INTO users (email, username, password_hash, last_login_at)
			VALUES (${email}, ${username}, ${passwordHash}, NOW())
			RETURNING id, email, username
		`;

		const user = created[0];
		await query`
			INSERT INTO player_stats (user_id)
			VALUES (${user.id})
			ON CONFLICT (user_id) DO NOTHING
		`;

		await setSessionCookie(res, user.id);
		res.status(201).json({
			ok: true,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
			},
		});
	} catch (error) {
		console.error('Register error', error);
		res.status(500).json({ ok: false, error: 'Failed to create account.' });
	}
}
