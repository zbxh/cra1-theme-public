/* Apply the theme's effective capabilities before a native module initializes. */
(function (root) {
  'use strict';
  if (root.__CRA1_NATIVE_CAPABILITIES__ || !root.Vue || root.location.pathname !== '/module/mf_cloud/product_detail.htm') return;
  root.__CRA1_NATIVE_CAPABILITIES__ = true;
  if (root.__CRA1_RUNTIME__ && root.__CRA1_RUNTIME__.app_presets === true) return;
  root.Vue.mixin({
    beforeCreate: function () {
      var options = this.$options, methods = options.methods;
      var template = root.document.getElementById('product_detail_cloud');
      if (this.$parent || !template || !methods || typeof methods.getAppPresetTasks !== 'function') return;
      // Vue compiles the original DOM after construction. Remove only the
      // unavailable extension's controls, leaving the business view intact.
      template.querySelectorAll('el-tab-pane[name="app_preset"],.app-preset-reinstall,.pay-app-preset').forEach(function (element) { element.remove(); });
      template.querySelectorAll('.app-preset-client-dialog').forEach(function (element) {
        var dialog = element.closest('el-dialog');
        if (dialog) dialog.remove();
      });
      options.methods = Object.assign({}, methods, {
        getAppPresetTasks: function () {
          root.clearTimeout(this.appPresetTaskTimer);
          this.appPresetTaskTimer = null;
          this.appPresetTasks = [];
          this.appPresetTaskLoading = false;
          this.appPresetTaskRequesting = false;
          if (this.appPresetTaskParams) this.appPresetTaskParams.total = 0;
          return Promise.resolve();
        },
        getReinstallAppPresets: function () {
          this.appPresetListRequestId = Number(this.appPresetListRequestId || 0) + 1;
          this.appPresetList = [];
          this.appPresetLoading = false;
          this.pendingReinstallAppPresetTask = null;
          if (this.reinstallData) this.reinstallData.app_preset_id = 0;
          if (typeof this.resetReinstallAppPresetPayment === 'function') this.resetReinstallAppPresetPayment();
          return Promise.resolve();
        }
      });
    }
  });
})(window);
