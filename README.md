# Spencer Jireh Cebrian - Portfolio

Personal portfolio website featuring a WebGL watercolor painting effect with interactive mouse reveal.

**Live:** [spencerjireh.com](https://spencerjireh.com)

## Tech Stack

- **TypeScript** - No framework (vanilla)
- **Vite** - Build tooling and dev server
- **Three.js** - WebGL rendering and post-processing pipeline
- **GLSL** - Custom shaders for painterly effects

## Features

- Kuwahara filter for oil painting / watercolor aesthetic
- Mouse-driven water displacement with wave physics
- Sobel edge detection for paint pooling simulation
- Procedural paper texture overlay (FBM noise)
- Golden ratio (1.618) based spacing system
- Major Third (1.25) typography scale
- CSS `@layer` cascade architecture

## Getting Started

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run package  # Build + create tar.gz archive
```

## Project Structure

```
js/
├── main.ts                    # Entry point, Portfolio orchestrator
└── webgl/
    ├── three-manager.ts       # Renderer, EffectComposer, ping-pong buffers
    ├── scene-controller.ts    # Section detection, mouse tracking, colors
    └── shaders/
        ├── procedural-gradient.ts   # Background source (image or procedural)
        ├── kuwahara.ts              # 4-quadrant painterly filter
        ├── watercolor-enhance.ts    # Paper texture, Sobel edges, saturation
        └── displacement.ts          # Wave equation, ink diffusion

css/
├── main.css           # @layer imports
├── design-tokens.css  # Golden ratio spacing, typography scale
├── typography.css     # Cormorant Garamond, scale application
├── layout.css         # Framed asymmetric grid
└── ...
```

## WebGL Pipeline

```
Scene (fullscreen quad)
    │
    ▼
┌─────────────────┐
│  RenderPass     │  Renders background image to texture
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Kuwahara Pass  │  36 samples, 4-quadrant filter + mouse reveal
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Watercolor     │  Paper texture, edge darkening, saturation, vignette
└────────┬────────┘
         │
         ▼
      Screen
```

**Displacement (ping-pong):** Runs separately each frame, updating wave simulation. Output texture is sampled by Kuwahara and Watercolor passes to reveal unfiltered image where mouse has displaced the "water."

---

## Shader Math Reference

### 1. Kuwahara Filter (`kuwahara.ts`)

Creates painterly effect by selecting the smoothest region around each pixel.

**Algorithm:**
1. Divide neighborhood into 4 quadrants (top-left, top-right, bottom-left, bottom-right)
2. For each quadrant, sample 9 pixels (3x3 grid)
3. Calculate mean and variance
4. Output the mean of the quadrant with lowest variance

**Variance calculation:**

```glsl
vec3 mean = sum / 9.0;
vec3 variance = (sumSq / 9.0) - (mean * mean);
float luminanceVar = dot(variance, vec3(0.299, 0.587, 0.114));
```

- `E[X^2] - E[X]^2` - Standard variance formula
- Luminance weights (0.299, 0.587, 0.114) - Human eye sensitivity (ITU-R BT.601)
- Picks quadrant with minimum `luminanceVar`

**Why it works:** Edges have high variance (sharp color changes). Flat regions have low variance. By always picking the lowest-variance quadrant, edges get "pushed" to quadrant boundaries, creating the characteristic blocky brush-stroke look.

**Sample count:** 4 quadrants x 9 samples = 36 total (vs ~440 in 8-sector anisotropic version)

---

### 2. Wave Equation (`displacement.ts`)

Simulates water ripples using the discrete wave equation.

**Laplacian (spatial second derivative):**

```glsl
float laplacian = left + right + up + down - 4.0 * height;
```

This is the discrete 2D Laplacian stencil:
```
    [ 0  1  0 ]
    [ 1 -4  1 ]
    [ 0  1  0 ]
```

Measures how much a point differs from its neighbors. Positive = neighbors are higher (concave up), negative = neighbors are lower (concave down).

**Wave equation:**

```glsl
velocity += laplacian * waveSpeed;  // Acceleration from curvature
velocity *= damping;                 // Energy loss
height += velocity * dt;             // Position update
```

Physics: `d²h/dt² = c² * ∇²h` (wave equation)
- Acceleration proportional to curvature (Laplacian)
- `waveSpeed` = c² (wave propagation speed squared)
- `damping` < 1 causes waves to decay over time

**Ping-pong buffering:** Two render targets alternate each frame. Frame N reads from buffer A, writes to buffer B. Frame N+1 reads from B, writes to A. Prevents reading and writing same texture simultaneously.

---

### 3. Sobel Edge Detection (`watercolor-enhance.ts`)

Detects edges for simulating paint pooling at boundaries.

**Sobel kernels:**

```
Gx (horizontal):        Gy (vertical):
[-1  0  1]              [ 1  2  1]
[-2  0  2]              [ 0  0  0]
[-1  0  1]              [-1 -2 -1]
```

**Implementation:**

```glsl
float gx = (tl + 2.0*l + bl) - (tr + 2.0*r + br);
float gy = (tl + 2.0*t + tr) - (bl + 2.0*b + br);
float edge = length(vec2(gx, gy));
```

- `gx` - Horizontal gradient (vertical edges)
- `gy` - Vertical gradient (horizontal edges)
- `length(gx, gy)` - Gradient magnitude (edge strength)

Pixels are converted to luminance first: `0.299*R + 0.587*G + 0.114*B`

---

### 4. Fractal Brownian Motion (`watercolor-enhance.ts`)

Generates natural-looking paper texture.

**FBM formula:**

```typescript
let value = 0, amplitude = 0.5, frequency = 1;
for (let i = 0; i < 4; i++) {
  value += amplitude * noise(x * frequency, y * frequency);
  amplitude *= 0.5;   // Each octave half as strong
  frequency *= 2;     // Each octave twice the frequency
}
```

- **Octave 1:** Large, smooth features (amplitude 0.5, frequency 1)
- **Octave 2:** Medium detail (amplitude 0.25, frequency 2)
- **Octave 3:** Fine detail (amplitude 0.125, frequency 4)
- **Octave 4:** Micro detail (amplitude 0.0625, frequency 8)

Summing octaves creates natural fractal patterns (like clouds, terrain, paper grain).

**Smoothstep interpolation:**

```typescript
const ux = fx * fx * (3 - 2 * fx);  // Hermite smoothstep
```

Creates smooth transitions between noise grid points. `3t² - 2t³` has zero derivative at t=0 and t=1.

---

## Design System Math

### Golden Ratio Spacing

```css
--phi: 1.618;
```

Key spacing values derived from golden ratio:
- `--space-5: 2.5rem` (42.5px) ~ 26 x phi
- `--space-8: 4rem` (68px) ~ 42 x phi
- `--space-12: 6.5rem` (110px) ~ 68 x phi
- `--space-20: 10.5rem` (178px) ~ 110 x phi

Each major step is approximately phi times the previous.

### Typography Scale (Major Third)

```css
ratio = 1.25
```

| Token | Size | Calculation |
|-------|------|-------------|
| text-xs | 0.824rem | 1 / 1.25² |
| text-sm | 0.941rem | 1 / 1.25 |
| text-base | 1rem | base (17px) |
| text-lg | 1.25rem | 1.25¹ |
| text-xl | 1.563rem | 1.25² |
| text-2xl | 1.953rem | 1.25³ |
| text-3xl | 2.441rem | 1.25⁴ |

### Line Height

```css
--leading-normal: 1.618;  /* Golden ratio */
```

Body text uses golden ratio line height for optimal readability.

---

## Deployment

Docker multi-stage build:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
# ... npm install && npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

## License

MIT
