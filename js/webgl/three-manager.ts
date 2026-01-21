/**
 * Three.js Manager
 * Handles Three.js renderer, scene, and EffectComposer for watercolor post-processing
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { proceduralGradientShader } from './shaders/procedural-gradient';
import { kuwaharaShader } from './shaders/kuwahara';
import { watercolorEnhanceShader, generatePaperTexture } from './shaders/watercolor-enhance';
import { displacementShader } from './shaders/displacement';

interface ThreeManagerConfig {
  canvas: HTMLCanvasElement;
  isMobile: boolean;
}

export class ThreeManager {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  composer: EffectComposer;
  isMobile: boolean;

  // The fullscreen noise plane
  noiseMesh: THREE.Mesh;
  noiseMaterial: THREE.ShaderMaterial;

  // Post-processing passes
  renderPass: RenderPass;
  kuwaharaPass: ShaderPass;
  watercolorPass: ShaderPass;

  // Paper texture
  paperTexture: THREE.DataTexture;

  // Test image texture (temporary for Kuwahara testing)
  imageTexture: THREE.Texture | null = null;

  // Displacement ping-pong buffers
  displacementTargetA!: THREE.WebGLRenderTarget;
  displacementTargetB!: THREE.WebGLRenderTarget;
  displacementScene!: THREE.Scene;
  displacementCamera!: THREE.OrthographicCamera;
  displacementMaterial!: THREE.ShaderMaterial;
  displacementMesh!: THREE.Mesh;
  currentDisplacementTarget: 'A' | 'B' = 'A';

  // Track WebGL support
  webglVersion: 1 | 2 | 0 = 0;

  // Resolution for uniforms
  resolution: THREE.Vector2;

  constructor(config: ThreeManagerConfig) {
    this.canvas = config.canvas;
    this.isMobile = config.isMobile;
    this.resolution = new THREE.Vector2();

    // Initialize Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });

    // Detect WebGL version
    const gl = this.renderer.getContext();
    if (gl instanceof WebGL2RenderingContext) {
      this.webglVersion = 2;
    } else if (gl) {
      this.webglVersion = 1;
    }

    // Create scene and camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Generate paper texture
    this.paperTexture = this.createPaperTexture();

    // Initialize displacement buffers for water effect
    this.initDisplacementBuffers();

    // Load test image for Kuwahara filter testing
    this.loadTestImage();

    // Create noise plane
    this.noiseMaterial = this.createNoiseMaterial();
    this.noiseMesh = this.createNoiseMesh();
    this.scene.add(this.noiseMesh);

    // Set up post-processing
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.kuwaharaPass = this.createKuwaharaPass();
    this.watercolorPass = this.createWatercolorPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.kuwaharaPass);
    this.composer.addPass(this.watercolorPass);

    // Initial resize
    this.resize();
  }

  /**
   * Create procedural paper texture
   */
  createPaperTexture(): THREE.DataTexture {
    const size = this.isMobile ? 256 : 512;
    const { data, width, height } = generatePaperTexture(size);

    const texture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * Initialize displacement ping-pong render targets for water effect
   */
  initDisplacementBuffers(): void {
    const size = 512; // Displacement texture resolution

    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };

    this.displacementTargetA = new THREE.WebGLRenderTarget(size, size, options);
    this.displacementTargetB = new THREE.WebGLRenderTarget(size, size, options);

    // Create separate scene for displacement rendering
    this.displacementScene = new THREE.Scene();
    this.displacementCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create displacement material - ink diffusion + wave equation
    this.displacementMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tPrevState: { value: null },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_brushSize: { value: 0.035 },
        u_expandRate: { value: 0.4 },
        u_fillRate: { value: 0.08 },
        u_waveSpeed: { value: 0.2 },
        u_waveDamping: { value: 0.95 },
        u_isActive: { value: 0.0 },
        u_moveIntensity: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_texelSize: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        u_time: { value: 0.0 },
      },
      vertexShader: displacementShader.vertexShader,
      fragmentShader: displacementShader.fragmentShader,
    });

    // Create fullscreen quad for displacement
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.displacementMesh = new THREE.Mesh(geometry, this.displacementMaterial);
    this.displacementScene.add(this.displacementMesh);
  }

  /**
   * Render displacement pass with ping-pong buffering
   */
  renderDisplacementPass(): void {
    // Determine source and target
    const source = this.currentDisplacementTarget === 'A'
      ? this.displacementTargetA
      : this.displacementTargetB;
    const target = this.currentDisplacementTarget === 'A'
      ? this.displacementTargetB
      : this.displacementTargetA;

    // Set previous frame's state as input
    this.displacementMaterial.uniforms.tPrevState.value = source.texture;

    // Render to target
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.displacementScene, this.displacementCamera);
    this.renderer.setRenderTarget(null);

    // Swap targets for next frame
    this.currentDisplacementTarget = this.currentDisplacementTarget === 'A' ? 'B' : 'A';
  }

  /**
   * Get current displacement texture for sampling in other shaders
   */
  getDisplacementTexture(): THREE.Texture {
    // Return the texture we just rendered to
    return this.currentDisplacementTarget === 'A'
      ? this.displacementTargetB.texture
      : this.displacementTargetA.texture;
  }

  /**
   * Update displacement uniforms
   */
  updateDisplacement(x: number, y: number, isActive: boolean, moveIntensity: number): void {
    if (this.isMobile) return;

    // Store previous mouse position before updating
    const currentMouse = this.displacementMaterial.uniforms.u_mouse.value;
    this.displacementMaterial.uniforms.u_prevMouse.value.set(currentMouse.x, currentMouse.y);

    // Update current mouse position
    this.displacementMaterial.uniforms.u_mouse.value.set(x, y);
    this.displacementMaterial.uniforms.u_isActive.value = isActive ? 1.0 : 0.0;
    this.displacementMaterial.uniforms.u_moveIntensity.value = moveIntensity;
  }

  /**
   * Load test image for Kuwahara filter testing (temporary)
   * Set USE_IMAGE to true to use image, false to use Voronoi
   */
  loadTestImage(): void {
    const loader = new THREE.TextureLoader();
    // Constable's "The Hay Wain" - public domain landscape painting
    const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/John_Constable_The_Hay_Wain.jpg/1280px-John_Constable_The_Hay_Wain.jpg';

    loader.load(
      imageUrl,
      (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this.imageTexture = texture;
        // Update the material with the loaded texture
        if (this.noiseMaterial) {
          this.noiseMaterial.uniforms.u_image.value = texture;
        }
      },
      undefined,
      (error) => {
        console.warn('Failed to load test image:', error);
      }
    );
  }

  /**
   * Create the noise shader material
   * Toggle u_useImage: 1 = image mode, 0 = voronoi mode
   */
  createNoiseMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2() },
        u_color1: { value: new THREE.Vector3(0.9, 0.9, 0.9) },
        u_color2: { value: new THREE.Vector3(0.7, 0.7, 0.7) },
        u_image: { value: this.imageTexture },
        u_useImage: { value: 1 }, // 1 = use image, 0 = use voronoi
      },
      vertexShader: proceduralGradientShader.vertexShader,
      fragmentShader: proceduralGradientShader.fragmentShader,
    });
  }

  /**
   * Create the fullscreen noise mesh
   */
  createNoiseMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(2, 2);
    return new THREE.Mesh(geometry, this.noiseMaterial);
  }

  /**
   * Create the Kuwahara filter pass with displacement-based reveal
   */
  createKuwaharaPass(): ShaderPass {
    const pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tDisplacement: { value: null },
        u_resolution: { value: new THREE.Vector2() },
        u_kernelSize: { value: this.isMobile ? 4 : 8 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_revealRadius: { value: 0.15 },
        u_revealSoftness: { value: 0.1 },
        u_useDisplacement: { value: this.isMobile ? 0 : 1 },
        u_brightness: { value: 1.4 },
        u_time: { value: 0.0 },
        u_edgeDarkness: { value: 0.4 },
        u_distortionStrength: { value: 0.06 },
      },
      vertexShader: kuwaharaShader.vertexShader,
      fragmentShader: kuwaharaShader.fragmentShader,
    });

    return pass;
  }

  /**
   * Create the watercolor enhancement pass
   */
  createWatercolorPass(): ShaderPass {
    const pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tPaper: { value: this.paperTexture },
        tDisplacement: { value: null },
        u_resolution: { value: new THREE.Vector2() },
        u_paperStrength: { value: 0.45 },
        u_paperScale: { value: 3.0 },
        u_saturation: { value: 1.5 },
        u_edgeDarkening: { value: 0.4 },
        u_vignetteStrength: { value: 0.25 },
        u_useDisplacement: { value: this.isMobile ? 0 : 1 },
        u_contrast: { value: 1.1 },
      },
      vertexShader: watercolorEnhanceShader.vertexShader,
      fragmentShader: watercolorEnhanceShader.fragmentShader,
    });

    return pass;
  }

  /**
   * Resize renderer and update resolution uniforms
   */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update canvas size
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    // Update renderer size
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr);

    // Update composer size
    this.composer.setSize(width, height);

    // Update resolution
    this.resolution.set(width * dpr, height * dpr);

    // Update all shader uniforms that need resolution
    this.noiseMaterial.uniforms.u_resolution.value.copy(this.resolution);
    this.kuwaharaPass.uniforms.u_resolution.value.copy(this.resolution);
    this.watercolorPass.uniforms.u_resolution.value.copy(this.resolution);
  }

  /**
   * Update time uniform
   */
  updateTime(time: number): void {
    this.noiseMaterial.uniforms.u_time.value = time;
    this.displacementMaterial.uniforms.u_time.value = time;
    this.kuwaharaPass.uniforms.u_time.value = time;
  }

  /**
   * Update mouse position uniform (controls Kuwahara reveal)
   */
  updateMouse(x: number, y: number): void {
    if (this.isMobile) return;
    this.kuwaharaPass.uniforms.u_mouse.value.set(x, y);
  }

  /**
   * Update color uniforms
   */
  updateColors(color1: number[], color2: number[]): void {
    this.noiseMaterial.uniforms.u_color1.value.set(color1[0], color1[1], color1[2]);
    this.noiseMaterial.uniforms.u_color2.value.set(color2[0], color2[1], color2[2]);
  }

  /**
   * Render frame using EffectComposer
   */
  render(): void {
    // Update displacement field (ping-pong)
    if (!this.isMobile) {
      this.renderDisplacementPass();

      // Pass displacement texture to Kuwahara and Watercolor passes
      const displacementTexture = this.getDisplacementTexture();
      this.kuwaharaPass.uniforms.tDisplacement.value = displacementTexture;
      this.watercolorPass.uniforms.tDisplacement.value = displacementTexture;
    }

    // Render main scene through post-processing
    this.composer.render();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.noiseMaterial.dispose();
    this.noiseMesh.geometry.dispose();
    this.paperTexture.dispose();
    if (this.imageTexture) {
      this.imageTexture.dispose();
    }

    // Clean up displacement resources
    this.displacementTargetA.dispose();
    this.displacementTargetB.dispose();
    this.displacementMaterial.dispose();
    this.displacementMesh.geometry.dispose();

    this.composer.dispose();
    this.renderer.dispose();
  }
}
