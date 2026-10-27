import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@ui/button'
import { Input, Select } from '@ui/input'
import { MenuSelect } from '@ui/select'
import { ICON_PRESETS, customStyle, iconStyleVars } from '@/lib/icon-style'
import { iconCatalog, iconPage, iconSearch, onlineSearch, onlinePreviews, importIcon, resolveIcon, peekIcon, peekIconCatalog, peekIconPage, uniqueIcons } from '@/lib/icon-client'
import './icon-picker.css'

const clone = value => value ? JSON.parse(JSON.stringify(value)) : null
const ignoreAbort = error => error.name === 'AbortError'
const tone = text => /财务|支付|账单|订单|费用|余额|周期|finance|wallet|price/i.test(text) ? 'finance' : /安全|客服|工单|支持|文档|security|shield|support/i.test(text) ? 'security' : /合作|奖励|partner|gift/i.test(text) ? 'gold' : 'compute'
function Glyph({ icon, onLoad, onError, allowExternal=false }) {
  if(icon?.external && !allowExternal)return <span className="ip-no-glyph">外链</span>
  if (icon?.svg) return <span className={'ip-glyph'+(icon.colorable ? '' : ' ip-glyph-original')+(icon.id?.startsWith('default:cart:') ? ' ip-glyph-cart-default' : '')} dangerouslySetInnerHTML={{ __html: icon.svg }} />
  if (icon?.url) return <img className="ip-glyph" src={icon.url} alt="" onLoad={onLoad} onError={onError} decoding="async" />
  return <span className="ip-no-glyph">{icon?.isDefault ? '默认' : icon ? '不可用' : '加载中'}</span>
}
function Preview({ icon, style, tile, label, onLoad, onError, allowExternal }) {
  return <span className={'ip-preview-icon'+(tile ? ' ip-tile' : '')} data-tone={tone(label)} data-manual={style ? 'true' : undefined} style={iconStyleVars(style, tile)}><Glyph icon={icon} onLoad={onLoad} onError={onError} allowExternal={allowExternal}/></span>
}
function Colour({ label, value, onChange }) {
  const [raw, setRaw] = useState(value)
  useEffect(() => setRaw(value), [value])
  return <label className="ip-colour"><span>{label}</span><div><input aria-label={label+'取色'} type="color" value={value} onChange={e => onChange(e.target.value)} /><Input aria-label={label} value={raw} maxLength={7} onChange={e => { setRaw(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase()) }} onBlur={() => setRaw(value)} /></div></label>
}
export default function IconPicker({ value = '', onChange, label = '图标', iconStyle = null, context = 'website', defaultKey = '', defaultPreview = '', tile = true, styledSelect = false }) {
  const Choice = styledSelect ? MenuSelect : Select
  const dialogRef=useRef(), dialogId=useId(), hadOpen=useRef(false)
  const [current, setCurrent] = useState(() => peekIcon(value, context, defaultKey)), [currentError, setCurrentError] = useState('')
  const [open, setOpen] = useState(false), [tab, setTab] = useState('icons'), [bodyReady, setBodyReady] = useState(false)
  const [draftValue, setDraftValue] = useState(value), [draftStyle, setDraftStyle] = useState(clone(iconStyle)), [selected, setSelected] = useState(current)
  const [category, setCategory] = useState('builtin'), [catalog, setCatalog] = useState(peekIconCatalog())
  const [pageData, setPageData] = useState(null), [icons, setIcons] = useState([]), [loading, setLoading] = useState(false), [paging, setPaging] = useState(false)
  const [query, setQuery] = useState(''), [composing, setComposing] = useState(false), [error, setError] = useState(''), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0)
  const [manual, setManual] = useState(''), [applying, setApplying] = useState(false), [manualBusy, setManualBusy] = useState(false), [externalLoaded, setExternalLoaded] = useState(false), [externalApproved,setExternalApproved]=useState(false)
  const [online, setOnline] = useState([]), [onlineBusy, setOnlineBusy] = useState(false), [onlineError, setOnlineError] = useState('')
  const loadSequence = useRef(0), pageController = useRef(), validationController = useRef(), onlineController = useRef(), applyController = useRef(), scrollArea = useRef(), trigger = useRef()
  const categoryFor = d => d?.category && d.category !== 'custom' ? d.category : String(value).replace(/^iconify:/, '').split(':')[0] || 'builtin'
  useLayoutEffect(() => {
    const element=dialogRef.current
    if(open && element && !element.open){element.showModal();element.querySelector('[aria-label="搜索图标"]')?.focus({preventScroll:true});hadOpen.current=true}
    else if(!open && element?.open){element.close();if(hadOpen.current)trigger.current?.focus({preventScroll:true})}
  },[open])
  useEffect(() => {
    if (!open || bodyReady) return
    // Paint the stable frame before mounting cold library controls. Requests
    // start immediately in the loading effect and warm reopen needs no delay.
    let second=0
    const first=requestAnimationFrame(() => { second=requestAnimationFrame(() => setBodyReady(true)) })
    return () => { cancelAnimationFrame(first);cancelAnimationFrame(second) }
  },[open,bodyReady])
  useEffect(() => {
    if(open && bodyReady)dialogRef.current?.querySelector('[aria-label="搜索图标"]')?.focus({preventScroll:true})
  },[open,bodyReady])
  useEffect(() => {
    const controller = new AbortController()
    setCurrentError('')
    resolveIcon(value, context, defaultKey, controller.signal).then(d => { setCurrent(d) }).catch(e => { if (!ignoreAbort(e)) setCurrentError(e.message) })
    return () => controller.abort()
  }, [value, context, defaultKey])
  useEffect(() => () => { pageController.current?.abort(); validationController.current?.abort(); onlineController.current?.abort() }, [])
  const changeOpen = next => {
    if (next) {
      const d = peekIcon(value, context, defaultKey) || current
      setSelected(d); setDraftValue(value); setDraftStyle(clone(iconStyle)); setManual(value); setExternalLoaded(!d?.external);setExternalApproved(false)
      setBodyReady(!!peekIconCatalog())
      const c = categoryFor(d), valid = peekIconCatalog()?.categories?.some(it => it.key === c)
      const nextCategory = valid || !peekIconCatalog() ? c : 'builtin', cached = peekIconPage(nextCategory)
      setIcons(cached?.icons || []); setPageData(cached || null); setLoading(!cached); setLoadError(''); setCatalog(peekIconCatalog());
      setCategory(nextCategory); setTab('icons'); setQuery(''); setComposing(false); setError(''); setOnline([]); setOnlineError(''); setOnlineBusy(false); setManualBusy(false); setApplying(false)
    } else { loadSequence.current++; pageController.current?.abort(); validationController.current?.abort(); onlineController.current?.abort(); applyController.current?.abort() }
    setOpen(next)
  }
  useEffect(() => {
    if (!open) return
    const controller = new AbortController(), seq = ++loadSequence.current
    pageController.current?.abort(); pageController.current = controller
    setPaging(false); setOnline([]); setOnlineError(''); setOnlineBusy(false); onlineController.current?.abort()
    const q = query.trim()
    if (composing) return () => controller.abort()
    const cached = !q && peekIconPage(category)
    if (cached) { setIcons(cached.icons); setPageData(cached); setLoading(false); setLoadError(''); return () => controller.abort() }
    else { setIcons([]); setPageData(null); setLoading(true); setLoadError('') }
    const load = async () => {
      try {
        const cat = await iconCatalog(category, controller.signal)
        if (seq !== loadSequence.current || controller.signal.aborted) return
        setCatalog(cat)
        const valid = cat.categories.some(it => it.key === category)
        if (!valid && !q) { setCategory('builtin'); return }
        const data = q ? await iconSearch(q, controller.signal, category) : await iconPage(category, 0, controller.signal)
        if (seq !== loadSequence.current || controller.signal.aborted) return
        setIcons(uniqueIcons(data.icons || [])); setPageData(q ? null : data); setLoading(false)
      } catch (e) { if (seq === loadSequence.current && !ignoreAbort(e)) { setLoading(false); setLoadError(e.message) } }
    }
    const timer = q ? setTimeout(load, 200) : null
    if (!q) load()
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, category, query, composing, retry])
  async function more() {
    if (paging || !pageData?.hasMore) return
    const seq = loadSequence.current, prefix = category
    setPaging(true)
    try {
      const data = await iconPage(prefix, pageData.nextPage, pageController.current.signal)
      if (seq !== loadSequence.current) return
      setIcons(old => uniqueIcons([...old, ...data.icons])); setPageData(data)
    } catch (e) { if (seq === loadSequence.current && !ignoreAbort(e)) setLoadError(e.message) }
    finally { if (seq === loadSequence.current) setPaging(false) }
  }
  function pick(it, nextValue = it.id) {
    if (!it.available) return
    if(context==='member-quick'&&it.category==='builtin'&&!nextValue.startsWith('default:'))nextValue='builtin:'+nextValue
    setDraftValue(nextValue); setManual(nextValue); setSelected(it); setExternalLoaded(!it.external);setExternalApproved(false); setError('')
  }
  async function checkManual() {
    validationController.current?.abort(); const controller = new AbortController(); validationController.current = controller
    setManualBusy(true); setError('')
    try {
      const v = manual.trim(), d = await resolveIcon(v, context, defaultKey, controller.signal)
      if (!d.available && v) { setError('无法识别或图标文件不可用，请选择本地图标。历史原值仍会保留。'); return }
      pick({ ...d, available: true }, v)
    } catch (e) { if (!ignoreAbort(e)) setError(e.message) }
    finally { if (!controller.signal.aborted) setManualBusy(false) }
  }
  async function apply() {
    if (applying || manualBusy) return
    if (manual.trim() !== draftValue) { setError('名称或地址尚未确认，请先点击“检查并预览”。'); setTab('icons'); return }
    if (draftValue && draftValue !== value && (!selected?.available || (selected.external && !externalLoaded))) { setError('请先确认图标预览可以正常显示。'); return }
    setApplying(true)
    const seq=loadSequence.current,controller=new AbortController();applyController.current=controller
    try {
      if (selected?.candidate) { const d = await importIcon(draftValue,controller.signal); if(seq!==loadSequence.current)return; setSelected(d); if(draftValue===value)setCurrent(d) }
      if(seq!==loadSequence.current || controller.signal.aborted)return
      if(draftValue!==value || JSON.stringify(draftStyle||null)!==JSON.stringify(iconStyle||null))onChange(draftValue, clone(draftStyle))
      changeOpen(false)
    } catch (e) { if(!ignoreAbort(e))setError(e.message) }
    finally { if(!controller.signal.aborted)setApplying(false) }
  }
  async function searchOnline() {
    if (!query.trim() || onlineBusy) return
    onlineController.current?.abort(); const controller = new AbortController(); onlineController.current = controller
    setOnlineBusy(true); setOnlineError(''); setOnline([])
    try { const data = await onlineSearch(query.trim(), controller.signal); if (!controller.signal.aborted) setOnline(data.icons || []) }
    catch (e) { if (!ignoreAbort(e)) setOnlineError(e.message) }
    finally { if (!controller.signal.aborted) setOnlineBusy(false) }
  }
  const onlineIds = online.map(it => it.id).join('|')
  useEffect(() => {
    if (!open || !onlineIds || !scrollArea.current) return
    const controller = onlineController.current, pending = [], seen = new Set()
    let busy = false
    const download = async () => {
      if (busy || controller?.signal.aborted) return
      busy = true
      while (pending.length && !controller?.signal.aborted) {
        const ids = pending.splice(0, 4)
        try {
          const data = await onlinePreviews(ids, controller?.signal)
          if (!controller?.signal.aborted) setOnline(old => old.map(it => data.icons.find(d => d.id === it.id) || it))
        } catch (e) { if (!ignoreAbort(e)) { setOnlineError(e.message); break } }
      }
      busy = false
    }
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        const id = e.target.getAttribute('data-online-id')
        if (!seen.has(id)) { seen.add(id); pending.push(id) }
        observer.unobserve(e.target)
      }
      download()
    }, { root: scrollArea.current, rootMargin: '40px' })
    scrollArea.current.querySelectorAll('[data-online-id]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [open, onlineIds])
  function keyboardGrid(e) {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return
    const buttons = [...e.currentTarget.querySelectorAll('[data-icon-cell]')], at = buttons.indexOf(document.activeElement)
    if (at < 0) return
    const cols = buttons.filter(b => Math.abs(b.offsetTop - buttons[0].offsetTop) < 2).length || 1
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : at + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -cols : cols)
    e.preventDefault(); buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus()
  }
  useEffect(() => { if(open && !query) document.querySelector('.ip-categories button[aria-pressed="true"]')?.scrollIntoView({block:'nearest'}) }, [open,category,catalog,query])
  const cell = (it, isOnline = false) => <li key={it.id} data-online-id={isOnline ? it.id : undefined}><button type="button" data-icon-cell aria-label={'选择 '+it.label} aria-pressed={it.id === selected?.id} aria-disabled={!it.available} className={'ip-cell'+(it.id === selected?.id ? ' is-selected' : '')} onClick={() => pick(it)}><Glyph icon={it}/><span className="ip-cell-name">{it.label}</span><span className="ip-full-name" role="tooltip">{it.label}{it.source?` · ${it.source}`:''}</span></button></li>
  const preview = current || (defaultPreview && !value ? { url: defaultPreview, available: true, label: '默认图标' } : null)
  const custom = draftStyle?.mode === 'custom' ? draftStyle : customStyle(draftStyle?.preset)
  const setCustom = patch => setDraftStyle({ ...custom, ...patch })
  const setBg = patch => setCustom({ background: {from:'#edf0f3',to:'#c9ced4',angle:145,opacity:100,...custom.background, ...patch } })
  const modes = [['theme','跟随主题'],['preset','预设'],['custom','自定义']]
  const mode = draftStyle?.mode || 'theme'
  const styleEditable = tile || selected?.colorable
  const panels = { icons: dialogId+'-icons', style: dialogId+'-style' }
  const tabs = { icons: dialogId+'-icons-tab', style: dialogId+'-style-tab' }
  function tabKey(e) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return
    e.preventDefault()
    const next = e.key === 'Home' ? 'icons' : e.key === 'End' ? 'style' : tab === 'icons' ? 'style' : 'icons'
    setTab(next); dialogRef.current?.querySelector('#'+CSS.escape(tabs[next]))?.focus()
  }
  const canApply = !applying && !manualBusy && (!draftValue || draftValue === value || (selected?.available && (!selected.external || externalLoaded)))
  return <div className="ip-field" data-icon-picker={label}>
    <div className="ip-field-line"><Preview icon={preview} style={iconStyle} tile={tile} label={label}/><div className="ip-field-copy"><strong title={value || preview?.label}>{preview?.label || (value ? value : '当前位置默认图形')}</strong><small>{currentError || preview?.source || (value ? '正在解析…' : '使用默认图标')}{iconStyle ? ' · 自定义配色' : ''}</small></div><Button ref={trigger} type="button" aria-label={'选择'+label} variant="outline" size="sm" onClick={() => changeOpen(true)}>选择图标</Button></div>
    {current && value && !current.available && <p className="ip-history-warning">历史图标当前不可用，原值已保留。可以重新选择图标。</p>}
    <dialog ref={dialogRef} className="ip-dialog" aria-labelledby={dialogId+'-title'} aria-describedby={dialogId+'-description'} style={{ width:'min(94vw, 960px)', maxWidth:'none', height:'min(88dvh, 800px)', maxHeight:'88dvh', padding:0 }} onCancel={e=>{e.preventDefault();if(!dialogRef.current?.querySelector('.admin-menu-select__popup'))changeOpen(false)}} onClose={()=>{if(open)changeOpen(false)}} onKeyDownCapture={e=>{if(e.key==='Escape'&&!e.target.closest('.admin-menu-select__popup')){e.preventDefault();e.stopPropagation();changeOpen(false)}}} onClick={e=>{if(e.target===dialogRef.current){const r=dialogRef.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)changeOpen(false)}}}>
      {open && <><button type="button" className="ip-close" aria-label="关闭图标设置" onClick={()=>changeOpen(false)}>×</button>
      <div className="ip-heading"><div><h2 id={dialogId+'-title'}>{label.replace(/图标$/, '')} · 图标设置</h2></div><div className="ip-tabs" role="tablist" aria-label="图标设置" onKeyDown={tabKey}><button type="button" role="tab" id={tabs.icons} tabIndex={tab==='icons'?0:-1} aria-selected={tab==='icons'} aria-controls={panels.icons} onClick={() => setTab('icons')}>选择图标</button><button type="button" role="tab" id={tabs.style} tabIndex={tab==='style'?0:-1} aria-selected={tab==='style'} aria-controls={panels.style} onClick={() => setTab('style')}>{tile?'颜色与背景':'颜色'}</button></div></div>
      <div className="ip-body">
        {!bodyReady ? <div className="ip-state" role="status">正在加载本地图标…</div> : tab === 'icons' ? <div id={panels.icons} role="tabpanel" aria-labelledby={tabs.icons} className="ip-icon-panel">
          <aside className="ip-categories" aria-label="图标分类">{catalog?.categories?.map(c => <button key={c.key} type="button" aria-pressed={category===c.key} onClick={() => { const data=peekIconPage(c.key);setIcons(data?.icons||[]);setPageData(data||null);setLoading(!data);setCategory(c.key); setQuery('') }}><span>{c.label}</span><small>{c.total}</small></button>) || <span className="ip-loading">加载分类…</span>}</aside>
          <section className="ip-library"><div className="ip-search"><Choice {...(styledSelect ? { portalContainer: dialogRef.current } : {})} className="ip-mobile-category" aria-label="图标分类" value={category} onChange={e => { setCategory(e.target.value); setQuery('') }}>{catalog?.categories?.map(c => <option value={c.key} key={c.key}>{c.label} · {c.total}</option>)}</Choice><Input aria-label="搜索图标" value={query} placeholder="搜索：服务器、安全、客服…" onCompositionStart={() => setComposing(true)} onCompositionEnd={e => { setComposing(false);setLoading(!!e.currentTarget.value.trim()); setQuery(e.currentTarget.value) }} onChange={e => {setLoading(!!e.target.value.trim());setQuery(e.target.value)}}/><Button type="button" variant="outline" size="sm" disabled={!query.trim()||composing||onlineBusy} onClick={searchOnline}>{onlineBusy?'查询中…':'在线搜索'}</Button></div>
            <div className="ip-library-top"><span>{query ? '本地搜索结果' : catalog?.categories?.find(c => c.key === category)?.label || '本地图标'}</span><span>{loading?'':pageData?`${icons.length} / ${pageData.total}`:`${icons.length} 个`}</span></div>
            <div className="ip-scroll" ref={scrollArea} aria-busy={loading}>
              {loading ? <div className="ip-state" role="status">正在加载本地图标…</div> : loadError && !icons.length ? <div className="ip-state" role="alert"><p>{loadError}</p><Button type="button" variant="outline" size="sm" onClick={() => setRetry(v => v+1)}>重新加载</Button></div> : !icons.length ? <div className="ip-state">没有匹配的本地图标，可以换一个名称或点击在线搜索。</div> : <ul className="ip-grid" aria-label="本地图标" onKeyDown={keyboardGrid}>{icons.map(it => cell(it))}</ul>}
              {pageData?.hasMore && <div className="ip-load-more"><Button type="button" variant="outline" size="sm" disabled={paging} onClick={more}>{paging?'加载中…':'加载更多'}</Button></div>}
              {!!online.length && <><h4 className="ip-online-heading">在线图标</h4><ul className="ip-grid" aria-label="在线图标" onKeyDown={keyboardGrid}>{online.map(it => cell(it, true))}</ul></>}
              {onlineError && <p className="ip-history-warning" role="alert">{onlineError}</p>}
              {loadError && icons.length > 0 && <p role="alert" className="ip-history-warning">{loadError} <button type="button" onClick={more}>重试加载</button></p>}
            </div>
            <details className="ip-manual"><summary>使用名称或图片地址</summary><div><Input aria-label="图标名称或地址" value={manual} placeholder="lucide:server 或 /upload/example.svg" onChange={e => setManual(e.target.value)}/><Button type="button" variant="outline" size="sm" disabled={manualBusy} onClick={checkManual}>{manualBusy?'检查中…':'检查并预览'}</Button></div></details>
          </section>
        </div> : <div id={panels.style} role="tabpanel" aria-labelledby={tabs.style} className="ip-style-panel">
          {styleEditable ? <>
          <div className="ip-mode" aria-label="配色方式">{modes.map(([key,text]) => <button type="button" aria-pressed={mode===key} key={key} onClick={() => setDraftStyle(key==='theme'?null:key==='preset'?{v:1,mode:'preset',preset:draftStyle?.preset||'titanium'}:custom)}>{text}</button>)}</div>
          {mode==='theme' && <p className="ip-style-note">使用页面主题的默认配色。</p>}
          {mode==='preset' && <div className="ip-presets">{Object.entries(ICON_PRESETS).map(([key,p]) => <button type="button" className="ip-preset" aria-label={'使用'+p.label} aria-describedby={dialogId+'-preset-'+key} aria-pressed={draftStyle.preset===key} key={key} style={{'--ip-preset-ink':p.foreground,'--ip-preset-from':p.from,'--ip-preset-to':p.to}} onClick={() => setDraftStyle({v:1,mode:'preset',preset:key})}>
            <span className="ip-preset-scene" aria-hidden="true"><Preview icon={selected} style={{v:1,mode:'preset',preset:key}} tile={tile} label={label}/><span className="ip-preset-check">✓</span></span>
            <span className="ip-preset-copy"><strong>{p.label}</strong><span className="ip-preset-swatches" aria-hidden="true">{selected?.colorable && <i style={{background:p.foreground}}/>}{tile && <><i style={{background:p.from}}/><i style={{background:p.to}}/></>}</span></span>
            <span className="ip-preset-details" id={dialogId+'-preset-'+key} role="tooltip">{selected?.colorable?`前景 ${p.foreground}`:'图标保留原色'}{tile?` · 背景 ${p.from} → ${p.to}`:''}</span>
          </button>)}</div>}
          {mode==='custom' && <div className="ip-custom">{selected?.colorable && <Colour label="图标前景色" value={custom.foreground} onChange={foreground => setCustom({foreground})}/>} {tile && <><label className="ip-bg-kind">底框背景<Select aria-label="底框背景" value={custom.background.kind} onChange={e => setBg({kind:e.target.value})}><option value="transparent">透明</option><option value="solid">纯色</option><option value="gradient">双色渐变</option></Select></label>{custom.background.kind!=='transparent' && <div className="ip-background-settings"><Colour label={custom.background.kind==='gradient'?'渐变起始色':'背景颜色'} value={custom.background.from || '#edf0f3'} onChange={from => setBg({from})}/>{custom.background.kind==='gradient' && <Colour label="渐变结束色" value={custom.background.to || '#c9ced4'} onChange={to => setBg({to})}/>}<label>背景不透明度 · {custom.background.opacity??100}%<input aria-label="背景不透明度" type="range" min="0" max="100" value={custom.background.opacity??100} onChange={e => setBg({opacity:Number(e.target.value)})}/></label>{custom.background.kind==='gradient' && <label>渐变方向 · {custom.background.angle??145}°<input aria-label="渐变方向" type="range" min="0" max="360" value={custom.background.angle??145} onChange={e => setBg({angle:Number(e.target.value)})}/></label>}</div>}</>}</div>}
          </> : <div className="ip-state">此图标保留原色。{draftStyle && <Button type="button" variant="outline" size="sm" onClick={() => setDraftStyle(null)}>恢复默认样式</Button>}</div>}
        </div>}
      </div>
      <div className="ip-preview-strip"><div className="ip-selected-copy"><strong title={selected?.label || draftValue}>{selected?.label || (draftValue ? draftValue : '默认图标')}</strong><small>{selected?.source || '当前位置默认图形'}{selected && !selected.colorable?' · 保留原色':!tile?' · 仅前景色':''}</small>{selected?.external && !externalApproved && <button type="button" className="ip-external-preview" onClick={()=>setExternalApproved(true)}>在线预览外链</button>}</div><div className="ip-samples"><div className="ip-sample-light"><Preview icon={selected} style={draftStyle} tile={tile} label={label} allowExternal={externalApproved} onLoad={() => setExternalLoaded(true)} onError={() => { setExternalLoaded(false); setError('图片预览加载失败，原值仍保留。') }}/><span>浅色</span></div><div className="ip-sample-dark"><Preview icon={selected} style={draftStyle} tile={tile} label={label} allowExternal={externalApproved}/><span>深色</span></div></div><Button type="button" variant="ghost" size="sm" onClick={async () => { setDraftValue(''); setManual(''); setExternalLoaded(true); setSelected(await resolveIcon('',context,defaultKey)) }}>恢复默认图标</Button></div>
      <div className="ip-footer"><span className="ip-save-note" id={dialogId+'-description'}>应用后需保存页面</span>{error && <p role="alert">{error}</p>}<div><Button type="button" variant="outline" onClick={() => changeOpen(false)}>取消</Button><Button type="button" className="ip-apply" disabled={!canApply} onClick={apply}>{applying?'应用中…':'应用'}</Button></div></div>
      </>}
    </dialog>
  </div>
}
