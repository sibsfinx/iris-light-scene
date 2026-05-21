# agents.md — iris-light-scene

Top-level instructions for any AI agent working on this project.

## What this project is

A Three.js real-time 3D scene of crystal-glass iris flowers. The reference is a Blender cinematic render — dark studio, translucent ice-blue petals, warm/cool mixed lighting, atmospheric dust and god rays. The goal is to match that look in a browser renderer without any external assets.

## Before you start

Read these in order:

1. `.agent/README.md` — current visual state and what's still missing
2. `.agent/TODO.md` — prioritised work list
3. `.agent/TECH.md` — Three.js version quirks, import paths, material recipes
4. `.agent/config.md` — code style rules and constraints
5. `.agent/REFERENCE.md` — full Blender scene spec (lights, materials, camera)

## How to run

```bash
COREPACK_ENABLE_STRICT=0 pnpm dev
```

Preview on port 7341. The `COREPACK_ENABLE_STRICT=0` prefix is always required.

## Source files

```
src/main.ts     entry point — renderer, scene, animation, HD download
src/iris.ts     petal geometry + materials — most visual work happens here
src/env.ts      environment — rock, ground, fog, dust, envMap
src/lights.ts   5 RectAreaLights
src/fx.ts       post-processing pipeline
```

## How to work

- Check `.agent/TODO.md` for the highest-priority items
- After each visual change, screenshot with the preview panel and compare to `.agent/REFERENCE.md`
- Keep changes focused — one thing at a time, verify before moving on
- Update `.agent/TODO.md` when you complete an item or discover a new issue
- Update `.agent/README.md` "Current visual state" section when the render meaningfully improves

## Key constraints

- No external assets — procedural only
- TypeScript strict mode
- Three.js r170 — physical lighting always on
- Don't change the post-processing pass order without understanding the full pipeline

## When you're done with a session

Update `.agent/README.md` to reflect the current state of the render so the next agent picks up with accurate context. Be specific about what changed visually.
