/** One theme-owned avatar renderer for all three headers and the member profile.
 * Existing accounts keep their generated avatar until they save a selection.
 * No third-party avatar service, polling or startup avatar config request.
 */
;(function (root, factory) {
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var api = shared.Avatar || factory(root);
  shared.Avatar = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CRA1Avatar = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* 12 组精选色板：同色系深浅过渡，整体中深色调（保证白色首字母对比度） */
  var PALETTES = [
    ['#1D5FD0', '#4FA8FF'], ['#0F56BE', '#1FA2DC'], ['#4F46E5', '#8B7CFF'],
    ['#7C3AED', '#A78BFA'], ['#0E9F6E', '#34C77B'], ['#0D9488', '#2DD4BF'],
    ['#0369A1', '#38BDF8'], ['#C2410C', '#F59E0B'], ['#BE185D', '#EC4899'],
    ['#B91C1C', '#F97316'], ['#1E3A8A', '#2563EB'], ['#047857', '#65A30D']
  ];

  /* 种子 → data URI。放模块级是刻意的：避免在响应式 getter 中写状态 */
  var cache = {}, accounts = {};
  var presets = [
    { id:'titanium', label:'钛灰银', colors:['#555e6b','#c0c6ce'] },
    { id:'graphite', label:'石墨暖灰', colors:['#605b55','#b6ada3'] },
    { id:'champagne', label:'香槟金', colors:['#88734f','#d8c6a2'] },
    { id:'sage', label:'鼠尾草绿', colors:['#547169','#b0c7bd'] },
    { id:'ocean', label:'雾海蓝', colors:['#516a7b','#a8c0cf'] },
    { id:'lavender', label:'烟紫灰', colors:['#70647e','#c4b7d0'] }
  ];
  function idOf(user) { return user && String(user.id != null ? user.id : user.accountId || ''); }
  function selection(user) {
    if (!user) return {mode:'default'};
    var saved=accounts[idOf(user)], own=user.theme_avatar;
    if(user.avatar_preview)return own||{mode:'default'};
    if(saved && (!own || Number(saved.revision)>Number(own.revision||0)))return saved;
    return own||saved||{mode:'default'};
  }
  function register(user) {
    var id=idOf(user), value=user&&user.theme_avatar;
    if(id&&value&&(!accounts[id]||Number(value.revision||0)>=Number(accounts[id].revision||0))) accounts[id]=Object.assign({},value);
  }
  function commit(user, broadcast) {
    register(user);var id=idOf(user);if(!id||!root.dispatchEvent)return;
    root.dispatchEvent(new root.CustomEvent('cra1:avatar-updated',{detail:{id:id,theme_avatar:selection(user)}}));
    if(broadcast===false)return;
    try{root.localStorage.setItem('cra1-avatar-updated',JSON.stringify({id:id,revision:selection(user).revision,time:Date.now()}));}catch(e){}
  }
  if(root.addEventListener)root.addEventListener('storage',function(e){
    if(e.key!=='cra1-avatar-updated'||!e.newValue)return;
    try{var data=JSON.parse(e.newValue);if(/^\d+$/.test(String(data.id)))root.dispatchEvent(new root.CustomEvent('cra1:avatar-refresh',{detail:{id:String(data.id),revision:data.revision}}));}catch(error){}
  });
  function presetUri(id) {
    var p=presets.find(function(x){return x.id===id;});if(!p)return '';
    var key='preset:'+id;if(cache[key])return cache[key];
    var art='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="'+p.colors[0]+'"/><stop offset="1" stop-color="'+p.colors[1]+'"/></linearGradient><radialGradient id="h" cx=".2" cy=".15" r=".9"><stop stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" fill="url(#g)"/><rect width="128" height="128" fill="url(#h)"/><circle cx="64" cy="50" r="21" fill="#fff" fill-opacity=".9"/><path d="M25 117c0-28 15-45 39-45s39 17 39 45" fill="#fff" fill-opacity=".82"/><circle cx="104" cy="22" r="35" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="12"/><path d="M0 23C32-9 70-3 86 0" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/></svg>';
    return cache[key]="url('data:image/svg+xml,"+encodeURIComponent(art)+"')";
  }

  function seedOf(user) {
    if (!user) return '';
    var id = user.id != null ? user.id : (user.accountId != null ? user.accountId : '');
    var name = user.username || user.name || user.email || user.phone || '';
    return String(id) + '|' + name;
  }

  function uri(user) {
    var selected=selection(user);
    if(selected.mode==='preset'&&presetUri(selected.preset))return presetUri(selected.preset);
    if(selected.mode==='upload'&&/^\/upload\/cra1-theme\/avatars\/[a-f0-9]{32}\.webp$/.test(selected.url||''))return "url('"+selected.url+"')";
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
    var chosen=selection(user);
    if(chosen.mode==='preset'&&presetUri(chosen.preset)||chosen.mode==='upload'&&/^\/upload\/cra1-theme\/avatars\/[a-f0-9]{32}\.webp$/.test(chosen.url||''))return '';
    var name = user ? (user.username || user.name || user.email || user.phone || '') : '';
    return String(name || '?').slice(0, 1).toUpperCase();
  }

  return { uri: uri, style: style, letter: letter, presets: presets, register: register, commit: commit };
});
