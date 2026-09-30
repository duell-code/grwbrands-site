/* Private helpers and one isolated initializer per widget. No dependencies. */
(() => {
  'use strict';

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'cubic-bezier(0.16,1,0.3,1)';
  const emailLink = subject => `mailto:work@grwbrands.com?subject=${encodeURIComponent(subject)}`;

  // All demo clocks count visible time only. Interaction permanently ends a demo.
  function lifecycle(root, tick, options = {}) {
    let visible = false;
    let touched = false;
    let reduced = motionQuery.matches;
    let frame = 0;
    let previous = null;
    const effects = new Set();
    const active = () => visible && !document.hidden && !reduced;

    function animate(element, keyframes, settings = {}) {
      if (reduced || !element.animate) return null;
      const effect = element.animate(keyframes, { duration: 400, easing, ...settings });
      effects.add(effect);
      if (!active()) effect.pause();
      const release = () => effects.delete(effect);
      effect.finished.then(release, release);
      return effect;
    }
    function loop(now) {
      frame = 0;
      if (!active()) return;
      const dt = previous === null ? 0 : Math.min(now - previous, 100);
      previous = now;
      tick(dt, api);
      frame = requestAnimationFrame(loop);
    }
    function sync() {
      const running = active();
      root.dataset.running = String(running);
      for (const effect of effects) {
        if (running) effect.play();
        else effect.pause();
      }
      if (running && !frame) frame = requestAnimationFrame(loop);
      if (!running) {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = null;
      }
    }
    function touch() {
      if (touched) return;
      touched = true;
      root.dataset.touched = 'true';
      options.touch?.();
    }
    const api = {
      animate, touch,
      get touched() { return touched; },
      get reduced() { return reduced; },
      get visible() { return visible; }
    };
    ['pointerenter', 'pointerdown', 'pointermove', 'keydown', 'focusin'].forEach(event => root.addEventListener(event, touch, { passive: true }));
    document.addEventListener('visibilitychange', sync);
    motionQuery.addEventListener('change', event => {
      reduced = event.matches;
      if (reduced) {
        for (const effect of effects) effect.finish();
        effects.clear();
        options.reduce?.();
      }
      sync();
    });
    root.dataset.running = 'false';
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .35;
        sync();
      }, { threshold: [0, .35] });
      observer.observe(root);
    } else {
      visible = true;
      sync();
    }
    return api;
  }

  // Automatic activation, roving tabindex, horizontal arrows, Home and End.
  function tabs(root, list, life, onOpen) {
    const buttons = [...list.querySelectorAll('[role="tab"]')];
    const panels = buttons.map(button => root.querySelector(`#${button.getAttribute('aria-controls')}`));
    let current = 0;
    let revision = 0;
    function select(index, focus = false) {
      if (index === current) {
        if (focus) buttons[index].focus({ preventScroll: true });
        return;
      }
      const previous = current;
      current = index;
      const version = ++revision;
      panels.forEach(panel => panel.getAnimations?.().forEach(effect => effect.cancel()));
      buttons.forEach((button, i) => {
        button.setAttribute('aria-selected', String(i === index));
        button.tabIndex = i === index ? 0 : -1;
        panels[i].inert = i !== index;
        panels[i].setAttribute('aria-hidden', String(i !== index));
        if (i !== index && i !== previous) panels[i].hidden = true;
      });
      const incoming = panels[index];
      const outgoing = panels[previous];
      incoming.hidden = false;
      const leaving = life.animate(outgoing, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }]);
      if (leaving) {
        leaving.finished.then(() => {
          if (version === revision) outgoing.hidden = true;
        }, () => {});
      } else outgoing.hidden = true;
      life.animate(incoming, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }]);
      onOpen(index);
      if (focus) {
        buttons[index].focus({ preventScroll: true });
        // Scroll only the tab strip, never the page.
        const button = buttons[index];
        if (button.offsetLeft < list.scrollLeft) list.scrollLeft = button.offsetLeft;
        else if (button.offsetLeft + button.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = button.offsetLeft + button.offsetWidth - list.clientWidth;
      }
    }
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (list.getAttribute('aria-orientation') === 'vertical') {
          if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
          if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        }
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    return { select, get index() { return current; } };
  }

  (function storefront() {
    const root = document.querySelector('[data-shop]');
    if (!root) return;
    const swatches = [...root.querySelectorAll('.shop-swatch')];
    const sizes = [...root.querySelectorAll('.shop-size')];
    const cart = root.querySelector('.shop-cart');
    const badge = root.querySelector('.shop-count');
    const toast = root.querySelector('.shop-toast');
    let colour = 'Clay';
    let size = 'Single';
    let count = 0;
    let lastAdded = '';
    let elapsed = 0;
    let demoStep = 0;
    let toastTimer;
    const life = lifecycle(root, dt => {
      if (life.touched) return;
      elapsed += dt;
      if (elapsed >= 2000) {
        elapsed -= 2000;
        demoStep++;
        chooseColour(swatches[demoStep % swatches.length]);
        if (demoStep === 3) addToCart(true);
      }
    });
    function chooseColour(button) {
      colour = button.dataset.colour;
      root.style.setProperty('--shop-colour', button.style.getPropertyValue('--swatch'));
      swatches.forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch === button)));
      root.querySelectorAll('.shop-halo').forEach(halo => { halo.style.opacity = halo.dataset.colour === colour ? '1' : '0'; });
    }
    function showToast(message) {
      clearTimeout(toastTimer);
      toast.replaceChildren();
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(icon.namespaceURI, 'path');
      path.setAttribute('d', 'm5 12 4 4L19 6');
      icon.append(path);
      toast.append(icon, document.createTextNode(message));
      toast.dataset.show = '';
      toastTimer = setTimeout(() => { delete toast.dataset.show; }, 2400);
    }
    function addToCart(demo = false) {
      const selection = `${colour} · ${size}`;
      function finish() {
        if (demo && life.touched) return;
        // Only visitor clicks create a numerical cart count.
        if (!demo) {
          count++;
          lastAdded = selection;
          badge.hidden = false;
          badge.textContent = String(count);
          cart.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);
          life.animate(badge, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
        }
        showToast(`Added to cart · ${selection}`);
      }
      if (life.reduced) { finish(); return; }
      const box = root.getBoundingClientRect();
      const product = root.querySelector('.shop-product').getBoundingClientRect();
      const target = cart.getBoundingClientRect();
      const startX = product.left + product.width / 2 - box.left;
      const startY = product.top + product.height / 2 - box.top;
      const endX = target.left + target.width / 2 - box.left;
      const endY = target.top + target.height / 2 - box.top;
      const dot = document.createElement('i');
      dot.className = 'shop-flight';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.left = `${startX - 5}px`;
      dot.style.top = `${startY - 5}px`;
      root.append(dot);
      const dx = endX - startX;
      const dy = endY - startY;
      const frames = Array.from({ length: 25 }, (_, i) => {
        const t = i / 24;
        const x = dx * t;
        const y = 2 * (1 - t) * t * Math.min(dy - 45, -80) + t * t * dy;
        return { transform: `translate(${x}px,${y}px) scale(${1 - .35 * t})`, opacity: 1 };
      });
      const flight = life.animate(dot, frames, { duration: 700 });
      if (!flight) { dot.remove(); finish(); return; }
      flight.finished.then(() => { dot.remove(); finish(); }, () => dot.remove());
    }
    swatches.forEach(button => button.addEventListener('click', () => chooseColour(button)));
    sizes.forEach(button => button.addEventListener('click', () => {
      size = button.textContent;
      sizes.forEach(chip => chip.setAttribute('aria-pressed', String(chip === button)));
    }));
    root.querySelector('.shop-add').addEventListener('click', () => addToCart());
    cart.addEventListener('click', () => { if (count) showToast(`Added to cart · ${lastAdded}`); });
  })();

  (function software() {
    const root = document.querySelector('[data-app]');
    if (!root) return;
    let elapsed = 0;
    let automationElapsed = 0;
    let flipped = false;
    const switches = [...root.querySelectorAll('.app-switch')];
    const life = lifecycle(root, dt => {
      if (life.touched) return;
      elapsed += dt;
      if (navigation.index === 2 && !flipped) {
        automationElapsed += dt;
        if (automationElapsed >= 1200) { setSwitch(switches[2], true); flipped = true; }
      }
      if (elapsed >= 4000) { elapsed = 0; navigation.select((navigation.index + 1) % 3); }
    });
    function open(index) {
      if (index === 0) {
        life.animate(root.querySelector('.app-curve'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700 });
        life.animate(root.querySelector('.app-area'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
      }
      if (index === 1) root.querySelectorAll('.app-customer').forEach((row, i) => life.animate(row, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: i * 50, duration: 400, fill: 'backwards' }));
    }
    const tablist = root.querySelector('[role="tablist"]');
    const horizontalTabs = window.matchMedia('(max-width: 540px), (min-width: 900px) and (max-width: 1100px)');
    const orientTabs = () => tablist.setAttribute('aria-orientation', horizontalTabs.matches ? 'horizontal' : 'vertical');
    horizontalTabs.addEventListener('change', orientTabs);
    orientTabs();
    const navigation = tabs(root, tablist, life, open);
    open(0);
    function setSwitch(button, checked) {
      button.setAttribute('aria-checked', String(checked));
      const status = button.parentElement.querySelector('.app-live');
      status.textContent = checked ? 'Live' : 'Paused';
      status.toggleAttribute('data-paused', !checked);
    }
    switches.forEach(button => button.addEventListener('click', () => setSwitch(button, button.getAttribute('aria-checked') !== 'true')));
    const chart = root.querySelector('.app-chart > svg');
    const curve = root.querySelector('.app-curve');
    const guide = root.querySelector('.app-guide');
    chart.addEventListener('pointermove', event => {
      const box = chart.getBoundingClientRect();
      const x = Math.max(0, Math.min(400, (event.clientX - box.left) / box.width * 400));
      let low = 0;
      let high = curve.getTotalLength();
      // Binary search sampled SVG path length to find the requested x-coordinate.
      for (let i = 0; i < 18; i++) {
        const middle = (low + high) / 2;
        if (curve.getPointAtLength(middle).x < x) low = middle;
        else high = middle;
      }
      const point = curve.getPointAtLength((low + high) / 2);
      guide.style.opacity = '1';
      guide.setAttribute('transform', `translate(${point.x} 0)`);
      guide.querySelector('circle').setAttribute('cy', point.y);
    });
    chart.addEventListener('pointerleave', () => { guide.style.opacity = '0'; });
  })();

  (function growthStudio() {
    const root = document.querySelector('[data-studio]');
    if (!root) return;
    const slider = root.querySelector('.studio-range');
    const grid = root.querySelector('.studio-dot-grid');
    const glow = root.querySelector('.studio-glow');
    const miniAds = root.querySelector('.studio-mini-ads');
    const deck = root.querySelector('.studio-ad-deck');
    const hooks = ['New drop', 'Made to last', 'Try it free', 'Back in stock', 'Built for every day', 'Your new routine'];
    const subjects = ['Welcome — start here', 'Three ways to get more out of it', 'Picked for you', 'We saved your cart'];
    const nodes = [...root.querySelectorAll('.studio-node')];
    const channels = [...root.querySelectorAll('.studio-channel')];
    const layers = [...root.querySelectorAll('.studio-layer')];
    const conversion = root.querySelector('.studio-conversion-stage');
    const results = [...root.querySelectorAll('.studio-result > i')];
    const runButton = root.querySelector('.studio-run');
    const winner = root.querySelector('.studio-winner');
    let elapsed = 0;
    let stageElapsed = 0;
    let nextHook = 3;
    let angleDue = 2500;
    let nodeDue = 1600;
    let nodeIndex = 0;
    let paidDone = false;
    let conversionDemoDone = false;
    let analyticsDemoStep = 0;
    let testing = false;
    let testElapsed = 0;

    const dots = Array.from({ length: 112 }, (_, i) => {
      const dot = document.createElement('i');
      dot.className = 'studio-dot';
      grid.append(dot);
      return { element: dot, distance: Math.hypot((i % 14) - 6.5, (Math.floor(i / 14) - 3.5) * 1.3) };
    }).sort((a, b) => a.distance - b.distance);

    const life = lifecycle(root, dt => {
      // A visitor-started test continues after attract mode is stopped.
      if (testing && navigation.index === 3) {
        testElapsed += dt;
        updateTest(Math.min(testElapsed / 2500, 1));
      }
      if (life.touched) return;
      elapsed += dt;
      stageElapsed += dt;
      root.style.setProperty('--studio-progress', String(Math.min(elapsed / 6000, 1)));
      switch (navigation.index) {
        case 0:
          if (!paidDone) {
            const t = Math.min(stageElapsed / 1800, 1);
            setBudget(24 + 70 * (1 - Math.pow(1 - t, 3)));
            if (t === 1) paidDone = true;
          }
          break;
        case 1:
          if (stageElapsed >= angleDue) { newAngle(); angleDue += 2500; }
          break;
        case 2:
          if (stageElapsed >= nodeDue) { selectNode((++nodeIndex) % nodes.length); nodeDue += 1600; }
          break;
        case 3:
          if (!conversionDemoDone) { runTest(); conversionDemoDone = true; }
          break;
        case 4:
          if (analyticsDemoStep === 0 && stageElapsed >= 1400) { setChannel(1, false); analyticsDemoStep = 1; }
          if (analyticsDemoStep === 1 && stageElapsed >= 3200) { setChannel(1, true); analyticsDemoStep = 2; }
          break;
      }
      if (elapsed >= 6000) navigation.select((navigation.index + 1) % 5);
    }, {
      touch() { root.style.setProperty('--studio-progress', '1'); },
      reduce() { if (testing) updateTest(1); }
    });
    const navigation = tabs(root, root.querySelector('[role="tablist"]'), life, () => {
      elapsed = 0;
      stageElapsed = 0;
      angleDue = 2500;
      nodeDue = 1600;
      root.style.setProperty('--studio-progress', life.touched || life.reduced ? '1' : '0');
    });
    root.style.setProperty('--studio-progress', life.reduced ? '1' : '0');

    function setBudget(value) {
      slider.value = String(Math.round(value));
      const fraction = value / 100;
      const lit = Math.round(8 + fraction * (dots.length - 8));
      dots.forEach((dot, index) => dot.element.toggleAttribute('data-lit', index < lit));
      glow.style.transform = `scale(${.55 + fraction * .65})`;
      glow.style.opacity = String(.3 + fraction * .7);
      miniAds.style.transform = `scale(${.85 + fraction * .15})`;
      slider.setAttribute('aria-valuetext', value < 35 ? 'Test' : value > 70 ? 'Scale' : 'Test to scale');
    }
    slider.addEventListener('input', () => setBudget(Number(slider.value)));
    setBudget(Number(slider.value));

    function newAngle() {
      const oldest = deck.firstElementChild;
      const card = oldest.cloneNode(true);
      card.dataset.angle = String(nextHook % hooks.length);
      card.querySelector('b').textContent = hooks[nextHook++ % hooks.length];
      const before = [...deck.children].filter(element => !element.hasAttribute('data-leaving')).map(element => ({ element, x: element.getBoundingClientRect().left }));
      const outgoing = oldest.cloneNode(true);
      // A decorative copy lets the oldest card leave while the grid closes up.
      outgoing.dataset.leaving = '';
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.style.position = 'absolute';
      outgoing.style.width = `${oldest.getBoundingClientRect().width}px`;
      outgoing.style.height = `${oldest.getBoundingClientRect().height}px`;
      const deckRect = deck.getBoundingClientRect();
      const oldestRect = oldest.getBoundingClientRect();
      outgoing.style.left = `${oldestRect.left - deckRect.left}px`;
      outgoing.style.top = `${oldestRect.top - deckRect.top}px`;
      deck.style.position = 'relative';
      oldest.remove();
      deck.insertBefore(card, deck.querySelector('[data-leaving]'));
      before.slice(1).forEach(({ element, x }) => {
        const delta = x - element.getBoundingClientRect().left;
        const finalTransform = getComputedStyle(element).transform;
        life.animate(element, [{ transform: `translateX(${delta}px)` }, { transform: finalTransform === 'none' ? 'translateX(0)' : finalTransform }]);
      });
      life.animate(card, [{ opacity: 0, transform: 'translateX(35px) rotate(5deg) scale(.95)' }, { opacity: 1, transform: 'translateX(0) rotate(5deg) scale(.95)' }]);
      if (!life.reduced) {
        deck.append(outgoing);
        const leaving = life.animate(outgoing, [{ opacity: 1, transform: 'translateX(0) rotate(-5deg)' }, { opacity: 0, transform: 'translateX(-35px) rotate(-5deg)' }]);
        if (leaving) leaving.finished.then(() => outgoing.remove(), () => outgoing.remove());
        else outgoing.remove();
      }
    }
    root.querySelector('.studio-new-angle').addEventListener('click', newAngle);

    function selectNode(index) {
      nodeIndex = index;
      nodes.forEach((node, i) => node.setAttribute('aria-pressed', String(index === i)));
      root.querySelector('.studio-email-subject').textContent = subjects[index];
      life.animate(root.querySelector('.studio-email-preview'), [{ opacity: .3, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }]);
    }
    nodes.forEach((node, index) => node.addEventListener('click', () => selectNode(index)));

    function updateTest(progress) {
      const a = .64 * (1 - Math.pow(1 - progress, 2));
      const b = .94 * (1 - Math.pow(1 - progress, 4));
      results[0].style.transform = `scaleX(${a})`;
      results[1].style.transform = `scaleX(${b})`;
      if (progress >= 1) {
        testing = false;
        conversion.dataset.complete = '';
        winner.hidden = false;
        runButton.disabled = false;
        runButton.textContent = 'Run again';
        life.animate(winner, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300 });
      }
    }
    function runTest() {
      testElapsed = 0;
      testing = true;
      winner.hidden = true;
      delete conversion.dataset.complete;
      results.forEach(result => { result.style.transform = 'scaleX(0)'; });
      runButton.disabled = true;
      if (life.reduced) updateTest(1);
    }
    runButton.addEventListener('click', runTest);

    function setChannel(index, on) {
      channels[index].setAttribute('aria-pressed', String(on));
      layers[index].toggleAttribute('data-off', !on);
    }
    channels.forEach((button, index) => button.addEventListener('click', () => setChannel(index, button.getAttribute('aria-pressed') !== 'true')));
    const chart = root.querySelector('.studio-analytics-chart');
    const guide = root.querySelector('.studio-chart-guide');
    chart.addEventListener('pointermove', event => {
      const box = chart.getBoundingClientRect();
      const x = Math.max(0, Math.min(560, (event.clientX - box.left) / box.width * 560));
      guide.setAttribute('transform', `translate(${x} 0)`);
      guide.style.opacity = '1';
    });
    chart.addEventListener('pointerleave', () => { guide.style.opacity = '0'; });
  })();

  (function acquisitionFit() {
    const root = document.querySelector('[data-fit]');
    if (!root) return;
    const rows = [...root.querySelectorAll('.fit-row')];
    const ring = root.querySelector('.fit-ring');
    const label = root.querySelector('.fit-count');
    const success = root.querySelector('.fit-success');
    let elapsed = 0;
    let step = 0;
    const life = lifecycle(root, dt => {
      if (life.touched || step === rows.length) return;
      elapsed += dt;
      if (elapsed >= 700) {
        elapsed -= 700;
        rows[step++].setAttribute('aria-pressed', 'true');
        root.dataset.demo = '';
        update(true);
      }
    }, {
      touch() {
        // Demonstrated selections are not answers supplied by the visitor.
        if (!root.hasAttribute('data-demo')) return;
        delete root.dataset.demo;
        rows.forEach(row => row.setAttribute('aria-pressed', 'false'));
        update();
      }
    });
    function update(demo = false) {
      const count = rows.filter(row => row.getAttribute('aria-pressed') === 'true').length;
      const complete = count === rows.length;
      ring.style.strokeDashoffset = String(1 - count / rows.length);
      label.textContent = complete ? 'Great fit' : demo ? '' : `${count} of ${rows.length}`;
      root.toggleAttribute('data-complete', complete);
      success.hidden = !complete;
      if (complete) life.animate(success, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }]);
    }
    rows.forEach(row => row.addEventListener('click', () => {
      row.setAttribute('aria-pressed', String(row.getAttribute('aria-pressed') !== 'true'));
      update();
    }));
  })();

  (function emailComposer() {
    const root = document.querySelector('[data-mail]');
    if (!root) return;
    const subject = root.querySelector('.mail-subject');
    const send = root.querySelector('.mail-send');
    const chips = [...root.querySelectorAll('.mail-chip')];
    const subjects = ['Growth partnership', 'Selling my brand', 'Software partnership', 'Just saying hello'];
    let index = 0;
    let position = subjects[0].length;
    let deleting = true;
    let wait = 1600;
    const life = lifecycle(root, dt => {
      if (life.touched) return;
      wait -= dt;
      if (wait > 0) return;
      const phrase = subjects[index];
      position += deleting ? -1 : 1;
      subject.textContent = phrase.slice(0, position);
      if (deleting && position === 0) {
        deleting = false;
        index = (index + 1) % subjects.length;
        wait = 350;
      } else if (!deleting && position === phrase.length) {
        deleting = true;
        wait = 1800;
      } else wait = deleting ? 35 : 75;
    }, {
      touch() {
        // Never leave a half-typed phrase when the visitor reaches the composer.
        subject.textContent = subjects[index];
      },
      reduce() {
        if (!life.touched) subject.textContent = subjects[0];
      }
    });
    chips.forEach(chip => chip.addEventListener('click', () => {
      life.touch();
      subject.textContent = chip.textContent;
      send.href = emailLink(chip.textContent);
      chips.forEach(button => button.setAttribute('aria-pressed', String(button === chip)));
    }));
  })();
})();
