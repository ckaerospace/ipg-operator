# Plasma wind tunnel

Mobile-first operator console for inductive plasma generators IPG3, IPG4, and IPG6-S. Run a frozen-exit collisionless plume and inspect the characteristics field (ṁ and coupled-power isolines).

Chemistry is **remote** (CEA over HTTP). This app does not reimplement CEA.

## Run locally

```bash
npm install
npm run dev
```

The dev server binds **http://127.0.0.1:43180**. Unit tests (no browser): `npm test`.

Production build (static files in `dist/`):

```bash
npm run build
npm run preview
```

## Chemistry API

Base URL (override with env):

```
VITE_API=https://ipg-cea-api.onrender.com
```

Copy `.env` or export `VITE_API` before `npm run dev`. Endpoints used:

- `GET /api/health` — liveness (cold start on the free host can take ~30 s)
- `GET /api/catalog` — generators and gases (geometry is also baked into the Setup card)
- `POST /api/solve` — generator (pinj + ṁ → hinj) or enthalpy (pinj + hinj) plus plume grid. This PWA always posts `plume_mode: collisionless` and omits `p_tank_Pa`
- `POST /api/characteristics` — ṁ / power isolines, kinks, chamber composition (`n_h = 29`, `hinj_min`/`hinj_max` 1–70; falls back to `n_h = 13` without those keys if the wider sweep fails)

The live public PWA is Thesis-only:

- **Setup / Plume / Map** — always `plume_mode: collisionless`. No tank pressure, NPR, Object Probe, sudden-freeze, or Mach-disk overlay. Custom generator (Dc/Dt/De) and custom gas mixture stay on Setup. Plume is a full (upper and lower) bilinear color map of the selected field (T/T0, n/n0, h_tot, U, M, E) with ~10–12 isolines of the selected field in the current millimetre window (log decades if that window is >10×; pinch packs more 1–2–5 of the same grid).
- **Model** — scientific note at `/model` (not a solver). URL/state stays `layer=manual` on that page. Model is an underlined page link, not a solve-mode chip, and is also linked from Plume (i).

Header chrome is `Plasma wind tunnel · {generator}` (for example `Plasma wind tunnel · IPG6-S`). After a solve the top strip shows hinj, n0 (frozen CEA exit number density), coupled power (ṁ × hinj, key `power` — not pressure), T_exit, U, mole fractions, then ṁ. It does not show chamber pinj.

A **station** is always available on Plume: tap sets (x, y) on the isotropic map. A pick near the axis snaps y to 0. Station x and y are also typed millimetres in the grid. That pick is a field sample. The grid shows x, y, T, n/n0, U, Mach, Kn, E (½ m U² in eV), E_O, e_th (1.5 kT), h_tot, p_ram, and q_inc from the bilinear sample at (x, |y|). p_ram = n m U² and q_inc = ½ n m U³ are incident free-stream fluxes. Empty numeric fields revert on blur instead of becoming 0. Share encodes `probe_x` and `probe_y` when a station is placed.

**Pinch zoom** on the Plume canvas and the Map (pinj–hinj) figure: two fingers zoom about the pinch midpoint and drag to pan; one finger stays the station pick (Plume) or the map cursor (Map). Double-tap or Reset returns to the fitted window. Axis ticks (1–2–5) and isoline / ṁ / power labels reflow on the current view and skip collisions; Plume isoline numbers are not capped at 5. This is a view window only — pinch does not re-run CEA. The composition plot (species vs hinj) stays un-zoomed. The Plume window stays isotropic (1 mm x = 1 mm y) and cannot zoom out past the fitted field or in past a few millimetres. Map zoom-out is the family pinj clamp × CEA hinj sweep (not the API catalog 250/5000/3000). Extra Map ṁ / power isolines are 1–2–5 traces of k(h)×pinj in the current Map window (pinch packs more). Chamber pinj is shown in Pa.

The Plume figure is full phone width and a fixed height (`min(48vh, 340px)`). The millimetre map is never stretched — a wide wrap letterboxes. The station grid sits in a compact 4-column scroll panel with a real row gap. The empty-state line (“Empty nozzle field — Run a point to fill the jet”) shows only when there is no solve — there is no post-solve slogan and no hinj footnote on Plume (those facts stay in Model). The panel is clipped to the Plume pane so it does not steal Setup / Map tab taps. A fade/chevron appears when more fields sit below. Dragging a point updates the numbers without growing over the jet.

**Copy link** on Setup encodes the current point:

```
https://ipg-operator.onrender.com/?layer=thesis&facility=IPG4|Custom&gas=CO2|custom&mix=&mode=generator|enthalpy&pinj=&mdot=&hinj=&plume=collisionless&probe_x=&probe_y=
```

The `facility` query key is the selected generator (IPG3 / IPG4 / IPG6-S / Custom). Named gases stay `gas=O2` (etc.). Custom gas is `gas=custom&mix=O2:0.3,He:0.7` (positive fractions only). Custom Dc/Dt/De millimetres are not in the URL; opening `facility=Custom` uses `FACILITY_META.Custom` (37 / 20 / 40 mm). Opening that URL applies the fields and does not auto-Run unless `run=1`. `mdot` is mg/s (same as the API). `probe_x` and `probe_y` are the station in metres. Advanced query keys (`layer=advanced`, `ptank`, `object`, `probe_r`) are ignored.

If the API is asleep, the chrome stays up and the content pane shows **waking chemistry server**.

## Units

- IPG6-S: ṁ in **mg/s**, pinj tens to hundreds of Pa, power in W
- IPG3 / IPG4: UI shows ṁ in **g/s**; the request still sends `mdot_mg_s`
- Custom generator: Dt ≥ 70 mm → IPG3-like ṁ/pinj family; ≥ 45 mm → IPG4-like; else IPG6-S. Diameters 1–499 mm. Empty numeric drafts revert on blur and do not become 0.

`hinj` is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement. IPG3 has no throat; recovered ṁ is approximate.

## PWA

`public/manifest.webmanifest` plus a small service worker (`public/sw.js`) enable Add to Home Screen. Theme color is `#07090d`.
