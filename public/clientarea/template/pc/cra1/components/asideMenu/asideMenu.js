/**
 * CRA1 会员中心侧边栏 · 三级导航（阿里云风格）
 *
 * 设计参考：阿里云控制台
 *   左侧一级入口（订购分类 / 产品管理 / 财务中心等）
 *     → 右侧二级分类面板（人工智能平台、模型平台与服务、计算…）
 *       → 三级页面链接（视觉智能开放平台…）
 *
 * 为什么用 Vue2 而不是 React：
 *   插件页（工单/实名认证/子账户等）模板由系统提供且不可改动，它们直接使用本组件
 *   <aside-menu>，且整页由 Vue2 实例挂载。用 Vue 重写才能让系统页与插件页共用
 *   同一侧边栏，避免"两套导航"的割裂。
 *
 * 对外契约（与 default 主题一致，插件页与首页主题依赖，不得更改）：
 *   props : menu-active-id
 *   events: getruleslist（子账户权限；'all' 表示主账户）
 *   全局名: asideMenu（插件页 JS 用此名注册到 components）
 *
 * 副作用契约（重要）：
 *   必须隐藏页面提供的首屏遮罩 #mainLoading，否则遮罩会永久盖住内容
 *   （表现为"页面一直在加载"）。default 主题靠 updated() 实现，本组件在
 *   mounted + updated 双处调用，并在菜单加载完成后才隐藏以避免闪白。
 *
 * 数据来源与分层
 * --------------
 *   一级/二级来自后端 /console/v1/menu（idcsmart_menu + idcsmart_nav），
 *   本组件只做「投影」不改结构：
 *     首页最近访问 ← 前台自动记录（浏览器本地，按会员区分）；后台只下发
 *                  展示策略（标题/抓取天数/条数上限/新标签页），见 recentCfg
 *     我的资源   ← 我的产品 + 后端返回的 module/res_module 菜单（点进去是产品列表）
 *     产品与服务 ← 其余系统/插件菜单，每个二级菜单展开为三级页面链接
 *   三级页面链接由 SECONDARY_PAGES 静态描述 + 运行时菜单 URL 合成。
 *   后端菜单本身只支持两级（后台导航编辑器仅渲染一二级），三级放在主题层实现，
 *   避免动到系统表与后台编辑器。
 */
