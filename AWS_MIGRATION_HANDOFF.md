# Scrappy V2 — AWS Migration Master Handoff

> **Purpose:** Give this document to an AI agent so it can execute a full migration of Scrappy V2 from local (Windows + Docker) to AWS.

---

## 1. Current State Summary

| Aspect | Details |
|--------|---------|
| **App** | Next.js 16.1.1, React 19.2.3, TypeScript, TailwindCSS v4 |
| **Backend** | Supabase self-hosted via Docker (11 services) |
| **Database** | PostgreSQL 15.8.1 — 100+ tables, ~1.2 GB data |
| **Auth** | GoTrue (JWT), `@supabase/ssr` browser client |
| **Networking** | Tailscale VPN (`100.123.37.125`), local-only |
| **Startup** | `supabase start` → `npm run dev` (see `start-project.bat`) |

### Application Description

Scrappy V2 is a **multi-marketplace e-commerce seller management platform**. It manages products, purchases, tracking, invoicing, and brand validation across **5 marketplaces**: Flipkart, Amazon India, Amazon UAE, Amazon UK, and Amazon USA — with 6 seller accounts each (Golden Aura, Rudra Retail, UBeauty, Velvet Vista, Dropy Ecom, Costech Ventures).

---

## 2. Project Structure

```
scrappy-v2/
├── app/
│   ├── api/
│   │   ├── auth/session/route.ts      # Session refresh endpoint
│   │   ├── distribute-products/route.ts # Product distribution to seller tables
│   │   ├── products/route.ts          # Mock endpoint (disabled)
│   │   ├── upload-india-master/route.ts # Bulk insert via RPC (uses SERVICE_ROLE_KEY)
│   │   └── usa-purchases/route.ts     # Full CRUD for USA purchases
│   ├── dashboard/                     # 166+ page components
│   │   ├── flipkart/                 # Flipkart (brand-checking, listed/not-listed, tracking, etc.)
│   │   ├── india-selling/            # Amazon India
│   │   ├── uae-selling/              # Amazon UAE
│   │   ├── uk-selling/               # Amazon UK
│   │   ├── usa-selling/              # Amazon USA
│   │   └── manage-sellers/           # Seller CRUD (per marketplace + dropy)
│   ├── login/page.tsx                 # Login page (email/password + RBAC check)
│   ├── unauthorized/                  # Unauthorized access page
│   └── layout.tsx                     # Root layout (AuthProvider wraps app)
├── components/                        # 32 shared React components
├── lib/
│   ├── supabaseClient.ts             # Browser client (@supabase/ssr)
│   ├── supabaseServer.ts             # Server client (cookies-based)
│   ├── supabase.ts                   # Simple client (@supabase/supabase-js)
│   ├── config/routes.ts              # Full route + permission definitions (455 lines)
│   ├── hooks/
│   │   ├── useAuth.tsx               # Auth context provider (14 KB)
│   │   ├── useDashboardStats.ts      # USA dashboard stats
│   │   ├── useFlipkartDashboardStats.ts
│   │   ├── useIndiaDashboardStats.ts
│   │   ├── useUAEDashboardStats.ts
│   │   └── useUKDashboardStats.ts
│   ├── utils/
│   │   ├── exportHelpers.ts          # PDF/Excel export utilities
│   │   └── master-table/             # Reusable master table utilities
│   ├── types.ts                      # TypeScript type definitions
│   └── utils.ts                      # determineCategory(), generateAmazonLink(), etc.
├── proxy.ts                           # ⚠ AUTH MIDDLEWARE — guards /dashboard routes
├── supabase/docker/                   # Supabase self-hosted stack
│   ├── docker-compose.yml            # 11+ services
│   ├── .env                          # Supabase configuration
│   └── volumes/                      # Persistent data & init scripts
├── migration_schema_fixed.sql        # Full DDL (376 KB)
├── functions_export.sql              # ~50 PL/pgSQL functions (162 KB)
├── triggers_export.sql               # ~30 triggers (32 KB)
├── data_backup.sql                   # Full data dump (1.2 GB)
├── next.config.ts                    # ⚠ Has Vercel allowedOrigins
├── .env.local                        # Next.js env vars
└── package.json                      # Dependencies
```

