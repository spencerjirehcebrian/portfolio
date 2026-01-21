/**
 * Main Entry Point
 * Initializes all systems: WebGL watercolor effect, navigation, and animations
 */

// Import styles (Vite handles this)
import '../css/main.css';

// WebGL imports
import { ThreeManager } from './webgl/three-manager';
import { SceneController } from './webgl/scene-controller';

// Extend Window interface for debugging
declare global {
  interface Window {
    portfolio: Portfolio;
  }
}

class Portfolio {
  threeManager: ThreeManager | null = null;
  sceneController: SceneController | null = null;
  themeInitialized: boolean = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize all systems
   */
  init(): void {
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
    this.initProjectToggles();

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
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
   * Initialize WebGL with Three.js watercolor effect
   */
  initWebGL(): void {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      console.warn('WebGL canvas not found');
      return;
    }

    try {
      this.threeManager = new ThreeManager({
        canvas,
        isMobile: this.detectMobile()
      });

      if (this.threeManager.webglVersion === 0) {
        console.warn('WebGL not supported, using CSS fallback');
        canvas.style.display = 'none';
        return;
      }

      // Log which version is being used
      if (this.threeManager.webglVersion === 2) {
        console.log('Using WebGL 2.0 with Three.js watercolor effect');
      } else if (this.threeManager.webglVersion === 1) {
        console.log('Using WebGL 1.0 with Three.js watercolor effect');
      }

      // Initialize scene controller
      this.sceneController = new SceneController(this.threeManager);
      this.sceneController.start();
    } catch (error) {
      console.error('Failed to initialize WebGL:', error);
      canvas.style.display = 'none';
    }
  }

  /**
   * Initialize navigation
   */
  initNavigation(): void {
    const menuTrigger = document.querySelector<HTMLButtonElement>('[data-menu-trigger]');
    const dropdownMenu = document.querySelector<HTMLElement>('[data-dropdown-menu]');
    const dropdownLinks = dropdownMenu?.querySelectorAll<HTMLAnchorElement>('.dropdown-link');

    if (!menuTrigger || !dropdownMenu) return;

    const openMenu = () => {
      dropdownMenu.classList.add('active');
      dropdownMenu.setAttribute('aria-hidden', 'false');
      menuTrigger.classList.add('active');
    };

    const closeMenu = () => {
      dropdownMenu.classList.remove('active');
      dropdownMenu.setAttribute('aria-hidden', 'true');
      menuTrigger.classList.remove('active');
    };

    // Toggle menu on trigger click
    menuTrigger.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const isActive = dropdownMenu.classList.contains('active');
      if (isActive) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close menu when clicking a link
    dropdownLinks?.forEach(link => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dropdownMenu.classList.contains('active')) {
        closeMenu();
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e: Event) => {
      if (!dropdownMenu.classList.contains('active')) return;

      const target = e.target as HTMLElement;
      const isInsideMenu = dropdownMenu.contains(target);
      const isTrigger = menuTrigger.contains(target);

      if (!isInsideMenu && !isTrigger) {
        closeMenu();
      }
    });
  }

  /**
   * Initialize scroll effects
   */
  initScrollEffects(): void {
    // Scroll effects can be added here if needed
    // Currently handled by section indicators
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
      threshold: 0.05,
      rootMargin: '0px 0px 0px 0px'
    });

    // Small delay to let CSS animations complete their initial state
    requestAnimationFrame(() => {
      revealElements.forEach(el => observer.observe(el));
    });
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
   * Initialize project expand/collapse toggles
   */
  initProjectToggles(): void {
    const projectToggles = document.querySelectorAll<HTMLButtonElement>('[data-project-toggle]');

    projectToggles.forEach(toggle => {
      toggle.addEventListener('click', () => {
        const project = toggle.closest('[data-project]');
        const details = project?.querySelector('[data-project-details]') as HTMLElement | null;

        if (!project || !details) return;

        const isExpanded = project.getAttribute('data-expanded') === 'true';

        if (isExpanded) {
          // Collapse
          project.setAttribute('data-expanded', 'false');
          toggle.setAttribute('aria-expanded', 'false');
          details.hidden = true;
        } else {
          // Expand
          project.setAttribute('data-expanded', 'true');
          toggle.setAttribute('aria-expanded', 'true');
          details.hidden = false;
        }
      });
    });
  }

  /**
   * Handle window resize
   */
  handleResize(): void {
    if (this.threeManager) {
      this.threeManager.resize();
    }
  }

  /**
   * Clean up
   */
  dispose(): void {
    if (this.sceneController) {
      this.sceneController.dispose();
    }
    if (this.threeManager) {
      this.threeManager.dispose();
    }
  }
}

// Initialize portfolio
const portfolio = new Portfolio();

// Make available globally for debugging
window.portfolio = portfolio;
