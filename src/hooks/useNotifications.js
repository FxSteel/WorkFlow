import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useNotifications() {

  const sendNotification = useCallback(async ({
    userId,
    type,
    title,
    message,
    workspaceId,
    taskId,
    fromUserName,
    fromUserAvatar,
  }) => {
    if (!userId) return
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message: message || '',
      workspace_id: workspaceId || null,
      task_id: taskId || null,
      from_user_name: fromUserName || '',
      from_user_avatar: fromUserAvatar || null,
      read: false,
    })
  }, [])

  const notifyTaskAssigned = useCallback(async ({ task, assigneeMember, fromUser, workspaceId }) => {
    if (!assigneeMember?.user_id || assigneeMember.user_id === fromUser?.id) return
    await sendNotification({
      userId: assigneeMember.user_id,
      type: 'task_assigned',
      title: 'Nueva tarea asignada',
      message: `${fromUser?.user_metadata?.full_name || fromUser?.email} te asignó la tarea "${task.title || 'Sin título'}"`,
      workspaceId,
      taskId: task.id,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })
  }, [sendNotification])

  const notifyMention = useCallback(async ({ mentionedMember, taskTitle, taskId, fromUser, workspaceId }) => {
    if (!mentionedMember?.user_id || mentionedMember.user_id === fromUser?.id) return
    await sendNotification({
      userId: mentionedMember.user_id,
      type: 'mention',
      title: 'Te mencionaron en un comentario',
      message: `${fromUser?.user_metadata?.full_name || fromUser?.email} te mencionó en "${taskTitle}"`,
      workspaceId,
      taskId,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })
  }, [sendNotification])

  const notifyComment = useCallback(async ({ task, fromUser, workspaceId, assigneeMember }) => {
    if (!assigneeMember?.user_id || assigneeMember.user_id === fromUser?.id) return
    await sendNotification({
      userId: assigneeMember.user_id,
      type: 'comment',
      title: 'Nuevo comentario en tu tarea',
      message: `${fromUser?.user_metadata?.full_name || fromUser?.email} comentó en "${task.title}"`,
      workspaceId,
      taskId: task.id,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })
  }, [sendNotification])

  const notifyStatusChange = useCallback(async ({ task, assigneeMember, newStatus, fromUser, workspaceId }) => {
    if (!assigneeMember?.user_id || assigneeMember.user_id === fromUser?.id) return
    await sendNotification({
      userId: assigneeMember.user_id,
      type: 'status_change',
      title: 'Estado de tarea actualizado',
      message: `${fromUser?.user_metadata?.full_name || fromUser?.email} cambió el estado de "${task.title}" a "${newStatus}"`,
      workspaceId,
      taskId: task.id,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })
  }, [sendNotification])

  const notifyPriorityChange = useCallback(async ({ task, assigneeMember, newPriority, fromUser, workspaceId }) => {
    if (!assigneeMember?.user_id || assigneeMember.user_id === fromUser?.id) return
    const labels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }
    await sendNotification({
      userId: assigneeMember.user_id,
      type: 'priority_change',
      title: 'Prioridad de tarea actualizada',
      message: `${fromUser?.user_metadata?.full_name || fromUser?.email} cambió la prioridad de "${task.title}" a ${labels[newPriority] || newPriority}`,
      workspaceId,
      taskId: task.id,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })
  }, [sendNotification])

  const notifyTaskCompleted = useCallback(async ({ task, assigneeMember, fromUser, workspaceId }) => {
    if (!assigneeMember?.user_id || assigneeMember.user_id === fromUser?.id) return
    await sendNotification({
      userId: assigneeMember.user_id,
      type: 'task_completed',
      title: '¡Tarea completada!',
      message: `"${task.title}" fue marcada como completada por ${fromUser?.user_metadata?.full_name || fromUser?.email}`,
      workspaceId,
      taskId: task.id,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })
  }, [sendNotification])

  const notifyNewSprint = useCallback(async ({ sprint, boardMembers, fromUser, workspaceId }) => {
    const others = (boardMembers || []).filter(m => m.user_id && m.user_id !== fromUser?.id)
    await Promise.all(others.map(member => sendNotification({
      userId: member.user_id,
      type: 'new_sprint',
      title: 'Nuevo sprint creado',
      message: `${fromUser?.user_metadata?.full_name || fromUser?.email} creó el sprint "${sprint.name}"`,
      workspaceId,
      taskId: null,
      fromUserName: fromUser?.user_metadata?.full_name || fromUser?.email?.split('@')[0],
      fromUserAvatar: fromUser?.user_metadata?.avatar_url,
    })))
  }, [sendNotification])

  const notifyInviteAccepted = useCallback(async ({ invitedByUserId, acceptedUserName, orgName }) => {
    if (!invitedByUserId) return
    await sendNotification({
      userId: invitedByUserId,
      type: 'invite_accepted',
      title: 'Invitación aceptada',
      message: `${acceptedUserName} aceptó tu invitación para unirse a ${orgName}`,
      workspaceId: null,
      taskId: null,
      fromUserName: acceptedUserName,
    })
  }, [sendNotification])

  const checkDueDateReminders = useCallback(async ({ memberIds, userId }) => {
    if (!memberIds?.length || !userId) return

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, board_id')
      .in('assignee_id', memberIds)
      .eq('due_date', tomorrowKey)

    if (!tasks?.length) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: existing } = await supabase
      .from('notifications')
      .select('task_id')
      .eq('user_id', userId)
      .eq('type', 'due_date_reminder')
      .gte('created_at', todayStart.toISOString())

    const existingIds = new Set((existing || []).map(n => n.task_id))

    await Promise.all(
      tasks
        .filter(t => !existingIds.has(t.id))
        .map(task => sendNotification({
          userId,
          type: 'due_date_reminder',
          title: 'Tarea vence mañana',
          message: `"${task.title}" vence mañana`,
          taskId: task.id,
        }))
    )
  }, [sendNotification])

  return {
    sendNotification,
    notifyTaskAssigned,
    notifyMention,
    notifyComment,
    notifyStatusChange,
    notifyPriorityChange,
    notifyTaskCompleted,
    notifyNewSprint,
    notifyInviteAccepted,
    checkDueDateReminders,
  }
}
