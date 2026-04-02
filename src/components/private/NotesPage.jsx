import { useState, useEffect, useRef } from 'react'
import { FileText, Loader2, Check, Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import BlockEditor from '../ui/BlockEditor'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const month = months[d.getMonth()]
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${month} ${day}, ${hours}:${mins}`
}

export default function NotesPage() {
  const { user } = useAuth()
  const { state } = useApp()
  const { fetchNote, saveNote, updateNote } = useSupabase()
  const [note, setNote] = useState(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const saveTimer = useRef(null)
  const titleTimer = useRef(null)

  const noteId = state.currentBoard?.noteId

  useEffect(() => {
    if (!noteId) { setLoading(false); return }
    setLoading(true)
    setContent('')
    setTitle('')
    fetchNote(noteId).then(data => {
      if (data) {
        setNote(data)
        setContent(data.content || '')
        setTitle(data.title || 'Sin título')
      }
      setLoading(false)
    })
  }, [noteId])

  const handleChange = (val) => {
    setContent(val)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const result = await saveNote(noteId, val)
      if (result) setNote(prev => ({ ...prev, updated_at: result.updated_at }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    }, 800)
  }

  const handleTitleChange = (e) => {
    const val = e.target.value
    setTitle(val)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      if (val.trim()) {
        const result = await updateNote(noteId, { title: val.trim() })
        if (result) setNote(prev => ({ ...prev, updated_at: result.updated_at }))
      }
    }, 800)
  }

  // Find creator from org members
  const creator = state.orgMembers.find(m => m.user_id === note?.user_id)
  const creatorName = creator?.full_name || creator?.email || 'Usuario'
  const creatorAvatar = creator?.avatar_url

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!noteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Selecciona o crea una nota</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[900px] px-16 py-12">
          {/* Title */}
          <div className="flex items-center justify-between mb-3">
            <input
              value={title}
              onChange={handleTitleChange}
              maxLength={50}
              className="text-3xl font-bold text-foreground bg-transparent border-none outline-none flex-1 min-w-0"
              placeholder="Sin título"
            />
            <div className="flex items-center gap-2 shrink-0">
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs">Guardando...</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Guardado</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8">
            <div className="flex items-center gap-2">
              {creatorAvatar ? (
                <img src={creatorAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                  {creatorName?.[0]?.toUpperCase()}
                </div>
              )}
              <span>Creador <span className="font-semibold text-foreground">{creatorName}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Creado <span className="font-semibold text-foreground">{formatDate(note?.created_at)}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Última actualización <span className="font-semibold text-foreground">{formatDate(note?.updated_at)}</span></span>
            </div>
          </div>

          {/* Editor */}
          <BlockEditor
            value={content}
            onChange={handleChange}
            placeholder="Escribe tus notas aquí... Usa '/' para ver comandos"
          />
        </div>
      </div>
    </div>
  )
}
