/**
 * WebGL Manager
 * Handles WebGL context, shader compilation, and rendering
 */

import {
  vertexShaderSource,
  fragmentShaderSource,
  fragmentShaderSourceMobile,
  vertexShaderSourceWebGL1,
  fragmentShaderSourceWebGL1,
  fragmentShaderSourceMobileWebGL1,
} from "./dithering-shader";

interface Uniforms {
  resolution: WebGLUniformLocation | null;
  mouse: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  color1: WebGLUniformLocation | null;
  color2: WebGLUniformLocation | null;
  transition: WebGLUniformLocation | null;
  ripple0: WebGLUniformLocation | null;
  ripple1: WebGLUniformLocation | null;
  ripple2: WebGLUniformLocation | null;
  ripple3: WebGLUniformLocation | null;
  ripple4: WebGLUniformLocation | null;
  coarseLevels: WebGLUniformLocation | null;
  fineLevels: WebGLUniformLocation | null;
}

interface MousePos {
  x: number;
  y: number;
}

export interface Ripple {
  x: number;
  y: number;
  startTime: number;
  lifetime: number;
}

export class WebGLManager {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  program: WebGLProgram | null = null;
  uniforms: Uniforms = {} as Uniforms;
  isMobile: boolean;
  webglVersion: 1 | 2 | 0 = 0; // 0 = not supported, 1 = WebGL 1.0, 2 = WebGL 2.0
  isWebGL2Supported: boolean = false;
  isWebGL1Supported: boolean = false;
  startTime: number;
  coarseLevels: number;
  fineLevels: number;
  viewportWidth: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.isMobile = this.detectMobile();
    this.startTime = Date.now();

    // Initialize responsive posterization levels
    this.viewportWidth = window.innerWidth;
    const levels = this.calculatePosterizationLevels(this.viewportWidth);
    this.coarseLevels = levels.coarse;
    this.fineLevels = levels.fine;

