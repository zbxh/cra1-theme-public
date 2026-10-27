import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import CryptoJS from 'crypto-js'
import { request } from './shared'
import { formatCurrency } from './lib/currency.js'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/* ==========================================================================
   请求层
   契约与系统 utils/request.js 保持一致：
     baseURL=/console/v1、withCredentials、Authorization: Bearer <jwt>
     响应统一为 { status, msg, data }，status=200 为成功
   系统页的 JWT 存在 localStorage.jwt（登录页写入），登录态由 Vue 外壳维护。
   ========================================================================== */
export function api(path, { method = 'GET', body, params, signal, timeout } = {}) {
  return request(path, { method, body, params, signal, timeout, unauthorized: 'redirect' }).catch(error => { if (window.CRA1Shared?.Runtime) error.message = window.CRA1Shared.Runtime.error(error); throw error })
}

export const get = (path, params) => api(path, { params })
export const post = (path, body) => api(path, { method: 'POST', body })
export const put = (path, body) => api(path, { method: 'PUT', body })
export const del = (path, body) => api(path, { method: 'DELETE', body })

/* ==========================================================================
   密码加密
   与系统 login.js 的 encrypt() 完全一致（AES-128-CBC，key/iv 相同、密文格式相同）。

   必须用 crypto-js 而非 WebCrypto：crypto.subtle 只在「安全上下文」
   （HTTPS / localhost）下存在，本站在 HTTP 下部署时它是 undefined，
   会导致登录等提交直接报错。
   ========================================================================== */
export function encryptPassword(plain) {
  const key = CryptoJS.enc.Utf8.parse('idcsmart.finance')
  const iv = CryptoJS.enc.Utf8.parse('9311019310287172')
  return CryptoJS.AES.encrypt(plain, key, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
    iv,
  }).toString()
}

/* ==========================================================================
   工具
   ========================================================================== */

