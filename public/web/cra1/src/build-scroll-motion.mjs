import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.env.CRA1_WEB_MOTION_ROOT
const release = process.env.CRA1_WEB_MOTION_RELEASE
const baseRelease = process.env.CRA1_WEB_MOTION_BASE_RELEASE
if (!root || ![release,baseRelease].every(value => value && /^[a-z0-9-]+$/.test(value))) throw new Error('Set a staged CRA1_WEB_MOTION_ROOT, CRA1_WEB_MOTION_RELEASE and CRA1_WEB_MOTION_BASE_RELEASE.')
const output = path.join(root,'releases',release)
if (fs.existsSync(output)) throw new Error('Release exists; choose a new immutable name.')
const base = fs.readFileSync(path.join(root,'releases',baseRelease,'app.css'))
const motion = fs.readFileSync(path.join(root,'src/scroll-motion.css'))
const script = fs.readFileSync(path.join(root,'assets/js/app.js'))
fs.mkdirSync(output,{recursive:true})
fs.writeFileSync(path.join(output,'app.css'),Buffer.concat([base,Buffer.from('\n/* Scroll motion from src/scroll-motion.css. */\n'),motion]))
fs.writeFileSync(path.join(output,'app.js'),script)
const manifest = {release,baseRelease,files:{}}
for (const file of ['app.css','app.js']) {
  const bytes = fs.readFileSync(path.join(output,file))
  manifest.files[file] = {bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}
}
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2))
console.log(JSON.stringify(manifest,null,2))
