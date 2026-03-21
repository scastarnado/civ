import { methodNotAllowed } from '../_lib/request';
import { clearSessionCookie } from '../_lib/session';

type Req = { method?: string };
type Res = {
	status: (code: number) => Res;
	json: (payload: unknown) => void;
	setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res): Promise<void> {
	if (req.method !== 'POST') {
		methodNotAllowed(res, ['POST']);
		return;
	}

	clearSessionCookie(res);
	res.status(200).json({ ok: true });
}
