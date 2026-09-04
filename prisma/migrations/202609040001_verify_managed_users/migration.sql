-- Authy administrators provision password identities and deliver credentials to their mailbox.
-- These identities do not use a separate email-confirmation workflow.
UPDATE "User" AS "user"
SET
    "emailVerified" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "emailVerified" = false
  AND EXISTS (
      SELECT 1
      FROM "Account"
      WHERE "Account"."userId" = "user"."id"
        AND "Account"."providerId" = 'credential'
        AND "Account"."password" IS NOT NULL
  );
