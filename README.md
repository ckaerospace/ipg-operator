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

- **Thesis** (default) — always `plume_mode: collisionless`. No tank pressure, NPR, or shock overlay. Plume is a bilinear color map of the selected field (T/T0, n/n0, h_tot, U, M, E) with a few isolines of that same grid.
- **Advanced** — Physics (Auto / Collisionless / Sudden-freeze), `p_tank_Pa`, NPR / regime, barrel + Mach disk stroked on top of that field when the API sets `shock_applied`. Object None (default) or Disk.
- **Manual** — scientific note at `/model` (not a solver). Linked from the layer control and Plume (i).

Header chrome is `Plasma wind tunnel · {generator}` (for example `Plasma wind tunnel · IPG6-S`).

A **probe disk** sits on the centerline in Thesis (tap the jet; R is fixed at 20 mm, no x/R chrome). In Advanced, Object None hides the body and omits `probe_*` on the request; Object Disk restores the placeable plate with x, disk R (5–50 mm, default 20), and Tw. Thesis posts a collisionless plate; Advanced draws a bow if the API returns `bow_xy`. Request fields: `probe_x_m`, `probe_r_mm`, `probe_Tw_K`. Response `plume.probe` fills p, q, Kn_obj, kinetic|continuum. If the live API rejects those fields (422), the disk is still drawn and incident n, T, U come from the grid sample.

**Copy link** on Setup encodes the current point:

```
https://ipg-operator.onrender.com/?layer=thesis|advanced&facility=IPG4&gas=CO2|custom&mix=He:0.7,O2:0.3&mode=generator|enthalpy&pinj=&mdot=&hinj=&ptank=&plume=auto|collisionless|sudden_freeze&object=none|disk&probe_x=&probe_r=
```

The `facility` query key is the selected generator (IPG3 / IPG4 / IPG6-S). Named gases stay `gas=O2` (etc.). Custom gas is `gas=custom&mix=He:0.7,O2:0.3` (mole fractions of O2, N2, CO2, He, Ar). Opening that URL applies the fields and does not auto-Run unless `run=1`. An Advanced share without `object=disk` does not place a disk. `mdot` is mg/s (same as the API). `probe_x` is meters. `probe_r` (mm) is encoded only for Advanced Object Disk.

If the API is asleep, the chrome stays up and the content pane shows **waking chemistry server**.

## Units

- IPG6-S: ṁ in **mg/s**, pinj tens to hundreds of Pa, power in W
- IPG3 / IPG4: UI shows ṁ in **g/s**; the request still sends `mdot_mg_s`
- Custom diameters: Dt ≥ 70 mm uses IPG3-like axes, Dt ≥ 45 mm uses IPG4-like, else IPG6-S

`hinj` is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement. IPG3 has no throat; recovered ṁ is approximate.

## PWA

`public/manifest.webmanifest` plus a small service worker (`public/sw.js`) enable Add to Home Screen. Theme color is `#07090d`.
