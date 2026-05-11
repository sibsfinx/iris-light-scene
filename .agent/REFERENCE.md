# Blender Reference Scene — Full Breakdown

## Final render characteristics
- Near-black background (≈ #010306)
- Iris petals: deep blue / indigo, translucent — ice/glass quality
- Strong silver-white highlights on petal edges (rim lighting)
- Brilliant top-light god rays descending from upper right
- Atmospheric haze / volumetric fog in mid-ground
- Shallow depth of field: background and stem slightly soft
- High contrast, cinematic ACES tone mapping

## Outliner hierarchy
```
CAMERA
  Camera
FLOWER
  Iris_Petals
  Iris_Stem
ENVIRONMENT
  Rock_Base
  Volume_Fog
LIGHTS
  Key_Light
  Rim_Light
  Top_Godray
  Back_Light
VOLUMES & PLANES
  Godray_Plane_1
  Godray_Plane_2
  Godray_Plane_3
  Fill_Plane
  Black_Flag
```

## Light setup (from Blender UI)
| Name        | Type | Power  | Size  | Color       | Cast Shadow |
|-------------|------|--------|-------|-------------|-------------|
| Key_Light   | Area | 1500 W | 3 m   | white       | yes         |
| Rim_Light   | Area | 800 W  | 2 m   | white       | yes         |
| Top_Godray  | Area | 1200 W | 3 m   | white       | yes         |
| Back_Light  | Area | 400 W  | 2.5 m | white       | yes         |

Blender-to-Three.js intensity mapping: divide Blender watts by ~20 to get
Three.js RectAreaLight intensity in nit (cd/m²) as a starting point, then
adjust to taste with `renderer.toneMappingExposure`.

## Camera
- Type: Perspective
- Focal Length: 100 mm
- Lens Unit: Millimeters
- Shift X: −0.02, Shift Y: −0.01
- Clip Start: 0.1 m, End: 10 m
- Depth of Field: enabled, Focus Object = Iris_Petals
- F-Stop: (visible but small value, very shallow DOF)

Three.js equivalent: FOV ≈ 24° (full-frame 100mm), camera.setViewOffset for shift.

## Iris Petal Material (Principled BSDF)
| Property              | Value |
|-----------------------|-------|
| Base Color            | blue (deep, ~#0a1060) |
| Subsurface            | 0.0   |
| Metallic              | 0.0   |
| Specular              | 0.5   |
| Roughness             | 0.05  |
| IOR                   | 1.52  |
| Transmission          | 1.0   |
| Transmission Roughness| 0.02  |
| Clearcoat             | 0.1   |
| Clearcoat Roughness   | 0.03  |
| Sheen                 | 0.2   |
| Sheen Tint            | 0.6   |
| Emission Strength     | 0.2   |

Three.js: `MeshPhysicalMaterial` with `transmission=0.72` (partial for body color),
`roughness=0.03`, `ior=1.52`, `clearcoat=0.18`, `sheen=0.5`.
Full transmission=1.0 in Blender works because Cycles computes proper BSDF;
in Three.js rasterizer, partial transmission + dark base color gives similar look.

## Iris Stem Material
| Property   | Value |
|------------|-------|
| Base Color | green |
| Subsurface | 0.3   |
| Roughness  | 0.4   |
| Specular   | 0.3   |
| Transmission | 0.2 |
| Sheen      | 0.1   |

## Rock Material
| Property     | Value |
|--------------|-------|
| Base Color   | dark grey |
| Metallic     | 0.1   |
| Specular     | 0.2   |
| Roughness    | 0.8   |
| Displacement | yes (texture) |

## Volume Fog Material (Principled Volume)
| Property            | Value |
|---------------------|-------|
| Density             | 0.03  |
| Anisotropy          | 0.6   |
| Emission Strength   | 0.0   |
| Blackbody Intensity | 0.2   |
| Temperature         | 6500  |

Approximated in Three.js with: semi-transparent additive-blend planes + `FogExp2`.

## Texture maps used in Blender
- Petal — Base Color
- Petal — Normal
- Petal — Roughness
- Petal — Transmission
- Petal — Thickness
- Rock — Displacement
- Rock — Roughness

In the Three.js scene these are all procedural (no external textures).
To add texture maps: load PNGs with `THREE.TextureLoader`, assign to
`material.map`, `material.normalMap`, `material.roughnessMap`, etc.
