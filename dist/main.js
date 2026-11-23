/*!
 * Menting – main.js
 * Geladen in Webflow via jsDelivr: https://cdn.jsdelivr.net/gh/dondrs/menting@main/dist/main.js
 * Vereist GSAP (wordt vóór dit bestand geladen in de site-footer). Zonder GSAP werkt het menu nog, maar zonder animatie.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Full page menu
   * Markup (Webflow component "Navbar"):
   *   [data-navbar]             header
   *     [data-menu-toggle]      menuknop (link met role="button")
   *     [data-menu]             full page menu
   * ------------------------------------------------------------------ */
  function initMenu(navbar) {
    var menu = navbar.querySelector('[data-menu]');
    var toggle = navbar.querySelector('[data-menu-toggle]');
    if (!menu || !toggle) return;

    var gsap = window.gsap;
    var root = document.documentElement;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = menu.querySelectorAll('.menu__item');
    var footer = menu.querySelector('.menu__footer');
    var lines = toggle.querySelectorAll('.navbar__button-line');
    var isOpen = false;
    var timeline = null;

    setClosedA11y();

    function setClosedA11y() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menu openen');
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
    }

    function setOpenA11y() {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Menu sluiten');
      menu.setAttribute('aria-hidden', 'false');
      menu.inert = false;
    }

    // Afstand tussen de hamburgerlijnen meten, zodat het kruisje precies klopt.
    function lineOffset() {
      if (lines.length < 3) return 0;
      return lines[1].offsetTop - lines[0].offsetTop;
    }

    function buildTimeline() {
      var offset = lineOffset();
      var tl = gsap.timeline({
        paused: true,
        defaults: { ease: 'power3.out' },
        onReverseComplete: function () {
          gsap.set(menu, { display: 'none' });
        }
      });

      tl.set(menu, { display: 'flex' })
        .fromTo(menu,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power3.inOut' }, 0)
        .fromTo(items,
          { yPercent: 60, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06 }, 0.35)
        .fromTo(footer,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.5 }, 0.6);

      if (lines.length >= 3) {
        tl.to(lines[0], { y: offset, rotate: 45, duration: 0.4, ease: 'power2.inOut' }, 0)
          .to(lines[1], { autoAlpha: 0, duration: 0.2 }, 0)
          .to(lines[2], { y: -offset, rotate: -45, duration: 0.4, ease: 'power2.inOut' }, 0);
      }
      return tl;
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      navbar.classList.add('is-menu-open');
      root.classList.add('is-menu-locked');
      setOpenA11y();

      if (gsap && !reducedMotion) {
        if (!timeline) timeline = buildTimeline();
        timeline.timeScale(1).play();
      } else {
        menu.style.display = 'flex';
      }
      // Focus blijft op de menuknop (die nu "Menu sluiten" heet); Tab gaat daarna het menu in.
    }

    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      navbar.classList.remove('is-menu-open');
      root.classList.remove('is-menu-locked');
      setClosedA11y();

      if (gsap && !reducedMotion && timeline) {
        timeline.timeScale(1.6).reverse();
      } else {
        menu.style.display = 'none';
      }

      if (returnFocus !== false) toggle.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent('menting:navbar-update'));
    }

    toggle.addEventListener('click', function (event) {
      event.preventDefault();
      if (isOpen) close(); else open();
    });

    // De knop is een link met role="button": spatiebalk moet ook werken.
    toggle.addEventListener('keydown', function (event) {
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        toggle.click();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!isOpen) return;

      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        close();
        return;
      }

      // Focus binnen navbar + menu houden zolang het menu open is.
      if (event.key === 'Tab') {
        var focusables = Array.prototype.filter.call(
          navbar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
          function (el) { return el.offsetParent !== null || el === toggle; }
        );
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Klik op een link in het menu: menu sluiten (belangrijk voor ankers op dezelfde pagina).
    menu.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      if (link) close(false);
    });
  }

  /* ------------------------------------------------------------------
   * Logo-kleur op lichte/donkere achtergrond
   * Kijkt wat er onder het midden van het logo ligt:
   *   1. data-nav-theme="light" | "dark" op een sectie wint altijd;
   *   2. foto of video  -> donker (licht logo);
   *   3. anders de achtergrondkleur (helderheid).
   * Op een lichte achtergrond krijgt de navbar de class "is-on-light".
   * ------------------------------------------------------------------ */
  function initLogoTheme(navbar) {
    var logo = navbar.querySelector('.navbar__logo');
    if (!logo || !document.elementsFromPoint) return;

    var ticking = false;

    function parseColor(value) {
      var match = value && value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      var parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }

    function isLightColor(c) {
      // Relatieve helderheid (WCAG)
      var lin = [c.r, c.g, c.b].map(function (v) {
        v = v / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return (0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]) > 0.4;
    }

    function backgroundIsLight(el) {
      var themed = el.closest('[data-nav-theme]');
      if (themed) return themed.getAttribute('data-nav-theme') === 'light';

      for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
        var tag = node.tagName;
        if (tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE' || tag === 'CANVAS') return false;

        var style = window.getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage.indexOf('url(') !== -1) return false;

        var color = parseColor(style.backgroundColor);
        if (color && color.a >= 0.5) return isLightColor(color);
      }
      return true; // standaard: witte pagina
    }

    function update() {
      ticking = false;
      if (navbar.classList.contains('is-menu-open')) return;

      var rect = logo.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;
      var stack = document.elementsFromPoint(x, y);
      var below = null;
      for (var i = 0; i < stack.length; i++) {
        if (!navbar.contains(stack[i])) { below = stack[i]; break; }
      }
      navbar.classList.toggle('is-on-light', below ? backgroundIsLight(below) : true);
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('load', requestUpdate);
    document.addEventListener('menting:navbar-update', requestUpdate);
    update();
  }

  function init() {
    var navbar = document.querySelector('[data-navbar]');
    if (!navbar) return;
    initMenu(navbar);
    initLogoTheme(navbar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
