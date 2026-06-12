# Seguridad — Soto's Dog Grooming

Resumen de cómo está protegida la app y qué pasos dan **más seguridad sin afectar
el funcionamiento**. Está ordenado de mayor a menor impacto.

---

## Cómo está protegido hoy (ya implementado)

- **Login obligatorio:** nadie ve datos sin iniciar sesión.
- **Row Level Security (RLS):** la base de datos rechaza cualquier lectura/escritura
  que no venga de un usuario logueado. La `anon key` que está en `js/config.js` es
  **pública por diseño** y por sí sola no da acceso a nada.
- **Registro público desactivado:** solo tú creas las cuentas desde el panel.
- **Subidas restringidas:** solo usuarios logueados pueden subir/borrar fotos.
- **Código sin huecos comunes:** todo el texto del usuario se "escapa" (anti‑XSS),
  no hay `eval`, y los enlaces externos usan `rel="noopener noreferrer"`.

> ⚠️ **Lo único que NUNCA debe subirse a GitHub** es la **`service_role` key**
> de Supabase (Project Settings → API → *service_role*). Esa sí da acceso total
> saltándose el RLS. La app no la usa y no debe estar en ningún archivo del repo.
> La `anon` key sí puede estar (es pública).

---

## Paso 1 — Endurecer el login en Supabase (alto impacto, 0 riesgo)

Panel de Supabase → **Authentication** → **Policies / Providers / Settings**:

1. **Contraseña mínima:** Authentication → Providers → Email → sube **Minimum
   password length** a **10+**.
2. **Contraseñas filtradas:** activa **"Leaked password protection"** (compara
   contra HaveIBeenPwned). Rechaza contraseñas ya comprometidas.
3. **Registro público:** confirma que **"Enable sign-ups" está APAGADO**.
4. **Confirmación por correo:** déjala activada para nuevos usuarios (evita cuentas
   con correos falsos).

## Paso 2 — Proteger tu cuenta de administrador (alto impacto)

La cuenta con la que entras a **supabase.com** controla toda la base de datos.

1. Activa **MFA / autenticación de dos factores** en tu cuenta de Supabase
   (Account → Security).
2. Usa una contraseña fuerte y única para esa cuenta.

Esto es lo más importante: si te roban esa cuenta, da igual lo demás.

## Paso 3 — Verificar que el RLS está activo (chequeo rápido)

Supabase → **SQL Editor** → corre esto. Las 4 tablas deben aparecer con
`rowsecurity = true`:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public';
```

Si alguna sale en `false`, actívala:
```sql
alter table <tabla> enable row level security;
```

## Paso 4 — Backups

Supabase hace backups automáticos en el plan de pago. En el plan gratis, usa
periódicamente **Ajustes → Exportar Respaldo** dentro de la app (descarga un JSON
con todo). Guárdalo en un lugar seguro.

---

## Decisiones con compromiso (opcionales — pueden tocar el funcionamiento)

### Bucket de fotos público
Hoy el bucket `dog-photos` es **público**: las fotos cargan directo en la app
(rápido y simple). El riesgo: cualquiera con el **link exacto** de una foto puede
verla. Los nombres son aleatorios e imposibles de adivinar, y la política de
`referrer` ya evita que el link se filtre a sitios externos.
- Si quisieras máxima privacidad, se puede pasar a **bucket privado con URLs
  firmadas**, pero eso complica el mostrado de imágenes (las URLs caducan). No
  recomendado salvo que sea un requisito real. Avísame si lo quieres.

### Content Security Policy (CSP) — opcional, probar antes
Una CSP bloquea scripts no autorizados (defensa extra anti‑XSS y supply‑chain).
**No la activé automáticamente** porque una CSP mal ajustada puede impedir que la
app cargue, y hay que probarla. Si la quieres, pega esto en `index.html` dentro de
`<head>` y **pruébala primero en la computadora**:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  script-src 'self' https://esm.sh;
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  font-src 'self' https://cdn.jsdelivr.net data:;
  img-src 'self' data: blob: https://qtsnzlcqlhdrihkwbplu.supabase.co;
  connect-src 'self' https://qtsnzlcqlhdrihkwbplu.supabase.co wss://qtsnzlcqlhdrihkwbplu.supabase.co https://esm.sh;
">
```

Cómo probar: ábrela en la computadora, abre la **consola** (F12). Si algo no carga,
la consola dirá qué origen se bloqueó → lo agregas a la línea correspondiente. Si
no quieres lidiar con eso, simplemente **no la pongas**: la app ya está protegida
por login + RLS, que es lo que de verdad cuenta.

### Quitar la dependencia de esm.sh (opcional, mejora robustez)
Hoy `supabase-js` se carga desde `esm.sh` (un CDN externo) en tiempo de ejecución.
Descargarlo y guardarlo localmente (como ya se hace con `heic2any` en `/vendor`)
quitaría esa dependencia externa y simplificaría la CSP. Avísame si lo quieres y lo
preparo.

---

## Qué NO hace falta
- Cambiar la `anon` key del repo: es pública por diseño, el RLS la protege.
- Poner contraseñas en el código: no hay ninguna; el login va contra Supabase.
