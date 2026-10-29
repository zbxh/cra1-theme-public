/* One search data source and one mounted UI for all three CRA1 themes. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.HeaderSearch) { root.CRA1HeaderSearch = shared.HeaderSearch; return; }
  var sourcesDefault = [
    { key: 'products', label: '订购商品', path: 'product' },
    { key: 'news', label: '新闻文章', path: 'news' },
    { key: 'announcement', label: '官方公告', path: 'announcement' },
    { key: 'help', label: '帮助文档', path: 'help' },
  ];
  function titleRank(title, keywords) {
    var text = String(title || '').toLocaleLowerCase(), term = String(keywords || '').trim().toLocaleLowerCase();
    if (!term) return 0;
    if (text === term) return 1000;
    if (text.indexOf(term) === 0) return 800;
    var position = text.indexOf(term);
    if (position >= 0) return 600 - Math.min(position, 100);
    var words = term.split(/\s+/).filter(Boolean);
    return words.length > 1 && words.every(function (word) { return text.includes(word); }) ? 300 : 0;
  }
  function titleParts(title, keywords) {
    var text = String(title || ''), lower = text.toLocaleLowerCase();
    var words = String(keywords || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    var parts = [], offset = 0;
    while (offset < text.length && words.length) {
      var start = -1, length = 0;
      words.forEach(function (word) {
        var index = lower.indexOf(word, offset);
        if (index >= 0 && (start < 0 || index < start || (index === start && word.length > length))) { start = index; length = word.length; }
      });
      if (start < 0) break;
      if (start > offset) parts.push({ text: text.slice(offset, start), match: false });
      parts.push({ text: text.slice(start, start + length), match: true }); offset = start + length;
    }
    if (offset < text.length || !parts.length) parts.push({ text: text.slice(offset), match: false });
    return parts;
  }
  function pluginSources(options) {
    options = options || {};
    var sources = [{ key: 'products', label: '订购商品', path: 'product' }];
    if (options.includeHosts) sources.unshift({ key: 'hosts', label: '我的产品', path: 'host' });
    var plugins = options.plugins;
    if (!plugins) {
      try {
        var node = root.document.getElementById('addons_js');
        plugins = JSON.parse(node ? node.getAttribute('addons_js') || '[]' : '[]');
      } catch (error) { plugins = []; }
    }
    if (!Array.isArray(plugins)) plugins = [];
    [['IdcsmartNews', 'news', '新闻文章'], ['IdcsmartAnnouncement', 'announcement', '官方公告'], ['IdcsmartHelp', 'help', '帮助文档']].forEach(function (definition) {
      var plugin = plugins.find(function (item) { return item && item.name === definition[0] && Number(item.id) > 0; });
      if (plugin) sources.push({ key: definition[1], path: definition[1], label: definition[2], pluginId: Number(plugin.id) });
    });
    return sources;
  }
  async function search(options) {
    options = options || {};
    var keywords = String(options.keywords || '').trim();
    if (!keywords) return { groups: [], errors: [] };
    var sources = options.sources ? options.sources.slice() : sourcesDefault.slice();
    if (!options.sources && options.includeHosts) sources.unshift({ key: 'hosts', label: '我的产品', path: 'host' });
    var responses = await Promise.allSettled(sources.map(async function (source) {
      var json = await shared.Request.request('/' + source.path, {
        params: { keywords: keywords, page: 1, limit: 6 }, signal: options.signal,
        language: options.language, unauthorized: 'ignore', timeout: 10000,
      });
      if (!json.data || !Array.isArray(json.data.list)) throw new Error('搜索结果格式错误');
      return json.data;
    }));
    var index = 0, groups = [], errors = [];
    responses.forEach(function (response, sourceIndex) {
      var source = sources[sourceIndex];
      if (response.status !== 'fulfilled') { errors.push(source.label); return; }
      var data = response.value, rows = data.list;
      if (source.key === 'help') {
        var term = keywords.toLocaleLowerCase();
        rows = rows.reduce(function (all, group) {
          if (!group) return all;
          return all.concat((Array.isArray(group.helps) ? group.helps : []).filter(function (row) {
            return row && (row.search === true || String(row.title || '').toLocaleLowerCase().includes(term));
          }).map(function (row) { return Object.assign({}, row, { category: group.name }); }));
        }, []);
      }
      rows = rows.filter(function (row) { return row && Number.isInteger(Number(row.id)) && Number(row.id) > 0; });
      rows = rows.map(function (row, order) { return { row: row, order: order, rank: titleRank(row.title || row.product_name || row.name, keywords) }; })
        .sort(function (a, b) { return b.rank - a.rank || a.order - b.order; }).map(function (entry) { return entry.row; });
      var seen = new Set();
      rows = rows.filter(function (row) { var id = Number(row.id); if (seen.has(id)) return false; seen.add(id); return true; });
      var items = rows.slice(0, 6).map(function (row) {
        var id = Number(row.id);
        var item = { key: source.key + ':' + id, index: index++, title: row.title || row.name || '内容 #' + id, description: '' };
        if (source.key === 'hosts') {
          item.title = row.product_name || row.name || '产品 #' + id;
          item.description = [row.name, '编号 ' + id].filter(Boolean).join(' · ');
          item.url = '/productdetail.htm?id=' + id;
        } else if (source.key === 'products') {
          item.description = [row.product_group_name_first, row.product_group_name_second].filter(Boolean).join(' / ');
          item.url = '/cart/goodsList.htm?product_id=' + id;
        } else if (source.key === 'announcement') {
          item.description = '官方公告'; item.url = '/announce-details.html?id=' + id;
        } else if (options.context === 'website' || !Number.isInteger(Number(source.pluginId)) || Number(source.pluginId) <= 0) {
          item.description = row.category || source.label;
          item.url = (source.key === 'news' ? '/news-details.html' : '/document-details.html') + '?id=' + id;
        } else {
          item.description = row.category || source.label;
          item.url = '/plugin/' + Number(source.pluginId) + '/' + (source.key === 'news' ? 'news_detail' : 'helpTotal') + '.htm?id=' + id;
        }
        return item;
      });
      if (items.length) groups.push({ key: source.key, label: source.label, items: items, more: rows.length > 6 || (source.key !== 'help' && Number(data.count) > 6) });
    });
    return { groups: groups, errors: errors };
  }
  var sequence = 0;
  function mount(host, options) {
    options = options || {};
    if (host.__cra1HeaderSearch) return host.__cra1HeaderSearch;
    var UI = shared.UI, doc = host.ownerDocument;
    var prefix = options.idPrefix || ('cra1-header-search-' + (++sequence));
    var copy = { placeholder: '搜索产品、新闻、公告、文档', searching: '正在搜索…', noresult: '没有找到相关内容，请换个关键词' };
    Object.keys(options.copy || {}).forEach(function (key) { if (options.copy[key] !== undefined) copy[key] = options.copy[key]; });
    host.dataset.cra1Component = 'header-search';
    host.innerHTML = '<button type="button" class="cra1-header__icon-btn cui-button cui-button--ghost cui-button--icon" aria-label="搜索产品与文章">' + UI.icon('search') + '</button>' +
      '<div class="cra1-header-search__panel" hidden><form class="cra1-header-search__form" role="search">' +
      '<button type="submit" class="cra1-header-search__search-btn cui-button cui-button--ghost cui-button--icon" aria-label="开始搜索">' + UI.icon('search') + '</button>' +
      '<input type="search" maxlength="100" autocomplete="off" class="cra1-header-search__input cui-input" aria-label="搜索产品、新闻、公告和帮助文档" role="combobox" aria-autocomplete="list" aria-expanded="false">' +
      '<button type="button" class="cra1-header-search__small-btn cui-button cui-button--ghost cui-button--icon" aria-label="清空搜索" hidden>' + UI.icon('close') + '</button>' +
      '<button type="button" class="cra1-header-search__close cui-button cui-button--ghost" aria-label="关闭搜索"><span>Esc</span><span class="cra1-header-search__close-label">收起</span></button></form></div>';
    var trigger = host.querySelector('.cra1-header__icon-btn'), panel = host.querySelector('.cra1-header-search__panel');
    var input = host.querySelector('input'), form = host.querySelector('form');
    var clearButton = host.querySelector('.cra1-header-search__small-btn'), closeButton = host.querySelector('.cra1-header-search__close');
    var resultsNode = null, listNode = null, destroyed = false, composing = false, unwatchSession = null;
    var state = { groups: [], errors: [], loading: false, activeIndex: -1 }, generation = 0, timer = null, abort = null;
    panel.id = prefix + '-panel'; input.id = prefix;
    input.placeholder = copy.placeholder;
    function items() { return state.groups.reduce(function (all, group) { return all.concat(group.items); }, []); }
    function invalidate() { generation += 1; root.clearTimeout(timer); timer = null; if (abort) { abort.abort(); abort = null; } }
    function sessionToken() { return shared.Request && shared.Request.getToken ? shared.Request.getToken() : ''; }
    function clearSession() {
      if (destroyed) return;
      composing = false; invalidate(); input.value = '';
      state.groups = []; state.errors = []; state.activeIndex = -1; state.loading = false;
      popover.close(host.contains(doc.activeElement)); render();
    }
    function onVisibility() { if (doc.hidden) clearSession(); }
    function setActive() {
      if (!listNode) return;
      Array.from(listNode.querySelectorAll('[role="option"]')).forEach(function (item) {
        var active = Number(item.dataset.index) === state.activeIndex;
        item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active));
      });
      if (state.activeIndex >= 0) input.setAttribute('aria-activedescendant', prefix + '-results-' + state.activeIndex);
      else input.removeAttribute('aria-activedescendant');
    }
    function navigate(item, event) {
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
      if (event) event.preventDefault();
      popover.close(false);
      if (options.onNavigate) options.onNavigate(item.url);
      else root.location.href = item.url;
    }
    function render() {
      clearButton.hidden = !input.value;
      var visible = popover.isOpen && !!input.value.trim();
      input.setAttribute('aria-expanded', String(visible));
      if (!visible) {
        if (resultsNode) resultsNode.remove(); resultsNode = null; listNode = null;
        input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant'); return;
      }
      if (!resultsNode) { resultsNode = doc.createElement('div'); resultsNode.className = 'cra1-header-search__results'; panel.appendChild(resultsNode); }
      resultsNode.replaceChildren();
      var count = items().length;
      var status = doc.createElement('p'); status.className = 'cra1-header-search__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      status.textContent = state.loading || composing ? copy.searching : count ? '找到 ' + count + ' 条结果' : state.errors.length ? '暂时无法加载搜索结果' : copy.noresult;
      listNode = doc.createElement('div'); listNode.id = prefix + '-results'; listNode.setAttribute('role', 'listbox'); listNode.setAttribute('aria-label', '搜索结果'); listNode.setAttribute('aria-busy', String(state.loading));
      input.setAttribute('aria-controls', listNode.id);
      resultsNode.append(status, listNode);
      state.groups.forEach(function (group) {
        var section = doc.createElement('div'); section.className = 'cra1-header-search__group'; section.setAttribute('role', 'group'); section.setAttribute('aria-label', group.label);
        var heading = doc.createElement('p'); heading.className = 'cra1-header-search__group-title';
        var label = doc.createElement('span'); label.className = 'cra1-header-search__group-label'; label.textContent = group.label; heading.appendChild(label);
        if (group.more) { var more = doc.createElement('span'); more.textContent = '仅显示前 6 条，可细化关键词'; heading.appendChild(more); }
        section.appendChild(heading);
        group.items.forEach(function (item) {
          var link = doc.createElement('a'); link.id = prefix + '-results-' + item.index; link.href = item.url;
          link.dataset.index = item.index; link.className = 'cra1-header-search__item'; link.setAttribute('role', 'option');
          var title = doc.createElement('span'); title.className = 'cra1-header-search__item-title';
          titleParts(item.title, input.value).forEach(function (part) {
            var node = doc.createElement(part.match ? 'mark' : 'span'); node.textContent = part.text; title.appendChild(node);
          }); link.appendChild(title);
          if (item.description) { var description = doc.createElement('span'); description.className = 'cra1-header-search__item-description'; description.textContent = item.description; link.appendChild(description); }
          link.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          link.addEventListener('click', function (event) { navigate(item, event); }); section.appendChild(link);
        });
        listNode.appendChild(section);
      });
      if (state.errors.length) {
        var error = doc.createElement('div'); error.className = 'cra1-header-search__error'; error.setAttribute('role', 'status');
        var message = doc.createElement('span'); message.textContent = '页面错误，请刷新重试';
        error.append(message); resultsNode.appendChild(error);
      }
      setActive();
    }
    async function perform() {
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1;
      var keywords = input.value.trim();
      if (!popover.isOpen || !keywords || composing || destroyed) { state.loading = false; render(); return; }
      state.loading = true; render();
      var current = generation, token = sessionToken(), controller = abort = new AbortController();
      try {
        var configuration = options.getSearchOptions ? options.getSearchOptions() : options;
        var result = await search(Object.assign({}, configuration, { keywords: keywords, signal: controller.signal }));
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.groups = result.groups; state.errors = result.errors;
      } catch (error) {
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.errors = ['搜索服务'];
      }
      if (current !== generation || destroyed || !popover.isOpen) return;
      abort = null; state.loading = false; render();
    }
    function schedule() {
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1;
      state.loading = popover.isOpen && !!input.value.trim() && !composing;
      render(); if (state.loading) timer = root.setTimeout(perform, 280);
    }
    var popover = UI.createPopover({
      root: host, trigger: trigger, panel: panel, group: 'header', beforeOpen: options.beforeOpen,
      onOpenChange: function (open) {
        if (!open) { composing = false; invalidate(); state.loading = false; }
        if (options.onOpenChange) options.onOpenChange(open);
        render();
        if (open) { UI.focus(input); if (input.value.trim()) perform(); }
      },
    });
    function onInput() { schedule(); }
    function onCompositionStart() { composing = true; invalidate(); state.loading = false; render(); }
    function onCompositionEnd() { composing = false; schedule(); }
    function onKey(event) {
      if (event.isComposing || composing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); popover.close(true); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var count = items().length; if (!count) return;
      event.preventDefault(); state.activeIndex = event.key === 'ArrowDown' ? (state.activeIndex + 1) % count : state.activeIndex < 0 ? count - 1 : (state.activeIndex + count - 1) % count;
      setActive(); var item = doc.getElementById(prefix + '-results-' + state.activeIndex); if (item) item.scrollIntoView({ block: 'nearest' });
    }
    function onSubmit(event) { event.preventDefault(); if (composing) return; var selected = items()[state.activeIndex]; if (selected) navigate(selected); else perform(); }
    function onClear() { input.value = ''; schedule(); UI.focus(input); }
    function onClose() { popover.close(true); }
    function preventFocus(event) { event.preventDefault(); }
    function stopClick(event) { event.stopPropagation(); }
    var media = root.matchMedia('(max-width: 767px)');
    function onBreakpoint() { popover.close(false); }
    input.addEventListener('input', onInput); input.addEventListener('compositionstart', onCompositionStart); input.addEventListener('compositionend', onCompositionEnd); input.addEventListener('keydown', onKey);
    form.addEventListener('submit', onSubmit); clearButton.addEventListener('mousedown', preventFocus); clearButton.addEventListener('click', onClear); closeButton.addEventListener('click', onClose); host.addEventListener('click', stopClick);
    media.addEventListener('change', onBreakpoint);
    // Search can include member products. Purge them on identity changes and
    // before a hidden/BFCache page retains the old account's DOM.
    if (shared.NotificationSession) unwatchSession = shared.NotificationSession.watch(clearSession);
    else doc.addEventListener('api:unauthorized', clearSession);
    doc.addEventListener('visibilitychange', onVisibility); root.addEventListener('pagehide', clearSession);
    var component = {
      open: function () { popover.show(); }, close: function (restore) { popover.close(restore); }, refresh: schedule,
      get isOpen() { return popover.isOpen; },
      destroy: function () {
        if (destroyed) return;
        popover.destroy(); destroyed = true; invalidate();
        input.removeEventListener('input', onInput); input.removeEventListener('compositionstart', onCompositionStart); input.removeEventListener('compositionend', onCompositionEnd); input.removeEventListener('keydown', onKey);
        form.removeEventListener('submit', onSubmit); clearButton.removeEventListener('mousedown', preventFocus); clearButton.removeEventListener('click', onClear); closeButton.removeEventListener('click', onClose); host.removeEventListener('click', stopClick);
        media.removeEventListener('change', onBreakpoint); host.replaceChildren(); delete host.__cra1HeaderSearch;
        if (unwatchSession) unwatchSession(); else doc.removeEventListener('api:unauthorized', clearSession);
        doc.removeEventListener('visibilitychange', onVisibility); root.removeEventListener('pagehide', clearSession);
      },
    };
    host.__cra1HeaderSearch = component;
    return component;
  }
  shared.HeaderSearch = { search: search, mount: mount, pluginSources: pluginSources, titleRank: titleRank, titleParts: titleParts };
  root.CRA1HeaderSearch = shared.HeaderSearch;
})(typeof window !== 'undefined' ? window : globalThis);
