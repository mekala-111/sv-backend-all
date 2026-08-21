# SV LIVE Backend

Multi-tenant backend for SV LIVE — YouTube-based event live-streaming.

Hierarchy: **Super Admin → Vendor → Customer → Event → Theme / YouTube / Media → Public Viewer**.

Stack: **Node.js + Express + TypeScript + MongoDB (Mongoose) + JWT + Google (YouTube) OAuth**.

## 1. Setup

```bash
npm install
cp .env.example .env
# Edit .env:
#   MONGODB_URI — replace <db_password> with your Atlas password
#   JWT secrets, TOKEN_ENCRYPTION_KEY, YouTube OAuth, etc.
```

MongoDB Atlas example:

```
MONGODB_URI=mongodb+srv://venkey:YOUR_PASSWORD@sv-events.bmiefbg.mongodb.net/sv_live?retryWrites=true&w=majority&appName=SV-EVENTS
```

URL-encode special characters in the password (`@` → `%40`, etc.).

## 2. Seed & run

```bash
npm run seed     # permissions, theme categories, plans, super admin
npm run dev      # http://localhost:5161
```

Default super admin: `admin@svlive.in` / `Admin@123`  
With `SEED_DEMO_DATA=true`: demo vendor `demo-vendor@svlive.in` / `DemoPass123!`

Health: `GET /health`

## 3. API modules

| Prefix | Who | Purpose |
|--------|-----|---------|
| `/api/auth` | All | Login, refresh, OTP, password reset, customer register |
| `/api/admin` | Admin | Overview, analytics, audit logs, permissions, users, bookings |
| `/api/vendors` | Admin + Vendor | CRUD + `/me`, dashboard, branding |
| `/api/customers` | Admin + Vendor | Tenant-scoped customers |
| `/api/events` | Admin + Vendor (+ Customer) | Lifecycle, publish, theme-config, access, recording |
| `/api/themes` | Admin + Vendor | Themes, categories, vendor assign |
| `/api/youtube` | Vendor | OAuth connect, streams, sync |
| `/api/media` | Vendor | Upload URL + event gallery |
| `/api/payments` | Admin + Vendor | Payments + Razorpay webhook |
| `/api/wallet` | Admin + Vendor | Balance + ledger |
| `/api/plans` | Admin + Vendor | Platform plans; `/api/vendor/pricing` price list |
| `/api/support` | Admin + Vendor | Support tickets |
| `/api/recordings` | Admin + Vendor | Event recordings |
| `/api/notifications` | Auth | In-app notifications |
| `/api/reports` | Admin + Vendor | Events / revenue summaries |
| `/api/settings` | Admin | Platform key-value settings |
| `/api/public` | Anyone | Event by slug, unlock, share/QR, bookings, contact, pricing |

### Public event (viewer)

```
GET  /api/public/events/:slug
POST /api/public/events/:slug/unlock
GET  /api/public/events/:slug/media
GET  /api/public/events/:slug/theme
GET  /api/public/events/:slug/share
GET  /api/public/events
GET  /api/public/watch/:eventCode
POST /api/public/bookings
POST /api/public/contact
GET  /api/public/pricing
```

## 4. Architecture notes

- **Tenant isolation**: `attachTenantScope` + `vendorScopeWhere` / `assertOwnsVendorRecord`
- **RBAC**: `requireRole` + fine-grained `permissions` / `role_permissions` / `user_permissions`
- **Event slugs**: stable public links (`rahul-weds-priya`); rename does not change slug
- **YouTube tokens**: AES-256-GCM encrypted at rest
- **Wallet**: credit/debit/refund in a Mongo transaction (Atlas replica set)

## 5. Project layout

```
src/
  config/          env + mongo connection
  models/          Mongoose schemas (collections)
  middleware/      auth, RBAC, tenant, audit, validate
  modules/         routes + controllers per domain
  seed.ts          bootstrap data
  server.ts        entry
```
