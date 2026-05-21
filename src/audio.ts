export interface AudioBands {
  sub:       number;  // 40–100 Hz  — body resonance
  bass:      number;  // 100–250 Hz — kick / bass hits
  lowMid:    number;  // 250–500 Hz — snare, warmth
  mid:       number;  // 500–4000 Hz — melody, voice
  high:      number;  // 4000+ Hz   — presence, air
  amplitude: number;  // 20–20000 Hz overall energy
}

export interface TiltVector {
  x: number;  // –1..1
  z: number;  // –1..1
}

// Maps bass-range FFT bins circularly onto the XZ plane.
// A dominant frequency "pushes" the flower in a characteristic direction.
// Flat/silent spectrum → near-zero vector.
function computeBassDirection(data: ArrayLike<number>, binHz: number): TiltVector {
  const lo = Math.max(0, Math.floor(40 / binHz));
  const hi = Math.min(data.length - 1, Math.ceil(300 / binHz));
  const count = hi - lo;
  if (count < 2) return { x: 0, z: 0 };

  let wx = 0, wz = 0, total = 0;
  for (let i = lo; i <= hi; i++) {
    const t     = (i - lo) / count;
    const angle = t * Math.PI * 2;
    const w     = data[i] / 255;
    wx    += Math.cos(angle) * w;
    wz    += Math.sin(angle) * w;
    total += w;
  }
  if (total < 0.4) return { x: 0, z: 0 };
  return { x: wx / total, z: wz / total };
}

export class AudioReactor {
  private ctx:       AudioContext | null = null;
  private analyser:  AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  private _smooth: AudioBands = { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, amplitude: 0 };
  private _tilt:   TiltVector = { x: 0, z: 0 };

  public active = false;

  async start(): Promise<void> {
    this.ctx = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = this.ctx.createMediaStreamSource(stream);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.78;
    source.connect(this.analyser);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.active = true;
  }

  stop(): void {
    this.ctx?.close();
    this.ctx       = null;
    this.analyser  = null;
    this.active    = false;
    // decay smoothly to zero — update() will lerp down each frame
  }

  private binHz(): number {
    if (!this.ctx) return 43;
    return (this.ctx.sampleRate / 2) / this.dataArray.length;
  }

  private avg(minHz: number, maxHz: number): number {
    const bHz = this.binHz();
    const lo  = Math.max(0, Math.floor(minHz / bHz));
    const hi  = Math.min(this.dataArray.length - 1, Math.ceil(maxHz / bHz));
    if (hi <= lo) return 0;
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += this.dataArray[i];
    return sum / ((hi - lo + 1) * 255);
  }

  update(): void {
    if (this.active && this.analyser) {
      this.analyser.getByteFrequencyData(this.dataArray);
    } else {
      // Let dataArray drain to zero so bands decay naturally
      for (let i = 0; i < this.dataArray.length; i++) {
        if (this.dataArray[i] > 0) this.dataArray[i] = Math.max(0, this.dataArray[i] - 4);
      }
    }

    const raw = {
      sub:       this.avg(40,    100),
      bass:      this.avg(100,   250),
      lowMid:    this.avg(250,   500),
      mid:       this.avg(500,  4000),
      high:      this.avg(4000, 20000),
      amplitude: this.avg(20,   20000),
    };

    // Different smoothing speeds — low freqs are sluggish, high freqs are snappy
    this._smooth.sub       += (raw.sub       - this._smooth.sub)       * 0.10;
    this._smooth.bass      += (raw.bass      - this._smooth.bass)      * 0.12;
    this._smooth.lowMid    += (raw.lowMid    - this._smooth.lowMid)    * 0.18;
    this._smooth.mid       += (raw.mid       - this._smooth.mid)       * 0.22;
    this._smooth.high      += (raw.high      - this._smooth.high)      * 0.28;
    this._smooth.amplitude += (raw.amplitude - this._smooth.amplitude) * 0.16;

    // Tilt direction from bass shape — smooth even slower for organic sway
    const raw_t = computeBassDirection(this.dataArray, this.binHz());
    this._tilt.x += (raw_t.x - this._tilt.x) * 0.05;
    this._tilt.z += (raw_t.z - this._tilt.z) * 0.05;
  }

  get bands(): AudioBands {
    return this._smooth;
  }

  // XZ directional push derived from which bass frequencies dominate.
  // Components are roughly –0.5..0.5 under typical music.
  get tilt(): TiltVector {
    return this._tilt;
  }
}
