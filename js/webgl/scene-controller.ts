/**
 * Scene Controller
 * Manages section transitions, mouse tracking, and color updates
 * Mouse position controls Kuwahara filter reveal
 */

import { ThreeManager } from './three-manager';

interface ColorPair {
  color1: number[];
  color2: number[];
}

interface MousePos {
  x: number;
  y: number;
}

interface SectionColors {
  [key: string]: ColorPair;
}

export class SceneController {
  threeManager: ThreeManager;
  currentSection: string;
  targetColors: ColorPair;
  currentColors: ColorPair;
  transitionProgress: number;
  transitionDuration: number;
  transitionStartTime: number;
  isTransitioning: boolean;
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
  sectionColors: SectionColors;
  observer: IntersectionObserver | null = null;

  constructor(threeManager: ThreeManager) {
    this.threeManager = threeManager;
    this.currentSection = 'hero';
    this.targetColors = { color1: [0, 0, 0], color2: [0, 0, 0] };
    this.currentColors = { color1: [0, 0, 0], color2: [0, 0, 0] };
    this.transitionProgress = 0;
    this.transitionDuration = 2000; // 2 seconds
    this.transitionStartTime = 0;
    this.isTransitioning = false;

    this.mousePos = { x: 0.5, y: 0.5 };
    this.targetMousePos = { x: 0.5, y: 0.5 };
    this.prevMousePos = { x: 0.5, y: 0.5 };
    this.mouseLerp = 0.1; // Smooth mouse following
    this.isMouseActive = false;
    this.moveIntensity = 0;
    this.targetMoveIntensity = 0;

    this.isAnimating = false;
    this.lastFrameTime = Date.now();
    this.startTime = Date.now();

    // Section colors (HSL to RGB conversion)
    this.sectionColors = this.getSectionColors();

    // Initialize with hero colors
    this.setColors('hero', true);

    // Set up observers and listeners
    this.setupIntersectionObserver();
    this.setupMouseTracking();
  }

  /**
   * Define section colors based on design tokens
   */
  getSectionColors(): SectionColors {
    return {
      hero: {
        color1: this.hslToRgb(210, 15, 90),
        color2: this.hslToRgb(210, 20, 70)
      },
      about: {
        color1: this.hslToRgb(30, 12, 88),
        color2: this.hslToRgb(30, 15, 75)
      },
      skills: {
        color1: this.hslToRgb(220, 10, 85),
        color2: this.hslToRgb(220, 15, 70)
      },
      experience: {
        color1: this.hslToRgb(250, 15, 88),
        color2: this.hslToRgb(250, 20, 75)
      },
      projects: {
        color1: this.hslToRgb(140, 12, 85),
        color2: this.hslToRgb(140, 18, 72)
      },
      'projects-index': {
        color1: this.hslToRgb(140, 12, 87),
        color2: this.hslToRgb(140, 16, 74)
      },
      'project-1': {
        color1: this.hslToRgb(145, 14, 85),
        color2: this.hslToRgb(145, 20, 70)
      },
      'project-2': {
        color1: this.hslToRgb(135, 12, 86),
        color2: this.hslToRgb(135, 18, 71)
      },
      'project-3': {
        color1: this.hslToRgb(150, 13, 84),
        color2: this.hslToRgb(150, 19, 69)
      },
      'project-4': {
        color1: this.hslToRgb(130, 11, 86),
        color2: this.hslToRgb(130, 17, 72)
      },
      contact: {
        color1: this.hslToRgb(210, 15, 90),
        color2: this.hslToRgb(210, 20, 70)
      }
    };
  }

  /**
   * Convert HSL to RGB (values 0-1)
   */
  hslToRgb(h: number, s: number, l: number): number[] {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r, g, b];
  }

  /**
   * Set up Intersection Observer for section detection
   */
  setupIntersectionObserver(): void {
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id || 'hero';
          this.changeSection(sectionId);
        }
      });
    }, options);

    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => this.observer?.observe(section));
  }

  /**
   * Set up mouse tracking (controls Kuwahara reveal)
   */
  setupMouseTracking(): void {
    let rafId: number | null = null;

    const updateMouse = (e: MouseEvent): void => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        this.targetMousePos.x = e.clientX / window.innerWidth;
        this.targetMousePos.y = 1.0 - (e.clientY / window.innerHeight);
        this.isMouseActive = true;
        rafId = null;
      });
    };

    const handleMouseEnter = (): void => {
      this.isMouseActive = true;
    };

    const handleMouseLeave = (): void => {
      this.isMouseActive = false;
    };

    if (!this.threeManager.isMobile) {
      window.addEventListener('mousemove', updateMouse, { passive: true });
      document.addEventListener('mouseenter', handleMouseEnter, { passive: true });
      document.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    }
  }

  /**
   * Change section and trigger color transition
   */
  changeSection(sectionId: string): void {
    if (sectionId === this.currentSection && !this.isTransitioning) {
      return;
    }

    this.currentSection = sectionId;
    this.setColors(sectionId);
  }

  /**
   * Set target colors for a section
   */
  setColors(sectionId: string, immediate: boolean = false): void {
    const colors = this.sectionColors[sectionId] || this.sectionColors.hero;

    this.targetColors.color1 = colors.color1;
    this.targetColors.color2 = colors.color2;

    if (immediate) {
      this.currentColors.color1 = [...colors.color1];
      this.currentColors.color2 = [...colors.color2];
      this.isTransitioning = false;
    } else {
      this.isTransitioning = true;
      this.transitionStartTime = Date.now();
      this.transitionProgress = 0;
    }
  }

  /**
   * Linear interpolation
   */
  lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Ease out cubic
   */
  easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
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

    // Update target intensity based on movement (ramps up quickly)
    this.targetMoveIntensity = Math.min(moveSpeed * 50, 1.0);

    // Smooth the intensity (fast ramp up, slow decay)
    if (this.targetMoveIntensity > this.moveIntensity) {
      // Ramp up quickly
      this.moveIntensity = this.lerp(this.moveIntensity, this.targetMoveIntensity, 0.3);
    } else {
      // Decay slowly
      this.moveIntensity = this.lerp(this.moveIntensity, this.targetMoveIntensity, 0.05);
    }

    // Store previous position for next frame
    this.prevMousePos.x = this.mousePos.x;
    this.prevMousePos.y = this.mousePos.y;

    // Color transition
    if (this.isTransitioning) {
      const elapsed = now - this.transitionStartTime;
      this.transitionProgress = Math.min(elapsed / this.transitionDuration, 1);

      const t = this.easeOutCubic(this.transitionProgress);

      // Interpolate colors
      this.currentColors.color1 = [
        this.lerp(this.currentColors.color1[0], this.targetColors.color1[0], t),
        this.lerp(this.currentColors.color1[1], this.targetColors.color1[1], t),
        this.lerp(this.currentColors.color1[2], this.targetColors.color1[2], t)
      ];

      this.currentColors.color2 = [
        this.lerp(this.currentColors.color2[0], this.targetColors.color2[0], t),
        this.lerp(this.currentColors.color2[1], this.targetColors.color2[1], t),
        this.lerp(this.currentColors.color2[2], this.targetColors.color2[2], t)
      ];

      if (this.transitionProgress >= 1) {
        this.isTransitioning = false;
      }
    }

    // Update ThreeManager uniforms
    const elapsed = (now - this.startTime) / 1000;
    this.threeManager.updateTime(elapsed);
    this.threeManager.updateMouse(this.mousePos.x, this.mousePos.y);
    this.threeManager.updateColors(this.currentColors.color1, this.currentColors.color2);

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
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
