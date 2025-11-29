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

// Apply ordered dithering
float dither(vec2 position, float brightness) {
  float bayerValue = getBayerValue(position) / 64.0;
  return step(bayerValue, brightness);
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

// Fractal Brownian Motion for layered noise
float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    value += amplitude * smoothNoise(st * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  // Normalize coordinates
  vec2 uv = v_uv;
  vec2 pixelPos = gl_FragCoord.xy;

  // Mouse influence (subtle parallax effect)
  vec2 mouseOffset = (u_mouse - 0.5) * 0.02; // Very subtle, 2% movement
  uv += mouseOffset;

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

  // Convert to grayscale for dithering
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));

  // Apply dithering
  float dithered = dither(pixelPos, luminance);

  // Reconstruct color with dithering applied
  vec3 finalColor = color * dithered;

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

float dither(vec2 position, float brightness) {
  float bayerValue = getBayerValue(position) / 16.0;
  return step(bayerValue, brightness);
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

  // Apply dithering
  float dithered = dither(pixelPos, luminance);

  vec3 finalColor = color * dithered;

  fragColor = vec4(finalColor, 1.0);
}
`;
