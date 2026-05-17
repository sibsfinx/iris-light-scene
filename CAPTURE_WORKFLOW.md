# Iris Scene — Rotation Video & Screenshot Capture Workflow

## Setup

1. Open Chrome with Claude in Chrome extension
2. Navigate to the deployed scene URL
3. Resize browser window so viewport is **exactly 1200×900** (4:3):
   - Window height = 900 + ~143px (Chrome chrome overhead) ≈ **1043px total**
   - Use resize_window tool: `width: 1200, height: 1043`
   - Verify: `window.innerWidth + 'x' + window.innerHeight` → `1200x900`

## Camera Sweet Spot (no light pillars)

The scene has three RectAreaLights:
- **Key** (3.2, 1.8, 2.0) — front-right: causes harsh white specular pillars on glass petals
- **Fill** (-3.0, 1.2, 1.0) — front-left
- **Rim** (1.0, 0.2, -3.2) — back

**Avoid:** rotating right (toward key light) → massive pillars  
**Avoid:** rotating too far left (>90°) → RectAreaLight sources become visible as glowing squares  
**Sweet spot:** ~40° counterclockwise + slight upward tilt

```js
// Inject drag helper
window._drag = function(dx, dy, steps = 50) {
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  const sx = rect.left + 600, sy = rect.top + 460;
  const ex = sx + dx, ey = sy + dy;
  canvas.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true,cancelable:true,clientX:sx,clientY:sy,pointerId:1,isPrimary:true,pointerType:'mouse',button:0,buttons:1}));
  for (let i = 1; i <= steps; i++) {
    const t = i/steps;
    canvas.dispatchEvent(new PointerEvent('pointermove', {bubbles:true,cancelable:true,clientX:sx+(ex-sx)*t,clientY:sy+(ey-sy)*t,pointerId:1,isPrimary:true,pointerType:'mouse',button:0,buttons:1}));
  }
  canvas.dispatchEvent(new PointerEvent('pointerup', {bubbles:true,cancelable:true,clientX:ex,clientY:ey,pointerId:1,isPrimary:true,pointerType:'mouse',button:0,buttons:0}));
};

// Move to sweet spot: 40° CCW (133px left) + slight elevation (35px up)
// NOTE: dragging stops the auto-rotation (autoRotate = false on 'start' event)
_drag(-133, -35);
```

## Record Orbit Video (camera 360° orbit)

Start recording first, then start the orbit:

```js
// 1. Start MediaRecorder
const canvas = document.querySelector('canvas');
const stream = canvas.captureStream(30);
const rec = new MediaRecorder(stream, {mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000});
const parts = [];
rec.ondataavailable = e => { if (e.data.size > 0) parts.push(e.data); };
rec.onstop = () => { window._blob = new Blob(parts, {type: 'video/webm'}); };
rec.start(100);
window._rec = rec;
```

```js
// 2. Run continuous orbit (750 ticks × 16ms = ~12s, 1500px = >360°)
const canvas = document.querySelector('canvas');
const rect = canvas.getBoundingClientRect();
const baseY = rect.top + 450;
let cx = rect.left + 600;

canvas.dispatchEvent(new PointerEvent('pointerdown', {
  bubbles:true, cancelable:true, clientX:cx, clientY:baseY,
  pointerId:2, isPrimary:true, pointerType:'mouse', button:0, buttons:1
}));

let ticks = 0;
const totalTicks = 750;
window._orbitInterval = setInterval(() => {
  cx -= 2;
  ticks++;
  canvas.dispatchEvent(new PointerEvent('pointermove', {
    bubbles:true, cancelable:true, clientX:cx, clientY:baseY,
    pointerId:2, isPrimary:true, pointerType:'mouse', button:0, buttons:1
  }));
  if (ticks >= totalTicks) {
    clearInterval(window._orbitInterval);
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles:true, cancelable:true, clientX:cx, clientY:baseY,
      pointerId:2, isPrimary:true, pointerType:'mouse', button:0, buttons:0
    }));
    setTimeout(() => window._rec.stop(), 800);
  }
}, 16);
```

Wait ~14 seconds, then check: `window._blob.size` should be ~18–20MB.

## Save Blob to Disk

Browser blocks `a.click()` auto-downloads for blobs on HTTPS pages. Use a local receiver server instead:

```bash
# Terminal: start receiver
cat > /tmp/recv.py << 'EOF'
import http.server, sys
class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        data = self.rfile.read(length)
        path = '/tmp/' + self.path.lstrip('/')
        open(path, 'wb').write(data)
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', 9876), Handler).serve_forever()
EOF
python3 /tmp/recv.py &
```

```js
// Browser: POST blob to local server
// Chrome exempts 127.0.0.1 from mixed-content checks
fetch('http://127.0.0.1:9876/iris-orbit.webm', {
  method: 'POST',
  body: window._blob,
  headers: {'Content-Type': 'video/webm'}
}).then(r => { window._uploadStatus = 'ok:' + r.status; })
  .catch(e => { window._uploadStatus = 'fail:' + e.message; });
```

Wait ~10 seconds; verify: `ls -la /tmp/iris-orbit.webm` → ~18MB

## Post-Process with ffmpeg

> **Note:** ffmpeg 6.0 via Homebrew may be broken (missing libvmaf). Fix with `brew reinstall libvmaf` or upgrade ffmpeg before running.

```bash
# Convert webm → H.264 MP4, crop out Download HD button (bottom-right ~x:1040 y:825)
# Frame is already 1200×900 = 4:3, just black-box the button
ffmpeg -i /tmp/iris-orbit.webm \
  -vf "drawbox=x=1040:y=825:w=165:h=75:color=black:t=fill" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  /tmp/iris-orbit-final.mp4

# Extract 5 evenly-spaced frames as PNG screenshots
mkdir -p /tmp/iris-shots
for t in 1 3 5 7 9; do
  ffmpeg -ss $t -i /tmp/iris-orbit-final.mp4 \
    -frames:v 1 -q:v 1 /tmp/iris-shots/iris-frame-${t}s.png
done
```

## Key Findings

| Camera angle | Pillar level | Notes |
|---|---|---|
| Default (front, 0°) | Moderate | OK composition but noticeable streaks |
| 45° CW (right) | Heavy | Looking toward key light — worst |
| 40° CCW (left) + tilt up | **Minimal** | Sweet spot ✓ |
| 90°+ CCW | Light pillars gone but… | RectAreaLight sources visible as glowing squares |

- Auto-rotation (`autoRotate`) stops as soon as any drag begins — cannot re-enable without the controls panel (only present in newer builds)
- The deployed URL `6a09f18f02bf4600088dc052--iris-light-scene.netlify.app` is an older build with no controls panel — only `btn-download`
- OrbitControls maps full canvas width (1200px) ≈ 360° horizontal rotation; 1px drag ≈ 0.3°
- `canvas.captureStream(30)` + `MediaRecorder` works reliably; recording ~12s produces ~18–20MB webm at 8Mbps VP9
