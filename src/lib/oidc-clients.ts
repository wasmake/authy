import { z } from 'zod';

const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.hash;
    },
    { message: 'Must be an HTTP(S) URL without a fragment' },
  );

const oidcClientSchema = z
  .object({
    clientId: z.string().trim().min(1).max(255),
    clientSecret: z.string().min(32),
    redirectUri: httpUrl,
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    launchUrl: httpUrl.optional(),
  })
  .strict();

export type ConfiguredOidcClient = z.infer<typeof oidcClientSchema>;

function formatValidationError(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : 'value'}: ${issue.message}`)
    .join('; ');
}

export function parseOidcClients(
  value: string | undefined,
  legacyClientId?: string,
): ConfiguredOidcClient[] {
  if (!value?.trim()) return [];

  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    throw new Error('Invalid OIDC_CLIENTS_JSON: expected a JSON array');
  }

  const result = z.array(oidcClientSchema).max(100).safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid OIDC_CLIENTS_JSON: ${formatValidationError(result.error)}`);
  }

  const clientIds = new Set<string>();
  for (const client of result.data) {
    if (clientIds.has(client.clientId)) {
      throw new Error(`Invalid OIDC_CLIENTS_JSON: duplicate clientId "${client.clientId}"`);
    }
    if (client.clientId === legacyClientId) {
      throw new Error(
        `Invalid OIDC_CLIENTS_JSON: clientId "${client.clientId}" duplicates OIDC_CLIENT_ID`,
      );
    }
    clientIds.add(client.clientId);
  }

  return result.data;
}
