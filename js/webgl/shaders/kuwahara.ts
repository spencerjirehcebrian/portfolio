/**
 * Kuwahara Filter Shader (Optimized)
 * 4-quadrant box filter for painterly watercolor effect
 * Optimized: 36 texture samples vs ~440 in original 8-sector version
 * Includes water displacement with sharp edges, dark border, and pile-up effect
 */

export const kuwaharaShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDisplacement: { value: null },
    u_resolution: { value: null },
    u_kernelSize: { value: 8 },
    u_mouse: { value: null },
    u_revealRadius: { value: 0.15 },
    u_revealSoftness: { value: 0.1 },
    u_useDisplacement: { value: 1 },
    u_brightness: { value: 1.4 },
    u_time: { value: 0.0 },
    u_edgeDarkness: { value: 0.4 },     // How dark the water edge shadow is
    u_distortionStrength: { value: 0.06 }, // Refraction intensity at edge
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
    uniform sampler2D tDisplacement;
    uniform vec2 u_resolution;
    uniform int u_kernelSize;
    uniform vec2 u_mouse;
    uniform float u_revealRadius;
    uniform float u_revealSoftness;
    uniform int u_useDisplacement;
    uniform float u_brightness;
    uniform float u_time;
    uniform float u_edgeDarkness;
    uniform float u_distortionStrength;

    varying vec2 vUv;

    // Optimized Kuwahara filter using 4 quadrants with fixed 3x3 samples each
    // Total: 36 texture samples (vs ~440 in 8-sector version)
    vec3 kuwaharaFilter(vec2 uv) {
      vec2 texel = 1.0 / u_resolution;
      float r = float(u_kernelSize);

      vec3 colors[4];
      float vars[4];

      // 4 quadrant directions
      vec2 quadrants[4];
      quadrants[0] = vec2(-1.0, 1.0);   // Top-left
      quadrants[1] = vec2(1.0, 1.0);    // Top-right
      quadrants[2] = vec2(-1.0, -1.0);  // Bottom-left
      quadrants[3] = vec2(1.0, -1.0);   // Bottom-right

      // Process each quadrant
      for (int q = 0; q < 4; q++) {
        vec3 sum = vec3(0.0);
        vec3 sumSq = vec3(0.0);
        vec2 qDir = quadrants[q];

        // Fixed 3x3 grid per quadrant (9 samples each)
        for (int y = 0; y < 3; y++) {
          for (int x = 0; x < 3; x++) {
            vec2 offset = qDir * vec2(float(x), float(y)) * r * 0.33 * texel;
            vec3 s = texture2D(tDiffuse, uv + offset).rgb;
            sum += s;
            sumSq += s * s;
          }
        }

        // Calculate mean and variance
        colors[q] = sum / 9.0;
        vec3 v3 = (sumSq / 9.0) - (colors[q] * colors[q]);
        vars[q] = dot(max(v3, vec3(0.0)), vec3(0.299, 0.587, 0.114));
      }

      // Find minimum variance quadrant
      int minIdx = 0;
      for (int i = 1; i < 4; i++) {
        if (vars[i] < vars[minIdx]) minIdx = i;
      }

      return colors[minIdx];
    }

    // Compute displacement gradient for water refraction effect
    vec2 getDisplacementGradient(vec2 uv) {
      vec2 texel = 1.0 / u_resolution;
      float left  = texture2D(tDisplacement, uv - vec2(texel.x, 0.0)).r;
      float right = texture2D(tDisplacement, uv + vec2(texel.x, 0.0)).r;
      float up    = texture2D(tDisplacement, uv + vec2(0.0, texel.y)).r;
      float down  = texture2D(tDisplacement, uv - vec2(0.0, texel.y)).r;

      return vec2(right - left, up - down);
    }

    void main() {
      vec2 distortedUV = vUv;
      float reveal = 0.0;
      float edgeFactor = 0.0;

      if (u_useDisplacement == 1) {
        vec2 dispData = texture2D(tDisplacement, vUv).rg;
        float height = dispData.r;
        float velocity = dispData.g;

        // Compute gradient for edge detection and distortion
        vec2 gradient = getDisplacementGradient(vUv);
        float gradientMag = length(gradient);

        // Soft reveal based on height with smoothstep transition
        // -0.5 = fully revealed, -0.05 = fully filtered
        reveal = smoothstep(-0.05, -0.5, height);

        // Edge factor: strongest where gradient is high (the "wall" of water)
        // Also incorporate velocity for wave animation
        edgeFactor = smoothstep(0.01, 0.15, gradientMag);

        // Add subtle wave animation to edge using velocity
        float waveOffset = velocity * 2.0;
        edgeFactor *= (1.0 + waveOffset * 0.3);
        edgeFactor = clamp(edgeFactor, 0.0, 1.0);

        // Distortion: apply refraction at the transition zone
        // Scale by gradient magnitude and edge factor for natural look
        float distortAmount = u_distortionStrength * edgeFactor;
        distortedUV += gradient * distortAmount;

      } else {
        // Fallback to circular reveal (mobile or disabled)
        float aspect = u_resolution.x / u_resolution.y;
        vec2 correctedUV = vec2(vUv.x * aspect, vUv.y);
        vec2 correctedMouse = vec2(u_mouse.x * aspect, u_mouse.y);
        float dist = length(correctedUV - correctedMouse);

        reveal = 1.0 - smoothstep(u_revealRadius - u_revealSoftness,
                            u_revealRadius + u_revealSoftness, dist);

        // Simple edge for mobile fallback
        float edgeDist = abs(dist - u_revealRadius);
        edgeFactor = 1.0 - smoothstep(0.0, u_revealSoftness * 2.0, edgeDist);
      }

      // Sample colors with distorted UVs for water refraction effect
      vec3 unfilteredColor = texture2D(tDiffuse, distortedUV).rgb;
      vec3 filteredColor = kuwaharaFilter(distortedUV);

      // Apply brightness boost to filtered areas
      filteredColor *= u_brightness;

      // Combine: reveal unfiltered where displaced, show filtered elsewhere
      vec3 finalColor = mix(filteredColor, unfilteredColor, reveal);

      // Apply darkened edge (shadow of the water wall)
      // Darken most at the edge transition zone
      float darkness = edgeFactor * u_edgeDarkness * (1.0 - reveal * 0.5);
      finalColor *= (1.0 - darkness);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};
