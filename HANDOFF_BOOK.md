# Scrappy V2 — Project Handoff Book

> **Last Updated:** 2026-04-04
> **Purpose:** Everything a new developer or AI agent needs to understand, maintain, and extend this project.

---

## 1. What Is Scrappy V2?

A **multi-marketplace e-commerce operations dashboard** for managing products across **5 Amazon/Flipkart marketplaces** (India, USA, UK, UAE, Flipkart) with **up to 8 seller accounts** each. It tracks every product from brand discovery through purchasing, shipping, quality checking, restocking, and reordering.

**Users:** Internal team (5-15 people) — brand checkers, validators, purchasers, admins.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.1.1 (App Router) | React 19.2.3, TypeScript 5 |
| Styling | TailwindCSS v4 | Dark theme throughout |
| Database | PostgreSQL 15.8.1 | 663+ tables, self-hosted Supabase |
| Auth | Supabase GoTrue | JWT + RBAC via `user_roles` table |
| Realtime | Supabase Realtime | Chat, presence, live table sync |
| File Parsing | Papa Parse + XLSX | CSV/Excel bulk upload |
| Export | jsPDF + XLSX | PDF/Excel table export |
| Animation | Framer Motion | Page transitions, modals |
| Deployment | Vercel (frontend) | Supabase via Docker (backend) |

---

## 3. Project Structure

```
scrappy-v2/
├── app/
│   ├── login/                          # Email/password login
│   ├── unauthorized/                   # Access denied page
│   ├── api/                            # 6 API routes
│   │   ├── auth/session/               # JWT refresh
│   │   ├── usa-purchases/              # CRUD + admin validation
│   │   ├── upload-india-master/        # Bulk insert (SERVICE_ROLE_KEY)
│   │   ├── distribute-products/        # Brand checking → HD/LD/DP tables
│   │   ├── admin/create-user/          # User creation
│   │   └── products/                   # Disabled (410)
│   └── dashboard/                      # 166+ pages
│       ├── page.tsx                    # Admin dashboard (user management)
│       ├── india-selling/              # 27 pages (8 sellers)
│       ├── usa-selling/                # 16 pages (4 sellers)
│       ├── uk-selling/                 # 16 pages (4 sellers)
│       ├── uae-selling/                # 16 pages (4 sellers)
│       ├── flipkart/                   # 35 pages (6 sellers)
│       ├── manage-sellers/             # Master data + link generator
│       ├── details/                    # Product detail view
│       └── user-activity/[userId]/     # Activity history
├── components/
│   ├── layout/                         # Sidebar, PageTransition, UniversalAsinSearch
│   ├── dashboard/                      # KPI cards, seller matrix, stage stats
│   ├── chat/                           # FloatingChat, NotificationBell
│   ├── shared/master-table/            # Reusable table components
│   ├── india-selling/                  # GenericRollbackModal, ConfirmDialog
│   └── ui/                            # Shadcn primitives (button, input, etc.)
├── lib/
│   ├── supabaseClient.ts               # Browser client
│   ├── supabaseServer.ts               # Server client (cookies)
│   ├── supabase.ts                     # Simple client
│   ├── utils.ts                        # Helpers (category logic, seller mappings)
│   ├── blackboxCalculations.ts         # Business calculations
│   ├── config/routes.ts                # Route + permission definitions (455 lines)
│   ├── hooks/                          # 9 custom hooks
│   └── utils/master-table/             # Upload, filter, export helpers
├── proxy.ts                            # Auth middleware (guards /dashboard)
├── migrations/                         # SQL migration files
├── migration_schema_fixed.sql          # Full DDL (376 KB)
├── functions_export.sql                # 50 PL/pgSQL functions (162 KB)
├── triggers_export.sql                 # 30 triggers (32 KB)
└── supabase/docker/                    # Self-hosted Supabase (11 services)
```

---

## 4. India Selling Pipeline (Core Business Flow)

This is the most complex and actively developed part. Products flow through 7 stages:

