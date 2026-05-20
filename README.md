# iris-light-scene

A real-time 3D render of crystal-glass iris flowers, built with Three.js. The goal is to recreate a Blender reference image in the browser — translucent blue petals that look like ice sculptures, dramatic studio lighting, atmospheric dust, shallow depth of field.

![preview](https://github.com/sibsfinx/iris-light-scene/raw/main/preview.png)

## What it looks like

Dark near-black background. Four iris flowers at different depths — one hero in focus, three receding into bokeh blur. Petals are almost invisible glass with bright specular highlights tracing the veins. Warm amber backlight bleeds through from behind, cool blue key and rim lights hit the edges. Dust motes drift upward. Occasional god-ray planes catch the light.

## Run it locally

```bash
COREPACK_ENABLE_STRICT=0 pnpm dev
```

The `COREPACK_ENABLE_STRICT=0` prefix is needed if your root `package.json` pins a different package manager. Dev server reads the `PORT` env var, defaults to `5173`.

```bash
# type check
COREPACK_ENABLE_STRICT=0 npx tsc --noEmit

# production build
COREPACK_ENABLE_STRICT=0 pnpm build
```

## Stack

- **Three.js r170** — MeshPhysicalMaterial with transmission, iridescence, clearcoat
- **TypeScript + Vite** — strict mode, bundler module resolution
- **pnpm** — package manager
- Post-processing: BokehPass → UnrealBloomPass → FilmicShader → OutputPass

## Project layout

```
src/main.ts     scene setup, animation loop, HD download (3840×2160 PNG)
src/iris.ts     petal geometry, vein roughness map, all materials, flower builder
src/env.ts      rock base, ground, fog planes, dust particles, env map
src/lights.ts   5 RectAreaLights (cool key/rim/top + warm amber back + cool fill)
src/fx.ts       EffectComposer with bokeh, bloom, filmic grain, vignette
```

## Deploy

Deploys to Netlify automatically. GitHub Pages workflow also included in `.github/workflows/deploy.yml`. No external textures — everything is procedural.

## Agent context

See `.agent/` for session handoff docs, technical notes, and the full Blender reference breakdown. Start with `.agent/README.md`.
