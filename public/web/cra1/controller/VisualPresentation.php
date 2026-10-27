<?php
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

/** Presentation defaults are derived at read time; configuration is never rewritten. */
function cra1_presentation_custom(array $cra1, string $key): bool
{
    return in_array($key, array_merge($cra1['_page_explicit_fields'] ?? [], $cra1['_public_explicit_fields'] ?? [], $cra1['_theme_saved_fields'] ?? []), true);
}

function cra1_presentation_rows(string $module, string $page, string $raw, array $cra1): string
{
    // In bundled defaults a page-specific set replaces the generic fallback.
    // Explicitly authored lists keep their original aggregation semantics.
    if (cra1_presentation_custom($cra1, $module . '_rows_text')) return $raw;
    $specific = [];
    foreach (preg_split('/\r?\n/', $raw) as $line) {
        [, $content] = cra1_line_hidden($line);
        $target = trim(explode('|', $content, 2)[0]);
        if ($target !== '' && $target !== '*' && cra1_row_targets_page($target, $page)) $specific[] = $line;
    }
    return $specific ? implode("\n", $specific) : $raw;
}

function cra1_presentation_config(string $page, array $cra1): array
{
    $manifest = cra1_page_module_manifest();
    $labels = [];
    foreach ($manifest[$page]['modules'] ?? [] as $module) $labels[$module['id']] = $module['label'];
    if (!cra1_presentation_custom($cra1, 'spec_matrix_title') && isset($labels['spec_matrix'])) {
        $cra1['spec_matrix_title'] = $page === 'home' ? '计费与服务说明' : (cra1_presentation_hero($page) !== '' && $page !== 'solution' && strpos($page, 'solution/') !== 0 ? '配置与服务说明' : $labels['spec_matrix']);
        if (!cra1_presentation_custom($cra1, 'spec_matrix_desc')) $cra1['spec_matrix_desc'] = '';
        if (!cra1_presentation_custom($cra1, 'spec_matrix_more_text')) $cra1['spec_matrix_more_text'] = '查看相关文档';
    }
    if (!cra1_presentation_custom($cra1, 'step_ribbon_title')) {
        $cra1['step_ribbon_title'] = $page === 'home' ? '接入流程' : ($page === 'document' ? '查找与使用文档' : ($labels['step_ribbon'] ?? '接入流程'));
        if (!cra1_presentation_custom($cra1, 'step_ribbon_desc')) $cra1['step_ribbon_desc'] = '';
    }
    if (!cra1_presentation_custom($cra1, 'faq_board_title') && isset($labels['faq_board']) && in_array($page, ['document','document-result','contact','recruit','feedback','activities','partner/agent','partner/cps'], true)) {
        $cra1['faq_board_title'] = $labels['faq_board'];
        if (!cra1_presentation_custom($cra1, 'faq_board_desc')) $cra1['faq_board_desc'] = '';
    }
    if (!cra1_presentation_custom($cra1, 'choice_ladder_desc')) $cra1['choice_ladder_desc'] = '配置与参考价格供选型比较，实际规格、价格和计费周期以商品目录为准。';
    if (!cra1_presentation_custom($cra1, 'price_slider_desc')) $cra1['price_slider_desc'] = '以下为配置参考。可售规格、价格及计费周期请在商品目录确认。';
    foreach (['price_slider', 'choice_ladder'] as $module) {
        foreach ($cra1[$module . '_rows'] ?? [] as $i => $row) {
            $url = (string)($row['url'] ?? '');
            $cra1[$module . '_rows'][$i]['action'] = strpos($url, '/cart/') === 0 ? '查看配置' : '了解配置';
            if ($url === '/' . $page . '.html') {
                $directory = (string)($cra1[$module . '_link'] ?? '/cart/goodsList.htm');
                if ($directory === '' || $directory === $url || !cra1_url_ok($directory)) $directory = '/cart/goodsList.htm';
                $cra1[$module . '_rows'][$i]['url'] = $directory;
                $cra1[$module . '_rows'][$i]['action'] = strpos($directory, '/cart/') === 0 ? '查看商品目录' : '查看全部配置';
            }
            // Do not invent a billing period for historical, manually entered prices.
            $cra1[$module . '_rows'][$i]['period'] = preg_match('~[/／]\s*(?:月|年|天|小时|次|条)~u', $row['tag'] ?? '') ? $row['tag'] : '';
        }
    }
    // Both switches and their order remain authoritative. Merge the two visible
    // histories into the first position, keeping every distinct authored event.
    if ($page === 'about' && cra1_module_visible('about_timeline', $page, $cra1) && cra1_module_visible('timeline_road', $page, $cra1)) {
        $rows = $cra1['timeline_road_rows'] ?? [];
        foreach ($cra1['about_timeline'] ?? [] as $row) $rows[] = ['name' => $row['name'], 'desc' => $row['desc'], 'value' => $row['name'], 'tag' => '', 'url' => '', 'icon' => ''];
        $unique = [];
        foreach ($rows as $row) {
            $year = $row['value'] ?? '';
            $key = $year . '|' . trim(($row['name'] ?? '') . ($row['desc'] ?? ''));
            $unique[$key] = $row;
        }
        $rows = array_values($unique);
        usort($rows, static function ($a, $b) { return strcmp($a['value'], $b['value']); });
        $cra1['_presentation_timeline_rows'] = $rows;
    }
    return $cra1;
}

