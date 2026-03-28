import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import ImageExt from '@tiptap/extension-image'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, Quote, Minus, Code, Plus, ChevronDown, Copy, Check,
  Image as ImageIcon, Video, Volume2, FileText, Loader2,
  X, Maximize2, Download, ExternalLink, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

const lowlight = createLowlight(common)

const LANGUAGES = [
  { value: null, label: 'Texto plano' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'graphql', label: 'GraphQL' },
]

function ImageNodeView({ node, deleteNode }) {
  const { src, alt } = node.attrs
  const [preview, setPreview] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y }
  const menuRef = useRef(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [ctxMenu])

  const copyImage = async () => {
    setCtxMenu(null)
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      toast.success('Imagen copiada al portapapeles')
    } catch {
      // Fallback: copy URL
      await navigator.clipboard.writeText(src)
      toast.success('URL copiada al portapapeles')
    }
  }

  const downloadImage = async () => {
    setCtxMenu(null)
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = alt || 'imagen'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(src, '_blank')
    }
  }

  const openInBrowser = () => {
    setCtxMenu(null)
    window.open(src, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = () => {
    setCtxMenu(null)
    deleteNode()
  }

  const MENU_ITEMS = [
    { icon: Maximize2, label: 'Vista previa', action: () => { setCtxMenu(null); setPreview(true) } },
    { icon: Copy, label: 'Copiar imagen', action: copyImage },
    { icon: Download, label: 'Descargar', action: downloadImage },
    { icon: ExternalLink, label: 'Abrir en navegador', action: openInBrowser },
    { divider: true },
    { icon: Trash2, label: 'Eliminar', action: handleDelete, danger: true },
  ]

  return (
    <NodeViewWrapper>
      <div
        className="relative group my-1"
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      >
        <img
          src={src}
          alt={alt || ''}
          onClick={() => setPreview(true)}
          className="max-w-full rounded-lg cursor-pointer block"
          draggable={false}
        />

        {/* Hover toolbar */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-lg p-1">
          {[
            { Icon: Maximize2, label: 'Vista previa', fn: () => setPreview(true) },
            { Icon: Copy, label: 'Copiar', fn: copyImage },
            { Icon: Download, label: 'Descargar', fn: downloadImage },
            { Icon: ExternalLink, label: 'Abrir en navegador', fn: openInBrowser },
          ].map(({ Icon, label, fn }) => (
            <button key={label} onClick={fn} title={label} className="p-1.5 rounded-md text-white hover:bg-white/20 transition-colors">
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <div className="w-px h-4 bg-white/30 mx-0.5" />
          <button onClick={handleDelete} title="Eliminar" className="p-1.5 rounded-md text-red-400 hover:bg-white/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Full-screen preview */}
      {preview && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 animate-fade-in"
          onClick={() => setPreview(false)}
        >
          <div className="relative max-w-[92vw] max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <img
              src={src}
              alt={alt || ''}
              className="max-w-full max-h-[92vh] rounded-xl shadow-2xl object-contain"
            />
            {/* Preview actions */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              {[
                { Icon: Copy, label: 'Copiar', fn: copyImage },
                { Icon: Download, label: 'Descargar', fn: downloadImage },
                { Icon: ExternalLink, label: 'Abrir en navegador', fn: openInBrowser },
              ].map(({ Icon, label, fn }) => (
                <button key={label} onClick={fn} title={label} className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors">
                  <Icon className="w-4 h-4" />
                </button>
              ))}
              <button onClick={() => setPreview(false)} title="Cerrar" className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Right-click context menu */}
      {ctxMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[300] w-52 rounded-xl border border-border bg-popover shadow-xl py-1.5 animate-scale-in"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {MENU_ITEMS.map((item, i) =>
            item.divider ? (
              <div key={i} className="border-t border-border my-1" />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                  item.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  )
}

function CodeBlockComponent({ node, updateAttributes, extension }) {
  const [showLangs, setShowLangs] = useState(false)
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!showLangs) return
    const close = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (dropRef.current?.contains(e.target)) return
      setShowLangs(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showLangs])

  const openDropdown = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, left: rect.left })
    }
    setShowLangs(!showLangs)
    setFilter('')
  }

  const currentLang = LANGUAGES.find(l => l.value === node.attrs.language) || LANGUAGES[0]
  const filtered = LANGUAGES.filter(l => l.label.toLowerCase().includes(filter.toLowerCase()))

  const handleCopy = () => {
    navigator.clipboard.writeText(node.textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header">
        <button
          ref={btnRef}
          onClick={openDropdown}
          className="code-lang-btn"
        >
          {currentLang.label}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showLangs && createPortal(
          <div
            ref={dropRef}
            className="code-lang-dropdown"
            style={{ top: dropPos.top, left: dropPos.left }}
          >
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Busca un idioma..."
              className="code-lang-search"
            />
            <div className="code-lang-list">
              {filtered.map(lang => (
                <button
                  key={lang.label}
                  onClick={() => {
                    updateAttributes({ language: lang.value })
                    setShowLangs(false)
                  }}
                  className={cn(
                    'code-lang-option',
                    node.attrs.language === lang.value && 'active'
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
        <div className="code-block-actions">
          <button onClick={handleCopy} className="code-copy-btn" title="Copiar código">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

const SLASH_ITEMS = [
  { label: 'Texto', icon: Type, group: 'Bloques básicos', action: (editor) => editor.chain().focus().setParagraph().run() },
  { label: 'Encabezado 1', icon: Heading1, group: 'Bloques básicos', shortcut: '#', action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Encabezado 2', icon: Heading2, group: 'Bloques básicos', shortcut: '##', action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Encabezado 3', icon: Heading3, group: 'Bloques básicos', shortcut: '###', action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Lista con viñetas', icon: List, group: 'Bloques básicos', shortcut: '-', action: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: 'Lista numerada', icon: ListOrdered, group: 'Bloques básicos', shortcut: '1.', action: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { label: 'Lista de tareas', icon: CheckSquare, group: 'Bloques básicos', shortcut: '[]', action: (editor) => editor.chain().focus().toggleTaskList().run() },
  { label: 'Cita', icon: Quote, group: 'Bloques básicos', shortcut: '>', action: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { label: 'Código', icon: Code, group: 'Bloques básicos', shortcut: '```', action: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { label: 'Divisor', icon: Minus, group: 'Bloques básicos', shortcut: '---', action: (editor) => editor.chain().focus().setHorizontalRule().run() },
  { label: 'Imagen', icon: ImageIcon, group: 'Contenido multimedia', isFile: true, accept: 'image/*', mediaType: 'image' },
  { label: 'Video', icon: Video, group: 'Contenido multimedia', isFile: true, accept: 'video/*', mediaType: 'video' },
  { label: 'Audio', icon: Volume2, group: 'Contenido multimedia', isFile: true, accept: 'audio/*', mediaType: 'audio' },
  { label: 'Archivo', icon: FileText, group: 'Contenido multimedia', isFile: true, accept: '*', mediaType: 'file' },
]

export default function BlockEditor({ value, onChange, placeholder }) {
  const [slashMenu, setSlashMenu] = useState(null)
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const slashMenuRef = useRef(null)
  const fileInputRef = useRef(null)
  const pendingAction = useRef(null)

  // Parse initial content
  const getInitialContent = () => {
    if (!value) return ''
    try {
      // If it's our old JSON block format, convert to HTML
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) && parsed[0]?.type) {
        return blocksToHtml(parsed)
      }
    } catch {}
    // If it's already HTML or plain text
    if (value.startsWith('<') || value.startsWith('[')) return value
    return `<p>${value}</p>`
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent)
        },
      }).configure({ lowlight }),
      Placeholder.configure({
        placeholder: placeholder || "Escribe '/' para ver comandos...",
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExt.extend({
        addNodeView() {
          return ReactNodeViewRenderer(ImageNodeView)
        },
      }).configure({ inline: false }),
    ],
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60px] prose-sm',
      },
      handleKeyDown: (view, event) => {
        // Slash command trigger
        if (event.key === '/' && !slashMenu) {
          setTimeout(() => {
            const { from } = view.state.selection
            const coords = view.coordsAtPos(from)
            setSlashMenu({ x: coords.left, y: coords.bottom + 4 })
            setSlashFilter('')
            setSelectedIndex(0)
          }, 10)
        }

        // Slash menu keyboard nav
        if (slashMenu) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedIndex(p => Math.min(p + 1, filteredItems.length - 1))
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedIndex(p => Math.max(p - 1, 0))
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            selectSlashItem(filteredItems[selectedIndex])
            return true
          }
          if (event.key === 'Escape') {
            setSlashMenu(null)
            setSlashFilter('')
            return true
          }
          // Filter as user types
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
            setSlashFilter(prev => prev + event.key)
            setSelectedIndex(0)
          }
          if (event.key === 'Backspace') {
            if (slashFilter.length > 0) {
              setSlashFilter(prev => prev.slice(0, -1))
            } else {
              setSlashMenu(null)
            }
          }
        }

        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  // Close slash menu on click outside
  useEffect(() => {
    const close = (e) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setSlashMenu(null)
        setSlashFilter('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filteredItems = SLASH_ITEMS.filter(item =>
    item.label.toLowerCase().includes(slashFilter.toLowerCase())
  )

  const selectSlashItem = useCallback((item) => {
    if (!item || !editor) return

    // Remove the "/" character
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - slashFilter.length - 1), from)
    const slashPos = textBefore.lastIndexOf('/')
    if (slashPos >= 0) {
      const deleteFrom = from - (textBefore.length - slashPos)
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run()
    }

    if (item.isFile) {
      pendingAction.current = item
      if (fileInputRef.current) {
        fileInputRef.current.accept = item.accept || '*'
        fileInputRef.current.click()
      }
    } else {
      item.action(editor)
    }

    setSlashMenu(null)
    setSlashFilter('')
  }, [editor, slashFilter])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    e.target.value = ''

    const mediaType = pendingAction.current?.mediaType || 'file'

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `blocks/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)

    if (!error) {
      const { data } = supabase.storage.from('attachments').getPublicUrl(path)
      const url = data?.publicUrl
      if (url) {
        // Re-focus editor first
        editor.commands.focus('end')

        let html = ''
        if (mediaType === 'image') {
          html = `<img src="${url}" alt="${file.name}" /><p></p>`
        } else if (mediaType === 'video') {
          html = `<div data-type="media" class="media-block"><video src="${url}" controls style="max-width:100%;max-height:20rem;border-radius:0.5rem;margin:0.5em 0"></video><p class="media-caption">${file.name}</p></div><p></p>`
        } else if (mediaType === 'audio') {
          html = `<div data-type="media" class="media-block"><audio src="${url}" controls style="width:100%;margin:0.5em 0"></audio><p class="media-caption">${file.name}</p></div><p></p>`
        } else {
          const size = file.size < 1024 * 1024
            ? (file.size / 1024).toFixed(1) + ' KB'
            : (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          html = `<p><a href="${url}" target="_blank" rel="noopener">📎 ${file.name} (${size})</a></p><p></p>`
        }

        editor.chain().insertContent(html).focus('end').run()
      }
    }
    setUploading(false)
    pendingAction.current = null
  }

  // Group items
  const groups = {}
  filteredItems.forEach(item => {
    if (!groups[item.group]) groups[item.group] = []
    groups[item.group].push(item)
  })
  let flatIdx = -1

  return (
    <div className="block-editor relative">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      {uploading && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Subiendo archivo...
        </div>
      )}

      <EditorContent editor={editor} />

      {/* Slash command menu */}
      {slashMenu && filteredItems.length > 0 && (
        <div
          ref={slashMenuRef}
          className="fixed z-[200] w-64 max-h-80 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover shadow-xl py-1 animate-scale-in"
          style={{
            left: Math.min(slashMenu.x, window.innerWidth - 270),
            top: Math.min(slashMenu.y, window.innerHeight - 300),
          }}
        >
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group}</span>
              </div>
              {items.map(item => {
                flatIdx++
                const idx = flatIdx
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    onMouseDown={(e) => { e.preventDefault(); selectSlashItem(item) }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-1.5 text-sm transition-colors',
                      selectedIndex === idx ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-left text-foreground">{item.label}</span>
                    {item.shortcut && <span className="text-[10px] text-muted-foreground font-mono">{item.shortcut}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          <div className="px-3 py-1.5 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">↑↓</kbd> Navegar</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">↵</kbd> Seleccionar</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">esc</kbd> Cerrar</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Convert old block format to HTML
function blocksToHtml(blocks) {
  return blocks.map(b => {
    switch (b.type) {
      case 'h1': return `<h1>${b.content}</h1>`
      case 'h2': return `<h2>${b.content}</h2>`
      case 'h3': return `<h3>${b.content}</h3>`
      case 'bullet': return `<ul><li>${b.content}</li></ul>`
      case 'numbered': return `<ol><li>${b.content}</li></ol>`
      case 'checklist': return `<ul data-type="taskList"><li data-type="taskItem" data-checked="${b.checked}">${b.content}</li></ul>`
      case 'quote': return `<blockquote><p>${b.content}</p></blockquote>`
      case 'code': return `<pre><code>${b.content}</code></pre>`
      case 'divider': return '<hr>'
      case 'image': return b.content ? `<img src="${b.content}" alt="${b.fileName || ''}" />` : ''
      default: return `<p>${b.content || ''}</p>`
    }
  }).join('')
}
