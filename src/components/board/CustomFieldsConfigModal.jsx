import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, Type, Hash, Calendar, ChevronDown, DollarSign, Pencil, ArrowUp, ArrowDown, Share2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

const FIELD_TYPES = [
  { value: 'text', label: 'Texto', icon: Type },
  { value: 'number', label: 'Número', icon: Hash },
  { value: 'date', label: 'Fecha', icon: Calendar },
  { value: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { value: 'price', label: 'Precio', icon: DollarSign },
]

export default function CustomFieldsConfigModal({ open, onClose, boardId: propBoardId }) {
  const { state, dispatch } = useApp()
  const { createCustomField, updateCustomField, deleteCustomField, addCustomFieldOption, deleteCustomFieldOption, fetchCustomFields } = useSupabase()
  const [mode, setMode] = useState('list') // list | create | edit | share
  const [editingField, setEditingField] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'text', options: [] })
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [newOptionColor, setNewOptionColor] = useState('#6b7280')
  const [confirmDelete, setConfirmDelete] = useState(null) // field to delete
  const [shareField, setShareField] = useState(null)
  const [allBoards, setAllBoards] = useState([])
  const [selectedBoards, setSelectedBoards] = useState([])
  const [sharingLoading, setSharingLoading] = useState(false)

  const boardId = propBoardId || state.currentBoard?.id
  const [localFields, setLocalFields] = useState([])

  useEffect(() => {
    if (open && boardId) {
      // Fetch fields for the specific board (might be different from current board)
      supabase
        .from('custom_fields')
        .select('*, custom_field_options(*)')
        .eq('board_id', boardId)
        .order('position')
        .then(({ data }) => setLocalFields(data || []))
    }
  }, [open, boardId])

  if (!open) return null

  const fields = boardId === state.currentBoard?.id ? (state.customFields || []) : localFields

  const resetForm = () => {
    setForm({ name: '', type: 'text', options: [] })
    setNewOptionLabel('')
    setNewOptionColor('#6b7280')
    setEditingField(null)
    setShareField(null)
    setMode('list')
  }

  const refreshFields = () => {
    if (boardId === state.currentBoard?.id) {
      fetchCustomFields(boardId)
    } else {
      supabase
        .from('custom_fields')
        .select('*, custom_field_options(*)')
        .eq('board_id', boardId)
        .order('position')
        .then(({ data }) => setLocalFields(data || []))
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !boardId) return
    const { error } = await createCustomField(boardId, {
      name: form.name.trim(),
      type: form.type,
      position: fields.length,
      options: form.options,
    })
    if (error) toast.error('Error al crear campo')
    else { toast.success('Campo creado'); resetForm(); refreshFields() }
  }

  const handleUpdate = async () => {
    if (!editingField || !form.name.trim()) return
    await updateCustomField(editingField.id, { name: form.name.trim() })
    // Handle dropdown options: delete removed, add new
    if (editingField.type === 'dropdown') {
      const existingIds = (editingField.custom_field_options || []).map(o => o.id)
      const currentIds = form.options.filter(o => o.id).map(o => o.id)
      // Delete removed options
      for (const id of existingIds) {
        if (!currentIds.includes(id)) await deleteCustomFieldOption(id)
      }
      // Add new options
      for (const opt of form.options) {
        if (!opt.id) await addCustomFieldOption(editingField.id, opt.label, opt.color, opt.position || 0)
      }
    }
    toast.success('Campo actualizado')
    resetForm()
    refreshFields()
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    const { error } = await deleteCustomField(confirmDelete.id)
    if (!error) toast.success('Campo eliminado')
    else toast.error('Error al eliminar')
    setConfirmDelete(null)
  }

  const startEdit = (field) => {
    setEditingField(field)
    setForm({
      name: field.name,
      type: field.type,
      options: (field.custom_field_options || []).map(o => ({ ...o })),
    })
    setMode('edit')
  }

  const handleAddOption = () => {
    if (!newOptionLabel.trim()) return
    setForm(prev => ({
      ...prev,
      options: [...prev.options, { label: newOptionLabel.trim(), color: newOptionColor, position: prev.options.length }]
    }))
    setNewOptionLabel('')
    setNewOptionColor('#6b7280')
  }

  const removeOption = (idx) => {
    setForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))
  }

  const moveField = (idx, direction) => {
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= fields.length) return
    const a = fields[idx]
    const b = fields[targetIdx]
    // Optimistic: swap in local state immediately
    const reordered = [...fields]
    reordered[idx] = { ...b, position: idx }
    reordered[targetIdx] = { ...a, position: targetIdx }
    dispatch({ type: 'SET_CUSTOM_FIELDS', payload: reordered })
    // Save to DB in background
    updateCustomField(a.id, { position: targetIdx })
    updateCustomField(b.id, { position: idx })
  }

  const startShare = async (field) => {
    setShareField(field)
    setMode('share')
    setSelectedBoards([])
    // Fetch all boards from all workspaces in the org
    const orgId = state.currentOrg?.id
    if (!orgId) return
    const { data: workspaces } = await supabase.from('workspaces').select('id, name').eq('org_id', orgId)
    if (!workspaces) return
    const wsIds = workspaces.map(w => w.id)
    const { data: boards } = await supabase.from('boards').select('id, name, workspace_id').in('workspace_id', wsIds)
    if (!boards) return
    // Also fetch existing custom_fields in other boards with same name to show as "already shared"
    const { data: existingFields } = await supabase
      .from('custom_fields')
      .select('board_id')
      .eq('name', field.name)
      .eq('type', field.type)
    const existingBoardIds = (existingFields || []).map(f => f.board_id)
    setAllBoards(boards.map(b => ({
      ...b,
      workspaceName: workspaces.find(w => w.id === b.workspace_id)?.name || '',
      alreadyShared: existingBoardIds.includes(b.id),
    })).filter(b => b.id !== boardId)) // Exclude current board
  }

  const handleShare = async () => {
    if (!shareField || selectedBoards.length === 0) return
    setSharingLoading(true)
    let count = 0
    for (const targetBoardId of selectedBoards) {
      const { data, error } = await createCustomField(targetBoardId, {
        name: shareField.name,
        type: shareField.type,
        position: 0,
        options: (shareField.custom_field_options || []).map(o => ({
          label: o.label,
          color: o.color,
          position: o.position,
        })),
      })
      if (!error) count++
    }
    setSharingLoading(false)
    if (count > 0) toast.success(`Campo compartido en ${count} tablero${count > 1 ? 's' : ''}`)
    resetForm()
  }

  const toggleBoardSelection = (boardId) => {
    setSelectedBoards(prev =>
      prev.includes(boardId) ? prev.filter(id => id !== boardId) : [...prev, boardId]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[440px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {mode === 'list' ? 'Campos personalizados' : mode === 'create' ? 'Nuevo campo' : mode === 'share' ? 'Compartir campo' : 'Editar campo'}
          </h2>
          <button onClick={() => mode === 'list' ? onClose() : resetForm()} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'list' && (
            <div className="space-y-1.5">
              {fields.map((field, idx) => {
                const TypeIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon || Type
                return (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 group transition-colors"
                  >
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-20"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === fields.length - 1}
                        className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-20"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <TypeIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{field.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {FIELD_TYPES.find(t => t.value === field.type)?.label}
                    </span>
                    <button
                      onClick={() => startEdit(field)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Editar"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(field)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => startShare(field)}
                      className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Compartir en otros tableros"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No hay campos personalizados.</p>
              )}
            </div>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del campo"
                  maxLength={50}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {mode === 'create' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FIELD_TYPES.map(ft => {
                      const Icon = ft.icon
                      return (
                        <button
                          key={ft.value}
                          onClick={() => setForm(prev => ({ ...prev, type: ft.value, options: ft.value === 'dropdown' ? prev.options : [] }))}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[11px] transition-colors ${
                            form.type === ft.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/30 border border-border text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {ft.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Dropdown options editor */}
              {(form.type === 'dropdown') && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Opciones</label>
                  <div className="space-y-1.5 mb-2">
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <label className="relative w-5 h-5 shrink-0 cursor-pointer">
                          <span className="absolute inset-0 rounded-full" style={{ backgroundColor: opt.color }} />
                          <input
                            type="color"
                            value={opt.color}
                            onChange={e => {
                              const opts = [...form.options]
                              opts[i] = { ...opts[i], color: e.target.value }
                              setForm(prev => ({ ...prev, options: opts }))
                            }}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          />
                        </label>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: opt.color }}>
                          {opt.label}
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => removeOption(i)} className="p-0.5 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="relative w-5 h-5 shrink-0 cursor-pointer">
                      <span className="absolute inset-0 rounded-full" style={{ backgroundColor: newOptionColor }} />
                      <input
                        type="color"
                        value={newOptionColor}
                        onChange={e => setNewOptionColor(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <input
                      value={newOptionLabel}
                      onChange={e => setNewOptionLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddOption()}
                      placeholder="Nueva opción..."
                      className="flex-1 px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <button onClick={handleAddOption} className="px-2.5 py-1.5 text-xs bg-muted hover:bg-accent text-foreground rounded-md transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={mode === 'create' ? handleCreate : handleUpdate}
                  disabled={!form.name.trim()}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {mode === 'create' ? 'Crear campo' : 'Guardar cambios'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {mode === 'share' && shareField && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                <Share2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{shareField.name}</p>
                  <p className="text-xs text-muted-foreground">Selecciona los tableros donde quieres agregar este campo</p>
                </div>
              </div>

              {allBoards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay otros tableros disponibles.</p>
              ) : (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {/* Group by workspace */}
                  {[...new Set(allBoards.map(b => b.workspace_id))].map(wsId => {
                    const wsBoards = allBoards.filter(b => b.workspace_id === wsId)
                    const wsName = wsBoards[0]?.workspaceName || 'Sin espacio'
                    return (
                      <div key={wsId}>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">{wsName}</p>
                        {wsBoards.map(board => (
                          <button
                            key={board.id}
                            onClick={() => !board.alreadyShared && toggleBoardSelection(board.id)}
                            disabled={board.alreadyShared}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                              board.alreadyShared
                                ? 'opacity-50 cursor-not-allowed'
                                : selectedBoards.includes(board.id)
                                  ? 'bg-primary/10 border border-primary/30'
                                  : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              selectedBoards.includes(board.id)
                                ? 'bg-primary border-primary'
                                : board.alreadyShared
                                  ? 'bg-muted border-muted-foreground/30'
                                  : 'border-border'
                            }`}>
                              {(selectedBoards.includes(board.id) || board.alreadyShared) && (
                                <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              )}
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
                            <span className="text-sm text-foreground">{board.name}</span>
                            {board.alreadyShared && (
                              <span className="text-[10px] text-muted-foreground ml-auto">Ya agregado</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleShare}
                  disabled={selectedBoards.length === 0 || sharingLoading}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {sharingLoading ? 'Compartiendo...' : `Compartir en ${selectedBoards.length || 0} tablero${selectedBoards.length !== 1 ? 's' : ''}`}
                </button>
                <button
                  onClick={resetForm}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'list' && (
          <div className="px-5 py-3 border-t border-border">
            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar campo
            </button>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-[380px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Eliminar campo</h3>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              ¿Estás seguro de que deseas eliminar el campo <strong className="text-foreground">"{confirmDelete.name}"</strong>?
            </p>
            <p className="text-xs text-muted-foreground mb-5">
              Se eliminarán todos los valores asociados a este campo en todas las tareas de este tablero.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 px-3 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Eliminar campo
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
