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

/**
 * LoadingManager - Orchestrates asset loading and controls loader visibility
 */
class LoadingManager {
  private loader: HTMLElement | null;
  private body: HTMLElement;
  private timeout = 8000; // 8 second max wait
  private minDisplayTime = 300; // Minimum loader display time (prevents flash on cached loads)
  private startTime: number;
  private prefersReducedMotion: boolean;

  // Mobile warning elements and config
  private loaderText: HTMLElement | null;
  private mobileWarning: HTMLElement | null;
  private mobileWarningBtn: HTMLElement | null;
  private static readonly MOBILE_WARNING_KEY = 'portfolio-mobile-warning-dismissed';
  private static readonly PHONE_THRESHOLD = 480; // px - smaller dimension threshold for phones

  constructor() {
    this.loader = document.querySelector('.site-loader');
    this.loaderText = document.querySelector('.loader-text');
    this.mobileWarning = document.querySelector('.mobile-warning');
    this.mobileWarningBtn = document.querySelector('.mobile-warning-btn');
    this.body = document.body;
    this.startTime = performance.now();
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Check if device is a phone based on screen dimensions
   * Uses the smaller dimension to catch both portrait and landscape orientations
   */
  private isPhone(): boolean {
    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    return smallerDimension < LoadingManager.PHONE_THRESHOLD;
  }

  /**
   * Check if user has previously dismissed the mobile warning
   */
  private wasWarningDismissed(): boolean {
    try {
      return localStorage.getItem(LoadingManager.MOBILE_WARNING_KEY) === 'true';
    } catch {
      // localStorage not available
      return false;
    }
  }

  /**
   * Save warning dismissal to localStorage
   */
  private saveWarningDismissal(): void {
    try {
      localStorage.setItem(LoadingManager.MOBILE_WARNING_KEY, 'true');
    } catch {
      // localStorage not available, continue anyway
    }
  }

  /**
   * Show mobile warning and set up dismissal handler
   */
  private showMobileWarning(onDismiss: () => void): void {
    if (!this.mobileWarning || !this.mobileWarningBtn || !this.loaderText) {
      onDismiss();
      return;
    }

    // Hide loading text, show warning
    this.loaderText.style.display = 'none';
    this.mobileWarning.classList.add('is-visible');
    this.mobileWarning.setAttribute('aria-hidden', 'false');

    // Handle dismissal
    const handleDismiss = (): void => {
      this.saveWarningDismissal();
      this.mobileWarningBtn?.removeEventListener('click', handleDismiss);
      onDismiss();
    };

    this.mobileWarningBtn.addEventListener('click', handleDismiss);
  }

  /**
   * Wait for all critical assets to load
   */
  async waitForAssets(threeManager: ThreeManager | null): Promise<void> {
    const promises: Promise<unknown>[] = [
      document.fonts.ready,
      this.waitForFirstFrame(),
    ];

    // Wait for background image if WebGL is enabled
    if (threeManager) {
      promises.push(threeManager.imageLoaded);
    }

    // Race between all assets loading and timeout
    await Promise.race([
      Promise.all(promises),
      this.timeoutPromise(),
    ]);

    // Ensure minimum display time to prevent jarring flash on cached loads
    await this.ensureMinDisplayTime();
  }

  /**
   * Wait for first frame to render (ensures GPU has compiled shaders)
   */
  private waitForFirstFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  /**
   * Timeout fallback to prevent infinite loading
   */
  private timeoutPromise(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.timeout));
  }

  /**
   * Ensure loader is displayed for minimum time to prevent flash
   */
  private async ensureMinDisplayTime(): Promise<void> {
    const elapsed = performance.now() - this.startTime;
    const remaining = this.minDisplayTime - elapsed;

    if (remaining > 0 && !this.prefersReducedMotion) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  /**
   * Hide loader and reveal content (internal method)
   */
  private doReveal(): void {
    if (this.prefersReducedMotion) {
      // Instant reveal for reduced motion preference
      this.loader?.classList.add('is-hidden');
      this.body.removeAttribute('data-loading');
      // Remove loader from DOM after hiding
      setTimeout(() => this.loader?.remove(), 0);
    } else {
      // Animated reveal
      this.loader?.classList.add('is-hidden');
      this.body.removeAttribute('data-loading');
      // Remove loader from DOM after transition completes
      setTimeout(() => this.loader?.remove(), 600);
    }
  }

  /**
   * Handle loading completion - check for phone and show warning if needed
   */
  reveal(): void {
    // Check if phone and warning not previously dismissed
    if (this.isPhone() && !this.wasWarningDismissed()) {
      this.showMobileWarning(() => this.doReveal());
    } else {
      this.doReveal();
    }
  }
}

