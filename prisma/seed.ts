import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const db = new PrismaClient();
async function user(email: string, name: string) {
  const existing = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, emailVerified: true },
  });
  await db.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: existing.id } },
    update: {},
    create: {
      providerId: 'credential',
      accountId: existing.id,
      userId: existing.id,
      password: await hashPassword('DemoPassword123!'),
    },
  });
  return existing;
}
async function main() {
  const [admin, member] = await Promise.all([
    user('admin@acme.test', 'Avery Admin'),
    user('user@acme.test', 'Morgan Member'),
  ]);
  const org = await db.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { name: 'Acme Engineering', slug: 'acme' },
  });
  await Promise.all([
    db.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
      update: { role: 'OWNER' },
      create: { organizationId: org.id, userId: admin.id, role: 'OWNER' },
    }),
    db.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: member.id } },
      update: {},
      create: { organizationId: org.id, userId: member.id, role: 'MEMBER' },
    }),
  ]);
  const apps = await Promise.all(
    [
      [
        'GitHub Enterprise',
        'Source code, reviews, and engineering workflows',
        'https://github.com',
      ],
      ['Grafana', 'Production telemetry and service dashboards', 'https://grafana.com'],
      ['Notion', 'Team knowledge base and project documentation', 'https://notion.so'],
      ['Internal Console', 'Operate Acme services and environments', 'http://localhost:3000'],
    ].map(async ([name, description, launchUrl], index) =>
      db.application.upsert({
        where: { id: `demo-app-${index}` },
        update: {},
        create: {
          id: `demo-app-${index}`,
          organizationId: org.id,
          name,
          description,
          launchUrl,
          type: index === 3 ? 'LOCAL' : 'LINK',
          redirectUris: [],
          scopes: [],
          isPublished: true,
        },
      }),
    ),
  );
  for (const app of apps.slice(0, 3))
    await db.applicationAssignment.upsert({
      where: { applicationId_userId: { applicationId: app.id, userId: member.id } },
      update: {},
      create: { applicationId: app.id, userId: member.id, entitlements: ['user'] },
    });
  const permission = await db.permission.upsert({
    where: { key: 'applications:read' },
    update: {},
    create: { key: 'applications:read', description: 'View assigned applications' },
  });
  const role = await db.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Employee' } },
    update: {},
    create: { organizationId: org.id, name: 'Employee', description: 'Standard workforce access' },
  });
  await db.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    update: {},
    create: { roleId: role.id, permissionId: permission.id },
  });
  console.info('Seeded demo accounts: admin@acme.test and user@acme.test / DemoPassword123!');
}
main().finally(() => db.$disconnect());
