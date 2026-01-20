/**
 * Displacement Field Shader - Ink Diffusion Model
 * Creates fluid displacement like ink in water
 * Sharp edges that diffuse inward from boundaries
 *
 * R channel: displacement amount
 */

export const displacementShader = {
  uniforms: {
    tPrevState: { value: null },
    u_mouse: { value: null },
    u_prevMouse: { value: null },
    u_brushSize: { value: 0.05 },
    u_expandRate: { value: 0.4 },      // How fast displacement spreads outward
    u_fillRate: { value: 0.08 },       // How fast edges fill in (slower than expand)
    u_isActive: { value: 0.0 },
    u_moveIntensity: { value: 0.0 },   // Smoothed mouse movement (0-1)
    u_resolution: { value: null },
    u_texelSize: { value: null },
    u_time: { value: 0.0 },
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
    uniform float u_isActive;
    uniform float u_moveIntensity;
    uniform vec2 u_resolution;
    uniform vec2 u_texelSize;
    uniform float u_time;

    varying vec2 vUv;

    void main() {
      float height = texture2D(tPrevState, vUv).r;

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

      // Mouse interaction - sharp edge
      if (u_isActive > 0.5) {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 correctedUV = vec2(vUv.x * aspect, vUv.y);
        vec2 correctedMouse = vec2(u_mouse.x * aspect, u_mouse.y);
        float dist = length(correctedUV - correctedMouse);

        // Sharp circle
        if (dist < u_brushSize) {
          height = -1.0;
        }
      }

      // Clamp
      height = clamp(height, -1.0, 0.0);

      gl_FragColor = vec4(height, 0.0, 0.0, 1.0);
    }
  `,
};
