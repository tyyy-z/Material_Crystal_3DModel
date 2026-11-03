# v2 becomes the main app: migration plan

Status: v2 is the default on local branch `v2`. `npm run dev/build/test` now point at it. The old app has **not** been deleted yet, because step 3 below waits for the owner's OK.

## 1. Done on `v2`
- `package.json`:
  - `dev`, `build`, `preview`, `test`, `perf` and `data` now run the static v2 viewer.
  - The old scripts are kept as `legacy:*`.
- `.github/workflows/pages.yml`:
  - On PRs it runs the tests and builds `dist-v2/`.
  - It deploys to GitHub Pages **only on manual `workflow_dispatch`**.
  - CI uses no secrets and needs no Python toolchain beyond pytest. The structure JSON is committed.
- New README and banner in the mechanism-explainer style.

## 2. Runtime differences from the old app
| | old (React) | v2 |
|---|---|---|
| server | `scripts/dev-server.mjs` proxy + `scripts/ct-viewer-server.py` (Crystal Toolkit / Dash) | none (static files) |
| search | live Materials Project search (`src/mp-api-client.js`) | dropped: fixed set of 13 curated structures |
| credentials | `MP_API_KEY` via `.env` / `MP_API.env` | none |
| geometry source | MP structures, fetched at runtime | measured COD CIFs, refined at build time |

## 3. Removal (one commit, after OK)
```bash
git rm -r src/ test/ scripts/ index.html vite.config.ts tsconfig*.json .env.example \
          public/data/ docs/assets/
npm uninstall react react-dom @react-three/fiber @react-three/drei lucide-react \
              @vitejs/plugin-react @types/react @types/react-dom typescript
# requirements.txt -> pymatgen + pytest only (crystal-toolkit, dash were for the Python server)
```
Then:
- move `v2/` to the repo root, or keep `root: "v2"` in the vite config;
- rename `vite.v2.config.mjs` to `vite.config.mjs` and `dist-v2` to `dist`;
- drop the `legacy:*` scripts;
- remove the MP-specific lines from `.gitignore`.

Keep these:
- `tools/cod_candidates.*` (CIF provenance);
- `LICENSE`;
- the computed-gap links to materialsproject.org. These are plain citations and need no API.

## 4. Turn Pages on (needs the owner)
1. Repo Settings → Pages → Source: *GitHub Actions*.
2. Push `v2` (or merge it into `main`), then run the **pages** workflow manually.
3. Optional: add `push: branches: [main]` to the workflow triggers.

## 5. Open items
- Secondary (Wikipedia) gaps for Si, CsCl, ZnS, GaN and SrTiO₃ should be upgraded to primary papers.
- The perf baseline is SwiftShader-relative. Re-baseline on CI hardware if the gate moves to CI.
