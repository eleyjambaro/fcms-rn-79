# Web Admin Console (Super-Admin Operator Area)

> Status: **Active implementation plan** (supersedes the earlier draft).
> Keep this repo copy in sync — update it whenever the plan or implementation changes.
> Audience: super-admins only (FCMS operators), not tenant company users.
> Repos: `fcms-cloud-nextjs` (web), `fcms-api` (Laravel backend).

## Context

We (the FCMS vendor) need an operator-only console inside the existing web app
(`fcms-cloud-nextjs`) to run the business and debug production without touching
the CLI or DB directly:

1. **Licenses** — generate, list, inspect, and revoke customer licenses + their
   device/branch grants.
2. **Request Logs** — browse the API request log to debug what any mobile or web
   client actually sent and received (both clients hit the same `fcms-api`, so
   one log covers all three tiers).
3. **Ops/Debug** — bump the minimum app version; extensible for future operator
   tools.

This is gated behind **super-admin** (`accounts.is_super_admin`) and is distinct
from the per-tenant company screens. The **licensing/request-log/app-version
backends already exist** — the bulk of this work is the web UI plus a small set
of new read endpoints and session plumbing.

**Decisions (confirmed with user):**
- Plan **all three areas, phased** (P1 Licenses → P2 Request Logs → P3 Ops).
- Use a **separate `app/(admin)` shell** with its own server-gated layout and a
  distinct operator sidebar — not folded into the tenant sidebar.
- **Keep license-generation semantics as-is** (inactive/unbound at generation;
  customer binds on activation). No changes to the activation contract.

### Key constraint discovered

`proxy.ts` (the Next 16 middleware successor) only gates on **cookie presence**
(`session` + `branch`) — it cannot read `is_super_admin`. Super-admin operators
are otherwise ordinary signed-in users who pass that gate. Therefore the
`(admin)` group **must** enforce super-admin in a **server-component layout**
that resolves the session server-side and redirects/404s non-admins. UI hiding
(sidebar) is cosmetic only; every admin API endpoint is already `super.admin`-
gated server-side, which is the real enforcement boundary.

---

## Backend changes (`fcms-api`, source under `src/`)

> Reminder: `./src` is a read-only Docker overlay; edits + migrations apply on
> container rebuild (entrypoint auto-migrates), not live. DB is **PostgreSQL** —
> any raw SQL must be Postgres-flavored (`ILIKE`, `COALESCE`).

### B1. Expose `is_super_admin` to the session (required for P1 gating)

`AuthController::formatAccount()` (`app/Http/Controllers/AuthController.php`,
~line 559) does **not** currently return `is_super_admin`. Add:

```php
'is_super_admin' => (bool) $account->is_super_admin,
```

This flows through `signin`/`signup`/`verify-otp`/`me` (all use `formatAccount`)
and into the web session. No migration needed — column already exists
(`2024_01_01_000027_alter_accounts_add_is_super_admin`), already cast to bool on
the `Account` model.

### B2. Request-log read API (P2) — new `Admin\RequestLogController`

New controller `app/Http/Controllers/Admin/RequestLogController.php`, routes in
`routes/api.php` under the existing `admin` group pattern
(`['auth:sanctum', 'super.admin', 'throttle:api']`, alongside `admin/licenses`):

- `GET  /api/v2/admin/request-logs` — paginated + filterable.
- `GET  /api/v2/admin/request-logs/{request_id}` — full detail.

Reuse the existing pagination envelope: extend `Web\ApiController`'s
`paginated($query, $format, $request)` helper, or replicate its
`{status, data, pagination:{current_page, per_page, total_pages, total_items}}`
shape. Model: `App\Models\ApiRequestLog` (casts JSON columns already).

**Filters** (all optional, AND-combined) on `ApiRequestLog`:
- `company_id`, `account_id` (exact, indexed)
- `status_code` (exact) **and** `status_class` (`2xx|4xx|5xx` → range) — add a
  quick "errors only" = `status_code >= 400`
- `method` (exact)
- `path` / `route_name` contains (Postgres `ILIKE '%…%'`)
- `request_id` (exact, indexed)
- `from` / `to` on `logged_at` (range; column is indexed, ms precision)
- `q` free-text over `path` + `route_name`
- Order `logged_at DESC`; default `per_page` 25, clamp 1–100.

**Redaction on read** (defense in depth — write-time already redacts the
`Authorization` header → `Bearer [REDACTED]` and masks `password*`/`token`/
`secret` in bodies, see `LogApiRequest.php`). Add a `redact()` pass on the read
side that strips `authorization`/`cookie`/`set-cookie` headers and re-masks the
same sensitive body keys, so even legacy rows logged before a redaction rule
existed are safe. Centralize the key list so write + read stay in sync.

