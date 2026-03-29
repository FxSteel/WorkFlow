import { useState, useEffect, useRef } from 'react'
import { FileText, Loader2, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import BlockEditor from '../ui/BlockEditor'

export default function NotesPage() {
  const { user } = useAuth()
  const { state } = useApp()
  const { fetchUserNotes, saveUserNotes } = useSupabase()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!user || !state.currentOrg) return
    setLoading(true)
    fetchUserNotes(user.id, state.currentOrg.id).then(data => {
      setContent(data?.content || '')
      setLoading(false)
    })
  }, [user?.id, state.currentOrg?.id])

  const handleChange = (val) => {
    setContent(val)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await saveUserNotes(user.id, state.currentOrg.id, val)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    }, 800)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Notas</h1>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">
        <BlockEditor
          value={content}
          onChange={handleChange}
          placeholder="Escribe tus notas aquí... Usa '/' para ver comandos"
        />
      </div>
    </div>
  )
}
