# Configuración de Supabase (registro de acceso)

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

## 3. Variables de entorno

Localmente van en `.env.local` (no se sube a git). En Vercel agrégalas en **Project → Settings → Environment Variables**:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://phfnqngrohmanbffppxh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clave `sb_publishable_…` del proyecto |

La clave publicable está diseñada para ser pública; la seguridad de los datos la dan las reglas RLS de este script. Nunca uses aquí la clave `secret` o `service_role`.

## Limitaciones del modelo sin verificación

- Cualquiera puede escribir un correo `@usc.edu.co` que no es suyo.
- El acceso dura 30 días por navegador mediante una cookie; quien sepa manipular cookies podría saltarse el formulario.
- Si más adelante quieres verificar los correos, la versión con código por correo está en el historial de git (commit `1b1ac40`).
