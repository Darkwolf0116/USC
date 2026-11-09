# Configuración de Supabase (acceso con correo institucional)

El sitio exige nombre completo y un correo `@usc.edu.co` verificado con un código de 6 dígitos. Supabase Auth envía el código y la base de datos guarda el registro de accesos.

Proyecto: `https://phfnqngrohmanbffppxh.supabase.co`

## 1. Crear las tablas y reglas

1. Abre **Dashboard → SQL Editor → New query**.
2. Pega el contenido de [`migrations/20261109000000_access_registry.sql`](migrations/20261109000000_access_registry.sql) y ejecútalo.

El script es seguro de ejecutar más de una vez. Crea:

| Objeto | Para qué sirve |
| --- | --- |
| Trigger `enforce_institutional_email` en `auth.users` | Rechaza en el servidor cualquier correo que no termine exactamente en `@usc.edu.co`. |
| Tabla `visitors` | Una fila por persona: nombre completo, correo, primer acceso, último acceso y número de accesos. |
| Tabla `visit_logs` | Una fila por cada ingreso verificado, con fecha y navegador. |
| Función `record_access()` | La llama el sitio después de verificar el código para registrar el ingreso. |
| Row Level Security | Cada usuario solo puede leer su propia fila; nadie puede escribir directamente desde el navegador. |

## 2. Plantillas de correo con el código

Por defecto Supabase envía un enlace, no un código. Edita **Authentication → Emails → Templates** y reemplaza el cuerpo de **Confirm signup** (primer ingreso) y de **Magic Link** (ingresos siguientes) por:

```html
<h2>Repositorio de Proyectos de Aula · Fisioterapia USC</h2>
<p>Tu código de acceso es:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>El código vence en pocos minutos. Si no solicitaste este acceso, ignora este mensaje.</p>
<p>Universidad Santiago de Cali · Facultad de Salud</p>
```

Asunto sugerido: `Tu código de acceso al repositorio de Fisioterapia USC`.

En **Authentication → Providers → Email** confirma que **Confirm email** está activo. Ahí también puedes ajustar la duración del código (OTP expiry) y su longitud (6 dígitos).

## 3. URLs permitidas

En **Authentication → URL Configuration**:

- **Site URL**: el dominio de Vercel, por ejemplo `https://tu-proyecto.vercel.app`.
- **Redirect URLs**: `http://localhost:3000/**` y `https://tu-proyecto.vercel.app/**`.

## 4. Servidor de correo propio (muy recomendado)

El servicio de correo incluido en Supabase está pensado solo para pruebas y permite muy pocos envíos por hora. Con muchos estudiantes ingresando, los códigos dejarían de llegar.

Configura un SMTP propio en **Project Settings → Authentication → SMTP Settings** (por ejemplo Resend o Brevo, que tienen planes gratuitos) y luego sube el límite en **Authentication → Rate Limits**.

## 5. Ver y exportar el registro como hoja de cálculo

1. **Table Editor → visitors** muestra la tabla como una hoja de cálculo.
2. **Export → Export to CSV** descarga el archivo, que abre directamente en Excel o Google Sheets.
3. Usa `visit_logs` si necesitas el detalle de cada ingreso.

## 6. Variables de entorno

Localmente están en `.env.local` (no se sube a git). En Vercel agrégalas en **Project → Settings → Environment Variables**:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://phfnqngrohmanbffppxh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la clave `sb_publishable_…` del proyecto |

La clave publicable está diseñada para usarse en el navegador; la seguridad la dan las reglas RLS y los triggers de este script. Nunca uses aquí la clave `secret` o `service_role`.
