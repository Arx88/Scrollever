# Analytics Documentation — Scrollever

## Overview
This document describes the current analytics architecture implemented in Scrollever, including:
- Event tracking (client + server)
- Identity stitching (anonymous → authenticated)
- Core SQL objects (tables, views, RPCs)
- Admin dashboard metrics
- Operational checks and maintenance

---

## 1) Goals

The analytics system is designed to support **product decisions**, not vanity reporting.

Primary objectives:
1. Measure acquisition and conversion quality.
2. Measure activation and retention (D1/D7/D30).
3. Track creator loop health (generation → engagement → survival).
4. Keep data trustworthy via bot/test/internal traffic filtering.

---

## 2) Data Flow

### 2.1 Client-side events
Tracked by `components/analytics-runtime.tsx` and `lib/analytics/browser.ts`:
- `session_started`
- `page_view`
- `landing_viewed`
- `signup_started` (from auth flow)

Sent to:
- `POST /api/analytics/events`

### 2.2 Server-side events
Tracked from backend routes with `trackProductEvent()` (`lib/analytics/track-event.ts`):
- `like_added`
- `superlike_added`
- `generation_job_started`
- `generation_job_succeeded`
- `image_published`
- `board_item_added`
- `identity_linked`

### 2.3 Signup canonical event
Tracked by DB trigger on `auth.users`:
- `signup_completed`

This avoids missing signup events due to delayed profile creation.

---

## 3) Core Schema

Defined in migrations:
- `20260223235900_analytics_runtime_foundation.sql`
- `20260224002000_analytics_hardening_v2.sql`

### 3.1 Tables
- `public.product_events`
  - canonical event store
  - idempotent (`event_id` unique)
  - traffic flags (`is_test_traffic`, `is_bot`)
- `public.identity_links`
  - maps `anonymous_id` to `user_id`
- `public.metric_catalog`
  - KPI governance metadata

### 3.2 Key Views
- `public.analytics_events_enriched`
  - resolves identity
  - computes `consolidated_visitor_id`
  - applies traffic filtering (bot/test/internal IP)
- `public.analytics_session_summaries`
  - session-level derived attributes (duration, pageviews, source)
- `public.analytics_qualified_visitors_daily`
- `public.analytics_signup_cohorts`
- `public.analytics_active_user_days`
- `public.analytics_retention_cohorts_daily`
- `public.analytics_retention_cohorts_weekly`

### 3.3 Key RPCs
- `get_analytics_window_summary(p_since, p_until)`
- `get_analytics_top_sources(p_since, p_until, p_limit)`
- `get_retention_snapshot(p_lookback_days)`
- `get_generated_engagement_summary_window(p_since, p_until)`
- `get_generated_creator_stats_window(p_since, p_until, p_limit)`

---

## 4) Traffic Filtering Rules

Event rows are excluded from analytics when any of these is true:
- `is_test_traffic = true`
- `is_bot = true`
- user-agent matches bot/crawler patterns
- IP matches `analytics.internal_ip_blocklist` in `app_settings`

### Internal IP blocklist setting
Key:
- `analytics.internal_ip_blocklist`

Expected value:
- JSON array of IPs/CIDRs

Example:
```json
["127.0.0.1", "10.0.0.0/8", "192.168.1.0/24"]
```

---

## 5) Identity Model

### IDs used
- `anonymous_id` (localStorage)
- `session_id` (sessionStorage)
- `user_id` (Supabase auth)

### Stitching process
1. Anonymous user generates events.
2. User authenticates.
3. Frontend calls `POST /api/analytics/identify`.
4. Backend upserts into `identity_links`.
5. Enriched view resolves events into a single `consolidated_visitor_id`.

---

## 6) Admin Dashboard Metrics

Served by:
- `GET /api/admin/stats`

Displayed in:
- `app/admin/page.tsx`

### 6.1 Acquisition
- Visitors (24h, 7d)
- Sessions (24h, 7d)
- Top traffic sources
- Qualified visitor → signup conversion

### 6.2 Engagement & Loop
- Likes / superlikes (24h)
- Board saves (24h)
- Generated image engagement summary
- Survival pressure and competition edge

### 6.3 Creator Health
- Active creators (24h)
- Top creators (event-window-based ranking)

### 6.4 Retention
- D1 / D7 / D30 retention snapshot
- DAU / MAU and stickiness %

### 6.5 Data Quality Guardrails
- Signup tracking coverage (% tracked signups vs profile creations)
- Notification backlog
- Generation success rate

---

## 7) Event Contract (Practical)

Minimum payload fields expected for new tracked events:
- `eventName` (required)
- `eventId` (optional UUID; generated if missing)
- `eventTime` (optional; server defaults to now)
- `anonymousId` (recommended for client events)
- `sessionId` (recommended for session analytics)
- `metadata` (optional JSON object)

Guidelines:
1. Never block UX on analytics failures.
2. Keep metadata compact and serializable.
3. Include entity IDs in metadata when relevant (`imageId`, `jobId`, etc.).
4. Prefer consistent event naming (`snake_case`, past tense/action-oriented).

---

## 8) Operational Checklist

Before production rollout:
- [ ] Run latest migrations in order.
- [ ] Verify `analytics.internal_ip_blocklist` for QA/staging traffic.
- [ ] Confirm `signup_completed` trigger exists on `auth.users`.
- [ ] Confirm `/api/analytics/events` receives client events.
- [ ] Confirm `/api/analytics/identify` links identities after login/signup.
- [ ] Validate admin stats endpoint for non-empty windows.

After rollout (first 48h):
- [ ] Compare profile signups vs tracked signups.
- [ ] Inspect source mix sanity (`direct`, referral, UTM).
- [ ] Validate D1 trend and conversion trend stability.
- [ ] Validate no abnormal bot/internal traffic leakage.

---

## 9) Known Limits / Next Improvements

1. Add explicit API fallback labels when an analytics RPC fails (to prevent silent zeros).
2. Add schema versioning in settings (e.g., `analytics.schema_version`).
3. Add automated anomaly alerts (sigma-based) for:
   - conversion drop
   - D1 drop
   - generation success degradation
4. Add materialized refresh jobs if event volume grows significantly.

---

## 10) Reference Files

- `components/analytics-runtime.tsx`
- `lib/analytics/browser.ts`
- `lib/analytics/track-event.ts`
- `app/api/analytics/events/route.ts`
- `app/api/analytics/identify/route.ts`
- `app/api/admin/stats/route.ts`
- `app/admin/page.tsx`
- `supabase/migrations/20260223235900_analytics_runtime_foundation.sql`
- `supabase/migrations/20260224002000_analytics_hardening_v2.sql`

---

## Owner
Product + Engineering

If any metric definition changes, update:
1. SQL objects (view/RPC)
2. Admin API contract (`/api/admin/stats`)
3. Dashboard labels and helpers
4. This document
