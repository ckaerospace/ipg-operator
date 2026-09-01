# Plasma wind tunnel

Mobile-first operator console for the IRS inductive plasma wind tunnel (PWK3). Select a generator (IPG3, IPG4, or IPG6-S), run a frozen-exit plume, and inspect the characteristics field (ṁ and coupled-power isolines). This app does not model PWK1, PWK2, or PWK4.

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
- `POST /api/solve` — generator (pinj + ṁ → hinj) or enthalpy (pinj + hinj) plus plume grid. Optional `p_tank_Pa` (default 10) is the tank / background pressure
- `POST /api/characteristics` — ṁ / power isolines, kinks, chamber composition (`n_h = 29`, `hinj_min`/`hinj_max` 1–70; falls back to `n_h = 13` without those keys if the wider sweep fails)

Three layers (persisted in `localStorage` as `ipg-layer`):

- **Thesis** (default) — always `plume_mode: collisionless`. No tank pressure, NPR, or shock overlay. Plume is a full (upper and lower) bilinear color map of the selected field (T/T0, n/n0, h_tot, U, M, E) with ~10–12 isolines of the selected field in the current millimetre window (log decades if that window is >10×; pinch packs more 1–2–5 of the same grid).
- **Advanced** — Physics (Auto / Collisionless / Sudden-freeze), `p_tank_Pa`, NPR / regime, barrel + Mach disk stroked on top of that field when the API sets `shock_applied`. The overlay is a pale dashed barrel outline and a bright gold Mach-disk chord (caption “shock overlay”); the bilinear color map is not shock-tinted. Thesis never draws it. Object None (default) or Probe (centerline calorimeter plate). Station, probe, and Mach disk are three different marks. On the Plume tab a compact log slider (tank pressure / p_∞, 0.1–5000 Pa) sits under the figure; dragging updates `p_tank` and debounces a solve (~350 ms) so barrel and Mach disk can move. Setup keeps the number field in sync and does not auto-Run. Collisionless Physics ignores `p_tank` in the kernel; the slider may still refresh NPR if the API returns it, but this app never invents a Mach disk.
- **Model** — scientific note at `/model` (not a solver). URL/state stays `layer=manual`. Thesis and Advanced sit under the Setup section label Operation mode; Model is a separate underlined page link, not a third chip, and is also linked from Plume (i).

Header chrome is `Plasma wind tunnel · {generator}` (for example `Plasma wind tunnel · IPG6-S`). After a solve the top strip shows hinj, n0 (frozen CEA exit number density), coupled power (ṁ × hinj, key `power` — not pressure), T_exit, U, mole fractions, then ṁ. It does not show chamber pinj.

A **station** is always available on Plume: tap sets (x, y) on the isotropic map (Thesis and Advanced, Object None or Probe). A pick near the axis snaps y to 0. Station x and y are also typed millimetres in the grid. That pick is a field sample, not a probe and not a Mach disk. The grid shows x, y, T, n/n0, U, Mach, Kn, E (½ m U² in eV), E_O, e_th (1.5 kT), h_tot, p_ram, and q_inc from the bilinear sample at (x, |y|). p_ram = n m U² and q_inc = ½ n m U³ are incident free-stream fluxes, not plate-face p_probe / q_probe. Thesis has no probe chrome. Advanced Object Probe adds a centerline calorimeter plate; Setup next to None|Probe edits probe R (5–50 mm, default 20) and Tw (200–2000 K, default 300). The plate uses the station x on the centerline (no y on the plate). Empty numeric fields revert on blur instead of becoming 0. p_probe (plate face pressure) and q_probe (plate heat flux) fill after Run at that x, R, with Kn_obj and regime — they stay on the grid with p_ram / q_inc and are not replaced. They are not tank p_∞ and not field-sample cells. Object None has p_ram / q_inc and no plate row. Request fields: `probe_x_m`, `probe_r_mm`, `probe_Tw_K` (plate only). Share encodes `probe_x` and `probe_y` when a station is placed; `probe_r` only for Advanced Object Probe (`object=disk` in the URL).

**Pinch zoom** on the Plume canvas and the Map (pinj–hinj) figure: two fingers zoom about the pinch midpoint and drag to pan; one finger stays the station pick (Plume) or the map cursor (Map). Double-tap or Reset returns to the fitted window. Axis ticks (1–2–5) and isoline / ṁ / power labels reflow on the current view and skip collisions; Plume isoline numbers are not capped at 5. This is a view window only — pinch does not re-run CEA. The composition plot (species vs hinj) stays un-zoomed. The Plume window stays isotropic (1 mm x = 1 mm y) and cannot zoom out past the fitted field or in past a few millimetres. Map zoom-out is the family pinj clamp × CEA hinj sweep (not the API catalog 250/5000/3000). Extra Map ṁ / power isolines are 1–2–5 traces of k(h)×pinj in the current Map window (pinch packs more). Chamber pinj is shown in Pa.

The Plume figure is full phone width and a fixed height (`min(48vh, 340px)`). The millimetre map is never stretched — a wide wrap letterboxes. The station grid sits in a compact 4-column scroll panel with a real row gap. The empty-state line (“Empty nozzle field — Run a point to fill the jet”) shows only when there is no solve — there is no post-solve slogan and no hinj footnote on Plume (those facts stay in Model). The panel is clipped to the Plume pane so it does not steal Setup / Map tab taps. A fade/chevron appears when more fields sit below. Dragging a point updates the numbers without growing over the jet.

**Copy link** on Setup encodes the current point:

```
https://ipg-operator.onrender.com/?layer=thesis|advanced&facility=IPG4&gas=CO2|custom&mix=He:0.7,O2:0.3&mode=generator|enthalpy&pinj=&mdot=&hinj=&ptank=&plume=auto|collisionless|sudden_freeze&object=none|disk&probe_x=&probe_y=&probe_r=
```

The `facility` query key is the selected generator (IPG3 / IPG4 / IPG6-S). Named gases stay `gas=O2` (etc.). Custom gas is `gas=custom&mix=He:0.7,O2:0.3` (mole fractions of O2, N2, CO2, He, Ar). Opening that URL applies the fields and does not auto-Run unless `run=1`. An Advanced share without `object=disk` does not draw a probe. `mdot` is mg/s (same as the API). `probe_x` and `probe_y` are the station in metres. `probe_r` (mm) is encoded only for Advanced Object Probe.

If the API is asleep, the chrome stays up and the content pane shows **waking chemistry server**.

## Units

- IPG6-S: ṁ in **mg/s**, pinj tens to hundreds of Pa, power in W
- IPG3 / IPG4: UI shows ṁ in **g/s**; the request still sends `mdot_mg_s`
- Custom diameters: Dt ≥ 70 mm uses IPG3-like axes, Dt ≥ 45 mm uses IPG4-like, else IPG6-S

`hinj` is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement. IPG3 has no throat; recovered ṁ is approximate.

## Version

The live package is **1.0.0**. `CHANGELOG.md` is Keep a Changelog (newest first). The Model page shows a muted `v1.0.0` next to the title and a compact What’s new list under the model text.

Set `VITE_CHANNEL=beta` at build time to add a tiny BETA mark next to the version. Production live does not set `VITE_CHANNEL`, so there is no BETA mark there.


## PWA

`public/manifest.webmanifest` plus a small service worker (`public/sw.js`, cache `ipg-shell-v2`) enable Add to Home Screen. Theme color is `#07090d`.
