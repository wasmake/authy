import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const employeePermissions = [
  ['applications:read', 'View assigned and published applications'],
  ['vault:read', 'View assigned vault items'],
  ['access-requests:create', 'Request access to published applications'],
] as const;

async function main() {
  const organizations = await db.organization.findMany({ select: { id: true } });
  if (organizations.length === 0) {
    console.info(
      'Database is uninitialized; complete /setup before seeding optional catalog data.',
    );
    return;
  }

  const permissions = await Promise.all(
    employeePermissions.map(([key, description]) =>
      db.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );

  for (const organization of organizations) {
    const employee = await db.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'Employee' } },
      update: { description: 'Standard workforce access' },
      create: {
        organizationId: organization.id,
        name: 'Employee',
        description: 'Standard workforce access',
      },
    });
    await db.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: employee.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.info(`Seeded optional permission catalog for ${organizations.length} organization(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
