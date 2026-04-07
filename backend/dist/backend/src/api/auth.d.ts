import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from './types';
declare global {
    namespace Express {
        interface Request {
            authUser?: AuthenticatedUser;
        }
    }
}
export declare function setSessionCookie(res: Response, token: string): void;
export declare function clearSessionCookie(res: Response): void;
export declare function createSession(userId: number): Promise<string>;
export declare function deleteSessionByToken(token: string): Promise<void>;
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function resolveAuthUser(req: Request): Promise<AuthenticatedUser | null>;
//# sourceMappingURL=auth.d.ts.map