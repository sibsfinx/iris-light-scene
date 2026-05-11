# TODO — Iris 3D Scene

Items are roughly ordered by visual impact on matching the reference.

## High priority

### 1. Petal geometry — more organic shape
**File:** `src/iris.ts` → `buildPetalGeo()`
- Current: parametric surface with sinusoidal waviness, fairly smooth
- Needed: vein-like displacement along petal length, more ruffled edges on falls,
  stronger longitudinal ribbing on standards (like corrugated glass)
- Approach: after computing the base surface, iterate the position buffer and add
  Perlin/simplex-like noise along the U axis (petal spine direction)
- Note: Three.js has no built-in Perlin; implement a small `simplex2d(x,y)` helper
  or use the formula from Ashima Arts (public domain, ~30 lines)

### 2. Sharper specular edges — "ice crystal" look
**File:** `src/iris.ts` → `makePetalMaterial()`
- Current: `roughness: 0.03`, `clearcoat: 0.18` — good but not sharp enough
- Try: `roughness: 0.01`, `clearcoatRoughness: 0.01`, `specularIntensity: 1.5`
- Also consider procedural normal map via `THREE.CanvasTexture` drawn with radial
  streak patterns to simulate the fine vein structure seen in reference

### 3. Depth of field
**File:** `src/fx.ts` → `buildComposer()`
- Add `BokehPass` from `three/examples/jsm/postprocessing/BokehPass.js`
- Parameters from reference: very shallow DOF, focus on flower head
  ```ts
  const bokeh = new BokehPass(scene, camera, { focus: 5.2, aperture: 0.00018, maxblur: 0.012 });
  composer.addPass(bokeh); // add BEFORE bloom
  ```
- BokehPass must come before UnrealBloomPass in the pass chain

### 4. Rock texture
**File:** `src/env.ts` → `createRockBase()`
- Current: flat dark `MeshStandardMaterial`
- Add procedural `roughnessMap` and `normalMap` using `THREE.CanvasTexture`:
  draw random Voronoi-like cells in a 256×256 canvas → assign as roughnessMap
- Or: use `THREE.DataTexture` with generated Perlin noise for displacement

### 5. God ray animation
**File:** `src/env.ts` → `createFogPlanes()` and `src/main.ts` → animate loop
- Currently planes drift slowly on Y (implemented, subtle)
- Improve: each plane should also slowly rotate on its normal axis and vary opacity
  with `Math.sin(elapsed * 0.2 + index)` for organic breathing feel
- Consider: add 2–3 more godray planes aimed from the Top_Godray light position
  (currently at 0.2, 3.8, -1.6) angled toward the flower

## Medium priority

### 6. Dust motes / particle system
- Add ~200 small `THREE.Points` with `PointsMaterial` (size 0.004, additive blend)
- Positions randomised in a 4×4×4 box centred on the flower
- Animate: each particle drifts upward slowly with slight XZ wobble
- This adds depth and matches the atmospheric haze visible in the reference

### 7. Selective bloom (avoid blooming the whole scene)
**File:** `src/fx.ts`
- Current: `UnrealBloomPass` blooms everything above threshold
- Better: use the "selective bloom" technique with two render layers:
  1. Render only bloom objects (petals at full intensity) to RT1
  2. Render rest of scene normally to RT2
  3. Apply bloom to RT1, then composite
- Three.js example: `examples/jsm/postprocessing/` — see `webgl_postprocessing_unreal_bloom_selective`

### 8. Petal normal map (vein texture)
- Generate a `THREE.CanvasTexture` in JavaScript:
  draw radiating lines from petal base in a 512×256 canvas, blur slightly
  → acts as a normal map for fine surface detail
- Assign: `material.normalMap = veinsTexture; material.normalScale.set(0.4, 0.4)`

### 9. Style arm shape improvement
**File:** `src/iris.ts` — style arms section
- Currently very simple small petals
- Real iris style arms are crested/ridged at the tip — add a crest by creating
  a second narrow petal oriented 90° and merged with the base arm geometry

## Low priority / polish

### 10. Tone mapping fine-tuning
- Current: `ACESFilmicToneMapping`, `exposure: 0.9`
- Try `THREE.CineonToneMapping` for slightly warmer shadows, or
  custom LUT via ShaderPass for the exact Blender look
- Reference shows very dark blacks with no lifted shadows — ACES is correct choice

### 11. Black flag backdrop
- Currently a black plane at z=−3
- Make it slightly larger (8×8) and add very slight surface texture (almost nothing)
- In Blender it's used to prevent light spill on the backdrop wall

### 12. Download button — add progress indicator
**File:** `src/main.ts` → `downloadHD()`
- The HD render takes a few seconds; show a spinner or "Rendering…" text
- After `canvas.toBlob()` resolves, restore button text

## Known issues / gotchas

- **RectAreaLight intensity units:** In Three.js r155+ physical lighting is default.
  `RectAreaLight.intensity` = cd/m² (nit). Values 28–95 work well at `exposure: 0.9`.
  If scene looks blown out, reduce intensity first, then exposure.
  
- **Transmission + DoubleSide:** `MeshPhysicalMaterial` with `transmission > 0` and
  `side: THREE.DoubleSide` can cause z-fighting on very thin surfaces. If artefacts
  appear, try `depthWrite: false` or split into two single-sided meshes.

- **pnpm / corepack conflict:** Root `/Users/alexander/package.json` has a
  `packageManager` field forcing yarn. Always prefix with `COREPACK_ENABLE_STRICT=0`
  when running pnpm commands in this project.

- **Preview server port:** `.claude/launch.json` uses `autoPort: true`.
  `vite.config.ts` reads `process.env['PORT']` — keep this in sync.
