<?php
declare(strict_types=1);
define('CRA1_THEME_ROOT', dirname(__DIR__, 2));
define('CRA1_THEME_BACKEND', CRA1_THEME_ROOT.'/cra1-theme/backend');
require_once CRA1_THEME_BACKEND.'/bootstrap.php';

use CRA1\Theme\Content\ContentDocument;
use CRA1\Theme\Content\CartDescriptions;

date_default_timezone_set('Asia/Shanghai');
$start = (new DateTimeImmutable('2027-01-01 09:00:00', ContentDocument::timezone()))->getTimestamp();
$source = '<h2>商品说明</h2><p style="color: #345; background-image: linear-gradient(#eee,#fff)"><strong>常驻说明</strong></p>'
    .'<cra1-timed start="2027-01-01T09:00" end="2027-01-01T10:00"><p>限时内容正文</p></cra1-timed>'
    .'<cra1-more></cra1-more><cra1-tabs><cra1-tab label="参数"><table><tr><td>参数</td></tr></table></cra1-tab>'
    .'<cra1-tab label="帮助"><p><a class="cra1-content-link" href="/document.html" target="_blank">帮助文档</a></p></cra1-tab></cra1-tabs>';
$count = 0;
function check(bool $condition, string $description): void
{
    if (!$condition) throw new RuntimeException($description);
    $GLOBALS['count']++;
}

$normal = ContentDocument::normalize($source, true);
check($normal === ContentDocument::normalize($normal, true), 'normalized source round-trips');
check(strpos($normal, 'start="2027-01-01T09:00:00"') !== false, 'local times canonicalize to seconds');
$early = ContentDocument::project($normal, $start - 1);
check($early['next_change'] === $start, 'server advertises the exact start');
check(strpos($early['html'], '限时内容正文') === false && strpos($early['text'], '限时内容正文') === false, 'future content stays out of both projections');
check(strpos($early['html'], '<summary>') !== false && strpos($early['text'], '帮助文档') === false, 'more marker folds the remainder and excludes it from summaries');
check(strpos($early['html'], 'role="tablist"') !== false && strpos($early['html'], '<table>') !== false, 'tabs and legacy table render');
check(strpos($early['html'], 'background-image: linear-gradient') !== false, 'safe legacy gradients remain supported');
$during = ContentDocument::project($source, $start);
check(strpos($during['html'], '限时内容正文') !== false && strpos($during['text'], '限时内容正文') !== false, 'start is inclusive');
check($during['next_change'] === $start + 3600, 'server advertises the exact end');
check(strpos($during['html'], '2027-01-01') === false && strpos($during['html'], 'data-cra1-content-ttl="3600"') !== false, 'customer markup omits schedule labels and dates');
$after = ContentDocument::project($normal, $start + 3600);
check(strpos($after['html'], '限时内容正文') === false && strpos($after['text'], '限时内容正文') === false, 'end is exclusive');
check(ContentDocument::project($normal, null)['html'] === $after['html'], 'disk snapshot never retains timed bodies');
check(ContentDocument::project('<p>&nbsp;<br></p>', $start)['html'] === '', 'empty formatting is not content');

$rich = '<p style="text-align: center"><span style="color: #345; background-color: #fff0a3">标记文字</span></p>'
    .'<blockquote><p>引用正文</p></blockquote><hr>'
    .'<table><thead><tr><th>旧表头</th></tr></thead><tbody><tr><td>旧表内容</td></tr></tbody></table>'
    .'<p><img src="/upload/example.png" width="280" class="cra1-content-image-center legacy" alt="示例图片"></p>'
    .'<cra1-callout tone="notice"><p>提醒内容</p></cra1-callout>'
    .'<cra1-callout tone="warning"><cra1-timed start="2027-01-01T09:00"><p>定时提醒</p></cra1-timed></cra1-callout>';
$richPreview = ContentDocument::preview($rich, $start - 1);
check($richPreview['source'] === ContentDocument::normalize($richPreview['source'], true), 'rich formatting round-trips through preview and save');
check(strpos($richPreview['html'], 'text-align: center') !== false && strpos($richPreview['html'], 'background-color: #fff0a3') !== false,
    'paragraph alignment and highlighter survive projection');
check(strpos($richPreview['html'], '<blockquote><p>引用正文</p></blockquote><hr>') !== false
    && strpos($richPreview['html'], '<thead>') !== false, 'quotes, rules and legacy table sections render');
check(strpos($richPreview['html'], 'class="cra1-content-image-center" width="280"') !== false
    && strpos($richPreview['html'], 'alt="示例图片"') !== false, 'image dimensions, placement and alternative text render');
