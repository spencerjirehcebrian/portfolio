/**
 * Watercolor Enhancement Shader
 * Applies final watercolor effects: edge darkening, paper texture, saturation, vignette
 * Respects displacement texture to bypass effects in revealed areas
 */

export const watercolorEnhanceShader = {
  uniforms: {
    tDiffuse: { value: null },
    tPaper: { value: null },
    tDisplacement: { value: null },
    u_resolution: { value: null },
    u_paperStrength: { value: 0.45 },
    u_paperScale: { value: 3.0 },
    u_saturation: { value: 1.5 },
    u_edgeDarkening: { value: 0.4 },
    u_vignetteStrength: { value: 0.25 },
    u_useDisplacement: { value: 1 },
    u_contrast: { value: 1.1 },
    u_skipEdgeDetection: { value: 0 }, // 1 = skip Sobel (saves 8 samples on mobile)
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

    uniform sampler2D tDiffuse;
    uniform sampler2D tPaper;
    uniform sampler2D tDisplacement;
    uniform vec2 u_resolution;
    uniform float u_paperStrength;
    uniform float u_paperScale;
    uniform float u_saturation;
    uniform float u_edgeDarkening;
    uniform float u_vignetteStrength;
    uniform float u_useDisplacement;
    uniform float u_contrast;
    uniform float u_skipEdgeDetection;

    varying vec2 vUv;

    // ============================================
    // SOBEL EDGE DETECTION
    // Note: Adds 8 texture samples per pixel
    // ============================================

    float detectEdges(vec2 uv) {
      vec2 texel = 1.0 / u_resolution;

      // Sample 3x3 neighborhood
      float tl = dot(texture2D(tDiffuse, uv + vec2(-texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float t  = dot(texture2D(tDiffuse, uv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float tr = dot(texture2D(tDiffuse, uv + vec2(texel.x, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float l  = dot(texture2D(tDiffuse, uv + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float r  = dot(texture2D(tDiffuse, uv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float bl = dot(texture2D(tDiffuse, uv + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float b  = dot(texture2D(tDiffuse, uv + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float br = dot(texture2D(tDiffuse, uv + vec2(texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));

      // Sobel operator
      float gx = (tl + 2.0 * l + bl) - (tr + 2.0 * r + br);
      float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);

      return length(vec2(gx, gy));
    }

    // Compute displacement gradient for water refraction
    vec2 getDisplacementGradient(vec2 uv) {
      vec2 texel = 1.0 / u_resolution;
      float left  = texture2D(tDisplacement, uv - vec2(texel.x, 0.0)).r;
      float right = texture2D(tDisplacement, uv + vec2(texel.x, 0.0)).r;
      float up    = texture2D(tDisplacement, uv + vec2(0.0, texel.y)).r;
      float down  = texture2D(tDisplacement, uv - vec2(0.0, texel.y)).r;

      return vec2(right - left, up - down);
    }

    void main() {
      vec2 sampleUV = vUv;
      float effectStrength = 1.0;

      // ============================================
      // INK DISTORTION
      // Apply UV distortion at displacement edges
      // ============================================
      if (u_useDisplacement > 0.5) {
        float height = texture2D(tDisplacement, vUv).r;

        // Get gradient for edge distortion
        vec2 gradient = getDisplacementGradient(vUv);

        // Distort at edges
        float distortStrength = 0.03;
        sampleUV += gradient * distortStrength;

        // Sharp cutoff for effects
        effectStrength = height < -0.1 ? 0.0 : 1.0;
      }

      vec3 color = texture2D(tDiffuse, sampleUV).rgb;
      vec3 originalColor = color;

      // ============================================
      // EDGE DARKENING
      // Simulates paint pooling at boundaries
      // Skip on mobile to save 8 texture samples
      // ============================================
      float edges = 0.0;
      if (u_skipEdgeDetection < 0.5) {
        edges = detectEdges(sampleUV);
      }
      color *= (1.0 - edges * u_edgeDarkening * effectStrength);

      // 1. Saturation boost for vibrant watercolor look
      vec3 gray = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
      color = mix(gray, color, mix(1.0, u_saturation, effectStrength));

      // 2. Paper texture overlay
      vec3 paper = texture2D(tPaper, sampleUV * u_paperScale).rgb;
      color = mix(color, color * paper, u_paperStrength * effectStrength);

      // 3. Vignette for depth
      float vignette = 1.0 - smoothstep(0.5, 1.2, length(vUv - 0.5));
      color *= mix(1.0, vignette, u_vignetteStrength);

      // 4. Contrast adjustment
      color = (color - 0.5) * u_contrast + 0.5;

      // Clamp to valid range
      color = clamp(color, 0.0, 1.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/**
 * Generate a procedural paper texture
 * Returns a DataTexture with grayscale noise pattern
 */
export function generatePaperTexture(
  size: number = 512
): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(size * size * 4); // RGBA

  // Simple hash function for reproducible noise
  const hash = (x: number, y: number): number => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };

  // Smooth noise interpolation
  const smoothNoise = (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);

    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    return a * (1 - ux) * (1 - uy) +
           b * ux * (1 - uy) +
           c * (1 - ux) * uy +
           d * ux * uy;
  };

  // FBM (Fractal Brownian Motion) for natural-looking grain
  const fbm = (x: number, y: number): number => {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;

    for (let i = 0; i < 4; i++) {
      value += amplitude * smoothNoise(x * frequency, y * frequency);
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Generate multi-octave noise for natural grain
      const nx = x / size * 8;
      const ny = y / size * 8;
      const noise = fbm(nx, ny);

      // Map to 0.85-1.0 range for subtle texture (neutral paper)
      const value = Math.floor((noise * 0.15 + 0.85) * 255);

      const idx = (y * size + x) * 4;
      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
  }

  return { data, width: size, height: size };
}
