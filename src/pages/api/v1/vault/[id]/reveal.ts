import { apiHandler, method } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireContext } from '@/modules/auth/context';
import { decryptSecret } from '@/modules/security/encryption';
import { accessibleVaultWhere } from '@/modules/vault/service';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['POST'])) return;
  const context = await requireContext(req);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  const id = String(req.query.id);
  const item = await db.vaultItem.findFirst({
    where: { id, ...accessibleVaultWhere(context) },
    select: { id: true, type: true, encryptedValue: true },
  });
  if (!item) throw Object.assign(new Error('Vault item not found'), { statusCode: 404 });

  const value = decryptSecret(item.encryptedValue);
  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'vault_item.revealed',
    targetType: 'vault_item',
    targetId: item.id,
    ipAddress: requestIp(req),
    metadata: { type: item.type },
  });
  res.json({ data: { id: item.id, type: item.type, value } });
});

function requestIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}) {
  const forwarded = req.headers['x-forwarded-for'];
  return (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
    req.socket.remoteAddress
  );
}
