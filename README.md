# ProxyCeptor Commander

**High-Performance, Local-First API Testing & Traffic Replay Suite**

ProxyCeptor Commander (`proxy-testsuite`) is a lightweight, privacy-focused API client and production traffic workbench built for the **ProxyCeptor Ecosystem**. It functions both as an autonomous developer workspace and as an embedded workbench inside the ProxyCeptor Cloud Dashboard (`/test`).

---

## Key Features

- **🔒 100% Local-First & Private**: All requests, collections, environment variables, and history persist in local browser storage. Zero telemetry, no external accounts required.
- **⚡ Sub-Second Startup**: Native web architecture that opens instantly without the multi-gigabyte bloat of Electron-based clients.
- **🎯 Smart cURL Ingestion**: Paste any raw cURL command to instantly generate an executable, parameterized request.
- **📦 HAR Archive Import**: Convert browser or ProxyCeptor DevTools network recordings (`.har`) into ready-to-run API test collections with automated domain and route filtering.
- **🔍 Modern JSON Response Viewer**:
  - Gutter line numbers synchronized with tree nodes.
  - Active visual indent rails.
  - JSONPath (`$.path`) and value one-click copy on hover.
  - Smart value decoders: human-readable dates for epoch timestamps, inline color chips, and built-in video stream previews (`.m3u8`, `.mpd`).
  - Real-time search with match indicators.
- **🌐 ProxyCeptor Cloud Forwarding**: Built-in bridge to the ProxyCeptor Cloud CORS Proxy (`/proxy`) enabling cross-origin execution and server-side MITM rule evaluation.
- **⌨️ Keyboard Driven**: Built for speed with dedicated shortcut hotkeys (`Ctrl+Enter`, `Ctrl+N`, `Ctrl+D`, `Ctrl+W`).

---

## Quickstart

### 1. Run Locally
```bash
# From proxy-testsuite/
npm install
npm run dev
```
The application will launch at `http://localhost:8080/`.

### 2. Run Tests
```bash
npm run test
```

### 3. Build & Deploy to ProxyCeptor Dashboard
```bash
npm run build
npm run deploy
```
This builds the production assets and synchronizes them into `proxy-dashboard/public/test/`.

---

## Keyboard Shortcuts

| Shortcut | Description |
|---|---|
| `Ctrl + Enter` / `Cmd + Enter` | Send current request |
| `Ctrl + N` / `Cmd + N` | Create a new request |
| `Ctrl + D` / `Cmd + D` | Duplicate the active request |
| `Ctrl + W` / `Cmd + W` | Close the current request tab |

---

## Project Structure

```
proxy-testsuite/
├── src/
│   ├── components/      # UI components (ApiTester, ModernJsonViewer, HARImportDialog)
│   ├── lib/             # Core engines (harParser, testRunner, utils)
│   ├── types/           # TypeScript definitions
│   └── test/            # Vitest unit test suite
├── public/              # Static assets and icons
├── scripts/             # Git submodule commit & deployment automation
├── Agent.md             # In-depth technical architecture & agent instructions
├── README.md            # Product overview & quickstart guide
└── vite.config.ts       # Bundling configuration
```

---

## License

MIT
