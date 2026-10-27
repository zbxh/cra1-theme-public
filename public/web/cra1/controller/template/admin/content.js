/**
 * 酷锐A1主题内容配置页
 * 读取接口：/<系统后台目录>/v1/template/cra1/content/get（系统后台鉴权）
 * 鉴权方式与后台自带模板控制器页面一致：localStorage.backJwt + Authorization 头
 */
(function (window, undefined) {
  var old_onload = window.onload;
  window.onload = function () {
    var el = document.getElementById('content');
    var contentApi = new URL('../../v1/template/cra1/content/', window.location.href).pathname;

    var emptyForm = {
      hero_badge: '', hero_title_line1: '', hero_title_pre: '', hero_title_highlight: '',
      hero_desc: '', hero_btn1_text: '', hero_btn1_url: '', hero_btn2_text: '', hero_btn2_url: '',
      hero_products_text: '',
      nodes_text: '',
      slides_text: '',
      show_capability_bool: true,
      cap1_title: '', cap1_desc: '', cap1_link: '', cap2_title: '', cap2_desc: '', cap2_link: '',
      cap3_title: '', cap3_desc: '', cap3_link: '', cap4_title: '', cap4_desc: '', cap4_link: '',
      panel_links_text: '',
      show_why_bool: true,
      why_badge: '', why_title: '', why_desc: '',
      why1_title: '', why1_desc: '', why2_title: '', why2_desc: '',
      why3_title: '', why3_desc: '',
      show_pricing_bool: true, pricing_badge: '', pricing_title: '', pricing_desc: '',
      show_solutions_bool: true, sol_badge: '', sol_title: '', sol_desc: '',
      sol1_title: '', sol1_desc: '', sol1_url: '',
      sol2_title: '', sol2_desc: '', sol2_url: '',
      sol3_title: '', sol3_desc: '', sol3_url: '',
      sol4_title: '', sol4_desc: '', sol4_url: '',
      band_title: '', band_desc: '',
      band_item1_title: '', band_item1_desc: '',
      band_item2_title: '', band_item2_desc: '',
      band_item3_title: '', band_item3_desc: '',
      band_item4_title: '', band_item4_desc: '',
      show_news_bool: true, news_badge: '', news_title: '', news_desc: '',
      footer_about: '',
      mega_products_text: '', mega_solutions_text: '', mega_support_text: '',
      mega_notes_text: '',
      hotline_label: '', hotline: '',
      float_enable_bool: true, float_items_text: '',
      promise_1: '', promise_2: '', promise_3: '', promise_4: '',
    };

    function authConfig() {
      return {
        headers: {
          Authorization: 'Bearer' + ' ' + (localStorage.getItem('backJwt') || ''),
        },
      };
    }

    new Vue({
      el: el,
      components: { comConfig: comConfig },
      data: function () {
        return {
          form: JSON.parse(JSON.stringify(emptyForm)),
          loading: false,
          submitting: false,
          // 模板控制器切换导航
          theme: 'cra1',
          tab: 'template/cra1/content.htm',
          tabList: [],
        };
      },
      computed: {
        mega_products_lines: function () {
          return (this.form.mega_products_text || '').split('\n').filter(function (l) { return l.trim(); }).length;
        },
      },
      created: function () {
        this.load();
        this.getTabList();
      },
      methods: {
        /** 模板控制器 tab 列表（与系统自带 tab 页一致） */
        getTabList: function () {
          var self = this;
          Axios.get('/template_tab', { params: { theme: this.theme } }).then(function (res) {
            self.tabList = (res.data && res.data.data && res.data.data.list) || [];
          }).catch(function () {});
        },
        changeTab: function (val) {
          // 与当前页面文件比较（v-model 先于 @change 同步，不能用 this.tab 判断）
          var cur = location.pathname.split('/').pop();
          if (val === cur) return;
          // 其他 tab 跳系统官方路由；官网内容配置为本主题变体路由（该页在此路由下正常工作）
          var target = new URL('../../' + val.replace(/^\/+/, ''), window.location.href);
          target.searchParams.set('theme', this.theme);
          location.href = target.href;
        },
        load: function () {
          var self = this;
          self.loading = true;
          axios
            .get(contentApi + 'get', authConfig())
            .then(function (res) {
              var body = res.data || {};
              if (body.status !== 200) {
                self.$message.error(body.msg || '读取配置失败');
                return;
              }
              var data = body.data || {};
              var form = JSON.parse(JSON.stringify(emptyForm));
              Object.keys(form).forEach(function (k) {
                if (k.indexOf('_bool') > -1) {
                  var key = k.replace('_bool', '');
                  form[k] = data[key] !== '0';
                } else if (typeof data[k] !== 'undefined') {
                  form[k] = data[k];
                }
              });
              self.form = form;
            })
            .catch(function () {
              self.$message.error('读取配置失败，请确认已登录后台');
            })
            .then(function () {
              self.loading = false;
            });
        },
        /** 恢复默认：清空已保存配置（前台回落 defaults） */
        reset: function () {this.$message.warning('旧主题管理页已改为只读，请使用独立主题后台。');return;
          var self = this;
          var dialog = this.$dialog;
          var doReset = function () {
            axios
              .post(contentApi + 'reset', {}, authConfig())
              .then(function (res) {
                if (res.data && res.data.status === 200) {
                  self.$message.success('已恢复默认文案');
                  self.load();
                } else {
                  self.$message.error((res.data && res.data.msg) || '操作失败');
                }
              })
              .catch(function () {
                self.$message.error('操作失败，请稍后重试');
              });
          };
          if (dialog && dialog.confirm) {
            dialog.confirm({
              header: '恢复默认',
              body: '将清除所有已保存的自定义文案，前台恢复为主题默认内容。确定继续吗？',
              onConfirm: doReset,
            });
          } else if (confirm('将清除所有已保存的自定义文案，确定恢复默认吗？')) {
            doReset();
          }
        },
        save: function () {this.$message.warning('旧主题管理页已改为只读，请使用独立主题后台。');return;
          var self = this;
          self.submitting = true;
          var payload = {};
          Object.keys(this.form).forEach(function (k) {
            if (k.indexOf('_bool') > -1) {
              payload[k.replace('_bool', '')] = self.form[k] ? '1' : '0';
            } else {
              payload[k] = self.form[k];
            }
          });
          axios
            .post(contentApi + 'save', payload, authConfig())
            .then(function (res) {
              var body = res.data || {};
              if (body.status === 200) {
                self.$message.success('保存成功，前台已生效');
              } else {
                self.$message.error(body.msg || '保存失败');
              }
            })
            .catch(function () {
              self.$message.error('保存失败，请稍后重试');
            })
            .then(function () {
              self.submitting = false;
            });
        },
      },
    });
  };
})(window, undefined);
