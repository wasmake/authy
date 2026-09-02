import { apiHandler, method, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { audit } from '@/modules/audit/service';
import { requireAdmin, requireContext } from '@/modules/auth/context';
import { encryptSecret } from '@/modules/security/encryption';
import { createVaultItemSchema } from '@/modules/vault/schemas';
import {
  accessibleVaultWhere,
  ensureVaultNameAvailable,
  isVaultAdmin,
  secretFromCreateInput,
  vaultMetadataSelect,
  verifyVaultAssignments,
} from '@/modules/vault/service';

export default apiHandler(async (req, res) => {
  if (!method(req, res, ['GET', 'POST'])) return;
  const context = await requireContext(req);
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'GET') {
    const admin = isVaultAdmin(context);
    const [items, memberships, groups] = await Promise.all([
      db.vaultItem.findMany({
        where: accessibleVaultWhere(context),
        select: vaultMetadataSelect,
        orderBy: { name: 'asc' },
      }),
      admin
        ? db.membership.findMany({
            where: { organizationId: context.organizationId },
            select: {
              user: { select: { id: true, name: true, email: true, suspendedAt: true } },
            },
            orderBy: { user: { name: 'asc' } },
          })
        : Promise.resolve([]),
      admin
        ? db.group.findMany({
            where: { organizationId: context.organizationId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    res.json({
      data: {
        items: admin ? items : items.map((item) => ({ ...item, assignments: [] })),
        isAdmin: admin,
        users: memberships.map(({ user }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          suspended: Boolean(user.suspendedAt),
        })),
        groups,
      },
    });
    return;
  }

  requireAdmin(context);
  const input = parseBody(createVaultItemSchema, req);
  await Promise.all([
    verifyVaultAssignments(context.organizationId, input),
    ensureVaultNameAvailable(context.organizationId, input.name),
  ]);

  const item = await db.vaultItem.create({
    data: {
      organizationId: context.organizationId,
      name: input.name,
      type: input.type,
      username: input.type === 'CREDENTIAL' ? input.username : null,
      encryptedValue: encryptSecret(secretFromCreateInput(input)),
      description: input.description || null,
      assignments: {
        create: [
          ...input.userIds.map((userId) => ({ userId })),
          ...input.groupIds.map((groupId) => ({ groupId })),
        ],
      },
    },
    select: vaultMetadataSelect,
  });

  await audit({
    organizationId: context.organizationId,
    actorId: context.userId,
    action: 'vault_item.created',
    targetType: 'vault_item',
    targetId: item.id,
    ipAddress: requestIp(req),
    metadata: {
      type: item.type,
      userAssignments: input.userIds.length,
      groupAssignments: input.groupIds.length,
    },
  });
  res.status(201).json({ data: item });
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
