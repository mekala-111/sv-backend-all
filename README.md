# SV LIVE Backend

Multi-tenant backend for SV LIVE — a YouTube-based event live-streaming platform.
Hierarchy: **Super Admin → Vendor → Customer → Event → Theme / YouTube / Media → Public Viewer**.

Stack: Node.js + Express + TypeScript + MySQL + Prisma + JWT auth + Google (YouTube) OAuth.

## 1. Setup

```bash
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, JWT secrets, TOKEN_ENCRYPTION_KEY, YouTube OAuth creds, etc.
```

Generate a strong `TOKEN_ENCRYPTION_KEY` (used to encrypt YouTube OAuth tokens at rest):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate JWT secrets the same way (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).

## 2. Database

Create a MySQL database, point `DATABASE_URL` at it, then:

```bash
npx prisma generate        # generate the Prisma client (needs network access to Prisma's binary CDN)
npx prisma migrate dev --name init
npm run seed                # permission catalogue, theme categories, super admin user
```

The seed script prints the super admin's login (`admin@svlive.in` / a generated password unless
`SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` are set) — **rotate this password immediately**
after first login. Set `SEED_DEMO_DATA=true` to also seed a demo vendor for local testing.

## 3. Run

```bash
npm run dev     # ts-node-dev, hot reload
npm run build && npm start   # production
```

Health check: `GET /health`

## 4. Architecture notes

- **Tenant isolation**: every vendor-scoped route runs through `attachTenantScope` +
  `vendorScopeWhere`/`assertOwnsVendorRecord` (see `src/middleware/tenantScope.ts`).
  A vendor's JWT never lets it read another vendor's rows, even by guessing IDs.
- **RBAC**: role gate (`requireRole`) for coarse checks, `requirePermission` for the
  fine-grained `role_permissions` / `user_permissions` model seeded in `prisma/seed.ts`.
- **Event links**: `POST /api/events` auto-generates a unique `event_slug`
  (`rahul-weds-priya`, colliding names get a short random suffix). The slug never
  changes on rename — the public link, once shared, stays stable.
- **Public API** (`src/modules/public/public.routes.ts`, no auth required):
  - `GET /api/public/events/:slug` — full render payload (event/theme/branding/youtube/media)
  - `POST /api/public/events/:slug/unlock` — password check for PRIVATE events
  - `GET /api/public/events/:slug/share` — public URL + QR code + WhatsApp share link
- **YouTube integration** (`src/modules/youtube/`): OAuth2 connect/callback flow,
  access/refresh tokens encrypted at rest with AES-256-GCM (`src/utils/crypto.ts`),
  and a `syncStreamStatuses()` job that polls YouTube and flips
  `youtube_streams.status` → `events.status` (wire this into a cron, e.g.
  `node-cron` or a scheduled Lambda/K8s CronJob hitting `POST /api/youtube/sync`).
- **Audit logs**: mutating admin/vendor actions call `writeAuditLog()` — check
  `GET /api/admin/audit-logs`.
- **Wallet**: `creditWallet`/`debitWallet`/`refundWallet` in
  `src/modules/wallet/wallet.service.ts` write balance + ledger row inside one
  Prisma transaction, so they never drift apart.
- **Payments**: `POST /api/payments/webhook/razorpay` verifies the HMAC signature
  before trusting the payload, then credits the vendor wallet on `payment.captured`.

## 5. Extension points left intentionally unimplemented

- `src/modules/media/media.controller.ts::getUploadUrl` — wire up
  `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` using the `S3_*` env vars
  to return real presigned upload URLs.
- SMTP/OTP delivery (`auth.service.ts::requestPasswordReset`) — currently creates
  the OTP row but doesn't send it; plug in your transactional email provider.
- A scheduler to call `POST /api/youtube/sync` periodically (every 30–60s while
  events are live is reasonable).

## 6. Project layout

```
prisma/schema.prisma       All tables (27 sections of the architecture doc)
prisma/seed.ts              Permission catalogue, role defaults, theme categories, super admin
src/app.ts / server.ts      Express app assembly + entry point
src/config/                 env loading, Prisma client singleton
src/middleware/             auth, RBAC, tenant isolation, audit log, error handler, validation
src/utils/                  JWT, password hashing, AES-256-GCM crypto, slugs, CRUD factory
src/modules/<name>/         *.routes.ts, *.controller.ts, *.service.ts (where needed), *.schema.ts
src/routes/index.ts         mounts every module under /api/*
```