```
┌─────────────────┐
│ BRAND CHECKING   │  8 seller pages — approve/reject products
│ (8 sellers)      │  Tables: india_brand_checking_seller_{1-8}
└────────┬────────┘
         ↓ approved → india_validation_main_file
┌─────────────────┐
│ VALIDATION       │  Validate specs, pricing, sourcing
│                  │  Table: india_validation_main_file
└────────┬────────┘
         ↓ sent_to_admin → india_admin_validation
┌─────────────────┐
│ ADMIN APPROVALS  │  Admin confirms/rejects
│                  │  Table: india_admin_validation
└────────┬────────┘
         ↓ confirmed → india_purchases
┌─────────────────┐
│ PURCHASES        │  Purchase orders placed
│                  │  Table: india_purchases
└────────┬────────┘
         ↓ confirmed → tracking pipeline
┌─────────────────┐
│ TRACKING         │  3 sub-stages:
│  ├─ Inbound      │  india_inbound_tracking (pending quantities)
│  ├─ Boxes        │  india_inbound_boxes (physical boxes)
│  └─ Checking     │  india_box_checking (QA + checklist)
│                  │  Tabs: Checking | Damaged | Offline Sell
└────────┬────────┘
         ↓ checked → seller-specific restock
┌─────────────────┐
│ RESTOCK          │  8 seller pages
│ (8 sellers)      │  Tables: india_restock_seller_{1-8}
│                  │  Tabs: Pending | Restocked | Removed
│                  │  Date filters, CSV download
└────────┬────────┘
         ↓ (when stock runs low)
┌─────────────────┐
│ REORDER          │  Reorder management
│                  │  Tables: india_reorder (seller-specific)
└─────────────────┘
```

### Key Concepts

- **journey_id / journey_number**: Each product can go through the pipeline multiple times. A `journey_id` (UUID) links all records for one trip. `journey_number` is sequential (1, 2, 3...).
- **seller_tag**: Two-letter code (GR, RR, UB, VV, DE, CV, MV, KL) identifying which seller account handles the product.
- **action_status** (Checking table): `null` = active checking, `damaged` = damaged items, `offline_sell` = offline sold, `pending_restock` = sent to restock (preserved for rollback).
- **moved_at** (Restock): Timestamp when product was restocked, used for date filtering.

---

## 5. Seller Configuration

### India (8 Sellers)

| ID | Tag | Name | Slug | Color |
|----|-----|------|------|-------|
| 1 | GR | Golden Aura | golden-aura | yellow |
| 2 | RR | Rudra Retail | rudra-retail | indigo |
| 3 | UB | UBeauty | ubeauty | pink |
| 4 | VV | Velvet Vista | velvet-vista | emerald |
| 5 | DE | Dropy Ecom | dropy-ecom | orange |
| 6 | CV | Costech Ventures | costech-ventures | green |
| 7 | MV | Maverick | maverick | violet/orange |
| 8 | KL | Kalash | kalash | cyan/lime |

### Other Marketplaces

- **USA, UK, UAE**: Sellers 1-4 (GR, RR, UB, VV)
- **Flipkart**: Sellers 1-6 (GR, RR, UB, VV, DE, CV)

### Where Sellers Are Defined (update ALL when adding a new seller)

| File | What to update |
|------|---------------|
| `lib/utils.ts` | `SELLER_TAG_MAPPING` |
| `lib/config/routes.ts` | brand-checking, listing-error, restock subRoutes |
| `app/dashboard/india-selling/brand-checking/page.tsx` | `ALL_SELLERS`, `SELLER_TABLE_GROUPS` |
| `app/dashboard/india-selling/listing-error/page.tsx` | `ALL_SELLERS` |
| `app/dashboard/india-selling/restock/[slug]/page.tsx` | `SELLERS` array |
| `app/dashboard/india-selling/tracking/page.tsx` | `SELLERS` array |
| `app/dashboard/india-selling/reorder/page.tsx` | `SELLERS` array |
| `app/dashboard/india-selling/validation/page.tsx` | `SELLER_STYLES` |
| `app/dashboard/india-selling/admin-validation/page.tsx` | `getSellerNameFromTag`, badge colors, `tagColors` |
| `app/dashboard/india-selling/purchases/page.tsx` | `sellerTagMapping`, badge colors, `qtyTagColors` |
| `app/dashboard/india-selling/tracking/components/*.tsx` | `SELLER_TAG_COLORS`, `SELLER_ID_TO_TAG`, `SELLER_NAMES` |
| `components/layout/UniversalAsinSearch.tsx` | `SELLERS` array |
| Each brand-checking seller page | `SELLER_CODE_MAP` |
| Each listing-error seller page | `ALL_SELLER_IDS` |

