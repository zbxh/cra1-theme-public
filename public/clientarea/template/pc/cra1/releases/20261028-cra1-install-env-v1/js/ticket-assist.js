/**
 * 工单提交助手（主题层增强，不改工单插件）· 步进式版本
 *
 * 作用页：当前工单插件的 addTicket.htm（整页 Vue 插件 .template.add-ticket）
 * 数据源：会员中心主题快照 content.ticket_assist
 *
 * 交互（后台配置驱动）：
 *   1. 步进分类：页面只显示「问题分类」步进面板（1-3 级），未选到具体分类时
 *      隐藏正式表单（无法提交）；选到叶子分类后才展开表单并自动匹配部门、
 *      预填描述模板、展示教程链接；
 *   2. 按部门占位：type_placeholders 选中部门后覆盖通用 placeholder；
 *   3. 必选产品：require_host_types 命中部门时提交前校验，多选框带 * 标志；
 *   4. 产品多选：隐藏插件单选下拉，渲染主题复选网格，提交传 host_ids 数组
 *      （服务端 TicketValidate::checkHostIds 原生支持数组遍历校验）；
 *   5. 工单通知：GET /console/v1/ticket/config 的 ticket_notice_open /
 *      ticket_notice_description 显示在分类面板内（与插件列表页同一来源）。
 *
 * 关键约束：插件 Vue mount 会用 outerHTML 快照替换初始 .template.add-ticket
 * 节点，且异步数据就绪后还会重建表单内节点——任何跨异步缓存的元素引用都会
 * 变成游离树（往里插入「成功」但页面看不见）。因此本文件所有 DOM 读写都用
 * document 级实时查询，自定义节点（面板/多选框）保留引用并由 800ms 守护
 * 轮询在丢失时重插。
 */
