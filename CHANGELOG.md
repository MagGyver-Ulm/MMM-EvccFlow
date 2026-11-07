# Changelog

## 1.0.0 — 2026-11-07

- First independently installable release, MIT licensed, with a fresh repository history.
- Required `evccUrl` replaces the former installation-specific default.
- English and German translations; `decimal: "auto"` follows the MagicMirror² language.
- New `decimal: "comma"` and `"period"`; legacy numeric values 0–3 retain German formatting and their precision.
- Configurable request timeout, battery visibility, loadpoint limit, vehicle SoC, charge mode, source colors, battery thresholds and labels.
- Existing URL, polling, threshold, loadpoint, animation and color options remain supported.
- Dedicated `colors.battery` for discharging and battery-supplied charging; default remains green.
- Neutral screenshot/demo, complete installation guide, ESLint and Node 20/22 CI.
- No installation-specific deployment script or runtime dependencies.

### Earlier development

The private 0.1–0.2 series established server-side polling, evcc 0.318.x normalization,
multiple vehicles, stale-data handling, source-based colors and static arrowheads.
