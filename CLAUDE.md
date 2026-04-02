# CLAUDE.md - MondayProject

## Descripcion del Proyecto

MondayProject es una aplicacion de gestion de proyectos y tareas estilo Monday.com/Jira, construida con React y Supabase. La interfaz esta completamente en espanol. Permite a equipos gestionar organizaciones, workspaces, boards, tareas, sprints y colaborar en tiempo real.

## Tech Stack

- **Frontend:** React 19.2, Vite 8.0, JSX (no TypeScript)
- **Estilos:** Tailwind CSS 4.2 con componentes estilo shadcn/ui (Radix UI primitives)
- **Backend:** Supabase (PostgreSQL con RLS, Auth, Realtime)
- **Estado:** React Context API con useReducer (sin Redux/Zustand)
- **Editor de texto:** TipTap (rich text)
- **Iconos:** Lucide React
- **Notificaciones UI:** Sonner (toasts)
- **Fechas:** date-fns + react-day-picker
- **Deploy:** Vercel (SPA con rewrites a index.html)

## Comandos

```bash
npm run dev       # Servidor de desarrollo (Vite)
npm run build     # Build de produccion
npm run preview   # Preview del build
npm run lint      # ESLint
```

## Estructura del Proyecto

```
src/
├── main.jsx                    # Entry point
├── App.jsx                     # Router principal (renderizado condicional, NO usa react-router)
├── index.css                   # Estilos globales Tailwind
├── context/
│   ├── AuthContext.jsx          # Auth con Supabase (login, registro, Google OAuth, invites)
│   ├── AppContext.jsx           # Estado global (orgs, workspaces, boards, tasks, sprints, etc.)
│   └── ThemeContext.jsx         # Tema claro/oscuro
├── hooks/
│   ├── useSupabase.js           # 60+ operaciones CRUD contra Supabase + dispatch al context
│   ├── useNotifications.js      # Envio de notificaciones (asignacion, menciones, comentarios, etc.)
│   ├── usePresence.js           # Presencia en tiempo real (online/idle/invisible)
│   ├── usePermissions.js        # Permisos por rol (owner > admin > member > viewer)
│   └── useSubscription.js       # Verificacion de suscripcion/paywall
├── lib/
│   ├── supabase.js              # Cliente Supabase (anon key)
│   ├── supabase-admin.js        # Cliente Supabase admin (service role key, solo para invites)
│   ├── utils.js                 # cn() - merge de clases Tailwind
│   ├── constants.js             # Statuses, prioridades (en espanol)
│   └── fieldIcons.js            # Mapa de iconos Lucide para custom fields
├── components/
│   ├── admin/AdminPanel.jsx     # Panel admin secreto (/wf-admin-panel)
│   ├── auth/
│   │   ├── AuthPage.jsx         # Login/registro/reset password
│   │   └── SetupPassword.jsx    # Setup password para usuarios invitados
│   ├── billing/Paywall.jsx      # Paywall de suscripcion
│   ├── board/
│   │   ├── BoardView.jsx        # Vista principal del board (switch entre vistas)
│   │   ├── ColumnToggle.jsx     # Toggle columnas visibles en tabla
│   │   ├── StatusConfigModal.jsx       # Configurar statuses del board
│   │   └── CustomFieldsConfigModal.jsx # Configurar custom fields del board
│   ├── home/HomePage.jsx        # Pantalla de bienvenida (sin board seleccionado)
│   ├── layout/
│   │   ├── Sidebar.jsx          # Sidebar izquierdo (org selector, workspaces, boards)
│   │   └── Topbar.jsx           # Barra superior (nueva tarea, sprint, settings)
│   ├── onboarding/CreateOrgScreen.jsx  # Flujo primera organizacion
│   ├── private/NotesPage.jsx    # Notas personales (workspace privado)
│   ├── search/SearchModal.jsx   # Busqueda (Cmd+L)
│   ├── settings/
│   │   ├── ProfileModal.jsx     # Perfil de usuario
│   │   └── SettingsModal.jsx    # Configuracion general
│   ├── skeleton/                # Loading skeletons
│   ├── sprint/SprintModal.jsx   # Crear/editar sprints
│   ├── task/
│   │   ├── TaskModal.jsx        # Editor de tarea en modal
│   │   ├── TaskSidePanel.jsx    # Editor de tarea en sidebar derecho
│   │   ├── TaskFullPage.jsx     # Editor de tarea pagina completa
│   │   ├── TaskRow.jsx          # Fila de tarea en vista tabla
│   │   ├── TaskActivity.jsx     # Log de actividad
│   │   ├── TaskComments.jsx     # Comentarios
│   │   ├── TaskSubtasks.jsx     # Subtareas
│   │   └── TaskStatus.jsx       # Selector de status
│   ├── ui/                      # Componentes UI reutilizables (BlockEditor, Calendar, DatePicker, etc.)
│   ├── views/
│   │   ├── ViewTabs.jsx         # Tabs: Tabla, Kanban, Calendario, Gantt, Fichas, Cronograma
│   │   ├── KanbanView.jsx       # Vista Kanban con drag-and-drop
│   │   ├── CalendarView.jsx     # Vista calendario
│   │   ├── GanttView.jsx        # Vista Gantt
│   │   ├── FichasView.jsx       # Vista de fichas/cards
│   │   └── CronogramaView.jsx   # Vista cronograma/timeline
│   └── workspace/
│       ├── InviteModal.jsx      # Invitar usuarios, gestionar miembros y roles
│       ├── TeamPresence.jsx     # Indicador de presencia del equipo
│       ├── NotificationCenter.jsx    # Centro de notificaciones
│       └── InviteNotifications.jsx   # Invitaciones pendientes
└── pages/                       # (vacio - routing en App.jsx)
```

