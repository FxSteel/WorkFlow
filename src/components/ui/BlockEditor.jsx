import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import ImageExt from '@tiptap/extension-image'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TiptapUnderline from '@tiptap/extension-underline'
import TiptapHighlight from '@tiptap/extension-highlight'
import TiptapLink from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color as TiptapColor } from '@tiptap/extension-color'
import { TextAlign } from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Node, Extension, mergeAttributes } from '@tiptap/core'
import { common, createLowlight } from 'lowlight'
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, Quote, Minus, Plus, Code, ChevronDown, ChevronRight, Copy, Check,
  Image as ImageIcon, Video, Volume2, FileText, Loader2,
  X, Maximize2, Download, ExternalLink, Trash2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code2,
  Link as LinkIcon, Unlink,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Palette, Highlighter,
  IndentIncrease, IndentDecrease, RemoveFormatting,
  Table as TableIcon, Info, AlertTriangle, CheckCircle2, XCircle,
  ToggleRight,
  Rows, Columns, ArrowUpFromLine, ArrowDownFromLine, ArrowLeftFromLine, ArrowRightFromLine,
  Paintbrush, Settings,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

// ─── Constants ───────────────────────────────────────────────────────────────

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

const TEXT_COLORS = [
  { name: 'Predeterminado', color: null },
  { name: 'Gris', color: '#9ca3af' },
  { name: 'Marrón', color: '#a16207' },
  { name: 'Naranja', color: '#ea580c' },
  { name: 'Amarillo', color: '#ca8a04' },
  { name: 'Verde', color: '#16a34a' },
  { name: 'Azul', color: '#2563eb' },
  { name: 'Morado', color: '#9333ea' },
  { name: 'Rosa', color: '#db2777' },
  { name: 'Rojo', color: '#dc2626' },
]

const HIGHLIGHT_COLORS = [
  { name: 'Sin fondo', color: null },
  { name: 'Gris', color: 'rgba(148,163,184,0.2)' },
  { name: 'Naranja', color: 'rgba(251,146,60,0.2)' },
  { name: 'Amarillo', color: 'rgba(250,204,21,0.25)' },
  { name: 'Verde', color: 'rgba(74,222,128,0.2)' },
  { name: 'Azul', color: 'rgba(96,165,250,0.2)' },
  { name: 'Morado', color: 'rgba(192,132,252,0.2)' },
  { name: 'Rosa', color: 'rgba(244,114,182,0.2)' },
  { name: 'Rojo', color: 'rgba(248,113,113,0.2)' },
]

const CALLOUT_VARIANTS = {
  info:    { icon: '💡', label: 'Información' },
  warning: { icon: '⚠️', label: 'Advertencia' },
  success: { icon: '✅', label: 'Éxito' },
  error:   { icon: '🚫', label: 'Error' },
}

// ─── Custom TipTap Extensions ────────────────────────────────────────────────

const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: el => el.getAttribute('data-variant') || 'info',
        renderHTML: attrs => ({ 'data-variant': attrs.variant }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView)
  },

  addCommands() {
    return {
      setCallout: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
          content: [{ type: 'paragraph' }],
        })
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Enter at end of last empty paragraph → exit callout, insert paragraph after
      Enter: ({ editor }) => {
        if (!editor.isActive('callout')) return false
        const { $from, empty } = editor.state.selection
        if (!empty) return false
        // Check if cursor is in an empty paragraph inside the callout
        const parentParagraph = $from.parent
        if (parentParagraph.type.name !== 'paragraph' || parentParagraph.textContent.length > 0) return false
        // Check if it's the last child of the callout
        const calloutDepth = $from.depth - 1
        const calloutNode = $from.node(calloutDepth)
        const indexInCallout = $from.index(calloutDepth)
        if (indexInCallout < calloutNode.childCount - 1) return false
        // If callout only has one empty paragraph, delete the whole callout
        if (calloutNode.childCount === 1) {
          const pos = $from.before(calloutDepth)
          editor.chain().focus().deleteRange({ from: pos, to: pos + calloutNode.nodeSize }).insertContentAt(pos, { type: 'paragraph' }).run()
          return true
        }
        // Otherwise delete the empty paragraph and insert one after the callout
        const emptyParaPos = $from.before()
        const afterCallout = $from.after(calloutDepth)
        editor.chain().focus().deleteRange({ from: emptyParaPos, to: emptyParaPos + parentParagraph.nodeSize }).insertContentAt(afterCallout - parentParagraph.nodeSize, { type: 'paragraph' }).run()
        return true
      },
      // Backspace on empty callout → delete it
      Backspace: ({ editor }) => {
        if (!editor.isActive('callout')) return false
        const { $from, empty } = editor.state.selection
        if (!empty) return false
        const calloutDepth = $from.depth - 1
        const calloutNode = $from.node(calloutDepth)
        // Only if callout has a single empty paragraph
        if (calloutNode.childCount === 1 && calloutNode.firstChild.textContent.length === 0) {
          const pos = $from.before(calloutDepth)
          editor.chain().focus().deleteRange({ from: pos, to: pos + calloutNode.nodeSize }).insertContentAt(pos, { type: 'paragraph' }).run()
          return true
        }
        return false
      },
    }
  },
})