/** 时间戳（秒或毫秒）→ YYYY-MM-DD */
export function formatDate(ts) {
  if (!ts) return '—'
  const n = Number(ts)
  if (!n) return String(ts)
  const d = new Date(n > 1e12 ? n : n * 1000)
  if (isNaN(d.getTime())) return String(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 时间戳 → YYYY-MM-DD HH:mm */
export function formatDateTime(ts) {
  if (!ts) return '—'
  const n = Number(ts)
  if (!n) return String(ts)
  const d = new Date(n > 1e12 ? n : n * 1000)
  if (isNaN(d.getTime())) return String(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 系统币种金额（原生两位精度；保留显式前缀的兼容调用）。 */
export function formatMoney(v, prefix) {
  const cfg = commonData()
  return formatCurrency(v, prefix === undefined ? cfg : { currency_prefix: prefix ?? cfg.currency_prefix, currency_suffix: '' })
}

/* 余额流水类型 → 中文。后端 cc.type 是英文枚举（写入点分布在
   ClientCreditModel / OrderModel / 提现插件等），接口不翻译，
   前端统一在此映射；未收录的值原样展示，不吞新类型。 */
const CREDIT_TYPE = {
  Recharge: '充值',
  Applied: '余额支付',
  Refund: '退款',
  Artificial: '人工调整',
  Freeze: '冻结',
  Unfreeze: '解冻',
  Withdraw: '提现',
}
export function creditTypeText(t) {
  return window.CRA1Shared?.I18n?.t(CREDIT_TYPE[t]) || CREDIT_TYPE[t] || t || '—'
}

/* 订单类型 → 中文。值域来自 OrderModel::createOrder 文档 + 系统内实际写入点
   （'recharge'/'combine' 等），文案以官方 default 主题
   template/pc/default/js/finance.js orderTypeObj 为准。 */
export const ORDER_TYPE = {
  new: '新购',
  renew: '续费',
  upgrade: '升降级',
  artificial: '人工',
  recharge: '充值',
  combine: '合并订单',
  credit_limit: '还款订单',
  on_demand: '按需续费',
  change_billing_cycle: '按需转包年包月',
}
export function orderTypeText(t) {
  return window.CRA1Shared?.I18n?.t(ORDER_TYPE[t]) || ORDER_TYPE[t] || t || '—'
}

/** 去掉 HTML 标签（用于列表里的富文本摘要） */
export function stripHtml(html) {
  if (!html) return ''
  return String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/** 截断文本 */
export function truncate(s, len = 60) {
  if (!s) return ''
  return s.length > len ? s.slice(0, len) + '…' : s
}

/** 读取服务端注入的页面数据（各页面 PHP 会输出 window.__CRA1_PAGE__） */
export function pageData() {
  return window.__CRA1_PAGE__ || {}
}

/** 读取系统缓存的公共配置（外壳与登录页都会写入） */
export function commonData() {
  try {
    return window.CRA1Shared?.Runtime?.common() || window.__CRA1_RUNTIME__?.common || JSON.parse(localStorage.getItem('common_set_before') || '{}')
  } catch {
    return {}
  }
}

/* ==========================================================================
   会员中心主题公开快照（member.sidebar.snapshot）
   --------------------------------------------------------------------------
   内容：侧栏菜单投影 + appearance + content（页面文案/公告，服务端已清理 HTML）。
   用途方：Vue 外壳（asideMenu 侧栏 / topMenu 置顶公告）与 React 内容页
   （首页轮播、产品列表顶部文案）。

   去重：两边都要这份快照，通过 window 上的共享 Promise 保证只发一次请求；
   谁先拿到就写入 __CRA1_MEMBER_SNAPSHOT__ 并广播 cloud:member-content，
   晚启动的一方直接复用。后台目录用 header.php 注入的动态 slug，不写死。
   ========================================================================== */

export function adminSlug(){return ""}

export function memberSnapshot() {
  if (window.__CRA1_MEMBER_SNAPSHOT__) return Promise.resolve(window.__CRA1_MEMBER_SNAPSHOT__)
  if (window.__CRA1_MEMBER_SNAPSHOT_PROMISE__) return window.__CRA1_MEMBER_SNAPSHOT_PROMISE__

  window.__CRA1_MEMBER_SNAPSHOT_PROMISE__ = fetch(
    '/cra1-shared/snapshot.php?domain=member',
    { credentials: 'omit' }
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const snap = j && j.status === 200 && j.data ? j.data : null
      if (snap) {
        window.__CRA1_MEMBER_SNAPSHOT__ = snap
        try {
          window.dispatchEvent(new CustomEvent('cra1:member-content', { detail: snap }))
        } catch (e) { /* 事件不可用时忽略 */ }
      }
      return snap
    })
    .catch(() => null)
  return window.__CRA1_MEMBER_SNAPSHOT_PROMISE__
}

/**
 * 读取 content 段（页面文案），缺段时返回与后端 defaults 同形状的空配置。
 * 快照不可用（后台未配置/改名/不可达）时返回 null，调用方按「未配置」处理。
 */
export async function memberContentConfig() {
  const snap = await memberSnapshot()
  if (!snap) return null
  const c = snap.content || {}
  return {
    product_list: {
      default: { enabled: 0, title: '', description: '', html: '', ...(c.product_list?.default || {}) },
      overrides: c.product_list?.overrides || {},
    },
    // 首页快捷入口（后台「内容设置 → 首页快捷入口」按条编辑）
    home_quick_links: {
      enabled: 0, items: [],
      ...(c.home_quick_links || {}),
    },
    // 首页「到期续费待办」卡（enabled/title/days 天数窗口/limit 条数）
    home_todo: {
      enabled: 0, title: '续费待办', days: 30, limit: 5,
      ...(c.home_todo || {}),
    },
    // 首页「推荐位」图文卡（enabled/items≤3：title/description/link/image）
    home_banner: {
      enabled: 0, items: [],
      ...(c.home_banner || {}),
    },
    // 首页「公告时间轴」（enabled/type_id=0 全部分类/limit）
    home_news: {
      enabled: 0, type_id: 0, limit: 6,
      ...(c.home_news || {}),
    },
    // 首页「账户安全概览」（enabled/items：certification/phone/email/profile 参与评分开关）
    home_security: {
      enabled: 0, items: { certification: 1, phone: 1, email: 1, profile: 1 },
      ...(c.home_security || {}),
    },
    // 服务器面板「订单记录」标签页（enabled 开关 / fetch_page 单次条数 / fetch_max 拉取上限）
    host_orders: {
      enabled: 0, fetch_page: 100, fetch_max: 1000,
      ...(c.host_orders || {}),
    },
  }
}

/* ==========================================================================
   财务功能特征位（充值 / 提现入口显隐的唯一判定源）
   --------------------------------------------------------------------------
   判定数据来自主题后台快照的 features 段（cra1admin/index.php 只读投影：
   recharge_open/min/max、提现规则 status、充值实名要求——实名开关等客户端
   API 拿不到的配置都在这里）；快照缺段（旧版本）时退回接口探测。
   实现在 Vue 外壳的 asideMenu.js（window.__cra1FeatureFlags，双端共享
   window.__CRA1_FEAT__ 缓存）；此处为 React 侧的响应式薄封装。
   ========================================================================== */
export function featureFlags() {
  if (window.__CRA1_FEAT__) return window.__CRA1_FEAT__
  if (window.__cra1FeatureFlags) {
    window.__CRA1_FEAT__ = { recharge_open: 0, withdraw_open: 0, ready: false }
    const flag = window.__CRA1_FEAT__
    window.__cra1FeatureFlags().then((f) => {
      flag.recharge_open = f.recharge_open
      flag.withdraw_open = f.withdraw_open
      flag.recharge_min = f.recharge_min || ''
      flag.recharge_max = f.recharge_max || ''
      flag.certification = f.certification || null
      flag.ready = true
      try {
        window.dispatchEvent(new CustomEvent('cra1:feature-flags'))
      } catch (e) { /* 事件不可用时忽略 */ }
    })
    return flag
  }
  /* 独立页兜底（理论上仅外壳页用到特征位，防御式自给） */
  window.__CRA1_FEAT__ = {
    recharge_open: 0, withdraw_open: 0, ready: true,
  }
  return window.__CRA1_FEAT__
}

/** 等特征位就绪（Promise 形态，供首屏渲染前 await） */
export function featureFlagsReady() {
  return new Promise((resolve) => {
    const flag = featureFlags()
    if (flag.ready) return resolve(flag)
    window.addEventListener('cra1:feature-flags', function fn() {
      window.removeEventListener('cra1:feature-flags', fn)
      resolve(flag)
    })
  })
}

export function pluginLink(name,view,params='') {
 const base=window.__CRA1_RUNTIME__?.links?.[name];if(!base)return '';
 const path=view?base.slice(0,base.lastIndexOf('/')+1)+view:base;return path+(params?(path.includes('?')?'&':'?')+params:'')
}
