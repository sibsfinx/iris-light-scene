# Performance Plan — 120fps on iOS Chrome

Target: stable 120fps on iPhone 14 Pro / 15 Pro (A16/A17, ProMotion).
Stretch: solid 60fps on A14 / older mid-range devices.

iOS Chrome is WKWebView = WebKit. ProMotion `requestAnimationFrame` at 120Hz
requires iOS 15.4+ and the browser staying within a ~8.3ms frame budget.

---

## Measure first

Add this to `src/main.ts` before shipping any change. Without data you're guessing.

```ts
// In animate():
const frameStart = performance.now();
// ... rest of animate
const frameMs = performance.now() - frameStart;
// Keep a rolling 60-frame buffer, log P95 every 5s
```

Also open Safari → Develop → your device → Timeline. The GPU track shows
exactly which passes are eating time. Do this before touching anything — some
bottlenecks are not what you'd expect on a specific device.

---

## The bottlenecks (ranked by impact on mobile)

### 1. `preserveDrawingBuffer: true` — free 20-40% win

`src/main.ts:15`

This flag tells the driver to never discard the back buffer after presentation.
On desktop it's cheap. On mobile tile-based GPUs (Apple, Qualcomm) it forces a
full tile resolve and copy every frame — essentially negating the entire benefit
of tile-based rendering. It's the most expensive "invisible" flag in WebGL.

The main renderer doesn't need it. `downloadHD()` already creates its own
`hdRenderer` with `preserveDrawingBuffer: true`. Safe to remove from main.

**Fix:** `preserveDrawingBuffer: false` (or just omit it, false is the default).

---

### 2. `transmission > 0` — the double render pass

`src/iris.ts:287` (petals: 0.45), `src/iris.ts:318` (stem: 0.05), `src/iris.ts:396` (style: 0.38)

Any mesh with `transmission > 0` forces Three.js to render the entire scene to
an internal `WebGLRenderTarget` (the transmission background) before the main
render pass. With 36 petal meshes across 4 flowers, this effectively runs all
geometry twice per frame.

On desktop this is tolerable. On A16 at 120Hz with 8.3ms budget, it's fatal.

**Fix — non-transmission glass material for mobile tier:**
Remove `transmission` but keep the glass look via:
```ts
// Keeps ice-crystal appearance without the double-pass cost
transmission: 0,           // remove
opacity: 0.82,             // semi-transparent
transparent: true,
depthWrite: false,
clearcoat: 1.0,            // up from 0.70
clearcoatRoughness: 0.002,
iridescence: 0.75,         // up from 0.50 — compensates for lost refraction shimmer
iridescenceIOR: 1.52,
specularIntensity: 2.8,    // up from 2.2
roughness: 0.010,
```
The glass refraction bending disappears but the bright vein speculars, iridescent
rainbow edges, and clearcoat reflections — the actually visible parts — are all
intact. On a 6" screen at 120fps nobody misses the refraction.

---

### 3. Pixel ratio capped at 2 — 4× the fragment work

`src/main.ts:17`

iPhone 15 Pro has DPR 3. Capped at 2 = 4× the pixels of DPR 1. Every fragment
shader (bloom, bokeh, grain, main render) runs 4× more times.

```
DPR 1.0 → 1× pixels → budget: fine
DPR 1.5 → 2.25× pixels → budget: borderline
DPR 2.0 → 4× pixels → budget: broken at 120fps
```

**Fix — tiered pixel ratio:**
```ts
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
renderer.setPixelRatio(isMobile ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2));
```
At 1.5 DPR on a 3× screen: pixels are ~30% larger than native but on a 6"
display at arm's length it's imperceptible. The render time improvement is ~55%.

---

### 4. BokehPass — per-pixel depth comparison

`src/fx.ts:96`

BokehPass samples scene depth for every pixel, computes circle-of-confusion,
and blurs with a per-sample depth test. It's among the most expensive single
passes in Three.js postprocessing. On mobile it commonly takes 4-8ms alone.

The DOF effect in this scene is subtle — background flowers recede into blur
naturally because they're lower detail and behind fog planes.

