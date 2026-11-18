# NEXORA Desktop (Phase 10 - not started)

The desktop edition will be a Tauri 2 shell around the same `apps/web` build, launching the same Python backend as a sidecar process (bundled with PyInstaller or a uv-managed runtime) on a random loopback port, passing the per-launch token over the sidecar's stdout. No business logic will live here.

Nothing is implemented yet: Rust was not available in the environment where v0.1.0 was built. Until then, use the browser edition (`pnpm start`).