    // Initialize WebGL
    this.init();
  }

  /**
   * Detect if device is mobile
   */
  detectMobile(): boolean {
    return (
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    );
  }

  /**
   * Calculate posterization levels based on viewport width
   * Uses stepped breakpoints matching CSS responsive design
   */
  calculatePosterizationLevels(width: number): {
    coarse: number;
    fine: number;
  } {
    // Stepped breakpoints matching CSS responsive design
    if (width < 640) {
      // Mobile: very smooth gradient, minimal posterization
      return { coarse: 3.5, fine: 6.0 };
    } else if (width < 1024) {
      // Tablet: moderate complexity
      return { coarse: 3.5, fine: 6.5 };
    } else {
      // Desktop: full dithering effect
      return { coarse: 3.5, fine: 9.0 };
    }
  }

  /**
   * Initialize WebGL context
   */
  init(): boolean {
    // Try WebGL 2.0 first
    this.gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power", // Better for battery on mobile
    }) as WebGL2RenderingContext | null;

    if (this.gl) {
      this.webglVersion = 2;
      this.isWebGL2Supported = true;
      console.log("WebGL 2.0 initialized");
    } else {
      // Fallback to WebGL 1.0
      this.gl = this.canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null;

      // Also try experimental-webgl for older browsers
      if (!this.gl) {
        this.gl = this.canvas.getContext("experimental-webgl", {
          alpha: true,
          antialias: false,
          preserveDrawingBuffer: false,
          powerPreference: "low-power",
        }) as WebGLRenderingContext | null;
      }

      if (this.gl) {
        this.webglVersion = 1;
        this.isWebGL1Supported = true;
        console.log("WebGL 1.0 initialized");
      } else {
        console.warn("WebGL not supported, falling back to CSS gradient");
        this.webglVersion = 0;
        return false;
      }
    }

    // Create shader program
    if (!this.createProgram()) {
      return false;
    }

    // Set up geometry (fullscreen quad)
    this.setupGeometry();

    // Get uniform locations
    this.getUniformLocations();

    // Set viewport and initialize uniforms (including u_resolution)
    this.resize();

    // Initialize ripple uniforms to zero
    this.initializeRipples();

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
      console.error(
        "Shader compilation error:",
        this.gl.getShaderInfoLog(shader)
      );
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

    // Choose shaders based on WebGL version and device type
    let vertShader: string;
    let fragShader: string;

    if (this.webglVersion === 2) {
      // WebGL 2.0 shaders (GLSL ES 3.0)
      vertShader = vertexShaderSource;
      fragShader = this.isMobile
        ? fragmentShaderSourceMobile
        : fragmentShaderSource;
    } else {
      // WebGL 1.0 shaders (GLSL ES 1.0)
      vertShader = vertexShaderSourceWebGL1;
      fragShader = this.isMobile
        ? fragmentShaderSourceMobileWebGL1
        : fragmentShaderSourceWebGL1;
    }

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertShader);
    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      fragShader
    );

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
      console.error(
        "Program linking error:",
        this.gl.getProgramInfoLog(this.program)
      );
      return false;
    }

    this.gl.useProgram(this.program);

    // Clean up shaders (no longer needed after linking)
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    // Initialize posterization levels immediately after program creation
    this.updatePosterizationLevels();

    return true;
  }

  /**
   * Set up fullscreen quad geometry
   */
  setupGeometry(): void {
    if (!this.gl || !this.program) return;

    // Fullscreen quad vertices
    const vertices = new Float32Array([
      -1,
      -1, // Bottom left
      1,
      -1, // Bottom right
      -1,
      1, // Top left
      1,
      1, // Top right
    ]);

    // Create buffer
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    // Set up attribute
    const positionLocation = this.gl.getAttribLocation(
      this.program,
      "a_position"
    );
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
  }

  /**
   * Get uniform locations
   */
  getUniformLocations(): void {
    if (!this.gl || !this.program) return;

    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, "u_resolution"),
      mouse: this.gl.getUniformLocation(this.program, "u_mouse"),
      time: this.gl.getUniformLocation(this.program, "u_time"),
      color1: this.gl.getUniformLocation(this.program, "u_color1"),
      color2: this.gl.getUniformLocation(this.program, "u_color2"),
      transition: this.gl.getUniformLocation(this.program, "u_transition"),
      ripple0: this.gl.getUniformLocation(this.program, "u_ripple0"),
      ripple1: this.gl.getUniformLocation(this.program, "u_ripple1"),
      ripple2: this.gl.getUniformLocation(this.program, "u_ripple2"),
      ripple3: this.gl.getUniformLocation(this.program, "u_ripple3"),
      ripple4: this.gl.getUniformLocation(this.program, "u_ripple4"),
      coarseLevels: this.gl.getUniformLocation(this.program, "u_coarseLevels"),
      fineLevels: this.gl.getUniformLocation(this.program, "u_fineLevels"),
    };
  }

  /**
   * Update posterization level uniforms
   */
  updatePosterizationLevels(): void {
    if (!this.gl || !this.program) return;

    this.gl.useProgram(this.program);

    if (this.uniforms.coarseLevels) {
      this.gl.uniform1f(this.uniforms.coarseLevels, this.coarseLevels);
    }

    if (this.uniforms.fineLevels) {
      this.gl.uniform1f(this.uniforms.fineLevels, this.fineLevels);
    }
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
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      // Update resolution uniform
      if (this.uniforms.resolution) {
        this.gl.uniform2f(
          this.uniforms.resolution,
          this.canvas.width,
          this.canvas.height
        );
      }

      // Recalculate posterization levels when viewport width changes
      if (width !== this.viewportWidth) {
        this.viewportWidth = width;
        const levels = this.calculatePosterizationLevels(width);
        this.coarseLevels = levels.coarse;
        this.fineLevels = levels.fine;
        this.updatePosterizationLevels();
      }
    }
  }

  /**
   * Update uniforms
   */
  updateUniforms(
    mousePos: MousePos,
    color1: number[],
    color2: number[],
    transition: number = 0
  ): void {
    if (!this.gl || !this.program) return;

    this.gl.useProgram(this.program);

    // Update mouse position (normalized)
    if (this.uniforms.mouse && !this.isMobile) {
      this.gl.uniform2f(this.uniforms.mouse, mousePos.x, mousePos.y);
    }

    // Update time (enabled for both mobile and desktop)
    if (this.uniforms.time) {
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

    // Update posterization levels
    this.updatePosterizationLevels();
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
   * Initialize ripple uniforms to zero
   */
  initializeRipples(): void {
    if (!this.gl || !this.program || this.isMobile) return;

    this.gl.useProgram(this.program);

    // Set all ripples to inactive (0, 0, 0, 0)
    for (let i = 0; i < 5; i++) {
      const uniformName = `ripple${i}` as keyof Uniforms;
      const uniform = this.uniforms[uniformName];

      if (uniform) {
        this.gl.uniform4f(uniform, 0.0, 0.0, 0.0, 0.0);
      }
    }
  }

  /**
   * Update ripple uniforms
   */
  updateRipples(ripples: Ripple[]): void {
    if (!this.gl || !this.program || this.isMobile) return;

    this.gl.useProgram(this.program);

    // Update each ripple uniform (max 5)
    for (let i = 0; i < 5; i++) {
      const uniformName = `ripple${i}` as keyof Uniforms;
      const uniform = this.uniforms[uniformName];

      if (uniform) {
        if (i < ripples.length) {
          const r = ripples[i];
          const age = (Date.now() - r.startTime) / r.lifetime;
          this.gl.uniform4f(uniform, r.x, r.y, age, 1.0);
        } else {
          // Inactive ripple
          this.gl.uniform4f(uniform, 0.0, 0.0, 0.0, 0.0);
        }
      }
    }
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (this.program && this.gl) {
      this.gl.deleteProgram(this.program);
    }
    if (this.gl) {
      const loseContext = this.gl.getExtension("WEBGL_lose_context");
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  }
}
