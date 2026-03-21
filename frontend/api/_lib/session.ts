import { parse, serialize } from 'cookie';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'civ_session';
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;

type AnyReq = { headers?: { cookie?: string } };
type AnyRes = { setHeader: (name: string, value: string) => void };

function getSecret(): Uint8Array {
	const rawSecret = process.env.AUTH_SECRET;
	if (!rawSecret || rawSecret.length < 32) {
		throw new Error('AUTH_SECRET must be set and at least 32 characters long.');
	}
	return new TextEncoder().encode(rawSecret);
}

export async function createSessionToken(userId: number): Promise<string> {
	return await new SignJWT({ sub: String(userId), type: 'session' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(`${SESSION_AGE_SECONDS}s`)
		.sign(getSecret());
}

export async function getSessionUserId(req: AnyReq): Promise<number | null> {
	const cookieHeader = req.headers?.cookie || '';
	const cookies = parse(cookieHeader || '');
	const token = cookies[SESSION_COOKIE_NAME];
	if (!token) return null;

	try {
		const verification = await jwtVerify(token, getSecret());
		const sub = verification.payload.sub;
		if (!sub) return null;
		const userId = Number(sub);
		if (!Number.isFinite(userId) || userId <= 0) return null;
		return userId;
	} catch {
		return null;
	}
}

export async function setSessionCookie(
	res: AnyRes,
	userId: number,
): Promise<void> {
	const token = await createSessionToken(userId);
	const cookie = serialize(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: SESSION_AGE_SECONDS,
	});
	res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res: AnyRes): void {
	const cookie = serialize(SESSION_COOKIE_NAME, '', {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	});
	res.setHeader('Set-Cookie', cookie);
}
