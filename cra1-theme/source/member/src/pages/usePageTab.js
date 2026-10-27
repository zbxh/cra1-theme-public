import { useState, useEffect } from 'react'

/**
 * 把「当前标签」同步到地址栏 ?tab=，并支持浏览器前进后退。
 *
 * 安全中心的四个 URL（security / security_ssh / security_log / security_group）
 * 打开的是同一个页面，只是默认标签不同。用户切换标签后如果地址栏不变，
 * 刷新会跳回默认标签；反过来，不同 URL 之间也需要一个统一的解析口径。
 *
 * 约定：默认标签不写进 URL，保持地址干净；非默认标签写成 ?tab=xxx。
 */
export function usePageTab(defaultTab, validTabs) {
  const read = () => {
    const t = new URLSearchParams(location.search).get('tab')
    return validTabs.includes(t) ? t : validTabs.includes(defaultTab) ? defaultTab : validTabs[0] || ''
  }

  const [tab, setTab] = useState(read)

  useEffect(() => {
    const onPop = () => setTab(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // read 依赖 location.search，每次渲染重建；这里只在挂载时绑定一次即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function change(next) {
    if (!validTabs.includes(next)) return
    setTab(next)
    const url = new URL(location.href)
    if (next === defaultTab) url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    // replaceState：标签切换不应该产生一堆历史记录
    window.history.replaceState({}, '', url)
  }

  return [validTabs.includes(tab) ? tab : read(), change]
}
