import { ArrowUpRight, ArrowLeft, Check, Layers3 } from 'lucide-react'
import { useState } from 'react'
import { commonData, stripHtml } from '../lib'
import { AnnouncementSlot } from '../ui/announcement-slot'
import defaults from '../../../../backend/Storage/auth-pages.defaults.json'

/** Shared presentation for native account flows; authentication stays in CredentialForm. */
export function RegisterAuthLayout({ title, subtitle, children, kind }) {
  const [lightLogo, setLightLogo] = useState('')
  const runtime = window.__CRA1_RUNTIME__ || {}, common = commonData()
  const page = kind || (runtime.page === 'regist' ? 'regist' : 'login')
  const d = defaults[page], configured = runtime.auth_appearance || {}
  const cfg = { ...d, ...configured, brand: { ...d.brand, ...configured.brand }, support: { ...d.support, ...configured.support } }
  const name = common.website_name || window.__CRA1_PAGE__?.website_name || '会员中心'
  const logo = cfg.logo || common.system_logo, brand = Number(cfg.brand.enabled) === 1
  const pageLabel = { login: '登录', regist: '注册', forget: '找回密码', oauth: '关联账户' }[runtime.page] || (page === 'regist' ? '注册' : '登录')
  function measureLogo(event) {
    // A same-site white logo needs a dark backing on this light layout. Sample a
    // tiny bitmap once; external images remain untouched if canvas is restricted.
    const img = event.currentTarget
    try {
      const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 32
      const ctx = canvas.getContext('2d', {willReadFrequently: true}); ctx.drawImage(img, 0, 0, 96, 32)
      const data = ctx.getImageData(0, 0, 96, 32).data; let visible = 0, light = 0
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 100) {visible++; if (Math.min(data[i], data[i + 1], data[i + 2]) > 210) light++}
      setLightLogo(visible > 0 && light / visible > .8 ? logo : '')
    } catch { setLightLogo('') }
  }
  return <div className={'cra1-auth-page' + (brand ? '' : ' cra1-auth-page--centered')}>
    <header className="cra1-auth-header">
      <div className="cra1-auth-header-brand">
      <a className="cra1-auth-logo" href="/" aria-label={`${name}，返回首页`}>
        {logo ? <span className={'cra1-auth-logo-image' + (lightLogo === logo ? ' cra1-auth-logo-image--light' : '')}><img src={logo} alt={name} onLoad={measureLogo} /></span> : <span className="cra1-auth-monogram">{Array.from(name)[0]}</span>}
        {!logo && <span>{name}</span>}
      </a>
      <span className="cra1-auth-page-label">{pageLabel}</span>
      </div>
      <nav aria-label="账户页面导航">
        <a href="/" className="cra1-auth-home"><ArrowLeft aria-hidden="true" />返回首页</a>
        {Number(cfg.support.enabled) === 1 && cfg.support.url && <a href={cfg.support.url}>{cfg.support.label || '联系支持'}<ArrowUpRight aria-hidden="true" /></a>}
      </nav>
    </header>
    <AnnouncementSlot className="cra1-auth-notices" />
    <main className="cra1-auth-main">
      {brand && <section className="cra1-auth-brand" aria-label="产品与服务介绍">
        {cfg.brand.label && <p className="cra1-auth-eyebrow"><span aria-hidden="true" />{cfg.brand.label}</p>}
        {cfg.brand.title && <h2>{cfg.brand.title}</h2>}
        {cfg.brand.description && <p className="cra1-auth-brand-description">{cfg.brand.description}</p>}
        {cfg.brand.image ? <img className="cra1-auth-brand-image" src={cfg.brand.image} alt="" /> : <div className="cra1-auth-art" aria-hidden="true">
          <div className="cra1-auth-orbit" /><div className="cra1-auth-platform" />
          <div className="cra1-auth-layer cra1-auth-layer--back"><i /><i /><i /></div>
          <div className="cra1-auth-layer cra1-auth-layer--front"><Layers3 data-cui-icon-style="plain" data-cui-icon-tone="gold" /><span /><i /></div>
          <span className="cra1-auth-node cra1-auth-node--one" /><span className="cra1-auth-node cra1-auth-node--two" />
        </div>}
        <ul className="cra1-auth-highlights">{(cfg.brand.items || []).filter(item => Number(item.enabled) !== 0).map(item => <li key={item.id}><span className="cra1-auth-check"><Check aria-hidden="true" /></span><div>{item.title && <h3>{item.title}</h3>}{item.description && <p>{item.description}</p>}</div></li>)}</ul>
      </section>}
      <section className="cra1-auth-panel" aria-labelledby="auth-heading">
        <div className="cra1-auth-panel-heading"><h1 id="auth-heading">{title ?? (cfg.title || d.title)}</h1>{(subtitle ?? cfg.description) && <p>{subtitle ?? cfg.description}</p>}</div>
        {children}
      </section>
    </main>
    <footer className="cra1-auth-footer">{cfg.footer || stripHtml(common.copyright_info) || `© ${new Date().getFullYear()} ${name}`}</footer>
  </div>
}
