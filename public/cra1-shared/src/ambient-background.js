/* Optional, dependency-free background. Mount explicitly; never scans pages. */
(function (global) {
  'use strict';
  const mounted = new WeakMap();
  const frameInterval = 1000 / 30;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const decoration = '<div class="cui-ambient__grid"></div><div class="cui-ambient__silver"></div><div class="cui-ambient__gold"></div>' +
    '<div class="cui-ambient__structure"><svg viewBox="0 0 640 640" aria-hidden="true" focusable="false"><g class="cui-ambient__wire">' +
    '<circle cx="320" cy="320" r="206" opacity=".35"/><circle cx="320" cy="320" r="156" opacity=".2"/>' +
    '<ellipse cx="320" cy="320" rx="258" ry="87" transform="rotate(-28 320 320)"/>' +
    '<ellipse cx="320" cy="320" rx="234" ry="91" transform="rotate(28 320 320)" opacity=".7"/>' +
    '<ellipse cx="320" cy="320" rx="224" ry="74" transform="rotate(72 320 320)" opacity=".45"/>' +
    '<ellipse cx="320" cy="320" rx="204" ry="69" transform="rotate(112 320 320)" opacity=".5"/>' +
    '<path d="M54 486C166 309 315 493 600 136M70 531C218 358 450 502 606 292" opacity=".28"/>' +
    '</g><ellipse class="cui-ambient__wire cui-ambient__wire--gold" cx="320" cy="320" rx="270" ry="98" transform="rotate(-28 320 320)"/>' +
    '<g fill="currentColor" style="color:var(--ambient-wire-gold)"><circle cx="85" cy="434" r="3"/><circle cx="555" cy="206" r="3"/></g>' +
    '</svg></div><div class="cui-ambient__focus"></div><div class="cui-ambient__edge"></div>';

  function mount(target, options) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host || host.nodeType !== 1) throw new TypeError('CRA1Ambient.mount requires a container.');
    if (mounted.has(host)) return mounted.get(host);
    options = options || {};
    const root = document.createElement('div');
    root.className = 'cui-ambient';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = decoration;
    const hadHostClass = host.classList.contains('cui-ambient-host');
    host.classList.add('cui-ambient-host');
    host.prepend(root);
    const silver = root.querySelector('.cui-ambient__silver');
    const gold = root.querySelector('.cui-ambient__gold');
    const structure = root.querySelector('.cui-ambient__structure');
    const focus = root.querySelector('.cui-ambient__focus');
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = global.matchMedia('(hover: hover) and (pointer: fine)');
    const abort = new AbortController();
    const listen = (node, name, callback, extra) => node.addEventListener(name, callback, Object.assign({ signal: abort.signal }, extra));
    const metrics = { frames: 0, pointerEvents: 0, totalJsMs: 0, maxJsMs: 0 };
    let palette = options.palette === 'dark' ? 'dark' : 'light';
    let intensity = options.intensity === 'gentle' ? 'gentle' : 'standard';
    let paused = Boolean(options.paused), disposed = false, visible = true, dirtyRect = true;
    let rect, focusSize = 520, raf = 0, lastFrame = 0, phase = '';
    const current = { nx: 0, ny: 0, x: 0, y: 0, presence: 0 };
    const goal = { nx: 0, ny: 0, x: 0, y: 0, presence: 0 };
    let observer, resizeObserver;
    root.dataset.palette = palette;
    root.dataset.intensity = intensity;

    function reason() {
      if (disposed) return 'disposed';
      if (document.hidden) return 'hidden';
      if (!visible) return 'offscreen';
      if (paused) return 'paused';
      if (reduced.matches) return 'reduced-motion';
      if (!pointer.matches) return 'touch';
      return '';
    }
    function setPhase(next) {
      if (phase === next) return;
      phase = next;
      root.dataset.ambientState = next;
      root.dataset.ambientRunning = String(next === 'moving');
      host.dispatchEvent(new CustomEvent('cra1ambientstate', { detail: { phase: next, palette, intensity } }));
    }
    function measure() {
      rect = host.getBoundingClientRect();
      focusSize = Math.min(520, global.innerWidth * .8);
      dirtyRect = false;
    }
    function paint() {
      const strength = intensity === 'gentle' ? .55 : 1;
      const nx = current.nx * strength, ny = current.ny * strength;
      silver.style.transform = 'translate(' + (nx * -32).toFixed(2) + 'px,' + (ny * -22).toFixed(2) + 'px)';
      gold.style.transform = 'translate(' + (nx * 52).toFixed(2) + 'px,' + (ny * 34).toFixed(2) + 'px)';
      silver.style.opacity = ((.78 - nx * .16) * strength).toFixed(3);
      gold.style.opacity = ((.78 + nx * .2) * strength).toFixed(3);
      structure.style.transform = 'translate(-50%,-50%) translate(' + (nx * 23).toFixed(2) + 'px,' + (ny * 17).toFixed(2) + 'px) rotate(' + (nx * 5 + ny * 2).toFixed(2) + 'deg)';
      focus.style.transform = 'translate(' + (current.x - focusSize / 2).toFixed(2) + 'px,' + (current.y - focusSize / 2).toFixed(2) + 'px)';
      focus.style.opacity = (current.presence * strength * .85).toFixed(3);
    }
    function cancel() {
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      lastFrame = 0;
    }
    function reset() {
      cancel();
      if (dirtyRect) measure();
      Object.assign(current, { nx: 0, ny: 0, x: rect.width * .7, y: rect.height * .44, presence: 0 });
      Object.assign(goal, current);
      paint();
      setPhase(reason() || 'idle');
    }
    function frame(timestamp) {
      raf = 0;
      const blocked = reason();
      if (blocked) { cancel(); setPhase(blocked); return; }
      // Background drift does not need the monitor's full refresh rate. Keep
      // input current, but update composited layers at most 30 times a second.
      if (lastFrame && timestamp - lastFrame < frameInterval - .5) {
        raf = global.requestAnimationFrame(frame);
        return;
      }
      const start = options.instrument ? performance.now() : 0;
      const elapsed = lastFrame ? Math.min(timestamp - lastFrame, 48) : frameInterval;
      lastFrame = timestamp;
      const alpha = 1 - Math.exp(-elapsed / 95);
      let settled = true;
      for (const key of ['nx', 'ny', 'x', 'y', 'presence']) {
        const delta = goal[key] - current[key];
        const epsilon = key === 'x' || key === 'y' ? .12 : .001;
        if (Math.abs(delta) > epsilon) settled = false;
        current[key] = Math.abs(delta) <= epsilon ? goal[key] : current[key] + delta * alpha;
      }
      paint();
      metrics.frames++;
      if (options.instrument) {
        const spent = performance.now() - start;
        metrics.totalJsMs += spent;
        metrics.maxJsMs = Math.max(metrics.maxJsMs, spent);
      }
      if (settled) { lastFrame = 0; setPhase('idle'); }
      else raf = global.requestAnimationFrame(frame);
    }
    function wake() {
      if (raf || reason()) return;
      setPhase('moving');
      raf = global.requestAnimationFrame(frame);
    }
    function move(event) {
      if (event.pointerType !== 'mouse' || reason()) return;
      if (dirtyRect) measure();
      if (!rect.width || !rect.height) return;
      metrics.pointerEvents++;
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const y = clamp(event.clientY - rect.top, 0, rect.height);
      Object.assign(goal, { x, y, nx: x / rect.width * 2 - 1, ny: y / rect.height * 2 - 1, presence: 1 });
      wake();
    }
    function leave() {
      if (reason()) return;
      Object.assign(goal, { nx: 0, ny: 0, presence: 0 });
      wake();
    }
    function availability() { reset(); }
    listen(host, 'pointerenter', event => { dirtyRect = true; move(event); }, { passive: true });
    listen(host, 'pointermove', move, { passive: true });
    listen(host, 'pointerleave', leave, { passive: true });
    listen(global, 'scroll', () => { dirtyRect = true; }, { passive: true, capture: true });
    listen(global, 'resize', () => { dirtyRect = true; reset(); }, { passive: true });
    listen(global, 'blur', reset);
    listen(document, 'visibilitychange', availability);
    listen(reduced, 'change', availability);
    listen(pointer, 'change', availability);
    if ('IntersectionObserver' in global) {
      observer = new IntersectionObserver(entries => {
        const next = entries[0].isIntersecting && entries[0].intersectionRatio > 0;
        if (next !== visible) { visible = next; dirtyRect = true; reset(); }
      });
      observer.observe(host);
    }
    if ('ResizeObserver' in global) {
      resizeObserver = new ResizeObserver(() => { dirtyRect = true; reset(); });
      resizeObserver.observe(host);
    }
    const api = Object.freeze({
      setPalette(value) {
        if (disposed) return;
        palette = value === 'dark' ? 'dark' : 'light';
        root.dataset.palette = palette;
      },
      setIntensity(value) {
        if (disposed) return;
        intensity = value === 'gentle' ? 'gentle' : 'standard';
        root.dataset.intensity = intensity;
        paint();
      },
      setPaused(value) { if (!disposed) { paused = Boolean(value); reset(); } },
      getState() { return Object.assign({ phase, running: Boolean(raf), palette, intensity, paused }, metrics); },
      destroy() {
        if (disposed) return;
        cancel(); disposed = true; setPhase('disposed');
        abort.abort();
        if (observer) observer.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
        root.remove();
        if (!hadHostClass) host.classList.remove('cui-ambient-host');
        mounted.delete(host);
      }
    });
    mounted.set(host, api);
    reset();
    return api;
  }
  global.CRA1Ambient = Object.freeze({ mount });
})(window);
