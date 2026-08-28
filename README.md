# IPG

Mobile-first operator console for IPG plasma wind tunnels. Setup a generator point, run a frozen-exit plume, and inspect the characteristics field (ṁ and coupled-power isolines).

Chemistry is **remote** (CEA over HTTP). This app does not reimplement CEA.

## Run locally

```bash
npm install
npm run dev
```

The dev server binds **http://127.0.0.1:43180**.

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
- `GET /api/catalog` — facilities and gases (geometry is also baked into the Setup card)
- `POST /api/solve` — generator (pinj + ṁ → hinj) or enthalpy (pinj + hinj) plus plume grid
- `POST /api/characteristics` — ṁ / power isolines, kinks, chamber composition (`n_h = 13`)

If the API is asleep, the chrome stays up and the content pane shows **waking chemistry server**.

## Units

- IPG6-S: ṁ in **mg/s**, pinj tens to hundreds of Pa, power in W
- IPG3 / IPG4: UI shows ṁ in **g/s**; the request still sends `mdot_mg_s`
- Custom diameters: Dt ≥ 70 mm uses IPG3-like axes, Dt ≥ 45 mm uses IPG4-like, else IPG6-S

`hinj` is local/CEA specific enthalpy, not a cavity-calorimeter bulk measurement. IPG3 has no throat; recovered ṁ is approximate.

## PWA

`public/manifest.webmanifest` plus a small service worker (`public/sw.js`) enable Add to Home Screen. Theme color is `#07090d`.
