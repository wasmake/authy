import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { encryptSecret } from '@/modules/security/encryption';
import { updateVaultItemSchema } from '@/modules/vault/schemas';
import {
  ensureVaultNameAvailable,
  secretFromUpdateInput,
  vaultAssignmentRows,
  vaultMetadataSelect,
  verifyVaultAssignments,
} from '@/modules/vault/service';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['PATCH', 'DELETE'])) return;
  const context = await requireContext(req);
  requireAdmin(context);
  res.setHeader('Cache-Control', 'private, no-store');

  const id = String(req.query.id);
  const existing = await db.vaultItem.findFirst({
    where: { id, organizationId: context.organizationId },
    select: { id: true, type: true },
  });
  if (!existing) throw Object.assign(new Error('Vault item not found'), { statusCode: 404 });

  if (req.method === 'DELETE') {
    await db.vaultItem.delete({ where: { id } });
    await audit({
      organizationId: context.organizationId,
      actorId: context.userId,
      action: 'vault_item.deleted',
      targetType: 'vault_item',
      targetId: id,
      ipAddress: requestIp(req),
      metadata: { type: existing.type },
    });
    res.status(204).end();
    return;
  }

  const input = parseBody(updateVaultItemSchema, req);
  if (input.type !== existing.type) {
    throw Object.assign(new Error('A vault item type cannot be changed'), { statusCode: 400 });
  }
  await Promise.all([
    verifyVaultAssignments(context.organizationId, input),
    ensureVaultNameAvailable(context.organizationId, input.name, id),
  ]);

  const replacementSecret = secretFromUpdateInput(input);
  const item = await db.$transaction(async (transaction) => {
    await transaction.vaultAssignment.deleteMany({ where: { vaultItemId: id } });
    const assignments = vaultAssignmentRows(id, input);
    if (assignments.length) await transaction.vaultAssignment.createMany({ data: assignments });
    return transaction.vaultItem.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        username: input.type === 'CREDENTIAL' ? input.username : null,
        ...(replacementSecret === undefined
          ? {}
          : { encryptedValue: encryptSecret(replacementSecret) }),
      },
      select: vaultMetadataSelect,
    });
  });

  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'vault_item.updated',
    targetType: 'vault_item',
    targetId: id,
    ipAddress: requestIp(req),
    metadata: {
      type: item.type,
      secretRotated: replacementSecret !== undefined,
      userAssignments: input.userIds.length,
      groupAssignments: input.groupIds.length,
    },
  });
  res.json({ data: item });
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
