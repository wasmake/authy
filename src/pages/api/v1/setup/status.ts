import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET'])) return;

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const userCount = await db.user.count();
  res.json({ data: { setupRequired: userCount === 0 } });
});
