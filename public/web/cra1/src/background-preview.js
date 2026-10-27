(function () {
  'use strict';
  const stage = document.querySelector('#ambient-stage');
  const status = document.querySelector('#ambient-status');
  const hint = document.querySelector('#pointer-hint');
  const motion = document.querySelector('#motion-toggle');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const labels = {
    moving: '光线跟随中', idle: '鼠标停下，动画也会休息', paused: '动态已暂停，保留静态光感',
    touch: '触屏设备 · 使用静态光感', 'reduced-motion': '已尊重减少动效设置 · 使用静态光感',
    hidden: '页面不可见 · 已暂停', offscreen: '背景移出视野 · 已暂停'
  };
  function state(event) { if (labels[event.detail.phase]) status.textContent = labels[event.detail.phase]; }
  stage.addEventListener('cra1ambientstate', state);
  const ambient = window.CRA1Ambient.mount(stage, { instrument: new URLSearchParams(location.search).has('measure') });
  // Exposed only on the standalone preview for reproducible performance checks.
  window.backgroundPreview = ambient;
  let paused = false, pure = false;
  function capability() {
    const staticMode = !fine.matches || reduced.matches;
    motion.disabled = staticMode;
    motion.setAttribute('aria-pressed', String(!staticMode && !paused));
    motion.querySelector('span').textContent = staticMode ? '静态效果' : paused ? '开启动态' : '暂停动态';
    hint.textContent = reduced.matches ? '减少动效已开启，保留安静的光线与层次' : !fine.matches ? '手机展示静态光感，滑动查看完整效果' : '在空白处移动鼠标，光线会跟随你';
  }
  fine.addEventListener('change', capability);
  reduced.addEventListener('change', capability);
  capability();
  document.querySelectorAll('[data-palette-choice]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.paletteChoice;
    ambient.setPalette(value);
    document.body.dataset.palette = value;
    document.querySelectorAll('[data-palette-choice]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelector('meta[name="color-scheme"]').content = value;
  }));
  document.querySelectorAll('button[data-intensity]').forEach(button => button.addEventListener('click', () => {
    ambient.setIntensity(button.dataset.intensity);
    document.querySelectorAll('button[data-intensity]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  motion.addEventListener('click', () => {
    paused = !paused;
    ambient.setPaused(paused);
    capability();
  });
  document.querySelectorAll('[data-pure]').forEach(button => button.addEventListener('click', () => {
    pure = !pure;
    // Move focus before hiding the copy so it never remains on an invisible button.
    if (pure) document.querySelector('.ap-pure-button').focus({ preventScroll: true });
    stage.classList.toggle('is-pure', pure);
    document.querySelectorAll('[data-pure]').forEach(item => item.setAttribute('aria-pressed', String(pure)));
    document.querySelector('.ap-pure-button span').textContent = pure ? '显示文案' : '隐藏文案';
  }));
  window.addEventListener('pagehide', () => ambient.setPaused(true));
  window.addEventListener('pageshow', event => { if (event.persisted) ambient.setPaused(paused); });
})();
