import { ensureSchema, query } from './_lib/db';
import { badRequest, methodNotAllowed, readJsonBody } from './_lib/request';
import { getSessionUserId } from './_lib/session';

type Req = {
	method?: string;
	headers?: { cookie?: string };
	body?: unknown;
	on?: any;
};
type Res = {
	status: (code: number) => Res;
	json: (payload: unknown) => void;
	setHeader: (name: string, value: string) => void;
};

type StatsBody = {
	gamesPlayed?: number;
	wins?: number;
	losses?: number;
	bestScore?: number;
};

async function getOrCreateStats(userId: number) {
	await query`
		INSERT INTO player_stats (user_id)
		VALUES (${userId})
		ON CONFLICT (user_id) DO NOTHING
	`;

	const result = await query<{
		games_played: number;
		wins: number;
		losses: number;
		best_score: number;
		updated_at: string;
	}>`
		SELECT games_played, wins, losses, best_score, updated_at
		FROM player_stats
		WHERE user_id = ${userId}
		LIMIT 1
	`;

	return result[0];
}

export default async function handler(req: Req, res: Res): Promise<void> {
	if (req.method !== 'GET' && req.method !== 'POST') {
		methodNotAllowed(res, ['GET', 'POST']);
		return;
	}

	try {
		await ensureSchema();
		const userId = await getSessionUserId(req);
		if (!userId) {
			res.status(401).json({ ok: false, error: 'Not authenticated.' });
			return;
		}

		if (req.method === 'GET') {
			const stats = await getOrCreateStats(userId);
			res.status(200).json({
				ok: true,
				stats: {
					gamesPlayed: stats.games_played,
					wins: stats.wins,
					losses: stats.losses,
					bestScore: stats.best_score,
					updatedAt: stats.updated_at,
				},
			});
			return;
		}

		const payload = await readJsonBody<StatsBody>(req);
		const nextGamesPlayed = payload.gamesPlayed;
		const nextWins = payload.wins;
		const nextLosses = payload.losses;
		const nextBestScore = payload.bestScore;

		const values = [nextGamesPlayed, nextWins, nextLosses, nextBestScore];
		if (!values.some((value) => typeof value === 'number')) {
			badRequest(res, 'Provide at least one numeric stats field to update.');
			return;
		}

		await getOrCreateStats(userId);
		await query`
			UPDATE player_stats
			SET games_played = COALESCE(${nextGamesPlayed ?? null}, games_played),
				wins = COALESCE(${nextWins ?? null}, wins),
				losses = COALESCE(${nextLosses ?? null}, losses),
				best_score = COALESCE(${nextBestScore ?? null}, best_score),
				updated_at = NOW()
			WHERE user_id = ${userId}
		`;

		const stats = await getOrCreateStats(userId);
		res.status(200).json({
			ok: true,
			stats: {
				gamesPlayed: stats.games_played,
				wins: stats.wins,
				losses: stats.losses,
				bestScore: stats.best_score,
				updatedAt: stats.updated_at,
			},
		});
	} catch (error) {
		console.error('Stats endpoint error', error);
		res
			.status(500)
			.json({ ok: false, error: 'Failed to handle stats request.' });
	}
}
