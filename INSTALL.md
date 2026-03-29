# TradeEdge — Installation Guide

> **Demo Mode:** When live market data is unavailable, TradeEdge automatically falls back to realistic demo data so you can explore the full UI immediately.

---

## Windows Desktop (Electron)

### Option A — Run from Source

**Prerequisites — install in this order:**
1. [Node.js 20 LTS](https://nodejs.org)
2. [Git for Windows](https://git-scm.com/download/win)
3. [PostgreSQL 16](https://www.postgresql.org/download/windows/) — optional, app works without it (uses demo data)
4. [Redis for Windows](https://github.com/tporadowski/redis/releases) — optional

**Setup:**
```bat
git clone https://github.com/knight0wl-og/test-2.git TradeEdge
cd TradeEdge
setup.bat
```

The `setup.bat` script installs dependencies, creates the database, runs migrations, and starts the app at http://localhost:5173.

To open as a native desktop window (while dev server is running):
```bat
npm run dev:electron
```

### Option B — Pre-built Installer (.exe)

1. Download `TradeEdge-Setup-x64.exe` from the [Releases page](https://github.com/knight0wl-og/test-2/releases)
2. Run it — no admin rights needed
3. Launch from Start Menu or Desktop
4. Backend starts automatically; demo data loads immediately

### Build the Installer Yourself

```bat
npm install
npm run build:win
REM Creates: electron\out\TradeEdge Setup x64.exe
```

---

## Android APK

### Option A — Install Pre-built APK

1. Download `TradeEdge.apk` from the [Releases page](https://github.com/knight0wl-og/test-2/releases)
2. On your Android phone: **Settings → Security → Install unknown apps → enable**
3. Open the APK file and tap **Install**

**Connect to your PC (same WiFi network):**
1. Make sure `npm run dev` is running on your PC
2. Open TradeEdge on Android → tap ⚙ in the header
3. Enter `http://YOUR-PC-IP:3001`
   - Find PC IP: open Command Prompt → `ipconfig` → IPv4 Address
4. Tap **Save & Reload**

> Without a backend, the app uses demo data automatically — no setup required.

### Option B — Build APK from Source

**Prerequisites:** Node.js 20+, [Android Studio](https://developer.android.com/studio)

```bash
git clone https://github.com/knight0wl-og/test-2.git TradeEdge
cd TradeEdge/frontend
npm install
npm run build

# First time only:
npx cap add android

# Sync and build:
npx cap sync android
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Install to phone via USB:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## npm Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend (3001) + frontend dev server (5173) |
| `npm run dev:electron` | Same + open Electron desktop window |
| `npm run build:win` | Build Windows .exe installer |
| `npm run build:linux` | Build Linux AppImage |
| `npm run db:migrate` | Run PostgreSQL schema migrations |

---

## Deploying Backend to the Cloud

### Render (free tier)
1. Push repo to GitHub
2. [render.com](https://render.com) → New Web Service → connect repo
3. Root Directory: `backend` | Build: `npm install && npm run build` | Start: `node dist/index.js`
4. Add a free PostgreSQL database, copy its `DATABASE_URL` to service env vars
5. Use the Render URL in Android app settings

### Railway
```bash
npm install -g @railway/cli && railway login && railway init && railway up
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| PostgreSQL won't connect | `net start postgresql-x64-16` (Windows) |
| Port 3001 in use | Set `PORT=3002` in `.env` |
| Android: Connection refused | Same WiFi network required; check Windows Firewall |
| Open firewall port | Run as Admin: `netsh advfirewall firewall add rule name="TradeEdge" dir=in action=allow protocol=TCP localport=3001` |
| APK install blocked | Settings → Security → Install unknown apps → enable |
| No live data | Normal — app uses demo data when backend/internet unavailable |
