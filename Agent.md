# Agent.md — ProxyCeptor Commander (proxy-testsuite)

Authoritative guide for AI agents and developers working inside `proxy-testsuite/`.

---

## 1. Overview & Ecosystem Context

**ProxyCeptor Commander** (directory: `proxy-testsuite/`, package: `proxyceptor-commander v2.6.0`) is a lightweight, local-first API testing and debugging suite integrated into the **ProxyCeptor Cloud Ecosystem**.

### Background & Evolution
- Originally prototyped as a lightweight alternative to Postman (formerly internal codename *Restify*/*Curlify*).
- Fully adopted into ProxyCeptor as **ProxyCeptor Commander**.
- Operates both as a standalone testing utility on port `8080` (or Vite preview) and as an embedded sub-application inside `proxy-dashboard` served at `/test/` (deployed via `node scripts/deploy-test.mjs`).

---

## 2. Technical Stack & Architecture

- **Runtime & Bundler**: Node.js ESM, Vite, TypeScript (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`).
- **UI Framework**: React 18, Tailwind CSS, Lucide React icons, Radix UI / shadcn-ui components.
- **Testing Engine**: Vitest (`vitest run`, 28+ unit tests passing).
- **Data Persistence**: 100% Local-first via browser `localStorage`. No mandatory login or external telemetry required for core API testing.
- **Distribution Outputs**: Emits standard web assets and cross-domain embeddable bundles:
  - `dist/restifysdk.js`
  - `dist/restifystyle.css`
  - `dist/index.html`

---

## 3. Core Modules & Component Architecture

### 3.1 Request Workbench & Main Interface (`src/components/ApiTester.tsx`)
- Orchestrates tabs, request execution, collection management, history, and environment variables.
- Supports all HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.
- Handles parameter interpolation using `{{variable}}` syntax from active environments.

### 3.2 Modern JSON Viewer (`src/components/ModernJsonViewer.tsx`)
- High-performance, dark-slate (`#0b0f19`) tree viewer for formatted API responses.
- **Integrated Line Numbers**: Gutter rendered inline with tree nodes to prevent vertical desynchronization.
- **Active Indent Rails**: Visual vertical guidelines indicating scope depth.
- **Row-Hover Micro-Toolbar**:
  - One-click copy for exact JSONPath (e.g. `$.data.user.id`).
  - One-click copy for node values.
- **Smart Decoders & Previewers**:
  - **Video Streaming URLs**: Detects `.mpd` (DASH), `.m3u8` (HLS), and `videoURL` keys; renders an inline preview launcher with an HTML5 / video.js modal player.
  - **Epoch Timestamps**: Converts millisecond and second timestamps into human-readable ISO/locale date chips.
  - **Color Swatches**: Inline color chips for hex/rgb strings.
  - **Array Table View**: Toggleable tabular presentation for homogenous object arrays.
  - **Search & Filter**: Real-time keyword filter with dynamic match counter.

### 3.3 HAR Archive Ingestion Engine (`src/lib/harParser.ts` & `src/components/HARImportDialog.tsx`)
Enables developers to convert HTTP Archive (`.har`) files exported from Chrome DevTools or ProxyCeptor Network tab into testable collections.

- **Pipeline**:
  1. **Upload & Validate**: Validates JSON structure, confirms `log.entries` presence, supports files up to 100MB.
  2. **Domain Filter**: Exact hostname matching (e.g., `api.sonyliv.com` or empty for all).
  3. **Route Filter**: Substring search on URL path (e.g., `/api/v2/` or empty for all).
  4. **Smart API Detection**:
     - Automatically includes JSON REST endpoints and non-GET mutation calls.
     - Automatically excludes static web assets (images, CSS, JS, fonts, media).
  5. **Header & Body Extraction**:
     - Strips browser-internal pseudo-headers (`:method`, `:path`, `:authority`).
     - Preserves `Authorization`, `Content-Type`, and custom business headers.
     - Formats JSON POST/PUT payloads.
  6. **Auto Collection Generation**:
     - Formats collection title: `{domain} - HAR Import {YYYY-MM-DD}`.
     - Automatically generates clean request names: `{METHOD} {route_segment}`.
     - Switches UI context to the imported collection immediately.

### 3.4 Execution & Proxy Forwarder Integration (`src/lib/testRunner.ts`)
- Dispatches client-side fetch requests directly or proxies them through the ProxyCeptor Cloud CORS Proxy / Forwarder (`/proxy`, `/api/proxy` on `:3000` / `https://api.proxyceptor.com`).
- Passes `x-sdm-api-key` and `x-sdm-server-override` headers when interacting with ProxyCeptor Cloud workspace MITM rules.

---

## 4. Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
|---|---|---|
| `Ctrl + Enter` / `Cmd + Enter` | Send Active Request | Global / Editor |
| `Ctrl + N` / `Cmd + N` | Create New Request | Global |
| `Ctrl + D` / `Cmd + D` | Duplicate Active Request | Global |
| `Ctrl + W` / `Cmd + W` | Close Active Request Tab | Global |

---

## 5. Development & Deployment Commands

Run all commands from `proxy-testsuite/` (or via monorepo root scripts):

```bash
# Start local development server (http://localhost:8080)
npm run dev

# Run unit test suite (Vitest)
npm run test

# Run tests in watch mode
npm run test:watch

# Build production bundle (runs tests + vite build -> dist/)
npm run build

# Deploy built testsuite directly to proxy-dashboard/public/test/
npm run deploy

# Mirror changes to VERSION-CONTROL submodule (branch main)
npm run commit "commit message"

# Mirror changes to PRODUCTION-DEPLOYMENT (branch PRODUCTION-DEPLOYMENT)
npm run deployment "deployment message"
```

---

## 6. Monorepo Integration & Deployment Targets

1. **Local Monorepo**:
   - `proxy-testsuite` builds to `proxy-testsuite/dist/`.
   - `scripts/deploy-test.mjs` cleans and mirrors `proxy-testsuite/dist/` into `proxy-dashboard/public/test/`.
   - When running `npm run dev` at the root, `proxy-dashboard` exposes the commander at `http://localhost:5174/test/`.

2. **Upstream Git Repositories**:
   - Version control repo: `../VERSION-CONTROL/proxy-testsuite` (branch: `main`).
   - Production deployment repo: `../DEPLOYMENT/proxy-testsuite` (branch: `PRODUCTION-DEPLOYMENT`).

---

## 7. Development Guidelines & Invariants

- **No Framework Churn**: Maintain pure React 18 + Tailwind CSS. Avoid introducing heavy external UI dependencies.
- **Maintain Test Coverage**: Ensure `npm run test` passes without errors prior to pushing or deploying.
- **Local-First Privacy**: Never introduce third-party telemetry, tracking scripts, or mandatory remote cloud dependencies for basic request sending.
- **Bundle Optimization**: Keep bundle size compact; preserve standalone embeddability via `restifysdk.js`.
