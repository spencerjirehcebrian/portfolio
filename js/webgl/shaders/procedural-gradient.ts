/**
 * Procedural/Image Shader
 * Supports both Voronoi cells and image texture for testing
 * Toggle USE_IMAGE to switch between modes
 */

export const proceduralGradientShader = {
  uniforms: {
    u_time: { value: 0.0 },
    u_resolution: { value: null },
    u_color1: { value: null },
    u_color2: { value: null },
    u_imageCurrent: { value: null },
    u_imageNext: { value: null },
    u_imageAspect: { value: 1.0 }, // Dynamically set from loaded texture
    u_useImage: { value: 1 }, // 1 = use image, 0 = use voronoi
    u_isMobile: { value: 0 }, // 1 = mobile (contain mode), 0 = desktop (cover mode)
    u_washProgress: { value: 0.0 }, // Crossfade between paintings
    u_washAngle: { value: 0.0 }, // Random angle for wash direction
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

    varying vec2 vUv;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform sampler2D u_imageCurrent;
    uniform sampler2D u_imageNext;
    uniform float u_imageAspect;
    uniform int u_useImage;
    uniform float u_washProgress;
    uniform float u_washAngle;

    // ============================================
    // VORONOI CODE (comment/uncomment to toggle)
    // ============================================

    // Hash function for cell center positioning
    vec2 hash2(vec2 p) {
      return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
      )) * 43758.5453);
    }

    // Voronoi with smooth blending
    vec3 voronoi(vec2 uv, float time) {
      vec2 n = floor(uv);
      vec2 f = fract(uv);

      float minDist = 8.0;
      float secondDist = 8.0;
      vec2 closestCell = vec2(0.0);

      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 neighbor = vec2(float(i), float(j));
          vec2 cellPos = n + neighbor;
          vec2 point = hash2(cellPos);
          point = 0.5 + 0.4 * sin(time * 0.1 + 6.2831 * point);

          vec2 diff = neighbor + point - f;
          float dist = dot(diff, diff);

          if (dist < minDist) {
            secondDist = minDist;
            minDist = dist;
            closestCell = cellPos;
          } else if (dist < secondDist) {
            secondDist = dist;
          }
        }
      }

      float edgeBlend = secondDist - minDist;
      float cellId = fract(sin(dot(closestCell, vec2(12.9898, 78.233))) * 43758.5453);

      return vec3(sqrt(minDist), edgeBlend, cellId);
    }

    vec3 getVoronoiColor(vec2 uv) {
      float scale = 4.0;
      vec3 vor = voronoi(uv * scale, u_time);

      float blend = vor.z + (vor.y - 0.3) * 0.2;
      blend = clamp(blend, 0.0, 1.0);

      return mix(u_color1, u_color2, blend);
    }

    // ============================================
    // IMAGE CODE
    // ============================================

    vec2 getImageUV(vec2 uv) {
      // Image aspect ratio (dynamically set from loaded texture)
      float imageAspect = u_imageAspect;
      float screenAspect = u_resolution.x / u_resolution.y;

      vec2 scale = vec2(1.0);
      vec2 offset = vec2(0.0);

      if (screenAspect > imageAspect) {
        // Screen is wider than image - fit to width, crop top only
        float minScale = 0.8;
        scale.y = max(imageAspect / screenAspect, minScale);
        offset.y = 0.0;
      } else {
        // Screen is taller than image - fit to height, crop sides
        scale.x = screenAspect / imageAspect;
        offset.x = (1.0 - scale.x) * 0.5;
      }

      return uv * scale + offset;
    }

    // Organic noise for watercolor edge
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbmNoise(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    vec3 getImageColor(vec2 uv) {
      vec2 imageUv = getImageUV(uv);
      vec3 currentColor = texture2D(u_imageCurrent, imageUv).rgb;

      // Paint wash transition - organic watercolor bleed
      if (u_washProgress > 0.0) {
        vec3 nextColor = texture2D(u_imageNext, imageUv).rgb;

        // Ease the progress for smoother timing
        float progress = u_washProgress * u_washProgress * (3.0 - 2.0 * u_washProgress);

        // Rotate UV based on wash angle for varied sweep directions
        vec2 center = vec2(0.5);
        vec2 rotatedUV = uv - center;
        float c = cos(u_washAngle);
        float s = sin(u_washAngle);
        rotatedUV = vec2(rotatedUV.x * c - rotatedUV.y * s,
                         rotatedUV.x * s + rotatedUV.y * c);
        rotatedUV += center;

        // Jagged organic edge with layered noise
        float largeNoise = fbmNoise(rotatedUV * vec2(1.5, 3.0)) * 0.25;
        float mediumNoise = fbmNoise(rotatedUV * vec2(4.0, 8.0) + 100.0) * 0.12;
        float fineNoise = noise(rotatedUV * 20.0) * 0.04;
        float totalNoise = largeNoise + mediumNoise + fineNoise;

        // Extended sweep range to ensure full coverage with noise
        // Starts at -0.8, ends at 1.8 to cover corners on any angle
        float sweepPos = progress * 2.6 - 0.8;
        float edge = rotatedUV.x - sweepPos + totalNoise;

        // Wide, soft feathered edge
        float featherWidth = 0.15;
        float mask = smoothstep(-featherWidth, featherWidth, edge);

        // Gentle blend
        return mix(nextColor, currentColor, mask);
      }

      return currentColor;
    }

    // ============================================
    // MAIN
    // ============================================

    void main() {
      vec2 uv = vUv;
      vec3 color;

      if (u_useImage == 1) {
        color = getImageColor(uv);
      } else {
        color = getVoronoiColor(uv);
      }

      // Subtle vignette for depth
      float vignette = 1.0 - length(uv - 0.5) * 0.3;
      color *= vignette;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
