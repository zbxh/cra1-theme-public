import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import postcss from 'postcss'

if(process.env.CRA1_RELEASE_BUILD!=='1')throw new Error('Use cra1-theme/scripts/build.mjs; direct live builds are disabled.')

const root = process.env.CRA1_SHARED_ROOT
if (!root) throw new Error('Set CRA1_SHARED_ROOT to the staging public/cra1-shared directory.')
const release = process.env.CRA1_SHARED_RELEASE
if (!release || !/^[a-z0-9-]+$/.test(release)) throw new Error('Set CRA1_SHARED_RELEASE to a new immutable release name.')
if (fs.existsSync(path.join(root, 'releases', release))) throw new Error('Release already exists; use a new name.')
const output = path.join(root, 'releases', release)
fs.mkdirSync(output, { recursive: true })
const read = file => fs.readFileSync(path.join(root, 'src', file), 'utf8')
const banner = '/* Generated from public/cra1-shared/src. Edit the source and rebuild. */\n'
// Scope the one component sheet. The legacy class registry is embedded in the
// runtime, so Vue/Element hosts use these declarations without duplicate skins.
function components(css) {
  const tree=postcss.parse(css)
  tree.walkRules(rule=>{
    if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return
    if(!rule.selector.includes('.cui-'))return
    rule.selector=rule.selectors.map(selector=>'html[data-cra1-theme] '+selector).join(', ')
  })
  return tree.toString()
}
const member=new URL('../../cra1-theme/source/member/',import.meta.url)
const hash=createRequire(new URL('package.json',member))('esbuild').buildSync({entryPoints:[new URL('src/lib/checkout-hash.js',member).pathname],bundle:true,format:'iife',write:false,minify:true,legalComments:'inline'}).outputFiles[0].text
const modules = ['errors.js', 'request.js', 'runtime.js', 'i18n.js', 'payments.js', 'checkout.js', 'security.js', 'ui.js', 'notification-session.js', 'announcements.js', 'notification-center.js', 'avatar.js', 'header-search.js', 'header-actions.js', 'ambient.js', 'business-icons.js', 'icon-style.js', 'motion.js']
fs.writeFileSync(path.join(output, 'cra1-shared.js'), banner + modules.map(file=>file==='i18n.js'?read(file).replace('__CRA1_TRANSLATIONS__',read('translations.json')):file==='checkout.js'?hash+'\n'+read(file):read(file)).join('\n') + '\n' + read('context.js') + '\n' + read('session.js') + '\n' + read('styles.js').replace('__CRA1_LEGACY_CLASSES__',JSON.stringify(JSON.parse(read('aliases.json')))))
fs.writeFileSync(path.join(output, 'announcements-preview.js'), banner + read('ui.js') + '\n' + read('announcements.js'))
// Native fallback templates keep their business UI and need only this small guard.
fs.writeFileSync(path.join(output, 'member-session.js'), banner + read('errors.js') + '\n' + read('request.js') + '\n' + read('context.js') + '\n' + read('session.js'))
// Standalone third-party carts keep installed V10 business scripts, Axios,
// jQuery, rem scaling and component loading. Only navigation uses this bundle.
const navigationModules = ['errors.js', 'request.js', 'context.js', 'runtime.js', 'ui.js', 'notification-session.js', 'announcements.js', 'avatar.js', 'header-search.js', 'header-actions.js', 'icon-style.js', 'native-cart-context.js']
fs.writeFileSync(path.join(output, 'native-cart-navigation.js'), banner + navigationModules.map(read).join('\n'))
// Derive the shell from the same maintained navigation styles, never the
// member/module layout overrides. Filter each selector, including mixed rules.
const navigationClass = /^cra1-(?:header(?:__|--|-|$)|breadcrumb(?:__|$)|aside(?:__|\.|$)|primary-(?:item|separator)|nav-(?:l2|l3|group|recent|sub)|recent-flow|msg-(?:panel|item)|lang(?:__|$)|account(?:__|--|$)|upanel(?:__|--|$)|panel-grid)/
const navigationShell = postcss.parse(fs.readFileSync(new URL('theme-sources/member/cra1-shell.css', import.meta.url), 'utf8'))
navigationShell.walkComments(comment => comment.remove())
navigationShell.walkRules(rule => {
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
  const selectors = rule.selectors.filter(selector => {
    if (selector === ':root') return true
    const classes = [...selector.matchAll(/\.(cra1-[\w-]+)/g)].map(match => match[1])
    return classes.length > 0 && classes.every(name => navigationClass.test(name))
  })
  if (!selectors.length) rule.remove()
  else rule.selector = selectors.map(selector => selector === ':root' ? 'html[data-cra1-native-cart]' : 'html[data-cra1-native-cart] ' + selector).join(', ')
})
navigationShell.walkAtRules(rule => {
  if (/keyframes$/.test(rule.name) && !rule.params.startsWith('cra1-')) rule.remove()
  else if (rule.nodes && !rule.nodes.length) rule.remove()
})
function navigationCss(css, scope = '') {
  const tree = postcss.parse(css)
  tree.walkComments(comment => comment.remove())
  tree.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
    rule.selector = rule.selectors.map(selector => {
      if (selector === ':root') return 'html[data-cra1-native-cart]'
      if (!scope && /^html\b/.test(selector)) return selector.replace(/^html\b/, 'html[data-cra1-native-cart]')
      return 'html[data-cra1-native-cart] ' + scope + selector
    }).join(', ')
  })
  return tree.toString()
}
const navigationRoots = ':where(.cra1-header,.cra1-aside,.cra1-notices-host,.cra1-notice-reader,.cra1-header-search__results) '
fs.writeFileSync(path.join(output, 'native-cart-navigation.css'), banner + read('tokens.css') + '\n' + navigationShell.toString() + '\n'
  + navigationCss(read('components.css'), navigationRoots) + '\n'
  + ['announcements.css', 'header-search.css', 'user-panel.css', 'header-support.css', 'header-actions.css'].map(file => navigationCss(read(file))).join('\n') + '\n'
  + read('native-cart.css'))
const componentCss = read('components.css')
// The independent admin login needs the palette without front-end components.
fs.writeFileSync(path.join(output, 'tokens.css'), banner + read('tokens.css'))
fs.writeFileSync(path.join(output, 'cra1-shared.css'), banner + components(read('tokens.css')) + '\n' + components(componentCss) + '\n' + ['security.css', 'announcements.css', 'header-search.css', 'user-panel.css', 'header-support.css', 'adapters.css', 'nav-auth.css', 'business-icons.css', 'motion.css', 'header-actions.css'].map(read).join('\n'))
fs.writeFileSync(path.join(output, 'v10-axios.js'), banner + read('v10-axios.js'))
// Legacy compatibility files and releases remain immutable. New templates load
// the bundle above; preserving the old URIs also protects the fixed preview.
const manifest = { version: '1.1.0', release, files: {} }
for (const file of fs.readdirSync(output).filter(file => /\.(js|css)$/.test(file))) {
  const bytes = fs.readFileSync(path.join(output, file))
  manifest.files[file] = { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest, null, 2))
