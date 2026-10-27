/* Short, one-time page entrances. Frameworks keep visibility, focus and state;
 * the existing Styles observer supplies DOM changes without another observer. */
(function (root) {
  var document = root.document;
  var preference = root.matchMedia('(prefers-reduced-motion: reduce)');
  var pages = new WeakSet();
  var active = new Map();
  var pending = new Set();
  var frame = 0;
  var started = false;
  var rootSelector = '#main-content,#cra1-content-slot,#root,main.el-main';
  var layerSelector = '.cui-dialog,.cui-dialog-overlay,.cui-sheet';
  var ease = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var canTranslate = root.CSS && root.CSS.supports('translate', '0 8px');

  function stop() {
    active.forEach(function (element, animation) { animation.cancel(); });
    active.clear();
  }
  function visible(element) {
    if (!element.isConnected || !element.getClientRects().length) return false;
    var rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < root.innerHeight && rect.width > 0 && rect.height > 0;
  }
  function play(element, kind, delay, lift) {
    if (preference.matches || document.hidden || !element.animate || !visible(element)) return;
    // A translated ancestor changes the containing block of fixed overlays.
    // Broad plugin/form containers therefore fade only when they contain one.
    var floating = element.querySelector('.el-dialog__wrapper,.el-message-box__wrapper,.cl-rail-dock,[role="dialog"],.cui-sheet');
    var from = { opacity: 0 }, to = { opacity: 1 };
    if (canTranslate && lift && !floating && getComputedStyle(element).position !== 'fixed') {
      from.translate = '0 ' + lift + 'px';
      to.translate = '0 0';
    }
    active.forEach(function (target, animation) { if (target === element) animation.cancel(); });
    var animation = element.animate([from, to], {
      duration: kind === 'page' ? 250 : 180, delay: delay || 0, easing: ease, fill: 'backwards'
    });
    animation.id = 'cui-' + kind + '-enter';
    active.set(animation, element);
    function clear() { active.delete(animation); }
    animation.onfinish = clear;
    animation.oncancel = clear;
  }
  function blocks(page) {
    if (page.id === 'main-content') {
      // Carousel copies animate separately during slide changes. Use their
      // wrappers at initial entry; existing scroll reveal sections stay owned.
      var hero = page.querySelector('.marketing-hero,.page-hero');
      if (!hero) return [];
      if (hero.matches('.marketing-hero')) {
        return Array.from(hero.querySelectorAll('.marketing-hero-title-slot,.marketing-hero-description-slot,.marketing-hero-action'));
      }
      var title = hero.querySelector('h1');
      if (!title) return [];
      return [title].concat(Array.from(title.parentElement.children).filter(function (node) {
        return node !== title && (node.tagName === 'P' || node.querySelector('.cui-button,.btn'));
      })).filter(function (node) { return !node.closest('[data-reveal],[data-cra1-module]'); });
    }
    var container = page;
    if (page.childElementCount === 1 && page.firstElementChild.childElementCount > 0 && !page.firstElementChild.matches('form,.cui-card')) container = page.firstElementChild;
    if (page.matches('main.el-main')) {
      var content = page.querySelector('.main-content-box');
      if (content) container = content;
    }
    var items = [];
    Array.from(container.children).forEach(function (node) {
      if (node.matches('script,style,link,template,.up-dialog') || !visible(node)) return;
      // Expand just one grid level so adjacent cards receive the 40ms rhythm.
      if (node.classList.contains('grid') && !node.matches('.cui-card') && node.childElementCount > 1) {
        Array.from(node.children).forEach(function (child) { if (visible(child)) items.push(child); });
      } else items.push(node);
    });
    return items;
  }
  function enter(page) {
    if (pages.has(page) || !page.isConnected) return;
    if (page.id === 'cra1-content-slot' && !root.__CRA1_SHELL_READY__) return;
    // Do not consume the entrance while an empty React slot or a skeleton-only
    // account page is waiting for its first real content. Refreshes reuse the
    // page root, whose entrance is already consumed.
    if (!page.textContent.trim() && !page.querySelector('input,textarea')) return;
    var items = blocks(page).filter(visible).slice(0, 6);
    if (!items.length) return;
    pages.add(page);
    items.forEach(function (element, index) { play(element, 'page', index * 40, page.id === 'root' ? 0 : 8); });
  }
  function flush() {
    frame = 0;
    pending.forEach(enter);
    pending.clear();
  }
  function queue(page) {
    if (!page || pages.has(page)) return;
    pending.add(page);
    if (!frame) frame = root.requestAnimationFrame(flush);
  }
  function scan(node) {
    if (!started || !node || node.nodeType !== 1 && node.nodeType !== 9) return;
    function layer(element) {
      // Legacy Tailwind animation utilities are important, so they otherwise
      // override shared motion and add a second centering translation. Remove
      // only those old animation utilities on our own floating components.
      Array.from(element.classList).forEach(function (name) {
        if (/^data-\[state=(?:open|closed)\]:animate-\[/.test(name)) element.classList.remove(name);
      });
    }
    if (node.nodeType === 1 && node.matches(layerSelector)) layer(node);
    node.querySelectorAll(layerSelector).forEach(layer);
    if (node.nodeType === 1) queue(node.closest(rootSelector));
    node.querySelectorAll(rootSelector).forEach(queue);
  }
  function tabContent(trigger) {
    var id = trigger.getAttribute('aria-controls');
    var panel = id && document.getElementById(id);
    // Semantic Radix / Element panels already receive CSS transitions.
    if (panel && panel.matches('[role="tabpanel"],.el-tab-pane')) return;
    if (panel) { play(panel, 'panel', 0, 4); return; }
    var list = trigger.closest('[role="tablist"]');
    if (!list || list.closest('.el-tabs')) return;
    // Some current React screens render their panel next to the Tabs root
    // instead of TabsContent. Limit the fallback to that local content group.
    var group = list;
    if (!group.nextElementSibling && group.parentElement && group.parentElement.matches('[data-orientation]')) group = group.parentElement;
    var sibling = group.nextElementSibling;
    var count = 0;
    while (sibling && count < 6) {
      if (!sibling.matches('script,style,[role="tablist"]')) { play(sibling, 'panel', count * 30, 4); count++; }
      sibling = sibling.nextElementSibling;
    }
  }
  function update(records) {
    records.forEach(function (record) {
      if (record.type !== 'attributes') return;
      if (record.attributeName === 'aria-selected' && record.oldValue === 'false' && record.target.getAttribute('aria-selected') === 'true') {
        tabContent(record.target);
      }
    });
  }
  function settle(event) {
    active.forEach(function (element, animation) { if (element.contains(event.target)) animation.cancel(); });
  }
  function sync() { if (preference.matches || document.hidden) stop(); }
  function restored(event) { if (event.persisted) stop(); }
  function start() {
    if (started) return;
    started = true;
    document.documentElement.setAttribute('data-cra1-motion', 'ready');
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('focusin', settle);
    document.addEventListener('pointerdown', settle, true);
    root.addEventListener('pageshow', restored);
    if (preference.addEventListener) preference.addEventListener('change', sync);
    else preference.addListener(sync);
    scan(document);
  }
  function destroy() {
    started = false;
    stop();
    if (frame) root.cancelAnimationFrame(frame);
    frame = 0;
    pending.clear();
    document.documentElement.removeAttribute('data-cra1-motion');
    document.removeEventListener('visibilitychange', sync);
    document.removeEventListener('focusin', settle);
    document.removeEventListener('pointerdown', settle, true);
    root.removeEventListener('pageshow', restored);
    if (preference.removeEventListener) preference.removeEventListener('change', sync);
    else preference.removeListener(sync);
  }
  root.CRA1Shared = root.CRA1Shared || {};
  root.CRA1Shared.Motion = { start: start, scan: scan, update: update, destroy: destroy };
})(window);
