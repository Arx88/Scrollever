# Metricas v2.1 - Sistema de decision de producto para Scrollever

## Objetivo
Definir un sistema de metricas que permita decidir que mejorar, que cortar y que escalar, con reglas claras, queries reproducibles y ownership.

---

## 1) Principios no negociables

1. Una metrica = una decision.
2. Ventanas consistentes (no mezclar 24h con lifetime en el mismo KPI).
3. Eventos primero, estados despues.
4. Cohortes causales (misma cohorte base para cada funnel).
5. Segmentacion minima obligatoria:
   - anonymous vs registered
   - new vs returning
   - voter vs creator vs hybrid

---

## 2) Contrato de eventos (canonico)

### 2.1 Tabla base
```sql
create table if not exists public.product_events (
  id bigserial primary key,
  event_id uuid not null unique,                 -- UUIDv7 generado en backend o frontend
  event_name text not null,
  schema_version smallint not null default 1,
  event_time timestamptz not null,               -- cuando paso
  ingested_at timestamptz not null default now(),-- cuando entro

  user_id uuid null references public.profiles(id) on delete set null,
  anonymous_id text null,
  session_id text null,
  request_id text null,

  image_id uuid null references public.images(id) on delete set null,
  board_id uuid null references public.boards(id) on delete set null,
  job_id uuid null references public.generation_jobs(id) on delete set null,

  source text null,                              -- web, mobile_web, api
  page_path text null,
  device_type text null,                         -- mobile, desktop, tablet
  country_code text null,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists product_events_name_time_idx
  on public.product_events(event_name, event_time desc);

create index if not exists product_events_user_time_idx
  on public.product_events(user_id, event_time desc);

create index if not exists product_events_anonymous_time_idx
  on public.product_events(anonymous_id, event_time desc);
```

### 2.2 Reglas de calidad del evento
- `event_id` obligatorio para idempotencia.
- Reintentos deben reutilizar el mismo `event_id`.
- Todo evento debe incluir `event_time` (no usar solo `ingested_at`).
- Si falla tracking: modo best-effort (no romper endpoint principal).

### 2.3 Filtrado de trafico no util (bot/internal/test)
- Excluir trafico bot conocido por user-agent (lista mantenida en config).
- Excluir IPs internas/QA.
- Marcar `metadata.is_test_traffic = true` para entornos de testing.
- KPIs de negocio (UV, conversion, activacion, retencion) deben usar solo `is_test_traffic = false`.

---

## 3) Taxonomia canonica de eventos

### 3.1 Adquisicion
- `page_view`
- `session_started`
- `landing_viewed`

### 3.2 Conversion
- `signup_started`
- `signup_completed`
- `login_completed`

### 3.3 Activacion votante
- `like_added`
- `superlike_added`
- `board_item_added`

### 3.4 Activacion creador
- `generation_job_started`
- `generation_job_succeeded`
- `image_published`

### 3.5 Competencia
- `image_entered_competition`
- `image_crossed_cutoff_up`
- `image_crossed_cutoff_down`
- `image_survived`
- `image_eliminated`

### 3.6 Notificaciones
- `notification_created`
- `notification_read`

---

## 4) Identity stitching (anonymous -> user)

### 4.1 Tabla recomendada
```sql
create table if not exists public.identity_links (
  id bigserial primary key,
  anonymous_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now(),
  unique (anonymous_id, user_id)
);
```

### 4.2 Regla operacional
- Al `signup_completed`, guardar link `anonymous_id -> user_id`.
- Para funnels de adquisicion/conversion, usar identidad consolidada.

### 4.3 Definiciones de identidad
- `consolidated_visitor_id`:
  - si existe `user_id`: `user:{user_id}`
  - si no: `anon:{anonymous_id}`
- `qualified_visitors`:
  - `distinct consolidated_visitor_id` con `landing_viewed`
  - y (`session_duration >= 10s` o `page_view_count >= 2`)
  - filtrando `is_test_traffic = false`.

---

## 5) North Star y formula operativa

## North Star
`qualified_survivals_week`

Definicion:
- Imagen que `survive` en la cohorte semanal
- y ademas cumple:
  - `unique_likers >= X_week`
  - o `superlikes >= 1`

### 5.1 Definicion de X_week (no hardcode fijo)
`X_week = clamp(3, 30, ceil(P60(unique_likers de imagenes survived en ultimas 8 semanas)))`

### 5.2 Regla de cold start
- Si hay menos de 50 `survived images` en historial de 8 semanas:
  - usar `X_week = max(3, X_previous_week)`
  - si no existe historial: `X_week = 5`

---

## 6) Funnels causales (consistentes con eventos canonicos)

## Funnel visitante
`landing_viewed -> signup_started -> signup_completed -> like_added`

## Funnel creador
`signup_completed -> generation_job_started -> generation_job_succeeded -> image_published -> like_added_on_own_image -> image_survived`

Nota:
- `like_added_on_own_image` no es evento nuevo, es derivacion de `like_added` por `image_id`.

## Funnel curador
`signup_completed -> like_added -> superlike_added -> board_item_added -> day_7_active`

Nota:
- `day_7_active` es metrica derivada, no evento.

---

## 7) KPI catalogo minimo (con decision)

Cada KPI debe tener: formula, ventana, owner, accion.

1. UV 24h / 7d
   - Formula: `distinct consolidated_visitor_id`
   - Decision: adquisicion sube/baja

2. Signup conversion
   - Formula: `signup_completed / qualified_visitors`
   - Decision: friccion en onboarding

3. Voter activation
   - Formula: `% signup_completed con like_added < 10 min`
   - Decision: UX de feed inicial

