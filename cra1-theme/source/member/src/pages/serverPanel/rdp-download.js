/** RDP 接口返回文件内容，不能作为导航地址打开。 */
export function saveRdpFile(data, browser = window) {
  if (typeof data?.content !== 'string' || !data.content.trim()) throw new Error('远程桌面文件内容为空，请重试')
  const name = String(data.name || 'remote-desktop.rdp').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g, '_')
  const filename = /\.rdp$/i.test(name) ? name : `${name || 'remote-desktop'}.rdp`
  const url = browser.URL.createObjectURL(new browser.Blob([data.content], { type: 'application/x-rdp' }))
  const link = browser.document.createElement('a')
  link.href = url; link.download = filename
  try {
    browser.document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    browser.setTimeout(() => browser.URL.revokeObjectURL(url), 1000)
  }
  return filename
}