---

## 3. Supabase Docker Services

The local Supabase runs via `docker-compose.yml` at `supabase/docker/`:

| Service | Image | Exposed Ports | Key Role |
|---------|-------|---------------|----------|
| **Studio** | `supabase/studio:2026.01.27` | `3001` | Admin dashboard UI |
| **Kong** | `kong:2.8.1` | `54331` (HTTP), `54332` (HTTPS) | API gateway, auth routing |
| **Auth (GoTrue)** | `supabase/gotrue:v2.185.0` | `9999` (internal) | JWT auth, email signup |
| **REST (PostgREST)** | `postgrest/postgrest:v14.3` | `3000` (internal) | Auto-generated REST API |
| **Realtime** | `supabase/realtime:v2.72.0` | `4000` (internal) | WebSocket subscriptions |
| **Storage** | `supabase/storage-api:v1.37.1` | `5000` (internal) | File uploads, 50 MB limit |
| **imgproxy** | `darthsim/imgproxy:v3.30.1` | `5001` (internal) | Image transformations |
| **Meta** | `supabase/postgres-meta:v0.95.2` | `8080` (internal) | DB metadata API |
| **Edge Functions** | `supabase/edge-runtime:v1.70.0` | — | Deno serverless functions |
| **Analytics** | `supabase/logflare:1.30.3` | `4000` | Logging backend |
| **DB** | `supabase/postgres:15.8.1.085` | `5432` (internal) | PostgreSQL database |
| **Pooler** | `supabase/supavisor:2.7.4` | `54322`, `6543` | Connection pooling |
| **Vector** | `timberio/vector:0.28.1` | `9001` (internal) | Log collection |

Tailscale bindings (`100.123.37.125`) exist on Kong (54331/54332), Studio (3001), and Pooler (54322/6543).

---

## 4. Environment Variables

### Next.js App (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=http://100.123.37.125:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_APP_URL=http://100.123.37.125:3000
```

### Supabase Docker (`.env` — key settings)

```env
POSTGRES_PASSWORD=<secret>
JWT_SECRET=<secret>
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
PGRST_DB_SCHEMAS=public,storage,graphql_public
SITE_URL=http://localhost:3000
JWT_EXPIRY=3600
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
FUNCTIONS_VERIFY_JWT=false
```

> [!CAUTION]
> The current JWT keys are **demo keys** from Supabase. You **must** generate new production keys when deploying to AWS.

---

## 5. Database Schema Overview

### Table Categories (~100+ tables)

Each marketplace follows a consistent naming pattern. Replace `{mp}` with: `flipkart`, `india`, `uae`, `uk`, `usa`.

| Pattern | Count | Purpose |
|---------|-------|---------|
| `{mp}_purchases` | 5 | Purchase orders |
| `{mp}_admin_validation` | 5 | Admin approval queues |
| `{mp}_admin_validation_constants` | 5 | Validation rules |
| `{mp}_validation_main_file` | 5 | Product validation data |
| `{mp}_validation_constants` | 5 | Validation constants |
| `{mp}_asin_history` | 5 | ASIN/product history |
| `{mp}_reorder_{n}` | ~30 | Reorder tracking (6 per mp) |
| `{mp}_master_sellers` | 6 | Seller accounts |
| `{mp}_traking` | 5 | Shipment tracking |
| `{mp}_company_invoice` | 5 | Invoice records |
| `{mp}_brand_check_progress` | 5 | Brand validation |
| `{mp}_seller_{n}_{name}_movement_history` | ~30 | Product movements per seller |
| `{mp}_checking_seller_{n}` | dynamic | Quality checking |
| `{mp}_invoice_seller_{n}` | dynamic | Invoice per seller |
| `{mp}_shipment_seller_{n}` | dynamic | Shipment per seller |
| `{mp}_restock_seller_{n}` | dynamic | Restock per seller |
| `listing_error_progress` | 1 | Cross-marketplace listing errors |
| `brand_check_progress` | 1 | USA brand checking |
| `sellers_upload` | 1 | New seller onboarding |
| `copy_progress_timestamps` | 1 | Copy operations |
| `tracking_invoice_rollback` | 1 | Invoice corrections |
| **`user_roles`** | **1** | **RBAC — role, email, is_active, allowed_pages** |
| `usa_validation_pass_file` | 1 | Validation pass-through data |

### SQL Files to Migrate

| File | Size | Contents |
|------|------|----------|
| `migration_schema_fixed.sql` | 376 KB | All table definitions, indexes, RLS policies |
| `functions_export.sql` | 162 KB | ~50 PostgreSQL functions (incl. `bulk_insert_india_master_with_distribution`) |
| `triggers_export.sql` | 32 KB | ~30 triggers |
| `data_backup.sql` | 1.2 GB | Full data dump |

**Migration order:** schema → functions → triggers → data

---

## 6. Supabase Client Integration

### Browser Client (`lib/supabaseClient.ts`)
```typescript
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Server Client (`lib/supabaseServer.ts`)
```typescript
import { createServerClient } from '@supabase/ssr'
// Uses cookies() from next/headers
```

