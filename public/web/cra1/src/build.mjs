import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
if(process.env.CRA1_RELEASE_BUILD!=='1')throw new Error('Use cra1-theme/scripts/build.mjs; direct live builds are disabled.')

const require=createRequire(import.meta.url)
const output=process.env.CRA1_WEB_OUT_DIR
if(!output)throw new Error('Set CRA1_WEB_OUT_DIR to a staging directory.')
fs.mkdirSync(output,{recursive:true})
const target=path.join(output,'app.css')
if(fs.existsSync(target))throw new Error('Refusing to replace a built CSS release.')
// Resolve maintained presentation fragments before Tailwind. Every consumer,
// including the legacy stylesheet URL, receives one complete staged resource.
const source=path.join(path.dirname(new URL(import.meta.url).pathname),'app.css')
const temporary=path.join(output,'.website-source.css')
const expanded=await require('postcss')([require('postcss-import')()]).process(fs.readFileSync(source,'utf8'),{from:source})
// Refinements intentionally follow the base theme, matching their established
// precedence while being built from maintained source rather than old output.
fs.writeFileSync(temporary,expanded.css+'\n'+['scroll-motion.css','page-refinements.css']
  .map(file=>fs.readFileSync(new URL(file,import.meta.url),'utf8')).join('\n'))
let result
try {
  result=spawnSync(process.execPath,[require.resolve('tailwindcss/lib/cli.js'),'-c','tailwind.config.js','-i',temporary,'-o',target,'--minify'],{cwd:path.dirname(new URL(import.meta.url).pathname),stdio:'inherit'})
} finally {
  fs.rmSync(temporary,{force:true})
}
process.exit(result.status??1)