check(strpos($richPreview['html'], 'data-tone="notice"') !== false && strpos($richPreview['text'], '提醒内容') !== false,
    'the selected callout tone and body render');
check(strpos($richPreview['html'], 'data-tone="warning"') === false && $richPreview['next_change'] === $start,
    'empty timed callouts stay hidden until the body is published');
check(strpos(ContentDocument::project($rich, $start)['html'], 'data-tone="warning"') !== false, 'timed warning renders during its window');

$components = '<cra1-callout tone="warning" title="  配置 &amp; &lt;提醒&gt;  "><p><a href="/help.htm" target="_blank">'
    .'<img src="/upload/example.png" alt="示例"><cra1-icon name="server"></cra1-icon>查看帮助</a></p></cra1-callout>'
    .'<cra1-tabs><cra1-tab label="示例"><cra1-timed start="2027-01-01T09:00" end="2027-01-01T10:00:15" show-end="1">'
    .'<p><a href="/details.htm"><cra1-icon name="server"></cra1-icon></a><img src="/upload/example.png" alt="示例"></p>'
    .'</cra1-timed></cra1-tab></cra1-tabs>';
$componentsPreview = ContentDocument::preview($components, $start);
$componentSource = $componentsPreview['source'];
$componentHtml = $componentsPreview['html'];
check($componentSource === ContentDocument::normalize($componentSource, true)
    && strpos($componentSource, 'show-end="1"') !== false, 'component options round-trip through normalization');
check(strpos($componentHtml, 'data-tone="warning"><strong class="cra1-content-callout__label">配置 &amp; &lt;提醒&gt;</strong>') !== false,
    'custom callout titles render as text while keeping their tone');
check(strpos($richPreview['html'], '>提醒</strong>') !== false, 'existing callouts retain their default title');
check(preg_match('~<a href="/help\.htm"[^>]*><img [^>]*><span class="cra1-content-icon">.*?查看帮助</a>~s', $componentHtml) === 1
    && strpos($componentHtml, '<a href="/details.htm" rel="noopener noreferrer"><span class="cra1-content-icon">') !== false,
    'linked images and icons survive inside callouts, tabs and timed bodies');
check(preg_match('~<div class="cra1-content-timed__end"><span class="cra1-content-icon">.*?<time datetime="2027-01-01T10:00:15\+08:00">2027-01-01 10:00:15</time></div><p>~s', $componentHtml) === 1
    && strpos($componentsPreview['text'], '2027-01-01') === false, 'opt-in end time appears above the body in site time and stays out of excerpts');
check(strpos(ContentDocument::project($componentSource, $start + 3615)['html'], 'cra1-content-timed__end') === false
    && strpos(ContentDocument::project($componentSource, null)['html'], 'cra1-content-timed__end') === false,
    'expired or saved public projections omit the timed block and its date');
$noEnd = ContentDocument::normalize('<cra1-timed start="2027-01-01T09:00" show-end="1"><p>持续内容</p></cra1-timed>', true);
check(strpos($noEnd, 'show-end') === false && strpos(ContentDocument::project($noEnd, $start)['html'], '<time') === false,
    'the end time option is ignored when no end date is set');

foreach (['<cra1-timed><p>空时间</p></cra1-timed>',
    '<cra1-timed start="2027-02-30T09:00"><p>日期异常</p></cra1-timed>',
    '<cra1-more></cra1-more><cra1-more></cra1-more>', '<div><cra1-more></cra1-more></div>',
    '<cra1-tabs><p>标签不完整</p></cra1-tabs>', '<cra1-tabs></cra1-tabs>'] as $invalid) {
    $rejected = false;
    try { ContentDocument::normalize($invalid, true); } catch (InvalidArgumentException $error) { $rejected = true; }
    check($rejected, 'invalid component is rejected explicitly');
}
$test = ContentDocument::project('<p>正常</p><iframe title="此内容不会输出"></iframe>', $start);
check(strpos($test['html'], 'iframe') === false && $test['text'] === '正常', 'legacy projection retains neighbouring safe HTML');

