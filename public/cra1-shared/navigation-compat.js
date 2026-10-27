/* Keep older immutable shell components in sync until their resource update. */
;(function (aside, header) {
  if (!aside || !header || header.methods.onNavState) return

  // Newer components already publish this event themselves. Retained resources
  // gain the same contract without rewriting an installed release directory.
  aside.watch = Object.assign({}, aside.watch, {
    navOpen: function (open) {
      window.__CRA1_NAV_OPEN__ = open === true
      window.dispatchEvent(new CustomEvent('cra1:aside-state', { detail: { open: open === true } }))
    },
  })
  header.methods.onNavState = function (event) {
    this.navOpen = !!(event.detail && event.detail.open === true)
  }
  header.methods.toggleNav = function () {
    window.dispatchEvent(new Event('cra1:toggle-aside'))
  }
  header.mixins = (header.mixins || []).concat([{
    created: function () {
      this.navOpen = window.__CRA1_NAV_OPEN__ === true
      window.addEventListener('cra1:aside-state', this.onNavState)
    },
    beforeDestroy: function () {
      window.removeEventListener('cra1:aside-state', this.onNavState)
    },
  }])
})(typeof asideMenu === 'undefined' ? null : asideMenu, typeof topMenu === 'undefined' ? null : topMenu)