class Portfolio {
  threeManager: ThreeManager | null = null;
  sceneController: SceneController | null = null;
  loadingManager: LoadingManager | null = null;
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
  async setup(): Promise<void> {
    // Initialize loading manager
    this.loadingManager = new LoadingManager();

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

    // Wait for all assets to load before revealing content
    await this.loadingManager.waitForAssets(this.threeManager);
    this.loadingManager.reveal();

    // Initialize UI components after reveal
    this.initNavigation();
    this.initScrollEffects();
    this.initRevealAnimations();
    this.initSmoothScroll();
    this.initProjectToggles();
    this.initProjectNavigation();
    this.initProjectAccordion();
    this.initExperiencePanel();
    this.initSkillsInteraction();

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
      console.log('Mobile mode:', this.threeManager.isMobile);

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
   * Initialize project section navigation
   * Shows/hides nav elements when in project zone
   * Manages active states and click handlers
   */
  initProjectNavigation(): void {
    const sideNav = document.querySelector<HTMLElement>('[data-project-nav]');
    const dotsNav = document.querySelector<HTMLElement>('[data-project-dots]');
    const projectSections = document.querySelectorAll<HTMLElement>('[data-project-section]');
    const sideNavItems = sideNav?.querySelectorAll<HTMLAnchorElement>('[data-nav-target]');
    const dotButtons = dotsNav?.querySelectorAll<HTMLButtonElement>('[data-dot-target]');

    if (!sideNav || !dotsNav || projectSections.length === 0) return;

    let currentProjectNum: string | null = null;

    // Update active states on navigation elements
    const setActiveProject = (projectNum: string | null): void => {
      currentProjectNum = projectNum;

      // Update side nav items
      sideNavItems?.forEach(item => {
        const target = item.getAttribute('data-nav-target');
        if (target === projectNum) {
          item.classList.add('is-active');
        } else {
          item.classList.remove('is-active');
        }
      });

      // Update dot buttons
      dotButtons?.forEach(dot => {
        const target = dot.getAttribute('data-dot-target');
        if (target === projectNum) {
          dot.classList.add('is-active');
        } else {
          dot.classList.remove('is-active');
        }
      });
    };

    // Show/hide navigation based on whether we're in project zone
    const setNavVisibility = (visible: boolean): void => {
      if (visible) {
        sideNav.classList.add('is-visible');
        dotsNav.classList.add('is-visible');
      } else {
        sideNav.classList.remove('is-visible');
        dotsNav.classList.remove('is-visible');
      }
    };

    // Intersection Observer for project sections - shows nav only on individual projects
    const projectObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const projectNum = entry.target.getAttribute('data-project-section');
          if (projectNum) {
            setActiveProject(projectNum);
            setNavVisibility(true);
          }
        }
      });
    }, {
      root: null,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    });

    // Observer for sections that should hide the nav (all non-individual-project sections)
    const hideNavSections = [
      document.getElementById('hero'),
      document.getElementById('experience'),
      document.getElementById('skills'),
      document.getElementById('projects-index'),
      document.getElementById('contact')
    ].filter(Boolean) as HTMLElement[];

    const hideNavObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Hide nav when on non-project sections
          setNavVisibility(false);
          setActiveProject(null);
        }
      });
    }, {
      root: null,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    });

    // Start observing
    projectSections.forEach(section => projectObserver.observe(section));
    hideNavSections.forEach(section => hideNavObserver.observe(section));

    // Click handlers for side nav
    sideNavItems?.forEach(item => {
      item.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        const target = item.getAttribute('data-nav-target');
        const section = document.querySelector(`[data-project-section="${target}"]`);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Click handlers for dots nav
    dotButtons?.forEach(dot => {
      dot.addEventListener('click', () => {
        const target = dot.getAttribute('data-dot-target');
        const section = document.querySelector(`[data-project-section="${target}"]`);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // On mobile, auto-expand the project accordion after scrolling
          if (window.innerWidth < 1024) {
            setTimeout(() => {
              const projectArticle = section.querySelector<HTMLElement>('[data-project-article]');
              if (projectArticle && !projectArticle.classList.contains('is-expanded')) {
                projectArticle.click();
              }
            }, 400); // Wait for scroll to complete
          }
        }
      });
    });
  }

  /**
   * Initialize project accordion for mobile
   * Collapsed: shows teaser; Expanded: shows full content
   * Single-item-expanded-at-a-time pattern
   */
  initProjectAccordion(): void {
    const projectArticles = document.querySelectorAll<HTMLElement>('[data-project-article]');

    if (projectArticles.length === 0) return;

    // Helper: Extract first sentence from description
    const getFirstSentence = (text: string): string => {
      const match = text.match(/^[^.!?]+[.!?]/);
      return match ? match[0].trim() : text.slice(0, 100) + '...';
    };

    // Create teaser elements for each project
    projectArticles.forEach(article => {
      const description = article.querySelector('.project-description');
      if (!description) return;

      // Extract teaser text (first sentence)
      const fullText = description.textContent || '';
      const teaserText = getFirstSentence(fullText);

      // Create teaser element
      const teaser = document.createElement('p');
      teaser.className = 'project-teaser';
      teaser.textContent = teaserText;

      // Insert teaser after header
      const header = article.querySelector('.project-article-header');
      if (header) {
        header.insertAdjacentElement('afterend', teaser);
      }
    });

    // Toggle accordion on click
    const toggleAccordion = (article: HTMLElement): void => {
      const isExpanded = article.classList.contains('is-expanded');

      // Collapse all others (single-item-expanded pattern)
      projectArticles.forEach(other => {
        if (other !== article) {
          other.classList.remove('is-expanded');
        }
      });

      // Toggle current
      if (isExpanded) {
        article.classList.remove('is-expanded');
      } else {
        article.classList.add('is-expanded');

        // Scroll into view after expansion animation
        setTimeout(() => {
          article.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    };

    // Click handler for each article
    projectArticles.forEach(article => {
      article.addEventListener('click', (e: MouseEvent) => {
        // Skip toggle if clicking a link
        const target = e.target as HTMLElement;
        if (target.closest('a')) return;

        // Only toggle on mobile (< 1024px)
        if (window.innerWidth >= 1024) return;

        toggleAccordion(article);
      });
    });
  }

  /**
   * Initialize experience panel interactions
   * Desktop: hover shows panel, click pins it
   * Mobile: click expands accordion inline
   */
  initExperiencePanel(): void {
    const panel = document.querySelector<HTMLElement>('[data-experience-panel]');
    const closeBtn = document.querySelector<HTMLButtonElement>('[data-panel-close]');
    const experienceItems = document.querySelectorAll<HTMLElement>('[data-experience]');

    if (!panel || experienceItems.length === 0) return;

    // Panel element references
    const panelTitle = panel.querySelector<HTMLElement>('[data-panel-title]');
    const panelCompany = panel.querySelector<HTMLElement>('[data-panel-company]');
    const panelDuration = panel.querySelector<HTMLElement>('[data-panel-duration]');
    const panelResponsibilities = panel.querySelector<HTMLUListElement>('[data-panel-responsibilities]');
    const panelTech = panel.querySelector<HTMLElement>('[data-panel-tech]');
    const panelLink = panel.querySelector<HTMLAnchorElement>('[data-panel-link]');

    let pinnedItem: HTMLElement | null = null;
    let isDesktop = window.innerWidth >= 1024;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    let isHoveringAnyItem = false;

    const PANEL_LINGER_DURATION = 1000; // 1 second before fade

    // Clear any pending hide timeout
    const clearHideTimeout = (): void => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    // Update panel content from experience item
    const updatePanelContent = (item: HTMLElement): void => {
      const detailContent = item.querySelector('.experience-detail-content');
      if (!detailContent) return;

      const title = detailContent.querySelector('[data-title]')?.textContent || '';
      const company = detailContent.querySelector('[data-company]')?.textContent || '';
      const duration = detailContent.querySelector('[data-duration]')?.textContent || '';
      const website = detailContent.querySelector('[data-website]')?.textContent || '';
      const tech = detailContent.querySelector('[data-tech]')?.textContent || '';
      const responsibilities = detailContent.querySelector('[data-responsibilities]');

      if (panelTitle) panelTitle.textContent = title;
      if (panelCompany) panelCompany.textContent = company;
      if (panelDuration) panelDuration.textContent = duration;
      if (panelTech) panelTech.textContent = tech;

      if (panelLink) {
        panelLink.href = website;
        panelLink.style.display = website ? 'inline-flex' : 'none';
      }

      if (panelResponsibilities && responsibilities) {
        panelResponsibilities.innerHTML = responsibilities.innerHTML;
      }
    };

    // Show panel (desktop)
    const showPanel = (item: HTMLElement): void => {
      clearHideTimeout();
      updatePanelContent(item);
      panel.classList.add('is-visible');
      panel.setAttribute('aria-hidden', 'false');
    };

    // Schedule panel hide with delay (desktop)
    const scheduleHidePanel = (): void => {
      if (pinnedItem || isHoveringAnyItem) return; // Don't hide if pinned or still hovering

      clearHideTimeout();
      hideTimeout = setTimeout(() => {
        if (!pinnedItem && !isHoveringAnyItem) {
          panel.classList.remove('is-visible');
          panel.setAttribute('aria-hidden', 'true');
        }
      }, PANEL_LINGER_DURATION);
    };

    // Hide panel immediately (used for close button)
    const hidePanel = (): void => {
      clearHideTimeout();
      panel.classList.remove('is-visible');
      panel.setAttribute('aria-hidden', 'true');
    };

    // Pin panel (desktop)
    const pinPanel = (item: HTMLElement): void => {
      clearHideTimeout();

      // Unpin previous
      if (pinnedItem && pinnedItem !== item) {
        pinnedItem.classList.remove('is-active');
      }

      if (pinnedItem === item) {
        // Unpin current
        pinnedItem.classList.remove('is-active');
        pinnedItem = null;
        panel.classList.remove('is-pinned');
        // Schedule hide since we're unpinning
        scheduleHidePanel();
      } else {
        // Pin new
        pinnedItem = item;
        item.classList.add('is-active');
        panel.classList.add('is-pinned');
        updatePanelContent(item);
      }
    };

    // Close panel completely
    const closePanel = (): void => {
      clearHideTimeout();
      if (pinnedItem) {
        pinnedItem.classList.remove('is-active');
        pinnedItem = null;
      }
      panel.classList.remove('is-visible', 'is-pinned');
      panel.setAttribute('aria-hidden', 'true');
    };

    // Generate accordion content for mobile
    const generateAccordion = (item: HTMLElement): HTMLElement | null => {
      const detailContent = item.querySelector('.experience-detail-content');
      if (!detailContent) return null;

      const duration = detailContent.querySelector('[data-duration]')?.textContent || '';
      const website = detailContent.querySelector('[data-website]')?.textContent || '';
      const tech = detailContent.querySelector('[data-tech]')?.textContent || '';
      const responsibilities = detailContent.querySelector('[data-responsibilities]');

      const accordion = document.createElement('div');
      accordion.className = 'experience-accordion';

      accordion.innerHTML = `
        <div class="experience-accordion-section">
          <h4 class="experience-accordion-title">Duration</h4>
          <p class="experience-accordion-content">${duration}</p>
        </div>
        <div class="experience-accordion-section">
          <h4 class="experience-accordion-title">Responsibilities</h4>
          <ul class="experience-accordion-list">${responsibilities?.innerHTML || ''}</ul>
        </div>
        <div class="experience-accordion-section">
          <h4 class="experience-accordion-title">Tech Stack</h4>
          <p class="experience-accordion-content">${tech}</p>
        </div>
        ${website ? `
        <div class="experience-accordion-section">
          <a href="${website}" target="_blank" rel="noopener noreferrer" class="experience-accordion-link">
            Visit Company
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
          </a>
        </div>` : ''}
      `;

      return accordion;
    };

    // Toggle mobile accordion
    const toggleAccordion = (item: HTMLElement): void => {
      const isExpanded = item.classList.contains('is-expanded');

      // Collapse all others
      experienceItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('is-expanded')) {
          otherItem.classList.remove('is-expanded');
          const accordion = otherItem.querySelector('.experience-accordion');
          if (accordion) accordion.remove();
        }
      });

      if (isExpanded) {
        // Collapse
        item.classList.remove('is-expanded');
        const accordion = item.querySelector('.experience-accordion');
        if (accordion) accordion.remove();
      } else {
        // Expand
        item.classList.add('is-expanded');
        if (!item.querySelector('.experience-accordion')) {
          const accordion = generateAccordion(item);
          if (accordion) item.appendChild(accordion);
        }
      }
    };

    // Handle resize
    const handleResize = (): void => {
      const wasDesktop = isDesktop;
      isDesktop = window.innerWidth >= 1024;

      if (wasDesktop !== isDesktop) {
        // Clean up when switching modes
        clearHideTimeout();
        isHoveringAnyItem = false;
        closePanel();
        experienceItems.forEach(item => {
          item.classList.remove('is-expanded', 'is-active');
          const accordion = item.querySelector('.experience-accordion');
          if (accordion) accordion.remove();
        });
      }
    };

    // Event listeners for each experience item
    experienceItems.forEach(item => {
      // Desktop: hover events
      item.addEventListener('mouseenter', () => {
        if (isDesktop) {
          isHoveringAnyItem = true;
          clearHideTimeout();
          if (!pinnedItem) {
            showPanel(item);
          }
        }
      });

      item.addEventListener('mouseleave', () => {
        if (isDesktop) {
          isHoveringAnyItem = false;
          scheduleHidePanel();
        }
      });

      // Both: click events
      item.addEventListener('click', () => {
        if (isDesktop) {
          pinPanel(item);
        } else {
          toggleAccordion(item);
        }
      });
    });

    // Close button
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });

    // Panel hover - keep visible while mouse is over panel
    panel.addEventListener('mouseenter', () => {
      if (isDesktop) {
        clearHideTimeout();
      }
    });

    panel.addEventListener('mouseleave', () => {
      if (isDesktop && !pinnedItem) {
        scheduleHidePanel();
      }
    });

    // Listen for resize
    window.addEventListener('resize', handleResize);
  }

  /**
   * Initialize skills section interactions
   * Click/tap expands skill item inline (accordion style)
   */
  initSkillsInteraction(): void {
    const skillItems = document.querySelectorAll<HTMLButtonElement>('[data-skill]');

    if (skillItems.length === 0) return;

    // Toggle inline expansion
    const toggleExpansion = (item: HTMLButtonElement): void => {
      const isExpanded = item.classList.contains('is-expanded');

      // Collapse all other items
      skillItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('is-expanded');
        }
      });

      // Toggle current item
      if (isExpanded) {
        item.classList.remove('is-expanded');
      } else {
        item.classList.add('is-expanded');

        // Scroll item into view if needed
        setTimeout(() => {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    };

    // Event listeners for each skill item
    skillItems.forEach(item => {
      // Click/tap to expand
      item.addEventListener('click', () => {
        toggleExpansion(item);
      });

      // Keyboard: Enter/Space to expand
      item.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleExpansion(item);
        }
      });
    });

    // Close on escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skillItems.forEach(item => item.classList.remove('is-expanded'));
      }
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
