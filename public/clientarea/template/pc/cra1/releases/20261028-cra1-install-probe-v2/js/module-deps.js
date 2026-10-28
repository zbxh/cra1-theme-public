/**
 * 第三方模块模板的依赖装载器
 *
 * 背景
 * ----
 * 系统里有一部分页面内容由「产品模块」后端渲染成 HTML 再交给前端注入
 * （产品内页 / 自定义导航产品列表 / 商品配置页），涉及 mf_cloud、mf_dcim、
 * idcsmart_common 等模块。这些模块的模板与 JS 属于第三方，不能改写。
 *
 * 它们的 JS 会这样写：
 *
 *     new Vue({ components: { asideMenu, topMenu, pagination, ... } })
 *
 * 这里用的是**裸标识符**而不是 window.xxx，因此对应变量必须已经作为
 * 全局作用域里的词法绑定存在（官方各页面靠 <script> 逐个引入组件实现）。
 * 没引入就会抛 "xxx is not defined"，Vue 挂载失败，页面上残留
 * {{lang.xxx}} 未编译模板。
 *
 * 关键约束：组件之间存在依赖
 * --------------------------
 * 官方页面是把组件逐个 <script> 引入的，这些脚本在**顶层用 const 声明**，
 * 所以：
 *   - 它们是词法绑定，不挂在 window 上，无法用 window.X 探测；
 *   - 必须先加载被依赖的组件，再加载依赖方，否则后者求值时就抛
 *     "ReferenceError: xxx is not defined"（例如 batchRenewpage 依赖
 *     payDialog / discountCode / safeConfirm）。
 * 因此这里维护静态依赖图并按拓扑序串行加载，不能并行。
 *
 * 已验证的依赖关系（扫自各组件源文件）：
 *   batchRenewpage → discountCode, payDialog, safeConfirm
 *   flowPacket     → pagination
 *   ipDefase       → cashBack, discountCode, pagination, payDialog
 *   renewDialog    → discountCode
 *   unsubscribe    → securityVerification
 *   securityVerification → captchaDialog, countDownButton
 */

