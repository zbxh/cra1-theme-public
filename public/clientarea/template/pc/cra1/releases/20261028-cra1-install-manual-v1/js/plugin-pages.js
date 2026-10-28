/* Theme adapters for native plugin consumers. No plugin source or API is replaced. */
(function (root) {
  'use strict';
  if (!root.Vue || !root.CRA1Shared || root.CRA1Shared.PluginPages) return;
  var shared = root.CRA1Shared;
  function plugins() {
    try { var list = JSON.parse(root.document.documentElement.getAttribute('addons_js') || '[]'); return Array.isArray(list) ? list.filter(function (item) { return item && typeof item === 'object'; }) : []; }
    catch (error) { return []; }
  }
  var route = /^\/plugin\/([1-9]\d*)\/([^/]+)\.htm$/.exec(root.location.pathname);
  var plugin = route && plugins().find(function (item) { return String(item.id) === route[1]; });
  var name = plugin && plugin.name, view = route && route[2];
  function available(item) {
    // V10's rendered addons_js is already filtered to active plugins and only
    // exposes id/name. Also respect explicit status in preview/legacy payloads.
    return !!item && (!Object.prototype.hasOwnProperty.call(item, 'status') || Number(item.status) === 1);
  }
  // Scope native typography to the actual registered plugin, independently of
  // its installation ID. This is presentation context, never authorization.
  if (available(plugin) && typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name)) {
    root.document.documentElement.setAttribute('data-cra1-plugin', name);
  }
  function read(path, params) { return root.Axios.get(path, {params: params}).then(function (r) { return r.data.data; }); }
  function error(vm, failure) {
    if (vm._isDestroyed || vm._isBeingDestroyed) return;
    var text = shared.Errors.message(failure);
    vm.$message.error(text);
  }
  function enabled(pluginName) {
    return plugins().some(function (item) { return item.name === pluginName && available(item); });
  }
  function url(value) {
    try {
      var target = new URL(String(value || ''), root.location.origin);
      return /^https?:$/.test(target.protocol) ? target.href : '';
    } catch (e) { return ''; }
  }
  function articleHtml(value) {
    var template = root.document.createElement('template');
    template.innerHTML = String(value || '');
    var tags = /^(P|BR|DIV|SPAN|H[1-6]|STRONG|B|EM|I|U|S|UL|OL|LI|BLOCKQUOTE|PRE|CODE|HR|TABLE|THEAD|TBODY|TFOOT|TR|TH|TD|A|IMG|FIGURE|FIGCAPTION)$/;
    Array.from(template.content.querySelectorAll('*')).reverse().forEach(function (node) {
      if (!tags.test(node.tagName)) { node.remove(); return; }
      Array.from(node.attributes).forEach(function (attribute) {
        var key = attribute.name, value = attribute.value;
        if (key === 'href' && node.tagName === 'A' && url(value)) node.setAttribute('href', url(value));
        else if (key === 'src' && node.tagName === 'IMG' && url(value)) node.setAttribute('src', url(value));
        else if (!/^(alt|title|colspan|rowspan)$/.test(key)) node.removeAttribute(key);
      });
      if (node.tagName === 'A') node.setAttribute('rel', 'noopener noreferrer');
      if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
    });
    return template.innerHTML;
  }
  shared.PluginPages = {articleHtml: articleHtml};

  // Patch only the identified native root instances, before Vue initializes
  // methods/data. Child components and other themes retain their own lifecycle.
  root.Vue.mixin({beforeCreate: function () {
    if (!plugin || this.$options.parent) return;
    var methods = this.$options.methods || {};
    if (name === 'IdcsmartSubAccount' && view === 'addChildAccount' && methods.getProjectList) {
      this.$options.methods = Object.assign({}, methods, {getProjectList: function () {
        // This optional plugin is absent on many V10 installations. A leftover
        // /project call otherwise returns HTML and rejects the entire form read.
        if (!enabled('IdcsmartProject')) { this.projectList = []; return Promise.resolve(); }
        var vm = this;
        return read('/project').then(function (data) { vm.projectList = data.list || []; })
          .catch(function (failure) { vm.projectList = []; error(vm, failure); });
      }});
    }
    if (name === 'IdcsmartRecommend' && view === 'recommend' && methods.getPromoterInfo) {
      this.$options.methods = Object.assign({}, methods, {
        getPromoterInfo: function () {
          var vm = this, generation = (vm._cra1PromoterGeneration || 0) + 1;
          vm._cra1PromoterGeneration = generation; vm.recProLoading = true;
          vm._cra1PromoterRead = read('/recommend/promoter').then(function (data) {
            if (vm._isDestroyed || vm._cra1PromoterGeneration !== generation) return false;
            vm.promoterData = data.promoter || {};
            vm.ruler.withdrawable_amount = vm.promoterData.withdrawable_amount;
            vm.isOpen = !!vm.promoterData.url;
            if (!vm.isOpen) { vm.recommendProducts = []; vm.systemUrlData = []; vm.customerUrlData = []; }
            return vm.isOpen;
          }).catch(function (failure) { vm.isOpen = false; error(vm, failure); return false; });
          return vm._cra1PromoterRead.then(function (open) {
            if (!open) return;
            return read('/recommend/products').then(function (data) {
              if (vm._cra1PromoterGeneration === generation) vm.recommendProducts = data.products || [];
            }).catch(function (failure) { error(vm, failure); });
          }).finally(function () { if (vm._cra1PromoterGeneration === generation) vm.recProLoading = false; });
        },
        getSystemUrl: function () {
          var vm = this, pending = vm._cra1PromoterRead;
          if (!pending) { vm.getPromoterInfo(); pending = vm._cra1PromoterRead; }
          return pending.then(function (open) {
            if (!open) return;
            return read('/recommend/promoter/system_url').then(function (data) {
              vm.systemUrlData = data.system_url || []; vm.urlData.system_url = vm.systemUrlData[0] || '';
            });
          }).catch(function (failure) { error(vm, failure); });
        },
        getCustomerUrl: function () {
          var vm = this, pending = vm._cra1PromoterRead;
          if (!pending) { vm.getPromoterInfo(); pending = vm._cra1PromoterRead; }
          return pending.then(function (open) {
            if (!open) return;
            return read('/recommend/promoter/url').then(function (data) { vm.customerUrlData = data.list || []; });
          }).catch(function (failure) { error(vm, failure); });
        },
        getDescription: function () {
          var vm = this;
          return read('/recommend/description').then(function (data) { vm.descriptionData = data; })
            .catch(function (failure) { error(vm, failure); });
        },
      });
    }
    if (name === 'ClientCare' && view === 'msgDetail' && methods.getMsgDetail) {
      this.$options.methods = Object.assign({}, methods, {getMsgDetail: function () {
        var vm = this;
        return read('/client_care/mail/' + encodeURIComponent(vm.id)).then(function (data) { vm.msgDetail = data.mail || {}; })
          .catch(function (failure) { error(vm, failure); });
      }});
    }
  }});

  if (name !== 'IdcsmartAnnouncement' || !['source', 'news_detail'].includes(view)) return;
  root.Vue.component('cra1-announcement-page', {
    props: {pluginId: {type: Number, required: true}},
    data: function () { return {detail: view === 'news_detail', categories: [], categoriesLoading: false, categoriesFailure: '', category: '', keywords: '', items: [], total: 0, page: 1, limit: 10, loading: true, failure: '', article: null}; },
    computed: {
      base: function () { return '/plugin/' + this.pluginId + '/'; },
      pages: function () { return Math.max(1, Math.ceil(this.total / this.limit)); },
      content: function () { return articleHtml(this.article && this.article.content); },
      attachments: function () { return ((this.article && this.article.attachment) || []).map(url).filter(Boolean); },
    },
    created: function () {
      if (this.detail) this.load();
      else {
        this.category = new URLSearchParams(root.location.search).get('category') || '';
        this.load();
        this.loadCategories();
      }
    },
    beforeDestroy: function () { this._cra1Read = null; this._cra1CategoryRead = null; },
    methods: {
      date: function (time) { var d = new Date(Number(time) * 1000); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('zh-CN') : ''; },
      href: function (id) { return this.base + 'news_detail.htm?id=' + encodeURIComponent(id); },
      select: function (id) { this.category = String(id); this.page = 1; this.load(); },
      search: function () { this.page = 1; this.load(); },
      paginate: function (offset) { this.page = Math.max(1, Math.min(this.pages, this.page + offset)); this.load(); },
      loadCategories: function () {
        var vm = this, ticket = {};
        vm._cra1CategoryRead = ticket; vm.categoriesLoading = true; vm.categoriesFailure = '';
        return read('/announcement/type').then(function (data) {
          if (vm._cra1CategoryRead !== ticket) return;
          if (!data || !Array.isArray(data.list)) throw new Error('unavailable');
          vm.categories = data.list;
        }).catch(function () {
          if (vm._cra1CategoryRead === ticket) vm.categoriesFailure = '分类暂时无法加载，可先查看全部公告。';
        }).finally(function () { if (vm._cra1CategoryRead === ticket) vm.categoriesLoading = false; });
      },
      load: function () {
        var vm = this, ticket = {};
        vm._cra1Read = ticket; vm.loading = true; vm.failure = '';
        var id = new URLSearchParams(root.location.search).get('id');
        if (vm.detail && !/^[1-9]\d*$/.test(id || '')) { vm.article = null; vm.loading = false; return Promise.resolve(); }
        var endpoint = vm.detail ? '/announcement/' + id : '/announcement';
        return read(endpoint, vm.detail ? {} : {page: vm.page, limit: vm.limit, orderby: 'id', sort: 'desc', keywords: vm.keywords, addon_idcsmart_announcement_type_id: vm.category})
          .then(function (data) {
            if (vm._cra1Read !== ticket) return;
            if (vm.detail) {
              vm.article = data.announcement && data.announcement.id ? data.announcement : null;
              if (vm.article) root.document.title = vm.article.title + ' - ' + (shared.Runtime.common().website_name || '公告中心');
            } else { vm.items = data.list || []; vm.total = Number(data.count) || 0; }
          }).catch(function (failure) { if (vm._cra1Read === ticket) vm.failure = shared.Errors.message(failure); })
          .finally(function () { if (vm._cra1Read === ticket) vm.loading = false; });
      },
    },
    template: `<section class="cra1-articles" aria-label="公告中心" :aria-busy="String(loading)">
      <header class="cra1-articles__heading"><div><h1>{{detail ? '公告详情' : '公告中心'}}</h1><p v-if="!detail">了解最新动态与服务公告</p></div><a v-if="detail" :href="base+'source.htm'" class="cui-button cui-button--outline">返回公告列表</a></header>
      <template v-if="!detail"><form class="cra1-articles__search" @submit.prevent="search"><input class="cui-input" v-model="keywords" type="search" maxlength="100" placeholder="搜索公告" aria-label="搜索公告"><button class="cui-button cui-button--primary" type="submit">搜索</button></form>
        <nav class="cra1-articles__categories" aria-label="公告分类" :aria-busy="String(categoriesLoading)"><button type="button" :aria-current="category===''?'true':null" @click="select('')">全部公告</button><button type="button" v-for="item in categories" :key="item.id" :aria-current="category===String(item.id)?'true':null" @click="select(item.id)">{{item.name}}</button><span v-if="categoriesFailure" class="cra1-articles__category-status" role="status">{{categoriesFailure}}<button type="button" @click="loadCategories">重试分类</button></span></nav>
      </template>
      <div v-if="failure" class="cra1-articles__empty" role="alert"><p>{{failure}}</p><button type="button" class="cui-button cui-button--outline" @click="load">重试</button></div>
      <p v-else-if="loading" class="cra1-articles__empty" role="status">正在加载公告…</p>
      <template v-else-if="detail"><article v-if="article" class="cui-card cra1-articles__detail"><h2>{{article.title}}</h2><div class="cra1-articles__meta"><span>{{article.type}}</span><time>{{date(article.create_time)}}</time></div><div class="cra1-articles__body" v-html="content"></div><div v-if="attachments.length" class="cra1-articles__attachments"><h3>附件</h3><a v-for="(file,index) in attachments" :key="file" :href="file" target="_blank" rel="noopener noreferrer">下载附件 {{index+1}}</a></div><nav class="cra1-articles__adjacent" aria-label="相邻公告"><a v-if="article.prev && article.prev.id" :href="href(article.prev.id)">上一篇：{{article.prev.title}}</a><a v-if="article.next && article.next.id" :href="href(article.next.id)">下一篇：{{article.next.title}}</a></nav></article><p v-else class="cra1-articles__empty">该公告不存在或已下架。</p></template>
      <template v-else><ul v-if="items.length" class="cra1-articles__list cui-card"><li v-for="item in items" :key="item.id"><a :href="href(item.id)"><span>{{item.title}}</span><time>{{date(item.create_time)}}</time><span aria-hidden="true">→</span></a></li></ul><p v-else class="cra1-articles__empty">暂无符合条件的公告。</p><nav v-if="total>limit" class="cra1-articles__pagination" aria-label="公告分页"><button type="button" class="cui-button cui-button--outline" :disabled="page<=1" @click="paginate(-1)">上一页</button><span aria-live="polite">{{page}} / {{pages}}</span><button type="button" class="cui-button cui-button--outline" :disabled="page>=pages" @click="paginate(1)">下一页</button></nav></template>
    </section>`,
  });
})(window);