---

## 6. Database Architecture

### Table Naming Pattern

```
{marketplace}_{stage}_{qualifier}

Examples:
  india_brand_checking_seller_1        # Brand checking for Golden Aura
  india_seller_1_high_demand           # HD products for Golden Aura
  india_seller_1_not_approved          # Rejected products
  india_validation_main_file           # Shared validation table
  india_purchases                      # Shared purchases table
  india_inbound_tracking               # Shared inbound tracking
  india_inbound_boxes                  # Shared boxes
  india_box_checking                   # Shared checking (with action_status)
  india_restock_seller_1               # Restock for Golden Aura
  india_reorder                        # Reorder (seller-specific via suffix)
  india_listing_error_seller_1_pending # Listing errors for Golden Aura
```

### Critical Shared Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_roles` | RBAC | email, role, allowed_pages[], is_active |
| `india_validation_main_file` | Central product data | asin, current_journey_id, journey_number, seller_tag, status |
| `india_admin_validation` | Admin approval queue | asin, journey_id, admin_status |
| `india_purchases` | Purchase orders | asin, journey_id, seller_tag, buying_quantities |
| `india_inbound_tracking` | Inbound shipments | asin, pending_quantity, assigned_quantity, status |
| `india_inbound_boxes` | Box management | box_number, asin, quantity_assigned |
| `india_box_checking` | QA checking | asin, action_status, check_mrp_label, check_gelatin, etc. |
| `india_brand_check_progress` | Dashboard progress | seller_id, total_products, approved_products, not_approved_products |
| `india_asin_history` | Journey snapshots | asin, journey_id, stage data |

### Key Database Functions

| Function | Purpose |
|----------|---------|
| `bulk_insert_india_master_with_distribution` | Batch upload + auto-distribute to seller tables |
| `india_recalc_brand_check_progress(seller_id)` | Recalculate approval counts from `approval_status` column |
| `log_user_activity` | Insert activity log entry |
| `increment_daily_summary` | Aggregate daily activity stats |
| `get_or_create_dm` | Create/find DM conversation |
| `get_unread_counts` | Chat unread message counts |

---

## 7. Authentication & Authorization

### Login Flow
1. User enters email/password → Supabase GoTrue auth
2. `proxy.ts` middleware checks JWT on `/dashboard` routes
3. `useAuth` hook queries `user_roles` table for permissions
4. Role cached in localStorage (`scrappy_user_role`)
5. Sidebar filters routes via `hasPageAccess(permissionKey)`

### Roles
- `admin` — Full access + user management
- `validation`, `purchase`, `brand-checking`, `listing-error`, `tracking`, `restock`, `reorder` — Scoped access
- `viewer` — Read-only

### Permission Keys (from routes.ts)
Parent: `manage-sellers`, `india-selling`, `usa-selling`, `uk-selling`, `uae-selling`, `flipkart`
Granular: `view-brand-checking`, `view-validation`, `view-listing-errors`, `view-purchases`, `view-tracking`, `view-reorder`, `view-restock`, `admin-access`

---

## 8. Real-Time Features

### Chat System
- **Tables:** `chat_conversations`, `chat_messages`, `chat_participants`, `chat_attachments`, `chat_read_receipts`, `chat_user_presence`
- **Types:** DM, group, broadcast
- **UI:** Grammarly-style edge tab (hover to open, slides from right side)
- **Hook:** `useChat()` — fetchConversations, sendMessage, startDM, createBroadcast, togglePin

### Presence System
- **Hook:** `usePresence()` — heartbeat every 60 seconds
- **States:** online (< 2 min since last_seen), away (visibility hidden), offline
- **Table:** `chat_user_presence`

### Live Table Sync
- Brand checking pages subscribe to `postgres_changes` (DELETE/INSERT) for instant cross-user updates
- Tracking page subscribes for tab count updates
- Restock/listing error tables not yet subscribed

---

## 9. Key UI Patterns

### Optimistic UI
All brand checking approve/reject actions use optimistic updates: remove the row from state immediately, then run DB operations in parallel. If the DB call fails, the row is restored.