/** Decorative, local SVGs describe a service structure without claims or metrics. */
function cra1_presentation_hero(string $page): string
{
    $product = ['dedicated','rent','trusteeship','domain','domain_buy','domain_register','domain_shop','ssl','sms','icp','trademark','model'];
    if (!in_array($page, $product, true) && $page !== 'solution' && strpos($page, 'solution/') !== 0) return '';
    $common = '<g fill="none" stroke="#c3c7cb" stroke-width="1.5"><path d="M36 248h348M62 224h296M92 272h236"/><path d="m58 248 64-28h178l62 28-64 28H122Z"/></g>';
    if (in_array($page, ['dedicated','rent','trusteeship'], true)) {
        $art = '<rect x="124" y="48" width="172" height="198" rx="16" fill="url(#service-metal)" stroke="#aeb4ba"/><path d="M146 72h128" stroke="#fff" stroke-width="2"/>';
        foreach ([92,134,176] as $y) $art .= '<rect x="144" y="'.$y.'" width="132" height="32" rx="7" fill="#383d43"/><path d="M158 '.($y+12).'h64m-64 8h45" stroke="#939aa2" stroke-width="2"/><circle cx="260" cy="'.($y+16).'" r="3" fill="#c7b48d"/>';
        $art .= '<path d="M144 226h132" stroke="#aeb4ba"/><path d="M80 158h32m196 0h32" stroke="#bba77e" stroke-dasharray="4 4"/>';
    } elseif (strpos($page, 'domain') === 0) {
        $art = '<circle cx="210" cy="137" r="72" fill="url(#service-metal)" stroke="#abb2b9"/><g fill="none" stroke="#929ba4" stroke-width="1.5"><ellipse cx="210" cy="137" rx="32" ry="72"/><ellipse cx="210" cy="137" rx="72" ry="25"/><path d="M138 137h144m-72-72v144M66 137h60m168 0h60"/></g><g fill="#fff" stroke="#c6cace"><rect x="32" y="116" width="78" height="42" rx="10"/><rect x="310" y="116" width="78" height="42" rx="10"/></g><g fill="#626b74" font-size="12" font-family="sans-serif"><text x="52" y="142">DNS</text><text x="327" y="142">.com</text></g><circle cx="210" cy="66" r="5" fill="#bba77e"/>';
    } elseif (in_array($page, ['ssl','icp','trademark'], true)) {
        $art = '<rect x="108" y="54" width="172" height="188" rx="14" fill="url(#service-metal)" stroke="#bcc2c8"/><path d="M136 84h93m-93 18h117m-117 18h69m-69 68h70m-70 18h90" stroke="#9ea6ae" stroke-width="4" stroke-linecap="round"/><path d="m277 115 51 18v36c0 35-21 59-51 71-30-12-51-36-51-71v-36Z" fill="#363d44" stroke="#e0e3e6"/><path d="m255 176 15 15 30-32" fill="none" stroke="#c7b48d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    } elseif ($page === 'sms') {
        $art = '<rect x="152" y="49" width="116" height="196" rx="20" fill="url(#service-metal)" stroke="#abb3ba"/><rect x="165" y="72" width="90" height="140" rx="7" fill="#f7f8f9"/><path d="M194 231h32M188 62h44" stroke="#a7aeb5" stroke-width="3" stroke-linecap="round"/><g fill="#3a4047"><rect x="66" y="98" width="137" height="49" rx="10"/><path d="m185 144-15 15v-15Z"/></g><path d="M84 116h78m-78 14h54" stroke="#b7c0c7" stroke-width="3" stroke-linecap="round"/><rect x="237" y="161" width="113" height="47" rx="10" fill="#e9e4d9" stroke="#c7b48d"/><path d="m252 183 8 8 17-18" fill="none" stroke="#978563" stroke-width="3"/><path d="M290 181h40m-40 12h27" stroke="#aaa191" stroke-width="3"/>';
    } else {
        $art = '<g fill="none" stroke="#aeb7bf" stroke-width="1.5"><path d="M104 110h86v71h42v-71h84M210 74v45m-106 28v43m212-43v43"/></g><rect x="156" y="107" width="108" height="71" rx="14" fill="#363e46"/><path d="M177 129h65m-65 13h45m-45 13h57" stroke="#b9c1c8" stroke-width="3"/><g fill="url(#service-metal)" stroke="#bdc5cc"><rect x="62" y="64" width="84" height="64" rx="12"/><rect x="274" y="64" width="84" height="64" rx="12"/><rect x="62" y="190" width="84" height="47" rx="10"/><rect x="274" y="190" width="84" height="47" rx="10"/></g><g fill="none" stroke="#8e99a3" stroke-width="2"><path d="M80 83h48m-48 12h32m-32 12h41M292 83h48m-48 12h32m-32 12h41M80 207h48m-48 12h32M292 207h48m-48 12h32"/></g><circle cx="210" cy="64" r="7" fill="#c4b18a"/>';
    }
    return '<div class="service-art" aria-hidden="true"><svg viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="service-metal" x1="80" y1="40" x2="320" y2="240" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".5" stop-color="#e7ebee"/><stop offset="1" stop-color="#d2d9df"/></linearGradient></defs>'.$common.$art.'</svg></div>';
}
