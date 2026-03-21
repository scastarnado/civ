import { neon } from '@neondatabase/serverless';

let schemaReadyPromise: Promise<void> | null = null;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL (or POSTGRES_URL) must be set for API database access.',
	);
}

const db = neon(databaseUrl);

export async function query<T = Record<string, unknown>>(
	strings: TemplateStringsArray,
	...params: unknown[]
): Promise<T[]> {
	return (await db(strings, ...params)) as T[];
}

export async function ensureSchema(): Promise<void> {
	if (!schemaReadyPromise) {
		schemaReadyPromise = (async () => {
			await query`
				CREATE TABLE IF NOT EXISTS users (
					id SERIAL PRIMARY KEY,
					email TEXT NOT NULL UNIQUE,
					username TEXT NOT NULL UNIQUE,
					password_hash TEXT NOT NULL,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					last_login_at TIMESTAMPTZ
				)
			`;

			await query`
				CREATE TABLE IF NOT EXISTS player_stats (
					user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
					games_played INTEGER NOT NULL DEFAULT 0,
					wins INTEGER NOT NULL DEFAULT 0,
					losses INTEGER NOT NULL DEFAULT 0,
					best_score INTEGER NOT NULL DEFAULT 0,
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`;
		})();
	}

	await schemaReadyPromise;
}