;(function (global) {
  if (!/addTicket\.htm/.test(global.location.pathname) && !(global.__THEME_PREVIEW__ && global.__THEME_PREVIEW__.editorId === 'ticket')) return

  var MAX_HOSTS = 5
  var state = {
    cfg: null, vm: null,
    stage: 'pick',            // pick | tutorial | form
    picked: null, stepPath: [],
    hostSel: [], hostInit: false, hostFormItem: null,
    panelEl: null, hostGuard: null,
    autoTpl: '',             // 最近一次自动预填的描述模板（未被用户改动前允许切换覆盖）
  }

  function $(sel, root) { return (root || document).querySelector(sel) }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)) }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  /* 实时查询：每次都从 document 取（见文件头「关键约束」） */
  function liveRoot() { return $('.template.add-ticket') }
  function liveForm() { return $('.main-form') }

  function toast(msg, ok) {
    var el = document.createElement('div')
    el.setAttribute('role', 'alert')
    el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:3000;' +
      'padding:10px 18px;border-radius:8px;font-size:13px;line-height:1.5;max-width:80vw;' +
      'box-shadow:0 8px 28px -14px rgba(15,60,120,0.3);' +
      (ok === false
        ? 'background:#fff1f0;border:1px solid #ffa39e;color:#b42318;'
        : 'background:#f6ffed;border:1px solid #b7eb8f;color:#389e0d;')
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(function () { el.remove() }, 3000)
  }

  function waitFor(fn, done, timeout) {
    var t0 = Date.now()
    var timer = setInterval(function () {
      var v = null
      try { v = fn() } catch (e) { v = null }
      if (v) { clearInterval(timer); done(v) }
      else if (Date.now() - t0 > (timeout || 10000)) { clearInterval(timer) }
    }, 250)
  }

  function readConfig() {
    try {
      var snap = global.__CRA1_MEMBER_SNAPSHOT__
      var ta = snap && snap.content && snap.content.ticket_assist
      // Disabled content is deliberately omitted from public snapshots. Once
      // a snapshot is available, absence means use the native form immediately.
      if (snap && snap.content) return ta || { enabled: 0 }
    } catch (e) {}
    return null
  }

  function getVm() {
    var root = liveRoot()
    if (!root) return null
    var vm = root.__vue__
    if (!vm || !vm.ticketData) return null
    return vm
  }

  /* 当前节点有效部门：叶子自身 type_id，否则沿父链向上继承 */
  function effectiveType(node, path) {
    if (node && Number(node.type_id)) return Number(node.type_id)
    for (var i = (path || []).length - 1; i >= 0; i--) {
      if (Number(path[i].type_id)) return Number(path[i].type_id)
    }
    return 0
  }

  function visibleEnabled(list) {
    return (list || []).filter(function (c) { return Number(c.enabled) === 1 })
  }

  /* ------------------------------------------------------------------ */
  /* 步进式分类面板                                                       */
  /* ------------------------------------------------------------------ */

  /* 面板确保就位：无则创建并插入（幂等）；被插件 Vue 清掉则重插同一节点 */
  function ensurePanel() {
    var form = liveForm()
    if (!form || !form.parentNode) return null
    if (state.panelEl && !document.contains(state.panelEl)) {
      form.parentNode.insertBefore(state.panelEl, form)
    }
    if (!state.panelEl) {
      var panel = document.createElement('div')
      panel.className = 'cra1-ta-panel'
      panel.setAttribute('data-cra1-ta', 'stepper')
      panel.innerHTML =
        '<div class="cra1-ta-notice" hidden></div>' +
        '<div class="cra1-ta-panel__head">' +
        '<span class="cra1-ta-panel__title">提交工单前，请先选择问题分类</span>' +
        '<span class="cra1-ta-panel__hint">按步骤选择，帮助我们更快定位问题</span>' +
        '</div>' +
        '<div class="cra1-ta-steps"></div>' +
        '<div class="cra1-ta-panel__extra" hidden></div>'
      form.parentNode.insertBefore(panel, form)
      state.panelEl = panel
      renderStep(0)
      loadNotice()
    }
    return state.panelEl
  }

  function renderStepper() {
    var cfg = state.cfg
    if (!cfg || !visibleEnabled(cfg.categories).length) return false
    return !!ensurePanel()
  }

  function renderStep(level) {
    var cfg = state.cfg
    var panel = state.panelEl
    if (!panel || !cfg) return
    var stepsEl = $('.cra1-ta-steps', panel)
    state.stepPath = state.stepPath.slice(0, level)
    // 回到选择流程：统一清掉上一轮「已选」痕迹（半切换防护）——
    // 已选条 / 参考行 / 必选提示 / 表单显隐。凡走 renderStep 都意味着重新挑选
    state.stage = 'pick'
    state.picked = null
    var f0 = liveForm()
    if (f0) f0.classList.add('cra1-ta-form-hidden')
    var oldBar = $('.cra1-ta-picked', panel)
    if (oldBar) oldBar.remove()
    var extra0 = $('.cra1-ta-panel__extra', panel)
    if (extra0) { extra0.hidden = true; extra0.innerHTML = '' }
    var hint0 = $('.cra1-ta-hostreq')
    if (hint0) hint0.hidden = true

    var crumbs = '<div class="cra1-ta-crumbs">'
    for (var i = 0; i < level; i++) {
      crumbs += '<button type="button" class="cra1-ta-crumb" data-level="' + i + '">' + esc(state.stepPath[i].name) + '</button>' +
        '<span class="cra1-ta-crumb__sep">›</span>'
    }
    crumbs += '<span class="cra1-ta-crumb is-current">第 ' + (level + 1) + ' 步</span></div>'

    var list = level === 0 ? visibleEnabled(cfg.categories) : visibleEnabled(state.stepPath[level - 1].children || [])
    var opts = list.map(function (c) {
      var kids = visibleEnabled(c.children || []).length
      return '<button type="button" class="cra1-ta-cat" role="radio" aria-checked="false" data-id="' + esc(c.id) + '">' +
        '<span class="cra1-ta-cat__name">' + esc(c.name) + '</span>' +
        (kids ? '<span class="cra1-ta-cat__tag">' + kids + ' 项</span>' : '') +
        '</button>'
    }).join('')

    stepsEl.innerHTML = crumbs +
      '<div class="cra1-ta-grid" role="radiogroup" aria-label="第' + (level + 1) + '级分类">' +
      (opts || '<p class="cra1-ta-hosts__empty">该层级暂无可选项</p>') +
      '</div>'

    $$('.cra1-ta-cat', stepsEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id')
        var node = list.filter(function (c) { return String(c.id) === id })[0]
        if (!node) return
        // BUG 修复：点击后立刻把路径截断到本层再 push——重复点击同一选项、
        // 或快速连点不同选项时不会叠加出重复路径
        state.stepPath = state.stepPath.slice(0, level)
        state.stepPath.push(node)
        var kids = visibleEnabled(node.children || [])
        if (kids.length) {
          // 深度保护：路径已达 3 级仍存在可见子级（后台配置异常）时，
          // 视为叶子处理，不再下钻
          if (level + 1 >= 3) {
            finishPicking(node)
            return
          }
          renderStep(level + 1)
        } else {
          finishPicking(node)
        }
      })
    })
    $$('.cra1-ta-crumb[data-level]', stepsEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderStep(Number(btn.getAttribute('data-level')))
      })
    })
  }

  /* 选到叶子：有教程链接 → 先出教程劝导页；无链接 → 直接展开表单 */
  function finishPicking(node) {
    if (node.link) renderTutorial(node)
    else startForm(node)
  }

  function renderPickedBar() {
    var panel = state.panelEl
    if (!panel) return
    var pathEl = $('.cra1-ta-picked', panel)
    if (!pathEl) {
      pathEl = document.createElement('div')
      pathEl.className = 'cra1-ta-picked'
      panel.appendChild(pathEl)
    }
    pathEl.innerHTML = '<span class="cra1-ta-picked__label">已选分类：</span>' +
      state.stepPath.map(function (n) { return '<span class="cra1-ta-picked__item">' + esc(n.name) + '</span>' }).join('<span class="cra1-ta-picked__sep">›</span>') +
      '<button type="button" class="cra1-ta-picked__redo">重新选择</button>'
    $('.cra1-ta-picked__redo', pathEl).addEventListener('click', function () {
      state.picked = null
      state.stepPath = []
      state.hostSel = []
      state.stage = 'pick'
      pathEl.remove()
      var extra = $('.cra1-ta-panel__extra', panel)
      if (extra) { extra.hidden = true; extra.innerHTML = '' }
      var f = liveForm()
      if (f) f.classList.add('cra1-ta-form-hidden')
      renderStep(0)
    })
  }

  /* 教程劝导页：先劝用户看教程，点「无法解决」才进入表单 */
  function renderTutorial(node) {
    state.picked = node
    state.stage = 'tutorial'
    renderPickedBar()   // 已选条与教程文案同步（换分类时立刻反映新路径）
    var panel = state.panelEl
    if (!panel) { startForm(node); return }
    var stepsEl = $('.cra1-ta-steps', panel)
    var pathTxt = state.stepPath.map(function (n) { return esc(n.name) }).join(' › ')
    stepsEl.innerHTML =
      '<div class="cra1-ta-tutorial">' +
      '<div class="cra1-ta-tutorial__title">建议先参考排查教程</div>' +
      '<p class="cra1-ta-tutorial__text">你选择的问题是「' + pathTxt + '」，我们已为你准备了图文排查教程。' +
      '多数情况下按照教程操作可以直接解决问题，无需等待客服响应，处理也更及时。</p>' +
      '<a class="cra1-ta-tutorial__link" href="' + esc(node.link) + '" target="_blank" rel="noopener noreferrer">' +
      esc(node.link_label || '查看排查教程') + '</a>' +
      '<p class="cra1-ta-tutorial__tip">如教程未能解决你的问题，可继续提交工单，我们会尽快处理。</p>' +
      '<button type="button" class="cra1-ta-tutorial__btn">无法解决，仍要提交工单</button>' +
      '</div>'
    $('.cra1-ta-tutorial__btn', stepsEl).addEventListener('click', function () {
      startForm(node)
    })
  }

  /* 展开正式表单：应用部门/模板/占位/必选提示 */
  function startForm(node) {
    var vm = state.vm
    state.picked = node
    state.stage = 'form'
    var tid = effectiveType(node, state.stepPath)

    if (vm && vm.ticketData) {
      if (tid) vm.ticketData.ticket_type_id = tid
      // 模板预填：当前内容为空、或仍等于上次自动预填的模板（用户没改过）时
      // 才允许切换覆盖——用户手动输入的内容绝不覆盖
      var tpl = (node.template || '').trim()
      var cur = (vm.ticketData.content || '')
      if (tpl) {
        if (!cur.trim() || cur === state.autoTpl) {
          vm.ticketData.content = tpl
          state.autoTpl = tpl
        }
      } else if (state.autoTpl && cur === state.autoTpl) {
        // 换到无模板分类且内容还是旧模板 → 清空避免误导
        vm.ticketData.content = ''
        state.autoTpl = ''
      }
    }

    var panel = state.panelEl
    if (panel) {
      // 表单态清掉分类选择区（换分类只能走「重新选择」），不再重复展示
      // 教程劝导块（链接保留在下方「参考」行）
      var stepsEl = $('.cra1-ta-steps', panel)
      if (stepsEl) stepsEl.innerHTML = ''
      var extra = $('.cra1-ta-panel__extra', panel)
      if (extra) {
        if (node.link) {
          extra.hidden = false
          extra.innerHTML =
            '<span class="cra1-ta-extra__label">参考：</span>' +
            '<a class="cra1-ta-extra__link" href="' + esc(node.link) + '" target="_blank" rel="noopener noreferrer">' +
            esc(node.link_label || '查看排查教程') + '</a>' +
            '<span class="cra1-ta-extra__tip">提交前可再对照教程检查</span>'
        } else {
          extra.hidden = true
          extra.innerHTML = ''
        }
      }
    }

    renderPickedBar()

    var f = liveForm()
    if (f) f.classList.remove('cra1-ta-form-hidden')
    // 给 ticket_type_id 赋值会触发插件 Vue 重渲染，可能清掉 host form-item 的
    // 行内隐藏——这里在渲染稳定后强制恢复隐藏（多选复选框已替代单选下拉）；
    // 守护轮询也会持续兜底
    hidePluginHostSelect()
    setTimeout(hidePluginHostSelect, 300)
    applyPlaceholder(tid)
    updateHostReqHint(tid)
  }

  function hidePluginHostSelect() {
    var hf = findHostFormItem()
    if (hf) {
      // 只藏控件本体，保留原 el-form-item 行（label「关联产品」+ required 规则
      // 的红星都归插件管，排版与其他必填项天然一致）
      $$('.select-host', hf).forEach(function (el) { el.style.display = 'none' })
      state.hostFormItem = hf
    }
  }

  /* ------------------------------------------------------------------ */
  /* 工单通知（插件 GET /ticket/config，与列表页同一来源）                  */
  /* ------------------------------------------------------------------ */

  function loadNotice() {
    global.CRA1Shared.Request.request('/ticket/config', { unauthorized: 'redirect' })
      .then(function (res) {
        var d = res && res.data
        if (!d || Number(d.ticket_notice_open) !== 1) return
        var html = String(d.ticket_notice_description || '')
        // 管理员后台保存的是完整 HTML 文档；取 body 内容渲染。
        // 与插件列表页同源同管（XSS 面一致），非用户输入。
        var box = document.implementation.createHTMLDocument('')
        box.body.innerHTML = html
        var inner = box.body.innerHTML.trim()
        if (!inner) return
        var panel = state.panelEl
        if (!panel) return
        var el = $('.cra1-ta-notice', panel)
        if (el) {
          el.hidden = false
          // 只渲染通知正文（无标题）
          el.innerHTML = '<div class="cra1-ta-notice__body"></div>'
          $('.cra1-ta-notice__body', el).innerHTML = inner
        }
      })
      .catch(function () {})
  }

  /* ------------------------------------------------------------------ */
  /* 占位（按部门覆盖通用）                                                */
  /* ------------------------------------------------------------------ */

  function applyPlaceholder(tid) {
    var cfg = state.cfg
    if (!cfg) return
    var ph = ''
    if (tid) {
      var hit = (cfg.type_placeholders || []).filter(function (p) { return Number(p.type_id) === Number(tid) })[0]
      if (hit) ph = hit.placeholder
    }
    if (!ph) ph = cfg.placeholder || ''
    if (!ph.trim()) return
    waitFor(function () {
      return $('.msg-input textarea') || null
    }, function (ta) {
      ta.setAttribute('placeholder', ph)
    }, 5000)
  }

  /* ------------------------------------------------------------------ */
  /* 产品多选                                                             */
  /* ------------------------------------------------------------------ */

  function hostRequired(tid) {
    var cfg = state.cfg
    if (!cfg) return false
    var t = Number(tid) || effectiveType(state.picked, state.stepPath)
    return (cfg.require_host_types || []).map(Number).indexOf(t) > -1
  }

  function updateHostReqHint(tid) {
    var hint = $('.cra1-ta-hostreq')
    if (!hint && hostRequired(tid)) {
      hint = document.createElement('p')
      hint.className = 'cra1-ta-hostreq'
      var f = liveForm()
      if (f && f.parentNode) f.parentNode.insertBefore(hint, f)
    }
    if (hint) {
      var on = hostRequired(tid)
      hint.hidden = !on
      hint.textContent = '该问题分类需要选择关联产品后才能提交'
    }
    // label 红星跟随必选规则（星标在插件 label 内，与其他必填项同位同样式）
    var reqMark = $('.cra1-ta-hosts__req')
    if (reqMark) reqMark.hidden = !hostRequired(tid)
  }

  function findHostFormItem() {
    return $$('.main-form .el-form-item').filter(function (el) {
      return $('.select-host', el)
    })[0] || null
  }

  function renderHostMulti() {
    var vm = state.vm
    var hostFormItem = findHostFormItem()
    if (!hostFormItem || !vm || !Array.isArray(vm.hostList)) return
    if (state.hostInit) return   // 已初始化过（守护会自行重建丢失的节点）
    state.hostInit = true

    /* 复用插件原 el-form-item 行：label「关联产品」+ required 红星、label 左
       (80px)/控件右的排版全部继承，与其他必填项（工单部门/工单标题）一致。
       本组件只替换 label 之外的控件区。 */
    var content = $('.el-form-item__content', hostFormItem)
    if (!content) { state.hostInit = false; return }

    var wrap = document.createElement('div')
    wrap.className = 'cra1-ta-hosts'
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', '关联产品（可多选）')

    /* 控件区插在原控件之后（其内已隐藏 .select-host 兜底），防插件重建 */
    function insertBeside() {
      var hf = findHostFormItem()
      if (!hf) return false
      var c = $('.el-form-item__content', hf)
      if (!c) return false
      if (c.lastElementChild !== wrap) c.appendChild(wrap)
      // label 的红星跟随必选规则（el-form-item.is-required 由插件 rules 决定，
      // 这里再按主题 require_host_types 动态补一个 *)
      var lab = $('.el-form-item__label', hf)
      if (lab) {
        var star = $('.cra1-ta-hosts__req', lab)
        if (!star) {
          star = document.createElement('span')
          star.className = 'cra1-ta-hosts__req'
          star.setAttribute('aria-hidden', 'true')
          star.textContent = '*'
          lab.insertBefore(star, lab.firstChild)
        }
      }
      return true
    }
    if (!insertBeside()) { state.hostInit = false; return }
    hidePluginHostSelect()

    /* 下拉多选：触发框内展示「首个产品名卡片（×移除）+ +N 徽标」（参考
       云厂商多选样式），提示在筛选框右边 */
    wrap.innerHTML =
      '<div class="cra1-ta-msel">' +
      '<div class="cra1-ta-msel__row">' +
      '<button type="button" class="cra1-ta-msel__trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="cra1-ta-msel__text">请选择关联产品（可多选）</span>' +
      '<span class="cra1-ta-msel__sel" hidden>' +
      '<span class="cra1-ta-msel__card">' +
      '<span class="cra1-ta-msel__cardname"></span>' +
      '<span class="cra1-ta-msel__cardx" role="button" tabindex="0" aria-label="移除该产品">×</span>' +
      '</span>' +
      '<span class="cra1-ta-msel__more" hidden></span>' +
      '</span>' +
      '<span class="cra1-ta-msel__arrow" aria-hidden="true"></span>' +
      '</button>' +
      '<span class="cra1-ta-msel__hint">可多选，最多 ' + MAX_HOSTS + ' 个</span>' +
      '</div>' +
      '<div class="cra1-ta-msel__panel" hidden></div>' +
      '</div>'

    var msel = $('.cra1-ta-msel', wrap)
    var trigger = $('.cra1-ta-msel__trigger', wrap)
    var panel = $('.cra1-ta-msel__panel', wrap)
    var textBox = $('.cra1-ta-msel__text', wrap)
    var selBox = $('.cra1-ta-msel__sel', wrap)
    var cardName = $('.cra1-ta-msel__cardname', wrap)
    var cardX = $('.cra1-ta-msel__cardx', wrap)
    var moreBadge = $('.cra1-ta-msel__more', wrap)

    function hostLabel(h) {
      return (h.product_name || '产品') + (h.dedicate_ip || h.name ? '（' + (h.dedicate_ip || h.name) + '）' : '')
    }
    function openPanel() {
      panel.hidden = false
      trigger.setAttribute('aria-expanded', 'true')
      msel.classList.add('is-open')
    }
    function closePanel() {
      panel.hidden = true
      trigger.setAttribute('aria-expanded', 'false')
      msel.classList.remove('is-open')
    }
    trigger.addEventListener('click', function () { panel.hidden ? openPanel() : closePanel() })
    document.addEventListener('click', function (ev) {
      if (panel.hidden) return
      var t = ev.target
      if (t && msel.contains(t)) return
      closePanel()
    }, true)
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !panel.hidden) closePanel()
    })

    /* 框内选中态：首个产品名卡片 + 剩余数量徽标（选 3 个 = 卡片 + 「+2」）；
       卡片 × 移除该产品（阻止冒泡，不触发展开） */
    function renderChips() {
      var sel = state.hostSel
      var list = vm.hostList || []
      if (sel.length) {
        textBox.hidden = true
        selBox.hidden = false
        var first = list.filter(function (x) { return x.id === sel[0] })[0] || {}
        var lbl = hostLabel(first)
        cardName.textContent = lbl
        cardName.title = lbl
        cardX.setAttribute('data-id', sel[0])
        moreBadge.hidden = sel.length < 2
        moreBadge.textContent = '+' + (sel.length - 1)
        moreBadge.title = '已选 ' + sel.length + ' 个产品'
      } else {
        textBox.hidden = false
        selBox.hidden = true
      }
    }
    function removeFirst() {
      var id = Number(cardX.getAttribute('data-id'))
      var i = state.hostSel.indexOf(id)
      if (i > -1) state.hostSel.splice(i, 1)
      renderChips()
      renderOptions()
    }
    cardX.addEventListener('click', function (ev) { ev.stopPropagation(); removeFirst() })
    cardX.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); removeFirst() }
    })

    function renderOptions() {
      var list = vm.hostList || []
      panel.innerHTML = list.length
        ? list.map(function (h) {
            var on = state.hostSel.indexOf(h.id) > -1
            return '<label class="cra1-ta-msel__opt' + (on ? ' is-on' : '') + '">' +
              '<input type="checkbox" ' + (on ? 'checked' : '') + ' data-id="' + h.id + '">' +
              '<span class="cra1-ta-msel__optname">' + esc(hostLabel(h)) + '</span>' +
              (on ? '<span class="cra1-ta-msel__optmark" aria-hidden="true">✓</span>' : '') +
              '</label>'
          }).join('')
        : '<p class="cra1-ta-hosts__empty">暂无可用产品</p>'
      $$('input[type=checkbox]', panel).forEach(function (cb) {
        cb.addEventListener('change', function () {
          var id = Number(cb.getAttribute('data-id'))
          var i = state.hostSel.indexOf(id)
          if (cb.checked) {
            if (i === -1 && state.hostSel.length >= MAX_HOSTS) {
              cb.checked = false
              toast('最多选择 ' + MAX_HOSTS + ' 个产品', false)
              return
            }
            if (i === -1) state.hostSel.push(id)
          } else if (i > -1) state.hostSel.splice(i, 1)
          renderChips()
          renderOptions()
        })
      })
    }

    var lastLen = -1
    state.hostGuard = function () {
      if (!wrap.isConnected) insertBeside()
      // 插件 Vue 重渲染会重建单选下拉 → 持续压制（只藏控件，保留行与 label）
      var hf = findHostFormItem()
      if (hf) {
        $$('.select-host', hf).forEach(function (el) {
          if (el.style.display !== 'none') el.style.display = 'none'
        })
      }
      var len = (vm.hostList || []).length
      if (len !== lastLen || !panel.children.length) {
        lastLen = len
        renderOptions()
        renderChips()
      }
    }
    renderOptions()
    renderChips()
  }

  /* ------------------------------------------------------------------ */
  /* 提交接管（document 级 capture：按钮可能被插件 Vue 重建）                */
  /* ------------------------------------------------------------------ */

  function bindSubmit() {
    document.addEventListener('click', function (ev) {
      var t = ev.target
      var btn = t && t.closest ? t.closest('.main-form .sub-btn') : null
      if (!btn) return
      var vm = state.vm
      var cfg = state.cfg
      if (!vm || !vm.ticketData || !cfg) return
      // 未选分类时表单隐藏，正常不会触发；保险拦截
      if (!state.picked) {
        ev.stopImmediatePropagation()
        ev.preventDefault()
        toast('请先选择问题分类', false)
        return
      }
      var td = vm.ticketData
      var tid = effectiveType(state.picked, state.stepPath)
      var req = hostRequired(tid)
      var multi = state.hostSel.length > 0
      if (!multi && !req) return   // 无多选/规则：插件原逻辑

      ev.stopImmediatePropagation()
      ev.preventDefault()

      if (!(td.title || '').trim()) return toast('请填写工单标题', false)
      if (!Number(td.ticket_type_id)) return toast('请选择工单部门', false)
      if (!(td.content || '').trim()) return toast('请填写问题描述', false)
      if (req && state.hostSel.length === 0) return toast('该问题分类需要先选择关联产品', false)

      var params = {
        title: td.title,
        ticket_type_id: Number(td.ticket_type_id),
        content: td.content,
        host_ids: state.hostSel.map(Number),
        attachment: Array.isArray(td.attachment) ? td.attachment : [],
      }
      global.CRA1Shared.Request.request('/ticket', {
        method: 'POST',
        unauthorized: 'redirect',
        body: params,
      })
        .then(function (res) {
          if (res.status === 200 && res.data && res.data.id) {
            toast('工单提交成功，正在跳转…')
            setTimeout(function () {
              var target = new URL('ticketDetails.htm', global.location.href)
              target.search = '?id=' + encodeURIComponent(res.data.id)
              target.hash = ''
              global.location.href = target.pathname + target.search
            }, 600)
          } else {
            toast((res && res.msg) || '提交失败，请稍后重试', false)
          }
        })
        .catch(function (error) { if (error.code !== 'UNAUTHORIZED') toast(error.message || '网络异常，提交失败', false) })
    }, true)
  }

  /* ------------------------------------------------------------------ */
  /* 启动与守护                                                            */
  /* ------------------------------------------------------------------ */

  function guardTick() {
    if (state.hostGuard) state.hostGuard()
    else renderHostMulti()   // 幂等：hostInit 置位后由 hostGuard 接管
    var cfg = state.cfg
    if (!cfg) return
    var form = liveForm()
    if (!visibleEnabled(cfg.categories).length) {
      // 无可见分类：助手无事可做，恢复插件原样
      if (form) form.classList.remove('cra1-ta-form-hidden')
      return
    }
    if (!renderStepper()) return
    // 表单显隐与阶段同步（插件 Vue 重渲染会丢掉行内 class，这里持续纠偏）
    if (form) {
      if (state.stage === 'form') form.classList.remove('cra1-ta-form-hidden')
      else form.classList.add('cra1-ta-form-hidden')
    }
  }

  function boot() {
    waitFor(getVm, function (vm) {
      state.vm = vm
      waitFor(readConfig, function (cfg) {
        state.cfg = cfg
        if (Number(cfg.enabled) !== 1) {
          var form = liveForm()
          if (form) form.classList.remove('cra1-ta-form-hidden')
          return
        }
        bindSubmit()
        guardTick()
        setInterval(guardTick, 800)
      }, 10000)
    }, 10000)
    // 兜底：25s 内 boot 未完成（快照/接口异常）→ 恢复插件原样可提交
    setTimeout(function () {
      if (!state.cfg) {
        var f = liveForm()
        if (f) f.classList.remove('cra1-ta-form-hidden')
      }
    }, 25000)
  }

  function init() {
    var known = readConfig()
    if (known && Number(known.enabled) !== 1) return
    // BUG 修复：DOMContentLoaded 即隐藏表单（此时 Vue 尚未 mount，隐藏类会进
    // outerHTML 快照）→ mount 后表单天然隐藏，不再「先显示原页面再刷新」
    var f = liveForm()
    if (f) f.classList.add('cra1-ta-form-hidden')
    // DOM 注入等 window.load（插件 Vue 首次 patch 完成后节点才稳定）
    if (document.readyState === 'complete') boot()
    else global.addEventListener('load', boot)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init() })
  } else {
    init()
  }
})(window)

