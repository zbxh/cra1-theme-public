import { useRef } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, CircleAlert, Clock3,
  Highlighter, ImagePlus, Info, Italic, Layers, Link2, List, ListOrdered, Minus, Plus, Quote,
  Redo2, RemoveFormatting, Shapes, SquareSplitVertical, Table2, TriangleAlert, Underline, Undo2,
} from 'lucide-react'
import { Button } from '@ui/button'
import { Input, Select } from '@ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@ui/dropdown-menu'
import { calloutLabels } from './nodes'

const marks = [['bold', '加粗', Bold], ['italic', '斜体', Italic], ['underline', '下划线', Underline]]
const blocks = [['bulletList', '项目列表', List], ['orderedList', '数字列表', ListOrdered], ['blockquote', '引用', Quote]]

const alignments = [
  ['left', '左对齐', AlignLeft], ['center', '居中对齐', AlignCenter],
  ['right', '右对齐', AlignRight], ['justify', '两端对齐', AlignJustify],
]
const highlights = [
  ['#fff0a3', '黄色高亮'], ['#d8f3df', '绿色高亮'], ['#d9edff', '蓝色高亮'], ['#ffe2eb', '粉色高亮'],
]
const tableActions = [
  ['row', '在下方添加行'], ['column', '在右侧添加列'],
  ['removeRow', '删除所选行'], ['removeColumn', '删除所选列'], ['removeTable', '删除表格'],
]

function iconColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value || '')) return value
  if (/^#[0-9a-f]{3}$/i.test(value || '')) return '#' + [...value.slice(1)].map(digit => digit + digit).join('')
  const rgb = value?.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/i)
  return rgb ? '#' + rgb.slice(1).map(number => Number(number).toString(16).padStart(2, '0')).join('') : '#35383c'
}

function Tool({ label, icon: Icon, active, onClick, disabled }) {
  return <Button type="button" size="icon" variant="ghost" aria-label={label} aria-pressed={active} title={label}
    disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onClick}><Icon size={16} aria-hidden="true" /></Button>
}

function ToolMenu({ label, icon: Icon, text, trigger, active, style, children }) {
  const selected = useRef(false)
  function choose(action) {
    return () => { selected.current = true; action() }
  }
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button ref={trigger} type="button" size={text ? 'sm' : 'icon'} variant={text ? 'outline' : 'ghost'} title={label}
        aria-label={label} data-format-active={active || undefined} style={style}>
        <Icon size={16} aria-hidden="true" />{text}{text && <ChevronDown size={13} aria-hidden="true" />}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" collisionPadding={8} className="cra1-editor-menu" onCloseAutoFocus={event => {
      if (selected.current) event.preventDefault()
      selected.current = false
    }}>
      {children(choose)}
    </DropdownMenuContent>
  </DropdownMenu>
}

