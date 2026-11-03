/* CRA1 adapters for native administration pages. */
(function (root) {
  'use strict';
  if (!root.Vue) return;
  root.Vue.mixin({beforeCreate: function () {
    var methods = this.$options.methods || {};
    if (this.$options.parent || !methods.getOssPageConfig || !methods.smsTemplate) return;
    this.$options.methods = Object.assign({}, methods, {smsTemplate: async function () {
      var vm = this, ticket = {};
      vm._cra1SmsTemplateRead = ticket;
      vm.smsTemplateList = [];
      try {
        if (!vm.isGetsms) {
          if (!vm._cra1SmsInterfaces) vm._cra1SmsInterfaces = root.getSmsInterface().then(function (response) {
            var data = response.data;
            if (Number(data?.status) !== 200 || !Array.isArray(data?.data?.list)) throw new Error('invalid interfaces');
            vm.smsList = data.data.list; vm.isGetsms = true;
          }).finally(function () { vm._cra1SmsInterfaces = null; });
          await vm._cra1SmsInterfaces;
        }
        if (vm._isDestroyed || vm._cra1SmsTemplateRead !== ticket) return;
        var selected = vm.ossPageData.oss_sms_plugin;
        var provider = vm.smsList.find(function (item) { return String(item.id) === String(selected); });
        if (!provider || !provider.name) return;
        var response = await root.getSmsTemplate(provider.name), data = response.data;
        if (vm._isDestroyed || vm._cra1SmsTemplateRead !== ticket || String(vm.ossPageData.oss_sms_plugin) !== String(selected)) return;
        if (Number(data?.status) !== 200 || !Array.isArray(data?.data?.list)) throw new Error('invalid templates');
        vm.smsTemplateList = data.data.list;
      } catch (failure) {
        if (!vm._isDestroyed && vm._cra1SmsTemplateRead === ticket) {
          vm.smsTemplateList = [];
          vm.$message.error('页面错误，请刷新重试');
        }
      }
    }});
  }});
})(window);
