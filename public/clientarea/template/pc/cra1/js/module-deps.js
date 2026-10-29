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
  if (window.CRA1ModuleDeps && window.CRA1ModuleDeps.mountScripts) return
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

  var NATIVE_BINDINGS = Object.assign({}, COMPONENT_PATHS)
  var declaredLoads = {}
  var loaded = {}      // name -> true
  var inflight = {}    // name -> Promise
  var scriptPromises = window.__CRA1_SCRIPT_LOADS__ = window.__CRA1_SCRIPT_LOADS__ || {}  // rel 路径 -> Promise（同一文件只请求一次）

  function baseUrl() {
    return window.__CRA1_SHARED_BASE__ || '/clientarea/template/pc/default/'
  }

  function loadScript(rel) {
    var src = /^(?:https?:|\/)/.test(rel) ? rel : rel === 'components/payDialog/payDialog.js' && window.__CRA1_PAYMENT_BASE__ ? window.__CRA1_PAYMENT_BASE__ + '/' + rel : baseUrl() + rel
    if (scriptPromises[src]) return scriptPromises[src]
    scriptPromises[src] = new Promise(function (resolve) {
      var s = document.createElement('script')
      s.src = src
      // 串行插入时 async=false 保证按插入顺序执行，避免依赖竞态
      s.async = false
      var timer=setTimeout(function(){s.onerror()},15000)
      s.onload = function () { clearTimeout(timer);resolve(true) }
      s.onerror = function () {
        clearTimeout(timer)
        console.warn('[CRA1] 模块依赖组件加载失败：' + rel)
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
        if(ok&&(binding(name)||!NATIVE_BINDINGS[name]))loaded[name]=true
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


  function register(name, spec) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name) || THEME_PROVIDED[name]) throw new Error('模块组件登记无效')
    if (COMPONENT_PATHS[name]) return
    var path = typeof spec === 'string' ? spec : spec.path
    var url = new URL(path, window.location.origin + '/')
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('模块组件地址无效')
    COMPONENT_PATHS[name] = url.href
    DEPS[name] = typeof spec === 'string' ? [] : (spec.dependencies || []).slice()
    function visit(key, trail) {
      if (trail.indexOf(key) !== -1) throw new Error('模块组件存在循环依赖')
      ;(DEPS[key] || []).forEach(function (dep) { visit(dep, trail.concat(key)) })
    }
    try { visit(name, []) } catch (error) { delete COMPONENT_PATHS[name]; delete DEPS[name]; throw error }
  }

  function component(src) {
    if (!src) return ''
    var url = new URL(src, document.baseURI)
    if (url.origin !== window.location.origin) return ''
    var match = /\/clientarea\/template\/(?:pc|mobile)\/[^/]+\/(?:releases\/[^/]+\/)?components\/([^/]+)\/\1\.js$/.exec(url.pathname)
    return match ? match[1] : ''
  }

  function aborted() { return new DOMException('模块加载已取消', 'AbortError') }
  function observe(promise, signal) {
    if (!signal) return promise
    if (signal.aborted) return Promise.reject(aborted())
    return new Promise(function(resolve,reject){
      function abort(){reject(aborted())}
      signal.addEventListener('abort',abort,{once:true})
      promise.then(resolve,reject).finally(function(){signal.removeEventListener('abort',abort)})
    })
  }

  // Config fragments arrive after the document's load event. Replay only hooks
  // registered by the fragment's own scripts; dispatching a global load event
  // would mount the surrounding V10 page a second time.
  function lateLifecycle(signal) {
    var watched=new Set(), listeners=[], restorers=[], propertyHandler=null, replaying=false
    if(document.readyState!=='complete')return {watch:function(){},unwatch:function(){},replay:function(){},restore:function(){}}
    function owned(){return replaying||watched.has(document.currentScript)}
    ;[window,document].forEach(function(target){
      var add=target.addEventListener,remove=target.removeEventListener
      function capture(options){return typeof options==='boolean'?options:!!(options&&options.capture)}
      target.addEventListener=function(type,listener,options){
        if(owned()&&(type==='load'&&target===window||type==='DOMContentLoaded'&&target===document)&&listener){
          if(!listeners.some(function(row){return !row.removed&&row.target===target&&row.type===type&&row.listener===listener&&row.capture===capture(options)}))
            listeners.push({target:target,type:type,listener:listener,capture:capture(options),signal:options&&options.signal})
          return
        }
        return add.apply(this,arguments)
      }
      target.removeEventListener=function(type,listener,options){
        listeners.forEach(function(row){if(row.target===target&&row.type===type&&row.listener===listener&&row.capture===capture(options))row.removed=true})
        return remove.apply(this,arguments)
      }
      restorers.push(function(){target.addEventListener=add;target.removeEventListener=remove})
    })
    var descriptor=Object.getOwnPropertyDescriptor(window,'onload'),owner=window,accessor=descriptor
    while(!accessor&&owner){owner=Object.getPrototypeOf(owner);if(owner)accessor=Object.getOwnPropertyDescriptor(owner,'onload')}
    if(accessor&&accessor.get&&accessor.set&&(!descriptor||descriptor.configurable)){
      Object.defineProperty(window,'onload',{configurable:true,enumerable:accessor.enumerable,
        get:function(){return owned()?propertyHandler:accessor.get.call(window)},
        set:function(value){if(owned())propertyHandler=typeof value==='function'?value:null;else accessor.set.call(window,value)}})
      restorers.push(function(){if(descriptor)Object.defineProperty(window,'onload',descriptor);else delete window.onload})
    }
    function invoke(target,type,listener){
      if(signal&&signal.aborted)throw aborted()
      var event=new Event(type)
      Object.defineProperties(event,{target:{value:target},currentTarget:{value:target}})
      if(typeof listener==='function')listener.call(target,event)
      else if(listener&&typeof listener.handleEvent==='function')listener.handleEvent(event)
    }
    return {
      watch:function(node){watched.add(node)},unwatch:function(node){watched.delete(node)},
      replay:function(){
        replaying=true
        try{
          ;['DOMContentLoaded','load'].forEach(function(type){
            for(var i=0;i<listeners.length;i++){
              if(i>1000)throw new Error('模块初始化未完成，请重试')
              var row=listeners[i]
              if(row.type===type&&!row.removed&&!(row.signal&&row.signal.aborted)){row.removed=true;invoke(row.target,type,row.listener)}
            }
            if(type==='load'&&propertyHandler)invoke(window,'load',propertyHandler)
          })
        }finally{replaying=false}
      },
      restore:function(){restorers.reverse().forEach(function(restore){restore()});watched.clear()}
    }
  }

  // A fragment owns its temporary lifecycle bridge until all of its scripts
  // finish. Serialize fragments in this document; different module iframes
  // keep their independent queues. An aborted selection never starts its turn.
  var mountQueue=Promise.resolve()
  function mountScripts(host,options) {
    var task=mountQueue.then(function(){
      if(options&&options.signal&&options.signal.aborted)throw aborted()
      if(!host.isConnected)return
      return mountFragment(host,options)
    })
    mountQueue=task.catch(function(){})
    return task
  }

  /** Execute native declarations once; page boot scripts still execute per mount. */
  async function mountFragment(host, options) {
    options = options || {}
    var signal=options.signal, enabled=options.enabled || function(){return true}
    var scripts=Array.from(host.querySelectorAll('script')),lifecycle=lateLifecycle(signal)
    try {
    // Vue must not compile inert script nodes. Keep their order outside its root.
    scripts.forEach(function(node){node.remove()})
    var declared=scripts.filter(function(node){return component(node.getAttribute('src'))})
    for(var dependency of declared){
      if(signal && signal.aborted)throw aborted()
      var src=dependency.getAttribute('src'),name=component(src)
      if(!enabled(src))continue
      if(COMPONENT_PATHS[name])await observe(loadOne(name),signal)
      else if(!loaded[name]) {
        var target=new URL(src,document.baseURI);
        var present=Array.from(document.scripts).some(function(script){return script.src && new URL(script.src,document.baseURI).pathname===target.pathname});
        if(!present){
          try { await execute(dependency,true) }
          catch(error){
            if(error.code!=='MODULE_RESOURCE_LOAD' || !/\/template\/(?:pc|mobile)\/cra1\//.test(target.pathname))throw error;
            var fallback=dependency.cloneNode(true);
            fallback.src=new URL(baseUrl()+'components/'+name+'/'+name+'.js',location.origin).href;
            await execute(fallback,true);
          }
        }
        loaded[name]=true;
      }
    }
    for(var node of scripts){
      if(signal && signal.aborted)throw aborted()
      if(!host.isConnected)return
      var source=node.getAttribute('src')||''
      if(!enabled(source)||component(source))continue
      var deps=(node.getAttribute('data-cra1-deps')||'').split(/[\s,]+/).filter(Boolean)
      if(deps.length)await observe(ensure(deps),signal)
      await execute(node,!!source && !!options.once && options.once(source))
    }
    lifecycle.replay()
    } finally { lifecycle.restore() }
    async function execute(old, once) {
      var src=old.getAttribute('src')||'',type=(old.type||'').toLowerCase()
      if(type&&!['text/javascript','application/javascript','module'].includes(type)){
        host.appendChild(old);return
      }
      var url=src?new URL(src,document.baseURI):null
      if(url&&!['http:','https:'].includes(url.protocol))throw new Error('模块资源地址无效')
      var key=url && (component(src)?url.origin+url.pathname:url.href)
      if(once && declaredLoads[key])return observe(declaredLoads[key],signal)
      var promise=(async function(){
        var text=old.text
        // Verified, repeatable phone boot scripts are fetched first, so an old
        // request can never execute against a newly selected product's DOM.
        if(url&&options.fetchScripts){
          if(url.origin!==window.location.origin)throw new Error('模块资源地址无效')
          var response=await fetch(url.href,{signal:signal,credentials:'same-origin'})
          if(!response.ok)throw new Error('模块资源加载失败')
          text=await response.text()
        }
        if(signal && signal.aborted)throw aborted()
        await new Promise(function(resolve,reject){
          var next=document.createElement('script'),timer,executionError
          Array.from(old.attributes).forEach(function(a){if(a.name!=='src')next.setAttribute(a.name,a.value)})
          next.async=false
          if(url&&!options.fetchScripts)next.src=url.href
          else next.text=text
          function finish(error){
            clearTimeout(timer);window.removeEventListener('error',failed);if(signal)signal.removeEventListener('abort',cancel)
            lifecycle.unwatch(next)
            next.onload=next.onerror=null;next.remove()
            ;(error||executionError)?reject(error||executionError):resolve()
          }
          function failed(event){
            if((url&&!options.fetchScripts&&event.filename===url.href)||((!url||options.fetchScripts)&&event.filename===location.href))
              executionError=new Error('模块组件初始化失败，请重试')
          }
          function cancel(){finish(aborted())}
          next.onload=function(){finish()}
          next.onerror=function(){var error=new Error('模块所需资源未能加载，请重试');error.code='MODULE_RESOURCE_LOAD';finish(error)}
          if(signal)signal.addEventListener('abort',cancel,{once:true})
          timer=setTimeout(function(){finish(new Error('模块资源加载超时，请重试'))},15000)
          window.addEventListener('error',failed)
          lifecycle.watch(next)
          document.head.appendChild(next)
          if((!url||options.fetchScripts)&&type!=='module')finish()
        })
      })()
      if(once&&!options.fetchScripts)declaredLoads[key]=promise
      try{await promise;if(once)declaredLoads[key]=Promise.resolve()}catch(error){if(once)delete declaredLoads[key];throw error}
    }
  }

  window.CRA1ModuleDeps = {
    ensure: ensure,
    register: register,
    mountScripts: mountScripts,
    deps: MODULE_DEPS,
    graph: DEPS,
  }
})(window)
