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
- `POST /api/characteristics` — ṁ / power isolines, kinks, chamber composition (`n_h = 13`)

Three layers (persisted in `localStorage` as `ipg-layer`):

- **Thesis** (default) — always `plume_mode: collisionless`. No tank pressure, NPR, or shock overlay. Plume is a full (upper and lower) bilinear color map of the selected field (T/T0, n/n0, h_tot, U, M, E) with ~8 isolines even in that field (log decades if the span is >10×).
- **Advanced** — Physics (Auto / Collisionless / Sudden-freeze), `p_tank_Pa`, NPR / regime, barrel + Mach disk stroked on top of that field when the API sets `shock_applied`. The overlay is a pale dashed barrel outline and a bright gold Mach-disk chord (caption “shock overlay”); the bilinear color map is not shock-tinted. Thesis never draws it. Object None (default) or Probe (centerline calorimeter plate). Station, probe, and Mach disk are three different marks. On the Plume tab a compact log slider (tank pressure / p_∞, 0.1–5000 Pa) sits under the figure; dragging updates `p_tank` and debounces a solve (~350 ms) so barrel and Mach disk can move. Setup keeps the number field in sync and does not auto-Run. Collisionless Physics ignores `p_tank` in the kernel; the slider may still refresh NPR if the API returns it, but this app never invents a Mach disk.
- **Manual** — scientific note at `/model` (not a solver). Linked from the layer control and Plume (i).

Header chrome is `Plasma wind tunnel · {generator}` (for example `Plasma wind tunnel · IPG6-S`).

A **station** is always available on Plume: tap sets (x, y) on the isotropic map (Thesis and Advanced, Object None or Probe). That pick is a field sample, not a probe and not a Mach disk. The grid shows x, y, T, n/n0, U, Mach, Kn, E (½ m U² in eV), E_O, e_th (1.5 kT), and h_tot from the bilinear sample at (x, |y|). Thesis has no probe chrome. Advanced Object Probe adds a centerline calorimeter plate (x, probe R 5–50 mm, Tw); face p, q, Kn_obj, and regime fill after Run at that x, R. Object None has no plate and no p/q row. Request fields: `probe_x_m`, `probe_r_mm`, `probe_Tw_K` (plate only). Share encodes `probe_x` and `probe_y` when a station is placed; `probe_r` only for Advanced Object Probe (`object=disk` in the URL).

**Pinch zoom** on the Plume canvas and the Map (pinj–hinj) figure: two fingers zoom about the pinch midpoint and drag to pan; one finger stays the station pick (Plume) or the map cursor (Map). Double-tap or Reset returns to the fitted window. Axis ticks (1–2–5) and isoline / ṁ / power labels re-layout for the current view. This is a view window only — pinch does not re-run CEA. The composition plot (species vs hinj) stays un-zoomed. The Plume window stays isotropic (1 mm x = 1 mm y) and cannot zoom out past the fitted field or in past a few millimetres.

The Plume figure is full phone width and a fixed height (`min(48vh, 340px)`). The millimetre map is never stretched — a wide wrap letterboxes. The station grid sits in a compact 4-column scroll panel (max-height ~28vh) with a visible thin scrollbar and a fade/chevron when more fields sit below. Dragging a point updates the numbers without growing over the jet.

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

## PWA

`public/manifest.webmanifest` plus a small service worker (`public/sw.js`) enable Add to Home Screen. Theme color is `#07090d`.
