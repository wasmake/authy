-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('GOOGLE', 'MICROSOFT', 'SLACK', 'ACTIVE_DIRECTORY');

-- CreateEnum
CREATE TYPE "VaultItemType" AS ENUM ('CREDENTIAL', 'SECRET', 'ENVIRONMENT');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "passwordLoginEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyRole" TEXT NOT NULL DEFAULT 'Member',
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthProviderConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AuthProviderType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT NOT NULL,
    "tenantId" TEXT,
    "domainHint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VaultItemType" NOT NULL,
    "username" TEXT,
    "encryptedValue" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultAssignment" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,

    CONSTRAINT "VaultAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VaultAssignment_principal_check" CHECK (num_nonnulls("userId", "groupId") = 1)
);

-- CreateIndex
CREATE INDEX "AuthProviderConfig_enabled_idx" ON "AuthProviderConfig"("enabled");

-- Better Auth provider IDs are process-global, so only one tenant provider can be active.
CREATE UNIQUE INDEX "AuthProviderConfig_one_enabled_key" ON "AuthProviderConfig" (("enabled")) WHERE "enabled" = true;

-- CreateIndex
CREATE UNIQUE INDEX "AuthProviderConfig_organizationId_type_key" ON "AuthProviderConfig"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "VaultItem_organizationId_name_key" ON "VaultItem"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VaultAssignment_vaultItemId_userId_key" ON "VaultAssignment"("vaultItemId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultAssignment_vaultItemId_groupId_key" ON "VaultAssignment"("vaultItemId", "groupId");

-- AddForeignKey
ALTER TABLE "AuthProviderConfig" ADD CONSTRAINT "AuthProviderConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultAssignment" ADD CONSTRAINT "VaultAssignment_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultAssignment" ADD CONSTRAINT "VaultAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultAssignment" ADD CONSTRAINT "VaultAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
