/**
 * Scene Controller
 * Manages section transitions, mouse tracking, and color updates
 * Mouse position controls Kuwahara filter reveal
 */

import { ThreeManager } from './three-manager';

interface MousePos {
  x: number;
  y: number;
}

export class SceneController {
  threeManager: ThreeManager;
  mousePos: MousePos;
  targetMousePos: MousePos;
  prevMousePos: MousePos;
  mouseLerp: number;
  isMouseActive: boolean;
  moveIntensity: number;
  targetMoveIntensity: number;
  isAnimating: boolean;
  lastFrameTime: number;
  startTime: number;

  // Idle state - using setInterval for reliable cross-tab timing
  idleTimeout: number = 15000; // 15s
  lastActivityTime: number = Date.now();
  isIdle: boolean = false;
  idleStartTime: number = 0;
  idleCheckInterval: number | null = null;

  // Painting cycle (5 paintings loaded in ThreeManager)
  currentPaintingIndex: number = 0;
  totalPaintings: number = 7;

  // Wash transition
  isWashTransitioning: boolean = false;
  washProgress: number = 0;
  washStartTime: number = 0;
  washDuration: number = 5000; // 5s watercolor wash

  constructor(threeManager: ThreeManager) {
    this.threeManager = threeManager;

    this.mousePos = { x: 0.5, y: 0.5 };
    this.targetMousePos = { x: 0.5, y: 0.5 };
    this.prevMousePos = { x: 0.5, y: 0.5 };
    this.mouseLerp = 0.1;
    this.isMouseActive = false;
    this.moveIntensity = 0;
    this.targetMoveIntensity = 0;

    this.isAnimating = false;
    this.lastFrameTime = Date.now();
    this.startTime = Date.now();

    // Set up event listeners
    this.setupMouseTracking();
    this.setupIdleDetection();
  }

  /**
   * Set up mouse tracking (controls Kuwahara reveal)
   */
  setupMouseTracking(): void {
    if (this.threeManager.isMobile) return;

    const onActivity = (): void => {
      this.lastActivityTime = Date.now();
      if (this.isIdle || this.idleAmount > 0) {
        this.exitIdleState();
      }
    };

    const updateMouse = (e: MouseEvent): void => {
      if (this.threeManager.isMobile) return;
      this.targetMousePos.x = e.clientX / window.innerWidth;
      this.targetMousePos.y = 1.0 - (e.clientY / window.innerHeight);
      this.isMouseActive = true;
      onActivity();
    };

    window.addEventListener('mousemove', updateMouse, { passive: true });
    document.addEventListener('mouseenter', () => { this.isMouseActive = true; }, { passive: true });
    document.addEventListener('mouseleave', () => { this.isMouseActive = false; }, { passive: true });
  }

  /**
   * Set up idle detection using setInterval
   * Runs even when tab is hidden - reliable cross-tab timing
   */
  setupIdleDetection(): void {
    if (this.threeManager.isMobile) return;

    // Check idle state every 500ms - works even when tab is hidden
    this.idleCheckInterval = window.setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivityTime;

      // Enter idle state after timeout
      if (timeSinceActivity > this.idleTimeout && !this.isIdle) {
        this.isIdle = true;
        this.idleStartTime = now;
      }

      // Trigger next painting after another timeout period of idle
      if (this.isIdle && !this.isWashTransitioning) {
        const idleDuration = now - this.idleStartTime;
        if (idleDuration > this.idleTimeout) {
          this.triggerNextPainting();
        }
      }
    }, 500);
  }

  /**
   * Exit idle state - called on mouse activity
   */
  exitIdleState(): void {
    this.isIdle = false;
    this.lastActivityTime = Date.now();
  }

  /**
   * Trigger transition to next painting
   */
  triggerNextPainting(): void {
    if (this.isWashTransitioning) return;

    // Prepare next painting texture
    const nextIndex = (this.currentPaintingIndex + 1) % this.totalPaintings;
    this.threeManager.prepareNextPainting(nextIndex);

    // Randomize wash direction
    this.threeManager.randomizeWashAngle();

    this.isWashTransitioning = true;
    this.washProgress = 0;
    this.washStartTime = Date.now();
    this.currentPaintingIndex = nextIndex;

    // Reset idle timer for next cycle
    this.idleStartTime = Date.now();
  }

  /**
   * Update wash transition animation
   */
  updateWashTransition(now: number): void {
    const elapsed = now - this.washStartTime;
    this.washProgress = Math.min(elapsed / this.washDuration, 1);

    // Update shader
    this.threeManager.updateWashProgress(this.washProgress);

    if (this.washProgress >= 1) {
      this.completeWashTransition();
    }
  }

  /**
   * Complete wash transition
   */
  completeWashTransition(): void {
    this.isWashTransitioning = false;
    this.washProgress = 0;

    // Swap textures in ThreeManager
    this.threeManager.completePaintingTransition(this.currentPaintingIndex);
    this.threeManager.updateWashProgress(0);
  }

  /**
   * Linear interpolation
   */
  lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Update loop
   */
  update(): void {
    const now = Date.now();
    this.lastFrameTime = now;

    // Smooth mouse following
    this.mousePos.x = this.lerp(this.mousePos.x, this.targetMousePos.x, this.mouseLerp);
    this.mousePos.y = this.lerp(this.mousePos.y, this.targetMousePos.y, this.mouseLerp);

    // Calculate mouse movement speed
    const dx = this.mousePos.x - this.prevMousePos.x;
    const dy = this.mousePos.y - this.prevMousePos.y;
    const moveSpeed = Math.sqrt(dx * dx + dy * dy);

    // Update target intensity based on movement
    this.targetMoveIntensity = Math.min(moveSpeed * 50, 1.0);

    // Smooth the intensity (fast ramp up, slow decay)
    if (this.targetMoveIntensity > this.moveIntensity) {
      this.moveIntensity = this.lerp(this.moveIntensity, this.targetMoveIntensity, 0.3);
    } else {
      this.moveIntensity = this.lerp(this.moveIntensity, this.targetMoveIntensity, 0.05);
    }

    // Store previous position for next frame
    this.prevMousePos.x = this.mousePos.x;
    this.prevMousePos.y = this.mousePos.y;

    // Update wash transition animation (desktop only)
    if (!this.threeManager.isMobile && this.isWashTransitioning) {
      this.updateWashTransition(now);
    }

    // Update ThreeManager uniforms
    const elapsed = (now - this.startTime) / 1000;
    this.threeManager.updateTime(elapsed);
    this.threeManager.updateMouse(this.mousePos.x, this.mousePos.y);

    // Update displacement with mouse position and movement intensity
    this.threeManager.updateDisplacement(
      this.mousePos.x,
      this.mousePos.y,
      this.isMouseActive,
      this.moveIntensity
    );

    // Render
    this.threeManager.render();
  }

  /**
   * Start animation loop
   */
  start(): void {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.lastFrameTime = Date.now();

    const animate = (): void => {
      if (!this.isAnimating) return;

      this.update();
      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop animation loop
   */
  stop(): void {
    this.isAnimating = false;
  }

  /**
   * Clean up
   */
  dispose(): void {
    this.stop();
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
  }
}