;(function (global) {
  /* ---------------------------------------------------------------------- */
  /* 财务功能特征位（与 React lib.js featureFlags 同判据、共享 window 缓存）     */
  /* 提现规则 status=0 → 侧栏/三级页剔除「申请提现」；React 侧亦写入此缓存，    */
  /* 谁先加载谁探测，二次调用直接复用。                                       */
  /* ---------------------------------------------------------------------- */
  global.__cra1FeatureFlags = function () {
    if (global.__CRA1_FEAT_PROMISE__) return global.__CRA1_FEAT_PROMISE__
    if (global.__CRA1_FEAT__ && global.__CRA1_FEAT__.ready) {
      return Promise.resolve(global.__CRA1_FEAT__)
    }
    var flag = global.__CRA1_FEAT__ = { recharge_open: 0, withdraw_open: 0, ready: false }
    // 快照 features 优先（主题后台投影：recharge_open/min/max、提现规则状态、
    // 充值实名要求——客户端 API 拿不到的配置都在这里）；快照缺段（旧主题后
    // 台版本）时退回接口探测。快照 Promise 与组件/React 端共享。
    var snapP = global.__CRA1_MEMBER_SNAPSHOT_PROMISE__
    if (!snapP) {
      snapP = global.__CRA1_MEMBER_SNAPSHOT_PROMISE__ = fetch(
        '/cra1-shared/snapshot.php?domain=member',
        { credentials: 'omit' }
      )
        .then(function (r) { return r.ok ? r.json() : null })
        .then(function (j) {
          var snap = j && j.status === 200 && j.data ? j.data : null
          if (snap) {
            global.__CRA1_MEMBER_SNAPSHOT__ = snap
            try { global.dispatchEvent(new CustomEvent('cra1:member-content', { detail: snap })) } catch (e) {}
          }
          return snap
        })
        .catch(function () { return null })
    }
    global.__CRA1_FEAT_PROMISE__ = snapP
      .then(function (snap) {
        if (snap && snap.features) return snap.features
        return {recharge_open:0,withdraw_open:0}
      })
      .then(function (f) {
        flag.recharge_open = Number(f.recharge_open)===1
        flag.withdraw_open = Number(f.withdraw_open)===1
        flag.recharge_min = f.recharge_min || ''
        flag.recharge_max = f.recharge_max || ''
        flag.certification = f.certification || null
        flag.ready = true
        try { global.dispatchEvent(new CustomEvent('cra1:feature-flags')) } catch (e) {}
        return flag
      })
    return global.__CRA1_FEAT_PROMISE__
  }

  /* ---------------------------------------------------------------------- */
  /* 三级页面描述表                                                          */
  /*                                                                        */
  /* 说明：三级链接必须是「真的能打开对应内容」的地址。                        */
  /*   - 安全中心的五个标签由 ?tab= 切换（页面已支持 URL 同步）；              */
  /*   - 账户/财务的标签同理；                                               */
  /*   - 插件页没有标签机制，三级项直接指向插件内部的真实页面；                */
  /*   - 产品类菜单按 ?m= 参数区分，必须保留完整 query，否则会串页。           */
  /* 因此这里用 url / urlFrom（引用运行时菜单 URL）两种取值方式。              */
  /* ---------------------------------------------------------------------- */
  var SECONDARY_PAGES = {
    // 键 = 二级菜单的匹配规则（按 url 前缀/含义），值 = 三级页数组
    'cart/goodsList.htm': [
      { name: '商品列表', url: 'cart/goodsList.htm' },
      { name: '购物车', url: 'cart/shoppingCar.htm' }
    ],
    'productList.htm': [
      { name: '全部产品', url: 'productList.htm' },
      { name: '使用中', url: 'productList.htm?tab=using' },
      { name: '即将到期', url: 'productList.htm?tab=expiring' },
      { name: '已逾期', url: 'productList.htm?tab=overdue' },
      { name: '已删除', url: 'productList.htm?tab=deleted' }
    ],
    'account.htm': [
      { name: '基本资料', url: 'account.htm?tab=profile' },
      { name: '安全设置', url: 'account.htm?tab=security' },
      { name: '余额记录', url: 'account.htm?tab=credit' }
    ],
    'finance.htm': [
      { name: '我的订单', url: 'finance.htm?tab=orders' },
      { name: '余额记录', url: 'finance.htm?tab=credit' },
      { name: '冻结记录', url: 'finance.htm?tab=freeze' },
      { name: '交易记录', url: 'finance.htm?tab=transactions' },
      { name: '余额充值', url: 'recharge.htm' },
      { name: '申请提现', url: 'withdrawal.htm' }
    ],
    'security.htm': [
      { name: '安全概览', url: 'security.htm?tab=overview' },
      { name: 'API 密钥', url: 'security.htm?tab=api' },
      { name: 'SSH 密钥', url: 'security.htm?tab=ssh' },
      { name: '操作日志', url: 'security.htm?tab=log' },
      { name: '安全组', url: 'security.htm?tab=group' }
    ],
  }
  var SECONDARY_LABELS = {'cart/goodsList.htm':'订购产品','account.htm':'账户信息','finance.htm':'财务中心','security.htm':'安全中心'};
  function installedPlugin(name) {
    try{return (JSON.parse(document.getElementById('addons_js')?.getAttribute('addons_js')||'[]')).find(function(p){return p.name===name})}catch(e){return null}
  }
  function installedPluginTitle(id) {
    try{var p=(JSON.parse(document.getElementById('addons_js')?.getAttribute('addons_js')||'[]')).find(function(p){return String(p.id)===String(id)});return p?p.title:''}catch(e){return ''}
  }
  function addPluginPages(name,view,items,label) {
    var p=installedPlugin(name);if(!p)return;
    var base='plugin/'+p.id+'/';
    SECONDARY_PAGES[base+view]=items.map(function(item){return {name:item[0],url:base+item[1]}});
    SECONDARY_LABELS[base+view]=label;
  }
  addPluginPages('IdcsmartTicket','ticket.htm',[['工单列表','ticket.htm'],['新建工单','addTicket.htm']],'工单中心');
  addPluginPages('IdcsmartSubAccount','childAccount.htm',[['子账户列表','childAccount.htm'],['添加子账户','addChildAccount.htm']],'子账户管理');
  [['IdcsmartNews','新闻中心'],['IdcsmartHelp','帮助中心'],['IdcsmartFileDownload','文件下载']].forEach(function(item){addPluginPages(item[0],'source.htm',[[item[1],'source.htm']],item[1])});
  var newsPlugin=installedPlugin('IdcsmartNews');if(newsPlugin){var resourcePages=[];[['IdcsmartNews','新闻中心'],['IdcsmartHelp','帮助中心'],['IdcsmartFileDownload','文件下载']].forEach(function(it){var p=installedPlugin(it[0]);if(p)resourcePages.push({name:it[1],url:'plugin/'+p.id+'/source.htm'})});SECONDARY_PAGES['plugin/'+newsPlugin.id+'/source.htm']=resourcePages;SECONDARY_LABELS['plugin/'+newsPlugin.id+'/source.htm']='资源中心'}

  /* 一级入口定义（shape=2 旧结构 / 系统导航回落时使用；
     「最近访问」由 primaryNav 统一注入，两种树形态同一套逻辑） */
  var PRIMARY = [
    { key: 'resource', name: '我的资源', icon: 'icon-a-7' },
    { key: 'service', name: '产品与服务', icon: 'icon-a-6' }
  ]

  /* 判断是否为「产品类」菜单（点进去是模块渲染的产品列表） */
  function isProductMenu(item) {
    var u = String((item && item.url) || '')
    return u.indexOf('product.htm') === 0 || u.indexOf('crossModule.htm') === 0
  }

  function isMenuSeparator(item) {
    return item && (item.type === 'separator' ||
      (item.name === '分隔符' && !item.url && !(item.child || []).length))
  }

  var asideMenu = {
    name: 'cra1AsideMenu',
    template: /* html */ `
<!--
  阿里云式双栏侧栏：
    左栏（一级窄栏）  = 一级入口列表（图标 + 名称 + chevron）
    右栏（二三级面板）= 当前一级的二级菜单；含三级页面的二级展开其页面列表
  打开导航时右侧面板默认就位（当前一级自动选中），不需要再点一次。
  移动端（≤1024px）抽屉一次只显示一栏：一级列表 ⇄ 面板（返回键切换）。
-->
<div class="cra1-aside-wrap" style="display:contents">
  <!-- 遮罩：顶栏不被盖住（top=header-h 由 CSS 控制），点击关闭 -->
  <div class="cra1-aside__overlay"
       :class="{ 'is-open': navOpen, 'is-desktop': !isNarrow }"
       @click="closeMobile"></div>

  <aside class="cra1-aside" :class="{ 'is-open': navOpen, 'is-collapsed': collapsed, 'is-mobile-detail': mobileDetail }" aria-label="会员中心导航">
    <!-- 左栏：一级入口 -->
    <nav class="cra1-aside__rail-col" aria-label="主导航">
      <template v-for="p in primaryNav">
      <div v-if="p.separator" :key="p.key" class="cra1-primary-separator"
           role="separator" aria-orientation="horizontal" :aria-label="p.name"></div>
      <button v-else
        :key="p.key"
        type="button"
        class="cra1-primary-item"
        :class="{ 'is-active': primaryKey === p.key }"
        :aria-expanded="primaryKey === p.key ? 'true' : 'false'"
        :title="p.name"
        @click="selectPrimary(p.key)"
      >
        <span v-if="p.icon_resolved && p.icon_resolved.url" class="cra1-primary-item__icon cui-business-icon" :data-cui-icon-style="p.icon_style ? '1' : null" :style="iconVars(p.icon_style)" aria-hidden="true"><span v-if="p.icon_resolved.colorable" class="cui-icon-mask" :style="{'--cui-icon-url':'url('+p.icon_resolved.url+')'}"></span><img v-else :src="p.icon_resolved.url" width="20" height="20" alt=""></span><i v-else-if="p.icon" class="iconfont cra1-primary-item__icon" :class="p.icon" :data-cui-icon-style="p.icon_style ? '1' : null" :style="iconVars(p.icon_style)" aria-hidden="true"></i>
        <span class="cra1-primary-item__label">{{ p.name }}</span>
        <svg class="cra1-primary-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
      </template>

      <!-- 加载骨架 -->
      <div v-if="loading" class="cra1-aside__skeleton" aria-hidden="true">
        <span v-for="n in 3" :key="n" class="cra1-aside__skeleton-row"></span>
      </div>
    </nav>

    <!-- 右栏：当前一级的二级/三级面板 -->
    <div class="cra1-aside__panel" role="group" :aria-label="activePrimaryName">
      <div class="cra1-aside__panel-head">
        <!-- 移动端：返回一级 -->
        <button type="button" class="cra1-aside__panel-back" aria-label="返回上一级" @click="backToPrimary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 6-6 6 6 6"></path></svg>
        </button>
        <div class="cra1-aside__panel-title">
          <span class="cra1-aside__panel-title-main">{{ activePrimaryName }}</span>
          <span class="cra1-aside__panel-title-sub">选择需要的功能</span>
        </div>
        <button type="button" class="cra1-aside__panel-close" aria-label="关闭导航" @click="closeMobile"></button>
      </div>

      <div class="cra1-aside__panel-body">
        <div class="cra1-panel-grid">
          <section
            v-for="g in activeGroups"
            v-if="g.url || g.pages.length"
            :key="'grp:' + g.key"
            class="cra1-nav-group"
            :class="{ 'is-folded': !isGroupOpen(g) }"
          >
            <!-- 二级：组标题（可点击直达该菜单自身地址） -->
            <component
              :is="g.url && !isExternal(g.url) ? 'a' : 'div'"
              class="cra1-nav-l2"
              :class="{ 'is-active': isPageActive({ url: g.url }), 'is-link': g.url && !isExternal(g.url) }"
              :href="g.url && !isExternal(g.url) ? '/' + g.url : null"
              onclick="return false"
              @click.prevent="g.url && !isExternal(g.url) ? goPage({ url: g.url, sourceMenuId: g.key, second_reminder: g.second_reminder }) : null"
            >
              <span v-if="g.icon_resolved || g.icon_style" class="cra1-nav-configured-icon cui-business-icon" :data-cui-icon-style="g.icon_style ? '1' : null" :style="iconVars(g.icon_style)" aria-hidden="true"><span v-if="g.icon_resolved && g.icon_resolved.colorable" class="cui-icon-mask" :style="{'--cui-icon-url':'url('+g.icon_resolved.url+')'}"></span><img v-else-if="g.icon_resolved" :src="g.icon_resolved.url" width="16" height="16" alt=""><i v-else class="iconfont" :class="g.icon"></i></span><span class="cra1-nav-l2__name">{{ g.name }}</span>
            <button
              v-if="leafPagesOf(g).length"
              type="button"
              class="cra1-nav-group__toggle"
              :class="{ 'is-open': isGroupOpen(g) }"
              :aria-expanded="isGroupOpen(g) ? 'true' : 'false'"
              :aria-label="(isGroupOpen(g) ? '收起' : '展开') + g.name"
              @click.stop.prevent="toggleGroup(g)"
            ><i class="cra1-nav-group__chev" aria-hidden="true"></i></button>
            </component>

            <!-- 三级：组内全部页面（常驻） -->
            <div
              v-for="pg in leafPagesOf(g)"
              :key="g.key + ':' + pg.url"
              class="cra1-nav-l3"
              :class="{ 'is-active': isPageActive(pg) }"
            >
              <a
                class="cra1-nav-l3__hit"
                :href="'/' + pg.url"
                :aria-current="isPageActive(pg) ? 'page' : null"
                onclick="return false"
                @click.prevent="goPage(pg)"
              >
                <span v-if="pg.icon_resolved || pg.icon_style" class="cra1-nav-configured-icon cui-business-icon" :data-cui-icon-style="pg.icon_style ? '1' : null" :style="iconVars(pg.icon_style)" aria-hidden="true"><span v-if="pg.icon_resolved && pg.icon_resolved.colorable" class="cui-icon-mask" :style="{'--cui-icon-url':'url('+pg.icon_resolved.url+')'}"></span><img v-else-if="pg.icon_resolved" :src="pg.icon_resolved.url" width="16" height="16" alt=""><i v-else class="iconfont" :class="pg.icon"></i></span><span v-else class="cra1-nav-l3__dot" aria-hidden="true"></span>
                <span class="cra1-nav-l3__name">{{ pg.name }}</span>
              </a>
            </div>
          </section>
        </div>

        <p v-if="!activeGroups.length" class="cra1-nav-sub__empty">暂无可用的页面</p>
      </div>
    </div>

    <!-- 折叠为图标按钮（桌面） -->
    <button
      type="button"
      class="cra1-aside__rail"
      :aria-label="collapsed ? '展开侧边栏' : '折叠侧边栏'"
      :aria-expanded="collapsed ? 'false' : 'true'"
      @click="toggleCollapse"
    ></button>
  </aside>
</div>
`,
    props: {
      menuActiveId: { type: [String, Number], default: '' },
    },
    data() {
      return {
        menu: [],           // 后端原始菜单树
        loading: true,
        logo: '',
        logoFailed: false,
        brandName: '',
        commonData: {},
        activeId: String(this.menuActiveId || ''),
        navOpen: false,          // 主导航显隐（默认关闭，顶栏图标唤出）
        menuSource: '',          // 'member' = 独立快照，'system' = 系统导航
        snapshotAppearance: {},
        navShape: 2,             // 快照树形态：3 = 一级分组树（分组→菜单→页面），2 = 旧两级
        // 最近访问：记录存浏览器本地（按会员区分 key）；后台只下发展示策略 recentCfg
        recentCfg: { enabled: 1, title: '最近访问', days: 7, max_items: 8, new_tab: 0, open_first: 0 },
        recentItems: [],
        recentUid: '',
        recentReady: false,
        recentPolicyReady: false,
        recentPageName: '',
        viewportW: (typeof window !== 'undefined' ? window.innerWidth : 1440),
        collapsed: false,
        // 双栏导航：primaryKey = 左栏选中的一级（右栏多列常驻展开，无收缩态）
        primaryKey: 'service',
        mobileDetail: false,   // 移动端：是否已进入右栏面板
        asideMobileExpand: 'one', // v20 手机端二级菜单档位：one/all/none（后台 appearance）
        mobileOpenGroups: [],   // v20 手机端当前展开的二级分组 key 列表
      }
    },
    computed: {
      /** 是否窄屏（≤1024px，与 CSS 断点一致）：决定遮罩层级与滚动锁行为 */
      isNarrow() {
        return this.viewportW <= 1024
      },
      brandUrl() {
        return this.commonData.clientarea_logo_url || '/home.htm'
      },
      brandInitial() {
        return (this.brandName || '会').slice(0, 1)
      },
      activePrimaryName() {
        var hit = this.primaryNav.filter(function (p) { return p.key === this.primaryKey }, this)[0]
        return (hit && hit.name) || '产品与服务'
      },
      /**
       * 一级入口（左侧窄栏）。
       * shape=3：入口 = 后台配置的一级分组节点（可增删改排序）；
       *          最近访问由首页展示，不再注入侧栏。
       * shape=2：主题内置三项（旧结构 / 系统导航回落）。
       */
      primaryNav() {
        if (this.navShape < 3) {
          return PRIMARY.slice()
        }
        var FALLBACK_ICON = {
          '我的资源': 'icon-a-7', '产品与服务': 'icon-a-6', '产品管理': 'icon-a-6',
          '财务中心': 'icon-caiwuzhongxin', '账户中心': 'icon-a-13', '服务与支持': 'icon-rengongkefu',
        }
        var out = (this.menu || []).map(function (n) {
          return { key: n.id, name: n.name, icon: n.icon || FALLBACK_ICON[n.name] || 'icon-a-6', icon_style:n.icon_style, icon_resolved:n.icon_resolved, separator: !!isMenuSeparator(n) }
        })
        return out
      },
      /**
       * 我的资源：我的产品 + 后端返回的产品类菜单（module/res_module）
       * 每个产品菜单作为一个二级分类，三级列出该菜单下的常用视图。
       */
      resourceSecondary() {
        var out = []
        out.push({
          key: 'productList',
          name: '我的产品',
          url: 'productList.htm',
          pages: this.withReminder(SECONDARY_PAGES['productList.htm']),
        })
        this.flattenMenu().forEach(function (item) {
          if (isProductMenu(item) && item.url) {
            out.push({
              key: 'm' + item.id,
              name: item.name,icon:item.icon,icon_style:item.icon_style,icon_resolved:item.icon_resolved,
              url: item.url,
              // 产品列表由后端模块渲染，?tab= 语义在模块内部，
              // 这里只给「进入该分类」一个可靠入口，不造无效链接。
              pages: [{
                name: item.name,
                url: item.url,
                second_reminder: item.second_reminder === 1 ? 1 : 0,
                sourceMenuId: item.id || null,
              }],
            })
          }
        })
        // 订购入口放在最后
        out.push({
          key: 'order',
          name: '订购产品',
          url: 'cart/goodsList.htm',
          pages: SECONDARY_PAGES['cart/goodsList.htm'],
        })
        return out
      },
      /**
       * 产品与服务：后台侧栏树按【根节点】分组，直接展示二级页面菜单。
       *
       * 之前这里用 flattenMenu() 把树摊平成一条「服务分类」列表，
       * 父子都变成分类项（出现「其他」「其他 · DCIM」这类重复层级），
       * 再靠左栏切换 —— 现在改为同一面板内并列分组：
       *   - 父节点有子级 → 组标题 = 父节点名，页面 = 子级（子级还有下级则继续摊到页面）；
       *   - 父节点无子级 → 自身为一组，组内页面用静态描述表展开（如 account.htm 的标签页）。
       * 多个服务分类因此在同一个二级面板中同时可见。
       */
      serviceGroups() {
        var self = this
        var out = []
        ;(this.menu || []).forEach(function (item) {
          if (item.name === '分隔符') return
          var kids = item.child || []
          if (kids.length) {
            var pages = []
            // 容器节点自己也可能是真实页面（如 安全中心 → security.htm 的五个标签）。
            // 排除两类例外：
            //   1. url='/' 的纯容器（老数据里「测试」这种只当分组用的节点）；
            //   2. module/res_module —— 它们的 productList.htm 是导入时的兜底地址，
            //      不是真实页面，组内只放子级，避免与「魔方云」组重复整套产品标签页。
            var ownUrl = String(item.url || '')
            var isFallback = (item.type === 'module' || item.type === 'res_module')
            if (ownUrl && ownUrl !== '/' && !isFallback) {
              var own = self.pagesForUrl(ownUrl, item)
                           || self.withReminder([{ name: item.name, url: ownUrl }])
              pages = pages.concat(own)
            }
            kids.forEach(function (c) {
              var grand = c.child || []
              if (grand.length) {
                grand.forEach(function (g) {
                  pages.push(self.pageFromMenu(g, item, g.name))
                })
              } else {
                pages.push(self.pageFromMenu(c, item, c.name))
              }
            })
            if (pages.length) {
              out.push({ key: item.id || item.name, name: item.name, icon:item.icon,icon_style:item.icon_style,icon_resolved:item.icon_resolved,url: item.url || '', pages: pages })
            }
          } else if (item.url) {
            out.push({
              key: item.id || item.url,
              name: item.name,icon:item.icon,icon_style:item.icon_style,icon_resolved:item.icon_resolved,
              url: item.url,
              pages: self.pagesForUrl(item.url, item) || self.withReminder([{ name: item.name, url: item.url }]),
            })
          }
        })
        return out
      },
      /** 面板当前展示的页面组（不再按「服务分类」切换，直接全部展示） */
      activeGroups() {
        if (this.navShape >= 3) {
          var root = (this.menu || []).find(function (n) { return n.id === this.primaryKey }, this)
          return root ? this.groupsOfNode(root) : []
        }
        if (this.primaryKey === 'resource') return this.resourceSecondary
        return this.serviceGroups
      },

    },
    created() {
      // 身份确认前只广播空记录，不能使用上一次登录留下的会员编号。
      this.emitRecentVisits()
      this.getCommonSetting()
      this.doGetMenu()
      global.addEventListener('cra1:toggle-aside', this.onToggleAside)
      global.addEventListener('keydown', this.onKeydown)
      global.addEventListener('resize', this.onResize)
      global.addEventListener('storage', this.onRecentStorage)
      global.addEventListener('cra1:recent-visits-clear', this.clearRecentItems)
      // 默认展开/收起：用户本机手动切换过（localStorage 有记录）以本机为准；
      // 无记录时读后台「外观设置 → 侧边栏默认展开」（此前恒 false，该开关是幽灵字段）
      this.applyAsideDefault(global.__CRA1_MEMBER_SNAPSHOT__)
      // 收藏功能已下线：清掉遗留的本地数据，避免误导
      try { localStorage.removeItem('cra1_user_favorites') } catch (e) {}
      // v20：手机端二级菜单折叠档位（后台 appearance.aside_mobile_expand）
      // 快照为异步加载：先同步取（二次渲染已就绪），未就绪则等 loadMemberSidebar 后应用
      this.applyMobileExpandTier()
      // React 内容页（产品详情/订单详情等）拿到数据后会广播真实页面名，
      // 这里监听并回填本页记录 —— productdetail.htm 这类「同一地址不同内容」
      // 的页面才能在最近访问里显示具体产品标识而非通用标题
      global.addEventListener('cra1:page-title', this.onPageTitle)
    },
    mounted() {
      this.hideMainLoading()
      this.publishNavState()
    },
    updated() {
      this.hideMainLoading()
    },
    beforeDestroy() {
      global.removeEventListener('cra1:toggle-aside', this.onToggleAside)
      global.removeEventListener('keydown', this.onKeydown)
      global.removeEventListener('resize', this.onResize)
      global.removeEventListener('cra1:page-title', this.onPageTitle)
      global.removeEventListener('storage', this.onRecentStorage)
      global.removeEventListener('cra1:recent-visits-clear', this.clearRecentItems)
      document.documentElement.style.overflow = ''
    },
    watch: {
      navOpen() {
        this.publishNavState()
      },
      menuActiveId(val) {
        if (val !== undefined && val !== null && val !== '') this.activeId = String(val)
      },
    },
    methods: {
      applyAsideDefault(snapshot) {
        if (this._cra1AsideDefaultApplied) return
        try {
          const saved = localStorage.getItem('cra1_aside_collapsed')
          if (saved === '0' || saved === '1') {
            this.collapsed = saved === '1'
            this._cra1AsideDefaultApplied = true
            return
          }
        } catch (e) {}
        if (!snapshot || !snapshot.appearance) return
        this.collapsed = Number(snapshot.appearance.sidebar_default_open) !== 1
        this._cra1AsideDefaultApplied = true
      },
      publishNavState() {
        global.__CRA1_NAV_OPEN__ = this.navOpen === true
        global.dispatchEvent(new CustomEvent('cra1:aside-state', { detail: { open: this.navOpen === true } }))
      },
      iconVars(style) { return global.CRA1Shared && global.CRA1Shared.IconStyle ? global.CRA1Shared.IconStyle.vars(style,false) : {}; },
      /**
       * shape=3：一个一级分组 → 面板页面组。
       *   L2 菜单 = 组标题（可点击，指向菜单自身地址）；
       *   L3 页面 = 组内链接（魔方云 → 使用中/已删除…）。
       * 产品列表类链接附加 cloud_menu=<菜单 UUID>：内容设置按它区分顶部文案。
       * 「分隔符」与空菜单不渲染。
       */
      groupsOfNode(root) {
        var self = this
        var out = []
        ;(root.child || []).forEach(function (c) {
          if (c.name === '分隔符') return
          var grand = c.child || []
          var pages
          if (grand.length) {
            pages = grand.map(function (g) {
              return {
                name: g.name,icon:g.icon,icon_style:g.icon_style,icon_resolved:g.icon_resolved,
                url: self.tagCRA1Menu(g.url, c.id),
                second_reminder: (g.second_reminder === 1 || g.second_reminder === '1') ? 1 : 0,
                sourceMenuId: g.id || null,
              }
            })
          } else if (c.url) {
            pages = [{
              name: c.name,icon:c.icon,icon_style:c.icon_style,icon_resolved:c.icon_resolved,
              url: self.tagCRA1Menu(c.url, c.id),
              second_reminder: (c.second_reminder === 1 || c.second_reminder === '1') ? 1 : 0,
              sourceMenuId: c.id || null,
            }]
          } else {
            return   // 无页面也无链接：不展示
          }
          out.push({ key: c.id || c.name, name: c.name, icon:c.icon,icon_style:c.icon_style,icon_resolved:c.icon_resolved,url: self.tagCRA1Menu(c.url, c.id), pages: pages })
        })
        return out
      },

      /** 产品列表链接附加稳定菜单 UUID（不使用会重建的 idcsmart_menu.id） */
      tagCRA1Menu(url, id) {
        var u = String(url || '')
        if (id && u.indexOf('productList.htm') === 0) {
          u += (u.indexOf('?') === -1 ? '?' : '&') + 'cloud_menu=' + id
        }
        return u
      },
      /**
       * 隐藏首屏 loading 遮罩（页面提供，z-index 9999 全屏）。
       * 必须保留此职责：漏掉会导致页面看起来"一直在加载"。
       * 等菜单加载完成后再隐藏，避免内容未就绪时闪白。
       */
      hideMainLoading() {
        if (this.loading) return
        var el = document.getElementById('mainLoading')
        if (el && el.style.display !== 'none') el.style.display = 'none'
      },
      toggleCollapse() {
        this.collapsed = !this.collapsed
        try { localStorage.setItem('cra1_aside_collapsed', this.collapsed ? '1' : '0') } catch (e) {}
        // 折叠时收起移动面板态（展开状态保留，展开按钮时原样恢复）
      },
      onToggleAside() {
        this.navOpen = !this.navOpen
        // 移动端抽屉打开时锁定页面滚动；桌面浮层不锁滚动，避免影响阅读
        document.documentElement.style.overflow =
          (this.navOpen && global.innerWidth <= 1024) ? 'hidden' : ''
        if (this.navOpen) {
          // 始终定位当前页面所属菜单；旧 open_first 值只保留兼容存储。
          this.mobileDetail = false
          this.syncPrimaryFromLocation()
        }
      },
      closeMobile() {
        this.navOpen = false
        this.mobileDetail = false
        document.documentElement.style.overflow = ''
        // v20：记住关闭抽屉时展开的二级分组（下次打开恢复）
        try { localStorage.setItem('cra1_aside_open_groups', JSON.stringify(this.mobileOpenGroups)) } catch (e) {}
      },
      /** Esc 关闭面板/抽屉，并把焦点交回触发按钮（移动端菜单按钮） */
      onResize() {
        this.viewportW = global.innerWidth
        // 跨断点时收起导航：桌面浮层与移动抽屉的层级/滚动锁不同，
        // 保持展开会出现「看不见却锁着滚动」的错乱。
        if (this.navOpen) this.closeMobile()
      },
      onKeydown(e) {
        if (e.key !== 'Escape') return
        // 收起主导航，并把焦点交回顶栏的切换按钮
        if (this.navOpen) {
          this.closeMobile()
          var btn = document.querySelector('.cra1-header__menu-btn')
          if (btn && btn.focus) btn.focus()
        }
      },
      /**
       * 左栏切换一级入口：右栏面板随之切换，默认展开含当前页的二级
       * （阿里云式 —— 面板常在，无需「先点一级再点面板」）。
       */
      selectPrimary(key) {
        this.primaryKey = key
        if (global.innerWidth <= 1024) this.mobileDetail = true
        this.initMobileGroups()
      },
      /**
       * 右栏二级标题点击：全部内容常驻展开（多列布局），这里只负责跳转。
       */
      selectGroup(g) {
        if (g.url && !this.isExternal(g.url)) {
          this.goPage({ url: g.url, sourceMenuId: g.key, second_reminder: g.second_reminder })
        }
      },
      backToPrimary() {
        this.mobileDetail = false
      },
      /**
       * 组内叶子页面（三级行）。
       * 组只指向自身一个地址时（模块产品分类菜单）不再重复渲染三级行 ——
       * 二级组标题本身就是入口。
       */
      leafPagesOf(g) {
        var pages = (g && g.pages) || []
        if (pages.length === 1 && g.url
            && this.stripCRA1Menu(pages[0].url) === this.stripCRA1Menu(g.url)) {
          return []
        }
        return pages
      },
      isExternal(u) {
        try {
          var url=new URL(u,global.location.origin+'/')
          return /^(mailto|tel):$/.test(url.protocol) || (['http:','https:'].includes(url.protocol) && url.origin!==global.location.origin)
        } catch (error) { return false }
      },
      /**
       * 把后端菜单树摊平成一级列表（父级在前、子级紧随）。
       * 后端菜单实际是两级（如「其他」→「DCIM(自定义配置)」），
       * 只遍历顶层会把子菜单整个丢掉。
       * 子级命名成「父级 · 子级」，避免与父级同名时无法区分。
       */
      flattenMenu() {
        var out = []
        ;(this.menu || []).forEach(function (item) {
          out.push(item)
          if (item.child && item.child.length) {
            item.child.forEach(function (c) {
              out.push({
                id: c.id,
                name: item.name + ' · ' + c.name,
                url: c.url,
                icon: c.icon || item.icon,
                icon_style:c.icon_style || item.icon_style,icon_resolved:c.icon_resolved || item.icon_resolved,
                second_reminder: c.second_reminder,
                parentName: item.name,
              })
            })
          }
        })
        return out
      },
      /** 给静态三级描述补 second_reminder/sourceMenuId（无运行时菜单时给默认值） */
      withReminder(list) {
        return (list || []).map(function (pg) {
          return {
            name: pg.name,
            url: pg.url,
            second_reminder: pg.second_reminder === 1 ? 1 : 0,
            sourceMenuId: pg.sourceMenuId || null,
          }
        })
      },

      /**
       * 把侧栏节点转成面板页面项。
       * 产品列表类入口（productList.htm）附加 cloud_menu=<节点 UUID>：
       * 主题后台的「内容设置」用它区分不同入口的顶部文案。
       * 必须用主题侧的稳定 UUID，不能用 idcsmart_menu.id
       * （后者在系统保存导航时会整体删除重建）。
       */
      pageFromMenu(n, rootItem, nameOverride) {
        var url = String((n && n.url) || '')
        if (url.indexOf('productList.htm') === 0 && n.id) {
          url += (url.indexOf('?') === -1 ? '?' : '&') + 'cloud_menu=' + n.id
        }
        return {
          name: nameOverride || (n && n.name) || '',
          url: url,
          second_reminder: (n && (n.second_reminder === 1 || n.second_reminder === '1')) ? 1 : 0,
          sourceMenuId: (n && n.id) || null,
        }
      },

      /**
       * 按运行时菜单 URL 取三级页面描述。
       * 返回深拷贝并补全 second_reminder / sourceMenuId：
       *   - second_reminder 供外链二次提醒判断（见 goPage）；
       *   - sourceMenuId 供写回 frontMenusActiveId 用。
       * 静态描述表是共享常量，直接返回会被后续补字段污染，故拷贝。
       */
      pagesForUrl(url, menuItem) {
        var u = String(url || '')
        var def = SECONDARY_PAGES[u]
        if (!def) {
          // product.htm?m=xxx 这类带 query 的菜单，按路径回退
          var path = u.split('?')[0]
          if (path !== u) def = SECONDARY_PAGES[path]
        }
        if (!def) return null
        // 财务功能开关 → 财务中心三级页剔除对应入口（与侧栏节点同口径）
        var feat = global.__CRA1_FEAT__
        if (def === SECONDARY_PAGES['finance.htm'] && feat && feat.ready) {
          if (!feat.withdraw_open) {
            def = def.filter(function (pg) { return !/withdrawal\.htm/i.test(pg.url || '') })
          }
          if (!feat.recharge_open) {
            def = def.filter(function (pg) { return !/recharge\.htm/i.test(pg.url || '') })
          }
        }
        var sr = menuItem && menuItem.second_reminder
        var mid = menuItem && menuItem.id
        // 入口本身是产品列表时，其静态标签页（全部产品/使用中/…）同属该入口：
        // 带上入口的稳定 UUID，内容设置即可按入口区分顶部文案
        var tag = (menuItem && menuItem.id
                  && String(menuItem.url || '').indexOf('productList.htm') === 0)
                 ? 'cloud_menu=' + menuItem.id : ''
        return def.filter(function(pg){return !global.CRA1Shared?.Access || global.CRA1Shared.Access.canUrl(pg.url)}).map(function (pg) {
          var pu = pg.url
          if (tag && pu.indexOf('productList.htm') === 0) {
            pu += (pu.indexOf('?') === -1 ? '?' : '&') + tag
          }
          return {
            name: pg.name,
            url: pu,
            second_reminder: sr === 1 || sr === '1' ? 1 : 0,
            sourceMenuId: mid || null,
          }
        })
      },
      /** 三级链接是否命中当前地址（先精确匹配 query，再路径回退） */
      isPageActive(pg) {
        if (!pg || !pg.url) return false
        if (location.pathname === '/cart/goodsList.htm' && String(pg.url).split('?')[0] === 'cart/goodsList.htm') {
          var currentCart = new URLSearchParams(location.search)
          var targetCart = new URLSearchParams(String(pg.url).split('?')[1] || '')
          if (targetCart.get('product_id')) return targetCart.get('product_id') === currentCart.get('product_id')
          if (!currentCart.get('product_id') && targetCart.get('spg_id')) return targetCart.get('spg_id') === currentCart.get('spg_id')
        }
        // 页面链接可能带 cloud_menu=<UUID>（内容设置按它区分不同入口的顶部文案），
        // 高亮判断必须忽略该参数，否则直接访问 /productList.htm 时同级全部失亮。
        var strip = function (u) {
          var parts = String(u).split('?')
          if (parts.length < 2) return parts[0]
          var kept = parts[1].split('&').filter(function (p) { return p.indexOf('cloud_menu=') !== 0 })
          return kept.length ? parts[0] + '?' + kept.join('&') : parts[0]
        }
        var path = location.pathname.replace(/^\//, '')
        var all = strip(path + location.search)
        var target = strip(pg.url)
        if (target === all) return true
        // 无 query 的目标：只有当前也没有 query 时才算命中，避免与同级 ?tab= 冲突
        if (target.indexOf('?') === -1) return target === path && !location.search
        return false
      },
      goPage(pg) {
        if (!pg || !pg.url) return
        var href = global.CRA1Shared.Navigation.href(pg)
        if (!href || !global.CRA1Shared.Access.canUrl(href)) return
        if (/^(mailto|tel):/i.test(href)) { location.href=href; return }

        // 外链：与官方 default 主题保持一致的安全语义 ——
        // second_reminder=1 的菜单先跳转 /transfer.htm 让用户确认目标地址，
        // 否则直接新窗口打开。丢失这一步会把官方的二次确认环节去掉。
        if (this.isExternal(href)) {
          if (pg.second_reminder === 1) {
            location.href = '/transfer.htm?target=' + encodeURIComponent(href)
          } else {
            global.open(href, '_blank', 'noopener')
          }
          return
        }

        // 最近访问条目可由后台设置为统一新标签页打开
        if (pg.newTab) {
          global.open(href, '_blank', 'noopener')
          return
        }

        // 兼容写入：default 主题与部分插件遗留逻辑会读取该键记录当前菜单，
        // 值优先用后端菜单 id，其次用 URL，避免其它代码拿不到值。
        try {
          var src = this.menu.filter(function (m) {
            return m.url === pg.url || (m.id && pg.sourceMenuId === m.id)
          })[0]
          var idForStore = (src && src.id) || pg.sourceMenuId
          if (idForStore) localStorage.setItem('frontMenusActiveId', String(idForStore))
          localStorage.setItem('cra1_nav_primary', this.primaryKey)
        } catch (e) {}

        // 跳转前收起导航：新页面默认不显示导航，避免刷新后仍挡着内容
        this.closeMobile()
        location.href = href
      },
      goHome() {
        localStorage.frontMenusActiveId = ''
        var openUrl = this.brandUrl
        if (this.commonData.clientarea_logo_url_blank == 1) global.open(openUrl)
        else location.href = openUrl
      },
      async getCommonSetting() {
        try {
          var res = await getCommon()
          this.commonData = res.data.data || {}
          localStorage.setItem('common_set_before', JSON.stringify(this.commonData))
          this.logo = this.commonData.system_logo || ''
          this.logoFailed = false
          this.brandName = this.commonData.website_name || ''
        } catch (e) { /* 品牌信息失败不影响菜单 */ }
      },
      /* ------------------------------------------------------------------ */
      /* 最近访问（前台自动记录；按会员区分 key，后台只下发展示策略）          */
      /* ------------------------------------------------------------------ */
      /**
       * 记录 key：同一浏览器多会员切换时记录互不混入。
       * 身份取自 accountDetail 的账号 id（doGetMenu 里本来就会请求一次），
       * 本次请求确认身份后才读写，不信任持久化的上次会员编号。
       */
      recentKey() {
        return this.recentReady ? 'cra1_recent_' + this.recentUid : ''
      },
      /** 仅接受本站普通页面链接，排除首页、登录及含凭据的临时地址。 */
      recentUrl(value) {
        var raw = String(value || '').trim()
        if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw) || /[\\\u0000-\u001f]/.test(raw)) return ''
        try {
          var url = new URL(raw, location.origin + '/')
          if (url.origin !== location.origin || !/\.(?:htm|html)$/i.test(url.pathname)) return ''
          if (/^\/(?:home|index)\.htm$/i.test(url.pathname)
            || /\/(?:login|logout|register|forgetPassword|resetPassword)\.htm$/i.test(url.pathname)) return ''
          var privateQuery = false
          url.searchParams.forEach(function (v, k) {
            if (/token|password|passwd|secret|authorization|^jwt$/i.test(k)) privateQuery = true
          })
          return privateQuery ? '' : url.pathname.replace(/^\//, '') + url.search
        } catch (e) { return '' }
      },
      normalizeRecentItems(value) {
        var self = this
        var seen = Object.create(null)
        var now = Date.now()
        return (Array.isArray(value) ? value : [])
          .filter(function (f) { return f && typeof f === 'object' })
          .map(function (f) {
            var url = self.recentUrl(f.url)
            var name = String(f.name || '').trim().slice(0, 60)
            return { name: name || self.recentFallbackName(url) || '浏览页面', url: url, ts: Number(f.ts) }
          })
          .filter(function (f) { return f.url && Number.isFinite(f.ts) && f.ts > 0 && f.ts <= now })
          .sort(function (a, b) { return b.ts - a.ts })
          .filter(function (f) {
            if (seen[f.url]) return false
            seen[f.url] = true
            return true
          })
          .slice(0, 60)
      },
      /** Vue 外壳统一维护记录及策略，React 首页订阅同一份状态。 */
      emitRecentVisits() {
        var ready = this.recentReady && this.recentPolicyReady
        var enabled = ready && Number(this.recentCfg.enabled) === 1
        var days = Math.max(1, Math.min(90, Number(this.recentCfg.days) || 7))
        var limit = Math.max(1, Math.min(20, Number(this.recentCfg.max_items) || 8))
        var minTs = Date.now() - days * 86400000
        var state = {
          ready: ready,
          enabled: enabled,
          title: this.recentCfg.title || '最近访问',
          newTab: Number(this.recentCfg.new_tab) === 1,
          items: enabled ? this.normalizeRecentItems(this.recentItems).filter(function (f) { return f.ts >= minTs }).slice(0, limit) : [],
        }
        global.__CRA1_RECENT_VISITS__ = state
        try { global.dispatchEvent(new CustomEvent('cra1:recent-visits', { detail: state })) } catch (e) {}
      },
      /** 读取本地记录（展示时再按后台策略裁剪） */
      /** v20：应用手机端二级菜单折叠档位（快照异步就绪后兜底应用） */
      applyMobileExpandTier() {
        var self = this
        var apply = function (snap) {
          var ap = (snap || {}).appearance || {}
          var tier = ['one', 'all', 'none'].indexOf(ap.aside_mobile_expand) !== -1 ? ap.aside_mobile_expand : 'one'
          var changed = tier !== self.asideMobileExpand
          self.asideMobileExpand = tier
          // 档位就绪时抽屉未打开 → 立即按新档位重算；已打开则保留用户当前操作
          if (changed && !self.navOpen) self.initMobileGroups()
        }
        if (global.__CRA1_MEMBER_SNAPSHOT__) { apply(global.__CRA1_MEMBER_SNAPSHOT__); return }
        this.loadMemberSidebar().then(apply).catch(function () {})
      },
      /** v20：手机端二级分组折叠 —— 按档位初始化展开集合 */
      initMobileGroups() {
        var keys = this.activeGroups
          .filter(function (g) { return g.url || (g.pages && g.pages.length) })
          .map(function (g) { return g.key })
        if (this.asideMobileExpand === 'all') {
          this.mobileOpenGroups = keys.slice()
          return
        }
        if (this.asideMobileExpand === 'none') {
          this.mobileOpenGroups = []
          return
        }
        // one 档：上一次关闭侧边栏时打开的 → 当前页所在组 → 第一组
        var saved = []
        try {
          saved = JSON.parse(localStorage.getItem('cra1_aside_open_groups') || '[]') || []
        } catch (e) { saved = [] }
        saved = saved.filter(function (k) { return keys.indexOf(k) !== -1 })
        if (saved.length) {
          this.mobileOpenGroups = saved
          return
        }
        var self = this
        var curKey = ''
        this.activeGroups.forEach(function (g) {
          if (curKey) return
          var hit = (g.url && self.isPageActive({ url: g.url })) ||
            (g.pages || []).some(function (pg) { return self.isPageActive(pg) })
          if (hit) curKey = g.key
        })
        if (curKey) {
          this.mobileOpenGroups = [curKey]
        } else {
          this.mobileOpenGroups = keys.length ? [keys[0]] : []
        }
      },
      isGroupOpen(g) {
        return this.isNarrow ? this.mobileOpenGroups.indexOf(g.key) !== -1 : true
      },
      toggleGroup(g) {
        var i = this.mobileOpenGroups.indexOf(g.key)
        if (i === -1) this.mobileOpenGroups.push(g.key)
        else this.mobileOpenGroups.splice(i, 1)
        try {
          localStorage.setItem('cra1_aside_open_groups', JSON.stringify(this.mobileOpenGroups))
        } catch (e) {}
      },
      loadRecentItems() {
        var saved = []
        if (this.recentReady) {
          try {
            var raw = localStorage.getItem(this.recentKey())
            if (raw) saved = JSON.parse(raw)
          } catch (e) { saved = [] }
        }
        this.recentItems = this.normalizeRecentItems(saved)
        this.emitRecentVisits()
      },
      saveRecentItems(list) {
        if (!this.recentReady) return
        this.recentItems = this.normalizeRecentItems(list)
        try { localStorage.setItem(this.recentKey(), JSON.stringify(this.recentItems)) } catch (e) {}
        this.emitRecentVisits()
      },
      clearRecentItems() {
        if (!this.recentReady) return
        this.saveRecentItems([])
      },
      onRecentStorage(e) {
        if (this.recentReady && (!e.key || e.key === this.recentKey())) this.loadRecentItems()
      },
      /**
       * 身份与展示策略确认后记录本次访问。
       * 同一地址只保留最新一条并置顶；列表最多存 60 条（展示时再按后台策略裁剪），
       * 避免长期使用后无限增长。
       */
      recordVisit() {
        if (!this.recentReady || !this.recentPolicyReady || Number(this.recentCfg.enabled) !== 1) return
        var cur = this.recentUrl(location.pathname + location.search)
        if (!cur) return
        var list = this.recentItems.slice()
        var idx = list.findIndex(function (f) { return f.url === cur })
        var entry = { name: this.pageTitle() || cur, url: cur, ts: Date.now() }
        if (idx >= 0) list.splice(idx, 1)
        list.unshift(entry)
        if (list.length > 60) list = list.slice(0, 60)
        this.saveRecentItems(list)
      },
      /** accountDetail 解析出账号 id 后调用：换到该会员自己的桶并补记本次访问 */
      recentUidResolved(uid) {
        var id = String(uid || '')
        if (!/^[1-9]\d*$/.test(id)) return
        this.recentUid = id
        this.recentReady = true
        // 继续兼容旧版记录的键；读取始终使用本次请求确认的身份。
        try { localStorage.setItem('cra1_recent_uid', id) } catch (e) {}
        this.loadRecentItems()
        this.recordVisit()
      },
      /**
       * React 内容页广播真实页面名（detail.name），回填本页最近访问记录。
       * 只更新当前地址那条的 name —— 页面标题具名化后用户在面板里
       * 看到的是「C20230308162078」而非笼统的「产品详情」。
       */
      onPageTitle(e) {
        var name = String((e && e.detail && e.detail.name) || '').trim()
        if (!name || name.length > 60) return
        this.recentPageName = name
        if (!this.recentReady) return
        var cur = this.recentUrl(location.pathname + location.search)
        var changed = false
        this.recentItems = this.recentItems.map(function (f) {
          if (f.url !== cur || f.name === name) return f
          changed = true
          return { name: name, url: f.url, ts: f.ts }
        })
        if (changed) this.saveRecentItems(this.recentItems)
      },
      /** 当前页面标题（复用面包屑逻辑，供最近访问命名） */
      pageTitle() {
        return this.recentPageName || this.recentFallbackName(location.pathname) || document.title || '浏览页面'
      },
      recentFallbackName(url) {
        var path = String(url || '').replace(/^\//, '').split('?')[0]
        var map = {
          'home.htm': '控制台', 'account.htm': '账户信息', 'finance.htm': '财务中心',
          'security.htm': '安全中心', 'productList.htm': '我的产品',
          'productdetail.htm': '产品详情', 'orderDetail.htm': '订单详情',
          'withdrawal.htm': '提现', 'recharge.htm': '余额充值', 'group_rules.htm': '产品规则',
          'security_ssh.htm': 'SSH 密钥', 'security_group.htm': '安全组', 'security_log.htm': '操作日志',
          'product.htm': '我的产品', 'product_list.htm': '我的产品', 'crossModule.htm': '关联产品',
          'cart/goodsList.htm': '订购产品', 'cart/goods.htm': '产品配置', 'cart/shoppingCar.htm': '购物车',
          'cart/settlement.htm': '订单结算', 'newsView.htm': '公告详情',
        }
        if (map[path]) return map[path]
        var menu = this.flattenMenu().find(function (n) { return String(n.url || '').split('?')[0] === path })
        if (menu && menu.name) return menu.name
        if (/ticket.*\.htm$/i.test(path)) return /addticket/i.test(path) ? '提交工单' : /details/i.test(path) ? '工单详情' : '我的工单'
        if (/news_detail\.htm$/.test(path)) return '新闻详情'
        if (/news\.htm$/.test(path)) return '新闻资讯'
        if (/helpTotal\.htm$/.test(path)) return '帮助文档'
        if (/^module\//.test(path)) return '产品管理'
        var plugin = path.match(/^plugin\/(\d+)\//)
        if (plugin && installedPluginTitle(plugin[1])) return installedPluginTitle(plugin[1])
        if (/^cart\//.test(path)) return '订购产品'
        return ''
      },
      /**
       * 读取会员中心独立侧栏快照。
       * React 内容页（首页轮播 / 产品列表顶部文案）也要读同一份快照，
       * 通过 window 上的共享 Promise 去重：谁先发起请求，另一方直接复用；
       * 拿到后写入 window.__CRA1_MEMBER_SNAPSHOT__ 并广播 cloud:member-content。
       */
      loadMemberSidebar() {
        if (global.__CRA1_MEMBER_SNAPSHOT__) {
          return Promise.resolve(global.__CRA1_MEMBER_SNAPSHOT__)
        }
        if (global.__CRA1_MEMBER_SNAPSHOT_PROMISE__) {
          return global.__CRA1_MEMBER_SNAPSHOT_PROMISE__
        }
        var url = '/cra1-shared/snapshot.php?domain=member'
        global.__CRA1_MEMBER_SNAPSHOT_PROMISE__ = fetch(url, { credentials: 'omit' })
          .then(function (r) {
            if (!r.ok) return null
            return r.json()
          })
          .then(function (j) {
            if (!j || j.status !== 200 || !j.data) return null
            global.__CRA1_MEMBER_SNAPSHOT__ = j.data
            try {
              global.dispatchEvent(new CustomEvent('cra1:member-content', { detail: j.data }))
            } catch (e) { /* 环境不支持自定义事件时忽略 */ }
            return j.data
          })
          .catch(function () { return null })
        return global.__CRA1_MEMBER_SNAPSHOT_PROMISE__
      },
      /**
       * 把独立快照适配成内部菜单结构。
       * 快照是扁平的公开字段，这里组装成 groups 需要的 items 形态，
       * 并保留二级结构（children）。
       */
      applySnapshot(snap) {
        var self = this
        var toItem = function (n) {
          return {
            id: n.id,
            name: (n.language && n.language[localStorage.getItem('lang') || 'zh-cn']) || n.name,
            language: n.language || {},
            select_field: n.select_field || [],
            select_field_set: n.select_field_set || false,
            url: global.CRA1Shared.Navigation.href(n).replace(/^\//,''),
            icon: n.icon || '',
            icon_style:n.icon_style,icon_resolved:n.icon_resolved,
            second_reminder: n.second_reminder || 0,
            // 元数据必须一并保留：module/res_module/product_id/is_cross_module
            // 决定「这是不是产品分类入口」，丢弃会让面板无法区分模块分类
            type: n.type || 'custom',
            module: n.module || [],
            res_module: n.res_module || [],
            product_id: n.product_id || [],
            is_cross_module: n.is_cross_module || 0,
            source_nav_id: n.source_nav_id || 0,
            child: (n.children || []).map(toItem),
          }
        }
        var menu = (snap.sidebar || []).map(toItem)
        // 财务功能入口显隐（与 React 页面同一特征位）：
        //   - 提现规则关闭 → 剔除「申请提现」节点（含 finance 三级页）；
        //   - 充值开关关闭 → 剔除「余额充值」节点。避免后台关了前台还在。
        return global.__cra1FeatureFlags().then(function (feat) {
          menu = self.stripGatedEntries(menu, feat || {})
          self.snapshotAppearance = snap.appearance || {}
          self.applyAsideDefault(snap)
          // 首页最近访问展示策略；open_first 保留旧存储兼容，已不影响侧栏。
          if (snap.recent && typeof snap.recent === 'object') {
            self.recentCfg = {
              enabled: Number(snap.recent.enabled) === 1 ? 1 : 0,
              title: String(snap.recent.title || '最近访问').slice(0, 12),
              days: Math.max(1, Math.min(90, Number(snap.recent.days) || 7)),
              max_items: Math.max(1, Math.min(20, Number(snap.recent.max_items) || 8)),
              new_tab: Number(snap.recent.new_tab) === 1 ? 1 : 0,
              open_first: snap.recent.open_first ? 1 : 0,
            }
          }
          self.navShape = Number(snap.nav_shape) || 2
          self.menu = menu
          self.menuSource = 'member'
          try { localStorage.setItem('frontMenus', JSON.stringify(menu)) } catch (e) {}
          self.restoreNavState()
        })
      },
      /**
       * 按特征位剔除受后台开关控制的节点：
       *   withdrawal.htm ← 提现规则关闭（withdraw_open=0）
       *   recharge.htm   ← 充值开关关闭（recharge_open=0）
       * 特征位未就绪（ready=false）时不动树，等就绪后 applySnapshot 重跑。
       */
      stripGatedEntries(menu, feat) {
        var rules = []
        if (feat.ready && !feat.withdraw_open) rules.push(/withdrawal\.htm/i)
        if (feat.ready && !feat.recharge_open) rules.push(/recharge\.htm/i)
        var walk = function (items) {
          var out = []
          ;(items || []).forEach(function (it) {
            var u = String(it.url || '')
            if (rules.some(function (re) { return re.test(u) })) return
            var hadChildren = it.child && it.child.length
            if (hadChildren) it.child = walk(it.child)
            var permitted = !global.CRA1Shared?.Access || global.CRA1Shared.Access.canUrl(u)
            if (!permitted && !(it.child && it.child.length)) return
            if (!permitted && it.child && it.child.length) it.url = it.child[0].url || ''
            if (hadChildren && !it.child.length && (!u || u === '#')) return
            out.push(it)
          })
          return out
        }
        // 三级页表由 SECONDARY_PAGES 渲染：pagesForUrl 里按同一特征位同步剔除
        return walk(menu)
      },
      /** 回落：系统导航 */
      loadSystemMenu() {
        var self = this
        return getMenu()
          .then(function (res) {
            if (!res || res.data.status !== 200) return
            var menu = self.stripGatedEntries(res.data.data.menu || [], global.__CRA1_FEAT__ || {})
            try { localStorage.setItem('frontMenus', JSON.stringify(menu)) } catch (e) {}
            self.menu = menu
            self.menuSource = 'system'
            self.navShape = 2
            self.restoreNavState()
          })
          .catch(function () { /* 菜单失败：显示空态 */ })
      },
      /**
       * 读取侧栏数据。
       *
       * 优先读「会员中心主题」自己在后台配置的独立菜单快照
       * （CRA1 后台 → 会员中心主题 → 侧边栏导航）：
       *   GET /<后台目录>/index.php?r=member.sidebar.snapshot
       * 该快照是主题私有数据，与系统导航解耦。
       *
       * 若管理员还没配置过（404），或后台目录改名/不可达，
       * 自动回落到系统导航 /console/v1/menu —— 保证前台始终有可用的侧栏，
       * 不会因为后台配置缺失而变成空白。
       */
      doGetMenu() {
        var self=this;
        if(!global.CRA1Shared?.Access){this.loading=false;return}
        global.CRA1Shared.Access.read().then(function(){self.loadAuthorizedMenu()}).catch(function(){self.loading=false;self.menu=[]});
      },
      loadAuthorizedMenu() {
        var self = this
        this.loadMemberSidebar()
          .then(function (snapshot) {
            if (snapshot) {
              return self.applySnapshot(snapshot)
            }
            return self.loadSystemMenu()
          })
          .catch(function () {
            return self.loadSystemMenu()
          })
          .then(function () {
            self.loading = false
            self.recentPolicyReady = true
            self.emitRecentVisits()
            self.recordVisit()
          })

        // 账户信息：子账户权限广播 + 最近访问按会员分桶
        accountDetail()
          .then(function (res) {
            if (res.data.status !== 200) return
            var obj = res.data.data.account || {}
            try { localStorage.setItem('is_sub_account', obj.customfield ? obj.customfield.is_sub_account : '') } catch (e) {}
            // 账号 id 就绪：最近访问记录换到该会员自己的桶（同一浏览器多会员互不混入）
            self.recentUidResolved(obj.id)
            if (obj.customfield && obj.customfield.is_sub_account == 1) {
              accountPermissions(obj.id).then(function (r) {
                self.$emit('getruleslist', r.data.data.rule)
              })
            } else {
              self.$emit('getruleslist', 'all')
            }
          })
          .catch(function () {})
      },
      /** 依据当前地址推断应展开的一级入口（刷新后保持上下文） */
      restoreNavState() {
        var path = location.pathname.replace(/^\//, '')
        var all = path + location.search
        var found = null
        var self = this
        // shape=3：一级入口是后台分组节点，池 = 各分组下的页面组；
        // shape=2：主题内置（我的资源/产品与服务）。
        var pools
        if (this.navShape >= 3) {
          pools = (this.menu || []).filter(function (n) { return !isMenuSeparator(n) }).map(function (n) {
            return { key: n.id, list: self.groupsOfNode(n) }
          })
        } else {
          pools = [
            { key: 'resource', list: this.resourceSecondary },
            { key: 'service', list: this.serviceGroups },
          ]
        }
        pools.forEach(function (pool) {
          pool.list.forEach(function (c) {
            if (found) return
            // 组标题自身的地址也算命中：容器组（财务信息→finance.htm）的
            // 三级页都是 ?tab= 变体，仅扫三级行会漏掉直访 finance.htm 的高亮；
            // 单页折叠组（余额充值/自助更换IP）的入口也只在组标题上
            if (c.url && self.stripCRA1Menu(c.url) === self.stripCRA1Menu(all)) {
              found = { primary: pool.key }
              return
            }
            if (!c.pages) return
            c.pages.forEach(function (pg) {
              if (found) return
              // 链接带 cloud_menu 参数，高亮匹配要忽略它（见 isPageActive）
              if (self.stripCRA1Menu(pg.url) === self.stripCRA1Menu(all)) {
                found = { primary: pool.key }
              }
            })
          })
        })
        // 商品页会自动补充分组参数，按商品或分类标识定位所属一级订购分类。
        if (/^cart\//.test(path) && !found) {
          var cartParams = new URLSearchParams(location.search)
          var orderRoots = (this.menu || []).filter(function (n) { return /^cart\/goodsList\.htm(?:\?|$)/.test(n.url || '') })
          var cartRoot = orderRoots.find(function (n) {
            return self.groupsOfNode(n).some(function (g) {
              if (cartParams.get('product_id')) return (g.pages || []).some(function (pg) {
                return new URLSearchParams(String(pg.url).split('?')[1] || '').get('product_id') === cartParams.get('product_id')
              })
              return cartParams.get('spg_id') && new URLSearchParams(String(g.url).split('?')[1] || '').get('spg_id') === cartParams.get('spg_id')
            }) || (cartParams.get('fpg_id') && new URLSearchParams(String(n.url).split('?')[1] || '').get('fpg_id') === cartParams.get('fpg_id'))
          }) || orderRoots[0]
          if (cartRoot) found = { primary: cartRoot.id }
        }
        // 精确 query 未命中时，用路径回退（如 productdetail.htm 属于我的产品）
        if (!found) {
          var BELONGS = {
            productdetail: 'productList.htm', product_list: 'productList.htm',
            crossModule: 'productList.htm', group_rules: 'security.htm',
            orderDetail: 'finance.htm', withdrawal: 'finance.htm',
            security_ssh: 'security.htm', security_log: 'security.htm', security_group: 'security.htm',
            product: 'productList.htm', productList: 'productList.htm',
          }
          var base = path.replace(/\.htm$/, '')
          var belong = BELONGS[base]
          if (belong) {
            pools.forEach(function (pool) {
              pool.list.forEach(function (c) {
                if (found) return
                if (c.pages && c.pages.some(function (pg) { return self.stripCRA1Menu(pg.url).split('?')[0] === belong })) {
                  found = { primary: pool.key }
                }
              })
            })
          }
        }
        if (found) {
          self.primaryKey = found.primary
        } else {
          // 没有命中：沿用上次访问的入口，否则默认第一个真实菜单入口
          // （跳过「最近访问」——它是辅助入口，不是默认上下文）
          try {
            var p = localStorage.getItem('cra1_nav_primary')
            var valid = p && p !== 'recent' && this.primaryNav.some(function (x) { return x.key === p && !x.separator })
            if (!valid) {
              var first = this.primaryNav.filter(function (x) { return x.key !== 'recent' && !x.separator })[0]
              p = (first || { key: 'service' }).key
            }
            self.primaryKey = p
          } catch (e) {
            var fallback = this.primaryNav.filter(function (x) { return x.key !== 'recent' && !x.separator })[0]
            self.primaryKey = (fallback || { key: 'service' }).key
          }
        }
      },
      /** 去掉链接里的 cloud_menu 参数（内容设置参数，不参与高亮/匹配） */
      stripCRA1Menu(u) {
        var parts = String(u || '').split('?')
        if (parts.length < 2) return parts[0]
        var kept = parts[1].split('&').filter(function (p) { return p.indexOf('cloud_menu=') !== 0 })
        return kept.length ? parts[0] + '?' + kept.join('&') : parts[0]
      },
      /** 移动端打开抽屉时，把一级高亮定位到当前页面所属入口 */
      syncPrimaryFromLocation() {
        this.restoreNavState()
      },
    },
  }

  global.asideMenu = asideMenu
})(window)
