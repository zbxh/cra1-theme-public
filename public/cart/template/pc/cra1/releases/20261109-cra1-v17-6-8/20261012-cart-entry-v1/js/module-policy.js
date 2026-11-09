/** Only these three V10 module families use CRA1's integrated configurator. */
(function (window) {
  'use strict';
  const profiles = Object.freeze({
    mf_cloud: 'cloud', mf_dcim: 'dcim', idcsmart_common: 'common',
    remf_cloud: 'cloud', remf_dcim: 'dcim', reidcsmart_common: 'common'
  });
  function profile(module) {
    return typeof module === 'string' && Object.prototype.hasOwnProperty.call(profiles, module) ? profiles[module] : '';
  }
  function catalogModule(product) {
    if (!product || typeof product !== 'object') return '';
    // Match ProductModel::moduleClientConfigOption: only_api uses the reseller
    // module; a local server/server group uses its own module instead.
    if (product.mode === 'only_api' && product.res_module) return 're' + product.res_module;
    return product.module || product.module1 || '';
  }
  function url(path, id, address) {
    const value = new URL(address || window.location.href, window.location.href);
    value.pathname = path;
    for (const key of ['id', 'product_id', 'fpg_id', 'spg_id', 'view_html', 'embed', 'embed_nonce', 'standalone']) value.searchParams.delete(key);
    value.searchParams.set(path === '/cart/goodsList.htm' ? 'product_id' : 'id', id);
    // Official module query parsers use decodeURIComponent, which leaves '+'.
    return value.pathname + value.search.replace(/\+/g, '%20') + value.hash;
  }
  window.CRA1CartModules = Object.freeze({profile, catalogModule, url});
})(window);