/* Mobile cards share the native view-model and its actions. Unknown table extensions stay native. */
;(function(root){
  if(!/\/plugin\/\d+\/ticket\.htm$/.test(root.location.pathname)||typeof MutationObserver==='undefined')return
  var scheduled=false,observer,mobile;
  function adapt(){
    scheduled=false;
    var page=document.querySelector('.template.ticket');if(!page)return;
    var headers=Array.from(page.querySelectorAll('.tabledata>.el-table .el-table__header-wrapper th')).filter(function(th){return !th.classList.contains('gutter')});
    page.querySelectorAll('.tabledata>.el-table .el-table__body-wrapper tbody tr').forEach(function(row){
      row.tabIndex=0;row.setAttribute('role','link');row.setAttribute('aria-label',row.cells?.[0]?.textContent.trim()||'查看工单');
    });
    var create=page.querySelector('.new-ticket-btn');if(create){create.tabIndex=0;create.setAttribute('role','button')}
    if(headers.length!==5){
      page.classList.remove('cra1-ticket-mobile-enabled','cra1-ticket-full-table');
      if(mobile){var element=mobile.$el;mobile.$destroy();element?.remove();mobile=null}
      return;
    }
    if(mobile || !root.Vue || !page.__vue__)return;
    var native=page.__vue__,table=page.querySelector('.tabledata');if(!table || !Array.isArray(native.dataList))return;
    var holder=document.createElement('div');table.before(holder);
    mobile=new root.Vue({data:function(){return {native:native,full:false}},render:function(h){
      var vm=this,rows=vm.native.dataList||[];
      return h('section',{class:'cra1-ticket-mobile',attrs:{'aria-label':'工单列表'}},[
        vm.native.tableLoading?h('p',{attrs:{role:'status'}},'正在读取工单…'):!rows.length?h('p',{class:'cra1-ticket-mobile-empty'},'暂无符合条件的工单'):null,
        !vm.full?rows.map(function(row){return h('article',{class:'cra1-ticket-mobile-card',key:row.id},[
          h('a',{class:'cra1-ticket-mobile-title',attrs:{href:'ticketDetails.htm?id='+encodeURIComponent(row.id)}},'#'+row.ticket_num+' · '+row.title),
          h('div',{class:'cra1-ticket-mobile-meta'},[h('span',row.name||'未指定部门'),h('span',{class:'status-text',style:{color:row.color}},row.status)]),
          h('div',{class:'cra1-ticket-mobile-bottom'},[
            h('time',row.last_reply_time&&typeof formateDate==='function'?formateDate(row.last_reply_time*1000):'暂无回复'),
            h('div',{class:'cra1-ticket-mobile-actions'},[['itemReply','回复'],['itemUrge','催单'],['itemClose','关闭']].filter(function(a){return typeof native[a[0]]==='function' && (a[0]==='itemReply'||Number(row.status_id)!==4)}).map(function(a){return h('button',{attrs:{type:'button'},on:{click:function(){native[a[0]](row)}}},a[1])}))
          ])
        ])}):null,
        h('button',{class:'cra1-ticket-table-toggle',attrs:{type:'button','aria-expanded':vm.full},on:{click:function(){vm.full=!vm.full;page.classList.toggle('cra1-ticket-full-table',vm.full)}}},vm.full?'返回卡片列表':'查看完整表格')
      ])
    }}).$mount(holder);
    page.classList.add('cra1-ticket-mobile-enabled');
  }
  function schedule(){if(!scheduled){scheduled=true;root.requestAnimationFrame(adapt)}}
  function start(){adapt();observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})}
  document.addEventListener('keydown',function(event){
    if(event.key!=='Enter'&&event.key!==' ')return;
    var target=event.target;if(!target.matches('.template.ticket tr[role=link],.template.ticket .new-ticket-btn'))return;
    event.preventDefault();target.click();
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  root.addEventListener('pagehide',function(){observer?.disconnect();mobile?.$destroy()},{once:true});
})(window)
