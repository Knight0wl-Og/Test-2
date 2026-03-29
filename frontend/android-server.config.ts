/**
 * Capacitor Server Configuration Guide
 *
 * Edit capacitor.config.ts to change the server URL:
 *
 * OPTION A — Local WiFi (Development)
 *   Connect phone and PC to same WiFi. Run backend on PC.
 *   Set: server.url = 'http://192.168.x.x:3001'
 *        server.cleartext = true
 *
 * OPTION B — Cloud/VPS Deployment
 *   Deploy backend to a server (Render, Railway, VPS, etc.)
 *   Set: server.url = 'https://your-backend.com'
 *
 * OPTION C — Bundled (Offline Demo)
 *   Remove server.url entirely. App serves from bundled assets.
 *   API calls will go to relative paths (won't work without backend).
 *   Good for UI demo only.
 */
export {};
