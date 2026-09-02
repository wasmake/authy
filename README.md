# Authy

![Next.js](https://img.shields.io/badge/Next.js-12-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/deployment-Docker_Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

Authy is a modern, self-hosted identity and application access platform inspired by Okta. It gives teams one secure portal for discovering applications, requesting access, launching assigned tools, and administering identities and permissions.

The complete platform is a deliberately simple Next.js modular monolith. The UI, REST API, authentication, authorization, integrations, and business logic ship as one application backed by PostgreSQL. There are no workers, queues, caches, microservices, or orchestration dependencies.

## Screens

### User Portal

Assigned third-party and internally owned applications are presented in a responsive launch dashboard. The demo workspace includes GitHub Enterprise, Grafana, and Notion test tiles.

![Authy user portal with assigned application tiles](docs/screenshots/user-portal.png)

### Admin Portal

Administrators can monitor identity metrics and approve or deny tenant-scoped access requests from one control plane.

![Authy admin portal with metrics and an access request](docs/screenshots/admin-portal.png)

## Capabilities

- Better Auth email/password sign-in, sign-out, recovery hooks, secure sessions, and HTTP-only cookies
- Strict organization membership checks on every protected domain query
- User and administrator capability separation with owner, admin, and member roles
- Searchable application marketplace for OIDC, SAML, link, local, and internal applications
- Direct and group application assignments with application-specific entitlements
- Assigned application launching, favorites, and recent-use data models
- Access-request creation, review, approval, denial, and automatic assignment
- Users, groups, roles, permissions, organizations, API keys, and audit-event data models
- One-time service credential display with hashed storage, rotation-ready metadata, and revocation
- Tenant metrics for users, applications, requests, sign-ins, and security events
- Resend transactional email adapter with a realistic console adapter for local development
- Composio-compatible integration boundary with a seeded local catalog adapter
- Versioned, validated REST endpoints and an OpenAPI 3 specification
- Dark and light themes, responsive layouts, keyboard focus states, and accessible controls

## Quick Start

Requirements: Docker with the Compose plugin.

```bash
cp .env.example .env
# Replace POSTGRES_PASSWORD and BETTER_AUTH_SECRET in .env.
docker compose up --build -d
docker compose exec app npx prisma db seed
```

Open [http://localhost:3000](http://localhost:3000). Both demo accounts use `DemoPassword123!`.

| Experience    | Email             |
| ------------- | ----------------- |
| Administrator | `admin@acme.test` |
| User          | `user@acme.test`  |

The application container applies committed migrations before starting. PostgreSQL data is retained in the `authy-postgres` Docker volume.

## Local Development

Use Node.js 22 and a PostgreSQL instance. Set `DATABASE_URL` in the root `.env` to an address reachable from the host, then run:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The root `.env` is the single runtime configuration source. Use `INTEGRATION_MODE=mock` without provider credentials, or set it to `live` and supply `RESEND_API_KEY` for email delivery.

## Architecture

```text
Browser / Internal application
              |
     Next.js modular monolith
     |       |       |       |
    UI   Better Auth REST  Domain modules
                     API       |
                         Prisma/PostgreSQL
```

```text
src/
  components/          Reusable portal UI
  hooks/               Typed browser data hooks
  lib/                 Database, environment, and API contracts
  modules/
    applications/      Catalog, assignment, and access policies
    audit/             Sensitive-operation audit trail
    auth/              Better Auth client, server, and tenant context
    integrations/      Resend and Composio-compatible adapters
    security/          Credentials and request rate limiting
  pages/
    api/auth/           Better Auth handler
    api/v1/             Versioned platform API
    admin.tsx           Administrator control plane
    index.tsx           Assigned application dashboard
    marketplace.tsx     Application discovery and requests
prisma/                 Schema, migrations, and deterministic seed
tests/                  Jest, RTL, and Playwright suites
```

Route handlers validate transport input and delegate policy and business decisions to domain modules. Provider-specific code remains behind adapters. PostgreSQL is accessed directly through Prisma from the same deployable process.

## Platform API

All platform endpoints are versioned under `/api/v1` and return typed data envelopes or consistent errors:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Administrator access required"
  }
}
```

Available resources include:

- `GET /api/v1/me` for identity, tenant role, roles, and permissions
- `GET|POST /api/v1/applications` for discovery and registration
- `POST /api/v1/applications/{id}/assignments` for user or group assignment
- `GET /api/v1/applications/{id}/launch` for access-checked application launch
- `GET|POST /api/v1/access-requests` for request creation and lookup
- `PATCH /api/v1/access-requests/{id}` for administrator decisions
- `GET|POST /api/v1/api-keys` and `DELETE /api/v1/api-keys/{id}` for service credentials
- `GET /api/v1/audit-events` for paginated tenant audit events
- `GET /api/v1/admin/metrics` for administrator dashboard metrics

The OpenAPI 3 document is served at [`/openapi.yaml`](public/openapi.yaml). OIDC application redirect URIs, scopes, and claims and practical SAML metadata are represented in the catalog model. Link and local applications use the access-checked launch endpoint. Production protocol signing and provider metadata exchange should be completed against the deployment's selected OIDC or SAML provider before enabling federation.

## Security Model

- Server-side authentication and role checks protect all privileged routes.
- Application, group, assignment, request, key, and audit lookups are scoped by organization.
- API keys use cryptographically random values, one-time secret disclosure, SHA-256 storage, and timing-safe comparison.
- Better Auth session cookies are HTTP-only and become secure in production.
- Redirect URIs and application URLs use validated schemas; privileged credentials never enter browser bundles.
- API requests use validation, request rate limits, stable error codes, and sensitive-operation audit logs.
- Default headers include CSP, frame denial, MIME sniffing prevention, referrer policy, and browser permission restrictions.

Before an internet-facing deployment, use high-entropy secrets, TLS at the reverse proxy, a dedicated database role, an external email domain, monitored backups, and provider-specific OIDC/SAML security review.

## Quality And Tests

```bash
npm run lint          # ESLint: TypeScript, React, hooks, imports, a11y
npm run typecheck     # Strict TypeScript without emitting
npm run format        # Write Prettier formatting
npm run format:check  # CI-safe formatting check
npm run test:unit
npm run test:integration
npm run test:coverage
npm run test:e2e
npm run test:all
```

Set `PLAYWRIGHT_BASE_URL=http://localhost:3000` to run browser tests against an existing local or Compose environment. Database integration suites use `.env.test`; `npm run db:reset:test` recreates isolated test data.

## Database Operations

```bash
# Create a development migration
npm run db:migrate:dev -- --name descriptive_name

# Apply committed migrations and optionally seed demo records
npm run db:migrate
npm run db:seed

# Backup
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > authy-backup.sql

# Restore
cat authy-backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

For upgrades, create and verify a backup, pull the new release, review its migration notes, and run `docker compose up --build -d`.

## License

MIT
