/**
 * 外壳胶水层（所有系统页共用）
 *
 * 职责：把 Vue 外壳（侧边栏 + 顶栏）立起来，并在挂载完成后通知 React 内容挂载。
 *
 * 为什么每个页面都需要它：
 *   1. 侧边栏 / 顶栏是 Vue 组件，必须由 Vue 实例挂载；
 *   2. Vue 挂载会重建挂载点内部 DOM，React 必须等它完成后再挂；
 *   3. 插件页不注册 coinActive/clientLevelDialog，用 $options.components 探测可避免未知组件警告。
 *
 * ⚠️ 挂载点选择器必须是 .cra1-page，不能用 .template
 * --------------------------------------------------
 * 官方默认主题的页面容器 class 各不相同（.product / .product_detail template /
 * .template transfer…），模块模板的挂载脚本会按自己的约定去取：
 *     idcsmart_common/common_product_list.js → getElementsByClassName("template")[0]
 * 如果本主题的页面外壳也叫 .template，模块脚本取到的就是**本主题的外壳**，
 * 随后把整段外壳当作它自己的 Vue 模板重新编译，报
 * "Error compiling template: ... <script> will not be parsed"，
 * 并造成内容区被重建。
 * 因此本主题外壳统一使用 .cra1-page，把 .template 留给第三方模块自己的根节点。
 */
;(function (window) {
  var oldOnload = window.onload

  function boot() {
    // 优先 .cra1-page（本主题外壳）；.template 兜底兼容尚未迁移的页面
    var template =
      document.getElementsByClassName('cra1-page')[0] ||
      document.getElementsByClassName('template')[0]
    if (!template) return

    Vue.prototype.lang = window.lang

    new Vue({
      components: {
        asideMenu: asideMenu,
        topMenu: topMenu,
      },
      data: function () {
        return { rules: 'all' }
      },
      methods: {
        // 侧边栏广播权限：主账户 'all'，子账户为规则数组（内容区为 React，此处仅存储）
        getRule: function (arr) {
          this.rules = arr
          window.__CRA1_RULES__ = arr
          window.dispatchEvent(new CustomEvent('cra1:rules', {detail:arr}))
        },
      },
      mounted: function () {
        // 隐藏首屏 loading（asideMenu 也会做，这里兜底覆盖插件页等场景）
        var mainLoading = document.getElementById('mainLoading')
        if (mainLoading) mainLoading.style.display = 'none'

        // 关键：Vue 挂载会重建挂载点内部 DOM，React 必须等首次渲染完成。
        // 同时置标志位，兼容 module script 晚于本事件执行的情况。
        this.$nextTick(function () {
          window.__CRA1_SHELL_READY__ = true
          window.dispatchEvent(
            new CustomEvent('cra1:shell-ready', {
              detail: { slot: document.getElementById('cra1-content-slot') },
            })
          )
        })
      },
    }).$mount(template)

    typeof oldOnload === 'function' && oldOnload()
  }

  // onload 已触发过（module script 更晚执行）时直接 boot，避免漏挂
  if (document.readyState === 'complete') boot()
  else window.onload = boot
})(window)