**Retention**: already auto-prunes rows older than 30 days (1-in-100 request
probability in `LogApiRequest`). No new work; document the window in the runbook.

### B3. License detail enrichment (P1, optional polish)

`Admin\LicenseController::show` already returns `allowed_device_ids` /
`allowed_branch_ids` (it eager-loads `devices.device`, `branches.branch`). For a
useful detail page, enrich `formatLicense(..., includeAssignments: true)` to
return device/branch **names + assigned_at** (not just IDs) and **issuance
history** from `tokenIssuances` (`reason`, `issued_at`, `expires_at`, device).
The relationships already exist on the `License` model; this is a formatting-only
change in `LicenseController.php`, no migration. (If we keep IDs-only initially,
the UI still works — treat this as P1 polish.)

### B4. Tests

- Update `AuthTest` / add assertion that `me`/`signin` payload includes
  `is_super_admin`.
- New `tests/Feature/AdminRequestLogTest.php`: super-admin can list/filter/detail;
  non-super-admin gets 403; redaction strips auth header + masks secrets.
- Run scoped: never run the full suite against the live DB — use the `*_test`
  isolation already enforced by `tests/bootstrap.php`. Note baseline noise:
  `ExampleTest` + `SyncTest::push-skips-duplicate` fail at HEAD.

---

## Web changes (`fcms-cloud-nextjs`)

### W1. Session: surface `is_super_admin`

- `types/api.ts` — add `is_super_admin?: boolean` to `Account`.
- `app/api/auth/session/route.ts` already passes `data.account` through verbatim,
  so once B1 ships the flag appears on the session automatically. No proxy change
  (admin paths already pass through the generic BFF + are super-admin-gated
  server-side).

### W2. `(admin)` route group + server-side gate

New `app/(admin)/layout.tsx` as a **server component**:
- Resolve the session server-side (reuse the helpers in `lib/auth/session.ts` —
  `getToken()` + an upstream `/api/v2/auth/me` call, mirroring
  `app/api/auth/session/route.ts`).
