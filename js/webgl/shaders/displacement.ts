/**
 * Displacement Field Shader - Ink Diffusion + Wave Equation
 * Creates fluid displacement like ink in water with ripple dynamics
 * Sharp edges that diffuse inward from boundaries
 *
 * R channel: height (displacement amount)
 * G channel: velocity (for wave equation)
 */

export const displacementShader = {
  uniforms: {
    tPrevState: { value: null },
    u_mouse: { value: null },
    u_prevMouse: { value: null },
    u_brushSize: { value: 0.035 },
    u_expandRate: { value: 0.4 },      // How fast displacement spreads outward
    u_fillRate: { value: 0.08 },       // How fast edges fill in (slower than expand)
    u_waveSpeed: { value: 0.2 },       // Wave propagation speed (c²)
    u_waveDamping: { value: 0.95 },    // Wave energy decay per frame
    u_isActive: { value: 0.0 },
    u_moveIntensity: { value: 0.0 },   // Smoothed mouse movement (0-1)
    u_resolution: { value: null },
    u_texelSize: { value: null },
    u_time: { value: 0.0 },
    u_imageAspect: { value: 1.0 },     // Image aspect ratio for coordinate alignment
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tPrevState;
    uniform vec2 u_mouse;
    uniform vec2 u_prevMouse;
    uniform float u_brushSize;
    uniform float u_expandRate;
    uniform float u_fillRate;
    uniform float u_waveSpeed;
    uniform float u_waveDamping;
    uniform float u_isActive;
    uniform float u_moveIntensity;
    uniform vec2 u_resolution;
    uniform vec2 u_texelSize;
    uniform float u_time;
    uniform float u_imageAspect;

    varying vec2 vUv;

    // Transform screen UV to image UV (matches procedural-gradient.ts getImageUV)
    // Returns the UV and the scale factors used for the transformation
    vec2 getImageUV(vec2 uv, out vec2 scale) {
      float screenAspect = u_resolution.x / u_resolution.y;
      scale = vec2(1.0);
      vec2 offset = vec2(0.0);

      if (screenAspect > u_imageAspect) {
        // Screen wider - fit to width, crop top
        float minScale = 0.8;
        scale.y = max(u_imageAspect / screenAspect, minScale);
        offset.y = 0.0;
      } else {
        // Screen taller - fit to height, crop sides
        scale.x = screenAspect / u_imageAspect;
        offset.x = (1.0 - scale.x) * 0.5;
      }

      return uv * scale + offset;
    }

    void main() {
      vec2 prevState = texture2D(tPrevState, vUv).rg;
      float height = prevState.r;
      float velocity = prevState.g;

      // Fast rotation for organic fluid feel
      float rot = u_time * 1.5;

      // Sample 8 neighbors in a rotating circular pattern (wider radius)
      float sampleRadius = 2.0;
      float minNeighbor = 0.0;
      float maxNeighbor = -1.0;

      for (int i = 0; i < 8; i++) {
        float angle = float(i) * 0.785398 + rot;
        vec2 offset = vec2(cos(angle), sin(angle)) * u_texelSize * sampleRadius;
        float n = texture2D(tPrevState, vUv + offset).r;
        minNeighbor = min(minNeighbor, n);
        maxNeighbor = max(maxNeighbor, n);
      }

      // ========== WAVE EQUATION (Laplacian) ==========
      float left  = texture2D(tPrevState, vUv - vec2(u_texelSize.x, 0.0)).r;
      float right = texture2D(tPrevState, vUv + vec2(u_texelSize.x, 0.0)).r;
      float up    = texture2D(tPrevState, vUv + vec2(0.0, u_texelSize.y)).r;
      float down  = texture2D(tPrevState, vUv - vec2(0.0, u_texelSize.y)).r;

      float laplacian = (left + right + up + down - 4.0 * height);

      // Wave equation with damping
      velocity += laplacian * u_waveSpeed;
      velocity *= u_waveDamping;
      height += velocity * 0.2;

      // EXPANSION: scales with smoothed movement intensity
      if (minNeighbor < -0.15 && minNeighbor < height) {
        float targetHeight = minNeighbor * 0.92;
        float expandAmount = u_expandRate * u_moveIntensity;
        height = mix(height, targetHeight, expandAmount);
      }

      // COLLAPSE: always active, fill from edges toward zero
      if (maxNeighbor > height) {
        height = mix(height, maxNeighbor, u_fillRate);
      }

      // Decay velocity as system settles
      if (height > -0.15) {
        velocity *= 0.85;
      }

      // Mouse interaction - smooth circle with soft edge
      // Uses image-space coordinates so brush aligns with image content
      if (u_isActive > 0.5) {
        vec2 scale;
        vec2 imageUV = getImageUV(vUv, scale);
        vec2 imageMouse = getImageUV(u_mouse, scale);

        // Calculate distance in image space, corrected for aspect ratio
        // This keeps the brush circular on screen while positioning in image space
        float screenAspect = u_resolution.x / u_resolution.y;
        vec2 delta = (imageUV - imageMouse) / scale;
        vec2 correctedDelta = vec2(delta.x * screenAspect, delta.y);
        float dist = length(correctedDelta);

        // Smooth falloff for anti-aliased circle
        float softness = 0.015;
        float brush = 1.0 - smoothstep(u_brushSize - softness, u_brushSize + softness, dist);

        if (brush > 0.0) {
          height = mix(height, -1.0, brush);
          velocity = mix(velocity, 0.0, brush);
        }
      }

      // Clamp
      height = clamp(height, -1.0, 0.0);
      velocity = clamp(velocity, -0.2, 0.2);

      gl_FragColor = vec4(height, velocity, 0.0, 1.0);
    }
  `,
};
