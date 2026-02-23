# Scrollever - Roadmap de ejecucion (metrics + notifications)

## Estado global
- [x] 1. Fundacion DB de notificaciones + settings
- [x] 2. Servicio backend de notificaciones (dedupe + utilidades)
- [x] 3. API de usuario para inbox de notificaciones
- [x] 4. Integraciones de eventos reales (create/boards/likes/superlikes)
- [x] 5. Dashboard admin con metricas procesadas (no sueltas)
- [x] 6. UX de notificaciones en header (campana + dropdown + acciones)
- [x] 7. Verificacion tecnica final (`tsc` + `build`)

## Detalle operativo
- [x] Crear migracion SQL para `user_notifications`, RLS, indices y trim automatico
- [x] Ejecutar `supabase db push` para aplicar `20260223170500_notifications_metrics_foundation.sql` en remoto
- [x] Agregar settings `notifications.*` al catalogo admin
- [x] Implementar `lib/notifications/service.ts`
- [x] Implementar `GET/PATCH /api/notifications`
- [x] Conectar notificaciones en `generation/jobs` cuando una imagen queda lista
- [x] Conectar notificaciones en `boards/[id]/items` al guardar imagen
- [x] Conectar notificaciones en `images/[id]/like` por milestones
- [x] Conectar notificaciones en `images/[id]/superlike` para autor
- [x] Redisenar `GET /api/admin/stats` con KPIs procesados + funnel + salud + top creators
- [x] Redisenar `app/admin/page.tsx` para leer y mostrar la nueva estructura
- [x] Integrar campana y dropdown en `components/header.tsx`
- [x] Ejecutar chequeo de tipos y build final

## Analytics causal v2 (visitor + conversion + retention)
- [x] Crear migracion `20260223235900_analytics_runtime_foundation.sql`
- [x] Materializar `product_events` con `event_id uuid` + `event_time` + `ingested_at` + RLS
- [x] Materializar `identity_links` para stitching `anonymous_id -> user_id`
- [x] Materializar `metric_catalog` con ownership y SLA
- [x] Crear vistas de analitica: `analytics_events_enriched`, `analytics_session_summaries`
- [x] Definir y materializar `qualified_visitors` en `analytics_qualified_visitors_daily`
- [x] Materializar retencion backend D1/D7/D30 (`analytics_retention_cohorts_daily` + weekly)
- [x] Crear funciones SQL runtime: `get_analytics_window_summary`, `get_analytics_top_sources`, `get_retention_snapshot`
- [x] Crear trigger `signup_completed` (ajustado luego a `auth.users` para mayor cobertura)
- [x] Implementar helper runtime `lib/analytics/track-event.ts` (best-effort + idempotencia)
- [x] Implementar endpoint `POST /api/analytics/events`
- [x] Implementar endpoint `POST /api/analytics/identify`
- [x] Implementar tracker cliente global (`AnalyticsRuntime`) con `session_started`, `page_view`, `landing_viewed`
- [x] Integrar identify automatico al loguear
- [x] Instrumentar `generation/jobs` (`generation_job_started/succeeded/failed`, `image_published`)
- [x] Instrumentar `images/[id]/like` (`like_added`)
- [x] Instrumentar `images/[id]/superlike` (`superlike_added`)
- [x] Instrumentar `boards/[id]/items` (`board_item_added` solo alta real)
- [x] Expandir `GET /api/admin/stats` con UV/sesiones/qualified conversion/top sources/retention real
- [x] Expandir UI `app/admin/page.tsx` para leer y mostrar nuevas metricas
- [x] Agregar keys `analytics.*` al catalogo admin para configuracion central
- [x] Aplicar migracion remota en Supabase (`supabase db push --linked`)
- [x] Verificacion tecnica final (`npx tsc --noEmit`, `npm run build`)
- [x] Agregar DAU/MAU + stickiness en `admin/stats` y dashboard
- [x] Cambiar engagement de generated images a eventos `like_added/superlike_added` en ventana 24h
- [x] Hardening de signup tracking: mover trigger `signup_completed` a `auth.users`
- [x] Exclusion de trafico interno por IP/CIDR (`analytics.internal_ip_blocklist`)
- [x] Top creators migrado a engagement puro 24h via RPC (sin counters acumulados)
- [x] Eliminado `limit(20000)` de engagement events en stats (agregacion SQL server-side)
- [x] Tipado RPC fortalecido en `admin/stats` con parseo numerico explicito
- [x] Deduplicacion visual del feed por URL en backend (`/api/images`) para evitar repetidos en `recent`/`immortal`/`position`
- [x] Boards: edicion completa (nombre/descripcion/privacidad) + eliminacion (API + UI)
