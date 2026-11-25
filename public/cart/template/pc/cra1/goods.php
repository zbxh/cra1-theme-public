{php}
require_once IDCSMART_ROOT.'public/cra1-shared/official-cart.php';
require_once IDCSMART_ROOT.'public/cra1-shared/cart-runtime.php';
cra1_cart_allow_zoom();
{/php}
{php}echo \CRA1\Theme\Presentation\OfficialCart::render('goods', get_defined_vars());{/php}