### Column Drag & Resize
Most table pages support:
- Drag-to-reorder columns (saved to localStorage)
- Resize columns by dragging header edges
- Hide/show columns via dropdown

### Editable Cells
Pattern used across pages:
- Click cell → inline input appears
- Enter to save, Escape to cancel
- Auto-saves to Supabase on blur/Enter

### Remark Modal
All pages with remarks use an editable modal:
- Click "View" or "+ Add" → modal with textarea
- Character/line count footer
- Copy, Save (conditional), Close buttons
- Save calls `handleCellEdit` or `handleRemarkSave`

### Rollback System
- `GenericRollbackModal` — reusable modal for moving products backward in the pipeline
- Movement history tables track every move for undo capability
- Custom rollback modals (e.g., CheckingTable's restock rollback) fetch from all seller tables

### Toast Notifications
```typescript
setToast({ message: 'Success message', type: 'success' });
setTimeout(() => setToast(null), 3000);
```

### ConfirmDialog
All destructive actions use `<ConfirmDialog>` (not `window.confirm`):
```typescript
setConfirmDialog({ title, message, type: 'danger', onConfirm: () => { ... } });
```

---

## 10. Activity Logging

Every user action is logged via `useActivityLogger`:
```typescript
logActivity({
  action: 'approve',        // approve, reject, move, upload, delete, confirm, etc.
  marketplace: 'india',
  page: 'brand-checking',
  table_name: 'india_seller_1_high_demand',
  asin: 'B005IHSUIE',
  details: { seller_id: 1, funnel: 'HD', target: 'india_validation_main_file' }
});
```

View at `/dashboard/user-activity/[userId]`.

---

## 11. Common Operations

### Adding a New Seller (India)

1. **Create DB tables** (brand_checking, listing_error_{pending,error,high_demand,low_demand,dropshipping,done,removed}, restock, not_approved, reject, movement_history)
2. **Update all config files** — see Section 5 table
3. **Copy a seller page** (e.g., costech-ventures) for brand-checking, listing-error
4. **Update SQL functions** — `india_recalc_brand_check_progress`, `india_sync_master_update_to_sellers`
5. **Test the full pipeline** — brand check → validation → purchases → tracking → restock

### Adding a New Marketplace

1. Copy an existing marketplace directory (e.g., `usa-selling/`)
2. Create corresponding DB tables with the marketplace prefix
3. Add routes to `lib/config/routes.ts`
4. Create a dashboard stats hook (`useNewMarketplaceDashboardStats`)
5. Add sidebar entries

### Bulk Upload Flow (Manage Sellers)

1. User uploads CSV/Excel on `/manage-sellers/india-sellers`
2. File parsed by Papa Parse / XLSX
3. Deduped against existing ASINs
4. Batch inserted via `POST /api/upload-india-master` (uses `bulk_insert_india_master_with_distribution` RPC)
5. Products auto-distributed to brand checking tables based on `determineCategory(monthly_unit)`

### Checking → Restock Flow

1. User checks items (MRP label, gelatin, amazon badge, cleaning)
2. Sets damaged_quantity and offline_sell_qty if applicable
3. Clicks "→ To Restock"
4. `handleMoveToRestock`:
   - Groups by ASIN across sellers
   - Calculates remaining = total - damaged - offline
   - Distributes proportionally among sellers
   - Inserts `status: 'pending'` rows to restock tables
   - Inserts to listing error tables
   - Marks originals as `action_status: 'pending_restock'`
   - Creates damaged/offline_sell rows in checking table

---

## 12. Environment Setup

### Prerequisites
- Node.js 20+
- Docker Desktop (for Supabase)
- Git

### Local Development
```bash
# Start Supabase
cd supabase/docker && docker compose up -d

# Start app
npm install
npm run dev     # http://localhost:3000
```

### Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Schema Files
- `migration_schema_fixed.sql` — Full DDL (376 KB, 663+ tables)
- `functions_export.sql` — PL/pgSQL functions (162 KB)
- `triggers_export.sql` — Triggers (32 KB)
- `migrations/` — Incremental migrations

---

## 13. Known Patterns & Gotchas

| Pattern | Details |
|---------|---------|
| **Table per seller** | Each seller gets isolated tables. When adding sellers, create ALL table variants. |
| **Status as string** | DB status values like `'relisted'` must NOT be renamed in code — only display text changes. |
| **localStorage caching** | Column order, widths, hidden columns, filters, search queries all persist. Key format varies by page. |
| **Recursive fetch** | Tables with 1000+ rows use recursive fetching (Supabase has 1000-row default limit). |
| **Weight unit** | Stored as "kg" in DB but displayed as "g" — hardcoded in UI, not from DB. |
| **Approval status** | `india_brand_checking_seller_{N}.approval_status` tracks pending/approved/not_approved for accurate progress counts. |
| **journey_id filter** | Rollback operations (purchases, admin-validation) filter by `journey_id` when available to avoid affecting other journeys of the same ASIN. |
| **action_status in checking** | `null` = active, `damaged`/`offline_sell` = separated items, `pending_restock` = sent to restock (hidden from checking tab, preserved for rollback). |

---

## 14. File Quick Reference

| Need to... | Look at... |
|-------------|------------|
| Add a route | `lib/config/routes.ts` |
| Change auth/permissions | `lib/hooks/useAuth.tsx`, `user_roles` table |
| Modify seller mapping | `lib/utils.ts` → `SELLER_TAG_MAPPING` |
| Change category logic | `lib/utils.ts` → `determineCategory()` |
| Debug pipeline flow | Follow the stage tables in Section 4 |
| Add a DB function | `functions_export.sql`, then run in Supabase SQL Editor |
| Modify checking flow | `app/dashboard/india-selling/tracking/components/CheckingTable.tsx` |
| Modify restock | `app/dashboard/india-selling/restock/[slug]/page.tsx` |
| Modify inbound table | `app/dashboard/india-selling/tracking/components/InboundTable.tsx` |
| Modify chat | `components/chat/FloatingChat.tsx`, `lib/hooks/useChat.ts` |
| Add bulk upload | `app/api/upload-india-master/route.ts`, `lib/utils/master-table/uploadHelpers.ts` |
| View user activity | `app/dashboard/user-activity/[userId]/page.tsx` |

---

## 15. Recent Changes (This Session — 2026-04-04)

| Change | Files |
|--------|-------|
| Restock page: "Relisted" → "Restocked" display text | restock/[slug]/page.tsx |
| Restock: moved_at timestamp, date filters (Today/Yesterday/Week/Month + date range), CSV download, Restocked On column | restock/[slug]/page.tsx |
| Restock: removed Disposed and Offline Sell tabs (handled in Checking now) | restock/[slug]/page.tsx |
| Checking: Damaged/Offline Sell tabs with quantities, Recheck button, pending_restock preservation | CheckingTable.tsx |
| Checking: custom rollback modal (fetches all 6 restock tables, highlights recent) | CheckingTable.tsx |
| Checking: Offline Sell tab — party name, date, date filters | CheckingTable.tsx |
| Checking: overdue row highlighting on Inbound | InboundTable.tsx |
| Purchases: seller_tag priority over validation_seller_tag | purchases/page.tsx |
| Purchases: editable remark modal | purchases/page.tsx |
| Admin validation: hide columns feature, editable remark modal | admin-validation/page.tsx |
| Rollback queries: journey_id filtering | purchases, admin-validation |
| GenericRollbackModal: explicit field mapping for BOXES_TO_INBOUND and CHECKING_TO_BOXES | GenericRollbackModal.tsx |
| Routes reordered: Admin Approvals first in India Selling | routes.ts |
| Chat: Grammarly-style hover edge tab, draggable | FloatingChat.tsx |
| Editable remarks: all 14 pages (validation, brand checking x6, listing error x6, reorder) | multiple |
| Brand checking: approval_status column + SQL migration | migrations/001_add_approval_status.sql |
| Brand checking: realtime subscriptions for cross-user sync | 6 brand-checking pages |
| Brand checking dashboard: pending count row | brand-checking/page.tsx |
| URL fix: ensureAbsoluteUrl for product_link/amz_link | 30 files + lib/utils.ts |
| Weight unit: hardcoded "g" display | 11 manage-sellers files |
| Master upload: batch size 200 → 1000 | india-sellers/page.tsx |
| New sellers: Maverick (7/MV) and Kalash (8/KL) | 40+ files |
| New pages: brand-checking, listing-error for Maverick and Kalash | 4 new page files |
