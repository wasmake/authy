import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import type { ZodType } from 'zod';

import { checkRateLimit } from '@/modules/security/rate-limit';

export type ApiError = { error: { code: string; message: string; details?: unknown } };
export type Page<T> = { data: T[]; pagination: { page: number; pageSize: number; total: number } };

export function apiHandler(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    try {
      checkRateLimit(
        String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown'),
      );
      await handler(req, res);
    } catch (error) {
      const value = error as { statusCode?: number; message?: string; issues?: unknown };
      const status = value.statusCode ?? (value.issues ? 400 : 500);
      res.status(status).json({
        error: {
          code: statusCode(status),
          message: status === 500 ? 'Internal server error' : (value.message ?? 'Request failed'),
          ...(value.issues ? { details: value.issues } : {}),
        },
      });
    }
  };
}

export function parseBody<T>(schema: ZodType<T>, req: NextApiRequest): T {
  return schema.parse(req.body);
}
export function method(req: NextApiRequest, res: NextApiResponse, allowed: string[]): boolean {
  if (req.method && allowed.includes(req.method)) return true;
  res
    .setHeader('Allow', allowed)
    .status(405)
    .json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  return false;
}
function statusCode(status: number): string {
  return (
    (
      {
        400: 'VALIDATION_ERROR',
        401: 'UNAUTHENTICATED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        429: 'RATE_LIMITED',
      } as Record<number, string>
    )[status] ?? 'INTERNAL_ERROR'
  );
}
