# Iris 3D Scene — Agent Handoff

## What this is
A Three.js (TypeScript + Vite + pnpm) real-time 3D render of a Blender iris scene,
reverse-engineered from a reference image. Goal: match the reference as closely as possible.

## How to run
```bash
COREPACK_ENABLE_STRICT=0 pnpm dev   # starts on PORT env var or :5173
```
The `.claude/launch.json` is configured for the Claude Code preview panel.

## Current state (as of last session)
- ✅ Procedural iris geometry: 3 fall petals + 3 standard petals + 3 style arms + stem + bracts
- ✅ Glass-transmission petal material (MeshPhysicalMaterial, transmission 0.72, deep blue)
- ✅ 4 RectAreaLights matching Blender reference (Key, Rim, Top Godray, Back)
- ✅ Post-processing: UnrealBloomPass + filmic grain/vignette + OutputPass (ACES)
- ✅ OrbitControls (damped orbit, zoom, pan)
- ✅ HD download (3840×2160 PNG via off-screen renderer)
- ✅ Auto-slow rotation, stops on user interaction
- ✅ Dark atmospheric fog, volumetric planes, dark rock base
- ⚠️  Petal geometry still somewhat flat/blocky — needs more curvature and organic shape
- ⚠️  Center of flower overexposes slightly — transmission + bloom interaction
- ⚠️  Petal edges need tighter specular highlights like the reference "ice crystal" look
- ⚠️  No depth-of-field pass yet (BokehPass would add cinematic blur to background)

## Reference image description
See `.agent/REFERENCE.md` for full scene breakdown extracted from the Blender screenshot.

## File map
```
src/main.ts        — renderer, scene, camera, controls, animation loop, download
src/iris.ts        — procedural iris geometry (buildPetalGeo) + all materials
src/env.ts         — rock base, ground plane, fog planes, envMap builder
src/lights.ts      — 4 RectAreaLights + ambient/hemi fill
src/fx.ts          — EffectComposer, UnrealBloomPass, FilmicShader, GodRayShader
```

## Next priorities (in order)
1. Improve petal geometry — more organic curves, add vein-like displacement
2. Tighten bloom so only petal edges glow (not the whole surface)
3. Add BokehPass for depth-of-field on background/stem
4. Make rock base more textured (procedural normal/displacement)
5. Improve god-ray planes — animated slow drift upward
6. Consider adding a subtle particle system for floating dust motes

See `.agent/TODO.md` for detailed task list.
