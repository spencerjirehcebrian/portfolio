# Watercolor Effect Background

## Overview

A Three.js-based watercolor shader effect applied to Voronoi cell patterns. Creates a painterly background with Kuwahara filtering, paper texture overlay, and mouse-based reveal interaction.

---

## Core Features

### Implemented
- [x] Voronoi cell background with section-based colors
- [x] Kuwahara filter post-processing (4-quadrant box filter)
- [x] Mouse reveals unfiltered image (Kuwahara fades around cursor)
- [x] Paper texture overlay for authenticity
- [x] Section color transitions (smooth 2s ease-out)
- [x] Saturation boost for vibrant watercolor look
- [x] Vignette effect

### Out of Scope
- Click ripple effects (removed)
- Scroll-driven animations
- Audio reactivity
- Anisotropic Kuwahara
- Edge darkening (removed for performance)

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| 3D Engine | Three.js |
| Build Tool | Vite |
| Language | TypeScript |
| Shaders | Custom GLSL |
| Post-processing | Three.js EffectComposer |

---

## Architecture

```
js/webgl/
├── three-manager.ts          # Three.js renderer, EffectComposer setup
├── scene-controller.ts       # Section transitions, mouse tracking
└── shaders/
    ├── procedural-gradient.ts  # Voronoi cell pattern
    ├── kuwahara.ts             # 4-quadrant filter + mouse reveal
    └── watercolor-enhance.ts   # Paper texture, saturation, vignette
```

---

## Shader Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  SCENE: Fullscreen Quad with Voronoi Material               │
│  ─────────────────────────────────────────────────────────  │
│  • Voronoi cells (3x3 neighborhood, 9 iterations)           │
│  • Cell colors blend section colors via cell ID             │
│  • Subtle time-based cell animation                         │
│  • Vignette                                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PASS 1: RenderPass                                         │
│  ─────────────────────────────────────────────────────────  │
│  • Renders scene to texture for post-processing             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PASS 2: Kuwahara Filter + Mouse Reveal                     │
│  ─────────────────────────────────────────────────────────  │
│  • 4-quadrant box filter (optimized)                        │
│  • 36 texture samples (vs ~440 in 8-sector version)         │
│  • Kernel: 8px (desktop) / 4px (mobile)                     │
│  • Mouse position reveals unfiltered Voronoi                │
│  • Smooth blend at reveal edges                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PASS 3: Watercolor Enhancement                             │
│  ─────────────────────────────────────────────────────────  │
│  • Saturation boost (1.2x)                                  │
│  • Paper texture multiply blend (0.15 strength)             │
│  • Vignette (0.25 strength)                                 │
│  • Output: Final watercolor render to screen                │
└─────────────────────────────────────────────────────────────┘
```

---

## Voronoi Cells

### Algorithm
- 3x3 neighborhood check (9 fixed iterations per pixel)
- Hash function for reproducible cell center positioning
- Animated cell centers via sin() modulation
- Cell ID determines color blend between section colors

### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Scale | 4.0 | Number of cells across viewport |
| Animation | 0.1/s | Cell center movement speed |

---

## Kuwahara Filter (Optimized)

### Algorithm
- 4 quadrants (top-left, top-right, bottom-left, bottom-right)
- Fixed 3x3 sample grid per quadrant (9 samples each)
- Total: 36 texture samples per pixel
- Select quadrant with minimum variance

### Performance vs Original
| Metric | Original (8-sector) | Optimized (4-quadrant) |
|--------|---------------------|------------------------|
| Texture samples | ~440 | 36 |
| Trig calls | ~440 | 0 |
| Gaussian weights | Yes | No |

---

## Mouse Reveal

### Behavior
- Mouse position reveals unfiltered Voronoi through Kuwahara filter
- Creates a "window" showing the raw cell pattern
- Smooth edge transition using smoothstep
- Disabled on mobile

### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Reveal Radius | 0.15 | Size of reveal area (normalized) |
| Reveal Softness | 0.1 | Edge blur amount |
| Aspect Correction | Yes | Circular reveal regardless of viewport |

---

## Section Colors

Colors transition smoothly (2s, ease-out cubic) when scrolling between sections.

| Section | Color 1 (HSL) | Color 2 (HSL) |
|---------|---------------|---------------|
| Hero | (210, 15%, 90%) | (210, 20%, 70%) |
| About | (30, 12%, 88%) | (30, 15%, 75%) |
| Skills | (220, 10%, 85%) | (220, 15%, 70%) |
| Experience | (250, 15%, 88%) | (250, 20%, 75%) |
| Projects | (140, 12%, 85%) | (140, 18%, 72%) |
| Contact | (210, 15%, 90%) | (210, 20%, 70%) |

---

## Performance

### Optimizations Applied
| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Procedural shader | ~750 instructions | ~60 instructions | 92% |
| Kuwahara filter | ~440 texture samples | 36 samples | 92% |
| Watercolor enhance | 10 texture samples | 2 samples | 80% |

### Desktop
- Full 8px Kuwahara kernel
- Mouse reveal enabled
- 60fps target

### Mobile
- Reduced 4px Kuwahara kernel
- Mouse reveal disabled
- Smaller paper texture (256px vs 512px)
- 2x max device pixel ratio cap

### Accessibility
- Respects `prefers-reduced-motion` media query
- Canvas hidden when reduced motion preferred

---

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/three": "^0.170.0"
  }
}
```

---

## Future Enhancements

If extending the effect:

1. **Anisotropic Kuwahara** for brush-direction awareness
2. **Dynamic wet-on-wet bleeding** effects
3. **Multiple filter presets** (oil paint, gouache, ink wash)
4. **Reveal animations** (gradual reveal on page load)
