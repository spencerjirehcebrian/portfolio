/**
 * Main Entry Point
 * Initializes all systems: WebGL, theme management, navigation, and animations
 */

import { WebGLManager } from './webgl/webgl-manager.js';
import { SceneController } from './webgl/scene-controller.js';

class Portfolio {
  constructor() {
    this.webglManager = null;
    this.sceneController = null;
    this.themeInitialized = false;

    // Initialize
    this.init();
  }

  /**
   * Initialize all systems
   */
  init() {
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
  setup() {
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
  initWebGL() {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) {
      console.warn('WebGL canvas not found');
      return;
    }

    this.webglManager = new WebGLManager(canvas);

    if (!this.webglManager.isWebGL2Supported) {
      console.warn('WebGL 2.0 not supported, using CSS fallback');
      canvas.style.display = 'none';
      return;
    }

    // Initialize scene controller
    this.sceneController = new SceneController(this.webglManager);
    this.sceneController.start();
  }

  /**
   * Initialize navigation
   */
  initNavigation() {
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
      document.addEventListener('click', (e) => {
        if (!mobileMenuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
          mobileMenu.classList.add('hidden');
        }
      });
    }
  }

  /**
   * Initialize scroll effects
   */
  initScrollEffects() {
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
  initRevealAnimations() {
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
  initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === '#') return;

        e.preventDefault();

        const target = document.querySelector(href);
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
  handleResize() {
    if (this.webglManager) {
      this.webglManager.resize();
    }
  }

  /**
   * Clean up
   */
  dispose() {
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