export default function Toolbar({ label, sourceMode, context, format, onInsert, onLink, onTable, remember, clock, insertTrigger }) {
  const AlignIcon = alignments.find(([key]) => key === context?.align)?.[2] || AlignLeft
  return <div className="cra1-editor__tools" role="group" aria-label={label + '工具'} onMouseDownCapture={remember}>
    {!sourceMode && <>
      <div className="cra1-editor__tool-group">
        <Tool label="撤销" icon={Undo2} disabled={!context?.undo} onClick={() => format('undo')} />
        <Tool label="重做" icon={Redo2} disabled={!context?.redo} onClick={() => format('redo')} />
      </div>
      <div className="cra1-editor__tool-group">
        <Select aria-label="段落样式" value={String(context?.heading || 0)} onChange={event => format('heading', Number(event.target.value))}>
          <option value="0">正文</option>
          {[1, 2, 3, 4, 5, 6].map(level => <option value={level} key={level}>标题 {level}</option>)}
        </Select>
        {marks.map(([name, title, Icon]) => <Tool key={name} label={title} icon={Icon}
          active={!!context?.active[name]} onClick={() => format(name)} />)}
        <label className="cra1-editor__color" title="文字颜色"><Input type="color" aria-label="文字颜色"
          value={iconColor(context?.color)} onChange={event => format('color', event.target.value)} /></label>
        <ToolMenu label="文字高亮" icon={Highlighter} active={!!context?.highlight}
          style={context?.highlight ? { '--cra1-editor-highlight': context.highlight } : undefined}>
          {choose => <>
            {highlights.map(([value, title]) => <DropdownMenuItem key={value}
              data-format-active={!!context?.highlight && iconColor(context.highlight).toLowerCase() === value || undefined}
              onSelect={choose(() => format('highlight', value))}>
              <span className="cra1-editor-menu__swatch" style={{ background: value }} aria-hidden="true" />{title}
            </DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={choose(() => format('highlight', ''))}>取消高亮</DropdownMenuItem>
          </>}
        </ToolMenu>
      </div>
      <div className="cra1-editor__tool-group">
        <ToolMenu label="段落对齐" icon={AlignIcon} active={!!context?.align}>
          {choose => alignments.map(([value, title, Icon]) =>
            <DropdownMenuItem key={value} data-format-active={(context?.align || 'left') === value || undefined}
              onSelect={choose(() => format('align', value))}><Icon />{title}</DropdownMenuItem>)}
        </ToolMenu>
        {blocks.map(([name, title, Icon]) => <Tool key={name} label={title} icon={Icon}
          active={!!context?.active[name]} onClick={() => format(name)} />)}
        <Tool label="清除格式" icon={RemoveFormatting} onClick={() => format('clear')} />
      </div>
    </>}
    <div className="cra1-editor__tool-group">
      <Button type="button" size="sm" variant="outline" aria-pressed={!sourceMode ? !!context?.active.link : undefined}
        onClick={onLink}><Link2 size={15} aria-hidden="true" />链接</Button>
      <ToolMenu label="插入" text="插入" icon={Plus} trigger={insertTrigger}>
        {choose => <>
          <DropdownMenuItem onSelect={choose(() => onInsert('image'))}><ImagePlus />插入图片</DropdownMenuItem>
          <DropdownMenuItem disabled={!sourceMode && context?.active.table} onSelect={choose(() => onInsert('table'))}><Table2 />插入表格</DropdownMenuItem>
          <DropdownMenuItem onSelect={choose(() => onInsert('rule'))}><Minus />分隔线</DropdownMenuItem>
          {sourceMode && <DropdownMenuItem onSelect={choose(() => onInsert('blockquote'))}><Quote />引用</DropdownMenuItem>}
          <DropdownMenuItem onSelect={choose(() => onInsert('icon'))}><Shapes />插入图标</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>提示框</DropdownMenuLabel>
          {Object.entries(calloutLabels).map(([tone, title]) => {
            const Icon = { info: Info, notice: CircleAlert, warning: TriangleAlert }[tone]
            return <DropdownMenuItem key={tone} onSelect={choose(() => onInsert('callout', tone))}><Icon />{title}</DropdownMenuItem>
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!clock} onSelect={choose(() => onInsert('timed'))}><Clock3 />限时内容</DropdownMenuItem>
          <DropdownMenuItem onSelect={choose(() => onInsert('more'))}><SquareSplitVertical />查看更多</DropdownMenuItem>
          <DropdownMenuItem onSelect={choose(() => onInsert('tabs'))}><Layers />标签页</DropdownMenuItem>
        </>}
      </ToolMenu>
      {!sourceMode && context?.active.table && <ToolMenu label="表格操作" text="表格" icon={Table2}>
        {choose => tableActions.map(([action, title]) => <DropdownMenuItem key={action}
          variant={action.startsWith('remove') ? 'destructive' : 'default'} onSelect={choose(() => onTable(action))}>{title}</DropdownMenuItem>)}
      </ToolMenu>}
    </div>
  </div>
}
