/**
 * 酷锐A1主题独立管理台
 * 页面：/<系统后台目录>/template/cra1/dashboard.htm（系统通用模板页面入口承载）
 * 读取接口：/<系统后台目录>/v1/template/cra1/content/get（系统 CheckAdmin 鉴权）
 * 鉴权：与后台一致，localStorage.backJwt + Authorization 头
 */
(function (window, undefined) {
  var old_onload = window.onload;
  window.onload = function () {
    var el = document.getElementById('content');
    var contentApi = new URL('../../v1/template/cra1/content/', window.location.href).pathname;

    var emptyForm = {
      cloud_menu_text: '',
      slides_text: '',
      show_capability_bool: true,
      cap1_title: '', cap1_desc: '', cap1_link: '',
      cap2_title: '', cap2_desc: '', cap2_link: '',
      cap3_title: '', cap3_desc: '', cap3_link: '',
      cap4_title: '', cap4_desc: '', cap4_link: '',
      panel_links_text: '',
      show_pricing_bool: true,
      pricing_title: '', pricing_desc: '', pricing_link: '', pricing_more_text: '',
      show_solutions_bool: true,
      sol_title: '', sol_desc: '', sol_link: '', sol_more_text: '',
      sol1_title: '', sol1_desc: '', sol1_url: '',
      sol2_title: '', sol2_desc: '', sol2_url: '',
      sol3_title: '', sol3_desc: '', sol3_url: '',
      sol4_title: '', sol4_desc: '', sol4_url: '',
      show_steps_bool: true,
      band_title: '', band_desc: '', band_link: '', band_more_text: '',
      band_item1_title: '', band_item1_desc: '',
      band_item2_title: '', band_item2_desc: '',
      band_item3_title: '', band_item3_desc: '',
      band_item4_title: '', band_item4_desc: '',
      show_nodes_bool: true,
      nodes_title: '', nodes_desc: '', nodes_link: '', nodes_more_text: '',
      nodes_text: '',
      show_news_bool: true,
      news_title: '', news_desc: '', news_link: '', news_more_text: '',
      home_products_text: '', home_products_limit: '8', home_products_group: '0',
      mega_notes_text: '',
      hotline: '',
      float_enable_bool: true,
      float_items_text: '',
      promise_1: '', promise_2: '', promise_3: '', promise_4: '',
      footer_about: '',
    };

    var groups = [
      { key: 'menu', label: '网站菜单' },
      { key: 'carousel', label: '首屏轮播' },
      { key: 'products', label: '首页产品' },
      { key: 'capability', label: '轮播下双面板' },
      { key: 'pricing', label: '产品与价格' },
      { key: 'solutions', label: '解决方案' },
      { key: 'steps', label: '快速上手步骤' },
      { key: 'nodes', label: '全球服务节点' },
      { key: 'news', label: '新闻公告' },
      { key: 'footer', label: '悬浮导航与页脚' },
    ];

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
          groups: groups,
          active: 'menu',
          loading: false,
          submitting: false,
        };
      },
      created: function () {
        this.load();
      },
      methods: {
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
        reset: function () {this.$message.warning('旧主题页仅供读取，请使用独立主题后台。');return;
          var self = this;
          var dialog = this.$dialog;
          var doReset = function () {
            axios
              .post(contentApi + 'reset', {}, authConfig())
              .then(function (res) {
                if (res.data && res.data.status === 200) {
                  self.$message.success('已恢复默认配置');
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
              header: '恢复全部默认',
              body: '将清除所有已保存的 酷锐A1主题配置，官网恢复为主题默认内容。确定继续吗？',
              onConfirm: doReset,
            });
          } else if (confirm('将清除所有已保存的 酷锐A1主题配置，确定恢复默认吗？')) {
            doReset();
          }
        },
        save: function () {this.$message.warning('旧主题页仅供读取，请使用独立主题后台。');return;
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
