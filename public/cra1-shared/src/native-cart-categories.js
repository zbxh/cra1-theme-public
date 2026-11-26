/* Standalone module carts use the public catalogue for navigation only. */
(function (root) {
  'use strict';
  const doc = root.document;
  const shared = root.CRA1Shared;

  function get(path, params) {
    return shared.Request.request(path, { params, unauthorized: 'ignore' }).then(result => result.data);
  }

  function groups(data) {
    return (Array.isArray(data?.list) ? data.list : []).filter(item =>
      item && /^[1-9]\d*$/.test(String(item.id)) && typeof item.name === 'string' && item.name.trim());
  }

  function icon(name) {
    return '<i class="el-icon-' + name + '" aria-hidden="true"></i>';
  }

  function categoryHref(levels, level, item) {
    const query = new URLSearchParams({ fpg_id: level === levels.first ? item.id : levels.first.current.id });
    if (level === levels.second) query.set('spg_id', item.id);
    return '/cart/goodsList.htm?' + query;
  }

  function confirmSwitch() {
    // Leaving the page may discard the native module's unsubmitted selections.
    return root.confirm('切换分类将返回商品列表，当前未提交的选配可能丢失。是否继续？');
  }

  function desktopNavigation(host, levels) {
    const navigation = doc.createElement('div');
    navigation.className = 'cl-native-catalog-desktop';

    for (const [kind, level] of Object.entries(levels)) {
      if (!level.options.length) continue;
      const row = doc.createElement('div');
      row.className = 'cl-nav-group';
      const title = doc.createElement('h2');
      title.className = 'cl-nav-title';
      title.innerHTML = '<span class="cl-native-catalog-icon">' + icon(kind === 'first' ? 'box' : 'folder') + '</span>';
      title.append(level.label);
      const list = doc.createElement('nav');
      list.className = 'cl-nav-list';
      list.dataset.catalogLevel = kind;
      list.setAttribute('aria-label', level.label);

      for (const item of level.options) {
        const current = item === level.current;
        const link = doc.createElement(current ? 'span' : 'a');
        link.className = kind === 'first' ? 'cl-nav-item' : 'cl-nav-item cl-nav-item-sub';
        link.textContent = link.title = item.name;
        if (current) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.href = categoryHref(levels, level, item);
          link.addEventListener('click', event => {
            // Opening in a new tab keeps the current configuration available.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (!confirmSwitch()) event.preventDefault();
          });
        }
        list.append(link);
      }
      row.append(title, list);
      navigation.append(row);
    }
    host.append(navigation);
  }

  function picker(host, dialog, viewport, levels) {
    const triggers = doc.createElement('div');
    triggers.className = 'cl-catalog-filters';
    dialog.id = 'cra1-native-cart-picker';
    dialog.className = 'cl-picker-sheet cl-native-catalog-sheet';
    dialog.setAttribute('aria-labelledby', 'cra1-native-cart-picker-title');
    dialog.innerHTML = '<header class="cl-native-catalog-header"><h2 id="cra1-native-cart-picker-title"></h2>'
      + '<button class="cl-picker-close" type="button" aria-label="关闭分类选择">' + icon('close') + '</button></header>'
      + '<div class="cl-native-catalog-body"><p class="cl-catalog-parent" hidden><span></span>'
      + icon('arrow-right') + '<strong></strong></p><div class="cl-catalog-options" role="group"></div></div>';
    host.append(triggers, dialog);

    const title = dialog.querySelector('h2');
    const parent = dialog.querySelector('.cl-catalog-parent');
    const options = dialog.querySelector('.cl-catalog-options');
    const close = dialog.querySelector('.cl-picker-close');
    const body = dialog.querySelector('.cl-native-catalog-body');
    let activeTrigger;

    function choose(level, item) {
      if (item === level.current) {
        dialog.close();
        return;
      }
      if (confirmSwitch()) root.location.assign(categoryHref(levels, level, item));
    }

    for (const [kind, level] of Object.entries(levels)) {
      const trigger = doc.createElement('button');
      trigger.type = 'button';
      trigger.className = 'cl-catalog-trigger';
      trigger.dataset.catalogLevel = kind;
      trigger.disabled = !level.options.length;
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', dialog.id);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.innerHTML = '<span class="cl-native-catalog-icon">' + icon('box') + '</span>'
        + '<span class="cl-catalog-field"><span class="cl-catalog-label"></span><strong class="cl-catalog-value"></strong></span>'
        + icon('arrow-down');
      trigger.querySelector('.cl-catalog-label').textContent = level.label;
      const value = trigger.querySelector('.cl-catalog-value');
      value.textContent = level.current?.name || level.placeholder;
      if (level.current) value.title = level.current.name;
      triggers.append(trigger);

      trigger.addEventListener('click', () => {
        if (dialog.open) return;
        title.textContent = '选择' + level.label;
        parent.hidden = kind !== 'second';
        parent.querySelector('span').textContent = levels.first.label;
        parent.querySelector('strong').textContent = levels.first.current.name;
        options.setAttribute('aria-label', level.label);
        options.replaceChildren(...level.options.map(item => {
          const button = doc.createElement('button');
          button.type = 'button';
          button.className = 'cl-catalog-option';
          button.setAttribute('aria-pressed', String(item === level.current));
          const name = doc.createElement('span');
          name.textContent = item.name;
          button.append(name);
          button.insertAdjacentHTML('beforeend', icon('check'));
          button.addEventListener('click', () => choose(level, item));
          return button;
        }));
        dialog.showModal();
        activeTrigger = trigger;
        trigger.setAttribute('aria-expanded', 'true');
        const selected = options.querySelector('[aria-pressed="true"]');
        const initial = selected || options.firstElementChild || close;
        body.scrollTop = 0;
        body.scrollTop = Math.max(0, initial.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom);
        shared.UI.focus(initial);
      });
    }

    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      activeTrigger?.setAttribute('aria-expanded', 'false');
      if (viewport.matches) shared.UI.focus(activeTrigger);
      activeTrigger = null;
    });
    viewport.addEventListener('change', event => {
      if (!event.matches && dialog.open) dialog.close();
    });
  }

  async function load(host) {
    const id = host.dataset.cra1CartCategories;
    const [details, firstList] = await Promise.all([get('/product/' + id), get('/product/group/first')]);
    const product = details?.product;
    const firstOptions = groups(firstList);
    const firstId = Number(product?.product_group_id_first) || Number(product?.product_group_id);
    const first = firstOptions.find(item => Number(item.id) === firstId);
    if (!first) return;

    const secondOptions = groups(await get('/product/group/second', { id: first.id }).catch(() => null));
    const second = secondOptions.find(item => Number(item.id) === Number(product.product_group_id));
    const common = root.__CRA1_RUNTIME__?.common || {};
    if (!host.isConnected) return;
    const levels = {
      first: { label: common.first_navigation || '一级分类', options: firstOptions, current: first },
      second: { label: common.second_navigation || '二级分类', options: secondOptions, current: second,
        placeholder: secondOptions.length ? '请选择二级分类' : '暂无二级分类' },
    };
    desktopNavigation(host, levels);
    const dialog = doc.createElement('dialog');
    if (typeof dialog.showModal === 'function') {
      picker(host, dialog, root.matchMedia('(max-width: 1024px)'), levels);
      host.classList.add('cl-native-catalog-has-picker');
    }
    host.hidden = false;
  }

  function start() {
    if (!doc.documentElement.hasAttribute('data-cra1-native-cart') || root.self !== root.top) return;
    const host = doc.querySelector('[data-cra1-cart-categories]');
    if (!host) return;
    load(host).catch(() => {});
  }

  // The official template mounts its page root from window.onload.
  if (doc.readyState === 'complete') root.setTimeout(start, 0);
  else root.addEventListener('load', () => root.setTimeout(start, 0), { once: true });
})(window);
