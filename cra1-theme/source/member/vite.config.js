import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

/**
 * 构建配置：会员中心 酷锐A1主题
 *
 * 产物只输出到统一构建入口指定的暂存目录，再以不可变资源目录发布。
 * entry 文件名固定，公共 chunk 带内容校验标识。
 * 入口自动发现：src/entries/*.jsx → assets/js/<name>.js，
 * 新增页面只需放入入口文件，无需改本配置。
 */
const entriesDir = path.resolve(process.cwd(), 'src/entries')

const input = Object.fromEntries(
  fs
    .readdirSync(entriesDir)
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => [f.replace(/\.jsx$/, ''), path.resolve(entriesDir, f)])
)

if (process.env.CRA1_RELEASE_BUILD !== '1') throw new Error('Use cra1-theme/scripts/build.mjs with a new staging directory.')

export default defineConfig({
  base: './',
  plugins: [react({babel:{plugins:['./i18n-transform.cjs']}}), tailwindcss()],
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  build: {
    outDir: process.env.CRA1_MEMBER_OUT_DIR || (() => { throw new Error('请指定 CRA1_MEMBER_OUT_DIR 到暂存目录'); })(),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input,
      output: {
        // entry 固定名：PHP 模板直接引用，缓存失效靠 ?v=filemtime。
        // 共享 chunk 加 hash：chunk 的 import URL 不带 ?v=，若也用固定名，
        // 重建后浏览器会继续用旧 chunk（Nginx 对 js/css 缓存 12h），
        // 出现「新 entry + 旧 chunk」的错配。
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/chunks/[name]-[hash].js',
        assetFileNames: 'css/[name][extname]',
        // 大体量第三方库独立分包：业务代码频繁改动时不使其缓存失效
        // （recharts/framer-motion 变更频率远低于页面代码，gzip 合计约 100KB）
        manualChunks: {
          'vendor-recharts': ['recharts'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
})
