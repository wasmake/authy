import type { NextApiRequest, NextApiResponse } from 'next';

import { db } from '@/lib/db';
export default async function health(_req: NextApiRequest, res: NextApiResponse) {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
}
