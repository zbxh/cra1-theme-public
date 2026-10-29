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
  shared.PluginPages = {articleHtml: articleHtml, handlesTicketRead: name === 'IdcsmartTicket' && view === 'ticketDetails' && available(plugin)};

  function certificationStatus(vm) {
    if (!vm.$el || !vm.$el.querySelector) return;
    var host = vm.$el.querySelector('.check-mode');
    if (!host) return;
    var status = host.querySelector('.cra1-plugin-read-status');
    if (!status) {
      status = root.document.createElement('p'); status.className = 'cra1-plugin-read-status';
      status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); host.appendChild(status);
    }
    var state = vm.cra1CertificationState, text = state === 'loading' ? '正在加载认证方式…' : state === 'empty' ? '暂未提供可用认证方式，请联系在线客服。' : state === 'error' ? '认证方式暂时无法加载，请稍后重试。' : vm.cra1CertificationConfig === 'error' ? '所选认证方式暂时无法加载，请重试。' : '';
    status.textContent = text; status.hidden = !text;
    if (state === 'error' || vm.cra1CertificationConfig === 'error') {
      var retry = root.document.createElement('button'); retry.type = 'button'; retry.className = 'cui-button cui-button--outline'; retry.textContent = '重新加载';
      retry.onclick = function () { if (state === 'error') vm.getCertificationInfo(); else vm.getConfig(); }; status.appendChild(retry);
    }
    var blocked = state !== 'ready' || vm.cra1CertificationConfig !== 'ready' || !vm.checkedVlue || vm.configLoading;
    Array.from(vm.$el.querySelectorAll('.next-box button')).forEach(function (button) { button.disabled = blocked; button.setAttribute('aria-disabled', String(blocked)); });
    Array.from(host.querySelectorAll('.el-select input')).forEach(function (input) { input.disabled = state !== 'ready' || vm.configLoading; });
  }
  function ticketStatus(vm) {
    if (!vm.$el || !vm.$el.querySelector) return;
    var host = vm.$el.querySelector('.main-card');
    if (!host) return;
    var status = host.querySelector('.cra1-plugin-read-status');
    if (!status) { status = root.document.createElement('p'); status.className = 'cra1-plugin-read-status'; status.setAttribute('role', 'status'); host.appendChild(status); }
    status.hidden = vm.cra1TicketState !== 'error';
    status.textContent = '工单详情暂时无法加载，请稍后重试。';
    if (!status.hidden) {
      var retry = root.document.createElement('button'); retry.type = 'button'; retry.className = 'cui-button cui-button--outline'; retry.textContent = '重新加载'; retry.onclick = function () { vm.getDetails(); }; status.appendChild(retry);
    }
  }

  // Patch only the identified native root instances, before Vue initializes
  // methods/data. Child components and other themes retain their own lifecycle.
  root.Vue.mixin({beforeCreate: function () {
    if (!plugin || this.$options.parent) return;
    var methods = this.$options.methods || {};
    if (name === 'IdcsmartTicket' && view === 'ticketDetails' && methods.getDetails) {
      var ticketData = this.$options.data;
      this.$options.data = function () { return Object.assign({}, typeof ticketData === 'function' ? ticketData.call(this) : ticketData, {cra1TicketState: 'loading'}); };
      this.$options.methods = Object.assign({}, methods, {
        getDetails: function (automatic) {
          var vm = this, id = new URLSearchParams(root.location.search).get('id');
          if (!/^[1-9]\d*$/.test(id || '') || vm._isDestroyed || vm._isBeingDestroyed) return Promise.resolve();
          if (vm._cra1TicketPending) return vm._cra1TicketPending;
          var ticket = {}; vm._cra1TicketRead = ticket; vm.id = id;
          return (vm._cra1TicketPending = read('/ticket/' + id).then(function (data) {
            if (vm._isDestroyed || vm._cra1TicketRead !== ticket) return;
            if (!data || !data.ticket || !data.ticket.id) throw new Error('unavailable');
            var value = Object.assign({}, data.ticket);
            value.host_ids = Array.isArray(value.host_ids) ? value.host_ids : [];
            value.replies = (Array.isArray(value.replies) ? value.replies : []).slice().reverse().map(function (reply) { return Object.assign({}, reply, {content: vm.filterContent(String(reply.content || ''))}); });
            vm.ticketData = value; vm.cra1TicketState = 'ready';
            vm.baseMsg.status = value.status; vm.baseMsg.title = '#' + value.ticket_num + '-' + value.title; vm.baseMsg.create_time = value.create_time;
            vm.getTicketType(); vm.getHostList();
            if (!automatic) vm.$nextTick(function () { if (!vm._isDestroyed) vm.toBottom(); });
          }).catch(function () { if (!vm._isDestroyed && vm._cra1TicketRead === ticket) vm.cra1TicketState = 'error'; })
            .finally(function () { if (vm._cra1TicketRead === ticket) vm._cra1TicketPending = null; }));
        },
        getTicketType: function () {
          var vm = this;
          return read('/ticket/type').then(function (data) {
            if (vm._isDestroyed) return;
            vm.ticketTypeList = Array.isArray(data.list) ? data.list : [];
            var type = vm.ticketTypeList.find(function (item) { return String(item.id) === String(vm.ticketData.ticket_type_id); });
            vm.baseMsg.type = type ? type.name : '';
          }).catch(function (failure) { error(vm, failure); });
        },
        getHostList: function () {
          var vm = this;
          return read('/host', {page: 1, limit: 1000, orderby: 'id', sort: 'desc', keywords: '', status: ''}).then(function (data) {
            if (vm._isDestroyed) return;
            vm.hostList = Array.isArray(data.list) ? data.list : [];
            vm.baseMsg.hosts = vm.hostList.filter(function (item) { return vm.ticketData.host_ids.some(function (id) { return String(id) === String(item.id); }); })
              .map(function (item) { return {id: item.id, label: item.product_name + ' (' + item.name + ')'}; });
          }).catch(function (failure) { error(vm, failure); });
        },
        autoRefresh: function () {
          var vm = this;
          if (vm._cra1TicketTimer) root.clearInterval(vm._cra1TicketTimer);
          if (!/^[1-9]\d*$/.test(new URLSearchParams(root.location.search).get('id') || '')) return;
          vm._cra1TicketTimer = root.setInterval(function () { if (!root.document.hidden && vm.cra1TicketState === 'ready') vm.getDetails(true); }, 60000);
        },
        doReplyTicket: function () { if (this.cra1TicketState !== 'ready') return; return methods.doReplyTicket.apply(this, arguments); },
        showClose: function () { if (this.cra1TicketState !== 'ready') return; return methods.showClose.apply(this, arguments); },
      });
    }
    if (name === 'IdcsmartCertification' && view === 'authentication_select' && methods.getCertificationInfo) {
      var originalData = this.$options.data;
      this.$options.data = function () { return Object.assign({}, typeof originalData === 'function' ? originalData.call(this) : originalData, {cra1CertificationState: 'loading', cra1CertificationConfig: 'idle'}); };
      this.$options.methods = Object.assign({}, methods, {
        getCertificationInfo: function () {
          var vm = this, ticket = {}; vm._cra1CertificationRead = ticket;
          vm.cra1CertificationState = 'loading'; vm.checkedVlue = ''; vm.configInfo = {}; vm.cra1CertificationConfig = 'idle';
          vm.personPluginList = []; vm.companyPluginList = []; vm.custom_fieldsList = [];
          return read('/certification/info').then(function (info) {
            if (!info || !info.person || !info.company) throw new Error('unavailable');
            if (vm._cra1CertificationRead !== ticket || vm._isDestroyed) return null;
            vm.certificationInfoObj = info;
            return read('/certification/plugin');
          }).then(function (data) {
            if (vm._cra1CertificationRead !== ticket || vm._isDestroyed) return;
            if (!data || !Array.isArray(data.list)) throw new Error('unavailable');
            vm.certificationPluginList = data.list;
            data.list.forEach(function (item) {
              if (!item || typeof item.name !== 'string' || !item.name) return;
              var types = Array.isArray(item.certification_type) ? item.certification_type : String(item.certification_type || '').split(',');
              var option = {value: item.name, label: item.title || item.name};
              if (types.includes('person')) vm.personPluginList.push(option);
              if (types.includes('company')) vm.companyPluginList.push(option);
            });
            if (Number(vm.certificationInfoObj.company.status) === 1) { root.location.href = 'authentication_status.htm?type=2'; return; }
            vm.authenticationType = Number(vm.certificationInfoObj.person.status) === 1 ? '2' : '1';
            vm.custom_fieldsList = vm.authenticationType === '1' ? vm.personPluginList.slice() : vm.companyPluginList.slice();
            vm.checkedVlue = vm.custom_fieldsList.length ? vm.custom_fieldsList[0].value : '';
            vm.cra1CertificationState = vm.checkedVlue ? 'ready' : 'empty';
          }).catch(function () { if (vm._cra1CertificationRead === ticket && !vm._isDestroyed) vm.cra1CertificationState = 'error'; });
        },
        clickType: function (type) {
          if (vmBusy(this) || !['1', '2'].includes(type)) return;
          var info = this.certificationInfoObj;
          if (type === '1' && Number(info.person.status) === 1) return;
          if (type === '2' && !Number(info.certification_company_open)) return;
          if (type === '2' && Number(info.certification_company_need_person) === 1 && Number(info.person.status) !== 1) return this.$message.warning(this.lang.realname_text88);
          this.authenticationType = type; this.configInfo = {}; this.cra1CertificationConfig = 'idle'; this._cra1CertificationConfigRead = null;
          this.custom_fieldsList = (type === '1' ? this.personPluginList : this.companyPluginList).slice();
          var next = this.custom_fieldsList.length ? this.custom_fieldsList[0].value : '';
          var same = next && next === this.checkedVlue; this.checkedVlue = next;
          this.cra1CertificationState = next ? 'ready' : 'empty';
          if (same) this.getConfig();
        },
        getConfig: function () {
          var vm = this, ticket = {}, selected = vm.checkedVlue, type = vm.authenticationType;
          vm._cra1CertificationConfigRead = ticket; vm.configInfo = {};
          if (!selected || !vm.custom_fieldsList.some(function (item) { return item.value === selected; })) { vm.cra1CertificationConfig = 'idle'; return Promise.resolve(null); }
          vm.cra1CertificationConfig = 'loading';
          return read('/certification/plugin/config', {name: selected, type: type === '1' ? 'person' : 'company'}).then(function (data) {
            if (vm._isDestroyed || vm._cra1CertificationConfigRead !== ticket || vm.checkedVlue !== selected || vm.authenticationType !== type) return null;
            if (!data || !data.order || typeof data.order !== 'object') throw new Error('unavailable');
            vm.configInfo = data; vm.cra1CertificationConfig = 'ready'; return data;
          }).catch(function () { if (!vm._isDestroyed && vm._cra1CertificationConfigRead === ticket) vm.cra1CertificationConfig = 'error'; return null; });
        },
        goUploadPage: function () {
          var vm = this;
          if (vmBusy(vm) || vm.cra1CertificationState !== 'ready' || !vm.checkedVlue) return Promise.resolve();
          vm._cra1CertificationSubmit = true; vm.configLoading = true;
          return vm.getConfig().then(function (data) {
            if (!data || vm._isDestroyed) return;
            var order = data.order;
            if (vm.statusArr.includes(order.status)) return;
            if (order.status === 'Unpaid') { vm.$refs.payDialog.showPayDialog(order.id); return; }
            if (!order.id && Number(data.pay) === 1) return root.apiCertificationOrder({name: vm.checkedVlue, type: vm.authenticationType === '1' ? 'person' : 'company'}).then(function (response) {
              var id = response && response.data && response.data.data && response.data.data.order_id;
              if (!id) throw new Error('unavailable');
              if (!vm._isDestroyed) vm.$refs.payDialog.showPayDialog(id);
            });
            root.location.href = (vm.authenticationType === '1' ? 'authentication_person.htm' : 'authentication_company.htm') + '?name=' + encodeURIComponent(vm.checkedVlue);
          }).catch(function (failure) { error(vm, failure); }).finally(function () { vm._cra1CertificationSubmit = false; vm.configLoading = false; });
        },
      });
    }
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
  }, mounted: function () {
    var vm = this;
    if (!vm.$options.parent && name === 'IdcsmartCertification' && view === 'authentication_select') {
      // Native templates do not render these additional state fields. Watch
      // them explicitly so a rejected read also updates the accessible status.
      vm.$watch(function () { return [vm.cra1CertificationState, vm.cra1CertificationConfig, vm.checkedVlue, vm.configLoading].join(':'); }, function () {
        vm.$nextTick(function () { if (!vm._isDestroyed) certificationStatus(vm); });
      }, {immediate: true});
    }
    if (!vm.$options.parent && name === 'IdcsmartTicket' && view === 'ticketDetails') {
      vm.$watch('cra1TicketState', function () {
        vm.$nextTick(function () { if (!vm._isDestroyed) ticketStatus(vm); });
      }, {immediate: true});
    }
  }, updated: function () {
    if (!this.$options.parent && name === 'IdcsmartCertification' && view === 'authentication_select') certificationStatus(this);
    if (!this.$options.parent && name === 'IdcsmartTicket' && view === 'ticketDetails') ticketStatus(this);
  }, beforeDestroy: function () {
    if (!this.$options.parent && name === 'IdcsmartCertification' && view === 'authentication_select') { this._cra1CertificationRead = null; this._cra1CertificationConfigRead = null; }
    if (!this.$options.parent && name === 'IdcsmartTicket' && view === 'ticketDetails') { this._cra1TicketRead = null; if (this._cra1TicketTimer) root.clearInterval(this._cra1TicketTimer); }
  }});
  function vmBusy(vm) { return vm._cra1CertificationSubmit || vm.configLoading || vm.cra1CertificationState === 'loading' || vm.cra1CertificationState === 'error'; }

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
