import { useState, useEffect, useCallback } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider, useApp } from './context/AppContext'
import { useSupabase } from './hooks/useSupabase'
import { supabase } from './lib/supabase'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import BoardView from './components/board/BoardView'
import TaskModal from './components/task/TaskModal'
import TaskSidePanel from './components/task/TaskSidePanel'
import TaskFullPage from './components/task/TaskFullPage'
import SprintModal from './components/sprint/SprintModal'
import InviteModal from './components/workspace/InviteModal'
import SearchModal from './components/search/SearchModal'
import SettingsModal from './components/settings/SettingsModal'
import ProfileModal from './components/settings/ProfileModal'
import AuthPage from './components/auth/AuthPage'
import SetupPassword from './components/auth/SetupPassword'
import CreateOrgScreen from './components/onboarding/CreateOrgScreen'
import { Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'
import { usePresence } from './hooks/usePresence'
import { useSubscription } from './hooks/useSubscription'
import Paywall from './components/billing/Paywall'
import AdminPanel from './components/admin/AdminPanel'

function getTaskEditorPref() {
  return localStorage.getItem('workflow-task-editor-view') || 'sidebar'
}

function AppContent() {
  const { state, dispatch, openTask } = useApp()
  const { user, signOut } = useAuth()
  usePresence(user?.id)
  const { fetchOrganizations, fetchWorkspaces, fetchBoards, fetchOrgMembers } = useSupabase()
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [inviteModal, setInviteModal] = useState({ open: false, workspace: null })
  const [orgsLoaded, setOrgsLoaded] = useState(false)

  // Fetch organizations on load
  useEffect(() => {
    fetchOrganizations().then(() => setOrgsLoaded(true))
  }, [])

  // Auto-select first org if none selected
  useEffect(() => {
    if (state.organizations.length > 0 && !state.currentOrg) {
      // Try to restore from localStorage
      const savedOrgId = localStorage.getItem('workflow-current-org')
      const savedOrg = savedOrgId ? state.organizations.find(o => o.id === savedOrgId) : null
      dispatch({ type: 'SET_CURRENT_ORG', payload: savedOrg || state.organizations[0] })
    }
  }, [state.organizations])

  // When org changes, fetch its workspaces and members
  useEffect(() => {
    if (state.currentOrg) {
      localStorage.setItem('workflow-current-org', state.currentOrg.id)
      fetchWorkspaces(state.currentOrg.id)
      fetchOrgMembers(state.currentOrg.id)
      // Reset board selection when org changes
      dispatch({ type: 'SET_CURRENT_BOARD', payload: null })
      dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: null })
    }
  }, [state.currentOrg?.id])

  // Fetch boards for all workspaces when workspaces load
  useEffect(() => {
    state.workspaces.forEach(ws => fetchBoards(ws.id))
  }, [state.workspaces])

  useEffect(() => {
    if (state.currentWorkspace) {
      fetchBoards(state.currentWorkspace.id)
    }
  }, [state.currentWorkspace])

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'RESET' })
    }
  }, [user, dispatch])

  // Cmd+L / Ctrl+L shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        setShowSearch(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNewTask = () => {
    const taskData = {
      title: '',
      description: '',
      status: 'Por hacer',
      priority: 'medium',
      sprint_id: state.sprints.length > 0 ? state.sprints[0].id : null,
    }
    // Use unified openTask which routes based on user preference
    openTask(taskData)
  }

  const handleOpenInviteModal = (workspace) => {
    setInviteModal({ open: true, workspace })
  }

  const pref = getTaskEditorPref()
  const showFullPage = pref === 'fullpage' && (state.isTaskModalOpen || state.isSidePanelOpen)

  // Show onboarding only if user has no organizations AND no pending invites
  const [hasPendingInvites, setHasPendingInvites] = useState(false)
  useEffect(() => {
    if (orgsLoaded && state.organizations.length === 0 && user?.email) {
      supabase
        .from('org_invites')
        .select('id')
        .eq('email', user.email)
        .eq('status', 'pending')
        .limit(1)
        .then(({ data }) => setHasPendingInvites(data && data.length > 0))
    }
  }, [orgsLoaded, state.organizations.length, user?.email])

  if (orgsLoaded && state.organizations.length === 0 && !hasPendingInvites) {
    return <CreateOrgScreen />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        onOpenInviteModal={handleOpenInviteModal}
        onOpenSearch={() => setShowSearch(true)}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar
          onNewTask={handleNewTask}
          onNewSprint={() => setShowSprintModal(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenProfile={() => setShowProfile(true)}
        />
        <BoardView />
      </div>

      {/* Task editors: render based on user preference */}
      {pref === 'modal' && <TaskModal />}
      {pref === 'sidebar' && <TaskSidePanel />}
      {showFullPage && <TaskFullPage />}

      <SprintModal isOpen={showSprintModal} onClose={() => setShowSprintModal(false)} />
      <InviteModal
        isOpen={inviteModal.open}
        onClose={() => setInviteModal({ open: false, workspace: null })}
      />
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  )
}

function AuthenticatedApp() {
  const { user, loading, needsPassword } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  if (needsPassword) {
    return <SetupPassword />
  }

  // Secret admin panel — no link in the app
  if (window.location.pathname === '/wf-admin-panel') {
    return <AdminPanel />
  }

  return <SubscriptionGate user={user} />
}

function SubscriptionGate({ user }) {
  const { hasAccess } = useSubscription(user?.id)

  if (hasAccess === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Verificando suscripcion...</span>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return <Paywall />
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthenticatedApp />
        <Toaster
          position="bottom-center"
          toastOptions={{
            className: '!bg-card !text-foreground !border-border !shadow-lg',
            duration: 3000,
          }}
          richColors
        />
      </AuthProvider>
    </ThemeProvider>
  )
}
