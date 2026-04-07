import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { db } from './db';
import { clearSessionCookie, createSession, deleteSessionByToken, requireAuth, resolveAuthUser, setSessionCookie } from './auth';
const app = express();
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash)
        return false;
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}
function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
async function getGovernanceType(civilizationId) {
    const result = await db.query(`SELECT governance_type FROM civilizations WHERE id = $1`, [civilizationId]);
    if (result.rowCount === 0)
        return null;
    return result.rows[0].governance_type;
}
async function getMemberRole(civilizationId, userId) {
    const result = await db.query(`SELECT role FROM civilization_members WHERE civilization_id = $1 AND user_id = $2`, [civilizationId, userId]);
    if (result.rowCount === 0)
        return null;
    return result.rows[0].role;
}
function canManageJoinRequests(role, governanceType) {
    if (governanceType === 'community') {
        return true;
    }
    return role === 'ruler' || role === 'councilor' || role === 'officer';
}
function isUniqueViolation(error) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
async function getUserPrimaryCivilization(userId, client = db) {
    const result = await client.query(`SELECT c.id, c.name, c.governance_type, m.role
		 FROM civilization_members m
		 JOIN civilizations c ON c.id = m.civilization_id
		 WHERE m.user_id = $1
		 ORDER BY m.joined_at ASC
		 LIMIT 1`, [userId]);
    if (result.rowCount === 0)
        return null;
    const row = result.rows[0];
    return {
        id: Number(row.id),
        name: row.name,
        governanceType: row.governance_type,
        role: row.role,
    };
}
function makePersonalCivName(username, attempt) {
    const base = `${username}'s Civilization`;
    if (attempt === 0)
        return base;
    return `${base} ${attempt + 1}`;
}
async function createPersonalCivilization(userId, username, client) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const civName = makePersonalCivName(username, attempt);
        try {
            const created = await client.query(`INSERT INTO civilizations (name, description, governance_type, created_by)
				 VALUES ($1, $2, 'community', $3)
				 RETURNING id, name, governance_type`, [civName, `Personal civilization for ${username}`, userId]);
            const civRow = created.rows[0];
            await client.query(`INSERT INTO civilization_members (civilization_id, user_id, role)
				 VALUES ($1, $2, 'ruler')`, [Number(civRow.id), userId]);
            return {
                id: Number(civRow.id),
                name: civRow.name,
                governanceType: civRow.governance_type,
                role: 'ruler',
            };
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                continue;
            }
            throw error;
        }
    }
    throw new Error('Could not generate a unique civilization name');
}
async function ensureUserHasCivilization(userId, username) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
        const existing = await getUserPrimaryCivilization(userId, client);
        if (existing) {
            await client.query('COMMIT');
            return existing;
        }
        const created = await createPersonalCivilization(userId, username, client);
        await client.query('COMMIT');
        return created;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});
