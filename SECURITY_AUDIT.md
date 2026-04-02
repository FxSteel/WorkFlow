# Auditoría de Seguridad - MondayProject

**Fecha:** 2 de abril de 2026
**Plataforma:** React 19 + Supabase (PostgreSQL + Auth + RLS)
**Deploy:** Vercel (SPA)
**Fuente:** Analisis de codigo fuente + revision de politicas RLS en base de datos

---

## 1. Que Tenemos (Estado Actual de Seguridad)

### Autenticacion
- Supabase Auth con email/password y Google OAuth
- JWT tokens manejados automaticamente por el SDK de Supabase
- Sesiones persistidas en localStorage por Supabase
- Password minimo: **6 caracteres** (debil)

### Autorizacion
- Sistema de roles: `owner > admin > member > viewer`
- 28 permisos granulares con presets por rol
- Verificacion de permisos es **client-side** via `usePermissions()` → `can()`
- **RLS habilitado en las 18 tablas** de la base de datos

### RLS (Row Level Security) — Estado Real
- **18/18 tablas con RLS habilitado** (todas las tablas publicas)
- Funciones helper: `get_my_workspace_ids()`, `get_my_org_ids()`, `get_my_email()`
- SELECT, UPDATE, DELETE: bien protegidos con filtros por org/workspace/user
- **INSERT: TODAS las tablas tienen policies sin restriccion (`qual: null`)** — cualquier usuario autenticado puede insertar en cualquier tabla
- **No hay triggers** de seguridad en ninguna tabla

### Conexion a Supabase
- **Cliente publico** (`supabase.js`): usa `VITE_SUPABASE_ANON_KEY` — correcto
- **Cliente admin** (`supabase-admin.js`): usa `VITE_SUPABASE_SERVICE_ROLE_KEY` — **expuesto en el frontend**

### Pagos
- Integracion con AlohaPay
- API key de pago con prefijo `VITE_` — **expuesta en el frontend**

### Panel de Administracion
- Accesible via URL directa `/wf-admin-panel`
- Verificacion por email hardcodeado en el codigo fuente
- Usa `supabaseAdmin` para operaciones privilegiadas

### Headers de Seguridad
- **Ninguno configurado** en `vercel.json` (sin CSP, HSTS, X-Frame-Options)

---

## 2. Vulnerabilidades Activas (Explotables Ahora)

### CRITICA-01: Service Role Key expuesta en el frontend
- **Archivo:** `src/lib/supabase-admin.js`
- **Impacto:** Cualquier usuario puede extraer la key desde DevTools o el bundle compilado y obtener acceso TOTAL a la base de datos, bypaseando TODAS las politicas RLS
- **Como explotar:** Abrir DevTools → Sources → buscar `eyJ` en el bundle JS → copiar el JWT
- **Datos en riesgo:** TODA la base de datos (usuarios, organizaciones, tareas, pagos)

### CRITICA-02: TODOS los INSERT sin restriccion
- **Tablas afectadas:** Las 18 tablas publicas
- **Detalle:** Cada policy INSERT tiene `qual: null` (sin WITH CHECK), lo que significa que cualquier usuario autenticado puede insertar datos en cualquier tabla sin restriccion
- **Ejemplos de ataque desde consola del navegador:**
  ```javascript
  // Hacerse miembro de cualquier organizacion
  supabase.from('org_members').insert({
    org_id: 'uuid-de-otra-org',
    user_id: 'mi-user-id',
    role: 'admin'
  })

  // Crear tareas en boards de otras organizaciones
  supabase.from('tasks').insert({
    board_id: 'uuid-de-otro-board',
    title: 'Tarea maliciosa'
  })

  // Crear invitaciones falsas en nombre de otra org
  supabase.from('org_invites').insert({
    org_id: 'uuid-de-otra-org',
    email: 'victima@email.com',
    role: 'admin'
  })
  ```

### CRITICA-03: Escalamiento de privilegios via org_members
- **Policy actual:** `orgmem_update` permite update si `user_id = auth.uid()` **O** si perteneces a la org (`get_my_org_ids()`)
- **Problema:** Un `member` puede actualizar SU PROPIO registro porque `user_id = auth.uid()` lo permite, incluyendo cambiar su rol:
  ```javascript
  supabase.from('org_members').update({ role: 'owner' }).eq('user_id', 'mi-id')
  ```
