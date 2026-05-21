# Agent Config — iris-light-scene

Shared settings and preferences for any agent working on this project.

## Dev command

```bash
COREPACK_ENABLE_STRICT=0 pnpm dev
```

Always use this prefix. The corepack conflict comes from a parent-directory `package.json` — not fixable at the project level. Port is set in `.claude/launch.json` (7341) and read via `process.env['PORT']` in `vite.config.ts`.

## Code style

- TypeScript strict mode — no `any`, no `as unknown as X` unless truly unavoidable
- No external assets — all textures and geometry are procedural (canvas, DataTexture, BufferGeometry)
- Functional helpers over classes — scene objects are built by `create*()` / `build*()` functions that return the mesh/group
- Keep material configuration readable — one property per line in `MeshPhysicalMaterial` constructor objects
- No comments explaining what the code does — only comment non-obvious invariants (e.g. Three.js r170 API changes)

## Three.js constraints

- Version pinned at `^0.170.0` — physical lighting is always on, no `physicallyCorrectLights` flag
- Use `renderer.outputColorSpace = THREE.SRGBColorSpace` not the old `outputEncoding`
- `RectAreaLight` requires `RectAreaLightUniformsLib.init()` — already called in `src/lights.ts`, don't duplicate
- Post-processing pass order is strict: BokehPass → UnrealBloomPass → ShaderPass(FilmicShader) → OutputPass
- `preserveDrawingBuffer: true` on the main renderer is intentional — needed for the HD PNG export

## What not to touch

- Don't change the tone mapping from `ACESFilmicToneMapping` without explicit instruction — it matches the Blender reference
- Don't add external texture dependencies (PNGs, HDRs) — the project is intentionally self-contained
- Don't swap pnpm for npm/yarn — lockfile is pnpm-lock.yaml

## Verification

After any visual change, use the Claude Code preview panel (port 7341) to screenshot the result. Compare against the `.agent/REFERENCE.md` description — the target is: near-invisible glass petals, bright vein speculars, warm/cool lighting contrast, deep atmospheric blur on background flowers.
