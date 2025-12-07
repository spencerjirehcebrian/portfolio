/**
 * Main Entry Point
 * Initializes all systems: WebGL, theme management, navigation, and animations
 */

// Import styles (Vite handles this)
import '../css/main.css';

// Existing imports
import { WebGLManager } from './webgl/webgl-manager';
import { SceneController } from './webgl/scene-controller';

// Extend Window interface for debugging
declare global {
  interface Window {
    portfolio: Portfolio;
  }
}

class Portfolio {
  webglManager: WebGLManager | null = null;
  sceneController: SceneController | null = null;
  themeInitialized: boolean = false;

  constructor() {
    // Initialize
    this.init();
  }

  /**
   * Initialize all systems
   */
  init(): void {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Setup all components
   */
  setup(): void {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      // Initialize WebGL
      this.initWebGL();
    } else {
      // Hide canvas if user prefers reduced motion
      const canvas = document.getElementById('webgl-canvas');
      if (canvas) {
        canvas.style.display = 'none';
      }
    }

    // Initialize UI components
    this.initNavigation();
    this.initScrollEffects();
    this.initRevealAnimations();
    this.initSmoothScroll();

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Initialize WebGL
   */
  initWebGL(): void {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      console.warn('WebGL canvas not found');
      return;
    }

    this.webglManager = new WebGLManager(canvas);

    if (this.webglManager.webglVersion === 0) {
      console.warn('WebGL not supported, using CSS fallback');
      canvas.style.display = 'none';
      return;
    }

    // Log which version is being used
    if (this.webglManager.webglVersion === 2) {
      console.log('Using WebGL 2.0 for enhanced effects');
    } else if (this.webglManager.webglVersion === 1) {
      console.log('Using WebGL 1.0 for compatibility');
    }

    // Initialize scene controller
    this.sceneController = new SceneController(this.webglManager);
    this.sceneController.start();
  }

  /**
   * Initialize navigation
   */
  initNavigation(): void {
    const nav = document.querySelector('.nav');
    const mobileMenuToggle = document.querySelector('[data-mobile-menu-toggle]');
    const mobileMenu = document.querySelector('[data-mobile-menu]');
    const mobileLinks = mobileMenu?.querySelectorAll('a');

    // Mobile menu toggle
    if (mobileMenuToggle && mobileMenu) {
      mobileMenuToggle.addEventListener('click', () => {
        const isHidden = mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden', !isHidden);
      });

      // Close mobile menu when clicking on links
      mobileLinks?.forEach(link => {
        link.addEventListener('click', () => {
          mobileMenu.classList.add('hidden');
        });
      });

      // Close mobile menu when clicking outside
      document.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as Node;
        if (!mobileMenuToggle.contains(target) && !mobileMenu.contains(target)) {
          mobileMenu.classList.add('hidden');
        }
      });
    }
  }

  /**
   * Initialize scroll effects
   */
  initScrollEffects(): void {
    const nav = document.querySelector('.nav');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;

      // Add shadow to nav when scrolled
      if (scrollY > 100) {
        nav?.classList.add('scrolled');
      } else {
        nav?.classList.remove('scrolled');
      }

      lastScrollY = scrollY;
    }, { passive: true });
  }

  /**
   * Initialize reveal animations (Intersection Observer)
   */
  initRevealAnimations(): void {
    const revealElements = document.querySelectorAll('.reveal');

    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, {
      root: null,
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  /**
   * Initialize smooth scroll
   */
  initSmoothScroll(): void {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');

    links.forEach(link => {
      link.addEventListener('click', (e: MouseEvent) => {
        const href = link.getAttribute('href');
        if (href === '#') return;

        e.preventDefault();

        const target = href ? document.querySelector(href) : null;
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    if (this.webglManager) {
      this.webglManager.resize();
    }
  }

  /**
   * Clean up
   */
  dispose(): void {
    if (this.sceneController) {
      this.sceneController.dispose();
    }
    if (this.webglManager) {
      this.webglManager.dispose();
    }
  }
}

// Initialize portfolio
const portfolio = new Portfolio();

// Make available globally for debugging
window.portfolio = portfolio;
