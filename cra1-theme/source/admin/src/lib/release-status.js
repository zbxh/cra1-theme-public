export function releaseStatus(check) {
  if (!check) return '正在检查…'
  if (check.counts?.blocked) return '发现需要处理的问题，请查看下方具体项目。'
  const files=check.overview?.files
  if (files?.unverified) return '部分主题文件与安装清单存在差异，请先核对文件明细。'
  if (check.counts?.unverified) return '未发现阻断问题，部分兼容记录待核验；待核验不表示页面已发生故障。'
  return '环境与主题文件检查通过。'
}
