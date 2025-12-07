/**
 * Dithering Shader
 * 8x8 Bayer matrix ordered dithering for refined minimalist aesthetic
 */

// Vertex Shader - simple pass-through
export const vertexShaderSource = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment Shader - 8x8 Bayer matrix dithering
export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Uniforms
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec3 u_color1;  // Start color
uniform vec3 u_color2;  // End color
uniform float u_transition; // Transition progress between sections
uniform float u_coarseLevels;
uniform float u_fineLevels;

// Ripple uniforms (x, y, age, intensity)
uniform vec4 u_ripple0;
uniform vec4 u_ripple1;
uniform vec4 u_ripple2;
uniform vec4 u_ripple3;
uniform vec4 u_ripple4;

// 8x8 Bayer matrix for ordered dithering
const mat4 bayerMatrix0 = mat4(
   0.0, 32.0,  8.0, 40.0,
  48.0, 16.0, 56.0, 24.0,
  12.0, 44.0,  4.0, 36.0,
  60.0, 28.0, 52.0, 20.0
);

const mat4 bayerMatrix1 = mat4(
   3.0, 35.0, 11.0, 43.0,
  51.0, 19.0, 59.0, 27.0,
  15.0, 47.0,  7.0, 39.0,
  63.0, 31.0, 55.0, 23.0
);

// Get Bayer matrix value for given position
float getBayerValue(vec2 pos) {
  int x = int(mod(pos.x, 8.0));
  int y = int(mod(pos.y, 8.0));

  // Access the appropriate matrix value
  int matrixIndex = x / 4;
  int col = x % 4;
  int row = y % 4;

  mat4 matrix = (matrixIndex == 0) ? bayerMatrix0 : bayerMatrix1;

  // Return the value at the specified row and column
  if (row == 0) {
    if (col == 0) return matrix[0][0];
    if (col == 1) return matrix[0][1];
    if (col == 2) return matrix[0][2];
    if (col == 3) return matrix[0][3];
  } else if (row == 1) {
    if (col == 0) return matrix[1][0];
    if (col == 1) return matrix[1][1];
    if (col == 2) return matrix[1][2];
    if (col == 3) return matrix[1][3];
  } else if (row == 2) {
    if (col == 0) return matrix[2][0];
    if (col == 1) return matrix[2][1];
    if (col == 2) return matrix[2][2];
    if (col == 3) return matrix[2][3];
  } else {
    if (col == 0) return matrix[3][0];
    if (col == 1) return matrix[3][1];
    if (col == 2) return matrix[3][2];
    if (col == 3) return matrix[3][3];
  }

  return 0.0;
}

// Get Bayer value with scale multiplier for texture variation
float getBayerValueScaled(vec2 pos, float scale) {
  vec2 scaledPos = pos / scale;
  int x = int(mod(scaledPos.x, 8.0));
  int y = int(mod(scaledPos.y, 8.0));

  // Access the appropriate matrix value
  int matrixIndex = x / 4;
  int col = x % 4;
  int row = y % 4;

  mat4 matrix = (matrixIndex == 0) ? bayerMatrix0 : bayerMatrix1;

  // Return the value at the specified row and column
  if (row == 0) {
    if (col == 0) return matrix[0][0];
    if (col == 1) return matrix[0][1];
    if (col == 2) return matrix[0][2];
    if (col == 3) return matrix[0][3];
  } else if (row == 1) {
    if (col == 0) return matrix[1][0];
    if (col == 1) return matrix[1][1];
    if (col == 2) return matrix[1][2];
    if (col == 3) return matrix[1][3];
  } else if (row == 2) {
    if (col == 0) return matrix[2][0];
    if (col == 1) return matrix[2][1];
    if (col == 2) return matrix[2][2];
    if (col == 3) return matrix[2][3];
  } else {
    if (col == 0) return matrix[3][0];
    if (col == 1) return matrix[3][1];
    if (col == 2) return matrix[3][2];
    if (col == 3) return matrix[3][3];
  }

  return 0.0;
}

