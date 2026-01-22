# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start Vite dev server on port 8000 with HMR
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run package  # Build + create tar.gz archive for deployment
```

## Architecture

This is a portfolio website built with vanilla TypeScript, Vite, and Three.js. No frontend framework (React/Vue/etc).

### Project Structure

```
js/
├── main.ts                    # Entry point, Portfolio class orchestrator
└── webgl/
    ├── three-manager.ts       # Three.js renderer, EffectComposer, uniforms
    ├── scene-controller.ts    # Section detection, mouse tracking, color transitions
    └── shaders/               # GLSL shaders as TypeScript modules
        ├── procedural-gradient.ts   # Voronoi cell generation
        ├── kuwahara.ts              # 4-quadrant painterly filter + mouse reveal
        ├── watercolor-enhance.ts    # Paper texture, saturation boost
        └── displacement.ts          # Water wave dynamics (ping-pong buffers)

css/
├── main.css           # Import orchestration using @layer
├── design-tokens.css  # Golden ratio-based spacing/sizing (phi = 1.618)
├── typography.css     # Cormorant Garamond, Major Third scale (1.25)
├── layout.css         # Framed asymmetric grid system
└── ...                # Additional modular CSS files
```

### WebGL Pipeline

The background uses a Three.js post-processing pipeline:

1. **Scene**: Fullscreen quad with procedural Voronoi material
2. **Pass 1**: RenderPass - renders scene to texture
3. **Pass 2**: Kuwahara filter (36 samples) with mouse reveal
4. **Pass 3**: Watercolor enhancement (paper texture, saturation, vignette)

Desktop uses 8px Kuwahara kernel; mobile uses 4px with mouse effects disabled.

### Key Classes

- **Portfolio** (`main.ts`): Top-level orchestrator, initializes WebGL, navigation, animations
- **ThreeManager** (`three-manager.ts`): Manages renderer, EffectComposer pipeline, displacement ping-pong buffers
- **SceneController** (`scene-controller.ts`): Intersection Observer for sections, color transitions (2s ease-out), mouse position easing

### CSS Architecture

Uses `@layer` for cascade control:
- Foundation: tokens -> reset -> typography -> layout
- Components: components
- Enhancement: animations -> utilities -> dark-mode

Design system based on golden ratio (1.618) for spacing and Major Third (1.25) for typography scale.

## Shader Conventions

Shaders are TypeScript modules exporting `{ vertexShader, fragmentShader }` objects with GLSL template strings. Each shader has centralized uniform definitions at the top.

## Deployment

Docker multi-stage build: Node.js builder -> Nginx Alpine serving from `/usr/share/nginx/html`.

