{php}
require_once IDCSMART_ROOT.'public/cra1-shared/official-cart.php';
{/php}
<script>
// Keep the historical product_id link compatible with the native id parameter.
(function () {
  var p = new URLSearchParams(location.search), id = p.get('product_id');
  if (!p.has('id') && /^[1-9]\d*$/.test(id || '')) {
    p.set('id', id);
    history.replaceState(history.state, '', location.pathname + '?' + p.toString().replace(/\+/g, '%20') + location.hash);
  }
})();
</script>
{php}echo \CRA1\Theme\Presentation\OfficialCart::render('goods', get_defined_vars());{/php}
