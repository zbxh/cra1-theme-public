/**
 * 云产品限制规则引擎 —— 从插件共享库
 * public/plugins/server/mf_cloud/template/clientarea/common/js/limit_rule.js
 * 忠实移植为 ES 模块（原版为 window.mfCloudLimitRule 全局，React 页无法依赖）。
 *
 * 语义：limit_rule 是「条件 → 结果可选值」的规则数组。当规则的条件字段
 * （rule.rule: data_center/line/cpu/memory/image/bw/flow/peak_defence/ipv4_num/system_disk）
 * 全部匹配当前选择（params）时，其结果（rule.result[resultKey]）给出该维度
 * 允许的值集合（opt=eq 列表/区间，neq 取补）；多条命中规则取交集；
 * 交集为空视为无限制（strictEmpty=false）。
 */

function toArray(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

function firstFilled(...args) {
  for (const v of args) {
    if (v !== undefined && v !== null && v !== '') return v
  }
  return ''
}

function normalizeForCompare(value, stringMode) {
  if (stringMode) return String(value)
  const num = Number(value)
  return Number.isNaN(num) ? String(value) : num
}

function contains(values, value, stringMode) {
  const cmp = normalizeForCompare(value, stringMode)
  return toArray(values).some((item) => normalizeForCompare(item, stringMode) === cmp)
}

function unique(values, stringMode) {
  const exists = {}
  return toArray(values).filter((item) => {
    const key = normalizeForCompare(item, stringMode)
    if (exists[key]) return false
    exists[key] = true
    return true
  })
}

function rangeMatches(rule, value) {
  const current = Number(value)
  if (Number.isNaN(current)) return false
  const min = rule.min === '' || rule.min === undefined ? 0 : Number(rule.min)
  const max = rule.max === '' || rule.max === undefined ? 99999999 : Number(rule.max)
  const matched = current >= min && current <= max
  return rule.opt === 'neq' ? !matched : matched
}

function listMatches(rule, values, value, stringMode) {
  const matched = contains(values, value, stringMode)
  return rule.opt === 'neq' ? !matched : matched
}

function matchField(field, rule, params) {
  switch (field) {
    case 'data_center':
      return listMatches(rule, rule.id, params.data_center_id, false)
    case 'line':
      return listMatches(rule, rule.id, params.line_id, false)
    case 'cpu':
      return listMatches(rule, rule.value, params.cpu, false)
    case 'memory':
      if (Array.isArray(rule.value)) {
        return listMatches(rule, rule.value, params.memory, false)
      }
      return rangeMatches(rule, params.memory)
    case 'image':
      return listMatches(rule, rule.id, params.image_id, false)
    case 'peak_defence':
      return listMatches(rule, rule.value, params.peak_defence, true)
    case 'ipv4_num':
      return rangeMatches(rule, firstFilled(params.ipv4_num, params.ip_num))
    case 'bw':
      if (params.line_type && params.line_type !== 'bw') return false
      return rangeMatches(rule, params.bw)
    case 'flow':
      if (params.line_type && params.line_type !== 'flow') return false
      return rangeMatches(rule, params.flow)
    case 'system_disk':
      return rangeMatches(rule, (params.system_disk || {}).size)
    default:
      return false
  }
}

function matchRule(rule, params, ignoreFields = []) {
  const fields = Object.keys(rule || {})
  if (fields.length === 0) return true
  return fields.every((field) => {
    if (ignoreFields.indexOf(field) !== -1) return true
    return matchField(field, rule[field], params || {})
  })
}

function resultValues(resultItem, field, allValues, stringMode) {
  if (resultItem.min !== undefined || resultItem.max !== undefined) {
    const min = resultItem.min === '' || resultItem.min === undefined ? 0 : Number(resultItem.min)
    const max = resultItem.max === '' || resultItem.max === undefined ? 99999999 : Number(resultItem.max)
    const rangeValues = allValues.filter((value) => {
      const num = Number(value)
      return !Number.isNaN(num) && num >= min && num <= max
    })
    if (resultItem.opt === 'neq') {
      return allValues.filter((value) => !contains(rangeValues, value, stringMode))
    }
    return rangeValues
  }
  let values = resultItem[field]
  if (values === undefined) {
    values = resultItem.value !== undefined ? resultItem.value : resultItem.id
  }
  values = unique(values, stringMode)
  if (resultItem.opt === 'neq') {
    return allValues.filter((value) => !contains(values, value, stringMode))
  }
  return values
}

function intersect(left, right, stringMode) {
  return left.filter((value) => contains(right, value, stringMode))
}

/**
 * 按结果维度过滤可选项。
 * @param {Array} rules 限制规则（config.limit_rule）
 * @param {string} resultKey 结果维度（cpu/memory/bw/flow/peak_defence/ipv4_num/ipv6_num...）
 * @param {Array} items 候选项 [{value,...}] 或 [{id,...}]
 * @param {object} options {field, params, ignoreRuleFields, strictEmpty}
 * @returns {{items: Array, restricted: boolean}}
 */
export function filterItemsByResultWithMeta(rules, resultKey, items, options = {}) {
  items = items || []
  const field = options.field || (resultKey === 'line' ? 'id' : 'value')
  const stringMode = resultKey === 'peak_defence' || field === 'value'
  const allValues = unique(
    options.allValues || items.map((item) => item[field]),
    stringMode
  )
  const params = options.params || {}
  const matchedRules = (rules || []).filter(
    (rule) => rule.result && rule.result[resultKey] && matchRule(rule.rule || {}, params, options.ignoreRuleFields || [])
  )
  if (matchedRules.length === 0) {
    return { items, restricted: false }
  }
  let allowed = null
  matchedRules.forEach((rule) => {
    let union = []
    toArray(rule.result[resultKey]).forEach((resultItem) => {
      union = union.concat(resultValues(resultItem, field, allValues, stringMode))
    })
    union = unique(union, stringMode)
    allowed = allowed === null ? union : intersect(allowed, union, stringMode)
  })
  allowed = allowed || []
  if (allowed.length === 0 && options.strictEmpty === false) {
    return { items, restricted: false }
  }
  return {
    items: items.filter((item) => contains(allowed, item[field], stringMode)),
    restricted: true,
  }
}

/** 便捷版：只返回过滤后的 items */
export function filterItemsByResult(rules, resultKey, items, options) {
  return filterItemsByResultWithMeta(rules, resultKey, items, options).items
}
