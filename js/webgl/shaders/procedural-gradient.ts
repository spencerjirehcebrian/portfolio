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
    u_image: { value: null },
    u_imageAspect: { value: 1.0 }, // Dynamically set from loaded texture
    u_useImage: { value: 1 }, // 1 = use image, 0 = use voronoi
    u_isMobile: { value: 0 }, // 1 = mobile (contain mode), 0 = desktop (cover mode)
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
    uniform sampler2D u_image;
    uniform float u_imageAspect;
    uniform int u_useImage;

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

    vec3 getImageColor(vec2 uv) {
      // Image aspect ratio (dynamically set from loaded texture)
      float imageAspect = u_imageAspect;
      float screenAspect = u_resolution.x / u_resolution.y;

      vec2 scale = vec2(1.0);
      vec2 offset = vec2(0.0);

      if (screenAspect > imageAspect) {
        // Screen is wider than image - fit to width, crop top only
        // Apply zoom limit only in landscape to prevent extreme cropping
        float minScale = 0.8;
        scale.y = max(imageAspect / screenAspect, minScale);
        offset.y = 0.0; // Always show bottom of image
      } else {
        // Screen is taller than image - fit to height, crop sides
        // Full cover mode on portrait
        scale.x = screenAspect / imageAspect;
        offset.x = (1.0 - scale.x) * 0.5;
      }

      vec2 imageUv = uv * scale + offset;
      return texture2D(u_image, imageUv).rgb;
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
