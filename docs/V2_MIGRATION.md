# v2 migration (completed)

v2 is the only app on `master`. It is a static three.js viewer of 13 measured structures, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `master`.

## What changed
| | old (React, ≤ v1) | v2 |
|---|---|---|
| server | `scripts/dev-server.mjs` proxy + `scripts/ct-viewer-server.py` (Crystal Toolkit / Dash) | none (static files) |
| search | live Materials Project search (`src/mp-api-client.js`) | dropped: fixed set of 13 curated structures |
| credentials | Materials Project API key in a local env file | none |
| geometry source | MP structures, fetched at runtime | measured COD CIFs, refined at build time |

## Removed in the v2.0 cut-over
- `src/`, `test/`, `scripts/`, root `index.html`, `vite.config.ts`, `tsconfig*.json`, `.env.example`, `public/data/`, `docs/assets/`
- `requirements.txt` (crystal-toolkit, dash, pymatgen pins for the Python server). The data build uses `build/requirements-build.txt`.
- npm: react, react-dom, @react-three/fiber, @react-three/drei, lucide-react, @vitejs/plugin-react, @types/react, @types/react-dom, typescript
- the `legacy:*` and `v2:*` npm scripts. `vite.v2.config.mjs` became `vite.config.mjs`, and the output directory is now `dist/`.

The old code is still available in git history (commit `9c6067b` and earlier).

Kept: `tools/cod_candidates.*` (CIF provenance), `LICENSE`, and the computed-gap links to materialsproject.org. These are plain citations and need no API.

## Open items
- The secondary (Wikipedia) gaps for Si, CsCl, ZnS, GaN and SrTiO₃ should be upgraded to primary papers.
- The perf baseline is relative to SwiftShader. Re-record it on CI hardware if the gate moves to CI.