- **Peor aun:** Puede actualizar a CUALQUIER miembro de su org porque `org_id IN get_my_org_ids()` tambien lo permite

### ALTA-01: task_activity visible para todos
- **Policy:** `SELECT` con `qual: true` — cualquier usuario autenticado puede leer TODA la actividad de TODAS las tareas de TODAS las organizaciones
- **Impacto:** Fuga de informacion sensible (nombres, acciones, cambios de datos)

### ALTA-02: subscriptions manipulable por cualquiera
- **Policy:** `"System can manage subscriptions"` con `cmd: ALL` y `qual: true`
- **Impacto:** Cualquier usuario autenticado puede leer, insertar, actualizar o eliminar suscripciones de CUALQUIER usuario
- **Ataque:** Activarse suscripcion premium gratis, o desactivar la de un competidor

### ALTA-03: notifications — cualquiera puede enviar a cualquiera
- **Policy INSERT:** Sin restriccion (`qual: null`)
- **Impacto:** Phishing interno — enviar notificaciones falsas a cualquier usuario haciendose pasar por el sistema

### ALTA-04: API Key de pagos expuesta
- **Archivo:** `src/components/billing/Paywall.jsx`
- **Variable:** `VITE_ALOHAPAY_API_KEY`
- **Impacto:** Crear/consultar links de pago, fraude financiero

### ALTA-05: XSS almacenado via nombres de archivo
- **Archivo:** `src/components/ui/BlockEditor.jsx`
- **Impacto:** Nombre de archivo malicioso se inyecta en HTML sin sanitizar:
  ```javascript
  html = `<img src="${url}" alt="${file.name}" />`
  ```

### ALTA-06: Panel admin sin proteccion server-side
- **Archivo:** `src/components/admin/AdminPanel.jsx`
- **Impacto:** Verificacion solo por email en frontend. Usa `supabaseAdmin` para operaciones que bypassean RLS

### ALTA-07: Policies duplicadas en workspaces
- **Detalle:** `workspaces` tiene policies duplicadas:
  - `ws_delete` + `"Owners can delete their workspaces"` (misma logica)
  - `ws_update` + `"Owners can update their workspaces"` (misma logica)
  - `ws_insert` + `"Authenticated users can create workspaces"` (ambas sin restriccion)
- **Riesgo:** Confusing y podrian causar conflictos. Limpiar duplicados

### MEDIA-01: Spoofing de logs de actividad
- **Tabla:** `task_activity` — INSERT sin restriccion, sin trigger que fuerze `auth.uid()`
- **Impacto:** Un usuario puede registrar actividad como si fuera otro

### MEDIA-02: Sin rate limiting en invitaciones
- **Impacto:** Spam de invitaciones por email

### MEDIA-03: Password minimo muy debil (6 caracteres)

### MEDIA-04: members (tabla legacy?) con policies confusas
- **Detalle:** Existe tabla `members` con policies antiguas + nuevas mezcladas (6 policies). Parece una tabla legacy — verificar si se usa

---

## 3. Vulnerabilidades Selladas y Bloqueadas (Lo que SI esta protegido)

### RLS habilitado en todas las tablas
- **18/18 tablas** tienen RLS activado. Ninguna tabla esta expuesta sin politicas
- **Estado:** Activo

### SELECT bien protegido en tablas core
Las queries de lectura estan correctamente filtradas:
- `organizations` → solo las del usuario (`get_my_org_ids()` o `owner_id`)
- `workspaces` → solo las de las orgs del usuario
- `boards` → solo las de los workspaces del usuario (`get_my_workspace_ids()`)
- `tasks` → solo las de los boards accesibles
- `sprints` → solo los de boards accesibles
- `board_statuses`, `custom_fields`, `custom_field_options`, `task_custom_field_values`, `task_comments` → encadenados correctamente board → workspace → org
- `org_members` → solo miembros de las orgs del usuario
- `org_invites` → solo las del email del usuario o las de sus orgs
- `notifications` → solo las del usuario (`user_id = auth.uid()`)
- `user_notes` → solo las del usuario (`auth.uid() = user_id`)
- `subscriptions` → las del usuario o las del owner de sus orgs

