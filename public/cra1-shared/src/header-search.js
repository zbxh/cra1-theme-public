/* One search data source and one mounted UI for all three CRA1 themes. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.HeaderSearch) { root.CRA1HeaderSearch = shared.HeaderSearch; return; }
  function titleRank(title, keywords) {
    return shared.SearchMatch.score(title, keywords);
  }
  function titleParts(title, keywords) {
    return shared.SearchMatch.parts(title, keywords);
  }
  function summaryText(value) {
    if (typeof value !== 'string') return '';
    var text = value.slice(0, 12000).replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
      .replace(/<(?:br\s*\/?|\/(?:p|div|li|h[1-6]|tr))\s*>/gi, ' ');
    // Template contents are inert: public HTML descriptions become text without
    // executing scripts, loading images or inserting markup into the results.
    if (root.document && typeof root.document.createElement === 'function') {
      var template = root.document.createElement('template'); template.innerHTML = text;
      text = template.content.textContent || '';
    } else {
      text = text.replace(/<[^>]*>/g, ' ').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos|nbsp);/gi, function (entity, code) {
        if (code.charAt(0) !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code.toLowerCase()];
        var value = code.charAt(1).toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '';
      });
    }
    var characters = Array.from(text.replace(/\s+/g, ' ').trim());
    return characters.slice(0, 240).join('') + (characters.length > 240 ? '…' : '');
  }
  function articleDate(value) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '';
    var date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? '' : date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function pluginSources(options) {
    options = options || {};
    var sources = [{ key: 'products', label: '订购商品', path: 'product' }];
    if (options.includeHosts) sources.unshift({ key: 'hosts', label: '我的产品', path: 'cra1-theme/member/search' });
    if ((options.includePages === true || (options.includePages !== false && options.includeHosts)) && shared.MemberSearchPages) sources.unshift({ key: 'pages', label: '会员页面与标签' });
    var plugins = options.plugins;
    if (!plugins && !options.capabilities) {
      try {
        var doc = root.document, node = doc && doc.getElementById('addons_js');
        var value = node && node.getAttribute('addons_js');
        if (!value && doc && doc.documentElement) value = doc.documentElement.getAttribute('addons_js');
        plugins = JSON.parse(value || '[]');
      } catch (error) { plugins = []; }
    }
    if (!Array.isArray(plugins)) plugins = [];
    var capabilities = options.capabilities;
    [['IdcsmartNews', 'news', '新闻文章'], ['IdcsmartAnnouncement', 'announcement', '官方公告'], ['IdcsmartHelp', 'help', '帮助文档']].forEach(function (definition) {
      var plugin = plugins.find(function (item) {
        return item && String(item.name).toLocaleLowerCase() === definition[0].toLocaleLowerCase() && Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0 &&
          (item.status === undefined || Number(item.status) === 1) && (item.enabled === undefined || item.enabled === true || Number(item.enabled) === 1);
      });
      var available = capabilities ? capabilities[definition[1]] === true || capabilities[definition[1]] === 1 : !!plugin;
      if (available) {
        var source = { key: definition[1], path: definition[1], label: definition[2] };
        if (plugin) source.pluginId = Number(plugin.id);
        sources.push(source);
      }
    });
    return sources;
  }
  // Keep the homepage's lifecycle rules: an expired product appears only
  // after the native renewal endpoint confirms that it can still be renewed.
  function hostState(host, now) {
    if (Number(host.is_delete) === 1) return 'hidden';
    var status = host.status, cycle = host.billing_cycle;
    if (status === 'Grace') return cycle === 'on_demand' && Number(host.end_grace_time) > now ? 'grace' : 'hidden';
    // Paid pending/failed and manually suspended products still need their
    // management entry; search is broader than the homepage's using cards.
    if (['Pending', 'Failed', 'Active', 'Suspended'].indexOf(status) === -1) return 'hidden';
    if (['free', 'onetime', 'on_demand'].indexOf(cycle) !== -1) return 'using';
    var due = host.due_time;
    if (due === null || due === undefined || due === '' || !Number.isFinite(Number(due)) || Number(due) < 0) return 'hidden';
    if (Number(due) === 0 || Number(due) > now) return 'using';
    if (Number(host.renew_forbidden) === 1 || Number(host.change_billing_cycle_id) > 0) return 'hidden';
    var deadline = host.renew_recovery_deadline;
    if (deadline === null || deadline === undefined || deadline === '' || !Number.isFinite(Number(deadline))) return 'hidden';
    if (Number(deadline) !== 0 && Number(deadline) <= now) return 'hidden';
    return 'expired';
  }
  async function availableHosts(rows, data, options, currentSession) {
    var now = Number(data.overview && data.overview.server_time) || Date.now() / 1000;
    var renewal = data.overview && (data.overview.renewal_enabled === true || Number(data.overview.renewal_enabled) === 1);
    var visible = new Set(), expired = [], incomplete = false;
    rows.forEach(function (host) {
      var state = hostState(host, now);
      if (state === 'using' || state === 'grace') visible.add(Number(host.id));
      else if (state === 'expired' && renewal) expired.push(host);
    });
    for (var start = 0; start < expired.length; start += 20) {
      if (!currentSession() || (options.signal && options.signal.aborted)) return { rows: [], incomplete: false };
      var batch = expired.slice(start, start + 20), params = {};
      batch.forEach(function (host, index) { params['ids[' + index + ']'] = Number(host.id); });
      try {
        var response = await shared.Request.request('/host/renew/batch', { params: params, signal: options.signal, language: options.language, timeout: 10000 });
        if (!response.data || !Array.isArray(response.data.list)) throw new Error('续费资格读取失败');
        batch.forEach(function (host) {
          var current = response.data.list.find(function (item) { return item && Number(item.id) === Number(host.id); });
          if (!current) return;
          var fresh = Object.assign({}, host);
          ['status', 'due_time', 'suspend_type', 'billing_cycle', 'renew_forbidden', 'change_billing_cycle_id', 'is_delete'].forEach(function (field) {
            if (Object.prototype.hasOwnProperty.call(current, field)) fresh[field] = current[field];
          });
          var state = hostState(fresh, now);
          if (state === 'using' || (state === 'expired' && Array.isArray(current.billing_cycles) && current.billing_cycles.length)) visible.add(Number(host.id));
        });
      } catch (error) { incomplete = true; }
    }
    return { rows: currentSession() ? rows.filter(function (host) { return visible.has(Number(host.id)); }) : [], incomplete: incomplete };
  }
  async function search(options) {
    options = options || {};
    var keywords = String(options.keywords || '').trim();
    // The native global search treats "0" as empty; list APIs may otherwise
    // turn it into an unfiltered query rather than a matching search.
    if (!keywords || keywords === '0') return { groups: [], errors: [], pending: 0 };
    var token = shared.Request.getToken ? shared.Request.getToken() : null;
    var sources = (options.sources ? options.sources.slice() : pluginSources(options)).filter(function (source) {
      // Old consumers may still explicitly include member products. Keep the
      // public search usable without issuing a protected read as a guest.
      return (source.key !== 'hosts' && source.key !== 'pages') || !!token;
    });
    var slots = sources.map(function () { return null; }), pending = sources.length;
    function currentSession() { return token === null || !shared.Request.getToken || token === shared.Request.getToken(); }
    function snapshot() {
      var groups = [], errors = [], index = 0;
      slots.forEach(function (slot, position) {
        if (!slot) return;
        if ((sources[position].key === 'hosts' || sources[position].key === 'pages') && !currentSession()) return;
        if (slot.error) errors.push(sources[position].label);
        if (!slot.group) return;
        var group = Object.assign({}, slot.group, { items: slot.group.items.map(function (item) { return Object.assign({}, item, { index: index++ }); }) });
        groups.push(group);
      });
      return { groups: groups, errors: errors, pending: pending, partialFailure: errors.length > 0 && (groups.length > 0 || errors.length < sources.length || slots.some(function (slot) { return slot && slot.succeeded; })) };
    }
    function publish() {
      if (options.onUpdate && !(options.signal && options.signal.aborted) && currentSession()) options.onUpdate(snapshot());
    }
    // The native list contracts remain unchanged. Bound supplementary public
    // queries across all sources, and do not start queued work after cancellation.
    var publicActive = 0, publicQueue = [];
    function publicRead(path, params) {
      return new Promise(function (resolve, reject) {
        publicQueue.push({ path: path, params: params, resolve: resolve, reject: reject });
        drain();
      });
    }
    function drain() {
      while (publicActive < 3 && publicQueue.length) {
        (function (job) {
          if ((options.signal && options.signal.aborted) || !currentSession()) { job.reject(new Error('搜索已取消')); return; }
          publicActive++;
          Promise.resolve().then(function () {
            if ((options.signal && options.signal.aborted) || !currentSession()) throw new Error('搜索已取消');
            return shared.Request.request(job.path, { params: job.params, signal: options.signal, language: options.language, timeout: 10000, unauthorized: 'ignore' });
          }).then(job.resolve, job.reject).finally(function () { publicActive--; drain(); });
        })(publicQueue.shift());
      }
    }
    await Promise.all(sources.map(async function (source, position) {
      try {
        if (source.key === 'pages') {
          var pageItems = await shared.MemberSearchPages.search(keywords, { signal: options.signal, language: options.language });
          if (!Array.isArray(pageItems)) throw new Error('页面搜索结果格式错误');
          var pageSeen = new Set();
          pageItems = pageItems.filter(function (item) {
            if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || pageSeen.has(item.url)) return false;
            pageSeen.add(item.url); return true;
          }); // The directory has already ranked titles, aliases and hierarchy.
          slots[position] = { group: pageItems.length ? { key: source.key, label: source.label, items: pageItems.slice(0, 6), more: pageItems.length > 6 } : null };
          return;
        }
        var rows = [], data = {}, incomplete = false, succeeded = false, seenCandidates = new Set(), nativeMore = false;
        function rankRow(row) {
          return shared.SearchMatch.score(row.title || row.product_name || row.name, keywords,
            { description: source.key === 'products' ? row.description : '' }) || (source.key === 'help' && row.search === true ? 100 : 0);
        }
        function commit() {
          var orderedRows = rows.map(function (row, order) { return { row: row, order: order, rank: rankRow(row) }; })
          .sort(function (a, b) { return b.rank - a.rank || a.order - b.order; }).map(function (entry) { return entry.row; });
        var seen = new Set();
        orderedRows = orderedRows.filter(function (row) { var id = Number(row.id); if (seen.has(id)) return false; seen.add(id); return true; });
        var items = orderedRows.slice(0, 6).map(function (row) {
          var id = Number(row.id);
          var item = { key: source.key + ':' + id, title: row.title || row.name || '内容 #' + id, description: '' };
          if (source.key === 'hosts') {
            item.title = row.product_name || row.name || '产品 #' + id;
            item.description = [row.name, row.match_ip, '编号 ' + id].filter(Boolean).join(' · ');
            item.url = '/productdetail.htm?id=' + id;
          } else if (source.key === 'products') {
            item.description = [row.product_group_name_first, row.product_group_name_second].filter(Boolean).join(' / ');
            var productSummary = summaryText(row.description); if (productSummary) item.summary = productSummary;
            item.url = '/cart/goodsList.htm?product_id=' + id;
          } else if (options.context !== 'website' && Number.isSafeInteger(Number(source.pluginId)) && Number(source.pluginId) > 0) {
            item.description = [row.category || source.label, articleDate(row.create_time)].filter(Boolean).join(' · ');
            item.url = '/plugin/' + Number(source.pluginId) + '/' + (source.key === 'help' ? 'helpTotal' : 'news_detail') + '.htm?id=' + id;
          } else {
            item.description = [row.category || source.label, articleDate(row.create_time)].filter(Boolean).join(' · ');
            item.url = (source.key === 'news' ? '/news-details.html' : source.key === 'announcement' ? '/announce-details.html' : '/document-details.html') + '?id=' + id;
          }
          if (['news', 'announcement', 'help'].indexOf(source.key) !== -1) {
            var articleSummary = summaryText(row.excerpt || row.summary || row.description); if (articleSummary) item.summary = articleSummary;
          }
          return item;
        });
        slots[position] = { error: incomplete, succeeded: succeeded, group: items.length ? { key: source.key, label: source.label, items: items, more: orderedRows.length > 6 || nativeMore } : null };
        }
        if (source.key === 'hosts') {
          // IPs and host identifiers retain the exact existing native contract.
          var json = await shared.Request.request('/cra1-theme/member/search', { params: { keywords: keywords, page: 1, limit: 6 }, signal: options.signal, language: options.language, timeout: 10000 });
          if (!json.data || !Array.isArray(json.data.list)) throw new Error('搜索结果格式错误');
          data = json.data; succeeded = true;
          var availability = await availableHosts(data.list.filter(function (row) { return row && Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0; }), data, options, currentSession);
          rows = availability.rows; incomplete = availability.incomplete; commit();
        } else {
          var variants = ['products', 'news', 'announcement'].indexOf(source.key) !== -1 ? shared.SearchMatch.variants(keywords) : [keywords];
          if (source.key === 'news' || source.key === 'announcement') variants = variants.filter(function (value, index) {
            // Native article searches accept at most 150 characters. Keep the
            // user's original query, but omit expanded alternatives that cannot
            // satisfy that contract instead of truncating their meaning.
            return index === 0 || Array.from(value).length <= 150;
          });
          // Read the original first so native/plugin matches and fast results
          // survive a failure in any optional supplementary query.
          for (var variant = 0; variant < variants.length; variant++) {
            if ((options.signal && options.signal.aborted) || !currentSession()) break;
            try {
              var response = await publicRead('/' + source.path, { keywords: variants[variant], page: 1, limit: 18 });
              if (!response.data || !Array.isArray(response.data.list)) throw new Error('搜索结果格式错误');
              data = response.data; succeeded = true;
              var received = data.list;
              if (source.key === 'help') received = received.reduce(function (all, group) {
                if (!group) return all;
                return all.concat((Array.isArray(group.helps) ? group.helps : []).filter(function (row) {
                  return row && (row.search === true || rankRow(row) > 0);
                }).map(function (row) { return Object.assign({}, row, { category: group.name }); }));
              }, []);
              received.forEach(function (row) {
                if (!row || !Number.isSafeInteger(Number(row.id)) || Number(row.id) <= 0 || seenCandidates.has(Number(row.id))) return;
                // An exact native result can match native-only fields/hooks.
                // Supplementary patterns must match the visible search fields.
                if (variant > 0 && rankRow(row) === 0) return;
                seenCandidates.add(Number(row.id)); rows.push(row);
              });
              if (source.key !== 'help' && Number(data.count) > 6) nativeMore = true;
            } catch (error) { incomplete = true; }
            commit(); publish();
          }
          commit();
        }
      } catch (error) {
        slots[position] = { error: true };
      }
      finally { pending -= 1; publish(); }
    }));
    return snapshot();
  }
  // Store only queries on this browser, never result titles, URLs or credentials.
  // Public history survives browser restarts; member history stays in this tab
  // and is isolated by the same native account/subaccount identity as checkout.
  var historyMemory = new Map(), historyUnstored = new Set();
  function historyScope(token) {
    if (!token) return { key: 'cra1-search-history:guest', storage: 'localStorage' };
    try {
      var info = JSON.parse(root.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).info;
      var account = String(info.id), subaccount = String(info.sub_account_id || info.sub_id || 0);
      if (/^[1-9]\d*$/.test(account) && /^(?:0|[1-9]\d*)$/.test(subaccount)) return { key: 'cra1-search-history:member:' + account + ':' + subaccount, storage: 'sessionStorage' };
    } catch (error) { /* Opaque tokens use memory only, separated from guests. */ }
    return { key: token, storage: '' };
  }
  function historyKey(value) { return shared.SearchMatch.normalize(value).replace(/\s/g, ''); }
  function historyRows(value) {
    var seen = new Set();
    return (Array.isArray(value) ? value : []).filter(function (term) {
      if (typeof term !== 'string' || term.length > 100 || !term.trim() || term.trim() === '0') return false;
      var key = historyKey(term); if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).map(function (term) { return term.trim(); }).slice(0, 7);
  }
  function readHistory(scope) {
    var rows = historyMemory.get(scope.key) || [];
    if (scope.storage && !historyUnstored.has(scope.key)) {
      try { var saved = root[scope.storage].getItem(scope.key); rows = saved === null ? [] : historyRows(JSON.parse(saved)); }
      catch (error) { /* Disabled or damaged storage must not interrupt search. */ }
    }
    rows = historyRows(rows); historyMemory.set(scope.key, rows); return rows;
  }
  function writeHistory(scope, rows) {
    rows = historyRows(rows); historyMemory.set(scope.key, rows);
    if (scope.storage) {
      try { if (rows.length) root[scope.storage].setItem(scope.key, JSON.stringify(rows)); else root[scope.storage].removeItem(scope.key); }
      catch (error) { historyUnstored.add(scope.key); /* Keep memory authoritative when writes are unavailable or full. */ }
    }
  }
  var sequence = 0;
  function mount(host, options) {
    options = options || {};
    if (host.__cra1HeaderSearch) return host.__cra1HeaderSearch;
    var UI = shared.UI, doc = host.ownerDocument;
    var desktopMedia = root.matchMedia('(min-width: 1024px)'), mobileMedia = root.matchMedia('(max-width: 767px)');
    var desktop = desktopMedia.matches, restoringFocus = false, geometryFrame = null, geometryObserver = null;
    var context = options.context || 'website';
    var prefix = options.idPrefix || ('cra1-header-search-' + (++sequence));
    var copy = { placeholder: '搜索产品、新闻、公告、文档', memberPlaceholder: '搜索页面、产品、主机标识或 IP', searching: '正在搜索…', noresult: '没有找到相关内容，请换个关键词' };
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
    var resultsNode = null, listNode = null, destroyed = false, composing = false, unwatchSession = null, completedQuery = null;
    var state = { groups: [], errors: [], loading: false, activeIndex: -1, partialFailure: false }, generation = 0, timer = null, abort = null, identityToken = sessionToken();
    panel.id = prefix + '-panel'; input.id = prefix;
    function placeholder() {
      var memberSearch = !!sessionToken() && !!shared.MemberSearchPages;
      if (!desktop) return memberSearch ? copy.memberPlaceholder : copy.placeholder;
      var customPlaceholder = typeof copy.placeholder === 'string' && copy.placeholder !== '搜索产品、新闻、公告、文档';
      var customMemberPlaceholder = typeof copy.memberPlaceholder === 'string' && copy.memberPlaceholder !== '搜索页面、产品、主机标识或 IP';
      if (context === 'website') {
        // Migrate the old stock copy only while rendering. Merchant overrides
        // and the saved theme configuration are left intact.
        return customPlaceholder ? copy.placeholder : '搜索文档、商品等内容';
      }
      if (sessionToken() && customMemberPlaceholder) return copy.memberPlaceholder;
      if (customPlaceholder) return copy.placeholder;
      return sessionToken() ? '搜索商品、服务器 IP、管理页面等' : '搜索商品、文档等公开内容';
    }
    function syncSurface() {
      host.classList.toggle('is-persistent', desktop);
      trigger.hidden = desktop;
      panel.hidden = !desktop && !popover.isOpen;
      positionResults();
    }
    function historyItems() {
      return readHistory(historyScope(sessionToken())).map(function (term, index) { return { history: true, title: term, index: index }; });
    }
    function items() {
      return popover.isOpen && !input.value.trim() && !composing ? historyItems() : state.groups.reduce(function (all, group) { return all.concat(group.items); }, []);
    }
    function remember(keywords, token) {
      if (identityToken !== token || token !== sessionToken() || composing) return;
      var term = String(keywords || '').trim();
      if (!term || term === '0' || term.length > 100 || !historyKey(term)) return;
      var scope = historyScope(token), key = historyKey(term);
      writeHistory(scope, [term].concat(readHistory(scope).filter(function (value) { return historyKey(value) !== key; })));
    }
    function invalidate() { generation += 1; root.clearTimeout(timer); timer = null; if (abort) { abort.abort(); abort = null; } }
    function sessionToken() { return shared.Request && shared.Request.getToken ? shared.Request.getToken() : ''; }
    function clearSession() {
      if (destroyed) return;
      identityToken = sessionToken(); composing = false; completedQuery = null; invalidate(); input.value = '';
      state.groups = []; state.errors = []; state.activeIndex = -1; state.partialFailure = false; state.loading = false;
      close(host.contains(doc.activeElement)); render();
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
      if (identityToken !== sessionToken()) { if (event) event.preventDefault(); clearSession(); return; }
      if (item.history) {
        if (event) event.preventDefault();
        input.value = item.title; state.activeIndex = -1; UI.focus(input); remember(item.title, sessionToken()); perform(); return;
      }
      remember(input.value, sessionToken());
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
      if (event) event.preventDefault();
      popover.close(false);
      if (options.onNavigate) options.onNavigate(item.url);
      else root.location.href = item.url;
    }
    function render() {
      if (identityToken !== sessionToken()) { clearSession(); return; }
      var memberSearch = !!sessionToken() && !!shared.MemberSearchPages;
      input.placeholder = placeholder();
      var accessibleName = context === 'website' ? '搜索文档、商品等公开内容' : sessionToken() ? '搜索商品、服务器 IP、管理页面等' : '搜索商品、文档等公开内容';
      input.setAttribute('aria-label', desktop ? (input.placeholder.trim() ? input.placeholder : accessibleName) : memberSearch ? '搜索会员页面、标签、产品、主机标识和 IP' : '搜索产品、新闻、公告和帮助文档');
      clearButton.hidden = !input.value;
      var showingHistory = !input.value.trim() && !composing, recent = showingHistory ? historyItems() : [];
      var visible = popover.isOpen && (!!input.value.trim() || recent.length > 0);
      input.setAttribute('aria-expanded', String(visible));
      if (!visible) {
        if (resultsNode) resultsNode.remove(); resultsNode = null; listNode = null;
        input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant'); return;
      }
      if (!resultsNode) { resultsNode = doc.createElement('div'); resultsNode.className = 'cra1-header-search__results'; panel.appendChild(resultsNode); }
      resultsNode.replaceChildren();
      if (showingHistory) {
        var history = doc.createElement('div'); history.className = 'cra1-header-search__history';
        var historyHeading = doc.createElement('div'); historyHeading.className = 'cra1-header-search__history-title';
        var historyLabel = doc.createElement('span'); historyLabel.textContent = '搜索历史';
        var erase = doc.createElement('button'); erase.type = 'button'; erase.className = 'cra1-header-search__history-clear cui-button cui-button--ghost'; erase.textContent = '清空'; erase.setAttribute('aria-label', '清空搜索历史');
        erase.addEventListener('click', function () { if (identityToken !== sessionToken()) { clearSession(); return; } writeHistory(historyScope(sessionToken()), []); state.activeIndex = -1; render(); UI.focus(input); });
        historyHeading.append(historyLabel, erase); history.appendChild(historyHeading);
        listNode = doc.createElement('div'); listNode.id = prefix + '-results'; listNode.className = 'cra1-header-search__history-list'; listNode.setAttribute('role', 'listbox'); listNode.setAttribute('aria-label', '搜索历史');
        input.setAttribute('aria-controls', listNode.id);
        recent.forEach(function (item) {
          var button = doc.createElement('button'); button.type = 'button'; button.id = prefix + '-results-' + item.index; button.dataset.index = item.index; button.className = 'cra1-header-search__history-item'; button.setAttribute('role', 'option');
          var icon = doc.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = UI.icon('search');
          var label = doc.createElement('span'); label.className = 'cra1-header-search__history-text'; label.textContent = item.title;
          button.append(icon, label); button.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          button.addEventListener('click', function (event) { navigate(item, event); }); listNode.appendChild(button);
        });
        history.appendChild(listNode); resultsNode.appendChild(history); setActive(); positionResults(); return;
      }
      var count = items().length;
      var status = doc.createElement('p'); status.className = 'cra1-header-search__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      status.textContent = composing || (state.loading && !count) ? copy.searching : count ? '找到 ' + count + ' 条结果' + (state.loading ? '，正在继续搜索…' : '') : state.errors.length ? state.partialFailure ? '部分内容暂时无法搜索，请重试' : '暂时无法搜索，请点击重试' : copy.noresult;
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
          if (item.summary) {
            var summary = doc.createElement('span'); summary.className = 'cra1-header-search__item-summary';
            titleParts(item.summary, input.value).forEach(function (part) { var node = doc.createElement(part.match ? 'mark' : 'span'); node.textContent = part.text; summary.appendChild(node); });
            link.appendChild(summary);
          }
          link.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          link.addEventListener('click', function (event) { navigate(item, event); }); section.appendChild(link);
        });
        listNode.appendChild(section);
      });
      if (state.errors.length) {
        var error = doc.createElement('div'); error.className = 'cra1-header-search__error'; error.setAttribute('role', 'status');
        var message = doc.createElement('span'); message.textContent = count || state.partialFailure ? '部分内容暂时无法搜索' : state.loading ? '部分内容暂时无法搜索，正在继续查询' : '搜索暂时不可用，请重试';
        var retry = doc.createElement('button'); retry.type = 'button'; retry.className = 'cui-button cui-button--ghost'; retry.textContent = '重试'; retry.setAttribute('aria-label', '重试搜索');
        retry.addEventListener('click', function () { perform(); UI.focus(input); });
        error.append(message, retry); resultsNode.appendChild(error);
      }
      setActive(); positionResults();
    }
    async function perform() {
      if (identityToken !== sessionToken()) { clearSession(); return; }
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1; state.partialFailure = false;
      var keywords = input.value.trim();
      if (!popover.isOpen || !keywords || composing || destroyed) { state.loading = false; render(); return; }
      state.loading = true; render();
      var current = generation, token = sessionToken(), controller = abort = new AbortController();
      try {
        var configuration = options.getSearchOptions ? options.getSearchOptions() : options;
        var result = await search(Object.assign({}, configuration, { keywords: keywords, signal: controller.signal, onUpdate: function (partial) {
          if (current !== generation || destroyed || !popover.isOpen) return;
          if (token !== sessionToken()) { clearSession(); return; }
          var selected = items()[state.activeIndex], selectedKey = selected && selected.key;
          state.groups = partial.groups; state.errors = partial.errors; state.partialFailure = partial.partialFailure; state.loading = partial.pending > 0;
          state.activeIndex = selectedKey ? items().findIndex(function (item) { return item.key === selectedKey; }) : -1;
          render();
        } }));
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.groups = result.groups; state.errors = result.errors; state.partialFailure = result.partialFailure;
        completedQuery = { keywords: keywords, token: token };
      } catch (error) {
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.errors = ['搜索服务']; state.partialFailure = false;
      }
      if (current !== generation || destroyed || !popover.isOpen) return;
      abort = null; state.loading = false; render();
    }
    function schedule() {
      if (identityToken !== sessionToken()) { clearSession(); return; }
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1; state.partialFailure = false;
      state.loading = popover.isOpen && !!input.value.trim() && !composing;
      render(); if (state.loading) timer = root.setTimeout(perform, 280);
    }
    var popover = UI.createPopover({
      root: host, trigger: trigger, panel: panel, group: 'header', initialFocus: input, beforeOpen: options.beforeOpen,
      manageVisibility: false, bindTrigger: false,
      onOpenChange: function (open) {
        if (!open) {
          if (completedQuery && completedQuery.keywords === input.value.trim()) remember(completedQuery.keywords, completedQuery.token);
          completedQuery = null; composing = false; invalidate(); state.loading = false;
        }
        syncSurface();
        if (options.onOpenChange) options.onOpenChange(open);
        render();
        if (open) { UI.focus(input); if (input.value.trim()) perform(); }
      },
    });
    function positionResults() {
      if (destroyed) return;
      var expanded = desktop && (popover.isOpen || panel.contains(doc.activeElement));
      if (desktop) {
        // Grow over the existing navigation, keeping its layout and the right
        // action controls in place. Use this header's bounds, not a site width.
        var header = host.closest('.cra1-site-header__row') || host.closest('header') || doc.documentElement;
        var area = header.getBoundingClientRect(), anchor = host.getBoundingClientRect();
        var viewport = doc.documentElement.clientWidth || root.innerWidth;
        var available = Math.max(anchor.width, Math.min(anchor.right, viewport - 12) - Math.max(12, area.left + 12));
        var width = Math.min(available, Math.max(anchor.width, area.width * 0.68));
        var value = Math.round(width * 100) / 100 + 'px';
        if (host.style.getPropertyValue('--cra1-search-expanded-width') !== value) host.style.setProperty('--cra1-search-expanded-width', value);
      } else host.style.removeProperty('--cra1-search-expanded-width');
      host.classList.toggle('is-expanded', expanded);
      // Both surfaces inherit the same panel width during the whole transition.
      if (resultsNode) { resultsNode.style.removeProperty('width'); resultsNode.style.removeProperty('right'); }
    }
    function queueGeometry() {
      if (geometryFrame !== null || destroyed) return;
      geometryFrame = root.requestAnimationFrame(function () { geometryFrame = null; positionResults(); });
    }
    function close(restore) {
      popover.close(false);
      if (restore) {
        restoringFocus = true; UI.focus(desktop ? input : trigger); restoringFocus = false;
      }
    }
    function onTrigger(event) { event.preventDefault(); if (popover.isOpen) close(false); else popover.show(); }
    function onFocus() { if (desktop && !restoringFocus && !popover.isOpen) popover.show(); }
    function onInputClick() { if (desktop && !popover.isOpen) popover.show(); }
    function onInput() { if (desktop && !popover.isOpen) { popover.show(); return; } schedule(); }
    function onCompositionStart() { composing = true; invalidate(); state.loading = false; render(); }
    function onCompositionEnd() { composing = false; schedule(); }
    function onKey(event) {
      if (event.isComposing || composing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (desktop && !popover.isOpen) { event.preventDefault(); popover.show(); return; }
      var count = items().length; if (!count) return;
      event.preventDefault(); state.activeIndex = event.key === 'ArrowDown' ? (state.activeIndex + 1) % count : state.activeIndex < 0 ? count - 1 : (state.activeIndex + count - 1) % count;
      setActive(); var item = doc.getElementById(prefix + '-results-' + state.activeIndex); if (item) item.scrollIntoView({ block: 'nearest' });
    }
    function onSubmit(event) { event.preventDefault(); if (composing) return; if (desktop && !popover.isOpen) { popover.show(); return; } var selected = items()[state.activeIndex]; if (selected) navigate(selected); else { remember(input.value, sessionToken()); perform(); } }
    function onClear() { input.value = ''; schedule(); UI.focus(input); }
    function onClose() { close(true); }
    function onHostKey(event) {
      if (desktop && event.key === 'Escape' && !event.isComposing && popover.isOpen) {
        event.preventDefault(); event.stopPropagation(); close(true);
      }
    }
    function preventFocus(event) { event.preventDefault(); }
    function stopClick(event) { event.stopPropagation(); }
    function onHistoryStorage(event) {
      if (event.key === 'cra1-search-history:guest' || event.key === null) {
        historyMemory.delete('cra1-search-history:guest'); historyUnstored.delete('cra1-search-history:guest');
        if (!sessionToken() && popover.isOpen && !input.value.trim()) { state.activeIndex = -1; render(); }
      }
    }
    function onBreakpoint() {
      close(false); desktop = desktopMedia.matches; syncSurface(); render();
      if (panel.hidden && panel.contains(doc.activeElement)) doc.activeElement.blur();
    }
    input.addEventListener('focus', onFocus); input.addEventListener('click', onInputClick); trigger.addEventListener('click', onTrigger);
    input.addEventListener('input', onInput); input.addEventListener('compositionstart', onCompositionStart); input.addEventListener('compositionend', onCompositionEnd); input.addEventListener('keydown', onKey);
    form.addEventListener('submit', onSubmit); clearButton.addEventListener('mousedown', preventFocus); clearButton.addEventListener('click', onClear); closeButton.addEventListener('click', onClose); host.addEventListener('click', stopClick); host.addEventListener('keydown', onHostKey);
    desktopMedia.addEventListener('change', onBreakpoint); mobileMedia.addEventListener('change', onBreakpoint);
    root.addEventListener('resize', queueGeometry); root.addEventListener('storage', onHistoryStorage);
    host.addEventListener('focusin', positionResults); host.addEventListener('focusout', queueGeometry);
    if (root.ResizeObserver) {
      geometryObserver = new root.ResizeObserver(queueGeometry);
      [host, host.parentElement, host.closest('header')].filter(Boolean).forEach(function (node) { geometryObserver.observe(node); });
    }
    // Search can include member products. Purge them on identity changes and
    // before a hidden/BFCache page retains the old account's DOM.
    if (shared.NotificationSession) unwatchSession = shared.NotificationSession.watch(clearSession);
    else doc.addEventListener('api:unauthorized', clearSession);
    doc.addEventListener('visibilitychange', onVisibility); root.addEventListener('pagehide', clearSession);
    var component = {
      open: function () { popover.show(); }, close: close, refresh: schedule,
      get isOpen() { return popover.isOpen; },
      destroy: function () {
        if (destroyed) return;
        popover.destroy(); destroyed = true; invalidate();
        input.removeEventListener('focus', onFocus); input.removeEventListener('click', onInputClick); trigger.removeEventListener('click', onTrigger);
        input.removeEventListener('input', onInput); input.removeEventListener('compositionstart', onCompositionStart); input.removeEventListener('compositionend', onCompositionEnd); input.removeEventListener('keydown', onKey);
        form.removeEventListener('submit', onSubmit); clearButton.removeEventListener('mousedown', preventFocus); clearButton.removeEventListener('click', onClear); closeButton.removeEventListener('click', onClose); host.removeEventListener('click', stopClick); host.removeEventListener('keydown', onHostKey);
        desktopMedia.removeEventListener('change', onBreakpoint); mobileMedia.removeEventListener('change', onBreakpoint); root.removeEventListener('resize', queueGeometry); root.removeEventListener('storage', onHistoryStorage);
        host.removeEventListener('focusin', positionResults); host.removeEventListener('focusout', queueGeometry);
        if (geometryObserver) geometryObserver.disconnect();
        if (geometryFrame !== null) root.cancelAnimationFrame(geometryFrame);
        host.style.removeProperty('--cra1-search-expanded-width');
        host.classList.remove('is-persistent', 'is-expanded'); host.replaceChildren(); delete host.__cra1HeaderSearch;
        if (unwatchSession) unwatchSession(); else doc.removeEventListener('api:unauthorized', clearSession);
        doc.removeEventListener('visibilitychange', onVisibility); root.removeEventListener('pagehide', clearSession);
      },
    };
    syncSurface(); render();
    host.__cra1HeaderSearch = component;
    return component;
  }
  shared.HeaderSearch = { search: search, mount: mount, pluginSources: pluginSources, titleRank: titleRank, titleParts: titleParts };
  root.CRA1HeaderSearch = shared.HeaderSearch;
})(typeof window !== 'undefined' ? window : globalThis);
