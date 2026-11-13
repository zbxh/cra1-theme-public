/* Public header appearance must also load on anonymous native product pages.
   Reuse the sidebar's request and memory cache; never persist a configuration. */
(function (root) {
  // Native modules retain all controls and scripts. Only the theme-owned
  // navigation receives shared decorative effects in this standalone bundle.
  function effects(){if(root.CRA1Shared&&root.CRA1Shared.UIEffects)root.CRA1Shared.UIEffects.start();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',effects,{once:true});else effects();
  if (root.__CRA1_MEMBER_SNAPSHOT_PROMISE__) return;
  root.__CRA1_MEMBER_SNAPSHOT_PROMISE__ = root.fetch('/cra1-shared/snapshot.php?domain=member', { credentials: 'omit' })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (response) {
      if (!response || response.status !== 200 || !response.data) return null;
      root.__CRA1_MEMBER_SNAPSHOT__ = response.data;
      root.dispatchEvent(new CustomEvent('cra1:member-content', { detail: response.data }));
      return response.data;
    }).catch(function () { return null; });
})(window);
