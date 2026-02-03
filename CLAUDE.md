# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start Vite dev server on port 8000 with HMR
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run package  # Build + create tar.gz archive for deployment
```

Do not run `npm run dev`. Assume it is already running in a separate terminal.

## Architecture

Portfolio website built with vanilla TypeScript, Vite, and Three.js. No frontend framework.

### Project Structure

```
js/
├── main.ts                    # Entry point, Portfolio class orchestrator
└── webgl/
    ├── three-manager.ts       # Three.js renderer, EffectComposer, painting textures
    ├── scene-controller.ts    # Mouse tracking, idle detection, painting transitions
    └── shaders/
        ├── procedural-gradient.ts   # Background source (painting texture or Voronoi fallback)
        ├── kuwahara.ts              # 4-quadrant painterly filter + displacement reveal
        ├── watercolor-enhance.ts    # Paper texture, Sobel edges, saturation, vignette
        └── displacement.ts          # Wave equation simulation (ping-pong buffers)

css/
├── main.css           # @layer import orchestration
├── design-tokens.css  # Golden ratio spacing (phi = 1.618)
├── typography.css     # Cormorant Garamond, Major Third scale (1.25)
├── layout.css         # Framed asymmetric grid system
├── components.css     # UI component styles
├── animations.css     # Reveal animations, transitions
└── utilities.css      # Helper classes
```

### WebGL Pipeline

Three.js post-processing chain for watercolor effect:

1. **RenderPass** - Renders fullscreen quad with painting texture
2. **Kuwahara Pass** - 4-quadrant painterly filter (36 samples), displacement-based mouse reveal
3. **Watercolor Pass** - Paper texture overlay, Sobel edge darkening, saturation, vignette

Desktop: 8px Kuwahara kernel, ping-pong displacement buffers for water ripple simulation.
Mobile: 4px kernel, displacement/mouse effects disabled.

### Painting System

- `PAINTINGS` array in `three-manager.ts` contains metadata (title, artist, URL)
- First painting loads synchronously for fast initial render
- Remaining paintings load in background after UI reveal (desktop only)
- Idle timeout (15s) triggers watercolor wash transition to next painting
- `paintingchange` CustomEvent broadcasts transitions for UI attribution display

### CSS Architecture

Uses `@layer` cascade: tokens -> reset -> typography -> layout -> components -> animations -> utilities -> dark-mode

Design tokens: Golden ratio (1.618) spacing, Major Third (1.25) typography scale.

## Shader Conventions

Shaders export `{ vertexShader, fragmentShader }` with GLSL template strings. Uniforms defined at top of each shader. Ping-pong buffering used for displacement simulation.

## Deployment

Docker multi-stage: Node.js 20 Alpine builder -> Nginx Alpine. See `Dockerfile` and `nginx.conf`.