4. Creator activation
   - Formula: `% signup_completed con image_published < 24h`
   - Decision: UX de create

5. TTFL mediana
   - Formula: mediana(`first_like_time - image_published_time`)
   - Decision: calidad de matching feed

6. Survival conversion por cohorte
   - Formula: `survived / entered_competition`
   - Decision: tension de corte

7. Superlike leverage
   - Formula: `survival_rate(superliked) - survival_rate(non_superliked)`
   - Metodo minimo anti sesgo: comparar por deciles de ranking inicial y edad de imagen.
   - Metodo objetivo (fase 2): propensity score matching.
   - Decision: valor real del superlike

8. D1 / D7 / D30 retention
   - Formula: por cohorte de signup
   - Decision: salud de producto

9. DAU/MAU stickiness
   - Formula: `DAU / MAU`
   - Decision: frecuencia de uso

10. Job success rate
    - Formula: `generation_job_succeeded / generation_job_started`
    - Decision: estabilidad de providers

11. P95 generation latency
    - Formula: P95(`job_completed_at - job_started_at`)
    - Decision: performance y costo

12. API error rate critico
    - Formula: errores / requests en endpoints clave
    - Decision: priorizacion de fiabilidad

### 7.1 Criterio formal de usuario activo (retencion)
`active_user_day` = usuario con >=1 evento en el dia de:
- `page_view`
- `like_added`
- `generation_job_started`
- `board_item_added`

### 7.2 Ownership catalog (obligatorio)
```sql
create table if not exists public.metric_catalog (
  metric_key text primary key,
  definition text not null,
  owner_role text not null,              -- product, growth, eng, data
  decision_playbook_url text null,
  sla_minutes integer not null default 60,
  updated_at timestamptz not null default now()
);
```

---

## 8) Segmentacion obligatoria

Todos los KPIs clave deben poder filtrarse por:
- anonymous / registered
- new / returning
- voter / creator / hybrid
- source
- device_type
- country_code (si existe)

---

## 9) Alertas dinamicas (no umbral fijo)

Para cada KPI critico:
- baseline: media movil de 14 dias
- `warn`: desviacion > 1 sigma
- `critical`: desviacion > 2 sigma

### 9.1 Cold start de alertas
- Si hay menos de 14 puntos diarios:
  - usar umbral fijo temporal
  - mostrar estado `learning`

Alertas minimas:
- caida de signup conversion
- caida de D1
- caida de job success rate
- subida de API error rate
- backlog de notificaciones unread anormal

---

## 10) Retencion de datos y performance

### 10.1 Retencion recomendada
- `product_events` raw: 180 dias
- agregados diarios/semanales: 2 anos

### 10.2 Escala
- Particionar `product_events` por mes (si volumen crece rapido).
- Materialized views para:
  - funnels diarios
  - cohortes de retencion
  - metricas de loop

---

## 11) SLA de datos

- Dashboard operativo (24h): lag maximo 5 minutos.
- Cohortes D1/D7/D30: refresh diario.
- Alertas: evaluacion cada 15 minutos.
- Backfill automatico:
  - si pipeline falla, re-ejecutar ultimas 24h.
  - si falla >24h, backfill de ultimas 72h.
  - dashboard muestra badge `backfilled` cuando aplica.

Todo KPI debe mostrar:
- timestamp de ultima actualizacion
- estado de frescura (`fresh`, `delayed`, `stale`)

---

## 12) Cambios de dashboard admin (estructura final)

## Bloque ejecutivo
- UV 24h (delta vs 7d)
- Registros 24h (delta vs 7d)
- Signup conversion
- D1 / D7
- DAU/MAU

## Bloque loop producto
- TTFL mediana
- Survival conversion por cohorte
- Superlike leverage
- Board save rate

## Bloque tecnico
- Job success rate
- P95 generation latency
- API error rate

## Bloque creators
- Active creators 24h
- Creator D7
- Top creators (formula visible)

## Bloque guardrails (salud de ecosistema)
- reportes de abuso por usuario (24h/7d)
- ratio de `self-vote rejection`
- churn de top creators
- concentracion de superlikes (Gini o HHI simple)

Cada card:
- valor actual
- delta
- contexto
- accion recomendada

---

## 13) Plan de implementacion (2 sprints reales)

## Sprint 1 (fundacion de datos)
1. Crear `product_events` + indexes + contrato de idempotencia.
2. Implementar helper `trackEvent()` (best-effort).
3. Emitir eventos en:
   - `/api/generation/jobs`
   - `/api/images/[id]/like`
   - `/api/images/[id]/superlike`
   - `/api/boards/[id]/items`
   - `finalize_cohort`
4. Capturar `anonymous_id` y `session_id` en frontend.
5. Crear `identity_links` y enlazar al signup.

## Sprint 2 (metricas de decision)
6. Crear vistas agregadas de funnels/cohortes/loop.
7. Rehacer `/api/admin/stats` sobre esas vistas.
8. Agregar deltas 24h vs 7d/14d.
9. Implementar alertas dinamicas con estado `learning`.
10. Publicar catalogo de metricas (formula + owner + accion).

---

## 14) Checklist de publicacion de KPI

Antes de exponer un KPI en admin:
- [ ] Tiene owner
- [ ] Tiene formula formal
- [ ] Tiene ventana explicita
- [ ] Tiene query reproducible
- [ ] Tiene segmentacion minima
- [ ] Tiene delta y tendencia
- [ ] Tiene accion recomendada
- [ ] Tiene SLA de frescura

---

## 15) Resultado esperado

Pasar de "dashboard bonito" a "sistema de control real de producto":
- decisiones consistentes,
- menos ruido de metricas superficiales,
- y foco en el loop que hace unico a Scrollever.