// Apply layered dithering with posterization and animation
float ditherLayered(vec2 position, float brightness, float levels, float scale, float timeOffset) {
  // Animate the threshold with breathing effect (slower, greater amplitude)
  float breathe = sin(u_time * 0.15 + timeOffset) * 1.2;
  float animatedLevels = levels + breathe;

  float bayerValue = getBayerValueScaled(position, scale) / 64.0;

  // Quantize brightness into discrete levels
  float posterized = floor(brightness * animatedLevels) / animatedLevels;
  float nextLevel = ceil(brightness * animatedLevels) / animatedLevels;

  // Get the fractional part to determine dithering threshold
  float levelFraction = fract(brightness * animatedLevels);

  // Apply dithering at level boundaries
  return (levelFraction > bayerValue) ? nextLevel : posterized;
}

// Smooth noise function for organic gradient
float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Smooth interpolation
float smoothNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);

  float a = noise(i);
  float b = noise(i + vec2(1.0, 0.0));
  float c = noise(i + vec2(0.0, 1.0));
  float d = noise(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

// Fractal Brownian Motion for layered noise (more random)
float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 5; i++) {
    value += amplitude * smoothNoise(st * frequency);
    frequency *= 2.3; // Higher lacunarity for more variation
    amplitude *= 0.55; // Adjusted gain for stronger high frequencies
  }

  return value;
}

// Mouse position color influence - smooth color shift around cursor
float getMouseColorInfluence(vec2 uv, vec2 mousePos) {
  // Apply aspect ratio correction for circular effect
  float aspect = u_resolution.x / u_resolution.y;
  vec2 correctedUV = vec2(uv.x * aspect, uv.y);
  vec2 correctedMousePos = vec2(mousePos.x * aspect, mousePos.y);

  vec2 diff = correctedUV - correctedMousePos;
  float dist = length(diff);

  // Add gentle organic noise distortion
  float noiseDistortion = fbm(uv * 10.0 + u_time * 0.1) * 0.03;
  dist += noiseDistortion;

  // Smaller, tighter radius
  float influence = smoothstep(0.18, 0.0, dist);

  // Add subtle variation to the influence
  float noiseVariation = fbm(uv * 15.0 + u_time * 0.05) * 0.1;
  influence *= (1.0 - noiseVariation);

  // Slower, more gentle pulsing
  float pulse = 0.5 + 0.5 * sin(u_time * 0.3);
  influence *= (0.85 + 0.15 * pulse);

  return influence;
}

// Click ripple effect - organic expanding color change with dark border
float getClickRippleColor(vec2 uv, vec4 ripple) {
  if (ripple.w <= 0.0) return 0.0; // Inactive ripple

  vec2 ripplePos = ripple.xy;
  float age = ripple.z;
  float intensity = ripple.w;

  // Apply aspect ratio correction for circular ripples
  float aspect = u_resolution.x / u_resolution.y;
  vec2 correctedUV = vec2(uv.x * aspect, uv.y);
  vec2 correctedRipplePos = vec2(ripplePos.x * aspect, ripplePos.y);

  vec2 diff = correctedUV - correctedRipplePos;
  float dist = length(diff);

  // Add organic noise distortion to make it non-circular
  float noiseDistortion = fbm(uv * 8.0 + age * 2.0) * 0.08;
  dist += noiseDistortion;

  // Ease-out expansion: fast start, gentle end
  float easedAge = 1.0 - pow(1.0 - age, 3.0); // Cubic ease-out
  float maxRadius = easedAge * 0.5; // Larger final radius

  // Core light influence
  float coreInfluence = smoothstep(maxRadius, maxRadius * 0.4, dist);

  // Dark border at the edge
  float borderStart = maxRadius * 0.85;
  float borderEnd = maxRadius * 1.1;
  float borderInfluence = smoothstep(borderStart, borderEnd, dist) - smoothstep(borderEnd, borderEnd * 1.15, dist);

  // Combine: positive for light, negative for dark border
  float influence = coreInfluence - (borderInfluence * 0.8);

  // Add subtle dithering variation to the influence
  float ditherNoise = fbm(uv * 12.0) * 0.15;
  influence *= (1.0 - ditherNoise);

  // Very slow, gentle fade out
  float fade = 1.0 - pow(age, 4.0); // Quartic fade for very long lingering

  return influence * fade * intensity;
}

