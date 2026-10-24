# Preview — Ordinovix

## Run it on your machine
Run the following PowerShell command in the workspace root:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/preview.ps1
```
Or directly:
```powershell
npm.cmd run dev
```

- **Opens:** `http://localhost:5173/`
- **Stop:** Press `Ctrl+C` in the terminal
- **Reset data:** Open Dev Menu in top bar (or bottom navigation) and click "Reset sample data"

## Try it on the real target
- **Desktop (Chrome/Edge):** Open `http://localhost:5173/`. Test at 1024px, 1280px, 1440px wide.
- **Mobile simulation:** Press F12 in Chrome -> Toggle device toolbar -> Select iPhone 14 (390px) or Pixel 7 (412px).
- **Tablet simulation:** Set viewport to 768px (iPad Mini) to test tablet icon rail.

## What this host can and cannot do
- **Host OS:** Windows 11 (PowerShell environment)
- **Web / PWA previews:** Full support via Chrome and local Vite dev server.
- **Native iOS builds:** Not supported locally on Windows. Cloud/web preview used for mobile viewport testing.

## Demo accounts and data
- **Ana (Owner):** Full visibility and control across all clients, templates, offices, and settings.
- **Ben (Helper):** Restricted visibility strictly scoped to assigned clients (RSP Law, Cruz Litigation).
- **Switch personas:** Use the Dev Menu in the top bar to toggle between Ana and Ben immediately.
- **Deterministic seed:** Mulberry32 generator with seed `20261024`.

## Matrix covered by automated evidence
- Viewports: 360px, 390px, 768px, 1024px, 1280px, 1440px
- Themes: Light mode ("Sheets on Paper"), Dark mode ("Carbon Copy")
- Failure simulation: 0%, 10%, 50%, 100% latency/error rates via Dev Menu
