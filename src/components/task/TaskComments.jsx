import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Paperclip, AtSign, Send, Loader2, X, FileText, Image as ImageIcon, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { useNotifications } from '../../hooks/useNotifications'
import { toast } from 'sonner'
import { usePermissions } from '../../hooks/usePermissions'

export default function TaskComments({ taskId }) {
  const { user } = useAuth()
  const { state } = useApp()
  const { can } = usePermissions()
  const canComment = can('comment')
  const { notifyMention, notifyComment } = useNotifications()
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

  const filteredMembers = state.orgMembers.filter(m =>
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
    if (!canComment) return
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

    // Extract @mentions by matching member names in the text
    const mentions = []
    state.orgMembers.forEach(member => {
      if (text.includes(`@${member.name}`)) {
        mentions.push({ id: member.id, name: member.name })
      }
    })

    const { error } = await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: user.id,
      user_name: userName,
      user_avatar: userAvatar || null,
      content: text.trim(),
      attachments: uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : null,
      mentions: mentions.length > 0 ? JSON.stringify(mentions) : null,
    })

    if (error) {
      console.error('Comment insert error:', error.message, error.code)
      toast.error('Error al publicar comentario')
    }

    if (!error) {
      toast.success('Comentario publicado')
      // Send notifications for @mentions
      for (const mentioned of mentions) {
        const member = state.orgMembers.find(m => m.id === mentioned.id)
        const task = state.tasks.find(t => t.id === taskId)
        if (member) {
          notifyMention({
            mentionedMember: member,
            taskTitle: task?.title || '',
            taskId,
            fromUser: user,
            workspaceId: state.currentWorkspace?.id,
          })
        }
      }

      // Notify task assignee about comment (if not the commenter)
      const task = state.tasks.find(t => t.id === taskId)
      if (task?.assignee_id) {
        const assigneeMember = state.orgMembers.find(m => m.id === task.assignee_id)
        notifyComment({ task, fromUser: user, workspaceId: state.currentWorkspace?.id, assigneeMember })
      }

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
    // Build regex from member names to match full names after @
    const memberNames = state.orgMembers.map(m => m.name).filter(Boolean).sort((a, b) => b.length - a.length)
    if (memberNames.length === 0) return content

    const pattern = new RegExp(`(@(?:${memberNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
    const parts = content.split(pattern)

    return parts.map((part, i) => {
      if (part.startsWith('@') && memberNames.some(n => part === `@${n}`)) {
        return (
          <span key={i} className="inline-flex items-center gap-0.5 bg-blue-500/20 text-blue-500 dark:text-blue-400 font-medium rounded-full px-1.5 py-0 text-[13px]">
            {part}
          </span>
        )
      }
      return part
    })
  }

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)

  if (!taskId) return null

  const [expanded, setExpanded] = useState(false)
  const hasHidden = comments.length > 2
  const visibleComments = hasHidden && !expanded ? comments.slice(-2) : comments
  const hiddenCount = comments.length - 2

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
          {/* Show older comments toggle */}
          {hasHidden && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ocultar comentarios anteriores
                </>
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  Ver {hiddenCount} comentario{hiddenCount > 1 ? 's' : ''} anterior{hiddenCount > 1 ? 'es' : ''}
                </>
              )}
            </button>
          )}

          {visibleComments.map(comment => {
            const files = comment.attachments ? JSON.parse(comment.attachments) : []
            const commentMember = state.orgMembers.find(m => m.user_id === comment.user_id)
            const commentAvatar = commentMember?.avatar_url || comment.user_avatar
            const commentColor = commentMember?.color || '#6c5ce7'
            return (
              <div key={comment.id} className="flex items-start gap-2.5">
                {commentAvatar ? (
                  <img src={commentAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: commentColor }}
                  >
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
      {canComment && <div className="flex items-start gap-2.5">
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
          <div ref={mentionRef}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribiendo nuevo comentario..."
              rows={2}
              className="w-full px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Mentions dropdown - portal */}
          {showMentions && filteredMembers.length > 0 && createPortal(
            <div
              ref={mentionRef}
              className="fixed z-[200] w-72 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl animate-scale-in"
              style={{
                left: (() => {
                  const r = inputRef.current?.getBoundingClientRect()
                  return r ? Math.min(r.left, window.innerWidth - 290) : 0
                })(),
                top: (() => {
                  const r = inputRef.current?.getBoundingClientRect()
                  return r ? r.top - Math.min(filteredMembers.length * 44 + 32, 260) - 8 : 0
                })(),
              }}
            >
              <div className="px-3 py-2 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Miembros</span>
              </div>
              {filteredMembers.map((member, i) => (
                <button
                  key={member.id}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(member) }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 transition-colors',
                    mentionIndex === i ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: member.color || '#6c5ce7' }}
                    >
                      {member.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                    {member.email && <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>}
                  </div>
                </button>
              ))}
            </div>,
            document.body
          )}

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
      </div>}
    </div>
  )
}
