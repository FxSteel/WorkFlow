import { createContext, useContext, useReducer, useCallback } from 'react'

const AppContext = createContext()

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  boards: [],
  currentBoard: null,
  sprints: [],
  tasks: [],
  members: [],
  invites: [],
  selectedTask: null,
  sidePanelTask: null,
  isTaskModalOpen: false,
  isSidePanelOpen: false,
  loading: false,
  sidebarCollapsed: false,
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_WORKSPACES':
      return { ...state, workspaces: action.payload }
    case 'SET_CURRENT_WORKSPACE':
      return { ...state, currentWorkspace: action.payload }
    case 'SET_BOARDS':
      return { ...state, boards: action.payload }
    case 'MERGE_BOARDS': {
      // Replace boards for a specific workspace, keep others
      const { workspaceId, boards: newBoards } = action.payload
      const otherBoards = state.boards.filter(b => b.workspace_id !== workspaceId)
      return { ...state, boards: [...otherBoards, ...newBoards] }
    }
    case 'SET_CURRENT_BOARD':
      return { ...state, currentBoard: action.payload }
    case 'SET_SPRINTS':
      return { ...state, sprints: action.payload }
    case 'SET_TASKS':
      return { ...state, tasks: action.payload }
    case 'SET_MEMBERS':
      return { ...state, members: action.payload }
    case 'SET_INVITES':
      return { ...state, invites: action.payload }
    case 'UPDATE_TASK': {
      const tasks = state.tasks.map(t =>
        t.id === action.payload.id ? { ...t, ...action.payload } : t
      )
      return {
        ...state,
        tasks,
        selectedTask: state.selectedTask?.id === action.payload.id
          ? { ...state.selectedTask, ...action.payload }
          : state.selectedTask,
        sidePanelTask: state.sidePanelTask?.id === action.payload.id
          ? { ...state.sidePanelTask, ...action.payload }
          : state.sidePanelTask,
      }
    }
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] }
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.payload),
        selectedTask: state.selectedTask?.id === action.payload ? null : state.selectedTask,
        sidePanelTask: state.sidePanelTask?.id === action.payload ? null : state.sidePanelTask,
        isTaskModalOpen: state.selectedTask?.id === action.payload ? false : state.isTaskModalOpen,
        isSidePanelOpen: state.sidePanelTask?.id === action.payload ? false : state.isSidePanelOpen,
      }
    case 'OPEN_TASK_MODAL':
      return { ...state, selectedTask: action.payload, isTaskModalOpen: true }
    case 'CLOSE_TASK_MODAL':
      return { ...state, isTaskModalOpen: false, selectedTask: null }
    case 'OPEN_SIDE_PANEL':
      return { ...state, sidePanelTask: action.payload, isSidePanelOpen: true }
    case 'CLOSE_SIDE_PANEL':
      return { ...state, isSidePanelOpen: false, sidePanelTask: null }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'ADD_WORKSPACE':
      return { ...state, workspaces: [...state.workspaces, action.payload] }
    case 'UPDATE_WORKSPACE': {
      const workspaces = state.workspaces.map(w =>
        w.id === action.payload.id ? { ...w, ...action.payload } : w
      )
      const currentWorkspace = state.currentWorkspace?.id === action.payload.id
        ? { ...state.currentWorkspace, ...action.payload }
        : state.currentWorkspace
      return { ...state, workspaces, currentWorkspace }
    }
    case 'DELETE_WORKSPACE': {
      const workspaces = state.workspaces.filter(w => w.id !== action.payload)
      const isCurrent = state.currentWorkspace?.id === action.payload
      return {
        ...state,
        workspaces,
        currentWorkspace: isCurrent ? null : state.currentWorkspace,
        currentBoard: isCurrent ? null : state.currentBoard,
        boards: isCurrent ? [] : state.boards,
        sprints: isCurrent ? [] : state.sprints,
        tasks: isCurrent ? [] : state.tasks,
        members: isCurrent ? [] : state.members,
      }
    }
    case 'ADD_BOARD':
      return { ...state, boards: [...state.boards, action.payload] }
    case 'UPDATE_BOARD': {
      const boards = state.boards.map(b =>
        b.id === action.payload.id ? { ...b, ...action.payload } : b
      )
      const currentBoard = state.currentBoard?.id === action.payload.id
        ? { ...state.currentBoard, ...action.payload }
        : state.currentBoard
      return { ...state, boards, currentBoard }
    }
    case 'DELETE_BOARD': {
      const boards = state.boards.filter(b => b.id !== action.payload)
      const isCurrent = state.currentBoard?.id === action.payload
      return {
        ...state,
        boards,
        currentBoard: isCurrent ? null : state.currentBoard,
        sprints: isCurrent ? [] : state.sprints,
        tasks: isCurrent ? [] : state.tasks,
      }
    }
    case 'ADD_SPRINT':
      return { ...state, sprints: [...state.sprints, action.payload] }
    case 'UPDATE_SPRINT': {
      const sprints = state.sprints.map(s =>
        s.id === action.payload.id ? { ...s, ...action.payload } : s
      )
      return { ...state, sprints }
    }
    case 'DELETE_SPRINT': {
      return {
        ...state,
        sprints: state.sprints.filter(s => s.id !== action.payload),
        tasks: state.tasks.map(t =>
          t.sprint_id === action.payload ? { ...t, sprint_id: null } : t
        ),
      }
    }
    case 'ADD_INVITE':
      return { ...state, invites: [...state.invites, action.payload] }
    case 'DELETE_INVITE':
      return { ...state, invites: state.invites.filter(i => i.id !== action.payload) }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const openTaskModal = useCallback((task) => {
    dispatch({ type: 'OPEN_TASK_MODAL', payload: task })
  }, [])

  const closeTaskModal = useCallback(() => {
    dispatch({ type: 'CLOSE_TASK_MODAL' })
  }, [])

  const openSidePanel = useCallback((task) => {
    dispatch({ type: 'OPEN_SIDE_PANEL', payload: task })
  }, [])

  const closeSidePanel = useCallback(() => {
    dispatch({ type: 'CLOSE_SIDE_PANEL' })
  }, [])

  // Unified task opener — respects user preference
  const openTask = useCallback((task) => {
    const pref = localStorage.getItem('workflow-task-editor-view') || 'sidebar'
    if (pref === 'modal') {
      dispatch({ type: 'OPEN_TASK_MODAL', payload: task })
    } else if (pref === 'fullpage') {
      dispatch({ type: 'OPEN_TASK_MODAL', payload: task })
    } else {
      dispatch({ type: 'OPEN_SIDE_PANEL', payload: task })
    }
  }, [])

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      openTask,
      openTaskModal,
      closeTaskModal,
      openSidePanel,
      closeSidePanel,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