$rules = CartDescriptions::normalize([
    'global'=>['mode'=>'custom', 'html'=>'<p>全站说明</p>'],
    'first'=>[32=>['mode'=>'custom', 'html'=>'<p>一级说明</p>']],
    'second'=>[43=>['mode'=>'hide', 'html'=>'<p>此文保留</p>']],
    'product'=>[54=>['mode'=>'custom', 'html'=>'<cra1-timed start="2027-01-01T09:00" end="2027-01-01T10:00"><p>商品说明</p></cra1-timed>']],
], true);
$selection = ['first'=>32, 'second'=>43, 'product'=>54];
$hidden = CartDescriptions::project($rules, $selection, $start - 1);
check($hidden['mode'] === 'hide' && $hidden['html'] === '' && $hidden['next_change'] === $start, 'future product falls through to terminal hide');
check(CartDescriptions::project($rules, $selection, $start)['scope'] === 'product', 'active product takes precedence over a hidden group');
check(CartDescriptions::project($rules, $selection, $start + 3600)['mode'] === 'hide', 'expired product falls through again');
check(CartDescriptions::project($rules, ['first'=>32], $start)['scope'] === 'first', 'first group overrides global');
check(CartDescriptions::project($rules, ['first'=>33], $start)['scope'] === 'global', 'unconfigured group falls through to global');
check(CartDescriptions::storefront($rules, $selection, $start - 1) === [
    'mode'=>'hide', 'html'=>'', 'refresh_after'=>1,
], 'storefront and draft preview expose only the effective projection and refresh delay');
$unmatched = 0;
$mapped = CartDescriptions::remap($rules, [
    'first'=>[32=>['计算']], 'second'=>[43=>['计算','入门']], 'product'=>[54=>['计算','入门','样例']],
], [
    'first'=>[64=>['计算']], 'second'=>[65=>['计算','入门']],
    'product'=>[66=>['计算','入门','样例'], 67=>['计算','入门','样例']],
], $unmatched);
check($unmatched === 1 && isset($mapped['second'][65], $mapped['first'][64]) && !$mapped['product'], 'cross-site matching preserves only unique classification paths');
$ref = 'd-'.str_repeat('a', 32);
$unused = 'd-'.str_repeat('b', 32);
$shared = $rules;
$shared['shared'] = [$ref=>['mode'=>'custom', 'html'=>'<p>共用说明</p>'], $unused=>['mode'=>'hide']];
$shared['first'][31] = ['ref'=>$ref];
$shared['second'][44] = ['ref'=>$ref];
$shared['product'][55] = ['ref'=>$ref];
$shared = CartDescriptions::normalize($shared, true);
check(!isset($shared['shared'][$unused]) && count($shared['shared']) === 1, 'unused shared bodies are pruned');
check(CartDescriptions::normalize($shared, true) === $shared, 'shared bindings round-trip with existing inline rules');
check(CartDescriptions::project($shared, ['first'=>31, 'second'=>44, 'product'=>55], $start)['scope'] === 'product', 'linked binding keeps its own priority');
check(CartDescriptions::project($shared, ['first'=>31, 'product'=>56], $start)['scope'] === 'first', 'shared group also covers new products');
$preview = CartDescriptions::withPreview($shared, 'first', 31, 'custom', '<p>草稿说明</p>');
check(CartDescriptions::project($preview, ['first'=>31, 'product'=>55], $start)['html'] === '<p>草稿说明</p>', 'draft shared edit is shown through a more specific binding');
check(CartDescriptions::project($preview, $selection, $start - 1)['mode'] === 'hide', 'preview keeps the independent hide rule');
check(CartDescriptions::affectedProducts($shared, $preview, [
    ['first'=>31, 'second'=>44, 'product'=>55], ['first'=>31, 'product'=>56], $selection,
], $start) === 2, 'impact counts each visible product once despite overlapping shared bindings');
$preview = CartDescriptions::withPreview($preview, 'second', 44, 'custom', $rules['product'][54]['html']);
check(CartDescriptions::project($preview, ['first'=>31, 'second'=>44, 'product'=>55], $start - 1)['next_change'] === $start,
    'inactive shared timed content falls through and preserves refresh time');
$unmatched = 0;
$remapped = CartDescriptions::remap($shared, [
    'first'=>[31=>['组 A']], 'product'=>[55=>['组 A','商品 A']],
], [
    'first'=>[81=>['组 A']], 'product'=>[89=>['组 A','商品 A']],
], $unmatched);
check($remapped['first'][81] === ['ref'=>$ref] && $remapped['product'][89] === ['ref'=>$ref]
    && $remapped['shared'] === $shared['shared'], 'cross-site remap preserves one shared document for matched paths');
$remapped = CartDescriptions::remap($shared, [], [], $unmatched);
check(!isset($remapped['shared']), 'no remaining cross-site binding retains an orphan');
$rejected = false;
try { CartDescriptions::normalize(['product'=>[55=>['ref'=>$ref]]], true); }
catch (InvalidArgumentException $error) { $rejected = true; }
check($rejected, 'writes reject missing shared documents');
check(CartDescriptions::normalize(['product'=>[55=>['ref'=>$ref]]])['product'] === [], 'reads skip a dangling binding');
echo json_encode(['status'=>'passed','checks'=>$count], JSON_UNESCAPED_UNICODE).PHP_EOL;