### Simple Client (`lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

> [!IMPORTANT]
> The app uses **three different Supabase client files**. When migrating, only the env vars need to change — the client code is URL/key-driven and stays the same.

---

## 6a. Authentication & RBAC System

### Auth Middleware (`proxy.ts`)

The file `proxy.ts` acts as **Next.js middleware** to protect `/dashboard` routes:
- Public routes: `/login`, `/unauthorized`
- Protected routes: `/dashboard/**` — redirects to `/login` if no Supabase session
- Uses `createServerClient` from `@supabase/ssr` with cookie-based session handling
- Contains Vercel-specific fixes for setting cookies on both request and response objects

### Role-Based Access Control (RBAC)

Login flow queries the **`user_roles`** table after successful auth:

```
SignIn → query user_roles by email → check is_active → store role in localStorage → redirect
```

**`user_roles` table schema (critical):**
```sql
-- Must exist in your migrated DB
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,        -- 'admin' or custom roles
  is_active BOOLEAN DEFAULT true,
  allowed_pages TEXT[] NOT NULL      -- e.g. ['usa-selling', 'manage-sellers', '*']
);
```

- **Admin role:** Gets redirected to `/dashboard`
- **Other roles:** Redirected to first entry in `allowed_pages`
- **Inactive accounts:** Immediately signed out with error message
- Role data is cached in `localStorage` key `scrappy_user_role`

### Route Permission System (`lib/config/routes.ts` — 455 lines)

Defines all sidebar navigation with permission mappings:

| Root Route | Permission Key | Seller Sub-Routes |
|------------|---------------|-------------------|
| `/dashboard` | `public` | — |
| `/dashboard/manage-sellers` | `manage-sellers` | USA/India/Flipkart/UK/UAE/Dropy |
| `/dashboard/usa-selling` | `usa-selling` | Brand Checking, Validation, Listing Errors, Purchases, Tracking, Reorder, Admin |
| `/dashboard/india-selling` | `india-selling` | Same pattern, 6 sellers |
| `/dashboard/uk-selling` | `uk-selling` | Same pattern, 4 sellers |
| `/dashboard/uae-selling` | `uae-selling` | Same pattern, 4 sellers |
| `/dashboard/flipkart` | `flipkart` | Brand Checking + Listed/Not-Listed sub-views, 6 sellers |
| `/dashboard/jio-mart` | `jio-mart` | Placeholder (empty) |