### DELETE protegido correctamente en la mayoria de tablas
- `organizations` → solo el owner puede eliminar
- `workspaces` → solo el owner puede eliminar
- `org_members` → solo el owner de la org o el propio usuario (salir)
- `task_comments` → solo el autor puede eliminar sus comentarios
- `notifications` → solo el destinatario
- `user_notes` → solo el owner

### UPDATE protegido en tablas core
- `organizations` → solo el owner
- `workspaces` → solo el owner
- `notifications` → solo el destinatario (marcar como leida)
- `members` → solo el propio usuario

### Funciones helper de seguridad
- `get_my_workspace_ids()` — retorna IDs de workspaces accesibles
- `get_my_org_ids()` — retorna IDs de organizaciones del usuario
- `get_my_email()` — retorna email del usuario autenticado
- `check_user_has_access()` — verificacion de suscripcion (SECURITY DEFINER)

### Autenticacion via Supabase Auth
- JWT firmados y verificados en cada request
- Google OAuth con PKCE flow
- **Estado:** Funcional

### HTTPS en produccion
- Vercel fuerza HTTPS
- Supabase usa HTTPS para todas las APIs
- **Estado:** Activo

---

## 4. Cambios Urgentes (Implementar Inmediatamente)

### U-01: Eliminar Service Role Key del frontend
**Prioridad:** CRITICA | **Esfuerzo:** Alto

1. Crear **Supabase Edge Functions** para operaciones privilegiadas:
   - `invite-user` — crear invitaciones y enviar emails
   - `admin-operations` — listar usuarios, banear, toggle suscripciones
2. Eliminar `src/lib/supabase-admin.js` completamente
3. Eliminar `VITE_SUPABASE_SERVICE_ROLE_KEY` del `.env`
4. **Rotar la key** en Supabase Dashboard → Settings → API → Regenerate service role key
5. Limpiar historial de git si fue commiteada

### U-02: Agregar WITH CHECK a TODOS los INSERT
**Prioridad:** CRITICA | **Esfuerzo:** Medio

Ejecutar en SQL Editor:

