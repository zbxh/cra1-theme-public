import { readStyleTail, styleTail } from './icon-style.js'
/** 把 "a|b|c" 解析为列对象；支持 ! 隐藏前缀与 > 层级前缀（1 个=二级、2 个=三级、3 个=四级） */
export function parseRowLine(line, cols) {
  const hidden = line.startsWith('!');
  let s = hidden ? line.slice(1) : line;
  let level = 1;
  while (s.startsWith('>')) { level++; s = s.slice(1); }
  level = Math.min(level, 4);
  const parts = s.split('|');
  const iconStyles = readStyleTail(parts);
  const row = {};
  if (iconStyles) row.__iconStyles = iconStyles;
  cols.forEach((c, i) => {
    let v = c.remainder ? parts.slice(i).join('|') : (parts[i] ?? '');
    if (c.type === 'checkbox') v = (v === '1' || v === 'true') ? '1' : '';
    row[c.key] = v;
  });
  // 行尾的额外列（旧格式第 4 列常是 0/1 标志位）
  if (!cols.some((c) => c.remainder) && parts.length > cols.length) row.__extra = parts.slice(cols.length).join('|');
  return { row, hidden, child: level > 1, level };
}

export function serializeRowLine(row, hidden, child, cols, level) {
  const parts = cols.map((c) => {
    const v = row[c.key];
    if (c.type === 'checkbox') return v ? '1' : '';
    // 行式存储：分隔符 | 与换行都会破坏一行一记录的格式，统一折成空格。
    // 换行尤其隐蔽——textarea 类列（如商品「描述」）多按一次回车，
    // 该行就会被拆成两行，前台解析随即错位。
    const clean = String(v ?? '').replace(/[\r\n]+/g, ' ');
    return c.remainder ? clean : clean.replace(/\|/g, ' ');
  });
  if (Object.hasOwn(row, '__extra')) parts.push(row.__extra);
  const tail = styleTail(row.__iconStyles);
  if (tail) parts.push(tail);
  // 旧格式固定带第 4 位（多为 0/1），保持原样以免前台解析错位
  // Column count follows the actual runtime contract. Existing extra columns remain intact.
  const depth = Math.min(Math.max(Number(level) || (child ? 2 : 1), 1), 4);
  return (hidden ? '!' : '') + '>'.repeat(depth - 1) + parts.join('|');
}

export function parseRows(text, cols) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseRowLine(l, cols));
}

export function serializeRows(list, cols) {
  return list.map((it) => serializeRowLine(it.row, it.hidden, it.child, cols, it.level)).join('\n');
}

/** Copy schemas use both name/desc and key/text; their physical columns match. */
export function updateCopyText(text, cols, key, value) {
  const identity = cols[0].key, content = cols[1].key;
  const rows = parseRows(text, cols);
  const index = rows.findLastIndex(r => !r.hidden && r.row[identity] === key);
  if (index >= 0) rows[index].row[content] = value;
  else rows.push({ row: { [identity]: key, [content]: value }, hidden: false, level: 1 });
  return serializeRows(rows, cols);
}

