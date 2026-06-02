# 🐶 Soto's Dog Grooming — PWA

Progressive Web App (Mobile-First) para administrar clientes (perros), vacunas,
empleados, citas y respaldos. Stack: **HTML5 + CSS3 vanilla + JavaScript ES6 modular + Tabler**.
Todo se guarda localmente en `localStorage` (sin servidor/backend).

## ▶️ Cómo ejecutarla

La app usa **módulos ES6** y un **Service Worker**, por lo que debe servirse por HTTP
(no funciona abriendo `index.html` con doble clic vía `file://`).

**Opción recomendada (VS Code):**
1. Instala la extensión **Live Server**.
2. Click derecho sobre `index.html` → **"Open with Live Server"**.

**Con Node:** `npx serve .`  ·  **Con Python:** `python -m http.server 8080`

Luego abre `http://localhost:PUERTO`. En el móvil podrás "Agregar a pantalla de inicio".

## 📂 Estructura

```
index.html              Estructura base (Tabler) + vistas
css/style.css           Tema púrpura (#7B61FF) + Dark Mode
js/app.js               Router, navegación, tema, eventos globales
js/store.js             Persistencia (localStorage) + import/export
js/i18n.js              Traducciones EN (default) / ES
js/utils.js             Helpers, modales, toasts, fotos, links de contacto
js/dogs.js              Home, búsqueda, filtros, perfil, timeline, badges
js/vaccines.js          Lógica dinámica de estado de vacunas + catálogo
js/employees.js         CRUD de empleados
js/appointments.js      Citas, "Full Service", recordatorios WhatsApp
js/settings.js          Backup, estadísticas, idioma
manifest.webmanifest    Metadatos PWA
sw.js                   Service Worker (cache offline)
icons/icon.svg          Ícono de la app
```

## ✨ Funcionalidades

- **Perros:** perfil completo, foto (cámara/galería), dueño con botones WhatsApp/SMS/Llamar,
  especificaciones de corte (cuchillas), notas.
- **Vacunas (dinámicas):** catálogo maestro editable (Rabies por defecto). Estados:
  🟢 Al día · 🟠 Necesita renovar · 🔴 Faltan vacunas.
- **Búsqueda inteligente** por nombre del perro o dueño + **filtros avanzados**
  (raza, color, sexo, estado de vacunas).
- **Empleados:** CRUD con estado Activo/Inactivo y WhatsApp directo.
- **Citas:** servicios con lógica **"Full Service"** automática, empleado asignado,
  e historial en **Timeline** vertical dentro del perfil.
- **Innovador:** recordatorio automático por WhatsApp para citas próximas,
  badges de cumpleaños/alerta en el Home.
- **Respaldo:** barra de almacenamiento, contadores, **Export/Import .json**.
- **Dark/Light mode** (esquina superior derecha) + **idioma EN/ES** (en Ajustes).

> Nota de UX: los modales **no se cierran** al hacer clic fuera (solo con el botón ✕ o Cancelar),
> tal como se solicitó.