const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      summary: {
        default: '',
        parseHTML: el => el.getAttribute('data-summary') || '',
        renderHTML: attrs => ({ 'data-summary': attrs.summary }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleNodeView)
  },

  addCommands() {
    return {
      setToggle: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
          content: [{ type: 'paragraph' }],
        })
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive('toggleBlock')) return false
        const { $from, empty } = editor.state.selection
        if (!empty) return false
        const parentParagraph = $from.parent
        if (parentParagraph.type.name !== 'paragraph' || parentParagraph.textContent.length > 0) return false
        const toggleDepth = $from.depth - 1
        const toggleNode = $from.node(toggleDepth)
        const indexInToggle = $from.index(toggleDepth)
        if (indexInToggle < toggleNode.childCount - 1) return false
        if (toggleNode.childCount === 1) {
          const pos = $from.before(toggleDepth)
          editor.chain().focus().deleteRange({ from: pos, to: pos + toggleNode.nodeSize }).insertContentAt(pos, { type: 'paragraph' }).run()
          return true
        }
        const emptyParaPos = $from.before()
        const afterToggle = $from.after(toggleDepth)
        editor.chain().focus().deleteRange({ from: emptyParaPos, to: emptyParaPos + parentParagraph.nodeSize }).insertContentAt(afterToggle - parentParagraph.nodeSize, { type: 'paragraph' }).run()
        return true
      },
      Backspace: ({ editor }) => {
        if (!editor.isActive('toggleBlock')) return false
        const { $from, empty } = editor.state.selection
        if (!empty) return false
        const toggleDepth = $from.depth - 1
        const toggleNode = $from.node(toggleDepth)
        if (toggleNode.childCount === 1 && toggleNode.firstChild.textContent.length === 0) {
          const pos = $from.before(toggleDepth)
          editor.chain().focus().deleteRange({ from: pos, to: pos + toggleNode.nodeSize }).insertContentAt(pos, { type: 'paragraph' }).run()
          return true
        }
        return false
      },
    }
  },
})

// ─── Node Views ──────────────────────────────────────────────────────────────