void main() {
  // Normalize coordinates
  vec2 uv = v_uv;
  vec2 pixelPos = gl_FragCoord.xy;

  // Mouse influence (subtle parallax effect)
  vec2 mouseOffset = (u_mouse - 0.5) * 0.02; // Very subtle, 2% movement
  uv += mouseOffset;

  // Calculate mouse color influence (no distortion)
  float mouseInfluence = getMouseColorInfluence(uv, u_mouse);

  // Calculate click ripple color influences (no distortion)
  float clickInfluence = getClickRippleColor(uv, u_ripple0) +
                         getClickRippleColor(uv, u_ripple1) +
                         getClickRippleColor(uv, u_ripple2) +
                         getClickRippleColor(uv, u_ripple3) +
                         getClickRippleColor(uv, u_ripple4);

  // Create gradient with noise
  // Vertical gradient influenced by mouse position
  float gradient = uv.y + mouseOffset.y * 2.0;

  // Add subtle noise for organic feel
  float noiseValue = fbm(uv * 3.0 + u_time * 0.05) * 0.15;
  gradient += noiseValue;

  // Add slight horizontal variation
  gradient += (uv.x - 0.5) * 0.1;

  // Clamp gradient to 0-1 range
  gradient = clamp(gradient, 0.0, 1.0);

  // Interpolate between two colors
  vec3 color = mix(u_color1, u_color2, gradient);

  // Combine mouse and click influences (can be negative for dark borders)
  float totalInfluence = mouseInfluence + clickInfluence;

  // Apply color influence (brighten for positive, darken for negative)
  if (totalInfluence > 0.0) {
    // Brighten - subtle glow
    color = mix(color, color * 1.3, min(totalInfluence, 1.0) * 0.4);
  } else {
    // Darken for negative influence (border)
    color = mix(color, color * 0.5, min(abs(totalInfluence), 1.0) * 0.5);
  }

  // Convert to grayscale for dithering
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));

  // Layer 1: Coarse posterization (bold structure) - use uniform
  float coarseDither = ditherLayered(pixelPos, luminance, u_coarseLevels, 1.5, 0.0);

  // Layer 2: Fine texture (subtle detail) - use uniform
  float fineDither = ditherLayered(pixelPos, luminance, u_fineLevels, 2.0, 1.57);

  // Blend layers: 70% coarse, 30% fine for balanced depth
  float blendedLuminance = mix(coarseDither, fineDither, 0.3);

  // Reconstruct color with layered dithering
  vec3 finalColor = color * (blendedLuminance / max(luminance, 0.001));

  // Subtle vignette for depth
  float vignette = 1.0 - length(uv - 0.5) * 0.3;
  finalColor *= vignette;

  fragColor = vec4(finalColor, 1.0);
}
`;

// Simplified mobile shader (4x4 Bayer matrix for better performance)
export const fragmentShaderSourceMobile = `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_time;
uniform float u_coarseLevels;
uniform float u_fineLevels;

// Simplified 4x4 Bayer matrix
const mat4 bayerMatrix = mat4(
   0.0, 12.0,  3.0, 15.0,
   8.0,  4.0, 11.0,  7.0,
   2.0, 14.0,  1.0, 13.0,
  10.0,  6.0,  9.0,  5.0
);

float getBayerValue(vec2 pos) {
  int x = int(mod(pos.x, 4.0));
  int y = int(mod(pos.y, 4.0));

  if (y == 0) {
    if (x == 0) return bayerMatrix[0][0];
    if (x == 1) return bayerMatrix[0][1];
    if (x == 2) return bayerMatrix[0][2];
    return bayerMatrix[0][3];
  } else if (y == 1) {
    if (x == 0) return bayerMatrix[1][0];
    if (x == 1) return bayerMatrix[1][1];
    if (x == 2) return bayerMatrix[1][2];
    return bayerMatrix[1][3];
  } else if (y == 2) {
    if (x == 0) return bayerMatrix[2][0];
    if (x == 1) return bayerMatrix[2][1];
    if (x == 2) return bayerMatrix[2][2];
    return bayerMatrix[2][3];
  } else {
    if (x == 0) return bayerMatrix[3][0];
    if (x == 1) return bayerMatrix[3][1];
    if (x == 2) return bayerMatrix[3][2];
    return bayerMatrix[3][3];
  }
}

