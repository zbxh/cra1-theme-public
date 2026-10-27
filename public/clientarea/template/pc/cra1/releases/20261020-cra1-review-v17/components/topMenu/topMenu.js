/**
 * CRA1 会员中心顶栏（Vue 2 组件 · shadcn/ui 设计）
 *
 * 设计参考：https://ui.shadcn.com/blocks dashboard-01 的 SiteHeader
 *   结构 = SidebarTrigger（移动端汉堡） + Separator + Breadcrumb + 右侧操作区
 *
 * 对外契约（系统页与插件页都依赖，不得更改）：
 *   methods: getMessageList()（account.js 通过 $refs.topMenuRef 调用）
 *   子组件  : <coin-active ref="coinActive">、<client-level-dialog ref="levelDialog">
 *            （由 footer.php 引入；插件页不注册，故用 $options.components 探测后条件渲染）
 *   全局名  : topMenu（插件页 JS 用此名注册到 components）
 *
 * 数据来源（复用系统既有接口）：
 *   GET  /console/v1/common       语言列表等公共配置
 *   GET  /console/v1/account      当前账户（登录态）
 *   GET  /console/v1/cart         购物车数量
 *   GET  /console/v1/client_care/mail  消息列表（ClientCare 插件存在时）
 */
const topMenu = {
  name: 'cra1TopMenu',
  template: /* html */ `
<!--
  外壳容器用 display:contents：.cra1-shell__body 的 flex 子项仍然是 header 与公告条本身，
  不改变既有布局假设；公告条渲染在 header 之后（顶栏下方、内容区之上）。
-->
<div class="cra1-top-wrap" style="display:contents">
<header class="cra1-header" :class="{ 'is-search-open': searchOpen }">
  <div class="cra1-header__left">
    <!-- SidebarTrigger：切换主导航显隐。
         桌面端：主导航默认不显示，点此展开/收起左侧导航浮层。
         移动端：打开/关闭抽屉（均由 cra1:toggle-aside 事件驱动）。 -->
    <button type="button" class="cra1-header__icon-btn cra1-header__menu-btn"
            aria-label="切换主导航" :aria-expanded="navOpen ? 'true' : 'false'"
            @click="toggleNav">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16"></path>
      </svg>
    </button>

    <!-- 品牌：只展示一个 LOGO 图片，点击回到控制台首页 -->
    <a v-if="logo && !logoFailed" class="cra1-header__brand"
       :href="brandUrl" :aria-label="brandName || '返回控制台'"
       onclick="return false" @click.prevent="goBrand">
      <img :src="logo" :alt="brandName" class="cra1-header__brand-logo" @error="logoFailed = true">
    </a>
    <a v-else class="cra1-header__brand cra1-header__brand--text"
       :href="brandUrl" onclick="return false" @click.prevent="goBrand">
      {{ (brandName || '会员中心').slice(0, 1) }}
    </a>

    <span class="cra1-header__sep" aria-hidden="true"></span>

    <!-- Breadcrumb：控制台 > 当前页 -->
    <nav class="cra1-breadcrumb" aria-label="面包屑">
      <!-- 首页时当前项本身就是「控制台」，再显示一个根节点会变成「控制台 / 控制台」 -->
      <template v-if="!isHome">
        <a class="cra1-breadcrumb__root" href="/home.htm" onclick="return false" @click.prevent="goHome">控制台</a>
        <span class="cra1-breadcrumb__sep" aria-hidden="true">/</span>
      </template>
      <span class="cra1-breadcrumb__current">{{ pageTitle }}</span>
    </nav>
  </div>

  <div class="cra1-header__right">
    <!-- 点击只展开搜索框；输入关键词后显示结果，共用会员中心、购物车及插件页外壳。 -->
    <div ref="searchRoot" class="cra1-header-search"></div>
    <div ref="supportRoot" class="cra1-header-support" @click.stop></div>
    <a href="/document.html" class="cra1-header-docs" @click.prevent="go('/document.html')">文档</a>
    <!-- 购物车 -->
    <button v-if="isShowCart && appearance.show_cart !== 0" type="button" class="cra1-header__icon-btn" aria-label="购物车"
            @click="goShoppingCar">
      <span class="cra1-header-glyph" v-html="headerIcon('cart')"></span>
      <span v-if="shoppingCarNum > 0" class="cra1-header__badge">{{ shoppingCarNum > 999 ? '999+' : shoppingCarNum }}</span>
    </button>

    <!-- 消息（仅安装 ClientCare 插件时显示） -->
    <div v-plugin="'ClientCare'" class="cra1-header__msg">
      <button v-if="appearance.show_message !== 0" type="button" class="cra1-header__icon-btn" aria-label="消息"
              :aria-expanded="msgPanelOpen ? 'true' : 'false'" @click.stop="toggleMsgPanel">
        <span class="cra1-header-glyph" v-html="headerIcon('message')"></span>
        <span v-if="msgCount > 0" class="cra1-header__badge">{{ msgCount > 999 ? '999+' : msgCount }}</span>
      </button>

      <div v-show="msgPanelOpen" class="cra1-msg-panel" @click.stop>
        <div class="cra1-msg-panel__head">
          <span>消息通知</span>
          <button type="button" class="cra1-msg-panel__more" @click="goAccount">查看全部</button>
        </div>
        <div v-if="msgList.length">
          <button v-for="item in msgList" :key="item.id" type="button" class="cra1-msg-item"
                  @click="goMsgDetail(item.id)">
            <span class="cra1-msg-item__dot" :class="{ 'is-read': item.read === 1 }" aria-hidden="true"></span>
            <span class="cra1-msg-item__body">
              <span class="cra1-msg-item__title">{{ item.title }}</span>
              <span class="cra1-msg-item__meta">
                <span>{{ msgType[item.type] || '通知' }}</span>
                <span>{{ item.create_time | formateTime }}</span>
              </span>
            </span>
          </button>
        </div>
        <p v-else class="cra1-msg-panel__empty">暂无消息</p>
      </div>
    </div>

    <!-- 语言切换 -->
    <div v-if="appearance.show_language !== 0 && commonData.lang_list && commonData.lang_list.length" class="cra1-lang">
      <button type="button" class="cra1-header__icon-btn" aria-label="切换语言"
              :aria-expanded="langOpen ? 'true' : 'false'" @click.stop="closeSearch(false); langOpen = !langOpen">
        <span class="cra1-header-glyph" v-html="headerIcon('language')"></span>
      </button>
      <div v-show="langOpen" class="cra1-lang__menu" @click.stop>
        <button v-for="item in commonData.lang_list" :key="item.display_lang" type="button"
                class="cra1-lang__item" :class="{ 'is-active': item.display_lang === seletcLang }"
                @click="changeLang(item.display_lang)">{{ item.display_name }}</button>
      </div>
    </div>

    <!-- 未登录：登录按钮 -->
    <button v-if="unLogin && isGetData" type="button" class="cra1-header__login" @click="goLogin">登录 / 注册</button>

    <!-- Structure, avatar and popover are rendered by the shared framework-neutral component. -->
    <div v-else-if="isGetData" ref="accountRoot" class="cra1-account cra1-account--header" @click.stop></div>

    <!-- 可选子组件：仅当页面已注册时才渲染，避免插件页缺注册时报未知组件 -->
    <component v-if="childComponents.coinActive" :is="'coin-active'" ref="coinActive" v-plugin="['Coin', 'PresaleConsult']"></component>
    <component v-if="childComponents.clientLevelDialog" :is="'client-level-dialog'" ref="levelDialog"></component>
  </div>
</header>

  <!-- 顶部公告（后台「会员中心主题 → 内容设置」按条编辑）：
       仅显示 global=1 的条目（非全局条目只在首页公告位出现）；
       多条时轮播，间隔 interval 秒；标签/标题为服务端清理后的 HTML
       （支持内联样式，如鎏金渐变标签）；毛玻璃背景；点击正文弹出详情
       （含后台配置的按钮）；右上角关闭按钮按条 dismissible -->
  <div v-if="noticeBarVisible" class="cra1-notice-bar" role="status">
    <transition name="cra1-notice-fade" mode="out-in">
      <div :key="noticeBarCurrent.id" class="cra1-notice-bar__inner">
        <span v-if="noticeBarCurrent.label" class="cra1-notice-bar__label cra1-rich-text"
              v-html="noticeBarCurrent.label"></span>
        <button type="button" class="cra1-notice-bar__hit" aria-label="查看公告详情"
                @click="openNoticeDialog(noticeBarCurrent)">
          <span v-if="noticeBarCurrent.title" class="cra1-notice-bar__title cra1-rich-text"
                v-html="noticeBarCurrent.title"></span>
          <span v-if="noticeBarCurrent.content" class="cra1-notice-bar__text cra1-rich-text"
                v-html="noticeBarCurrent.content"></span>
        </button>
        <a v-if="noticeLinkOf(noticeBarCurrent)" class="cra1-notice-bar__link" :href="noticeLinkOf(noticeBarCurrent)"
           onclick="return false" @click.prevent="go(noticeLinkOf(noticeBarCurrent))">
          了解更多
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
          </svg>
        </a>
        <button v-if="Number(noticeBarCurrent.dismissible) === 1" type="button"
                class="cra1-notice-bar__close" aria-label="关闭公告" @click="dismissNotice(noticeBarCurrent)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </transition>
  </div>

  <!-- 公告详情弹窗：标题 + 内容 + 后台配置的按钮 -->
  <div v-if="noticeDialog" class="cra1-notice-dialog__mask" @click.self="noticeDialog = null">
    <div class="cra1-notice-dialog" role="dialog" aria-modal="true" aria-label="公告详情">
      <div class="cra1-notice-dialog__head">
        <span v-if="noticeDialog.label" class="cra1-notice-bar__label cra1-rich-text"
              v-html="noticeDialog.label"></span>
        <span class="cra1-notice-dialog__title">公告详情</span>
        <button type="button" class="cra1-notice-dialog__close" aria-label="关闭" @click="noticeDialog = null">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="cra1-notice-dialog__body cra1-rich-text">
        <div v-if="noticeDialog.title" class="cra1-notice-dialog__name" v-html="noticeDialog.title"></div>
        <div v-if="noticeDialog.content" v-html="noticeDialog.content"></div>
        <p v-if="!noticeDialog.title && !noticeDialog.content" class="cra1-notice-dialog__empty">暂无正文内容</p>
      </div>
      <div v-if="(noticeDialog.buttons || []).length || noticeDialog.link"
           class="cra1-notice-dialog__foot">
        <button v-for="btn in (noticeDialog.buttons || [])" :key="btn.label" type="button"
                class="cra1-notice-dialog__btn" @click="go(noticeLinkOf(btn)); noticeDialog = null">
          {{ btn.label }}
        </button>
        <button v-if="noticeDialog.link" type="button"
                class="cra1-notice-dialog__btn cra1-notice-dialog__btn--ghost"
                @click="go(noticeLinkOf(noticeDialog)); noticeDialog = null">
          了解更多
        </button>
      </div>
    </div>
  </div>
</div>
`,
  data() {
    return {
      unLogin: true,
      isGetData: false,
      isShowCart: true,
      /** 外观开关（后台「外观设置」下发）：{show_cart, show_language, show_message}
          早前快照下发了但前台零消费（4 个开关全是幽灵字段），此处接入。缺省 {} 表示不限制。 */
      appearance: {show_cart:0,show_language:0,show_message:0},
      shoppingCarNum: 0,
      msgList: [],
      msgCount: 0,
      msgPanelOpen: false,
      langOpen: false,
      seletcLang: '',
      commonData: { lang_list: [] },
      msgType: { official: '官方消息', host: '产品消息', finance: '财务消息' },
      childComponents: { coinActive: false, clientLevelDialog: false },
      accountOpen: false,
      accountData: null,
      userName: '',
      userEmail: '',
      accountId: '',
      accountCredit: '',
      tabTitle: '',
      // 品牌（与侧栏共用同一份 common 接口数据）
      logo: '',
      logoFailed: false,
      brandName: '',
      // 主导航显隐：桌面控制左侧导航浮层，移动端与抽屉联动
      navOpen: false,
      searchOpen: false,
      // 顶部公告（来自会员中心主题公开快照的 content.notices，按条编辑）
      noticeItems: [],          // 当前页面可见的公告条目（global 或 首页）
      noticeInterval: 5000,
      noticeDialog: null,       // 详情弹窗当前条目
      noticeIndex: 0,           // 轮播指针
      noticeDismissed: {},      // { [id]: snapshotVersion } 本浏览器关闭标记
    }
  },
  computed: {
    brandUrl() {
      return this.commonData.clientarea_logo_url || '/home.htm'
    },
    /* 头像：委托共享实现（assets/js/avatar.js，官网与会员中心唯一一套算法） */
    avatarStyle() {
      return CRA1Shared.Avatar.style(this.accountData)
    },
    avatarText() {
      return CRA1Shared.Avatar.letter(this.accountData)
    },
    currentLangLabel() {
      const list = this.commonData.lang_list || []
      const hit = list.find((i) => i.display_lang === this.seletcLang)
      if (hit) return (hit.display_lang || '').toUpperCase().slice(0, 2)
      return 'CN'
    },
    // 根节点固定是「控制台」。当当前项也是「控制台」时（首页、购物车等
    // 已归入控制台层级的页面），再渲染根节点会变成「控制台 / 控制台」。
    // 这里直接比对两个值，比逐个列 URL 更稳，新增页面不会再犯。
    isHome() {
      return this.pageTitle === '控制台'
    },
    /* ---- 顶部公告（按条编辑，global 条目跨页面显示）---- */
    globalNoticeItems() {
      return this.noticeItems
    },
    // 轮播当前条目（跳过已关闭的）；无可见条目时为 null
    noticeBarCurrent() {
      const list = this.globalNoticeItems
      if (!list.length) return null
      return list[this.noticeIndex % list.length] || list[0]
    },
    noticeBarVisible() {
      return !!this.noticeBarCurrent
    },

    // 面包屑当前项：由 URL 推断，避免每个页面都要传参
    pageTitle() {
      if (this.tabTitle) return this.tabTitle
      const path = location.pathname.replace(/^\//, '')
      // 插件页 /plugin/:id/:view.htm —— 按插件 ID 映射（对应 idcsmart_plugin 表）
      const pm = path.match(/^plugin\/(\d+)\//)
      if (pm) {
        try {const found=JSON.parse(document.getElementById('addons_js').getAttribute('addons_js')||'[]').find(p=>String(p.id)===pm[1]);if(found)return found.title} catch(e) {}

      }
      // 模块页 /module/:name/:view.htm
      if (/^module\//.test(path)) return '产品管理'
      // 其余插件页：按 view 名兜底
      const m = path.match(/^(?:plugin\/\d+|module\/[^/]+)\/([^/.]+)\.htm/)
      if (m) {
        const byView = {
          ticket: '工单中心', ticketDetails: '工单详情', addTicket: '新建工单',
          source: '文件下载', helpTotal: '帮助中心', news_detail: '公告详情',
          authentication_person: '实名认证', authentication_company: '企业认证',
          childAccount: '子账户管理', addChildAccount: '添加子账户',
        }
        return byView[m[1]] || '插件页面'
      }
      // 购物车/订购页 /cart/*.htm（由 ViewCartController 渲染，独立模板系统，
      // 但复用本主题外壳，因此面包屑也要能正确显示）
      const cm = path.match(/^cart\/([^/.]+)\.htm$/)
      if (cm) {
        const byCart = {
          goodsList: '订购产品', goods: '产品配置', goods_iframe: '产品配置',
          shoppingCar: '购物车', settlement: '订单结算', index_iframe: '订购产品',
        }
        if (byCart[cm[1]]) return byCart[cm[1]]
      }
      const map = {
        'home.htm': '控制台', 'account.htm': '账户信息', 'finance.htm': '财务中心',
        'security.htm': '安全中心', 'security_ssh.htm': '安全中心', 'security_group.htm': '安全中心',
        'security_log.htm': '安全中心', 'productList.htm': '我的产品', 'product.htm': '我的产品',
        'product_list.htm': '我的产品', 'productdetail.htm': '我的产品',
        'orderDetail.htm': '订单详情', 'withdrawal.htm': '提现', 'recharge.htm': '余额充值', 'crossModule.htm': '关联产品',
        'ticket.htm': '工单中心', 'group_rules.htm': '产品规则', 'template.htm': '模板预览',
        'agreement.htm': '服务条款', 'newsView.htm': '公告详情', 'transfer.htm': '跳转中',
      }
      return map[path] || '控制台'
    },
  },
  watch: {
    unLogin() {
      if (this._headerSearch) this._headerSearch.refresh()
    },
    accountOpen(value) { if (this._accountPopover) this._accountPopover.setOpen(value) },
  },
  created() {
    this.navOpen = window.__CRA1_NAV_OPEN__ === true
    window.addEventListener('cra1:aside-state', this.onNavState)
    // 探测可选子组件：以「当前 Vue 实例实际注册的组件」为准。
    // 插件页不注册 coinActive/clientLevelDialog，跳过渲染可避免 Unknown custom element 警告。
    const reg = this.$options.components || {}
    this.childComponents.coinActive = !!(reg.coinActive || reg['coin-active'])
    this.childComponents.clientLevelDialog = !!(reg.clientLevelDialog || reg['client-level-dialog'])
    this.getCommonSetting()
    this.GetIndexData()
    const _snap0 = window.__CRA1_MEMBER_SNAPSHOT__
    if (_snap0 && _snap0.appearance) this.appearance = _snap0.appearance
    this.applyGlobalNotice(window.__CRA1_MEMBER_SNAPSHOT__)
    // 快照通常由 asideMenu（或 React 内容页）拉取，这里监听广播兜底：
    // 两种时序都要能拿到 —— 先到的事件、以及早已就绪的共享缓存
    window.addEventListener('cra1:member-content', this.onMemberContent)
    window.addEventListener('cra1:avatar-updated', this.onAvatarUpdated)
    window.addEventListener('cra1:avatar-refresh', this.onAvatarRefresh)
  },
  mounted() {
    this._headerSearch = CRA1Shared.HeaderSearch.mount(this.$refs.searchRoot, {
      idPrefix: 'cra1-header-search-' + this._uid,
      getSearchOptions: () => ({ sources: CRA1Shared.HeaderSearch.pluginSources({ includeHosts: !this.unLogin }), language: this.seletcLang }),
      beforeOpen: () => this.closePopovers(),
      onOpenChange: (open) => { this.searchOpen = open },
      onNavigate: (url) => this.go(url),
    })
    this.mountAccountPopover()
    document.addEventListener('click', this.closePopovers)
    document.addEventListener('keydown', this.onNoticeKeydown)
    // 面包屑跟随页内标签切换：Element tabs 切换时不改 URL，
    // 这里监听点击并更新当前标题（仅影响面包屑展示，不干预插件逻辑）。
    document.addEventListener('click', this.onTabClick, true)
  },
  updated() { this.mountAccountPopover(); this.mountSupportPopover() },
  beforeDestroy() {
    if (this._headerSearch) this._headerSearch.destroy()
    if (this._accountPopover) this._accountPopover.destroy()
    if (this._supportComponent) this._supportComponent.destroy()
    document.removeEventListener('click', this.closePopovers)
    document.removeEventListener('keydown', this.onNoticeKeydown)
    document.removeEventListener('click', this.onTabClick, true)
    window.removeEventListener('cra1:member-content', this.onMemberContent)
    window.removeEventListener('cra1:avatar-updated', this.onAvatarUpdated)
    window.removeEventListener('cra1:avatar-refresh', this.onAvatarRefresh)
    window.removeEventListener('cra1:aside-state', this.onNavState)
    if (this._noticeTimer) { clearInterval(this._noticeTimer); this._noticeTimer = null }
  },
  filters: {
    formateTime(time) {
      if (!time) return ''
      const d = new Date(Number(time) * 1000)
      if (isNaN(d.getTime())) return String(time)
      const p = (n) => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    },
  },
  methods: {
    openSearch() { if (this._headerSearch) this._headerSearch.open() },
    closeSearch(restore) { if (this._headerSearch) this._headerSearch.close(restore) },
    headerIcon(name) { return CRA1Shared.HeaderActions.icon(name) },
    mountSupportPopover() {
      const host = this.$refs.supportRoot
      if (!host) return
      if (!this._supportComponent) this._supportComponent = CRA1Shared.HeaderActions.mountSupport(host, {beforeOpen: () => this.closePopovers()})
      if (this._supportConfig !== this.commonData.theme_header_support) {
        this._supportConfig = this.commonData.theme_header_support
        this._supportComponent.update(this._supportConfig || {})
      }
    },
    mountAccountPopover() {
      const host = this.$refs.accountRoot
      if (this._accountRoot !== host) {
        if (this._accountPopover) { this._accountPopover.destroy(); this._accountPopover = null }
        this._accountRoot = host
        if (host) this._accountPopover = CRA1Shared.HeaderActions.mountAccount(host, {
          getUser: () => this.accountData,
          onNavigate: (url) => this.go(url), onLogout: () => this.logOut(),
          beforeOpen: () => { this.closeSearch(false); this.msgPanelOpen = false; this.langOpen = false },
          onOpenChange: (value) => { this.accountOpen = value },
        })
      }
      if (this._accountPopover) this._accountPopover.update()
    },
    onAvatarUpdated(e) {
      if (this.accountData && String(this.accountData.id) === String(e.detail.id)) {
        this.accountData = Object.assign({}, this.accountData, {theme_avatar:e.detail.theme_avatar})
      }
    },
    onAvatarRefresh(e) {
      if (!this.accountData || String(this.accountData.id) !== String(e.detail.id)) return
      accountDetail().then((res) => {
        if (res.data.status === 200) { this.accountData = res.data.data.account; CRA1Shared.Avatar.commit(this.accountData, false) }
      }).catch(() => {})
    },
    toggleAccount() { this.mountAccountPopover(); if (this._accountPopover) this._accountPopover.toggle() },
    onMemberContent(e) {
      this.applyGlobalNotice(e.detail)
      this.appearance=e.detail?.appearance || {show_cart:0,show_language:0,show_message:0}
      if(this.appearance.show_message===0){this.msgList=[];this.msgCount=0;this.msgPanelOpen=false}
    },
    /**
     * 解析公告快照。
     * content.notices = { enabled, interval_ms, items:[{id,label,title,content,link,global,dismissible,enabled}] }
     *   - global=1 的条目：所有页面显示；
     *   - global=0 的条目：仅首页显示（与原「首页公告轮播」的定位合并）。
     * 旧快照（content.global_notice 单条结构）兜底转换，保证升级瞬间不断档。
     */
    applyGlobalNotice(snap) {
      const c = (snap && snap.content) || {}
      const nt = c.notices
      let items = []
      let interval = 5
      if (nt && Array.isArray(nt.items)) {
        // interval 按秒；旧 interval_ms（毫秒）兜底换算
        interval = Math.min(300, Math.max(1, Number(nt.interval) || (nt.interval_ms ? Math.round(nt.interval_ms / 1000) : 5)))
        if (Number(nt.enabled) === 1) items = nt.items
      } else if (c.global_notice && Number(c.global_notice.enabled) === 1) {
        // 旧单条结构 → 一条全局公告
        items = [{
          id: 'legacy-global',
          label: '',
          title: c.global_notice.title || '',
          content: c.global_notice.html || '',
          link: c.global_notice.link || '',
          global: 1,
          dismissible: c.global_notice.dismissible,
        }]
      }
      // 当前页是首页才放行非全局条目。必须用精确路径判断：pageTitle 对
      // 未映射页面兜底返回「控制台」，用它会把所有新页面（充值/404 等）当
      // 成首页，首页专属公告（global=0）会泄漏到全站
      const isHome = location.pathname.replace(/^\//, '') === 'home.htm'
      const visible = items.filter((it) => it
        && Number(it.enabled) === 1
        && (Number(it.global) === 1 || isHome))
      this.noticeInterval = interval * 1000
      this.noticeItems = visible
      this.noticeDismissed = this.readNoticeDismissed()
      // 过滤掉本浏览器已关闭的条目
      this.noticeItems = visible.filter((it) => this.noticeDismissed[it.id] !== this.noticeSnapshotId())
      this.noticeIndex = 0
      this.restartNoticeTimer()
    },
    /** 快照版本标识：后台更新（version 变化）后用户关闭的公告会重新出现 */
    noticeSnapshotId() {
      const snap = window.__CRA1_MEMBER_SNAPSHOT__
      return snap ? `${snap.version}:${snap.updated_at}` : ''
    },
    readNoticeDismissed() {
      try {
        return JSON.parse(localStorage.getItem('cra1_notice_dismissed') || '{}') || {}
      } catch (e) { return {} }
    },
    /** 点击公告 → 详情弹窗 */
    openNoticeDialog(it) {
      if (!it) return
      this.noticeDialog = it
    },
    noticeLinkOf(it) {
      const u = String((it && it.link) || '').trim()
      if (!u) return ''
      if (/^https?:/i.test(u)) return u
      return '/' + u.replace(/^\//, '')
    },
    /** 关闭当前条目：只影响本浏览器；后台更新（version 变化）后重新出现 */
    dismissNotice(it) {
      if (!it) return
      try {
        const map = this.readNoticeDismissed()
        map[it.id] = this.noticeSnapshotId()
        localStorage.setItem('cra1_notice_dismissed', JSON.stringify(map))
      } catch (e) { /* localStorage 不可用时仅本次会话生效 */ }
      this.noticeItems = this.noticeItems.filter((x) => x.id !== it.id)
      if (this.noticeIndex >= this.noticeItems.length) this.noticeIndex = 0
    },
    restartNoticeTimer() {
      if (this._noticeTimer) { clearInterval(this._noticeTimer); this._noticeTimer = null }
      if (this.noticeItems.length > 1) {
        this._noticeTimer = setInterval(() => {
          this.noticeIndex = (this.noticeIndex + 1) % this.noticeItems.length
        }, this.noticeInterval)
      }
    },
    closePopovers() {
      this.closeSearch(false)
      this.msgPanelOpen = false
      this.langOpen = false
      this.accountOpen = false
      if (this._accountPopover) this._accountPopover.close(false)
      if (this._supportComponent) this._supportComponent.close(false)
    },
    onNoticeKeydown(e) {
      if (e.key === 'Escape' && this.searchOpen) { this.closeSearch(true); return }
      if (e.key === 'Escape' && this.noticeDialog) this.noticeDialog = null
    },
    // 页内标签点击后刷新面包屑（覆盖插件页 el-tabs 场景）
    onTabClick(e) {
      const tab = e.target && e.target.closest ? e.target.closest('.el-tabs__item') : null
      if (!tab) return
      const label = (tab.textContent || '').replace(/\s+/g, '').slice(0, 12)
      if (label) this.tabTitle = label
    },
    go(url) {
      this.accountOpen = false
      window.location.href = url
    },
    logOut() {
      this.accountOpen = false
      logout().then(() => {
        localStorage.removeItem('jwt')
        localStorage.removeItem('frontMenus')
        localStorage.removeItem('common_set_before')
        location.href = '/login.htm'
      }).catch(() => {
        localStorage.removeItem('jwt')
        location.href = '/login.htm'
      })
    },
    toggleMsgPanel() {
      const next = !this.msgPanelOpen
      this.closePopovers()
      this.msgPanelOpen = next
      if (next) this.getMessageList()
    },
    /**
     * 切换主导航。
     * 桌面（>1024px）：主导航默认隐藏，这里让侧栏以浮层形式展开/收起。
     * 移动端（≤1024px）：同一事件驱动抽屉开合，行为与原来一致。
     * 按钮状态由侧栏回传；Esc、遮罩关闭和跨断点关闭也保持同步。
     */
    toggleNav() {
      window.dispatchEvent(new Event('cra1:toggle-aside'))
    },
    onNavState(event) {
      this.navOpen = !!(event.detail && event.detail.open === true)
    },
    goBrand() {
      const url = this.brandUrl
      if (this.commonData.clientarea_logo_url_blank == 1) window.open(url)
      else location.href = url
    },
    goHome() { location.href = '/home.htm' },
    goLogin() {
      sessionStorage.setItem('redirectUrl', location.href)
      location.href = '/login.htm'
    },
    goAccount() { location.href = '/account.htm' },
    goShoppingCar() { location.href = '/cart/shoppingCar.htm' },
    /**
     * 兼容方法：default 主题的购物车页（cart/template/pc/default/js/*.js）
     * 会调用 this.$refs.topMenu.getCartList() 刷新右上角数量。
     * 本主题若不提供该方法，插件/购物车页在增删商品后会抛
     * "getCartList is not a function"。这里复用同一接口。
     */
    getCartList() {
      return cartList().then((r) => {
        if (r.data.status === 200) {
          const list = r.data.data.list || r.data.data.cart || []
          this.shoppingCarNum = Array.isArray(list) ? list.length : 0
        }
        return r
      }).catch(() => {})
    },
    goMsgDetail(id) { location.href = '/account.htm?msgId=' + id },
    async getCommonSetting() {
      try {
        const res = await getCommon()
        this.commonData = res.data.data || {}
        localStorage.setItem('common_set_before', JSON.stringify(this.commonData))
        this.seletcLang = localStorage.getItem('lang') || this.commonData.lang_home || 'zh-cn'
        this.logo = this.commonData.system_logo || ''
        this.logoFailed = false
        this.brandName = this.commonData.website_name || ''
      } catch (e) { /* 忽略 */ }
    },
    GetIndexData() {
      getMenu().then(() => {
        accountDetail()
          .then((res) => {
            if (res.data.status !== 200) return
            const acc = res.data.data.account || {}
            this.accountData = acc
            CRA1Shared.Avatar.register(acc)
            this.userName = acc.username || ''
            this.userEmail = acc.email || acc.phone || ''
            this.accountId = acc.id || ''
            this.accountCredit = CRA1Shared.Runtime.money(acc.credit || 0)
            this.unLogin = false
            this.isGetData = true
            cartList().then((r) => {
              if (r.data.status === 200) {
                const list = r.data.data.list || r.data.data.cart || []
                this.shoppingCarNum = Array.isArray(list) ? list.length : 0
              }
            }).catch(() => {})
          })
          .catch(() => { this.unLogin = true; this.isGetData = true })
      }).catch(() => { this.unLogin = true; this.isGetData = true })
    },
    // account.js 通过 $refs.topMenuRef.getMessageList() 调用，必须保留
    getMessageList() {
      if (this.appearance.show_message===0 || !window.__CRA1_RUNTIME__?.features?.client_care) return
      messageInfo().then((res) => {
        if (res.data.status === 200) {
          this.msgList = res.data.data.list || []
          this.msgCount = res.data.data.count || 0
        }
      }).catch(() => {})
    },
    changeLang(lang) {
      this.seletcLang = lang
      this.langOpen = false
      sessionStorage.setItem('brow_lang', lang)
      localStorage.setItem('lang', lang)
      if (typeof changeLanguage === 'function') {
        changeLanguage({ lang }).then(() => location.reload()).catch(() => location.reload())
      } else {
        location.reload()
      }
    },
  },
}
