# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Beta Plume **Live**: a compact chip (only when `VITE_CHANNEL=beta`) opens pinj plus exclusive hinj|ṁ sliders that debounce a re-solve (~350 ms, pointer-up flushes, in-flight requests cancel). Power is a derived readout (ṁ·hinj), never a free slider. He/O₂ mole mix (API `basis: "mole"`, 70/30 language) is available for the HeO2 chip or a He+O₂-only custom mix. First enable shows a one-shot confirm (localStorage `ipg-live-confirm`). Station (x, y) stays world-fixed across re-solves. Setup/Map read the same state.
- Station grid and Plume field chip for **n_O** (SI m⁻³) from frozen-exit composition n_O = (n/n0)·n0·x_O. Missing CEA O → "—" / chip hidden; 0 is shown as 0.
- Advanced Plume: Collisionless | Freeze chips in the figure (bottom-left, above the x-axis) re-solve the same exclusive pair as Setup Physics. Auto stays on Setup. A gold Disk chip is live only after Freeze ran with `shock_applied`; off hides the barrel and Mach-disk overlay without changing the colormap. Thesis has no plot chips.
- Desktop Plume plot is taller (`min(64vh, 520px)`); phone height is unchanged.
- Map: typed ṁ and pinj (same DraftNumber rules as Plume x/y) are the Setup values, not a second copy. Changing pinj moves the operating-point marker; hinj stays the Setup value. Changing ṁ rebuilds the characteristics map. ṁ is not a Map axis.

### Changed

- Plume field is 97×97 (odd, so y=0 is a grid node). Colormap and marching-square isolines use that same posted grid; isolines are not splined. Map CEA `n_h` is unchanged.

### Fixed

- Map operating-point crosshair is the exact Setup pinj and hinj in linear plot space. It does not snap to a CEA sample node or sit on a leftover tap cursor. ṁ/power/mole readout still interpolates from the hinj column.
- Plume isoline numbers reflow for every plotted field in the current millimetre window (farthest-fit, skip overlaps). U, Mach, and E no longer drop labels on pinch; n/n0 already did. Not a 5-label cap. ([#1](https://github.com/ckaerospace/ipg-operator/issues/1))

## [1.0.0] - 2026-08-30

Operator PWA as shipped. Service-worker follow-up dated 2026-08-31.

### Added

- After Run, the header strip shows frozen-exit number density `n0` and coupled generator power (ṁ × hinj).
- Station grid reports incident ram pressure `p_ram` and incident heat flux `q_inc` whenever a station is placed.
- Soft snap of station *y* to the axis, and typed station *x* / *y* in millimetres.
- Numeric fields can be cleared without writing 0; the previous value commits on blur or Enter.

### Changed

- Chamber injection pressure is Pa-only in the editor and on Map axes (no Pa|kPa unit chips).
- `p_probe`, `q_probe`, `Kn_obj`, and regime stay on the grid only with Advanced Object Probe — extra cells, not a stand-in for `p_ram` / `q_inc`.
- Isoline labels reflow with the current millimetre window (farthest-fit; both halves when they do not collide).

### Fixed

- Service worker cache name `ipg-shell-v2` (2026-08-31): a desktop return visit no longer serves `index.html` as JavaScript.