- If not authenticated → `redirect('/sign-in')`; if authenticated but
  `!account.is_super_admin` → `notFound()` (404, don't reveal the area exists).
- Render an **operator shell**: reuse `SidebarProvider`/`SidebarInset`/`Topbar`
  from the `(app)` layout but with a new `AdminSidebar` (see W3). Do **not** wrap
  in `LicenseGateProvider` (that's tenant licensing, irrelevant here).

Pages live under `app/(admin)/admin/...` so the URL space is `/admin/*`.

### W3. Operator navigation

New `components/layout/admin-sidebar.tsx` (mirror `app-sidebar.tsx`) with its own
section list — Licenses, Request Logs, Ops — plus a "back to app" link. Keep it
separate from `nav-config.ts` so operator nav never leaks into the tenant
sidebar. (Optional: in the tenant `app-sidebar`, show a single "Admin Console"
link when `session.account.is_super_admin` is true, as the entry point.)

### W4. Data hooks (mirror `lib/hooks/use-crud.ts` + `lib/api/client.ts`)

The generic `useResourceList`/`useResourceItem`/`useResourceMutations` almost fit,
but the admin pagination envelope differs (`total`/`last_page` vs
`total_items`/`total_pages`) and license create/revoke aren't standard REST.
Add thin dedicated hooks:

- `lib/hooks/use-licenses.ts`:
  - `useLicenses(params)` → `apiGet('admin/licenses' + query)`; map
    `pagination.{total,last_page}` → the DataTable's `{total_items,total_pages}`.
  - `useLicense(id)` → `apiGet('admin/licenses/{id}')`.
  - `useLicenseMutations()` → `create` (`apiPost('admin/licenses', body)`),
    `revoke` (`apiPost('admin/licenses/{id}/revoke')`), invalidating
    `['admin/licenses']`.
- `lib/hooks/use-request-logs.ts`: `useRequestLogs(params)`,
  `useRequestLog(requestId)`.
- `lib/hooks/use-app-version.ts`: `useAppVersion(env)` (`apiGet('app-version?env=')`)
  + `useUpdateAppVersion()` (`apiPut('admin/app-version', body)`).

All calls go through the same-origin BFF via `lib/api/client.ts` (`apiGet`, etc.),
which the proxy injects the cookie token into — no client token handling.

### W5. Pages (reuse `components/data-table/DataTable`, shadcn `Dialog`, RHF+Zod, `sonner`)

**P1 — `/admin/licenses`** (`components/admin/licenses-page.tsx`):
- Filter bar: `status` select (`inactive|active|revoked|expired`), `company_id`,
  free text; "Generate license" button.
- `DataTable` columns: license_key (truncated + copy), plan, status (badge),
  company_name, max_devices/branches, expires_at, created_at. Row → detail.
- **Generate dialog** (RHF + Zod, validation mirrors `@store` exactly):
  `duration_type` (`days|minutes|exact_date`, required) → conditionally
  `duration_length` (required unless exact_date) or `exact_expiration_date`
  (required if exact_date); optional `plan` (default "standard"),
  `max_devices`/`max_branches` (min 1, default 1), `cost_per_duration` (min 0),
  `remarks` (max 1000), optional `features` overrides. On success show the new
  `license_key` prominently with copy-to-clipboard (it's what the customer needs).

**P1 — `/admin/licenses/[id]`** (`app/(admin)/admin/licenses/[id]/page.tsx`
async params → `components/admin/license-detail.tsx`):
- Status/expiry summary, plan, company, cost, remarks, generated_by, features.
- Devices, branches, issuance history (from B3 enrichment).
- **Revoke** action behind a confirm `Dialog`; disabled if already revoked
  (endpoint returns 409 — surface via `getErrorMessage`).

**P2 — `/admin/request-logs`** (`components/admin/request-logs-page.tsx`):
- Filter bar: method, status (incl. "errors only ≥400" quick toggle),
  company_id, account_id, path/route contains, `from`/`to` datetime, request_id.
- `DataTable` columns: logged_at (ms), method, path, status (color badge),
  duration_ms, company/account. `keepPreviousData` for paging.
- `/admin/request-logs/[id]` detail: pretty-printed JSON for request headers /
  query / body and response body (collapsible), copy `request_id`. Render the
  **redacted** payloads returned by B2.

**P3 — `/admin/ops`** (`components/admin/ops-page.tsx`):
- App-version form per `environment` (`dev|prod`): `ios_version`,
  `android_version`, `ios_minimum_supported`, `android_minimum_supported`
  (all required strings) → `useUpdateAppVersion`. Pre-fill from `useAppVersion`.
- Placeholder section for future debug tools (device lookup, sync status).

### W6. E2E (Playwright, existing `e2e/` + `playwright.config.ts`)

Add an `e2e/admin.spec.ts`: a non-super-admin hitting `/admin/licenses` gets
404/redirect; a super-admin sees the console, can open the Generate dialog, and
the request-logs filter bar renders. (Network-mock the admin endpoints or seed a
super-admin per the existing e2e auth setup.)

---

## Implementation status

- **P1 — Licenses: DONE + verified (2026-06-25).** Backend B1 (`is_super_admin`
  in `formatAccount`) + B3 (license `show` enriched with device/branch names +
  issuance history). Web: `is_super_admin` on `Account`, new
  `types/admin-console.ts`, `lib/hooks/use-licenses.ts`, server-gated
  `app/(admin)/layout.tsx`, `components/layout/admin-sidebar.tsx`, licenses
  list + generate dialog + detail/revoke under `app/(admin)/admin/licenses/**`,
  and a super-admin-only "Admin Console" entry in the tenant sidebar footer.
  B4 tests: new `AuthTest` is_super_admin assertions (split per-method to dodge
  the Sanctum first-user guard cache) + `AdminLicenseTest` enrichment test —
  **14 passing** in the rebuilt container. Web verified: `tsc`, ESLint, prod
  `next build` (both `/admin/licenses` routes compile), and `e2e/admin.spec.ts`
  gate test green (signed-out → sign-in; the non-super-admin 404 case is the
  E2E_FULL opt-in). Backend live in the container (user rebuilt).
- **P2 — Request Logs: DONE + verified (2026-06-25).** Backend B2: new
  `Admin\RequestLogController` (`index` filterable/paginated + `show` by
  `request_id`), routes under the `admin` super-admin group, and a shared
  `App\Support\ApiLogRedactor` now used by BOTH `LogApiRequest` (write) and the
  controller (read) so the secret-key list can't drift — read-time redaction
  also masks **response bodies** (which the middleware doesn't mask at write
  time, e.g. auth responses carrying a `token`). Filters: company_id,
  account_id, status_code, status_class (2xx/3xx/4xx/5xx), errors_only (≥400),
  method, path/route_name ILIKE, request_id, from/to, q. Web: `RequestLogRow`/
  `RequestLogDetail` types, `lib/hooks/use-request-logs.ts`, explorer list
  (filter bar + DataTable) + JSON detail under
  `app/(admin)/admin/request-logs/**`. Tests: new `AdminRequestLogTest`
  (list/filter/redaction/403/404) — **21 admin+auth tests passing**. Web: `tsc`,
  ESLint, prod `next build` (all 4 admin routes compile) green.
- **P3 — Ops/Debug: DONE + verified (2026-06-25).** Backend already existed
  (`AppVersionController` update + public show); added `AdminAppVersionTest`
  (bump / super-admin 403 / 401 / 422). Web: `lib/hooks/use-app-version.ts`
  (`useAppVersion(env)` maps the public 404 → null so a never-set env starts
  empty; `useUpdateAppVersion`), `components/admin/ops-page.tsx` (env-scoped
  app-version bump form keyed on env + a "more tools" placeholder), route
  `app/(admin)/admin/ops`. **25 admin+auth tests passing**; `tsc`, ESLint, prod
  `next build` (all 5 admin routes compile) green.

**Console complete — all three phases shipped.** Remaining optional polish:
license generate `features` overrides UI (currently sends server defaults); the
E2E_FULL non-super-admin 404 / super-admin happy-path e2e (needs a seeded
super-admin); request-log `from`/`to` datetime pickers (the API already accepts
them — only the UI inputs are unbuilt).

## Suggested phasing

1. **P1 — Licenses** (highest value, backend mostly done): B1 + W1 + W2 + W3 +
   `use-licenses` + licenses list/detail/generate. Ships the operator shell +
   super-admin gating.
2. **P2 — Request Logs**: B2 (controller + redaction-on-read + tests) +
   `use-request-logs` + explorer pages.
3. **P3 — Ops/Debug**: `use-app-version` + ops page (app-version bump), then
   future tools.
4. **B3** license-detail enrichment can land with P1 or as a fast follow.

---

## Security considerations

- Enforce `super.admin` **server-side** on every admin endpoint (already true for
  `admin/licenses` + `admin/app-version`; same middleware for `admin/request-logs`).
  The `(admin)` server layout gate is UX; the API gate is the real boundary.
- Redact secrets in request-log payloads **on read** as well as write (B2), so
  legacy rows are covered.
- License generate/revoke are sensitive — they're themselves captured in
  `api_request_logs` under `admin/*`, giving a built-in audit trail
  (filterable in P2). No separate audit table needed initially.
- Admin endpoints stay under `throttle:api`; consider a stricter throttle later.

---

## Verification

**Backend (`fcms-api`):**
- Rebuild the Docker container so overlay edits + any migration apply
  (entrypoint auto-migrates). Local API at `:8080`.
- `php artisan test --filter=AdminRequestLogTest` and the updated `AuthTest`
  (scoped, `*_test` DB only — never the full suite against live pgsql).
- `curl` `GET /api/v2/admin/request-logs` with a super-admin Sanctum token →
  paginated, redacted; with a non-admin token → 403.

**Web (`fcms-cloud-nextjs`):**
- `npm run dev` (Next 16 — curl the already-running server; it blocks a 2nd dev
  server in the same dir). Sign in as a super-admin → `/admin/licenses` loads;
  sign in as a normal user → `/admin/*` 404s.
- Generate a license end-to-end; confirm the `license_key` is shown + copyable
  and the new row appears (cache invalidated). Open detail; revoke; confirm the
  409-already-revoked path surfaces a toast.
- Request Logs: trigger a known 4xx (e.g. a bad request from the RN app or web),
  filter "errors only", open its detail, confirm `Authorization`/cookie headers
  and `password`/`token` fields are redacted.
- Ops: bump app version for `dev`, confirm `GET /api/v2/app-version?env=dev`
  reflects it.
- `npx playwright test e2e/admin.spec.ts`; `npm run lint`.

---

## Key files

**fcms-api**
- `app/Http/Controllers/AuthController.php` (`formatAccount` — B1)
- `app/Http/Controllers/Admin/LicenseController.php` (B3 enrichment)
- new `app/Http/Controllers/Admin/RequestLogController.php` (B2)
- `app/Http/Middleware/LogApiRequest.php` (shared redaction key list)
- `app/Models/ApiRequestLog.php`, `App\Models\License*`
- `app/Http/Controllers/Web/ApiController.php` (`paginated` helper to reuse)
- `routes/api.php` (`admin/*` group), `app/Http/Middleware/EnsureSuperAdmin.php`
- `tests/Feature/AdminRequestLogTest.php` (new), `AuthTest`

**fcms-cloud-nextjs**
- `types/api.ts` (Account.is_super_admin)
- new `app/(admin)/layout.tsx` (server gate) + `app/(admin)/admin/**` pages
- new `components/layout/admin-sidebar.tsx`
- new `lib/hooks/use-licenses.ts`, `use-request-logs.ts`, `use-app-version.ts`
- reuse `lib/api/client.ts`, `lib/hooks/use-crud.ts`, `lib/auth/session.ts`,
  `components/data-table/data-table.tsx`, shadcn `ui/dialog`, `sonner`
- new `components/admin/*` (licenses-page, license-detail, request-logs-page,
  request-log-detail, ops-page)
- `e2e/admin.spec.ts` (new)