**Fix — remove BokehPass on mobile tier. No replacement needed.**
If some blur is wanted cheaply: a radial blur centered on the focal point in
the filmic shader pass (2-3 samples, distance-weighted) costs ~0.2ms instead of 4ms.

---

### 5. UnrealBloomPass — 10 full-screen passes

`src/fx.ts:104`

UnrealBloomPass does 5 mip levels × 2 directional blur passes = 10 extra renders
of the full framebuffer. Designed for desktop. At 1920×1080 on desktop each
pass is cheap; at 1290×2796 at 2× DPR on a phone it's expensive.

**Fix — replace with a 2-pass minimal bloom:**

```ts
// src/fx.ts — swap UnrealBloomPass for a custom minimal version
// Pass 1: downsample + threshold to 1/4 resolution
// Pass 2: single separable Gaussian blur + additive composite
// Cost: ~2 passes instead of 10
```

Custom shader approach: in the filmic pass, after tone mapping, sample
`tBright` (a downsampled bright-only texture rendered once) and add it.
One extra pass total instead of ten.

Alternatively: `UnrealBloomPass` with `resolution` parameter set to
`new THREE.Vector2(w * 0.5, h * 0.5)` — halves the resolution of all bloom
passes, reduces cost ~75% with barely visible quality loss in this scene
(veins are bright lines, not broad glow).

---

### 6. Shadow map + SpotLight

`src/main.ts:19–20`, `src/lights.ts:56`

`PCFSoftShadowMap` is the most expensive shadow type. The SpotLight casts into
a shadow map that must be re-rendered every frame (the flowers rotate).

The grazing side-spot shadow at this scale is nearly invisible. RectAreaLights
don't cast shadows at all.

**Fix:**
```ts
// Mobile tier: disable entirely
renderer.shadowMap.enabled = false;

// Or globally: the SpotLight shadow adds subtle ground graze but isn't worth
// the frame budget on any tier.
sideSpot.castShadow = false; // in lights.ts
```

---

### 7. Dust particle CPU→GPU upload every frame

`src/env.ts:185–191`

