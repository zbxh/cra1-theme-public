export function upgradeOptionValue(option) {
  return option.value ?? option.out_bw
}

/** 老实例档位可能已停售；保留原值只代表保持现状，不新增销售档位。 */
export function preserveCurrentUpgradeOption(options, current) {
  const list = Array.isArray(options) ? options : []
  if (current === '' || current === undefined || current === null) return list
  const exists = list.some(option => {
    if (option.type === 'range' || option.type === 'step') {
      const min = Number(option.min_value ?? option.min)
      const max = Number(option.max_value ?? option.max)
      const step = Math.max(1, Number(option.step) || 1)
      return Number(current) >= min && Number(current) <= max && (Number(current) - min) % step === 0
    }
    return String(upgradeOptionValue(option)) === String(current)
  })
  return exists ? list : [{ type: 'radio', value: current, currentOnly: true }, ...list]
}
