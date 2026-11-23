/*!
 * Menting – main.js
 * Geladen in Webflow via jsDelivr: https://cdn.jsdelivr.net/gh/dondrs/menting@main/dist/main.js
 * Vereist GSAP (wordt vóór dit bestand geladen in de site-footer). Zonder GSAP werkt het menu nog, maar zonder animatie.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Full page menu (gevoel naar vv-ebc.webflow.io)
   * Markup (Webflow component "Navbar"):
   *   [data-navbar]             header
   *     [data-menu-toggle]      menuknop (link met role="button")
   *     [data-menu-layers]      wrapper met [data-menu-layer] wipe-lagen
   *     [data-menu]             full page menu
   * Openen: lagen schuiven snel maar soepel gestaffeld vanaf de bovenkant in beeld,
   * daarna het menu; dan draaien de links omhoog in beeld en faden de footer-items in.
   * Sluiten: alles schuift in omgekeerde volgorde terug naar boven.
   * ------------------------------------------------------------------ */
  function initMenu(navbar) {
    var menu = navbar.querySelector('[data-menu]');
    var toggle = navbar.querySelector('[data-menu-toggle]');
    if (!menu || !toggle) return;

    var gsap = window.gsap;
    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var layerWrap = navbar.querySelector('[data-menu-layers]');
    var layers = Array.prototype.slice.call(navbar.querySelectorAll('[data-menu-layer]'));
    var linkParts = menu.querySelectorAll('.menu__number, .menu__label');
    var fades = menu.querySelectorAll('.menu__credit, .menu__legal-item');
    var isOpen = false;
    var tl = null;

    // Timing: vlug maar smooth
    var T = { wipe: 0.55, wipeStagger: 0.07, links: 0.9, linkStagger: 0.05, close: 0.45 };

    function show(display) {
      if (layerWrap) layerWrap.style.display = display ? 'block' : 'none';
      menu.style.display = display ? 'flex' : 'none';
    }

    function setA11y(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      menu.inert = !open;
    }
    setA11y(false);

    if (gsap) gsap.set(layers.concat(menu), { yPercent: -101 });

    // Tijdens de wipe per frame kijken welke laag onder het logo ligt:
    // op de lichtgroene laag wordt het logo donker, op de andere lagen/het menu licht.
    // Ligt er niets meer onder (bij sluiten), dan volgt het logo weer de pagina.
    var logo = navbar.querySelector('.navbar__logo');
    function logoDark(on) { navbar.classList.toggle('is-logo-dark', on); }
    function layerUnderLogo() {
      if (!logo) return null;
      var r = logo.getBoundingClientRect();
      var y = r.top + r.height / 2;
      var stack = [menu].concat(layers.slice().reverse()); // bovenste eerst
      for (var i = 0; i < stack.length; i++) {
        if (stack[i].getBoundingClientRect().bottom >= y) return stack[i];
      }
      return null;
    }
    function syncLogo() {
      var top = layerUnderLogo();
      logoDark(top !== null && top === layers[0]);
      if (!isOpen && top === null && navbar.classList.contains('is-menu-open')) {
        // Direct naar de paginakleur, zonder de normale kleur-transitie.
        if (logo) {
          logo.style.transition = 'none';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { logo.style.transition = ''; });
          });
        }
        navbar.classList.remove('is-menu-open');
        document.dispatchEvent(new CustomEvent('menting:navbar-update'));
      }
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      logoDark(false);
      navbar.classList.add('is-menu-open');
      root.classList.add('is-menu-locked');
      setA11y(true);
      show(true);

      if (!gsap) return;
      if (tl) tl.kill();
      if (reduce) {
        gsap.set(layers.concat(menu), { yPercent: 0 });
        return;
      }
      tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onUpdate: syncLogo })
        .fromTo(layers, { yPercent: -101 }, { yPercent: 0, duration: T.wipe, stagger: T.wipeStagger, ease: 'power3.inOut' }, 0)
        .fromTo(menu, { yPercent: -101 }, { yPercent: 0, duration: T.wipe, ease: 'power3.inOut' }, T.wipeStagger * layers.length)
        .fromTo(linkParts, { yPercent: 140, rotate: 10 }, { yPercent: 0, rotate: 0, duration: T.links, stagger: T.linkStagger }, 0.35)
        .fromTo(fades, { autoAlpha: 0, yPercent: 50 }, { autoAlpha: 1, yPercent: 0, duration: 0.6, stagger: 0.04 }, 0.45);
    }

    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove('is-menu-locked');
      setA11y(false);

      var done = function () {
        logoDark(false);
        navbar.classList.remove('is-menu-open');
        show(false);
        document.dispatchEvent(new CustomEvent('menting:navbar-update'));
      };
      if (returnFocus !== false) toggle.focus({ preventScroll: true });

      if (!gsap || reduce) {
        if (gsap) gsap.set(layers.concat(menu), { yPercent: -101 });
        done();
        return;
      }
      if (tl) tl.kill();
      tl = gsap.timeline({ onComplete: done, onUpdate: syncLogo })
        .to([menu].concat(layers.slice().reverse()), { yPercent: -101, duration: T.close, stagger: 0.04, ease: 'power3.inOut' }, 0);
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

      // Focus binnen menuknop + menu houden zolang het menu open is.
      if (event.key === 'Tab') {
        var focusables = [toggle].concat(Array.prototype.slice.call(
          menu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ));
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
      if (event.target.closest('a[href]')) close(false);
    });

    return {
      open: open,
      close: close,
      isOpen: function () { return isOpen; }
    };
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

    return { update: requestUpdate };
  }

  /* ------------------------------------------------------------------
   * Init + API voor pagina-overgangen (Barba.js)
   * De navbar staat buiten [data-barba="container"] en blijft dus tussen pagina's
   * bestaan: alles wordt maar één keer gekoppeld.
   * window.MentingNav = { open(), close(returnFocus), isOpen(), update() }
   * Is Barba aanwezig, dan sluit het menu bij vertrek en wordt de logo-kleur
   * na de wissel opnieuw bepaald. Anders zelf aanroepen in de Barba-hooks.
   * ------------------------------------------------------------------ */
  function connectBarba(nav) {
    var barba = window.barba;
    if (!barba || !barba.hooks || nav._barbaConnected) return;
    nav._barbaConnected = true;
    barba.hooks.beforeLeave(function () { nav.close(false); });
    barba.hooks.after(function () { nav.update(); });
  }

  function init() {
    var navbar = document.querySelector('[data-navbar]');
    if (!navbar || navbar.hasAttribute('data-navbar-ready')) return;
    navbar.setAttribute('data-navbar-ready', '');

    var menuApi = initMenu(navbar) || {};
    var themeApi = initLogoTheme(navbar) || {};
    var noop = function () {};

    var nav = window.MentingNav = {
      open: menuApi.open || noop,
      close: menuApi.close || noop,
      isOpen: menuApi.isOpen || function () { return false; },
      update: themeApi.update || noop,
      connectBarba: function () { connectBarba(nav); }
    };

    connectBarba(nav);
    window.addEventListener('load', function () { connectBarba(nav); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
