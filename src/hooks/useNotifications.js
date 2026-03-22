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

  return { sendNotification, notifyTaskAssigned, notifyMention, notifyComment }
}
