/* Framework independent interactions used by Alpine, Vue and React adapters. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.UI) return;
  var doc = root.document;
  var sequence = 0;
  var icons = {
    up: '<path d="m7 14 5-5 5 5"></path>',
    down: '<path d="m7 10 5 5 5-5"></path>',
    right: '<path d="M5 12h14m-5-5 5 5-5 5"></path>',
    megaphone: '<path d="m3 10 16-6v16L3 14v-4Zm5 6 1 5h4l-2-4M3 10v4"></path>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.5 4.5"></path>',
    close: '<path d="m8 8 8 8m0-8-8 8"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6m0-10v.01"></path>',
    success: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
    error: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v6m0 4v.01"></path>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.info) + '</svg>';
  }
  function focus(element) {
    if (element && element.isConnected && element.focus) {
      try { element.focus({ preventScroll: true }); } catch (error) { element.focus(); }
    }
  }
  function createPopover(options) {
    var host = options.root, trigger = options.trigger, panel = options.panel;
    var id = panel.id || ('cra1-popover-' + (++sequence));
    panel.id = id;
    var open = false, destroyed = false, focusTimer = null, closeTimer = null;
    var group = options.group || 'header';
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('aria-expanded', 'false');
    if (options.manageVisibility !== false) panel.hidden = true;
    function cancelClose() {
      root.clearTimeout(closeTimer); closeTimer = null;
    }
    function setOpen(value, restoreFocus) {
      cancelClose();
      value = !!value;
      if (destroyed || value === open) return;
      if (value && options.beforeOpen) options.beforeOpen();
      open = value;
      trigger.setAttribute('aria-expanded', String(open));
      host.classList.toggle('is-open', open);
      if (options.manageVisibility !== false) panel.hidden = !open;
      if (open) root.dispatchEvent(new CustomEvent('cra1:popover-open', { detail: { id: id, group: group } }));
      if (options.onOpenChange) options.onOpenChange(open);
      if (!open && restoreFocus) focus(trigger);
    }
    function openWithFocus() {
      setOpen(true);
      root.setTimeout(function () {
        if (!open || destroyed) return;
        var first = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).find(function (item) { return item.getClientRects().length && !item.closest('[hidden]'); });
        focus(first);
      }, 0);
    }
    function toggle(event) { if (event) event.preventDefault(); setOpen(!open); }
    function onOutside(event) { if (open && !host.contains(event.target)) setOpen(false); }
    function onKey(event) {
      if (event.key === 'Escape' && open && !event.isComposing) {
        event.preventDefault(); setOpen(false, host.contains(doc.activeElement));
      }
    }
    function onTriggerKey(event) { if (event.key === 'ArrowDown' && !event.isComposing) { event.preventDefault(); openWithFocus(); } }
    function onFocusout(event) {
      root.clearTimeout(focusTimer);
      if (host.contains(event.relatedTarget)) return;
      focusTimer = root.setTimeout(function () { if (open && !host.contains(doc.activeElement)) setOpen(false); }, 0);
    }
    function onOther(event) { if (open && event.detail && event.detail.group === group && event.detail.id !== id) setOpen(false); }
    function onEnter(event) { if (options.hover && event.pointerType === 'mouse') setOpen(true); }
    function onLeave(event) {
      if (!options.hover || event.pointerType !== 'mouse') return;
      var active = doc.activeElement;
      if (host.contains(active) && active.matches(':focus-visible')) return;
      cancelClose(); closeTimer = root.setTimeout(function () { setOpen(false); }, 160);
    }
    if (options.bindTrigger !== false) trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', onTriggerKey);
    host.addEventListener('focusout', onFocusout);
    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointerleave', onLeave);
    doc.addEventListener('click', onOutside);
    doc.addEventListener('keydown', onKey);
    root.addEventListener('cra1:popover-open', onOther);
    return {
      get isOpen() { return open; },
      setOpen: setOpen, show: function () { setOpen(true); }, close: function (restore) { setOpen(false, restore); },
      toggle: toggle, openWithFocus: openWithFocus,
      destroy: function () {
        if (destroyed) return;
        setOpen(false); destroyed = true; cancelClose(); root.clearTimeout(focusTimer);
        trigger.removeEventListener('click', toggle); trigger.removeEventListener('keydown', onTriggerKey);
        host.removeEventListener('focusout', onFocusout); host.removeEventListener('pointerenter', onEnter); host.removeEventListener('pointerleave', onLeave);
        doc.removeEventListener('click', onOutside); doc.removeEventListener('keydown', onKey); root.removeEventListener('cra1:popover-open', onOther);
      },
    };
  }
  async function copy(text) {
    var value = String(text == null ? '' : text);
    if (!value) return false;
    try {
      if (root.navigator.clipboard && root.isSecureContext) { await root.navigator.clipboard.writeText(value); return true; }
    } catch (error) { /* HTTP and denied clipboard permissions use the same fallback. */ }
    var previous = doc.activeElement, input = null, wrote = false;
    function onCopy(event) {
      try { event.clipboardData.setData('text/plain', value); event.preventDefault(); wrote = true; } catch (error) { /* Native selection remains available. */ }
    }
    try {
      input = doc.createElement('textarea'); input.value = value; input.readOnly = true; input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
      var dialog = previous && previous.closest ? previous.closest('dialog[open], [role="dialog"]') : null;
      (dialog || doc.body).appendChild(input);
      doc.addEventListener('copy', onCopy, true);
      focus(input); input.select(); input.setSelectionRange(0, value.length);
      return doc.execCommand('copy') || wrote;
    } catch (error) { return wrote; }
    finally { doc.removeEventListener('copy', onCopy, true); if (input) input.remove(); focus(previous); }
  }
  var toastHost = null;
  function toast(text, tone) {
    if ((tone === 'error' || tone === 'warning') && shared.Errors) text = shared.Errors.message(text);
    text = String(text == null ? '' : text);
    if (!text || !doc || !doc.body) return function () {};
    if (!toastHost || !toastHost.isConnected) {
      toastHost = doc.createElement('div'); toastHost.className = 'cui-toasts';
      toastHost.setAttribute('aria-live', 'polite'); toastHost.setAttribute('aria-atomic', 'false');
      toastHost.dataset.cra1Component = 'toast'; doc.body.appendChild(toastHost);
    }
    tone = ['success', 'error', 'warning', 'info'].indexOf(tone) === -1 ? 'info' : tone;
    var item = doc.createElement('div'); item.className = 'cui-toast cui-toast--' + tone;
    var symbol = doc.createElement('span'); symbol.className = 'cui-toast__icon'; symbol.innerHTML = icon(tone === 'warning' ? 'error' : tone);
    var message = doc.createElement('p'); message.className = 'cui-toast__text'; message.textContent = text;
    var button = doc.createElement('button'); button.type = 'button'; button.className = 'cui-toast__close'; button.setAttribute('aria-label', '关闭提示'); button.innerHTML = icon('close');
    item.append(symbol, message, button); toastHost.appendChild(item);
    var timer;
    function dismiss() { root.clearTimeout(timer); item.remove(); }
    button.addEventListener('click', dismiss);
    item.addEventListener('pointerenter', function () { root.clearTimeout(timer); });
    item.addEventListener('pointerleave', function () { timer = root.setTimeout(dismiss, 3200); });
    item.addEventListener('focusin', function () { root.clearTimeout(timer); });
    item.addEventListener('focusout', function () { timer = root.setTimeout(dismiss, 3200); });
    timer = root.setTimeout(dismiss, 3200);
    return dismiss;
  }
  shared.UI = { createPopover: createPopover, copy: copy, toast: toast, icon: icon, focus: focus };
  if (root.addEventListener) root.addEventListener('cra1:toast', function (event) { var detail = event.detail || {}; toast(detail.text, detail.tone); });
})(typeof window !== 'undefined' ? window : globalThis);
