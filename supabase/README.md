# Configuración de Supabase (registro de acceso y reacciones)

Para entrar al sitio la persona escribe su nombre completo y su correo institucional `@usc.edu.co`. Si el correo tiene ese dominio, el ingreso se registra en Supabase y la persona entra de inmediato. **No se verifica el correo**: el sistema confía en que cada persona escribe el suyo.

Proyecto: `https://phfnqngrohmanbffppxh.supabase.co`

## 1. Crear las tablas y la función de registro

1. Abre **Dashboard → SQL Editor → New query**.
2. Pega el contenido de [`migrations/20261109010000_open_access_registry.sql`](migrations/20261109010000_open_access_registry.sql) y ejecútalo.

El script es seguro de ejecutar más de una vez. Si antes ejecutaste la versión con código por correo, también limpia sus triggers y funciones. Crea:

| Objeto | Para qué sirve |
| --- | --- |
| Tabla `visitors` | Una fila por persona: nombre completo, correo, primer acceso, último acceso y número de accesos. |
| Tabla `visit_logs` | Una fila por cada ingreso, con fecha y navegador. |
| Función `register_visit()` | La llama el servidor del sitio. Rechaza correos que no terminen exactamente en `@usc.edu.co` y nombres incompletos, y guarda el ingreso. |
| Row Level Security | Nadie puede leer ni escribir las tablas desde el navegador; solo se consultan desde el panel. |

No hace falta configurar plantillas de correo ni un servidor SMTP.

## 2. Ver y exportar el registro como hoja de cálculo

1. **Table Editor → visitors** muestra la tabla como una hoja de cálculo.
2. **Export → Export to CSV** descarga el archivo, que abre directamente en Excel o Google Sheets.
3. Usa `visit_logs` si necesitas el detalle de cada ingreso.

## 3. Activar las reacciones a los pósteres

Ejecuta esto **después** del paso 1, porque las reacciones dependen de la tabla `visitors`.

1. Abre **Dashboard → SQL Editor → New query**.
2. Pega el contenido de [`migrations/20261110000000_poster_reactions.sql`](migrations/20261110000000_poster_reactions.sql) y ejecútalo. Es seguro ejecutarlo más de una vez.

Crea:

| Objeto | Para qué sirve |
| --- | --- |
| Tabla `poster_reactions` | Una fila por persona y póster (clave `eje-N/<slug>`) con su reacción: `love`, `clap`, `insight` o `inspire`. Una persona solo puede tener una reacción por póster. |
| Funciones `set_poster_reaction()` y `get_poster_reactions()` | Las llama el servidor del sitio. Validan la clave del póster, la reacción y que la persona exista, y devuelven los totales. |
| Vista `poster_reaction_summary` | Una fila por póster con los totales de cada reacción y el total general. Solo la lee el administrador desde el panel; no se expone a la API. |
| Row Level Security | Nadie puede leer ni escribir `poster_reactions` desde el navegador. |

Hasta que ejecutes este script, la barra de reacciones del sitio aparece deshabilitada y no se guarda nada.

### Actualización: detectar sesiones antiguas

Después, ejecuta también [`migrations/20261111000000_reactions_visitor_flag.sql`](migrations/20261111000000_reactions_visitor_flag.sql) en el SQL Editor (también es seguro repetirlo). Agrega a `get_poster_reactions()` un indicador que dice si la persona de la cookie existe en `visitors`, y hace que la vista `poster_reaction_summary` use los permisos de quien la consulta (`security_invoker`).

Con esto, si el navegador guarda una cookie de ingreso de una persona que ya no existe en la base (por ejemplo, tras cambiar de proyecto o limpiar la tabla), el sitio lo detecta, borra la cookie y muestra el aviso "Tu sesión expiró" con el botón **Ingresar de nuevo**.

### Si una reacción no se guarda

1. Pide a la persona que salga (**Salir**) y vuelva a ingresar con su correo. Eso registra de nuevo su visita y suele resolverlo.
2. Revisa los registros del servidor en **Vercel → Project → Logs** y busca `set_poster_reaction failed` o `get_poster_reactions failed`: muestran el código y el mensaje de error de Supabase.
3. Comprueba en el SQL Editor que existan las funciones: `select public.get_poster_reactions(null);` debe devolver `counts`, `mine` y `visitor`.

### Ver y exportar los totales de reacciones

1. **Table Editor → Views → `poster_reaction_summary`** muestra los totales por póster, ordenados de más a menos reacciones.
2. También puedes correr `select * from poster_reaction_summary;` en el SQL Editor.
3. **Export → Export to CSV** descarga el archivo para Excel o Google Sheets.
4. Para ver quién reaccionó a qué, usa **Table Editor → `poster_reactions`** (cruza `visitor_id` con `visitors.id`).

## 4. Variables de entorno

Localmente van en `.env.local` (no se sube a git). En Vercel agrégalas en **Project → Settings → Environment Variables**:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://phfnqngrohmanbffppxh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clave `sb_publishable_…` del proyecto |

La clave publicable está diseñada para ser pública; la seguridad de los datos la dan las reglas RLS de este script. Nunca uses aquí la clave `secret` o `service_role`.

## Limitaciones del modelo sin verificación

- Cualquiera puede escribir un correo `@usc.edu.co` que no es suyo; quien registre varios correos distintos podría reaccionar varias veces al mismo póster.
- El acceso dura 30 días por navegador mediante una cookie; quien sepa manipular cookies podría saltarse el formulario.
- Si más adelante quieres verificar los correos, la versión con código por correo está en el historial de git (commit `1b1ac40`).
