# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — Rollup bundle to `dist/widget-heatmap.js` (ESM, sourcemaps).
- `npm run watch` — Rollup in watch mode.
- `npm start` — Runs `watch` + `@web/dev-server` (`wds`) concurrently; serves `demo/index.html` (config opens `/demo/`).
- `npm run types` — Regenerates `src/definition-schema.d.ts` from `src/definition-schema.json` via `json-schema-to-typescript` (`json2ts`). Run this whenever `definition-schema.json` changes.
- `npm run analyze` — Custom Elements Manifest analyzer (lit preset).
- `npm run release` — `npm version patch`: preflight guards (on `main`, clean tree, not behind `origin/main`, generated files current, build passes), then commit, bare-semver tag, `git push --follow-tags`, then waits on the CI run and fails if the npm publish fails. `npm run release:minor` / `release:major` for other bumps.
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
  - `inputData: HeatmapConfiguration` — typed by `src/definition-schema.d.ts`, generated from `src/definition-schema.json`.
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

## `aiSelection` in `src/definition-schema.json`

The schema root carries an `aiSelection` block next to `title` and `description`. It is **not** JSON Schema and describes no config field — it exists so the IronFlock AI's Widget Builder can pick the right widget for a given shape of data, using knowledge only the widget author has:

```jsonc
"aiSelection": {
  "dataShape": "…what columns this widget consumes and what each one means…",
  "useWhen":   ["…a situation, naming the properties that express it…"],
  "notFor":    ["…a situation this widget is wrong for, naming the widget to use instead…"]
}
```

It is inert everywhere else, and must stay that way: `json2ts` ignores it (the generated `.d.ts` is byte-identical with and without it), the dashboard config editor renders only `schema.properties`, and the AI service's `validate_widget` validates *configs* against the schema, skipping unknown Draft-7 keywords.

When maintaining it:

- `notFor` is the high-value half and the part plain descriptions always omit. Every entry must name the widget that *should* be used, or it rejects without routing.
- Write for an LLM with no other documentation: describe the visible result and the user's intent, not the implementation.
- Prefer entries that discriminate against a *neighbouring* widget. Generic rejections are cheap; the ones that pay are those an author could plausibly get wrong.
- The `notFor` lists are a set across all `widget-*` repos and are meant to be reciprocal — if this widget routes to another for some case, that widget should usually route back for the converse. Changing one side is a cue to check the other.
- Update it whenever a property changes what this widget can *do*, not just how it looks.
