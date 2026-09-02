-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('USER_CREDENTIALS', 'PASSWORD_RESET', 'INVITATION');

-- CreateTable
CREATE TABLE "EmailProviderConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resendApiKeyEncrypted" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyTo" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailProviderConfig_organizationId_key" ON "EmailProviderConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_organizationId_type_key" ON "EmailTemplate"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "EmailProviderConfig" ADD CONSTRAINT "EmailProviderConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
