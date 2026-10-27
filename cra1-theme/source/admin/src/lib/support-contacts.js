export const contactTypes = [
  { id:'link', name:'网页链接', hint:'选择站内页面，或填写完整网址', icon:'link' },
  { id:'text', name:'仅显示文字', hint:'不跳转，也不复制', icon:'message' },
  { id:'phone', name:'电话', hint:'例如 400-000-0000；分机可使用 x123', icon:'phone' },
  { id:'email', name:'邮箱', hint:'例如 support@example.com', icon:'mail' },
  { id:'qq', name:'QQ', hint:'填写 QQ 号码，自动生成咨询链接', icon:'qq' },
  { id:'wechat', name:'微信', hint:'填写微信号，访客点击后复制账号', icon:'wechat' },
  { id:'telegram', name:'Telegram', hint:'填写用户名，可以带 @', icon:'link' },
  { id:'whatsapp', name:'WhatsApp', hint:'填写带国家或地区编号的手机号，例如 +8613800000000', icon:'phone' },
  { id:'x', name:'X / Twitter', hint:'填写用户名，可以带 @', icon:'link' },
  { id:'instagram', name:'Instagram', hint:'填写用户名，可以带 @', icon:'link' },
  { id:'weibo', name:'微博', hint:'填写用户 UID；如有主页链接，请选择“网页链接”', icon:'link' },
  { id:'account', name:'其他社交账号', hint:'填写账号，访客点击后复制；也可指定主页链接', icon:'message' },
]
export const supportId = () => 'support-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10))
export const parseSupport = value => {
  const doc = JSON.parse(value || '{"schema":1,"enabled":true,"groups":[]}')
  if (doc.schema !== 1 || !Array.isArray(doc.groups)) throw new Error('客服信息格式不正确，请重新读取')
  return doc
}
export const emptyContact = () => ({ id:supportId(), text:'', icon:'link', type:'link', value:'', url:'', showText:true, showIcon:true, enabled:true, newWindow:true })
/** Adapt the existing contact document to the same tree editor used by menus. */
export const supportToTree = doc => doc.groups.map(group => ({
  id: group.id, kind: 'group', group,
  children: group.items.map(item => ({ id: item.id, kind: 'contact', item, children: [] })),
}))
export function supportFromTree(doc, tree) {
  const ids = new Set()
  const identity = node => {
    if (!node.id || ids.has(node.id)) throw new Error('客服分组或条目标识重复，请重新读取')
    ids.add(node.id)
  }
  const groups = tree.map(node => {
    identity(node)
    if (node.kind !== 'group' || node.group?.id !== node.id) throw new Error('客服条目必须放在分组内')
    const items = (node.children || []).map(child => {
      identity(child)
      if (child.kind !== 'contact' || child.item?.id !== child.id || child.children?.length) throw new Error('客服信息只支持分组和条目两级')
      return child.item
    })
    return { ...node.group, items }
  })
  return { ...doc, groups }
}
export function supportDropPositions(moving, target) {
  if (!moving || !target) return []
  if (moving.kind === 'group') return target.kind === 'group' ? ['before', 'after'] : []
  return target.kind === 'group' ? ['inside'] : ['before', 'after']
}
export function contactPreview(item) {
  if (item.url) return item.url
  const v = String(item.value || '').trim(), account = v.replace(/^@/, '')
  switch (item.type) {
    case 'phone': { const [phone, ext] = v.split(/[xX]/); return 'tel:'+phone.replace(/[^\d+]/g,'')+(ext?';ext='+ext:'') }
    case 'email': { const at=v.lastIndexOf('@'); return 'mailto:'+encodeURIComponent(v.slice(0,at))+'@'+v.slice(at+1) }
    case 'qq': return 'https://wpa.qq.com/msgrd?v=3&uin='+encodeURIComponent(v)+'&site=qq&menu=yes'
    case 'telegram': return 'https://t.me/'+encodeURIComponent(account)
    case 'whatsapp': return 'https://wa.me/'+v.replace(/\D/g,'')
    case 'x': return 'https://x.com/'+encodeURIComponent(account)
    case 'instagram': return 'https://www.instagram.com/'+encodeURIComponent(account)+'/'
    case 'weibo': return 'https://weibo.com/u/'+encodeURIComponent(v)
    case 'wechat': case 'account': return '点击复制：'+v
    default: return '仅显示，不执行操作'
  }
}
export function contactError(item) {
  if (!item.showText && !item.showIcon) return '至少要显示文字或图标'
  if (!String(item.text||'').trim() && !String(item.value||'').trim()) return '请填写显示文字或联系方式'
  if (item.type === 'link' && !String(item.url||'').trim()) return '请选择或填写跳转链接'
  if (item.url && (/[\x00-\x20\\]/.test(item.url) || !/^(https?:\/\/|\/(?!\/)|#|tel:|mailto:)/i.test(item.url))) return '请填写站内地址或完整的网址'
  if (!['text','link'].includes(item.type) && !String(item.value||'').trim()) return '请填写联系方式或账号'
  if (item.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.value)) return '请填写有效的邮箱地址'
  return ''
}
