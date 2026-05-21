# Iris 3D Scene — Agent Handoff

## What this is
A Three.js (TypeScript + Vite + pnpm) real-time 3D render of crystal-glass iris flowers,
inspired by reference photography of ice/glass iris sculptures in a dark studio.
Goal: match the translucent crystalline look — near-invisible petals with bright
specular vein lines, warm gold + cool blue mixed lighting, atmospheric dust.

## How to run
```bash
COREPACK_ENABLE_STRICT=0 pnpm dev   # reads PORT env var or :5173
```
`.claude/launch.json` configured for Claude Code preview panel.

## Current visual state ✅ (as of last session)
- ✅ 4 iris flowers at different depths (hero + 3 background/partial)
- ✅ Near-full transmission glass material (94%) with pale ice-blue body
- ✅ Vein roughness map — canvas-generated radial lines → bright specular highlights
- ✅ Iridescence (0.55) for prismatic rainbow edge shimmer
- ✅ 5 RectAreaLights: cool blue key/rim/top + **warm amber back** + cool blue back fill
  → creates warm/cool transmission contrast matching reference images
- ✅ Chromatic aberration shader (slight RGB edge split)
- ✅ Film grain + vignette
- ✅ BokehPass DOF (focus 5.2m, shallow, blurs background flowers)
- ✅ UnrealBloomPass (tight, high-threshold — only bright vein specular glows)
- ✅ Dust particles: 600 cool motes + 80 warm gold specks, animated upward drift
- ✅ Atmospheric fog planes (mixed warm + cool additive blend)
- ✅ Green stem with transmission, leaf bracts
- ✅ Rock base + dark ground
- ✅ OrbitControls (damped) + slow auto-rotation
- ✅ HD download (3840×2160 PNG, separate off-screen renderer)
- ✅ GitHub Pages deploy workflow (`.github/workflows/deploy.yml`)
- ✅ **Sound reactivity** (branch `feat/sound-reactive`):
  - `AudioReactor` class (`src/audio.ts`) — 2048-pt FFT, 6 smoothed bands, bass direction vector
  - Flowers tilt in XZ toward bass-frequency direction; hero full, background scaled down
  - Fall petals: asymmetric droop — windward droops more, leeward lifts; mid-freq controls bloom-open
  - Standard petals lean opposite to the push
  - Lights animated per band: god rays on sub/bass, rim on amplitude, back fill warms amber on bass, side spot on high-freq transients
  - Bloom threshold/strength breathes with amplitude; chromatic aberration peaks on highs
  - `setupLights()` now returns `SceneLights` with live refs + base intensities for animation

## Still to improve
- ⚠️  Petal surfaces still slightly faceted — needs either higher segments or normal map
- ⚠️  No actual vein surface bumps yet — roughness map creates specular variation but
       not geometric relief; a normal map would add the 3D ridge feel from ref image 4
- ⚠️  Style arms (center) create an overly obvious torch-beam — could be repositioned
       or made smaller/more petal-like
- ⚠️  Background flowers could have slightly more atmospheric blur (increase bokeh)

## File map
```
src/main.ts     — renderer, 4 flowers, dust, animation loop, sound-reactive animate, HD download
src/audio.ts    — AudioReactor: FFT, band smoothing, bassDirection() XZ vector
src/iris.ts     — buildPetalGeo(), generateVeinMap(), all materials, createIrisFlower()
                  petals tagged with userData.type / baseRotX / baseRotY for live animation
src/env.ts      — rock, ground, fog planes, dust particles, envMap builder
src/lights.ts   — 5 RectAreaLights; returns SceneLights (refs + base intensities)
src/fx.ts       — EffectComposer: BokehPass → UnrealBloom → FilmicShader → OutputPass
```

See `.agent/TODO.md` for prioritised next steps.
See `.agent/REFERENCE.md` for the full Blender + photo reference breakdown.
See `.agent/TECH.md` for Three.js version notes, import paths, material recipes.
