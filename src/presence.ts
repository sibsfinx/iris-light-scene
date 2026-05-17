/**
 * presence.ts — 3-tier camera presence detection
 *
 * Tier 1  MOTION  — pixel-diff on 160×90 offscreen canvas  (~0.2 ms/frame)
 * Tier 2  FACE    — MediaPipe FaceDetector via CDN          (~8 ms/frame)
 * Tier 3  POSE    — MediaPipe PoseLandmarker via CDN        (~15 ms/frame)
 *
 * All MediaPipe assets are fetched from jsDelivr CDN on first use.
 * Update MP_VERSION if you need a different build.
 */

export type DetectionMode = 'off' | 'motion' | 'face' | 'pose';
export type StatusType    = 'idle' | 'loading' | 'active' | 'error';

export interface PresenceSignal {
  motion:      number;   // 0..1 — overall movement magnitude
  distance:    number;   // 0..1 — 0=nobody/far, 1=right in front
  faceCount:   number;
  centroidX:   number;   // -1..1 left/right
  centroidY:   number;   // -1..1 up/down
  approaching: boolean;  // distance is growing
  armsRaised:  boolean;  // pose mode: wrists above shoulders
}

const EMPTY: PresenceSignal = {
  motion: 0, distance: 0, faceCount: 0,
  centroidX: 0, centroidY: 0, approaching: false, armsRaised: false,
};

const MP_VERSION = '0.10.14';
const MP_CDN     = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;

export class PresenceDetector {
  mode:        DetectionMode = 'off';
  signal:      PresenceSignal = { ...EMPTY };
  statusType:  StatusType = 'idle';
  statusMsg    = '';
  detectionMs  = 0;

  onStatusChange?: (type: StatusType, msg: string) => void;

  private video:      HTMLVideoElement | null = null;
  stream:             MediaStream | null = null;   // exposed for preview
  private smallCv:    HTMLCanvasElement;
  private smallCtx:   CanvasRenderingContext2D;
  private prevFrame:  Uint8ClampedArray | null = null;

  private rafId:      number | null = null;
  private lastVTime   = -1;

  private prevFaceArea = 0;
  private trendBuf:    number[] = [];

  // MediaPipe detector instance — shared between face & pose loops
  private mpDet:      any = null;
  private mpMode:     DetectionMode | null = null;

  constructor() {
    this.smallCv  = document.createElement('canvas');
    this.smallCv.width  = 160;
    this.smallCv.height = 90;
    this.smallCtx = this.smallCv.getContext('2d', { willReadFrequently: true })!;
  }

