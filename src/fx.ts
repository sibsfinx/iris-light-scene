import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/* ─── Vignette + film-grain shader ──────────────────────────────────────── */

const FilmicShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0.0 },
    grainStrength: { value: 0.032 },
    vignetteStrength: { value: 0.62 },
    vignetteOffset: { value: 0.72 },
    saturation: { value: 1.08 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float grainStrength;
    uniform float vignetteStrength;
    uniform float vignetteOffset;
    uniform float saturation;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 saturate3(vec3 c, float s) {
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(luma), c, s);
    }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);

      // Film grain
      float grain = rand(vUv + fract(time * 0.017)) * 2.0 - 1.0;
      col.rgb += grain * grainStrength;

      // Vignette
      vec2 uv2 = vUv * 2.0 - 1.0;
      float vign = 1.0 - smoothstep(vignetteOffset, vignetteOffset + vignetteStrength, length(uv2));
      col.rgb *= vign;

      // Subtle saturation boost
      col.rgb = saturate3(col.rgb, saturation);

      gl_FragColor = col;
    }
  `,
};

/* ─── God-ray radial blur ────────────────────────────────────────────────── */

const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    lightPos: { value: new THREE.Vector2(0.52, 0.76) }, // UV of top-godray light
    exposure: { value: 0.22 },
    decay: { value: 0.93 },
    density: { value: 0.96 },
    weight: { value: 0.38 },
    samples: { value: 60 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 lightPos;
    uniform float exposure;
    uniform float decay;
    uniform float density;
    uniform float weight;
    uniform int samples;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 delta = (uv - lightPos) * (1.0 / float(samples)) * density;
      float illuminationDecay = 1.0;
      vec4 color = vec4(0.0);

      for (int i = 0; i < 60; i++) {
        if (i >= samples) break;
        uv -= delta;
        vec4 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0));
        s *= illuminationDecay * weight;
        color += s;
        illuminationDecay *= decay;
      }

      color *= exposure;
      // Only additive blue-tinted rays
      color.rgb = color.rgb * vec3(0.55, 0.7, 1.0);
      gl_FragColor = color;
    }
  `,
};

/* ─── Additive blend shader ─────────────────────────────────────────────── */

const AddBlendShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tAdd: { value: null as THREE.Texture | null },
    strength: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tAdd;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec4 add  = texture2D(tAdd, vUv);
      gl_FragColor = base + add * strength;
    }
  `,
};

/* ─── Build composer ─────────────────────────────────────────────────────── */

export interface FxComposer {
  composer: EffectComposer;
  filmPass: ShaderPass;
  godRayPass: ShaderPass;
  setSize(w: number, h: number): void;
  tick(dt: number): void;
}

export function buildComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): FxComposer {
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;

  // ── Main composer ──────────────────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.32, 0.82);
  composer.addPass(bloom);

  // ── God rays via separate render target ───────────────────────────────
  const godRayRT = new THREE.WebGLRenderTarget(w, h);
  const godRayPass = new ShaderPass({ ...GodRayShader });
  // rendered separately, blended in AddBlendShader

  // ── Filmic look (grain + vignette) ────────────────────────────────────
  const filmPass = new ShaderPass({ ...FilmicShader });
  composer.addPass(filmPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    filmPass,
    godRayPass,
    setSize(nw: number, nh: number) {
      composer.setSize(nw, nh);
      bloom.setSize(nw, nh);
      godRayRT.setSize(nw, nh);
    },
    tick(dt: number) {
      filmPass.uniforms['time'].value += dt;
    },
  };
}
