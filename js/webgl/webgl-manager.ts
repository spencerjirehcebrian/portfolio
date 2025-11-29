/**
 * WebGL Manager
 * Handles WebGL context, shader compilation, and rendering
 */

import {
  vertexShaderSource,
  fragmentShaderSource,
  fragmentShaderSourceMobile
} from './dithering-shader';

interface Uniforms {
  resolution: WebGLUniformLocation | null;
  mouse: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  color1: WebGLUniformLocation | null;
  color2: WebGLUniformLocation | null;
  transition: WebGLUniformLocation | null;
}

interface MousePos {
  x: number;
  y: number;
}

export class WebGLManager {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null = null;
  program: WebGLProgram | null = null;
  uniforms: Uniforms = {} as Uniforms;
  isMobile: boolean;
  isWebGL2Supported: boolean = true;
  startTime: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.isMobile = this.detectMobile();
    this.startTime = Date.now();

    // Initialize WebGL
    this.init();
  }

  /**
   * Detect if device is mobile
   */
  detectMobile(): boolean {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  /**
   * Initialize WebGL context
   */
  init(): boolean {
    // Try WebGL 2.0 first
    this.gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power' // Better for battery on mobile
    });

    if (!this.gl) {
      console.warn('WebGL 2.0 not supported, falling back to CSS gradient');
      this.isWebGL2Supported = false;
      return false;
    }

    // Set viewport
    this.resize();

    // Create shader program
    if (!this.createProgram()) {
      return false;
    }

    // Set up geometry (fullscreen quad)
    this.setupGeometry();

    // Get uniform locations
    this.getUniformLocations();

    return true;
  }

  /**
   * Compile shader
   */
  compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create shader program
   */
  createProgram(): boolean {
    if (!this.gl) return false;

    // Choose fragment shader based on device
    const fragShader = this.isMobile ? fragmentShaderSourceMobile : fragmentShaderSource;

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragShader);

    if (!vertexShader || !fragmentShader) {
      return false;
    }

    // Create and link program
    this.program = this.gl.createProgram();
    if (!this.program) return false;

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(this.program));
      return false;
    }

    this.gl.useProgram(this.program);

    // Clean up shaders (no longer needed after linking)
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return true;
  }

  /**
   * Set up fullscreen quad geometry
   */
  setupGeometry(): void {
    if (!this.gl || !this.program) return;

    // Fullscreen quad vertices
    const vertices = new Float32Array([
      -1, -1,  // Bottom left
       1, -1,  // Bottom right
      -1,  1,  // Top left
       1,  1   // Top right
    ]);

    // Create buffer
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    // Set up attribute
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  /**
   * Get uniform locations
   */
  getUniformLocations(): void {
    if (!this.gl || !this.program) return;

    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      mouse: this.gl.getUniformLocation(this.program, 'u_mouse'),
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      color1: this.gl.getUniformLocation(this.program, 'u_color1'),
      color2: this.gl.getUniformLocation(this.program, 'u_color2'),
      transition: this.gl.getUniformLocation(this.program, 'u_transition')
    };
  }

  /**
   * Resize canvas and update viewport
   */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      // Update resolution uniform
      if (this.uniforms.resolution) {
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
      }
    }
  }

  /**
   * Update uniforms
   */
  updateUniforms(mousePos: MousePos, color1: number[], color2: number[], transition: number = 0): void {
    if (!this.gl || !this.program) return;

    this.gl.useProgram(this.program);

    // Update mouse position (normalized)
    if (this.uniforms.mouse && !this.isMobile) {
      this.gl.uniform2f(this.uniforms.mouse, mousePos.x, mousePos.y);
    }

    // Update time
    if (this.uniforms.time && !this.isMobile) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.gl.uniform1f(this.uniforms.time, elapsed);
    }

    // Update colors
    if (this.uniforms.color1) {
      this.gl.uniform3fv(this.uniforms.color1, color1);
    }

    if (this.uniforms.color2) {
      this.gl.uniform3fv(this.uniforms.color2, color2);
    }

    // Update transition
    if (this.uniforms.transition && !this.isMobile) {
      this.gl.uniform1f(this.uniforms.transition, transition);
    }
  }

  /**
   * Render frame
   */
  render(): void {
    if (!this.gl || !this.program) return;

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Draw fullscreen quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (this.program && this.gl) {
      this.gl.deleteProgram(this.program);
    }
    if (this.gl) {
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  }
}