// Mobile layered dithering with breathing animation (same as desktop)
float ditherLayeredMobile(vec2 position, float brightness, float levels, float timeOffset) {
  // Animate the threshold with breathing effect (same as desktop)
  float breathe = sin(u_time * 0.15 + timeOffset) * 1.2;
  float animatedLevels = levels + breathe;

  float bayerValue = getBayerValue(position) / 16.0;

  // Quantize brightness into discrete levels
  float posterized = floor(brightness * animatedLevels) / animatedLevels;
  float nextLevel = ceil(brightness * animatedLevels) / animatedLevels;

  // Get the fractional part to determine dithering threshold
  float levelFraction = fract(brightness * animatedLevels);

  // Apply dithering at level boundaries
  return (levelFraction > bayerValue) ? nextLevel : posterized;
}

void main() {
  vec2 uv = v_uv;
  vec2 pixelPos = gl_FragCoord.xy;

  // Simple vertical gradient
  float gradient = uv.y;

  // Interpolate colors
  vec3 color = mix(u_color1, u_color2, gradient);

  // Convert to grayscale
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));

  // Layer 1: Coarse posterization (use uniform value)
  float coarseDither = ditherLayeredMobile(pixelPos, luminance, u_coarseLevels, 0.0);

  // Layer 2: Fine texture (use uniform value, different timeOffset)
  float fineDither = ditherLayeredMobile(pixelPos, luminance, u_fineLevels, 1.57);

  // Blend layers: 70% coarse, 30% fine
  float blendedLuminance = mix(coarseDither, fineDither, 0.3);

  vec3 finalColor = color * (blendedLuminance / max(luminance, 0.001));

  fragColor = vec4(finalColor, 1.0);
}
`;

// WebGL 1.0 Vertex Shader (GLSL ES 1.0)
export const vertexShaderSourceWebGL1 = `
precision highp float;

attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// WebGL 1.0 Fragment Shader - Desktop (GLSL ES 1.0)
export const fragmentShaderSourceWebGL1 = `
precision highp float;

varying vec2 v_uv;

// Uniforms
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_transition;
uniform float u_coarseLevels;
uniform float u_fineLevels;

// Ripple uniforms
uniform vec4 u_ripple0;
uniform vec4 u_ripple1;
uniform vec4 u_ripple2;
uniform vec4 u_ripple3;
uniform vec4 u_ripple4;

// 8x8 Bayer matrix for ordered dithering
const mat4 bayerMatrix0 = mat4(
   0.0, 32.0,  8.0, 40.0,
  48.0, 16.0, 56.0, 24.0,
  12.0, 44.0,  4.0, 36.0,
  60.0, 28.0, 52.0, 20.0
);

const mat4 bayerMatrix1 = mat4(
   3.0, 35.0, 11.0, 43.0,
  51.0, 19.0, 59.0, 27.0,
  15.0, 47.0,  7.0, 39.0,
  63.0, 31.0, 55.0, 23.0
);

// Get Bayer matrix value for given position
float getBayerValue(vec2 pos) {
  int x = int(mod(pos.x, 8.0));
  int y = int(mod(pos.y, 8.0));

  // Access the appropriate matrix value
  int matrixIndex = x / 4;
  int col = x % 4;
  int row = y % 4;

  mat4 matrix = (matrixIndex == 0) ? bayerMatrix0 : bayerMatrix1;

  // Return the value at the specified row and column
  if (row == 0) {
    if (col == 0) return matrix[0][0];
    if (col == 1) return matrix[0][1];
    if (col == 2) return matrix[0][2];
    if (col == 3) return matrix[0][3];
  } else if (row == 1) {
    if (col == 0) return matrix[1][0];
    if (col == 1) return matrix[1][1];
    if (col == 2) return matrix[1][2];
    if (col == 3) return matrix[1][3];
  } else if (row == 2) {
    if (col == 0) return matrix[2][0];
    if (col == 1) return matrix[2][1];
    if (col == 2) return matrix[2][2];
    if (col == 3) return matrix[2][3];
  } else {
    if (col == 0) return matrix[3][0];
    if (col == 1) return matrix[3][1];
    if (col == 2) return matrix[3][2];
    if (col == 3) return matrix[3][3];
  }

  return 0.0;
}

// Get Bayer value with scale multiplier for texture variation
float getBayerValueScaled(vec2 pos, float scale) {
  vec2 scaledPos = pos / scale;
  int x = int(mod(scaledPos.x, 8.0));
  int y = int(mod(scaledPos.y, 8.0));

  // Access the appropriate matrix value
  int matrixIndex = x / 4;
  int col = x % 4;
  int row = y % 4;

  mat4 matrix = (matrixIndex == 0) ? bayerMatrix0 : bayerMatrix1;

  // Return the value at the specified row and column
  if (row == 0) {
    if (col == 0) return matrix[0][0];
    if (col == 1) return matrix[0][1];
    if (col == 2) return matrix[0][2];
    if (col == 3) return matrix[0][3];
  } else if (row == 1) {
    if (col == 0) return matrix[1][0];
    if (col == 1) return matrix[1][1];
    if (col == 2) return matrix[1][2];
    if (col == 3) return matrix[1][3];
  } else if (row == 2) {
    if (col == 0) return matrix[2][0];
    if (col == 1) return matrix[2][1];
    if (col == 2) return matrix[2][2];
    if (col == 3) return matrix[2][3];
  } else {
    if (col == 0) return matrix[3][0];
    if (col == 1) return matrix[3][1];
    if (col == 2) return matrix[3][2];
    if (col == 3) return matrix[3][3];
  }

  return 0.0;
}

// Apply layered dithering with posterization and animation
float ditherLayered(vec2 position, float brightness, float levels, float scale, float timeOffset) {
  // Animate the threshold with breathing effect (slower, greater amplitude)
  float breathe = sin(u_time * 0.15 + timeOffset) * 1.2;
  float animatedLevels = levels + breathe;

  float bayerValue = getBayerValueScaled(position, scale) / 64.0;

  // Quantize brightness into discrete levels
  float posterized = floor(brightness * animatedLevels) / animatedLevels;
  float nextLevel = ceil(brightness * animatedLevels) / animatedLevels;

  // Get the fractional part to determine dithering threshold
  float levelFraction = fract(brightness * animatedLevels);

  // Apply dithering at level boundaries
  return (levelFraction > bayerValue) ? nextLevel : posterized;
}

// Smooth noise function for organic gradient
float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Smooth interpolation
float smoothNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);

  float a = noise(i);
  float b = noise(i + vec2(1.0, 0.0));
  float c = noise(i + vec2(0.0, 1.0));
  float d = noise(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

// Fractal Brownian Motion for layered noise (more random)
float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 5; i++) {
    value += amplitude * smoothNoise(st * frequency);
    frequency *= 2.3; // Higher lacunarity for more variation
    amplitude *= 0.55; // Adjusted gain for stronger high frequencies
  }

  return value;
}

// Mouse position color influence - smooth color shift around cursor
float getMouseColorInfluence(vec2 uv, vec2 mousePos) {
  // Apply aspect ratio correction for circular effect
  float aspect = u_resolution.x / u_resolution.y;
  vec2 correctedUV = vec2(uv.x * aspect, uv.y);
  vec2 correctedMousePos = vec2(mousePos.x * aspect, mousePos.y);

  vec2 diff = correctedUV - correctedMousePos;
  float dist = length(diff);

  // Add gentle organic noise distortion
  float noiseDistortion = fbm(uv * 10.0 + u_time * 0.1) * 0.03;
  dist += noiseDistortion;

  // Smaller, tighter radius
  float influence = smoothstep(0.18, 0.0, dist);

  // Add subtle variation to the influence
  float noiseVariation = fbm(uv * 15.0 + u_time * 0.05) * 0.1;
  influence *= (1.0 - noiseVariation);

  // Slower, more gentle pulsing
  float pulse = 0.5 + 0.5 * sin(u_time * 0.3);
  influence *= (0.85 + 0.15 * pulse);

  return influence;
}

// Click ripple effect - organic expanding color change with dark border
float getClickRippleColor(vec2 uv, vec4 ripple) {
  if (ripple.w <= 0.0) return 0.0; // Inactive ripple

  vec2 ripplePos = ripple.xy;
  float age = ripple.z;
  float intensity = ripple.w;

  // Apply aspect ratio correction for circular ripples
  float aspect = u_resolution.x / u_resolution.y;
  vec2 correctedUV = vec2(uv.x * aspect, uv.y);
  vec2 correctedRipplePos = vec2(ripplePos.x * aspect, ripplePos.y);

  vec2 diff = correctedUV - correctedRipplePos;
  float dist = length(diff);

  // Add organic noise distortion to make it non-circular
  float noiseDistortion = fbm(uv * 8.0 + age * 2.0) * 0.08;
  dist += noiseDistortion;

  // Ease-out expansion: fast start, gentle end
  float easedAge = 1.0 - pow(1.0 - age, 3.0); // Cubic ease-out
  float maxRadius = easedAge * 0.5; // Larger final radius

  // Core light influence
  float coreInfluence = smoothstep(maxRadius, maxRadius * 0.4, dist);

  // Dark border at the edge
  float borderStart = maxRadius * 0.85;
  float borderEnd = maxRadius * 1.1;
  float borderInfluence = smoothstep(borderStart, borderEnd, dist) - smoothstep(borderEnd, borderEnd * 1.15, dist);

  // Combine: positive for light, negative for dark border
  float influence = coreInfluence - (borderInfluence * 0.8);

  // Add subtle dithering variation to the influence
  float ditherNoise = fbm(uv * 12.0) * 0.15;
  influence *= (1.0 - ditherNoise);

  // Very slow, gentle fade out
  float fade = 1.0 - pow(age, 4.0); // Quartic fade for very long lingering

  return influence * fade * intensity;
}

void main() {
  // Normalize coordinates
  vec2 uv = v_uv;
  vec2 pixelPos = gl_FragCoord.xy;

  // Mouse influence (subtle parallax effect)
  vec2 mouseOffset = (u_mouse - 0.5) * 0.02; // Very subtle, 2% movement
  uv += mouseOffset;

  // Calculate mouse color influence (no distortion)
  float mouseInfluence = getMouseColorInfluence(uv, u_mouse);

  // Calculate click ripple color influences (no distortion)
  float clickInfluence = getClickRippleColor(uv, u_ripple0) +
                         getClickRippleColor(uv, u_ripple1) +
                         getClickRippleColor(uv, u_ripple2) +
                         getClickRippleColor(uv, u_ripple3) +
                         getClickRippleColor(uv, u_ripple4);

  // Create gradient with noise
  // Vertical gradient influenced by mouse position
  float gradient = uv.y + mouseOffset.y * 2.0;

  // Add subtle noise for organic feel
  float noiseValue = fbm(uv * 3.0 + u_time * 0.05) * 0.15;
  gradient += noiseValue;

  // Add slight horizontal variation
  gradient += (uv.x - 0.5) * 0.1;

  // Clamp gradient to 0-1 range
  gradient = clamp(gradient, 0.0, 1.0);

  // Interpolate between two colors
  vec3 color = mix(u_color1, u_color2, gradient);

  // Combine mouse and click influences (can be negative for dark borders)
  float totalInfluence = mouseInfluence + clickInfluence;

  // Apply color influence (brighten for positive, darken for negative)
  if (totalInfluence > 0.0) {
    // Brighten - subtle glow
    color = mix(color, color * 1.3, min(totalInfluence, 1.0) * 0.4);
  } else {
    // Darken for negative influence (border)
    color = mix(color, color * 0.5, min(abs(totalInfluence), 1.0) * 0.5);
  }

  // Convert to grayscale for dithering
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));

  // Layer 1: Coarse posterization (bold structure) - use uniform
  float coarseDither = ditherLayered(pixelPos, luminance, u_coarseLevels, 1.5, 0.0);

  // Layer 2: Fine texture (subtle detail) - use uniform
  float fineDither = ditherLayered(pixelPos, luminance, u_fineLevels, 2.0, 1.57);

  // Blend layers: 70% coarse, 30% fine for balanced depth
  float blendedLuminance = mix(coarseDither, fineDither, 0.3);

  // Reconstruct color with layered dithering
  vec3 finalColor = color * (blendedLuminance / max(luminance, 0.001));

  // Subtle vignette for depth
  float vignette = 1.0 - length(uv - 0.5) * 0.3;
  finalColor *= vignette;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// WebGL 1.0 Fragment Shader - Mobile (GLSL ES 1.0)
export const fragmentShaderSourceMobileWebGL1 = `
precision mediump float;