---

## 6b. API Routes

| Route | Methods | Key Details |
|-------|---------|-------------|
| `/api/auth/session` | GET | Refreshes JWT session; uses server client with cookies |
| `/api/usa-purchases` | GET, POST, PATCH, DELETE | Full CRUD on `usa_purchases`; POST also inserts into `usa_admin_validation` and updates `usa_validation_pass_file` |
| `/api/distribute-products` | POST | Distributes products from `usa_brand_checking_seller_{id}` into high/low/dropshipping tables using `determineCategory()` |
| `/api/upload-india-master` | POST | Bulk insert via RPC `bulk_insert_india_master_with_distribution`; **uses `SUPABASE_SERVICE_ROLE_KEY`** (bypasses RLS) |
| `/api/products` | GET | Disabled mock endpoint (returns 410) |

> [!CAUTION]
> `/api/upload-india-master` uses the **SERVICE_ROLE_KEY** directly — ensure this key is set as a server-side secret (not `NEXT_PUBLIC_*`) in production.

---

## 6c. Next.js Configuration (`next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['scrappyio-v2-42kf.vercel.app', 'localhost:3000'],
    },
  },
};
```

> [!WARNING]
> **`allowedOrigins` must be updated** for your production domain. Add your AWS/custom domain here, e.g. `'scrappy.yourdomain.com'`.

---

## 7. AWS Migration — Recommended Architecture

### Option A: Supabase Cloud + Vercel (Simplest)

```
User → CloudFront/Vercel Edge → Vercel (Next.js) → Supabase Cloud (DB + Auth + Storage)
```

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | **Vercel** (auto-deploy from Git) | Free–$20/mo |
| Backend | **Supabase Cloud** (Pro plan) | $25/mo |
| DNS | **Route 53** or domain registrar | ~$1/mo |
| **Total** | | **~$50/mo** |

**Steps:**
1. Create Supabase Cloud project → get new URL + keys
2. Run `migration_schema_fixed.sql` → `functions_export.sql` → `triggers_export.sql` via SQL Editor
3. Import `data_backup.sql` via `psql` to `db.<project-ref>.supabase.co`
4. Push code to GitHub, connect to Vercel
5. Set env vars in Vercel dashboard (new Supabase URL/keys)
6. Configure custom domain + SSL

### Option B: Supabase Cloud + AWS Amplify

Same as A, but deploy Next.js to **AWS Amplify Hosting** instead of Vercel.

### Option C: Fully Self-Hosted on AWS (Advanced)

| Component | AWS Service | Config |
|-----------|-------------|--------|
| Frontend | ECS Fargate | 2× t3.small tasks |
| Database | RDS PostgreSQL 15 | db.t3.medium, Multi-AZ |
| API Gateway | Kong on ECS or API Gateway | — |
| Auth | GoTrue on ECS | — |
| Storage | S3 | Standard |
| Load Balancer | ALB | — |
| DNS | Route 53 | — |
| SSL | ACM | Auto-renew |
| Secrets | Secrets Manager | All env vars |
| Monitoring | CloudWatch | Logs + alarms |
| **Total** | | **~$200–400/mo** |

**Steps:**
1. Create VPC with public/private subnets
2. Provision RDS PostgreSQL 15 (restore schema + data)
3. Set up ECS cluster, push Docker images to ECR
4. Convert `docker-compose.yml` services to ECS task definitions
5. Create ALB + Route 53 + ACM certificate
6. Deploy and test

---

## 8. Migration Checklist

### Pre-Migration
- [ ] Choose architecture (A, B, or C)
- [ ] Create AWS account, enable billing alerts, set up IAM
- [ ] If Supabase Cloud: create project, note URL + keys
- [ ] Generate new production JWT keys (replace demo keys)
- [ ] Test `migration_schema_fixed.sql` on a clean PostgreSQL 15

### Database Migration
- [ ] Run `migration_schema_fixed.sql` on target DB
- [ ] Run `functions_export.sql`
- [ ] Run `triggers_export.sql`
- [ ] Import `data_backup.sql` (1.2 GB — use `psql` or `pg_restore`)
- [ ] Verify row counts match source
- [ ] Enable RLS policies
- [ ] Test critical queries

### Application Deployment
- [ ] Create `.env.production` with new Supabase URL + keys
- [ ] Build: `npm run build` (ensure no errors)
- [ ] Deploy to Vercel / Amplify / ECS
- [ ] Verify all env vars are set in hosting platform
- [ ] Test auth login/logout
- [ ] Test each marketplace dashboard loads data
- [ ] Test file uploads if Storage is used

### DNS & SSL
- [ ] Configure custom domain
- [ ] Set up SSL certificate (ACM or Vercel auto-SSL)
- [ ] Test HTTPS access

### Post-Migration
- [ ] Set up CloudWatch / monitoring alarms
- [ ] Configure automated DB backups
- [ ] Test backup restoration
- [ ] Monitor costs for first 2 weeks
- [ ] Decommission local Tailscale setup

---

## 9. Key Warnings

> [!WARNING]
> **Large Database:** `data_backup.sql` is 1.2 GB. Use `psql` CLI for import — the Supabase SQL Editor will timeout on files this large.

> [!WARNING]
> **Demo JWT Keys:** The current `ANON_KEY` and `SERVICE_ROLE_KEY` are Supabase demo keys. Generate new ones for production using `supabase gen keys` or the Supabase dashboard.

> [!WARNING]
> **Tailscale References:** The `docker-compose.yml` binds ports to `100.123.37.125` (Tailscale IP). These bindings must be removed or changed to `0.0.0.0` for AWS deployment.

> [!WARNING]
> **No Dockerfile Exists:** The project has no Dockerfile. If deploying to ECS, create one:
> ```dockerfile
> FROM node:20-alpine AS builder
> WORKDIR /app
> COPY package*.json ./
> RUN npm ci
> COPY . .
> RUN npm run build
> 
> FROM node:20-alpine
> WORKDIR /app
> COPY --from=builder /app/.next/standalone ./
> COPY --from=builder /app/public ./public
> COPY --from=builder /app/.next/static ./.next/static
> EXPOSE 3000
> CMD ["node", "server.js"]
> ```
> **Note:** Requires adding `output: 'standalone'` to `next.config.ts`.

> [!WARNING]
> **`next.config.ts` allowedOrigins:** Currently set to `scrappyio-v2-42kf.vercel.app` and `localhost:3000`. **Must be updated** to your production domain.

> [!WARNING]
> **`user_roles` table:** The RBAC system queries `user_roles` on every login. This table **must** be populated with at least one admin user before the app is usable.

---

## 10. Reference Files

| File | Path | Purpose |
|------|------|---------|
| Schema | `migration_schema_fixed.sql` | Full DDL |
| Functions | `functions_export.sql` | PL/pgSQL functions |
| Triggers | `triggers_export.sql` | DB triggers |
| Data | `data_backup.sql` | Full data dump |
| Docker | `supabase/docker/docker-compose.yml` | All service definitions |
| Docker Env | `supabase/docker/.env` | Supabase config |
| App Env | `.env.local` | Next.js env vars |
| Package | `package.json` | NPM dependencies |
| DB Analysis | `database_analysis.txt` | Table-to-file mapping |
| Startup | `start-project.bat` | Local startup script |
| Auth Middleware | `proxy.ts` | Route protection (guards `/dashboard`) |
| Route Config | `lib/config/routes.ts` | All routes + RBAC permissions (455 lines) |
| Next Config | `next.config.ts` | Vercel allowedOrigins (must update) |
| Auth Hook | `lib/hooks/useAuth.tsx` | Auth context provider (14 KB) |
