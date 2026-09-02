-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "greeting" TEXT NOT NULL DEFAULT 'Welcome to your workspace',
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#6D5CE7';