varying vec2 v_uv;

uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_time;
uniform float u_coarseLevels;
uniform float u_fineLevels;

// Simplified 4x4 Bayer matrix
const mat4 bayerMatrix = mat4(
   0.0, 12.0,  3.0, 15.0,
   8.0,  4.0, 11.0,  7.0,
   2.0, 14.0,  1.0, 13.0,
  10.0,  6.0,  9.0,  5.0
);

float getBayerValue(vec2 pos) {
  int x = int(mod(pos.x, 4.0));
  int y = int(mod(pos.y, 4.0));

  if (y == 0) {
    if (x == 0) return bayerMatrix[0][0];
    if (x == 1) return bayerMatrix[0][1];
    if (x == 2) return bayerMatrix[0][2];
    return bayerMatrix[0][3];
  } else if (y == 1) {
    if (x == 0) return bayerMatrix[1][0];
    if (x == 1) return bayerMatrix[1][1];
    if (x == 2) return bayerMatrix[1][2];
    return bayerMatrix[1][3];
  } else if (y == 2) {
    if (x == 0) return bayerMatrix[2][0];
    if (x == 1) return bayerMatrix[2][1];
    if (x == 2) return bayerMatrix[2][2];
    return bayerMatrix[2][3];
  } else {
    if (x == 0) return bayerMatrix[3][0];
    if (x == 1) return bayerMatrix[3][1];
    if (x == 2) return bayerMatrix[3][2];
    return bayerMatrix[3][3];
  }
}

