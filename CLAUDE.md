# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — Rollup bundle to `dist/widget-heatmap.js` (ESM, sourcemaps).
- `npm run watch` — Rollup in watch mode.
- `npm start` — Runs `watch` + `@web/dev-server` (`wds`) concurrently; serves `demo/index.html` (config opens `/demo/`).
- `npm run types` — Regenerates `src/definition-schema.d.ts` from `src/definition-schema.json` via `json-schema-to-typescript` (`json2ts`). Run this whenever `definition-schema.json` changes.
- `npm run analyze` — Custom Elements Manifest analyzer (lit preset).
- `npm run release` — `build` -> `types` -> `npm version patch` (tag prefix `''`) -> push tags. Pushing a tag triggers `.github/workflows/build-publish.yml`, which publishes to npm and creates a GitHub Release.
- `npm run link` / `npm run unlink` — Build + `npm link` against `../RESWARM/frontend` for local integration testing inside the IronFlock platform monorepo.

No test runner is configured.

Node `>=24.9.0`, npm `>=10.0.2` (CI uses Node 24).

## Architecture

Single-file LitElement web component published as `@record-evolution/widget-heatmap`. Part of the wider `ironflock-widgets` collection — sibling repos (widget-linechart, widget-gauge, etc.) share the same shape.

### Versioned custom element tag

The element is registered as `widget-heatmap-versionplaceholder` in source. Rollup's `@rollup/plugin-replace` substitutes `versionplaceholder` with `npmPackage.version` from `package.json` at build time (see `rollup.config.js`). The demo and host platform construct the tag dynamically, e.g. `widget-heatmap-${packageJson.version}`. This lets multiple versions of the same widget coexist on one page in the IronFlock dashboard.

### Entry point and integration contract

- Source entry: `src/widget-heatmap.ts` — the single `WidgetHeatmap` LitElement.
- Two reactive `@property` inputs are the entire host contract:
  - `inputData: InputData` — typed by `src/definition-schema.d.ts`, generated from `src/definition-schema.json`.
  - `theme: { theme_name: string; theme_object: any }` — registered with ECharts via `echarts.registerTheme`. Theme colors are also overridable through CSS custom properties `--re-text-color` and `--re-tile-background-color` read in `registerTheme()`, which take precedence over `theme_object`.
- `src/definition-schema.json` is the source of truth for the widget's configurable schema; the IronFlock platform uses it to render the widget configuration UI. AI-readable `title`/`description` fields drive both UX and downstream agent tooling — keep them meaningful, then run `npm run types`.
- `src/default-data.json` documents the expected `inputData` shape (used by the demo).

### Data flow

`update()` reacts to `inputData` and `theme` changes:

1. `transformData()` — pivots `inputData.dataseries[].data` by an optional `pivot` field. Each distinct pivot value yields its own ECharts instance keyed in `canvasList: Map<label, { echart, series, element, doomed }>`. Old charts are marked `doomed` at the start of each run and disposed if not refreshed.
2. `setupChart(label)` — lazily creates a `<div class="sizer">` inside `.chart-container` and an `echarts.init` instance per pivot.
3. `applyData()` — merges the pivoted series into a cloned `template` `EChartsOption`, applying axis types (`xAxisType()`/`yAxisType()` auto-detect numeric vs. category vs. timeseries), visualMap colors (with theme/default fallbacks), and calls `setOption` with `notMerge` when the series count changes.

A `ResizeObserver` on `.chart-container` resizes every chart on host resize.

### ECharts tree-shaking

Only the components actually used are registered via `echarts.use([...])` at the top of `widget-heatmap.ts` (`HeatmapChart`, `Tooltip/Grid/VisualMap/Title` components, `CanvasRenderer`). Add to that list when introducing new ECharts features — otherwise they will be missing at runtime.

### Build pipeline

Rollup (`rollup.config.js`) with: `replace` (NODE_ENV + version), `typescript`, `node-resolve`, `commonjs`, `babel` (bundled helpers). Single ESM output to `dist/`. `treeshake.moduleSideEffects: false` is required for ECharts tree-shaking to work.
