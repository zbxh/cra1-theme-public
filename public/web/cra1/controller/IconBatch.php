<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/**
 * 图标批量解析与本地缓存（v2.47）
 *
 * 为什么需要它（性能问题的根因）：
 *   图标选择器此前让浏览器**每个图标发一次跨域请求**（打开面板 41 个、切一个图标库 60+ 个）。
 *   浏览器对同一域名并发限制为 6，请求排队；而 Iconify 对突发请求会返回 **429 Too Many Requests**
 *   —— 实测面板「很卡、图标迟迟不出现」。
 *
 * 现在改为**服务端批量抓取 + 落盘本地**：
 *   浏览器只请求一次本站 API，服务端用 curl_multi 并行（限并发 8、带退避重试）抓取，
 *   写入 assets/icons/ 缓存后返回**本地 URL 列表**；同一图标第二次请求直接命中缓存，零外网流量。
 *
 * 与 cra1_icon_url() 的关系：单图标路径（配置解析/前台渲染）仍走 cra1_icon_url()，
 * 二者共用同一套缓存命名（md5(url)）与目录，因此后台预览与前台显示始终是同一个文件。
 */
if (!function_exists('cra1_icons_batch')) {

    /**
     * 批量把图标 id 解析为可访问 URL（本地缓存优先，缺失的并发抓取）。
     *
     * @param array $specs 图标 id 列表（mdi:phone / icons8:headset / 内置键 …）
     * @param int   $size  目标尺寸（px）
     * @return array id => url（解析失败为空串）
     */
    function cra1_icons_batch(array $specs, $size = 40)
    {
        $dir = __DIR__ . '/../assets/icons';
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        $size = max(16, min(256, intval($size)));
        $out = [];
        $pending = [];   // url => [id, file]
        $isPngMap = [];

        foreach ($specs as $spec) {
            $spec = trim((string) $spec);
            if ($spec === '') {
                $out[$spec] = '';
                continue;
            }
            // 内置键：本地即时生成（无需网络）
            if (function_exists('cra1_builtin_icons') && isset(cra1_builtin_icons()[$spec])) {
                $out[$spec] = cra1_icon_url($spec, $size, '#1769e0');
                continue;
            }
            $url = '';
            $isPng = false;
            if ($spec[0] === '/' || stripos($spec, 'http') === 0 || strpos($spec, '//') === 0) {
                $url = $spec;                       // 已是地址：直出
            } elseif (strpos($spec, 'icons8:') === 0) {
                $slug = trim(substr($spec, 7));
                if (preg_match('~^[a-z0-9][a-z0-9\-]*$~i', $slug)) {
                    $isPng = true;
                    $url = 'https://img.icons8.com/fluency-systems-filled/' . $size . '/' . $slug . '.png';
                }
            } else {
                $name = strpos($spec, 'iconify:') === 0 ? substr($spec, 8) : $spec;
                if (preg_match('~^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$~i', $name)) {
                    $url = 'https://api.iconify.design/' . str_replace(':', '/', $name) . '.svg?height=' . $size;
                }
            }
            if ($url === '') {
                $out[$spec] = '';
                continue;
            }
            if (preg_match('~^https?://~i', $url)) {
                $file = $dir . '/' . md5($url) . ($isPng ? '.png' : '.svg');
                if (is_file($file)) {
                    $out[$spec] = '/web/cra1/assets/icons/' . basename($file);
                } else {
                    $pending[$url] = ['id' => $spec, 'file' => $file, 'ext' => $isPng ? 'png' : 'svg'];
                }
            } else {
                $out[$spec] = $url;                 // 站内相对地址
            }
        }

        if ($pending) {
            cra1_icons_fetch_many($pending);
            foreach ($pending as $url => $info) {
                $out[$info['id']] = is_file($info['file'])
                    ? '/web/cra1/assets/icons/' . basename($info['file'])
                    : '';   // 抓取失败：留空（前端显示占位），不阻塞其余图标
            }
        }
        return $out;
    }
}

if (!function_exists('cra1_icons_fetch_many')) {

    /**
     * curl_multi 并行抓取（限并发 + 单个超时 + 失败不重试，避免拖慢整体）。
     * 只处理 http(s) 的远程图标；写盘后返回。
     *
     * @param array $pending url => ['file' => 目标路径]
     */
    function cra1_icons_fetch_many(array &$pending)
    {
        if (!function_exists('curl_multi_init') || !$pending) {
            return;
        }
        // 实测：Iconify 走 Cloudflare，突发并发会被限流（429 / error 1015）。
        // 因此采用「低并发 + 批间停顿 + 429 退避重试」，整体慢一些但能抓全；
        // 预热脚本可反复执行，已落盘的会自动跳过（增量续传）。
        $CONCURRENCY = 4;      // 单批并发
        $TIMEOUT = 6;          // 单个请求超时（秒）
        $PAUSE_US = 350000;    // 批间停顿（微秒）
        $MAX_TRY = 3;          // 单图标最多尝试次数（429 时退避）
        $tries = [];
        $queue = array_keys($pending);

        while ($queue) {
            $mh = curl_multi_init();
            $handles = [];
            $batch = array_splice($queue, 0, $CONCURRENCY);
            foreach ($batch as $url) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => $TIMEOUT,
                    CURLOPT_CONNECTTIMEOUT => 3,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 2,
                    CURLOPT_USERAGENT => 'idcsmart-cra1-theme',
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => 0,
                ]);
                curl_multi_add_handle($mh, $ch);
                $handles[$url] = $ch;
            }
            // 执行本批
            $running = null;
            do {
                $status = curl_multi_exec($mh, $running);
                if ($running) {
                    curl_multi_select($mh, 0.5);
                }
            } while ($running > 0 && $status === CURLM_OK);

            $retry = [];
            foreach ($handles as $url => $ch) {
                $body = curl_multi_getcontent($ch);
                $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);
                if ($code === 200 && is_string($body) && strlen($body) > 20) {
                    @file_put_contents($pending[$url]['file'], $body);
                    continue;
                }
                // 429（限流）：退避后重试；其余错误（404 等）不重试
                $t = isset($tries[$url]) ? $tries[$url] : 0;
                if ($code === 429 && $t + 1 < $MAX_TRY) {
                    $tries[$url] = $t + 1;
                    $retry[] = $url;
                }
            }
            curl_multi_close($mh);
            if ($retry) {
                usleep(1200000 * (1 + count($retry) > 1 ? 1 : 0));   // 退避 1.2s（多个待重试时 2.4s）
                $queue = array_merge($queue, $retry);                 // 排到队尾，避免立刻再打
            }
            if ($queue) {
                usleep($PAUSE_US);
            }
        }
    }
}
