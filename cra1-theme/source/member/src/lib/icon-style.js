export const ICON_PRESETS = {
  titanium: { label: '钛灰银', foreground: '#555d67', from: '#edf0f3', to: '#c9ced4' },
  graphite: { label: '石墨暖灰', foreground: '#625c55', from: '#eeeae5', to: '#d1c9bf' },
  champagne: { label: '香槟金', foreground: '#896d46', from: '#f5efe4', to: '#dacfbb' },
  compute: { label: '计算蓝', foreground: '#3562a4', from: '#ffffff', to: '#e5eefb' },
  security: { label: '安全绿', foreground: '#19786b', from: '#ffffff', to: '#e2f3ed' },
  finance: { label: '财务金', foreground: '#986221', from: '#ffffff', to: '#faf0d9' },
  gold: { label: '业务金', foreground: '#896437', from: '#ffffff', to: '#f4ebdb' },
}
export const customStyle = (preset = 'titanium') => {
  const p = ICON_PRESETS[preset] || ICON_PRESETS.titanium
  return { v: 1, mode: 'custom', foreground: p.foreground, background: { kind: 'gradient', from: p.from, to: p.to, opacity: 100, angle: 145 } }
}
export function iconStyleVars(style, tile = true) {
  if (!style || style.mode === 'theme') return {}
  const p = ICON_PRESETS[style.preset]
  const s = style.mode === 'preset' && p ? customStyle(style.preset) : style
  if (!/^#[0-9a-f]{6}$/i.test(s.foreground || '')) return {}
  const ink = style.mode === 'preset' ? `var(--cui-icon-${style.preset},${s.foreground})` : s.foreground
  const vars = { '--cui-icon-ink': ink, '--cui-icon-manual-ink': ink }
  const bg = s.background || { kind: 'transparent' }
  if (tile) {
    vars['--cui-icon-background'] = style.mode === 'preset' ? `linear-gradient(145deg,var(--cui-icon-surface,${p.from}),var(--cui-icon-${style.preset}-fill,${p.to}))` : bg.kind === 'transparent' ? 'transparent' : bg.kind === 'solid' ? bg.from : `linear-gradient(${bg.angle}deg,${bg.from},${bg.to})`
    vars['--cui-icon-background-opacity'] = (bg.opacity ?? 100) / 100
    if (bg.kind === 'transparent') vars['--cui-icon-halo-opacity'] = 0
  }
  return vars
}
