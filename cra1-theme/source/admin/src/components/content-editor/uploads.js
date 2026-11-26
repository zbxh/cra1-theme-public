import { Extension } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { mediaApi } from '../../lib/api'
import { inlineLinkMarks } from './links'
import { safeLink } from './source'

const uploadKey = new PluginKey('cra1ImageUploads')
let nextUpload = 0

export const uploadAnchors = Extension.create({
  name: 'cra1UploadAnchors',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: uploadKey,
      state: {
        init: () => DecorationSet.empty,
        apply(transaction, current) {
          let anchors = current.map(transaction.mapping, transaction.doc)
          const change = transaction.getMeta(uploadKey)
          if (change?.add) {
            const { position, id } = change.add
            const decoration = Decoration.widget(position, view => {
              const marker = view.dom.ownerDocument.createElement('span')
              marker.className = 'cra1-editor-image-upload'
              marker.textContent = '正在上传图片…'
              return marker
            }, { id, side: -1 })
            anchors = anchors.add(transaction.doc, [decoration])
          }
          if (change?.remove) anchors = anchors.remove(anchors.find(undefined, undefined, item => item.id === change.remove))
          return anchors
        },
      },
      props: { decorations: state => uploadKey.getState(state) },
    })]
  },
})

export function transferredImages(transfer) {
  const images = files => files.filter(file => /^image\//i.test(file.type) || /\.(png|jpe?g|webp|gif|ico)$/i.test(file.name))
  const files = images(Array.from(transfer?.files || []))
  if (files.length) return files
  return images(Array.from(transfer?.items || [])
    .filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean))
}

export async function uploadAt(view, position, files, signal) {
  const id = ++nextUpload
  view.dispatch(view.state.tr.setMeta(uploadKey, { add: { position, id } }))
  const urls = [], errors = []
  for (const file of files) {
    if (signal.aborted || view.isDestroyed) return []
    try {
      const url = await mediaApi.uploadImage(file, { signal })
      if (!safeLink(url, true)) throw new Error('未取得有效的图片地址')
      urls.push(url)
    } catch (error) {
      if (!signal.aborted) errors.push(file.name + '：' + (error.message || '图片上传失败'))
    }
  }
  if (signal.aborted || view.isDestroyed) return []
  const anchor = uploadKey.getState(view.state).find(undefined, undefined, item => item.id === id)[0]
  if (!anchor) return urls.length ? [...errors, '原插入位置已移除，可从图片库重新选择上传的图片'] : errors

  const transaction = view.state.tr.setMeta(uploadKey, { remove: id })
  if (urls.length) {
    const marks = inlineLinkMarks(transaction.doc, anchor.from)
    const images = urls.map(src => view.state.schema.nodes.image.create({ src, alt: '', loading: 'lazy' }, null, marks))
    transaction.replaceRange(anchor.from, anchor.from, new Slice(Fragment.fromArray(images), 0, 0))
    if (!transaction.docChanged) errors.push('此处无法插入图片，可从图片库重新选择上传的图片')
  }
  view.dispatch(transaction)
  return errors
}
