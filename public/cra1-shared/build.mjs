import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
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
const modules = ['errors.js', 'request.js', 'runtime.js', 'i18n.js', 'payments.js', 'security.js', 'ui.js', 'notification-session.js', 'announcements.js', 'notification-center.js', 'avatar.js', 'header-search.js', 'header-actions.js', 'ambient.js', 'business-icons.js', 'icon-style.js', 'motion.js']
fs.writeFileSync(path.join(output, 'cra1-shared.js'), banner + modules.map(file=>file==='i18n.js'?read(file).replace('__CRA1_TRANSLATIONS__',read('translations.json')):read(file)).join('\n') + '\n' + read('context.js') + '\n' + read('session.js') + '\n' + read('styles.js').replace('__CRA1_LEGACY_CLASSES__',JSON.stringify(JSON.parse(read('aliases.json')))))
fs.writeFileSync(path.join(output, 'announcements-preview.js'), banner + read('ui.js') + '\n' + read('announcements.js'))
// Native fallback templates keep their business UI and need only this small guard.
fs.writeFileSync(path.join(output, 'member-session.js'), banner + read('errors.js') + '\n' + read('request.js') + '\n' + read('context.js') + '\n' + read('session.js'))
const componentCss = read('components.css')
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