// Mobile layered dithering with breathing animation (same as desktop)
float ditherLayeredMobile(vec2 position, float brightness, float levels, float timeOffset) {
  // Animate the threshold with breathing effect (same as desktop)
  float breathe = sin(u_time * 0.15 + timeOffset) * 1.2;
  float animatedLevels = levels + breathe;

  float bayerValue = getBayerValue(position) / 16.0;

  // Quantize brightness into discrete levels
  float posterized = floor(brightness * animatedLevels) / animatedLevels;
  float nextLevel = ceil(brightness * animatedLevels) / animatedLevels;

  // Get the fractional part to determine dithering threshold
  float levelFraction = fract(brightness * animatedLevels);

  // Apply dithering at level boundaries
  return (levelFraction > bayerValue) ? nextLevel : posterized;
}

void main() {
  vec2 uv = v_uv;
  vec2 pixelPos = gl_FragCoord.xy;

  // Simple vertical gradient
  float gradient = uv.y;

  // Interpolate colors
  vec3 color = mix(u_color1, u_color2, gradient);

  // Convert to grayscale
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));

  // Layer 1: Coarse posterization (use uniform value)
  float coarseDither = ditherLayeredMobile(pixelPos, luminance, u_coarseLevels, 0.0);

  // Layer 2: Fine texture (use uniform value, different timeOffset)
  float fineDither = ditherLayeredMobile(pixelPos, luminance, u_fineLevels, 1.57);

  // Blend layers: 70% coarse, 30% fine
  float blendedLuminance = mix(coarseDither, fineDither, 0.3);

  vec3 finalColor = color * (blendedLuminance / max(luminance, 0.001));

  gl_FragColor = vec4(finalColor, 1.0);
}
`;
