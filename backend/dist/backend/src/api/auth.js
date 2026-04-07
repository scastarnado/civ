import crypto from 'crypto';
import cookie from 'cookie';
import { db } from './db';
const SESSION_COOKIE = 'civ_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
function parseCookies(req) {
    const rawCookie = req.headers.cookie || '';
    return cookie.parse(rawCookie);
}
export function setSessionCookie(res, token) {
    const serialized = cookie.serialize(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    res.setHeader('Set-Cookie', serialized);
}
export function clearSessionCookie(res) {
    const serialized = cookie.serialize(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    res.setHeader('Set-Cookie', serialized);
}
export async function createSession(userId) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await db.query(`INSERT INTO user_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`, [token, userId, expiresAt]);
    return token;
}
export async function deleteSessionByToken(token) {
    await db.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
}
export async function requireAuth(req, res, next) {
    const cookies = parseCookies(req);
    const sessionToken = cookies[SESSION_COOKIE];
    if (!sessionToken) {
        res.status(401).json({ ok: false, error: 'Unauthorized' });
        return;
    }
    const result = await db.query(`SELECT u.id, u.username
		 FROM user_sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.token = $1 AND s.expires_at > NOW()`, [sessionToken]);
    if (result.rowCount === 0) {
        res.status(401).json({ ok: false, error: 'Unauthorized' });
        return;
    }
    const row = result.rows[0];
    req.authUser = {
        id: Number(row.id),
        username: row.username,
    };
    next();
}
export async function resolveAuthUser(req) {
    const cookies = parseCookies(req);
    const sessionToken = cookies[SESSION_COOKIE];
    if (!sessionToken)
        return null;
    const result = await db.query(`SELECT u.id, u.username
		 FROM user_sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.token = $1 AND s.expires_at > NOW()`, [sessionToken]);
    if (result.rowCount === 0)
        return null;
    const row = result.rows[0];
    return { id: Number(row.id), username: row.username };
}
//# sourceMappingURL=auth.js.map