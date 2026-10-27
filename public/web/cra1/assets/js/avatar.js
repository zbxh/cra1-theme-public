/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
/**
 * 本地生成的头像 —— 官网与会员中心共用的唯一实现
 *
 * 为什么需要一个共享文件：
 *   系统没有头像字段（idcsmart_client 无相关列，/console/v1/account 也不返回头像），
 *   因此头像由前端本地生成（零外部请求，不依赖 Gravatar 等服务）。
 *   官网是 Alpine、会员中心是 Vue/React，若各自实现一份必然漂移，
 *   所以算法只此一份，两端都加载本文件。
 *
 * 用法（三种上下文都一样）：
 *   CRA1Avatar.uri(user)      → "url('data:image/svg+xml,...')"  供 CSS background-image
 *   CRA1Avatar.style(user)    → { backgroundImage, backgroundSize, backgroundPosition }
 *   CRA1Avatar.letter(user)   → 'Z'  首字母（叠在渐变之上）
 *
 * 设计（改动前请读）：
 *   1. 确定性：种子 = 账号ID + '|' + 用户名，做 FNV-1a 哈希 —— 同一账号恒得同一张，
 *      刷新页面不会换脸。取数前再混一次（xorshift 风格），避免相邻取值相关。
 *   2. 色板为 12 组同色系深浅过渡、整体中深色调 —— 任意两组都协调，且白字对比度足够。
 *   3. 只叠加「提亮方向」的柔光，**不可加深色光斑**：64px 看着有层次，但 28px 下会糊成污渍。
 *   4. 首字母不嵌进 SVG，由 CSS 文本渲染叠在背景上：小尺寸更清晰，也能直接复用两端字体样式。
 *   5. url() 必须用**单引号**包裹：该值会被写进 HTML 的 style 属性，双引号会截断属性。
 *   6. 缓存放在模块级对象（非响应式）：两端框架若在 getter 里写响应式状态会触发依赖循环。
 */
;(function (root, factory) {
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var api = shared.Avatar || factory();
  shared.Avatar = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CRA1Avatar = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 12 组精选色板：同色系深浅过渡，整体中深色调（保证白色首字母对比度） */
  var PALETTES = [
    ['#1D5FD0', '#4FA8FF'], ['#0F56BE', '#1FA2DC'], ['#4F46E5', '#8B7CFF'],
    ['#7C3AED', '#A78BFA'], ['#0E9F6E', '#34C77B'], ['#0D9488', '#2DD4BF'],
    ['#0369A1', '#38BDF8'], ['#C2410C', '#F59E0B'], ['#BE185D', '#EC4899'],
    ['#B91C1C', '#F97316'], ['#1E3A8A', '#2563EB'], ['#047857', '#65A30D']
  ];

  /* 种子 → data URI。放模块级是刻意的：避免在响应式 getter 中写状态 */
  var cache = {};

  function seedOf(user) {
    if (!user) return '';
    var id = user.id != null ? user.id : (user.accountId != null ? user.accountId : '');
    var name = user.username || user.name || user.email || user.phone || '';
    return String(id) + '|' + name;
  }

  function uri(user) {
    var seed = seedOf(user);
    if (!seed || seed === '|') return '';
    if (cache[seed]) return cache[seed];

    /* FNV-1a：短字符串上分布均匀，实现只有几行 */
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
    }
    /* 取数前再混一次，避免相邻取值相关 */
    var next = function (n) {
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
      return h % n;
    };

    var p = PALETTES[next(PALETTES.length)];

    /* 斜向渐变角度随哈希在 35°~145° 之间变化，让每张的光感朝向不同 */
    var ang = ((35 + next(110)) * Math.PI) / 180;
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var f = function (v) { return v.toFixed(3); };

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
      + '<defs>'
      + '<linearGradient id="g" x1="' + f(0.5 - dx / 2) + '" y1="' + f(0.5 - dy / 2) + '"'
      + ' x2="' + f(0.5 + dx / 2) + '" y2="' + f(0.5 + dy / 2) + '">'
      + '<stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient>'
      /* 左上柔光：只提亮、不变暗，小尺寸下保持干净 */
      + '<radialGradient id="hl" cx=".26" cy=".2" r=".85">'
      + '<stop offset="0" stop-color="#fff" stop-opacity=".3"/>'
      + '<stop offset="55%" stop-color="#fff" stop-opacity=".08"/>'
      + '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '</defs>'
      + '<rect width="64" height="64" fill="url(#g)"/>'
      + '<rect width="64" height="64" fill="url(#hl)"/>'
      + '</svg>';

    /* 单引号包裹：该值会写进 HTML 的 style 属性，双引号会截断属性 */
    cache[seed] = "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
    return cache[seed];
  }

  /** CSS background 样式（同一张 64×64 经 cover 适配任意尺寸） */
  function style(user) {
    var u = uri(user);
    return u
      ? { backgroundImage: u, backgroundSize: 'cover', backgroundPosition: 'center' }
      : {};
  }

  /** 首字母：始终显示，叠在生成头像的渐变之上（渐变只作底，字母是识别主体） */
  function letter(user) {
    var name = user ? (user.username || user.name || user.email || user.phone || '') : '';
    return String(name || '?').slice(0, 1).toUpperCase();
  }

  return { uri: uri, style: style, letter: letter };
});
