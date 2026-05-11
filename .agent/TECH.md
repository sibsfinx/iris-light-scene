# Technical Reference

## Stack
| Tool       | Version  | Notes                                      |
|------------|----------|--------------------------------------------|
| Node       | system   | (user's default)                           |
| pnpm       | system   | `COREPACK_ENABLE_STRICT=0 pnpm …` required |
| Vite       | 5.4.x    | reads PORT env var in vite.config.ts       |
| TypeScript | 5.6.x    | strict, bundler moduleResolution           |
| Three.js   | 0.170.0  | physical lighting on by default (r155+)    |

## Dev commands
```bash
# Start dev server
COREPACK_ENABLE_STRICT=0 pnpm dev

# Type check only
COREPACK_ENABLE_STRICT=0 npx tsc --noEmit

# Build for production
COREPACK_ENABLE_STRICT=0 pnpm build
```

## Three.js import paths (Vite + bundler resolution)
```ts
import * as THREE from 'three';
import { OrbitControls }            from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer }           from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }               from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass }          from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass }               from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass }               from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass }                from 'three/examples/jsm/postprocessing/BokehPass.js';
```

## Renderer setup (critical settings)
```ts
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// preserveDrawingBuffer: true  ← needed for PNG download
```

## Key Three.js r170 API notes
- `renderer.physicallyCorrectLights` — **deprecated/removed**, physical mode is always on
- `renderer.outputEncoding` — **removed**, use `renderer.outputColorSpace = THREE.SRGBColorSpace`
- `RectAreaLight.intensity` — cd/m² (nit) in physical mode; typical range 20–200 for this scene
- `MeshPhysicalMaterial.transmission` — 0=opaque, 1=fully transparent glass
- `MeshPhysicalMaterial.thickness` — volume depth for attenuation colour calculation
- No `physicallyBasedShading` flag — it's always enabled

## MeshPhysicalMaterial transmission recipe (petal)
```ts
new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0.02, 0.04, 0.22),  // dark blue body
  transmission: 0.72,       // partial — body colour shows through
  opacity: 1.0,
  transparent: true,        // required alongside transmission
  thickness: 0.22,          // volume for attenuation
  roughness: 0.03,
  ior: 1.52,                // glass
  attenuationColor: new THREE.Color(0.02, 0.06, 0.95),
  attenuationDistance: 0.2,
  clearcoat: 0.18,
  clearcoatRoughness: 0.02,
  sheen: 0.5,
  sheenColor: new THREE.Color(0.5, 0.6, 1.0),
  side: THREE.DoubleSide,
  envMap,                   // required for reflections/refractions
  envMapIntensity: 0.4,
})
```

## Post-processing pass order
```
RenderPass → UnrealBloomPass → ShaderPass(FilmicShader) → OutputPass
```
OutputPass handles tone mapping output to screen.  
`preserveDrawingBuffer: true` on main renderer is needed for the HD export.

## HD download approach
```ts
// Off-screen renderer at 3840×2160
const hdRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
hdRenderer.setSize(3840, 2160);
// Clone camera, rebuild EffectComposer with hdRenderer
// Render one frame, then canvas.toBlob() → download link
```

## Environment map setup
`buildEnvMap()` in `src/env.ts` uses `PMREMGenerator.fromScene()` with a custom
dark scene (background #020408 + faint directional lights). This gives just enough
environment data for transmission reflections without lighting the scene.

## Scene coordinate system
- Flower head: centred at (0, 0.2, 0)
- Stem: extends from y=0.15 down to y=−1.6
- Rock base: at y=−2.0, scale ~0.8 wide × 0.3 tall
- Ground plane: y=−2.2
- Camera: (0.2, 0.7, 5.2) looking at (0, 0.08, 0)
- All units: metres

## Geometry parameter guide (`buildPetalGeo` in `src/iris.ts`)
```ts
interface PetalConfig {
  length:   number;  // metres, tip-to-base
  maxWidth: number;  // metres, widest point
  droop:    number;  // radians — 0=flat, π/2=90° droop
  cup:      number;  // 0–1 cross-section concavity (0=flat, 1=half-pipe)
  waviness: number;  // edge fringe amplitude (metres)
  twist:    number;  // axial twist total (radians)
  uSegs:    number;  // segments along length (higher = smoother)
  vSegs:    number;  // segments across width
}
// isStandard=true  → upright petal (standards)
// isStandard=false → drooping petal (falls, default)
```