## Arquitectura y Patrones Clave

### Jerarquia de Datos
```
Organization → Workspace(s) → Board(s) → Task(s)
                                       → Sprint(s)
                                       → BoardStatus(es)
                                       → CustomField(s)
```

### Flujo de Estado
```
AppContext (useReducer) ← useSupabase (fetch + dispatch)
     ↓
  Componentes (useApp() para leer estado)
```

- Todo el estado global vive en `AppContext` con 50+ acciones de dispatch
- `useSupabase.js` contiene todas las operaciones CRUD y despacha acciones al context
- No hay React Router: la navegacion es por renderizado condicional en `App.jsx`

### Preferencia del Editor de Tareas
El usuario puede elegir 3 modos (guardado en localStorage `workflow-task-editor-view`):
- `modal` - Modal overlay
- `sidebar` - Panel lateral derecho
- `fullpage` - Pagina completa

### Persistencia en localStorage
- `workflow-current-org` - Org seleccionada
- `workflow-current-ws` - Workspace seleccionado
- `workflow-current-board` - Board seleccionado
- `workflow-task-editor-view` - Preferencia de editor
- `workflow-theme` - Tema (light/dark)
- Columnas visibles y vista activa por board

### Roles y Permisos
```
owner > admin > member > viewer
```
Verificados con `usePermissions()` → `can('permiso')`. 18 permisos granulares.

## Tablas de Supabase (inferidas del codigo)

| Tabla | Descripcion |
|-------|-------------|
| `organizations` | Organizaciones/empresas |
| `org_members` | Miembros con rol, status de presencia, avatar |
| `org_invites` | Invitaciones pendientes por email |
| `workspaces` | Espacios de trabajo (pueden ser privados) |
| `boards` | Tableros de tareas (pueden ser de notas) |
| `sprints` | Sprints/iteraciones |
| `tasks` | Tareas (soporta parent_task_id para subtareas) |
| `board_statuses` | Statuses personalizados por board |
| `custom_fields` | Definiciones de campos personalizados |
| `custom_field_options` | Opciones de dropdown para custom fields |
| `task_custom_field_values` | Valores de custom fields por tarea |
| `task_activity` | Log de actividad/auditoria |
| `notifications` | Notificaciones de usuario |
| `subscriptions` | Suscripciones (paywall) |
| `user_notes` | Notas personales por usuario/org |

### RPC Functions
- `check_user_has_access(check_user_id)` - Verificacion de suscripcion (SECURITY DEFINER)

## Convenciones

- **Idioma UI:** Todo en espanol (labels, toasts, placeholders)
- **Archivos:** JSX (no TypeScript), nombres en PascalCase para componentes
- **Estilos:** Tailwind classes con `cn()` helper para merge
- **Imports:** Alias `@/` apunta a `src/`
- **Componentes UI:** Basados en Radix UI con styling tipo shadcn
- **Errores:** Console logging + toast.error() para feedback al usuario
- **Statuses default:** Backlog, Por hacer, En progreso, En revision, Completado, Bloqueado
- **Prioridades:** Critica, Alta, Media, Baja

## Variables de Entorno Requeridas

```
VITE_SUPABASE_URL=<url del proyecto supabase>
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_SUPABASE_SERVICE_ROLE_KEY=<service role key (usado solo en invites)>
```

## Notas Importantes

- `react-router-dom` esta instalado pero NO se usa para routing principal
- El panel admin se accede via URL directa `/wf-admin-panel` (sin link en la UI)
- `supabase-admin.js` usa el service role key en el cliente - esto es un riesgo de seguridad ya que expone la key en el frontend
- La app soporta drag-and-drop en vistas Kanban y Calendario
- Los custom fields son extensibles por board con tipos: texto, numero, dropdown, fecha, etc.