```sql
-- org_members: solo puede insertar si es owner/admin de la org
DROP POLICY IF EXISTS "orgmem_insert" ON org_members;
CREATE POLICY "orgmem_insert" ON org_members FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- organizations: cualquiera puede crear (correcto), pero debe ser el owner
DROP POLICY IF EXISTS "org_insert" ON organizations;
CREATE POLICY "org_insert" ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- workspaces: solo miembros de la org pueden crear
DROP POLICY IF EXISTS "ws_insert" ON workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
CREATE POLICY "ws_insert" ON workspaces FOR INSERT
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- boards: solo miembros del workspace pueden crear
DROP POLICY IF EXISTS "board_insert" ON boards;
CREATE POLICY "board_insert" ON boards FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

-- tasks: solo miembros del workspace del board pueden crear
DROP POLICY IF EXISTS "task_insert" ON tasks;
CREATE POLICY "task_insert" ON tasks FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT b.id FROM boards b
      WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

-- sprints: solo miembros del workspace del board
DROP POLICY IF EXISTS "sprint_insert" ON sprints;
CREATE POLICY "sprint_insert" ON sprints FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT b.id FROM boards b
      WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

-- board_statuses: solo miembros del workspace del board
DROP POLICY IF EXISTS "bs_insert" ON board_statuses;
CREATE POLICY "bs_insert" ON board_statuses FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT b.id FROM boards b
      WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

-- custom_fields: solo miembros del workspace del board
DROP POLICY IF EXISTS "cf_insert" ON custom_fields;
CREATE POLICY "cf_insert" ON custom_fields FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT b.id FROM boards b
      WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

-- custom_field_options: solo si el custom_field es de un board accesible
DROP POLICY IF EXISTS "cfo_insert" ON custom_field_options;
CREATE POLICY "cfo_insert" ON custom_field_options FOR INSERT
  WITH CHECK (
    custom_field_id IN (
      SELECT cf.id FROM custom_fields cf
      WHERE cf.board_id IN (
        SELECT b.id FROM boards b
        WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
      )
    )
  );

-- task_custom_field_values: solo si la tarea es de un board accesible
DROP POLICY IF EXISTS "tcfv_insert" ON task_custom_field_values;
CREATE POLICY "tcfv_insert" ON task_custom_field_values FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      WHERE t.board_id IN (
        SELECT b.id FROM boards b
        WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
      )
    )
  );

-- task_comments: solo si la tarea es accesible y el user_id es correcto
DROP POLICY IF EXISTS "comment_insert" ON task_comments;
CREATE POLICY "comment_insert" ON task_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND task_id IN (
      SELECT t.id FROM tasks t
      WHERE t.board_id IN (
        SELECT b.id FROM boards b
        WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
      )
    )
  );

-- org_invites: solo miembros de la org pueden crear invitaciones
DROP POLICY IF EXISTS "orginv_insert" ON org_invites;
CREATE POLICY "orginv_insert" ON org_invites FOR INSERT
  WITH CHECK (org_id IN (SELECT get_my_org_ids()));

-- notifications: solo para usuarios de tus mismas orgs
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT om.user_id FROM org_members om
      WHERE om.org_id IN (SELECT get_my_org_ids())
    )
  );

-- task_activity: forzar que user_id sea el autenticado
DROP POLICY IF EXISTS "Users can insert task activity" ON task_activity;
CREATE POLICY "activity_insert" ON task_activity FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- members (tabla legacy): solo insertar en workspaces accesibles
DROP POLICY IF EXISTS "Members can be inserted" ON members;
DROP POLICY IF EXISTS "mem_insert" ON members;
CREATE POLICY "mem_insert" ON members FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));
```

### U-03: Corregir org_members UPDATE (escalamiento de privilegios)
**Prioridad:** CRITICA | **Esfuerzo:** Bajo

```sql
-- Reemplazar la policy actual que permite que cualquier miembro edite a cualquier otro
DROP POLICY IF EXISTS "orgmem_update" ON org_members;

-- Solo el owner de la org puede cambiar roles de otros miembros
-- Un usuario puede actualizar sus propios datos NO sensibles (presencia, avatar)
CREATE POLICY "orgmem_update" ON org_members FOR UPDATE
  USING (
    -- Owner de la org puede editar a cualquier miembro
    org_id IN (
      SELECT o.id FROM organizations o WHERE o.owner_id = auth.uid()
    )
    OR
    -- Admin puede editar miembros (pero no a otros admins/owner — requiere app logic)
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
    OR
    -- Un usuario puede editar su propio registro (presencia, avatar, etc)
    user_id = auth.uid()
  )
  -- Pero NADIE puede cambiar su propio rol
  WITH CHECK (
    CASE
      WHEN user_id = auth.uid() THEN
        role = (SELECT om.role FROM org_members om WHERE om.user_id = auth.uid() AND om.org_id = org_members.org_id LIMIT 1)
      ELSE true
    END
  );
```

### U-04: Corregir task_activity SELECT y subscriptions ALL
**Prioridad:** ALTA | **Esfuerzo:** Bajo

```sql
-- task_activity: solo actividad de tareas accesibles
DROP POLICY IF EXISTS "Users can view task activity" ON task_activity;
CREATE POLICY "activity_select" ON task_activity FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      WHERE t.board_id IN (
        SELECT b.id FROM boards b
        WHERE b.workspace_id IN (SELECT get_my_workspace_ids())
      )
    )
  );

-- subscriptions: eliminar policy "ALL true" que es peligrosisima
DROP POLICY IF EXISTS "System can manage subscriptions" ON subscriptions;
-- Solo el sistema (via service role desde Edge Functions) deberia poder modificar suscripciones
-- Los usuarios solo pueden leer la suya (ya existe "Users see own subscription")
```

### U-05: Rotar API Key de pagos y mover a backend
**Prioridad:** ALTA | **Esfuerzo:** Medio

