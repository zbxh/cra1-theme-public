import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const outputDirectory = process.env.CRA1ADMIN_OUT_DIR
if (!outputDirectory) throw new Error('请指定 CRA1ADMIN_OUT_DIR 到暂存目录；构建不直接覆盖正式资源。')
if (path.resolve(outputDirectory).startsWith(path.resolve(process.cwd(), '../../../public') + path.sep)) throw new Error('请先构建到暂存目录，再发布版本化资源。')

/** Build into an explicit staging directory; immutable release paths handle cache identity. */
if (process.env.CRA1_RELEASE_BUILD !== '1') throw new Error('Use cra1-theme/scripts/build.mjs with a new staging directory.')

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      // 后台独立的 shadcn 风格组件
      '@ui': path.resolve(process.cwd(), 'src/components/ui'),
      // 固定 React 解析路径，避免跨目录依赖出现多个实例。
      // 显式把 react/react-dom 钉到本工程的副本，保证单实例。
      react: path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(process.cwd(), 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(process.cwd(), 'node_modules/react/jsx-dev-runtime.js'),
      'react-dom/client': path.resolve(process.cwd(), 'node_modules/react-dom/client.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: outputDirectory,
    // Preserve any unrelated files in the staging directory.
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'src/main.jsx'),
      output: {
        entryFileNames: 'admin.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'admin[extname]',
      },
    },
  },
})
