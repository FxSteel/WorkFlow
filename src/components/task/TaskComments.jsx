import { useState, useEffect, useRef, useCallback } from 'react'
import { Paperclip, AtSign, Send, Loader2, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

export default function TaskComments({ taskId }) {
  const { user } = useAuth()
  const { state } = useApp()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState([]) // { file, uploading, url, name }
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [cursorPos, setCursorPos] = useState(null)
  const inputRef = useRef(null)
  const mentionRef = useRef(null)
  const fileInputRef = useRef(null)

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userAvatar = user?.user_metadata?.avatar_url

  // Fetch comments
  useEffect(() => {
    if (!taskId) return
    fetchComments()
  }, [taskId])

  const fetchComments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
    setLoading(false)
  }

  // Close mentions on outside click
  useEffect(() => {
    const close = (e) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target)) setShowMentions(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filteredMembers = state.members.filter(m =>
    m.name.toLowerCase().includes(mentionFilter.toLowerCase())
  )

  const handleTextChange = (e) => {
    const val = e.target.value
    setText(val)

    // Detect @mention
    const pos = e.target.selectionStart
    const textBefore = val.substring(0, pos)
    const atIndex = textBefore.lastIndexOf('@')

    if (atIndex >= 0 && (atIndex === 0 || textBefore[atIndex - 1] === ' ')) {
      const filter = textBefore.substring(atIndex + 1)
      if (!filter.includes(' ')) {
        setMentionFilter(filter)
        setShowMentions(true)
        setMentionIndex(0)
        setCursorPos(atIndex)
        return
      }
    }
    setShowMentions(false)
  }

  const insertMention = (member) => {
    if (cursorPos === null) return
    const before = text.substring(0, cursorPos)
    const afterAt = text.substring(cursorPos).indexOf(' ')
    const after = afterAt >= 0 ? text.substring(cursorPos + afterAt) : ''
    const newText = `${before}@${member.name} ${after}`
    setText(newText)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(prev => Math.min(prev + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' && filteredMembers[mentionIndex]) {
        e.preventDefault()
        insertMention(filteredMembers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowMentions(false)
        return
      }
    }

    // Cmd/Ctrl+Enter to send
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      setAttachments(prev => [...prev, { file, uploading: false, url: null, name: file.name, size: file.size }])
    })
    e.target.value = ''
  }

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const uploadAttachment = async (file) => {
    const ext = file.name.split('.').pop()
    const path = `comments/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('attachments').getPublicUrl(path)
    return data?.publicUrl || null
  }

  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return
    if (!taskId) return

    setSending(true)

    // Upload attachments
    const uploadedFiles = []
    for (const att of attachments) {
      const url = await uploadAttachment(att.file)
      if (url) {
        uploadedFiles.push({ url, name: att.name, size: att.size })
      }
    }

    // Extract @mentions
    const mentions = []
    const mentionRegex = /@(\S+)/g
    let match
    while ((match = mentionRegex.exec(text)) !== null) {
      const member = state.members.find(m => m.name === match[1])
      if (member) mentions.push({ id: member.id, name: member.name })
    }

    const { error } = await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: user.id,
      user_name: userName,
      user_avatar: userAvatar || null,
      content: text.trim(),
      attachments: uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : null,
      mentions: mentions.length > 0 ? JSON.stringify(mentions) : null,
    })

    if (!error) {
      setText('')
      setAttachments([])
      fetchComments()
    }
    setSending(false)
  }

  const timeAgo = (dateStr) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return 'Ahora mismo'
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)}d`
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  const renderContent = (content) => {
    // Highlight @mentions
    return content.split(/(@\S+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">
            {part}
          </span>
        )
      }
      return part
    })
  }

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)

  if (!taskId) return null

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Comentarios {comments.length > 0 && `(${comments.length})`}
      </h4>

      {/* Comments list */}
      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Cargando...</div>
      ) : (
        <div className="space-y-4 mb-4">
          {comments.map(comment => {
            const files = comment.attachments ? JSON.parse(comment.attachments) : []
            return (
              <div key={comment.id} className="flex items-start gap-2.5">
                {comment.user_avatar ? (
                  <img src={comment.user_avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground shrink-0">
                    {comment.user_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{comment.user_name}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {renderContent(comment.content)}
                  </p>
                  {/* Attachments */}
                  {files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.map((file, i) => (
                        isImage(file.name) ? (
                          <a key={i} href={file.url} target="_blank" rel="noopener noreferrer">
                            <img src={file.url} alt={file.name} className="max-w-[200px] max-h-[150px] rounded-lg border border-border object-cover" />
                          </a>
                        ) : (
                          <a
                            key={i}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-accent transition-colors text-sm"
                          >
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground truncate max-w-[150px]">{file.name}</span>
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Comment input */}
      <div className="flex items-start gap-2.5">
        {userAvatar ? (
          <img src={userAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground shrink-0 mt-1">
            {userName[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 rounded-lg border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring transition-all">
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate max-w-[120px] text-foreground">{att.name}</span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text input with mentions */}
          <div className="relative" ref={mentionRef}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribiendo nuevo comentario..."
              rows={2}
              className="w-full px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground resize-none"
            />

            {/* Mentions dropdown */}
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-48 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in z-50">
                {filteredMembers.map((member, i) => (
                  <button
                    key={member.id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(member) }}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                      mentionIndex === i ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: member.color || '#6c5ce7' }}
                    >
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-foreground truncate">{member.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-border">
            <div className="flex items-center gap-1">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Adjuntar archivo"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setText(prev => prev + '@')
                  inputRef.current?.focus()
                  setShowMentions(true)
                  setMentionFilter('')
                  setCursorPos(text.length)
                }}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Mencionar usuario"
              >
                <AtSign className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && attachments.length === 0)}
              className={cn(
                'p-1.5 rounded-full transition-colors',
                text.trim() || attachments.length > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground'
              )}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
