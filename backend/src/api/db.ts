import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error('DATABASE_URL is required');
}

export const db = new Pool({
	connectionString: DATABASE_URL,
	ssl:
		DATABASE_URL.includes('sslmode=require') ?
			{ rejectUnauthorized: false }
		:	undefined,
});

export async function initializeDatabase(): Promise<void> {
	await db.query(`
		CREATE TABLE IF NOT EXISTS users (
			id BIGSERIAL PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			email TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	await db.query(`
		CREATE TABLE IF NOT EXISTS user_sessions (
			token TEXT PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	await db.query(`
		CREATE TABLE IF NOT EXISTS password_reset_tokens (
			id BIGSERIAL PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT UNIQUE NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			used_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	await db.query(`
		CREATE TABLE IF NOT EXISTS civilizations (
			id BIGSERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			governance_type TEXT NOT NULL CHECK (governance_type IN ('community', 'government')),
			created_by BIGINT NOT NULL REFERENCES users(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`);

	await db.query(`
		CREATE TABLE IF NOT EXISTS civilization_members (
			id BIGSERIAL PRIMARY KEY,
			civilization_id BIGINT NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
			user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role TEXT NOT NULL CHECK (role IN ('ruler', 'councilor', 'officer', 'citizen')),
			joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(civilization_id, user_id)
		);
	`);

	await db.query(`
		CREATE TABLE IF NOT EXISTS civilization_join_requests (
			id BIGSERIAL PRIMARY KEY,
			civilization_id BIGINT NOT NULL REFERENCES civilizations(id) ON DELETE CASCADE,
			requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
			decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			decided_at TIMESTAMPTZ,
			UNIQUE(civilization_id, requester_id)
		);
	`);
}