function CalloutNodeView({ node, updateAttributes }) {
  const variant = node.attrs.variant || 'info'
  const [showPicker, setShowPicker] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const pickerRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!showPicker) return
    // Check if there's space below
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 180)
    }
    const close = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showPicker])

  const variantStyles = {
    info:    'notion-callout-info',
    warning: 'notion-callout-warning',
    success: 'notion-callout-success',
    error:   'notion-callout-error',
  }

  return (
    <NodeViewWrapper>
      <div className={cn('notion-callout', variantStyles[variant])}>
        <div className="relative" contentEditable={false}>
          <button
            ref={btnRef}
            onClick={() => setShowPicker(!showPicker)}
            className="notion-callout-icon"
            title="Cambiar tipo"
          >
            {CALLOUT_VARIANTS[variant]?.icon || '💡'}
          </button>
          {showPicker && (
            <div ref={pickerRef} className={cn("notion-callout-picker", openUp && "notion-callout-picker-up")}>
              {Object.entries(CALLOUT_VARIANTS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => { updateAttributes({ variant: key }); setShowPicker(false) }}
                  className={cn('notion-callout-picker-item', variant === key && 'active')}
                >
                  <span>{val.icon}</span>
                  <span>{val.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <NodeViewContent className="notion-callout-content" />
      </div>
    </NodeViewWrapper>
  )
}

function ToggleNodeView({ node, updateAttributes }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <NodeViewWrapper>
      <div className="notion-toggle">
        <div className="notion-toggle-header" contentEditable={false}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="notion-toggle-arrow"
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-90')} />
          </button>
          <input
            className="notion-toggle-summary"
            value={node.attrs.summary}
            onChange={(e) => updateAttributes({ summary: e.target.value })}
            placeholder="Escribe el título del toggle..."
          />
        </div>
        <div className={cn('notion-toggle-content', !isOpen && 'notion-toggle-collapsed')}>
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

function ImageNodeView({ node, deleteNode }) {
  const { src, alt } = node.attrs
  const [preview, setPreview] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
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
        className="relative group my-2"
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      >
        <img
          src={src}
          alt={alt || ''}
          onClick={() => setPreview(true)}
          className="max-w-full rounded-lg cursor-pointer block"
          draggable={false}
        />
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

      {preview && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 animate-fade-in"
          onClick={() => setPreview(false)}
        >
          <div className="relative max-w-[92vw] max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <img src={src} alt={alt || ''} className="max-w-full max-h-[92vh] rounded-xl shadow-2xl object-contain" />
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
                  item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-accent'
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

function CodeBlockComponent({ node, updateAttributes }) {
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
        <button ref={btnRef} onClick={openDropdown} className="code-lang-btn">
          {currentLang.label}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showLangs && createPortal(
          <div ref={dropRef} className="code-lang-dropdown" style={{ top: dropPos.top, left: dropPos.left }}>
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
                  onClick={() => { updateAttributes({ language: lang.value }); setShowLangs(false) }}
                  className={cn('code-lang-option', node.attrs.language === lang.value && 'active')}
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

// ─── Bubble Menu ─────────────────────────────────────────────────────────────

function EditorBubbleMenu({ editor }) {
  const [showColors, setShowColors] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkInputRef = useRef(null)
  const colorsRef = useRef(null)
  const highlightRef = useRef(null)

  useEffect(() => {
    if (showLinkInput && linkInputRef.current) linkInputRef.current.focus()
  }, [showLinkInput])

  useEffect(() => {
    const close = (e) => {
      // Don't close if clicking inside the portal color picker or on the trigger button
      if (e.target.closest('.notion-color-swatch') || e.target.closest('.notion-color-picker-portal')) return
      if (colorsRef.current && colorsRef.current.contains(e.target)) return
      if (highlightRef.current && highlightRef.current.contains(e.target)) return
      setShowColors(false)
      setShowHighlight(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleLinkClick = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    setShowLinkInput(true)
    setLinkUrl('')
  }

  const applyLink = () => {
    if (linkUrl.trim()) {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
      editor.chain().focus().setLink({ href: url }).run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const BBtn = ({ active, onClick, title, children }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
    </button>
  )

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: 'top',
        animation: 'shift-toward-subtle',
        interactive: true,
        appendTo: () => document.body,
      }}
      shouldShow={({ editor: e, state }) => {
        if (e.isActive('codeBlock') || e.isActive('image')) return false
        const { from, to } = state.selection
        return from !== to
      }}
    >
      <div className="notion-bubble-menu">
        <div className="flex items-center gap-0.5">
          <BBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita (⌘B)">
            <Bold className="w-3.5 h-3.5" />
          </BBtn>
          <BBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva (⌘I)">
            <Italic className="w-3.5 h-3.5" />
          </BBtn>
          <BBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado (⌘U)">
            <UnderlineIcon className="w-3.5 h-3.5" />
          </BBtn>
          <BBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
            <Strikethrough className="w-3.5 h-3.5" />
          </BBtn>
          <BBtn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Código (⌘E)">
            <Code2 className="w-3.5 h-3.5" />
          </BBtn>

          <div className="w-px h-5 bg-border mx-0.5" />

          <BBtn active={editor.isActive('link')} onClick={handleLinkClick} title={editor.isActive('link') ? 'Quitar enlace' : 'Enlace'}>
            {editor.isActive('link') ? <Unlink className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
          </BBtn>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Text color */}
          <div className="relative" ref={colorsRef}>
            <BBtn active={showColors} onClick={() => { setShowColors(!showColors); setShowHighlight(false) }} title="Color de texto">
              <Palette className="w-3.5 h-3.5" />
            </BBtn>
            {showColors && createPortal(
              <div
                className="notion-color-picker-portal fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl min-w-[170px] animate-scale-in"
                style={{
                  top: colorsRef.current?.getBoundingClientRect().bottom + 6,
                  left: colorsRef.current?.getBoundingClientRect().left - 50,
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">Color de texto</div>
                <div className="grid grid-cols-5 gap-1 p-2">
                  {TEXT_COLORS.map(c => (
                    <button
                      key={c.name}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (c.color) editor.chain().focus().setColor(c.color).run()
                        else editor.chain().focus().unsetColor().run()
                        setShowColors(false)
                      }}
                      className="notion-color-swatch"
                      title={c.name}
                    >
                      <span style={{ color: c.color || 'var(--color-foreground)' }} className="text-sm font-bold">A</span>
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Highlight color */}
          <div className="relative" ref={highlightRef}>
            <BBtn active={showHighlight} onClick={() => { setShowHighlight(!showHighlight); setShowColors(false) }} title="Resaltado">
              <Highlighter className="w-3.5 h-3.5" />
            </BBtn>
            {showHighlight && createPortal(
              <div
                className="notion-color-picker-portal fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl min-w-[170px] animate-scale-in"
                style={{
                  top: highlightRef.current?.getBoundingClientRect().bottom + 6,
                  left: highlightRef.current?.getBoundingClientRect().left - 50,
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">Resaltado</div>
                <div className="grid grid-cols-5 gap-1 p-2">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c.name}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        if (c.color) editor.chain().focus().toggleHighlight({ color: c.color }).run()
                        else editor.chain().focus().unsetHighlight().run()
                        setShowHighlight(false)
                      }}
                      className="notion-color-swatch"
                      title={c.name}
                    >
                      <span
                        className="w-5 h-5 rounded-sm border border-border/50"
                        style={{ background: c.color || 'transparent' }}
                      />
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Link input */}
        {showLinkInput && (
          <div className="notion-link-input" onMouseDown={e => e.stopPropagation()}>
            <input
              ref={linkInputRef}
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl('') }
              }}
              placeholder="Pegar enlace y presionar Enter..."
              className="notion-link-input-field"
            />
          </div>
        )}
      </div>
    </BubbleMenu>
  )
}

// ─── Slash Command Items ─────────────────────────────────────────────────────

const SLASH_ITEMS = [
  // Basic blocks
  { label: 'Texto', keywords: 'text paragraph parrafo', icon: Type, group: 'Bloques básicos', action: (e) => e.chain().focus().setParagraph().run() },
  { label: 'Encabezado 1', keywords: 'heading h1 titulo title', icon: Heading1, group: 'Bloques básicos', shortcut: '#', action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Encabezado 2', keywords: 'heading h2 titulo title', icon: Heading2, group: 'Bloques básicos', shortcut: '##', action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Encabezado 3', keywords: 'heading h3 titulo title', icon: Heading3, group: 'Bloques básicos', shortcut: '###', action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Lista con viñetas', keywords: 'bullet list unordered vinetas', icon: List, group: 'Bloques básicos', shortcut: '-', action: (e) => e.chain().focus().toggleBulletList().run() },
  { label: 'Lista numerada', keywords: 'ordered number list numeros', icon: ListOrdered, group: 'Bloques básicos', shortcut: '1.', action: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Lista de tareas', keywords: 'todo task check checklist', icon: CheckSquare, group: 'Bloques básicos', shortcut: '[]', action: (e) => e.chain().focus().toggleTaskList().run() },
  { label: 'Cita', keywords: 'quote blockquote citacion', icon: Quote, group: 'Bloques básicos', shortcut: '>', action: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Código', keywords: 'code codigo codeblock programacion', icon: Code, group: 'Bloques básicos', shortcut: '```', action: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Divisor', keywords: 'divider separator separador linea hr', icon: Minus, group: 'Bloques básicos', shortcut: '---', action: (e) => e.chain().focus().setHorizontalRule().run() },
  // Advanced blocks
  { label: 'Aviso informativo', keywords: 'aviso info nota tip consejo callout', icon: Info, group: 'Bloques avanzados', action: (e) => e.chain().focus().setCallout({ variant: 'info' }).run() },
  { label: 'Aviso de advertencia', keywords: 'advertencia warning alerta atencion cuidado', icon: AlertTriangle, group: 'Bloques avanzados', action: (e) => e.chain().focus().setCallout({ variant: 'warning' }).run() },
  { label: 'Aviso de éxito', keywords: 'exito success completado listo ok bien', icon: CheckCircle2, group: 'Bloques avanzados', action: (e) => e.chain().focus().setCallout({ variant: 'success' }).run() },
  { label: 'Aviso de error', keywords: 'error fallo problema peligro danger', icon: XCircle, group: 'Bloques avanzados', action: (e) => e.chain().focus().setCallout({ variant: 'error' }).run() },
  { label: 'Desplegable', keywords: 'toggle dropdown expandir colapsar', icon: ToggleRight, group: 'Bloques avanzados', action: (e) => e.chain().focus().setToggle({ summary: '' }).run() },
  { label: 'Tabla', keywords: 'table grid grilla filas columnas', icon: TableIcon, group: 'Bloques avanzados', action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  // Multimedia
  { label: 'Imagen', keywords: 'image photo foto picture', icon: ImageIcon, group: 'Contenido multimedia', isFile: true, accept: 'image/*', mediaType: 'image' },
  { label: 'Video', keywords: 'video clip pelicula', icon: Video, group: 'Contenido multimedia', isFile: true, accept: 'video/*', mediaType: 'video' },
  { label: 'Audio', keywords: 'audio sonido musica sound', icon: Volume2, group: 'Contenido multimedia', isFile: true, accept: 'audio/*', mediaType: 'audio' },
  { label: 'Archivo', keywords: 'file documento adjunto attachment', icon: FileText, group: 'Contenido multimedia', isFile: true, accept: '*', mediaType: 'file' },
]

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// ─── Block Editor ────────────────────────────────────────────────────────────

// ─── Font Size Extension ─────────────────────────────────────────────────────

const IndentExtension = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: element => parseInt(element.getAttribute('data-indent') || '0'),
          renderHTML: attributes => {
            if (!attributes.indent || attributes.indent <= 0) return {}
            return { 'data-indent': attributes.indent, style: `margin-left: ${attributes.indent * 2}rem` }
          },
        },
      },
    }]
  },
})

const FontSizeExtension = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize?.replace('px', '') || null,
          renderHTML: attributes => {
            if (!attributes.fontSize) return {}
            return { style: `font-size: ${attributes.fontSize}px` }
          },
        },
      },
    }]
  },
})

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

// ─── Table Colors ───────────────────────────────────────────────────────────

const TABLE_COLORS = [
  { name: 'Sin color', color: null },
  { name: 'Gris claro', color: '#f1f5f9' },
  { name: 'Rojo claro', color: '#fee2e2' },
  { name: 'Naranja claro', color: '#ffedd5' },
  { name: 'Amarillo claro', color: '#fef9c3' },
  { name: 'Verde claro', color: '#dcfce7' },
  { name: 'Azul claro', color: '#dbeafe' },
  { name: 'Morado claro', color: '#f3e8ff' },
  { name: 'Rosa claro', color: '#fce7f3' },
]

// ─── Table Settings (floating icon + dropdown) ─────────────────────────────

function TableSettings({ editor }) {
  const [open, setOpen] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorMode, setColorMode] = useState('cell')
  const [btnPos, setBtnPos] = useState(null)
  const [, forceUpdate] = useState(0)

  // Re-render when editor state changes to track table presence/position
  useEffect(() => {
    if (!editor) return
    const handler = () => forceUpdate(n => n + 1)
    editor.on('transaction', handler)
    return () => editor.off('transaction', handler)
  }, [editor])

  // Close dropdown when leaving table
  useEffect(() => {
    if (!editor?.isActive('table')) {
      setOpen(false)
      setShowColorPicker(false)
    }
  }, [editor?.isActive('table')])

  // Calculate button position based on table DOM element
  useEffect(() => {
    if (!editor || !editor.isActive('table')) { setBtnPos(null); return }
    try {
      const { $from } = editor.state.selection
      let depth = $from.depth
      while (depth > 0 && $from.node(depth).type.name !== 'table') depth--
      if (depth <= 0) { setBtnPos(null); return }
      const tablePos = $from.before(depth)
      const dom = editor.view.nodeDOM(tablePos)
      if (dom) {
        const rect = dom.getBoundingClientRect()
        setBtnPos({ top: rect.top - 2, left: rect.right + 6 })
      }
    } catch { setBtnPos(null) }
  })

  if (!editor || !editor.isActive('table') || !btnPos) return null

  const applyColor = (color) => {
    if (colorMode === 'cell') {
      editor.chain().focus().setCellAttribute('backgroundColor', color).run()
    } else if (colorMode === 'row') {
      const { state } = editor
      const { $from } = state.selection
      let rowDepth = $from.depth
      while (rowDepth > 0 && $from.node(rowDepth).type.name !== 'tableRow') rowDepth--
      if (rowDepth > 0) {
        const rowNode = $from.node(rowDepth)
        const rowStart = $from.before(rowDepth)
        const tr = state.tr
        let pos = rowStart + 1
        for (let i = 0; i < rowNode.childCount; i++) {
          const cell = rowNode.child(i)
          tr.setNodeMarkup(pos, undefined, { ...cell.attrs, backgroundColor: color })
          pos += cell.nodeSize
        }
        editor.view.dispatch(tr)
      }
    } else if (colorMode === 'column') {
      const { state } = editor
      const { $from } = state.selection
      let cellDepth = $from.depth
      while (cellDepth > 0 && !['tableCell', 'tableHeader'].includes($from.node(cellDepth).type.name)) cellDepth--
      if (cellDepth > 0) {
        const rowDepth = cellDepth - 1
        const rowNode = $from.node(rowDepth)
        let colIndex = 0
        let pos = $from.before(rowDepth) + 1
        for (let i = 0; i < rowNode.childCount; i++) {
          if (pos === $from.before(cellDepth)) { colIndex = i; break }
          pos += rowNode.child(i).nodeSize
        }
        let tableDepth = rowDepth - 1
        while (tableDepth > 0 && $from.node(tableDepth).type.name !== 'table') tableDepth--
        if (tableDepth >= 0) {
          const tableNode = $from.node(tableDepth)
          const tableStart = $from.before(tableDepth)
          const tr = state.tr
          let rowPos = tableStart + 1
          for (let r = 0; r < tableNode.childCount; r++) {
            const row = tableNode.child(r)
            let cellPos = rowPos + 1
            for (let c = 0; c < row.childCount; c++) {
              if (c === colIndex) {
                const cell = row.child(c)
                tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, backgroundColor: color })
              }
              cellPos += row.child(c).nodeSize
            }
            rowPos += row.nodeSize
          }
          editor.view.dispatch(tr)
        }
      }
    }
    setShowColorPicker(false)
  }

  const MenuItem = ({ icon: Icon, label, onClick, danger }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-accent'
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  )

  return createPortal(
    <>
      {/* Settings icon button */}
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(prev => !prev); setShowColorPicker(false) }}
        className={cn(
          'fixed z-[50] w-7 h-7 rounded-lg border border-border/60 flex items-center justify-center transition-all',
          open ? 'bg-accent text-foreground shadow-md' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground shadow-sm'
        )}
        style={{ top: btnPos.top, left: btnPos.left }}
        title="Opciones de tabla"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => { setOpen(false); setShowColorPicker(false) }} />
          <div
            className="fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl w-[200px] py-1 animate-scale-in"
            style={{ top: btnPos.top + 32, left: btnPos.left }}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">Filas</div>
            <MenuItem icon={ArrowUpFromLine} label="Agregar arriba" onClick={() => { editor.chain().focus().addRowBefore().run() }} />
            <MenuItem icon={ArrowDownFromLine} label="Agregar abajo" onClick={() => { editor.chain().focus().addRowAfter().run() }} />
            <MenuItem icon={Trash2} label="Eliminar fila" onClick={() => { editor.chain().focus().deleteRow().run() }} danger />

            <div className="border-t border-border my-1" />
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">Columnas</div>
            <MenuItem icon={ArrowLeftFromLine} label="Agregar a la izquierda" onClick={() => { editor.chain().focus().addColumnBefore().run() }} />
            <MenuItem icon={ArrowRightFromLine} label="Agregar a la derecha" onClick={() => { editor.chain().focus().addColumnAfter().run() }} />
            <MenuItem icon={Trash2} label="Eliminar columna" onClick={() => { editor.chain().focus().deleteColumn().run() }} danger />

            <div className="border-t border-border my-1" />
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(prev => !prev) }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <Paintbrush className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left">Color de fondo</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </button>

            {/* Color submenu */}
            {showColorPicker && (
              <div className="border-t border-border">
                <div className="flex border-b border-border">
                  {[
                    { key: 'cell', label: 'Celda' },
                    { key: 'row', label: 'Fila' },
                    { key: 'column', label: 'Columna' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onMouseDown={(e) => { e.preventDefault(); setColorMode(tab.key) }}
                      className={cn(
                        'flex-1 text-[10px] py-1.5 transition-colors',
                        colorMode === tab.key
                          ? 'text-foreground font-semibold border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1 p-2">
                  {TABLE_COLORS.map(c => (
                    <button
                      key={c.name}
                      onMouseDown={(e) => { e.preventDefault(); applyColor(c.color) }}
                      className="notion-color-swatch"
                      title={c.name}
                    >
                      {c.color ? (
                        <span className="w-5 h-5 rounded-sm border border-border/50" style={{ background: c.color }} />
                      ) : (
                        <span className="w-5 h-5 rounded-sm border border-border/50 flex items-center justify-center text-muted-foreground relative">
                          <span className="absolute w-[1px] h-6 bg-destructive rotate-45" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-border my-1" />
            <MenuItem icon={Trash2} label="Eliminar tabla" onClick={() => { editor.chain().focus().deleteTable().run(); setOpen(false) }} danger />
          </div>
        </>
      )}
    </>,
    document.body
  )
}

// ─── Fixed Toolbar ──────────────────────────────────────────────────────────

export function FixedToolbar({ editor, onInsertImage, onOpenSlashMenu }) {
  // Re-render toolbar when editor state changes (cursor move, formatting, etc.)
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!editor) return
    const handler = () => forceUpdate(n => n + 1)
    editor.on('transaction', handler)
    return () => editor.off('transaction', handler)
  }, [editor])

  const [showColors, setShowColors] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [showStyleDropdown, setShowStyleDropdown] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPopoverPos, setLinkPopoverPos] = useState(null)
  const savedSelectionRef = useRef(null)
  const lastTextSelectionRef = useRef(null)
  const colorsRef = useRef(null)
  const highlightRef = useRef(null)
  const linkRef = useRef(null)
  const linkInputRef = useRef(null)
  const styleRef = useRef(null)

  // Track the last non-empty text selection continuously
  useEffect(() => {
    if (!editor) return
    const onSelectionUpdate = ({ editor: e }) => {
      const { from, to } = e.state.selection
      if (from !== to) {
        lastTextSelectionRef.current = { from, to }
      }
    }
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => editor.off('selectionUpdate', onSelectionUpdate)
  }, [editor])

  // No auto-focus on link input — keeps editor focused so selection stays visible

  // Dropdowns close via backdrop overlays, not document mousedown handler

  if (!editor) return null

  const closeAll = () => { setShowColors(false); setShowHighlight(false); setShowLinkPopover(false); setShowStyleDropdown(false) }

  const applyLink = (url) => {
    const sel = savedSelectionRef.current
    if (!url.trim() || !sel || sel.from === sel.to) return
    const href = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`
    // Set selection first (dispatches immediately), then apply link on that selection
    editor.commands.setTextSelection({ from: sel.from, to: sel.to })
    editor.commands.setLink({ href })
  }

  const getActiveStyle = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Título 1'
    if (editor.isActive('heading', { level: 2 })) return 'Título 2'
    if (editor.isActive('heading', { level: 3 })) return 'Título 3'
    return 'Texto normal'
  }

  const styles = [
    { label: 'Texto normal', action: () => editor.chain().focus().setParagraph().run(), active: !editor.isActive('heading'), cls: 'text-sm' },
    { label: 'Título 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), cls: 'text-xl font-bold' },
    { label: 'Título 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), cls: 'text-lg font-bold' },
    { label: 'Título 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), cls: 'text-base font-semibold' },
  ]

  const TBtn = ({ active, onClick, title, children }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )

  const Sep = () => <div className="w-px h-4 bg-border/60 mx-0.5" />

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border border-border/50 rounded-lg bg-muted/30 flex-wrap" onMouseDown={e => e.preventDefault()}>
      {/* Estilo de párrafo */}
      <div className="relative" ref={styleRef}>
        <button
          onMouseDown={(e) => { e.preventDefault(); closeAll(); setShowStyleDropdown(!showStyleDropdown) }}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors min-w-[100px]',
            showStyleDropdown ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          )}
        >
          <span className="truncate">{getActiveStyle()}</span>
          <ChevronDown className="w-3 h-3 shrink-0" />
        </button>
        {showStyleDropdown && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowStyleDropdown(false)} />
            <div
              className="fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl py-1 w-[180px] animate-scale-in"
              style={{ top: styleRef.current?.getBoundingClientRect().bottom + 6, left: styleRef.current?.getBoundingClientRect().left }}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
            >
              {styles.map(s => (
                <button
                  key={s.label}
                  onMouseDown={(e) => { e.preventDefault(); s.action(); setShowStyleDropdown(false) }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 transition-colors',
                    s.active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    s.cls
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
      </div>

      <Sep />

      {/* Negrita, Cursiva, Subrayado, Tachado */}
      <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
        <Bold className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
        <Italic className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado">
        <UnderlineIcon className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
        <Strikethrough className="w-3.5 h-3.5" />
      </TBtn>

      <Sep />

      {/* Color de texto */}
      <div className="relative" ref={colorsRef}>
        <TBtn active={showColors} onClick={() => { setShowHighlight(false); setShowLinkPopover(false); setShowStyleDropdown(false); setShowColors(prev => !prev) }} title="Color de texto">
          <Palette className="w-3.5 h-3.5" />
        </TBtn>
        {showColors && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowColors(false)} />
            <div
              className="fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl min-w-[170px] animate-scale-in"
              style={{ top: colorsRef.current?.getBoundingClientRect().bottom + 6, left: colorsRef.current?.getBoundingClientRect().left - 50 }}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">Color de texto</div>
              <div className="grid grid-cols-5 gap-1 p-2">
                {TEXT_COLORS.map(c => (
                  <button key={c.name} onMouseDown={(e) => { e.preventDefault(); c.color ? editor.chain().focus().setColor(c.color).run() : editor.chain().focus().unsetColor().run(); setShowColors(false) }} className="notion-color-swatch" title={c.name}>
                    <span style={{ color: c.color || 'var(--color-foreground)' }} className="text-sm font-bold">A</span>
                  </button>
                ))}
              </div>
            </div>
          </>, document.body
        )}
      </div>

      {/* Resaltado */}
      <div className="relative" ref={highlightRef}>
        <TBtn active={showHighlight} onClick={() => { setShowColors(false); setShowLinkPopover(false); setShowStyleDropdown(false); setShowHighlight(prev => !prev) }} title="Resaltado">
          <Highlighter className="w-3.5 h-3.5" />
        </TBtn>
        {showHighlight && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setShowHighlight(false)} />
            <div
              className="fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl min-w-[170px] animate-scale-in"
              style={{ top: highlightRef.current?.getBoundingClientRect().bottom + 6, left: highlightRef.current?.getBoundingClientRect().left - 50 }}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">Resaltado</div>
              <div className="grid grid-cols-5 gap-1 p-2">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c.name} onMouseDown={(e) => { e.preventDefault(); c.color ? editor.chain().focus().toggleHighlight({ color: c.color }).run() : editor.chain().focus().unsetHighlight().run(); setShowHighlight(false) }} className="notion-color-swatch" title={c.name}>
                    {c.color ? (
                      <span className="w-5 h-5 rounded-sm border border-border/50" style={{ background: c.color }} />
                    ) : (
                      <span className="w-5 h-5 rounded-sm border border-border/50 flex items-center justify-center text-muted-foreground relative">
                        <span className="absolute w-[1px] h-6 bg-destructive rotate-45" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>, document.body
        )}
      </div>

      <Sep />

      {/* Enlace */}
      <div className="relative" ref={linkRef}>
        <TBtn active={editor.isActive('link') || showLinkPopover} onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
          } else {
            const { from, to } = editor.state.selection
            const sel = from !== to ? { from, to } : lastTextSelectionRef.current
            savedSelectionRef.current = sel
            // Get coordinates of selected text to position popover near it
            if (sel) {
              const endCoords = editor.view.coordsAtPos(sel.to)
              setLinkPopoverPos({ top: endCoords.bottom + 6, left: endCoords.left })
            }
            setShowColors(false)
            setShowHighlight(false)
            setShowStyleDropdown(false)
            setShowLinkPopover(prev => !prev)
            setLinkUrl('')
          }
        }} title={editor.isActive('link') ? 'Quitar enlace' : 'Enlace'}>
          {editor.isActive('link') ? <Unlink className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
        </TBtn>
        {showLinkPopover && linkPopoverPos && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => { setShowLinkPopover(false); setLinkUrl(''); editor.commands.focus() }} />
            <div
              className="fixed z-[9999] rounded-xl border border-border bg-popover shadow-xl animate-scale-in p-3 w-[320px]"
              style={{
                top: linkPopoverPos.top,
                left: Math.max(8, Math.min(linkPopoverPos.left, window.innerWidth - 340)),
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background">
                  <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={linkInputRef}
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyLink(linkUrl)
                        setShowLinkPopover(false)
                        setLinkUrl('')
                      }
                      if (e.key === 'Escape') {
                        setShowLinkPopover(false)
                        setLinkUrl('')
                        editor.commands.focus()
                      }
                    }}
                    placeholder="Pegar o escribir un enlace..."
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyLink(linkUrl)
                    setShowLinkPopover(false)
                    setLinkUrl('')
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-accent transition-colors shrink-0"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>

      {/* Insertar imagen */}
      {onInsertImage && (
        <TBtn active={false} onClick={onInsertImage} title="Insertar imagen">
          <ImageIcon className="w-3.5 h-3.5" />
        </TBtn>
      )}

      <Sep />

      {/* Alineación */}
      <TBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinear izquierda">
        <AlignLeft className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar">
        <AlignCenter className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinear derecha">
        <AlignRight className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar">
        <AlignJustify className="w-3.5 h-3.5" />
      </TBtn>

      <Sep />

      {/* Listas */}
      <TBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista con viñetas">
        <List className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
        <CheckSquare className="w-3.5 h-3.5" />
      </TBtn>

      <Sep />

      {/* Sangría */}
      <TBtn active={false} onClick={() => {
        if (editor.can().sinkListItem('listItem')) {
          editor.chain().focus().sinkListItem('listItem').run()
        } else if (editor.can().sinkListItem('taskItem')) {
          editor.chain().focus().sinkListItem('taskItem').run()
        } else {
          const nodeType = editor.state.selection.$from.parent.type.name
          const current = parseInt(editor.getAttributes(nodeType).indent || '0')
          editor.chain().focus().updateAttributes(nodeType, { indent: current + 1 }).run()
        }
      }} title="Aumentar sangría">
        <IndentIncrease className="w-3.5 h-3.5" />
      </TBtn>
      <TBtn active={false} onClick={() => {
        if (editor.can().liftListItem('listItem')) {
          editor.chain().focus().liftListItem('listItem').run()
        } else if (editor.can().liftListItem('taskItem')) {
          editor.chain().focus().liftListItem('taskItem').run()
        } else {
          const nodeType = editor.state.selection.$from.parent.type.name
          const current = parseInt(editor.getAttributes(nodeType).indent || '0')
          if (current > 0) {
            editor.chain().focus().updateAttributes(nodeType, { indent: current - 1 }).run()
          }
        }
      }} title="Reducir sangría">
        <IndentDecrease className="w-3.5 h-3.5" />
      </TBtn>

      <Sep />

      {/* Limpiar formato */}
      <TBtn active={false} onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Limpiar formato">
        <RemoveFormatting className="w-3.5 h-3.5" />
      </TBtn>

      <Sep />

      {/* Insertar bloque (slash menu) */}
      {onOpenSlashMenu && (
        <TBtn active={false} onClick={onOpenSlashMenu} title="Insertar bloque">
          <Plus className="w-3.5 h-3.5" />
        </TBtn>
      )}
    </div>
  )
}

export default function BlockEditor({ value, onChange, placeholder, showFixedToolbar = false, onEditorReady, toolbarContainerRef }) {
  const [slashMenu, setSlashMenu] = useState(null)
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const slashMenuRef = useRef(null)
  const fileInputRef = useRef(null)
  const pendingAction = useRef(null)

  const getInitialContent = () => {
    if (!value) return ''
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) && parsed[0]?.type) {
        return blocksToHtml(parsed)
      }
    } catch {}
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
        addNodeView() { return ReactNodeViewRenderer(CodeBlockComponent) },
      }).configure({ lowlight }),
      Placeholder.configure({
        placeholder: placeholder || "Escribe '/' para ver comandos...",
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExt.extend({
        addNodeView() { return ReactNodeViewRenderer(ImageNodeView) },
      }).configure({ inline: false }),
      // New extensions
      TiptapUnderline,
      TiptapHighlight.configure({ multicolor: true }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'notion-link' },
      }),
      TextStyle,
      FontSizeExtension,
      IndentExtension,
      TiptapColor,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            backgroundColor: {
              default: null,
              parseHTML: el => el.style.backgroundColor || null,
              renderHTML: attrs => attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
            },
          }
        },
      }),
      TableHeader.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            backgroundColor: {
              default: null,
              parseHTML: el => el.style.backgroundColor || null,
              renderHTML: attrs => attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
            },
          }
        },
      }),
      // Custom blocks
      Callout,
      ToggleBlock,
    ],
    content: getInitialContent(),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60px] notion-editor-content',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !slashMenu) {
          setTimeout(() => {
            const { from } = view.state.selection
            const coords = view.coordsAtPos(from)
            setSlashMenu({ x: coords.left, y: coords.bottom + 4 })
            setSlashFilter('')
            setSelectedIndex(0)
          }, 10)
        }

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
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML())
    },
  })

  // Notify parent when editor is ready (optional)
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor)
  }, [editor])

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

  const filteredItems = SLASH_ITEMS.filter(item => {
    const q = normalize(slashFilter)
    return normalize(item.label).includes(q) || (item.keywords && normalize(item.keywords).includes(q))
  })

  const selectSlashItem = useCallback((item) => {
    if (!item || !editor) return

    const { from } = editor.state.selection
    const searchLen = slashFilter.length + 1
    if (searchLen > 0 && from >= searchLen) {
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - searchLen), from)
      const slashPos = textBefore.lastIndexOf('/')
      if (slashPos >= 0) {
        const deleteFrom = from - (textBefore.length - slashPos)
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run()
      }
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
          html = `<p><a href="${url}" target="_blank" rel="noopener noreferrer">📎 ${file.name} (${size})</a></p><p></p>`
        }
        editor.chain().insertContent(html).focus('end').run()
      }
    }
    setUploading(false)
    pendingAction.current = null
  }

  const groups = {}
  filteredItems.forEach(item => {
    if (!groups[item.group]) groups[item.group] = []
    groups[item.group].push(item)
  })
  let flatIdx = -1

  return (
    <div className="block-editor relative">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      {/* Fixed toolbar - portal to external container if provided, otherwise sticky inside */}
      {showFixedToolbar && (() => {
        const toolbarContent = (
          <FixedToolbar editor={editor} onInsertImage={() => fileInputRef.current?.click()} onOpenSlashMenu={() => {
            editor.commands.focus()
            setTimeout(() => {
              const { from } = editor.state.selection
              const coords = editor.view.coordsAtPos(from)
              setSlashMenu({ x: coords.left, y: coords.bottom + 4 })
              setSlashFilter('')
              setSelectedIndex(0)
            }, 0)
          }} />
        )
        if (toolbarContainerRef?.current) {
          return createPortal(toolbarContent, toolbarContainerRef.current)
        }
        return <div className="sticky top-0 z-10 bg-background pb-3">{toolbarContent}</div>
      })()}

      {/* Table settings icon (floating near table) */}
      {showFixedToolbar && editor && <TableSettings editor={editor} />}

      {uploading && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Subiendo archivo...
        </div>
      )}

      {/* Bubble menu (only when no fixed toolbar) */}
      {!showFixedToolbar && editor && <EditorBubbleMenu editor={editor} />}

      <EditorContent editor={editor} />

      {/* Slash command menu */}
      {slashMenu && filteredItems.length > 0 && (
        <div
          ref={slashMenuRef}
          className="fixed z-[200] w-72 max-h-[400px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover shadow-xl py-1 animate-scale-in"
          style={{
            left: Math.min(slashMenu.x, window.innerWidth - 290),
            top: Math.min(slashMenu.y, window.innerHeight - 400),
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
                      'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                      selectedIndex === idx ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted border border-border/50 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-foreground font-medium">{item.label}</div>
                      {item.shortcut && <div className="text-[10px] text-muted-foreground font-mono">{item.shortcut}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
          <div className="px-3 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">↑↓</kbd> Navegar</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">↵</kbd> Seleccionar</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">esc</kbd> Cerrar</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
