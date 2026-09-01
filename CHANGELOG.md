# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