app.post('/api/auth/register', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const email = String(req.body?.email || '').trim() || null;
    if (username.length < 3 || password.length < 6) {
        res.status(400).json({ ok: false, error: 'Username or password too short' });
        return;
    }
    const passwordHash = hashPassword(password);
    try {
        const result = await db.query(`INSERT INTO users (username, password_hash, email)
			 VALUES ($1, $2, $3)
			 RETURNING id, username`, [username, passwordHash, email]);
        const row = result.rows[0];
        const token = await createSession(Number(row.id));
        const civilization = await ensureUserHasCivilization(Number(row.id), row.username);
        setSessionCookie(res, token);
        res.json({
            ok: true,
            user: { id: Number(row.id), username: row.username },
            civilization,
        });
    }
    catch {
        res.status(409).json({ ok: false, error: 'Username already exists' });
    }
});
app.post('/api/auth/forgot-password', async (req, res) => {
    const identifier = String(req.body?.identifier || '').trim();
    if (!identifier) {
        res.status(400).json({ ok: false, error: 'Username or email is required' });
        return;
    }
    const userResult = await db.query(`SELECT id, username FROM users WHERE username = $1 OR email = $1 LIMIT 1`, [identifier]);
    if ((userResult.rowCount ?? 0) === 0) {
        res.json({
            ok: true,
            message: 'If the account exists, a reset token has been generated.',
        });
        return;
    }
    const userRow = userResult.rows[0];
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
    await db.query(`DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`, [Number(userRow.id)]);
    await db.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`, [Number(userRow.id), tokenHash, expiresAt]);
    res.json({
        ok: true,
        message: 'Reset token generated. Use it to set a new password.',
        resetToken: rawToken,
        expiresInMinutes: Math.floor(PASSWORD_RESET_TTL_MS / 60000),
    });
});
app.post('/api/auth/reset-password', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!token || newPassword.length < 6) {
        res.status(400).json({ ok: false, error: 'Token and valid new password are required' });
        return;
    }
    const tokenHash = hashResetToken(token);
    const tokenResult = await db.query(`SELECT id, user_id
		 FROM password_reset_tokens
		 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
		 LIMIT 1`, [tokenHash]);
    if ((tokenResult.rowCount ?? 0) === 0) {
        res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });
        return;
    }
    const tokenRow = tokenResult.rows[0];
    const newPasswordHash = hashPassword(newPassword);
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newPasswordHash, Number(tokenRow.user_id)]);
        await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [Number(tokenRow.id)]);
        await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [Number(tokenRow.user_id)]);
        await client.query('COMMIT');
        clearSessionCookie(res);
        res.json({ ok: true, message: 'Password reset successful. Please login again.' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
});
app.post('/api/auth/login', async (req, res) => {
    const identifier = String(req.body?.identifier || req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!identifier || !password) {
        res.status(400).json({ ok: false, error: 'Missing credentials' });
        return;
    }
    const result = await db.query(`SELECT id, username, password_hash FROM users WHERE username = $1 OR email = $1 LIMIT 1`, [identifier]);
    if (result.rowCount === 0) {
        res.status(401).json({ ok: false, error: 'Invalid credentials' });
        return;
    }
    const row = result.rows[0];
    if (!verifyPassword(password, row.password_hash)) {
        res.status(401).json({ ok: false, error: 'Invalid credentials' });
        return;
    }
    const token = await createSession(Number(row.id));
    const civilization = await ensureUserHasCivilization(Number(row.id), row.username);
    setSessionCookie(res, token);
    res.json({
        ok: true,
        user: { id: Number(row.id), username: row.username },
        civilization,
    });
});
app.post('/api/auth/logout', async (req, res) => {
    const cookies = req.headers.cookie || '';
    const tokenMatch = cookies.match(/civ_session=([^;]+)/);
    if (tokenMatch?.[1]) {
        await deleteSessionByToken(tokenMatch[1]);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
});
app.get('/api/auth/me', async (req, res) => {
    const user = await resolveAuthUser(req);
    if (!user) {
        res.status(401).json({ ok: false });
        return;
    }
    const civilization = await ensureUserHasCivilization(user.id, user.username);
    res.json({ ok: true, user, civilization });
});
app.post('/api/civs', requireAuth, async (req, res) => {
    const user = req.authUser;
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const governanceType = String(req.body?.governanceType || '').trim();
    if (!name || (governanceType !== 'community' && governanceType !== 'government')) {
        res.status(400).json({ ok: false, error: 'Invalid civilization payload' });
        return;
    }
    const created = await db.query(`INSERT INTO civilizations (name, description, governance_type, created_by)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, description, governance_type`, [name, description, governanceType, user.id]);
    const civ = created.rows[0];
    await db.query(`INSERT INTO civilization_members (civilization_id, user_id, role) VALUES ($1, $2, 'ruler')`, [Number(civ.id), user.id]);
    res.json({
        ok: true,
        civilization: {
            id: Number(civ.id),
            name: civ.name,
            description: civ.description,
            governanceType: civ.governance_type,
        },
    });
});
app.get('/api/civs/:id', requireAuth, async (req, res) => {
    const civilizationId = Number(req.params.id);
    if (!Number.isFinite(civilizationId)) {
        res.status(400).json({ ok: false, error: 'Invalid civilization id' });
        return;
    }
    const civResult = await db.query(`SELECT id, name, description, governance_type, created_at FROM civilizations WHERE id = $1`, [civilizationId]);
    if (civResult.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'Civilization not found' });
        return;
    }
    const membersResult = await db.query(`SELECT m.user_id, u.username, m.role, m.joined_at
		 FROM civilization_members m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.civilization_id = $1
		 ORDER BY m.joined_at ASC`, [civilizationId]);
    const pendingRequestsResult = await db.query(`SELECT r.id, r.requester_id, u.username AS requester_username, r.created_at
		 FROM civilization_join_requests r
		 JOIN users u ON u.id = r.requester_id
		 WHERE r.civilization_id = $1 AND r.status = 'pending'
		 ORDER BY r.created_at ASC`, [civilizationId]);
    const civ = civResult.rows[0];
    res.json({
        ok: true,
        civilization: {
            id: Number(civ.id),
            name: civ.name,
            description: civ.description,
            governanceType: civ.governance_type,
            createdAt: civ.created_at,
            members: membersResult.rows.map((row) => ({
                userId: Number(row.user_id),
                username: row.username,
                role: row.role,
                joinedAt: row.joined_at,
            })),
            pendingJoinRequests: pendingRequestsResult.rows.map((row) => ({
                id: Number(row.id),
                requesterId: Number(row.requester_id),
                requesterUsername: row.requester_username,
                createdAt: row.created_at,
            })),
        },
    });
});
app.get('/api/civs/my', requireAuth, async (req, res) => {
    const user = req.authUser;
    const result = await db.query(`SELECT c.id, c.name, c.description, c.governance_type, m.role
		 FROM civilization_members m
		 JOIN civilizations c ON c.id = m.civilization_id
		 WHERE m.user_id = $1`, [user.id]);
    res.json({
        ok: true,
        civilizations: result.rows.map((row) => ({
            id: Number(row.id),
            name: row.name,
            description: row.description,
            governanceType: row.governance_type,
            role: row.role,
        })),
    });
});
app.post('/api/civs/:id/join-request', requireAuth, async (req, res) => {
    const user = req.authUser;
    const civilizationId = Number(req.params.id);
    if (!Number.isFinite(civilizationId)) {
        res.status(400).json({ ok: false, error: 'Invalid civilization id' });
        return;
    }
    const alreadyMember = await db.query(`SELECT 1 FROM civilization_members WHERE civilization_id = $1 AND user_id = $2`, [civilizationId, user.id]);
    if ((alreadyMember.rowCount ?? 0) > 0) {
        res.status(400).json({ ok: false, error: 'Already a member' });
        return;
    }
    try {
        await db.query(`INSERT INTO civilization_join_requests (civilization_id, requester_id, status)
			 VALUES ($1, $2, 'pending')`, [civilizationId, user.id]);
        res.json({ ok: true });
    }
    catch {
        res.status(409).json({ ok: false, error: 'Join request already exists' });
    }
});
app.post('/api/civs/:id/join-requests/:requestId/decide', requireAuth, async (req, res) => {
    const user = req.authUser;
    const civilizationId = Number(req.params.id);
    const requestId = Number(req.params.requestId);
    const approve = Boolean(req.body?.approve);
    if (!Number.isFinite(civilizationId) || !Number.isFinite(requestId)) {
        res.status(400).json({ ok: false, error: 'Invalid parameters' });
        return;
    }
    const governanceType = await getGovernanceType(civilizationId);
    if (!governanceType) {
        res.status(404).json({ ok: false, error: 'Civilization not found' });
        return;
    }
    const role = await getMemberRole(civilizationId, user.id);
    if (!role || !canManageJoinRequests(role, governanceType)) {
        res.status(403).json({ ok: false, error: 'Insufficient permissions' });
        return;
    }
    const requestResult = await db.query(`SELECT requester_id, status FROM civilization_join_requests WHERE id = $1 AND civilization_id = $2`, [requestId, civilizationId]);
    if (requestResult.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'Join request not found' });
        return;
    }
    const requestRow = requestResult.rows[0];
    if (requestRow.status !== 'pending') {
        res.status(400).json({ ok: false, error: 'Join request already resolved' });
        return;
    }
    const status = approve ? 'approved' : 'rejected';
    await db.query(`UPDATE civilization_join_requests
		 SET status = $1, decided_by = $2, decided_at = NOW()
		 WHERE id = $3`, [status, user.id, requestId]);
    if (approve) {
        await db.query(`INSERT INTO civilization_members (civilization_id, user_id, role)
			 VALUES ($1, $2, 'citizen')
			 ON CONFLICT (civilization_id, user_id) DO NOTHING`, [civilizationId, Number(requestRow.requester_id)]);
    }
    res.json({ ok: true, status });
});
app.post('/api/civs/:id/members/:memberId/role', requireAuth, async (req, res) => {
    const user = req.authUser;
    const civilizationId = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    const nextRole = String(req.body?.role || '').trim();
    if (!['ruler', 'councilor', 'officer', 'citizen'].includes(nextRole)) {
        res.status(400).json({ ok: false, error: 'Invalid role' });
        return;
    }
    const callerRole = await getMemberRole(civilizationId, user.id);
    if (callerRole !== 'ruler') {
        res.status(403).json({ ok: false, error: 'Only ruler can change roles' });
        return;
    }
    await db.query(`UPDATE civilization_members SET role = $1 WHERE civilization_id = $2 AND user_id = $3`, [nextRole, civilizationId, memberId]);
    res.json({ ok: true });
});
export default app;
//# sourceMappingURL=app.js.map