`animateDust` modifies `pos.setX/setY` for 720 particles every frame.
Three.js auto-detects `position.needsUpdate` (or it's set implicitly) and
re-uploads the entire buffer to the GPU every frame. It's not expensive per
particle but it's a CPU stall + bandwidth cost on every frame.

**Fix — move to vertex shader:**

Pass `time` + `elapsed` uniforms to a `ShaderMaterial`. Store initial positions
as a vertex attribute (uploaded once). Compute current position in the shader:

```glsl
// vertex shader
uniform float time;
attribute vec3 initPosition;

void main() {
  float y = mod(initPosition.y + time * 0.025, 4.5) - 1.5;
  float x = initPosition.x + sin(time * 0.15 + float(gl_VertexID) * 0.7) * 0.008;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, initPosition.z, 1.0);
  gl_PointSize = ...;
}
```

Zero CPU-to-GPU upload per frame. The `animateDust` function and the per-frame
`pos.needsUpdate` go away.

---

### 8. InstancedMesh for background flowers

`src/main.ts:63–80`

Currently: 4 flowers × 9 meshes each = 36 draw calls for petals.
flower2/3/4 are identical geometry to heroFlower. Only their world transform differs.

**Fix:** keep heroFlower as regular meshes (needed for per-petal audio animation).
Render flower2+3+4 as InstancedMesh:
- 3 InstancedMesh objects (one per petal type: falls, standards, style arms)
  each with 3 instances
- 9 draw calls instead of 27 for background flowers
- Total: 9 (hero, normal) + 9 (background, instanced) = 18 vs 36

Tilt animation for background flowers works by updating instance matrices.

---

## Implementation phases

### Phase 1 — Zero-risk, implement now (~2h)
Changes with no visual impact whatsoever.

| Change | File | Line | Gain |
|--------|------|------|------|
| `preserveDrawingBuffer: false` | `main.ts` | 15 | 20–40% mobile |
| `sideSpot.castShadow = false` | `lights.ts` | 56 | 5–10% |
| `shadowMap.enabled = false` on mobile | `main.ts` | 19 | 5–10% |
| Adaptive pixel ratio (1.5 mobile cap) | `main.ts` | 17 | 40–55% mobile |

---

### Phase 2 — Device tier system (~4h)

Create `src/perf.ts` that exports:

```ts
export type QualityTier = 'high' | 'medium' | 'low';

export function detectTier(): QualityTier {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|Android/i.test(ua);
  if (!isMobile) return 'high';
  // Rough A-series proxy: check memory if available
  const mem = (navigator as any).deviceMemory ?? 4;
  return mem >= 4 ? 'medium' : 'low';
}

export interface QualityConfig {
  pixelRatio: number;
  transmission: boolean;
  bokeh: boolean;
  bloomPasses: number; // 0 = off, 1 = minimal, 2 = full Unreal
  shadowMap: boolean;
  petalDetail: number; // multiplied into flower `detail` param
  dustInShader: boolean;
}
```

`main.ts`, `fx.ts`, `iris.ts` all accept a `QualityConfig` at setup.

---

### Phase 3 — Non-transmission material (~3h)

In `iris.ts`, `makePetalMaterial` takes a `transmission: boolean` flag.
When false: swap to the opacity-based glass recipe above.
Requires `depthWrite: false` and sorted rendering order (Three.js handles
this automatically for transparent objects).

Visual regression test: compare at 3 angles. The iridescence + clearcoat
combination should hold up. If the petals look too "fogged": increase
`envMapIntensity` to 0.5–0.6 to add reflection brightness back.

---

### Phase 4 — Post-processing mobile tier (~4h)

In `fx.ts`, `buildComposer` takes `QualityConfig`:

```ts
// medium tier: no bokeh, half-res bloom
if (cfg.bokeh) composer.addPass(bokeh);
const bloomRes = cfg.bloomPasses === 2
  ? new THREE.Vector2(w, h)
  : new THREE.Vector2(w * 0.5, h * 0.5); // half-res = 75% cost reduction
const bloom = new UnrealBloomPass(bloomRes, ...);

// low tier: no bokeh, no bloom pass, just filmic grain
```

Half-resolution `UnrealBloomPass` is the best short-term win without rewriting
the bloom system. Full custom single-pass bloom is better but takes longer.

---

### Phase 5 — GPU-side dust (~3h)

Replace `createDustParticles` + `animateDust` with a shader-based points system.
`THREE.ShaderMaterial` with `time` uniform, `initPosition` attribute.
Remove the `animateDust` call from the animate loop entirely.

---

### Phase 6 — Adaptive resolution (~2h)

If Phase 1–4 still don't hit target on a specific device:

```ts
// In animate loop, after fx.composer.render():
const frameMs = performance.now() - frameStart;
if (frameMs > 10 && renderer.getPixelRatio() > 1.0) {
  renderer.setPixelRatio(renderer.getPixelRatio() - 0.25);
}
```

Or render to an `OffscreenCanvas`/`WebGLRenderTarget` at 80% resolution
and blit to the main canvas — completely invisible on phone screens.

---

## Realistic outcome by phase

| After phase | A17 Pro (iPhone 15 Pro) | A15 (iPhone 13) |
|---|---|---|
| Baseline (current) | ~25–35fps | ~15–20fps |
| Phase 1 | ~45–55fps | ~28–35fps |
| Phase 1–2 | ~55–70fps | ~35–45fps |
| Phase 1–3 | ~80–100fps | ~50–60fps |
| Phase 1–4 | **~110–130fps** | ~65–80fps |
| Phase 1–5 | **~120fps stable** | ~70–90fps |

120fps on A15 and older is unlikely without dynamic resolution scaling (Phase 6).
The rendering budget at 120Hz is simply half of 60Hz, and older Apple GPUs
don't have the throughput headroom even with all optimizations applied.

---

## What NOT to do

- Don't reduce the 1024×1024 vein texture resolution — the specular quality
  degrades immediately and it's generated once at startup (not per-frame cost).
- Don't remove `antialias: true` from the renderer — without it, jagged edges
  on the petal rims will be very visible, especially on 1.5× DPR.
- Don't replace `MeshPhysicalMaterial` with `MeshStandardMaterial` — you lose
  iridescence, clearcoat, and specularColor support, which are core to the look.
- Don't merge all flowers into a single BufferGeometry — breaks the per-flower
  rotation/tilt and audio-driven petal animation.
