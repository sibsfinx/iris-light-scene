import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { QualityConfig } from './perf';

/* ─── Filmic grain + vignette ───────────────────────────────────────────── */

const FilmicShader = {
  uniforms: {
    tDiffuse:   { value: null as THREE.Texture | null },
    time:       { value: 0.0 },
    grain:      { value: 0.028 },
    vigStr:     { value: 0.55 },
    vigOff:     { value: 0.68 },
    sat:        { value: 1.06 },
    chromAberr: { value: 0.0018 },
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
    uniform float grain;
    uniform float vigStr;
    uniform float vigOff;
    uniform float sat;
    uniform float chromAberr;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 fromCenter = uv - 0.5;
      float dist = length(fromCenter);

      float ca = chromAberr * dist;
      vec2 caDir = normalize(fromCenter + 0.0001) * ca;
      float r = texture2D(tDiffuse, uv + caDir).r;
      float g = texture2D(tDiffuse, uv       ).g;
      float b = texture2D(tDiffuse, uv - caDir).b;
      vec4 col = vec4(r, g, b, 1.0);

      float g2 = rand(uv + fract(time * 0.0173)) * 2.0 - 1.0;
      col.rgb += g2 * grain;

      float v = 1.0 - smoothstep(vigOff, vigOff + vigStr, dist * 1.414);
      col.rgb *= v;

      float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      col.rgb = mix(vec3(luma), col.rgb, sat);

      gl_FragColor = col;
    }
  `,
};

/* ─── Build composer ─────────────────────────────────────────────────────── */

export interface FxComposer {
  composer:  EffectComposer;
  filmPass:  ShaderPass;
  bloom:     UnrealBloomPass;
  bokeh:     BokehPass | null;
  setSize(w: number, h: number): void;
  tick(dt: number): void;
}

export function buildComposer(
  renderer: THREE.WebGLRenderer,
  scene:    THREE.Scene,
  camera:   THREE.PerspectiveCamera,
  cfg?:     QualityConfig,
): FxComposer {
  const w = renderer.domElement.clientWidth  || window.innerWidth;
  const h = renderer.domElement.clientHeight || window.innerHeight;

  const bloomResScale = cfg?.bloomResScale ?? 1.0;
  const bw = Math.round(w * bloomResScale);
  const bh = Math.round(h * bloomResScale);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // BokehPass — skipped on mobile tiers (saves 4-8ms per frame)
  let bokeh: BokehPass | null = null;
  if (cfg === undefined || cfg.bokeh) {
    bokeh = new BokehPass(scene, camera, { focus: 4.8, aperture: 0.00018, maxblur: 0.010 });
    composer.addPass(bokeh);
  }

  // UnrealBloomPass — half resolution on medium/low saves ~75% bloom cost
  const bloom = new UnrealBloomPass(new THREE.Vector2(bw, bh), 0.48, 0.14, 0.94);
  composer.addPass(bloom);

  const filmPass = new ShaderPass({ ...FilmicShader });
  composer.addPass(filmPass);

  composer.addPass(new OutputPass());

  return {
    composer,
    filmPass,
    bloom,
    bokeh,
    setSize(nw, nh) {
      composer.setSize(nw, nh);
      bloom.setSize(Math.round(nw * bloomResScale), Math.round(nh * bloomResScale));
    },
    tick(dt) {
      filmPass.uniforms['time'].value += dt;
    },
  };
}
