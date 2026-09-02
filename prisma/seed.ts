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
      ['Slack', 'Team communication and incident collaboration', 'https://app.slack.com'],
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
  await db.appUsage.deleteMany({ where: { userId: member.id } });
  await db.appUsage.createMany({
    data: apps.slice(0, 2).map((app, index) => ({
      applicationId: app.id,
      userId: member.id,
      usedAt: new Date(Date.now() - index * 3_600_000),
    })),
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
  const developerRole = await db.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Developer' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Developer',
      description: 'Engineering tools and development environments',
    },
  });
  const memberMembership = await db.membership.findUniqueOrThrow({
    where: { organizationId_userId: { organizationId: org.id, userId: member.id } },
  });
  for (const assignedRole of [role, developerRole]) {
    await db.membershipRole.upsert({
      where: {
        membershipId_roleId: { membershipId: memberMembership.id, roleId: assignedRole.id },
      },
      update: {},
      create: { membershipId: memberMembership.id, roleId: assignedRole.id },
    });
  }
  const engineering = await db.group.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Engineering' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Engineering',
      description: 'Product engineers with development and observability access',
    },
  });
  const operations = await db.group.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Operations' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Operations',
      description: 'On-call operators responsible for production services',
    },
  });
  for (const group of [engineering, operations]) {
    await db.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: member.id } },
      update: {},
      create: { groupId: group.id, userId: member.id },
    });
  }
  for (const [group, app] of [
    [engineering, apps[0]],
    [engineering, apps[1]],
    [operations, apps[1]],
    [operations, apps[3]],
    [engineering, apps[4]],
  ] as const) {
    await db.applicationAssignment.upsert({
      where: { applicationId_groupId: { applicationId: app.id, groupId: group.id } },
      update: {},
      create: { applicationId: app.id, groupId: group.id, entitlements: ['member'] },
    });
  }
  console.info('Seeded demo accounts: admin@acme.test and user@acme.test / DemoPassword123!');
}
main().finally(() => db.$disconnect());