  async setMode(mode: DetectionMode): Promise<void> {
    this._stopLoop();

    // Turn off: release camera immediately
    if (mode === 'off') {
      this._releaseCamera();
      this.mode   = 'off';
      this.signal = { ...EMPTY };
      this._setStatus('idle', 'Camera off');
      return;
    }

    this.mode = mode;
    this._resetBufs();

    // Acquire camera if needed
    if (!this.stream) {
      this._setStatus('loading', 'Requesting camera…');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 180 }, facingMode: 'user' },
          audio: false,
        });
        this.video = document.createElement('video');
        this.video.srcObject = this.stream;
        this.video.muted     = true;
        this.video.playsInline = true;
        await this.video.play();
      } catch {
        this._setStatus('error', 'Camera denied');
        this.mode = 'off';
        return;
      }
    }

    if (mode === 'motion') {
      this._setStatus('active', 'Motion  ·  pixel-diff');
      this._loopMotion();
      return;
    }

    // Load MediaPipe if mode changed or not yet loaded
    if (this.mpMode !== mode) {
      this._setStatus('loading', mode === 'face' ? 'Loading MediaPipe Face…' : 'Loading MediaPipe Pose…');
      try {
        await this._loadMediaPipe(mode);
        this.mpMode = mode;
      } catch (e) {
        console.error('MediaPipe load error', e);
        this._setStatus('error', 'MediaPipe failed — check network');
        return;
      }
    }

    if (mode === 'face') {
      this._setStatus('active', 'Face  ·  MediaPipe');
      this._loopFace();
    } else {
      this._setStatus('active', 'Pose  ·  MediaPipe');
      this._loopPose();
    }
  }

  // ── MediaPipe loader ───────────────────────────────────────────────────────

  private async _loadMediaPipe(mode: 'face' | 'pose'): Promise<void> {
    // Dynamic CDN import — @vite-ignore tells Vite not to try resolving this
    const vision = await import(/* @vite-ignore */ `${MP_CDN}/vision_bundle.mjs`) as any;
    const { FilesetResolver, FaceDetector, PoseLandmarker } = vision;

    const wasm = await FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`);

    if (mode === 'face') {
      this.mpDet = await FaceDetector.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
    } else {
      this.mpDet = await PoseLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode:              'VIDEO',
        numPoses:                 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence:  0.5,
        minTrackingConfidence:      0.5,
      });
    }
  }

  // ── Pixel-diff motion loop ─────────────────────────────────────────────────

  private _loopMotion(): void {
    const W = 160, H = 90;
    const run = () => {
      if (this.mode !== 'motion' || !this.video) return;
      this.rafId = requestAnimationFrame(run);

      const t0 = performance.now();
      this.smallCtx.drawImage(this.video, 0, 0, W, H);
      const frame = this.smallCtx.getImageData(0, 0, W, H).data;

      if (this.prevFrame) {
        let totalDiff = 0;
        let sx = 0, sy = 0, hotPx = 0;
        let centerDiff = 0, centerN = 0;

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const d = (Math.abs(frame[i]   - this.prevFrame[i])   +
                       Math.abs(frame[i+1] - this.prevFrame[i+1]) +
                       Math.abs(frame[i+2] - this.prevFrame[i+2])) / 3;
            if (d > 15) { totalDiff += d; sx += x; sy += y; hotPx++; }
            if (x > 40 && x < 120 && y > 22 && y < 67) { centerDiff += d; centerN++; }
          }
        }

        const motion = Math.min(1, totalDiff / (W * H * 30));
        const centerM = centerDiff / (centerN * 255);

        this.trendBuf.push(centerM);
        if (this.trendBuf.length > 14) this.trendBuf.shift();
        const trend = this.trendBuf.length > 4
          ? this.trendBuf.slice(-3).reduce((a, b) => a + b, 0) / 3 -
            this.trendBuf.slice(0, 3).reduce((a, b) => a + b, 0) / 3
          : 0;

        this.signal = {
          motion,
          distance:   Math.min(1, motion * 2.5),
          faceCount:  0,
          centroidX:  hotPx > 0 ? (sx / hotPx / W) * 2 - 1 : 0,
          centroidY:  hotPx > 0 ? (sy / hotPx / H) * 2 - 1 : 0,
          approaching: trend > 0.008 && motion > 0.05,
          armsRaised:  false,
        };
      }
      this.prevFrame   = new Uint8ClampedArray(frame);
      this.detectionMs = performance.now() - t0;
    };
    this.rafId = requestAnimationFrame(run);
  }

  // ── MediaPipe face loop ────────────────────────────────────────────────────

  private _loopFace(): void {
    const run = () => {
      if (this.mode !== 'face' || !this.video) return;
      this.rafId = requestAnimationFrame(run);

      const vt = this.video.currentTime;
      if (vt === this.lastVTime) return;
      this.lastVTime = vt;

      const t0  = performance.now();
      const res = this.mpDet.detectForVideo(this.video, performance.now());
      this.detectionMs = performance.now() - t0;

      const dets = (res.detections ?? []) as any[];
      let bigArea = 0, cx = 0, cy = 0;
      const vw = this.video.videoWidth, vh = this.video.videoHeight;

      for (const d of dets) {
        const bb   = d.boundingBox;
        const area = (bb.width / vw) * (bb.height / vh);
        if (area > bigArea) {
          bigArea = area;
          cx = (bb.originX + bb.width  / 2) / vw;
          cy = (bb.originY + bb.height / 2) / vh;
        }
      }

      const delta = bigArea - this.prevFaceArea;
      this.trendBuf.push(delta);
      if (this.trendBuf.length > 8) this.trendBuf.shift();
      const trend = this.trendBuf.reduce((a, b) => a + b, 0);
      this.prevFaceArea = bigArea;

      // bigArea ≈ 0.005 far → 0,  ≈ 0.12 close → 1
      const dist = Math.min(1, Math.max(0, (bigArea - 0.005) / 0.115));

      this.signal = {
        motion:     dets.length > 0 ? 0.3 + dist * 0.7 : 0,
        distance:   dist,
        faceCount:  dets.length,
        centroidX:  dets.length > 0 ? cx * 2 - 1 : 0,
        centroidY:  dets.length > 0 ? cy * 2 - 1 : 0,
        approaching: trend > 0 && bigArea > 0.01,
        armsRaised:  false,
      };
    };
    this.rafId = requestAnimationFrame(run);
  }

  // ── MediaPipe pose loop ────────────────────────────────────────────────────

  private _loopPose(): void {
    // PoseLandmarker landmark indices
    const IDX = { NOSE: 0, L_SHO: 11, R_SHO: 12, L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24 };

    const run = () => {
      if (this.mode !== 'pose' || !this.video) return;
      this.rafId = requestAnimationFrame(run);

      const vt = this.video.currentTime;
      if (vt === this.lastVTime) return;
      this.lastVTime = vt;

      const t0  = performance.now();
      const res = this.mpDet.detectForVideo(this.video, performance.now());
      this.detectionMs = performance.now() - t0;

      const lmSets = (res.landmarks ?? []) as any[][];
      if (lmSets.length === 0) {
        this.signal = { ...EMPTY };
        return;
      }

      const lm      = lmSets[0];
      const nose    = lm[IDX.NOSE];
      const lSho    = lm[IDX.L_SHO];
      const rSho    = lm[IDX.R_SHO];
      const lHip    = lm[IDX.L_HIP];
      const rHip    = lm[IDX.R_HIP];
      const lWrist  = lm[IDX.L_WRIST];
      const rWrist  = lm[IDX.R_WRIST];

      const shoulderW = Math.abs(lSho.x - rSho.x);
      const bodyH     = Math.abs((lSho.y + rSho.y) / 2 - (lHip.y + rHip.y) / 2);
      const bodySize  = (shoulderW + bodyH) / 2;

      const armsRaised = lWrist.y < lSho.y - 0.08 || rWrist.y < rSho.y - 0.08;

      // bodySize ≈ 0.05 far → 0,  ≈ 0.35 close → 1
      const dist = Math.min(1, Math.max(0, (bodySize - 0.05) / 0.30));

      this.trendBuf.push(dist);
      if (this.trendBuf.length > 8) this.trendBuf.shift();
      const trend = this.trendBuf.length > 2
        ? this.trendBuf[this.trendBuf.length - 1] - this.trendBuf[0]
        : 0;

      this.signal = {
        motion:      0.3 + dist * 0.7,
        distance:    dist,
        faceCount:   1,
        centroidX:   nose.x * 2 - 1,
        centroidY:   nose.y * 2 - 1,
        approaching: trend > 0.04,
        armsRaised,
      };
    };
    this.rafId = requestAnimationFrame(run);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _stopLoop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  private _releaseCamera(): void {
    this._stopLoop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video  = null;
  }

  private _resetBufs(): void {
    this.prevFrame    = null;
    this.prevFaceArea = 0;
    this.trendBuf     = [];
    this.lastVTime    = -1;
  }

  private _setStatus(type: StatusType, msg: string): void {
    this.statusType = type;
    this.statusMsg  = msg;
    this.onStatusChange?.(type, msg);
  }
}
