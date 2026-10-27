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
const result=spawnSync(process.execPath,[require.resolve('tailwindcss/lib/cli.js'),'-c','tailwind.config.js','-i','app.css','-o',target,'--minify'],{cwd:path.dirname(new URL(import.meta.url).pathname),stdio:'inherit'})
process.exit(result.status??1)