;(function (window) {
  // CRA1 主题已提供的组件，不要用 default 的覆盖（否则会换掉新外壳）
  var THEME_PROVIDED = { asideMenu: 1, topMenu: 1 }

  var COMPONENT_PATHS = {
    asideMenu: 'components/asideMenu/asideMenu.js',
    topMenu: 'components/topMenu/topMenu.js',
    pagination: 'components/pagination/pagination.js',
    productFilter: 'components/productFilter/productFilter.js',
    batchRenewpage: 'components/batchRenewpage/batchRenewpage.js',
    autoRenew: 'components/autoRenew/autoRenew.js',
    trafficWarning: 'components/trafficWarning/trafficWarning.js',
    payDialog: 'components/payDialog/payDialog.js',
    safeConfirm: 'components/safeConfirm/safeConfirm.js',
    captchaDialog: 'components/captchaDialog/captchaDialog.js',
    hostStatus: 'components/hostStatus/hostStatus.js',
    discountCode: 'components/discountCode/discountCode.js',
    cashBack: 'components/cashBack/cashBack.js',
    flowPacket: 'components/flowPacket/flowPacket.js',
    ipDefase: 'components/ipDefase/ipDefase.js',
    renewDialog: 'components/renewDialog/renewDialog.js',
    unsubscribe: 'components/unsubscribe/unsubscribe.js',
    countDownButton: 'components/countDownButton/countDownButton.js',
    securityVerification: 'components/securityVerification/securityVerification.js',
    resetAuth: 'components/resetAuth/resetAuth.js',
    eventCode: 'components/eventCode/eventCode.js',
    customGoods: 'components/customGoods/customGoods.js',
  }

  // 组件间依赖（必须先于依赖方加载）
  var DEPS = {
    batchRenewpage: ['payDialog', 'discountCode', 'safeConfirm'],
    flowPacket: ['pagination'],
    ipDefase: ['pagination', 'payDialog', 'discountCode', 'cashBack'],
    renewDialog: ['discountCode'],
    unsubscribe: ['securityVerification'],
    securityVerification: ['captchaDialog', 'countDownButton'],
  }

  // 各模块模板实际用到的组件（读自模块 js 的 components 字段）
  var MODULE_DEPS = {
    // 产品列表类：mf_cloud/cloudList.js、idcsmart_common/common_product_list.js
    list: ['pagination', 'productFilter', 'batchRenewpage', 'autoRenew', 'trafficWarning'],
    // 产品内页：mf_cloud/cloudDetail.js
    detail: [
      'payDialog', 'pagination', 'discountCode', 'cashBack', 'flowPacket',
      'safeConfirm', 'captchaDialog', 'hostStatus', 'autoRenew', 'ipDefase',
      'renewDialog', 'unsubscribe',
    ],
    // 通用产品内页：idcsmart_common/common_product_detail.js（无 ipDefase）
    detailCommon: [
      'payDialog', 'pagination', 'discountCode', 'cashBack', 'safeConfirm',
      'hostStatus', 'autoRenew', 'renewDialog', 'unsubscribe',
    ],
    // 商品配置页：idcsmart_common/common_product.js
    config: ['payDialog', 'discountCode', 'eventCode', 'customGoods'],
  }

  var loaded = {}      // name -> true
  var inflight = {}    // name -> Promise
  var scriptPromises = window.__CRA1_SCRIPT_LOADS__ = window.__CRA1_SCRIPT_LOADS__ || {}  // rel 路径 -> Promise（同一文件只请求一次）

  function baseUrl() {
    return window.__CRA1_SHARED_BASE__ || '/clientarea/template/pc/default/'
  }

  function loadScript(rel) {
    var src = rel === 'components/payDialog/payDialog.js' && window.__CRA1_PAYMENT_BASE__ ? window.__CRA1_PAYMENT_BASE__ + '/' + rel : baseUrl() + rel
    if (scriptPromises[src]) return scriptPromises[src]
    scriptPromises[src] = new Promise(function (resolve) {
      var s = document.createElement('script')
      s.src = src
      // 串行插入时 async=false 保证按插入顺序执行，避免依赖竞态
      s.async = false
      s.onload = function () { resolve(true) }
      s.onerror = function () {
        console.warn('[cloud] 模块依赖组件加载失败：' + rel)
        delete scriptPromises[src]
        s.remove()
        resolve(false)
      }
      document.head.appendChild(s)
    })
    return scriptPromises[src]
  }

  /** 递归加载一个组件及其全部前置依赖（深度优先，保证拓扑序） */
  function binding(name) {
    // Explicit switches can observe native top-level const bindings, unlike window[name].
    try {
    if(name==='asideMenu')return typeof asideMenu!=='undefined'
    if(name==='topMenu')return typeof topMenu!=='undefined'
    if(name==='payDialog')return typeof payDialog!=='undefined'
    if(name==='pagination')return typeof pagination!=='undefined'
    if(name==='productFilter')return typeof productFilter!=='undefined'
    if(name==='batchRenewpage')return typeof batchRenewpage!=='undefined'
    if(name==='autoRenew')return typeof autoRenew!=='undefined'
    if(name==='trafficWarning')return typeof trafficWarning!=='undefined'
    if(name==='safeConfirm')return typeof safeConfirm!=='undefined'
    if(name==='captchaDialog')return typeof captchaDialog!=='undefined'
    if(name==='hostStatus')return typeof hostStatus!=='undefined'
    if(name==='discountCode')return typeof discountCode!=='undefined'
    if(name==='cashBack')return typeof cashBack!=='undefined'
    if(name==='flowPacket')return typeof flowPacket!=='undefined'
    if(name==='ipDefase')return typeof ipDefase!=='undefined'
    if(name==='renewDialog')return typeof renewDialog!=='undefined'
    if(name==='unsubscribe')return typeof unsubscribe!=='undefined'
    if(name==='countDownButton')return typeof countDownButton!=='undefined'
    if(name==='securityVerification')return typeof securityVerification!=='undefined'
    if(name==='resetAuth')return typeof resetAuth!=='undefined'
    if(name==='eventCode')return typeof eventCode!=='undefined'
    if(name==='customGoods')return typeof customGoods!=='undefined'
    return false
    } catch (error) {
      // A native script can leave a top-level const uninitialized when evaluation fails.
      // Keep this a failed initialization; evaluating the same script again would redeclare it.
      if (error instanceof ReferenceError) return false
      throw error
    }
  }
  function loadOne(name) {
    if (binding(name) || loaded[name]) return Promise.resolve(true)
    if (inflight[name]) return inflight[name]

    inflight[name] = Promise.all((DEPS[name] || []).map(loadOne)).then(function () {
      var rel = COMPONENT_PATHS[name]
      if (!rel) throw new Error('尚未登记模块组件：'+name)
      return loadScript(rel).then(function (ok) {
        if(ok&&binding(name))loaded[name]=true
        else if(ok){delete inflight[name];throw new Error('模块组件未正确初始化，请刷新页面重试：'+name)}
        else { delete inflight[name]; throw new Error('模块组件加载失败：'+name) }
        return ok
      })
    }).catch(function(error){delete inflight[name];throw error})
    return inflight[name]
  }

  /**
   * 确保指定分组（或显式列表）的组件及其前置依赖全部就绪
   * @param {string|string[]} group MODULE_DEPS 的键，或组件名数组
   * @returns {Promise<void>}
   */
  function ensure(group) {
    var names = Array.isArray(group) ? group : (MODULE_DEPS[group] || [])
    // 逐个启动：loadOne 内部已处理依赖顺序，这里并发触发互不冲突的链
    return Promise.all(['asideMenu','topMenu'].concat(names).map(loadOne)).then(function () {})
  }

  window.CRA1ModuleDeps = {
    ensure: ensure,
    deps: MODULE_DEPS,
    graph: DEPS,
  }
})(window)
