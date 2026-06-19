import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a static `out/` directory on `next build`. This app is a client-side
  // SPA (one `'use client'` route; all runtime data comes from the Tauri SQLite
  // plugin, not Server Components/fetch) with no server features, so a static
  // export is the correct production output.
  //
  // It is REQUIRED for the desktop build: `src-tauri/tauri.conf.json` points
  // `frontendDist` at `../out`, which only exists when `output: 'export'` is set
  // (without it `next build` emits `.next/` and the Tauri bundle ships no UI).
  //
  // Applied unconditionally on purpose: `output: 'export'` only affects
  // `next build`; `next dev` (used by `npm run dev` and the Playwright e2e
  // webServer) is unaffected, so the web dev workflow keeps working, and the
  // web `npm run build` artifact stays identical to what Tauri bundles.
  // (Trade-off: `next start` is not applicable to a static export — there is no
  // server to start. That's fine here; there is no server deploy target.)
  output: "export",
};

export default nextConfig;