1. Crear Edge Function `create-payment-link` que maneje la logica de pago
2. Mover `ALOHAPAY_API_KEY` a secrets de la Edge Function
3. Rotar la key actual en AlohaPay

### U-06: Sanitizar nombres de archivo en BlockEditor
**Prioridad:** ALTA | **Esfuerzo:** Bajo

En `src/components/ui/BlockEditor.jsx`:
```javascript
const sanitizeFileName = (name) => {
  const div = document.createElement('div')
  div.textContent = name
  return div.innerHTML
}
// Usar: html = `<img src="${url}" alt="${sanitizeFileName(file.name)}" />`
```

### U-07: Limpiar policies duplicadas en workspaces
**Prioridad:** MEDIA | **Esfuerzo:** Bajo

```sql
DROP POLICY IF EXISTS "Owners can delete their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners can update their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
-- Ya existen ws_delete, ws_update, ws_insert que cubren lo mismo
```

### U-08: Agregar headers de seguridad en Vercel
**Prioridad:** ALTA | **Esfuerzo:** Bajo

Actualizar `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 5. Cambios Menos Urgentes (Planificar para las proximas semanas)

### MU-01: Trigger para forzar user_id en task_activity
**Esfuerzo:** Bajo

```sql
CREATE OR REPLACE FUNCTION enforce_activity_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.user_name := (
    SELECT raw_user_meta_data->>'full_name'
    FROM auth.users WHERE id = auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_activity_user_trigger
  BEFORE INSERT ON task_activity
  FOR EACH ROW EXECUTE FUNCTION enforce_activity_user();
```

### MU-02: Fortalecer requisitos de password
**Esfuerzo:** Bajo

Cambiar minimo de 6 a 12 caracteres.

### MU-03: Rate limiting en invitaciones
**Esfuerzo:** Medio

Implementar via Edge Function o policy con conteo:
- Maximo 10 invitaciones por hora por usuario
- Maximo 50 por dia por organizacion

### MU-04: Verificar y limpiar tabla `members`
**Esfuerzo:** Bajo

Parece ser una tabla legacy (anterior a `org_members`). Verificar si se usa y si no, eliminarla o migrar datos.

### MU-05: Mover admin panel a Edge Function
**Esfuerzo:** Medio

- Eliminar verificacion por email hardcodeada
- Crear campo `is_platform_admin` en user metadata
- Todas las operaciones admin via Edge Functions

### MU-06: Agregar .env.example y validacion al iniciar
**Esfuerzo:** Bajo

---

## Resumen Ejecutivo

### Lo que esta BIEN (mejor de lo esperado)
- RLS habilitado en **18/18 tablas**
- SELECT protegido correctamente en la mayoria de tablas con cadena org → workspace → board → task
- Funciones helper (`get_my_workspace_ids`, etc.) bien implementadas
- DELETE protegido correctamente (owner-only en tablas criticas)

### Lo que esta MAL (requiere accion inmediata)
| Vulnerabilidad | Severidad | Esfuerzo para arreglar |
|---|---|---|
| Service Role Key en frontend | CRITICA | Alto (Edge Functions) |
| INSERT sin restriccion en 18 tablas | CRITICA | Medio (SQL) |
| Escalamiento de privilegios via org_members UPDATE | CRITICA | Bajo (SQL) |
| task_activity visible para todos | ALTA | Bajo (SQL) |
| subscriptions manipulable por todos | ALTA | Bajo (SQL) |
| Payment key en frontend | ALTA | Medio (Edge Function) |
| XSS en nombres de archivo | ALTA | Bajo (JS) |
| Sin headers de seguridad | ALTA | Bajo (JSON) |

### Plan de accion sugerido
1. **Hoy:** Ejecutar SQL de U-02, U-03, U-04, U-07 (30 min, cierra las vulnerabilidades mas faciles)
2. **Esta semana:** U-06 (XSS), U-08 (headers)
3. **Proximo sprint:** U-01 (Edge Functions para service role key), U-05 (payment key)
4. **Siguiente sprint:** Cambios menos urgentes (MU-01 a MU-06)
