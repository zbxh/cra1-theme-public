/* The carousel fog stops offscreen and in hidden tabs; no rendering loop. */
(function (root) {
  var document = root.document;
  if (document.documentElement.getAttribute('data-cra1-theme') !== 'website') return;
  var motion = root.matchMedia('(prefers-reduced-motion: reduce)');
  function start() {
    var elements = Array.from(document.querySelectorAll('.marketing-hero'));
    if (!elements.length) return;
    var visible = new WeakMap();
    function sync() {
      elements.forEach(function (element) {
        element.setAttribute('data-ambient-running', String(!document.hidden && !motion.matches && visible.get(element)));
      });
    }
    elements.forEach(function (element) { visible.set(element, false); });
    if ('IntersectionObserver' in root) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { visible.set(entry.target, entry.isIntersecting); });
        sync();
      });
      elements.forEach(function (element) { observer.observe(element); });
    }
    document.addEventListener('visibilitychange', sync);
    if (motion.addEventListener) motion.addEventListener('change', sync);
    else motion.addListener(sync);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
