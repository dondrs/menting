/*!
 * Menting – main.js
 * Geladen in Webflow via jsDelivr: https://cdn.jsdelivr.net/gh/dondrs/menting@main/dist/main.js
 * Vereist GSAP (wordt vóór dit bestand geladen in de site-footer). Zonder GSAP werkt het menu nog, maar zonder animatie.
 * De scroll-bloem laadt lottie-web zelf (alleen op pagina's met [data-bloem-lottie]).
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
    barba.hooks.after(function () { nav.update(); initBloemen(); });
  }

  /* ------------------------------------------------------------------
   * Bloem op scroll (Lottie)
   * Markup (homepage, sectie "Werken & Leren"):
   *   [data-bloem-section]                       de sectie
   *     [data-bloem-lottie="<url naar .json>"]   container voor de Lottie
   * De bloem gaat open zodra de container onderin beeld komt en is helemaal open
   * als de onderkant van de sectie de onderkant van het scherm raakt.
   * Terugscrollen = de bloem gaat weer dicht (frame volgt de scrollpositie).
   * lottie-web wordt pas geladen als de bloem in de buurt komt (JSON is ~11 MB).
   * Bij prefers-reduced-motion staat de bloem direct open, zonder scroll-koppeling.
   * ------------------------------------------------------------------ */
  var LOTTIE_SRC = 'https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie_light.min.js';
  var lottieLoading = null;

  function loadLottie() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (lottieLoading) return lottieLoading;
    lottieLoading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = LOTTIE_SRC;
      script.async = true;
      script.onload = function () { window.lottie ? resolve(window.lottie) : reject(new Error('lottie ontbreekt')); };
      script.onerror = function () { lottieLoading = null; reject(new Error('lottie niet geladen')); };
      document.head.appendChild(script);
    });
    return lottieLoading;
  }

  var bloemen = [];

  function initBloem(container) {
    if (container.hasAttribute('data-bloem-ready')) return;
    container.setAttribute('data-bloem-ready', '');

    var src = container.getAttribute('data-bloem-lottie');
    if (!src) return;
    var section = container.closest('[data-bloem-section]') || container.parentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var state = {
      container: container,
      anim: null,
      last: 0,          // laatste frame-index
      current: 0,       // huidig (vloeiend) frame
      target: 0,        // doel-frame volgens scrollpositie
      raf: 0,
      destroyed: false,
      observer: null
    };

    // 0 = container komt onderin beeld, 1 = onderkant sectie raakt onderkant scherm.
    function progress() {
      var vh = window.innerHeight;
      var flowerTop = container.getBoundingClientRect().top;
      var sectionBottom = section.getBoundingClientRect().bottom;
      var distance = Math.max(sectionBottom - flowerTop, vh * 0.5);
      var p = (vh - flowerTop) / distance;
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }

    function render() {
      state.raf = 0;
      if (!state.anim || state.destroyed) return;
      // Licht naijlen voor een zachte beweging; dichtbij het doel direct vastzetten.
      var diff = state.target - state.current;
      state.current = Math.abs(diff) < 0.5 ? state.target : state.current + diff * 0.18;
      var frame = Math.round(state.current);
      if (frame !== state.last) {
        state.anim.goToAndStop(frame, true);
        state.last = frame;
      }
      if (state.current !== state.target) state.raf = requestAnimationFrame(render);
    }

    function update() {
      if (!state.anim || state.destroyed) return;
      state.target = progress() * (state.anim.totalFrames - 1);
      if (!state.raf) state.raf = requestAnimationFrame(render);
    }

    function start() {
      var data = fetch(src).then(function (res) {
        if (!res.ok) throw new Error('bloem-json ' + res.status);
        return res.json();
      });
      Promise.all([loadLottie(), data]).then(function (result) {
        var lottie = result[0];
        var animationData = result[1];
        if (state.destroyed) return;
        // De beelden zitten als data-URI in de JSON maar staan gemarkeerd als extern (e: 0);
        // dan plakt lottie er een pad voor en mislukt het laden. Markeer ze als ingebed.
        (animationData.assets || []).forEach(function (asset) {
          if (typeof asset.p === 'string' && asset.p.indexOf('data:') === 0) {
            asset.e = 1;
            asset.u = '';
          }
        });
        state.anim = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: animationData,
          rendererSettings: { preserveAspectRatio: 'xMidYMax meet' }
        });
        state.anim.addEventListener('DOMLoaded', function () {
          var last = state.anim.totalFrames - 1;
          if (reduce) {
            state.anim.goToAndStop(last, true);
          } else {
            // Direct op de juiste stand beginnen, zonder naijlen.
            state.current = state.target = Math.round(progress() * last);
            state.last = state.current;
            state.anim.goToAndStop(state.current, true);
            window.addEventListener('scroll', update, { passive: true });
            window.addEventListener('resize', update);
          }
          container.classList.add('is-loaded');
        });
      }).catch(function () {
        container.removeAttribute('data-bloem-ready');
      });
    }

    state.destroy = function () {
      state.destroyed = true;
      if (state.observer) state.observer.disconnect();
      if (state.raf) cancelAnimationFrame(state.raf);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (state.anim) state.anim.destroy();
    };

    // Pas laden als de bloem binnen ongeveer één schermhoogte komt.
    if ('IntersectionObserver' in window) {
      state.observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          state.observer.disconnect();
          start();
        }
      }, { rootMargin: '100% 0px 100% 0px' });
      state.observer.observe(container);
    } else {
      start();
    }

    bloemen.push(state);
  }

  // Ook aan te roepen na een Barba-paginawissel: ruimt weggehaalde bloemen op en start nieuwe.
  function initBloemen(root) {
    bloemen = bloemen.filter(function (b) {
      if (document.documentElement.contains(b.container)) return true;
      b.destroy();
      return false;
    });
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-bloem-lottie]'), initBloem);
  }

  window.MentingBloem = { init: initBloemen };

  function init() {
    initBloemen();

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
