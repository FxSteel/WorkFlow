import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Settings2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { usePermissions } from '../../hooks/usePermissions'

export default function StatusConfigModal({ open, onClose, boardId: propBoardId }) {
  const { state, dispatch } = useApp()
  const { createBoardStatus, updateBoardStatus, deleteBoardStatus, fetchBoardStatuses } = useSupabase()
  const { can } = usePermissions()
  const canEditStatuses = can('editStatuses')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [showNewForm, setShowNewForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [localStatuses, setLocalStatuses] = useState([])

  const boardId = propBoardId || state.currentBoard?.id
  const isSameBoard = boardId === state.currentBoard?.id

  useEffect(() => {
    if (open && boardId && !isSameBoard) {
      supabase
        .from('board_statuses')
        .select('*')
        .eq('board_id', boardId)
        .order('position')
        .then(({ data }) => setLocalStatuses(data || []))
    }
  }, [open, boardId, isSameBoard])

  if (!open) return null

  const statuses = isSameBoard ? (state.boardStatuses || []) : localStatuses

  const handleUpdateName = async (id) => {
    if (!canEditStatuses || !editName.trim()) { setEditingId(null); return }
    const status = statuses.find(s => s.id === id)
    if (status && editName.trim() !== status.name) {
      const oldName = status.name
      const newName = editName.trim()
      // Update the status name
      await updateBoardStatus(id, { name: newName })
      // Update all tasks that had the old status name
      await supabase
        .from('tasks')
        .update({ status: newName })
        .eq('board_id', boardId)
        .eq('status', oldName)
      // Update tasks in local state
      const updatedTasks = (state.tasks || []).map(t =>
        t.board_id === boardId && t.status === oldName ? { ...t, status: newName } : t
      )
      dispatch({ type: 'SET_TASKS', payload: updatedTasks })
      toast.success('Estado actualizado')
    }
    setEditingId(null)
    setEditName('')
  }

  const handleUpdateColor = async (id, color) => {
    if (!canEditStatuses) return
    await updateBoardStatus(id, { color })
    toast.success('Color actualizado')
  }

  const handleCreate = async () => {
    if (!canEditStatuses || !newName.trim() || !boardId) return
    await createBoardStatus(boardId, newName.trim(), newColor, statuses.length)
    toast.success('Estado creado')
    setNewName('')
    setNewColor('#3b82f6')
    setShowNewForm(false)
  }

  const handleDelete = async (id) => {
    if (!canEditStatuses) return
    await deleteBoardStatus(id)
    toast.success('Estado eliminado')
    setDeleteConfirm(null)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-popover border border-border rounded-xl w-[420px] max-h-[80vh] flex flex-col shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Configurar estados</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {statuses.map((status, index) => (
            <div key={status.id} className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors">
              {/* Color dot — click to change */}
              <label className="relative w-5 h-5 rounded-full shrink-0 cursor-pointer ring-2 ring-offset-2 ring-offset-popover ring-transparent hover:ring-foreground/20 transition-all overflow-hidden" style={{ backgroundColor: status.color }}>
                <input
                  type="color"
                  value={status.color}
                  onChange={(e) => handleUpdateColor(status.id, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>

              {/* Name — click to edit */}
              {editingId === status.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleUpdateName(status.id)
                    if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                  }}
                  onBlur={() => handleUpdateName(status.id)}
                  className="flex-1 px-2 py-0.5 text-sm bg-background border border-ring rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <button
                  onClick={() => { setEditingId(status.id); setEditName(status.name) }}
                  className="flex-1 text-left text-sm text-foreground hover:text-foreground/80 transition-colors"
                >
                  {status.name}
                </button>
              )}

              {/* Delete */}
              {deleteConfirm === status.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(status.id)}
                    className="text-[10px] px-2 py-0.5 rounded bg-destructive text-white hover:bg-destructive/90"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(status.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new status */}
        <div className="px-5 py-3 border-t border-border">
          {showNewForm ? (
            <div className="flex items-center gap-2">
              <label className="relative w-5 h-5 rounded-full shrink-0 cursor-pointer overflow-hidden" style={{ backgroundColor: newColor }}>
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') { setShowNewForm(false); setNewName('') }
                }}
                placeholder="Nombre del estado..."
                className="flex-1 px-2 py-1 text-sm bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleCreate}
                className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Crear
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewName('') }}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar estado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
