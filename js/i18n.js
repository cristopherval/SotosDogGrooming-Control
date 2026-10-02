// i18n.js — English (default) & Spanish dictionaries + helpers
import { store } from './store.js';

export const STRINGS = {
  en: {
    brand_subtitle: 'Dog Grooming',
    nav_dogs: 'Dogs', nav_appointments: 'Visits', nav_employees: 'Employees', nav_settings: 'Settings',
    no_appointments: 'No visits yet.',
    appt_today: 'Today', appt_ontime: 'On time', appt_past: 'Past due',
    add_dog: 'Add Dog', add_employee: 'Add Employee', add: 'Add',
    search_placeholder: 'Search dog or owner…',
    all: 'All', f_breed: 'Breed', f_color: 'Color', f_sex: 'Sex', f_status: 'Vaccine Status',
    male: 'Male', female: 'Female', clear_filters: 'Clear filters',
    sort_by: 'Sort by', sort_az: 'Name (A–Z)', sort_owner: 'Owner (A–Z)',
    sort_added: 'Recently added', sort_modified: 'Recently updated', sort_visit: 'Last visit',
    st_uptodate: 'Up to Date', st_renewal: 'Needs Renewal', st_missing: 'Missing Vaccines',
    no_dogs: 'No dogs yet. Tap "Add Dog" to start.',
    no_employees: 'No employees yet.',
    upcoming_title: 'Upcoming appointments',
    in_shop_now: 'In the shop now',

    // visits (walk-in)
    new_visit: 'New Visit', visit_new: 'New Visit', visit_edit: 'Edit Visit',
    add_visit: 'Add Visit', no_visits: 'No visits registered yet.',
    visit_history: 'History', in_progress: 'In progress',
    dog: 'Dog', choose_dog: 'Select a dog…', required_dog: 'Please select a dog',
    arrival: 'Arrival', departure: 'Departure', mark_departure: 'Check out',
    checked_out: 'Departure registered', duration: 'Duration', amount: 'Amount',
    confirm_delete_visit: 'Delete this visit?', visits_word: 'visits',

    // printable / shareable documents
    dog_sheet: 'Grooming Sheet', receipt: 'Receipt',
    print: 'Print', share: 'Share', print_share_sheet: 'Print / Share sheet',
    total: 'Total', thanks: 'Thank you for your business!',
    preparing: 'Preparing…', copied: 'Copied to clipboard', share_failed: 'Could not share',

    // dog form
    dog_new: 'New Dog', dog_edit: 'Edit Dog',
    photo_hint: 'Add photos from the camera or the gallery',
    add_photos: 'Add photos', take_photo: 'Camera', choose_gallery: 'Gallery',
    photos: 'Photos', photos_before: 'Before (arrival)', photos_after: 'After (results)', photos_details: 'Details',
    price: 'Price',
    set_cover: 'Use as main photo', cover_set: 'Main photo updated', move_photo: 'Move photo', move_to: 'Move to…',
    photo_error: 'Some photos could not be added (unsupported format).',
    name: 'Name', breed: 'Breed', color: 'Color', sex: 'Sex', birthday: 'Birthday',
    owner_info: 'Owner', owner_first: 'Owner First Name', owner_last: 'Owner Last Name',
    phone: 'Phone Number', grooming_specs: 'Blades', attended_by: 'Attended by',
    blade_head: 'Blade on Head', blade_body: 'Blade on Body', notes: 'Notes',
    comb_specs: 'Combs', comb_head: 'Comb on Head', comb_body: 'Comb on Body',
    care_specs: 'Routine Care', select: 'Select…',

    // profile
    edit: 'Edit', delete: 'Delete', cancel: 'Cancel', save: 'Save', close: 'Close',
    owner: 'Owner', vaccines: 'Vaccines', grooming_history: 'Grooming History',
    no_history: 'No appointments recorded yet.',
    add_appointment: 'Add Appointment', applied_on: 'Applied on', not_applied: 'Not applied',
    expired: 'Expired', valid_until: 'Valid until',

    // employee
    emp_new: 'New Employee', emp_edit: 'Edit Employee',
    full_name: 'Full Name', role: 'Role / Position', status: 'Status',
    active: 'Active', inactive: 'Inactive',

    // appointment
    appt_new: 'New Appointment', appt_edit: 'Edit Appointment', date: 'Date', time: 'Time', employee: 'Employee',
    services: 'Services', full_service: 'Full Service',
    svc_bath: 'Bath', svc_nail: 'Nail Clipping', svc_anal: 'Anal Gland Expression',
    svc_haircut: 'Haircut', svc_bathdry: 'Bath & Dry',
    svc_paws: 'Paw Shaving', svc_teeth: 'Teeth Brushing', svc_deshed: 'Deshedding',
    no_active_emp: 'No active employees — add one first.',

    // vaccine catalog
    vaccine_catalog: 'Vaccine Catalog', vax_new: 'New Vaccine', vax_name: 'Vaccine Name',
    duration_months: 'Validity (months)',

    // settings / backup
    storage_used: 'Storage used', backup: 'Backup',
    backup_desc: 'Export your full database or restore from a file.',
    export_backup: 'Export Backup', restore_backup: 'Restore Backup',
    stat_dogs: 'Total Dogs', stat_employees: 'Total Employees',
    stat_appointments: 'Total Visits', stat_photos: 'Total Photos',
    language: 'Language',
    theme: 'Theme', themes_light: 'Light', themes_dark: 'Dark',

    // confirmations / toasts
    confirm_delete_dog: 'Delete this dog and its history?',
    confirm_delete_emp: 'Delete this employee?',
    confirm_delete_vax: 'Delete this vaccine from the catalog?',
    confirm_restore: 'This will OVERWRITE all current data. Continue?',
    saved: 'Saved', deleted: 'Deleted', restored: 'Backup restored',
    exported: 'Backup exported', invalid_backup: 'Invalid backup file',
    required_name: 'Name is required',
    remind: 'Remind', whatsapp: 'WhatsApp', sms: 'SMS', call: 'Call',
    reminder_msg: 'Hi {owner}! 🐶 This is a reminder for {dog}\'s grooming appointment on {date} at Soto\'s Dog Grooming. See you soon!',
    birthday_month: 'Birthday this month', has_alert: 'Has an alert in notes',
    confirm_delete_appt: 'Delete this appointment?',

    // auth + cloud
    save_failed: 'Could not save — check your internet connection.',
    load_failed: 'Could not load data — check your internet connection.',
    refreshed: 'Updated',
    sign_in: 'Sign in', sign_in_subtitle: 'Sign in to manage your shop',
    email: 'Email', password: 'Password',
    login_failed: 'Wrong email or password.',
    signing_in: 'Signing in…',
    account: 'Account', logout: 'Log out', confirm_logout: 'Log out of this account?',
    cloud_label: 'Cloud (Supabase)', cloud_desc: 'Your data is stored securely online.',
    migrate_title: 'Local data found', migrate_btn: 'Upload to cloud',
    migrate_desc: 'This device still has data saved locally. Upload it to your Supabase account.',
    migrating: 'Uploading… {n}/{total}', migrate_done: 'Local data uploaded to the cloud',
    migrate_failed: 'Upload failed — check your connection and try again.',

    // ---- Entrance tablet (kiosk) — text the CUSTOMER reads ----
    k_welcome: 'Welcome to',
    k_tagline: 'Register your dog, or look up their grooming card.',
    k_new_dog: 'New Dog', k_find_dog: 'Find My Dog',
    k_search_title: 'Find your dog', k_search_ph: "Type your dog's name…",
    k_search_btn: 'Search', k_pick_yours: 'Tap your dog',
    k_no_results: 'We found no dog named “{name}”.',
    k_no_results_hint: 'Check the spelling, or register as a new dog.',
    k_back: 'Back', k_done: 'Done',
    k_card_title: 'Grooming card',
    k_no_specs: 'Your groomer will set this up.',
    k_form_title: 'Register your dog',
    k_form_owner: 'Your information', k_form_dog: "Your dog's information",
    k_cut_request: 'How would you like the cut?',
    k_cut_request_ph: 'e.g. short on the body, round head, short nails…',
    k_cut_hint: 'Totally optional — you can also just tell us in person.',
    k_optional: 'Optional',
    k_submit: 'Send', k_sending: 'Sending…',
    k_thanks: 'Thank you!',
    k_thanks_sub: 'We have {dog}’s information. Someone will be with you shortly.',
    k_required_name: "Please type your dog's name.",
    k_save_failed: 'We could not send it. Please let the front desk know.',
    k_pin_title: 'Enter PIN', k_pin_wrong: 'Wrong PIN',

    // ---- Kiosk settings + pending review — text the SHOP reads ----
    kiosk_title: 'Entrance tablet',
    kiosk_desc: 'Turn this device into a welcome screen for customers. They can register a new dog or look up their dog’s grooming card — and nothing else.',
    kiosk_start: 'Start kiosk mode',
    kiosk_pin_label: 'PIN to exit kiosk (4 digits)',
    kiosk_pin_saved: 'PIN saved', kiosk_pin_invalid: 'The PIN must be 4 digits.',
    kiosk_lock_tip: 'Tip: also turn on Guided Access (iPad) or screen pinning (Android) so the tablet cannot leave the app.',
    pending_title: 'New dogs to review', pending_badge: 'Pending',
    pending_desc: 'Registered by customers on the entrance tablet. Review and approve to add them to your list.',
    approve: 'Approve', approved: 'Dog approved',
    cut_request: 'Cut requested by the customer',
  },

  es: {
    brand_subtitle: 'Estética Canina',
    nav_dogs: 'Perros', nav_appointments: 'Visitas', nav_employees: 'Empleados', nav_settings: 'Ajustes',
    no_appointments: 'Aún no hay visitas.',
    appt_today: 'Hoy', appt_ontime: 'A tiempo', appt_past: 'Fecha pasada',
    add_dog: 'Agregar Perro', add_employee: 'Agregar Empleado', add: 'Agregar',
    search_placeholder: 'Buscar perro o dueño…',
    all: 'Todos', f_breed: 'Raza', f_color: 'Color', f_sex: 'Sexo', f_status: 'Estado Vacunas',
    male: 'Macho', female: 'Hembra', clear_filters: 'Limpiar filtros',
    sort_by: 'Ordenar por', sort_az: 'Nombre (A–Z)', sort_owner: 'Dueño (A–Z)',
    sort_added: 'Agregado recientemente', sort_modified: 'Modificado recientemente', sort_visit: 'Última visita',
    st_uptodate: 'Al día', st_renewal: 'Necesita Renovar', st_missing: 'Faltan Vacunas',
    no_dogs: 'Aún no hay perros. Toca "Agregar Perro" para empezar.',
    no_employees: 'Aún no hay empleados.',
    upcoming_title: 'Próximas citas',
    in_shop_now: 'En el local ahora',

    // visitas (walk-in)
    new_visit: 'Nueva Visita', visit_new: 'Nueva Visita', visit_edit: 'Editar Visita',
    add_visit: 'Registrar Visita', no_visits: 'Aún no hay visitas registradas.',
    visit_history: 'Historial', in_progress: 'En curso',
    dog: 'Perro', choose_dog: 'Selecciona un perro…', required_dog: 'Selecciona un perro',
    arrival: 'Entrada', departure: 'Salida', mark_departure: 'Marcar salida',
    checked_out: 'Salida registrada', duration: 'Duración', amount: 'Cobro',
    confirm_delete_visit: '¿Eliminar esta visita?', visits_word: 'visitas',

    // documentos imprimibles / compartibles
    dog_sheet: 'Ficha del Perro', receipt: 'Recibo',
    print: 'Imprimir', share: 'Compartir', print_share_sheet: 'Imprimir / Compartir ficha',
    total: 'Total', thanks: '¡Gracias por su preferencia!',
    preparing: 'Preparando…', copied: 'Copiado al portapapeles', share_failed: 'No se pudo compartir',

    dog_new: 'Nuevo Perro', dog_edit: 'Editar Perro',
    photo_hint: 'Agrega fotos desde la cámara o la galería',
    add_photos: 'Agregar fotos', take_photo: 'Cámara', choose_gallery: 'Galería',
    photos: 'Fotos', photos_before: 'Antes (cómo llegó)', photos_after: 'Después (resultado)', photos_details: 'Detalles',
    price: 'Precio',
    set_cover: 'Usar como foto principal', cover_set: 'Foto principal actualizada', move_photo: 'Mover foto', move_to: 'Mover a…',
    photo_error: 'No se pudieron agregar algunas fotos (formato no soportado).',
    name: 'Nombre', breed: 'Raza', color: 'Color', sex: 'Sexo', birthday: 'Cumpleaños',
    owner_info: 'Dueño', owner_first: 'Nombre del Dueño', owner_last: 'Apellido del Dueño',
    phone: 'Teléfono', grooming_specs: 'Cuchillas', attended_by: 'Atendido por',
    blade_head: 'Cuchilla en Cabeza', blade_body: 'Cuchilla en Cuerpo', notes: 'Notas',
    comb_specs: 'Peines (Combs)', comb_head: 'Comb en Cabeza', comb_body: 'Comb en Cuerpo',
    care_specs: 'Cuidados de Rutina', select: 'Seleccionar…',

    edit: 'Editar', delete: 'Eliminar', cancel: 'Cancelar', save: 'Guardar', close: 'Cerrar',
    owner: 'Dueño', vaccines: 'Vacunas', grooming_history: 'Historial de Cortes',
    no_history: 'Aún no hay citas registradas.',
    add_appointment: 'Agregar Cita', applied_on: 'Aplicada el', not_applied: 'No aplicada',
    expired: 'Expirada', valid_until: 'Válida hasta',

    emp_new: 'Nuevo Empleado', emp_edit: 'Editar Empleado',
    full_name: 'Nombre Completo', role: 'Cargo / Puesto', status: 'Estado',
    active: 'Activo', inactive: 'Inactivo',

    appt_new: 'Nueva Cita', appt_edit: 'Editar Cita', date: 'Fecha', time: 'Hora', employee: 'Empleado',
    services: 'Servicios', full_service: 'Servicio Completo',
    svc_bath: 'Baño', svc_nail: 'Corte de Uñas', svc_anal: 'Glándulas Anales',
    svc_haircut: 'Corte de Pelo', svc_bathdry: 'Baño y Secado',
    svc_paws: 'Patas Rasuradas', svc_teeth: 'Cepillado de Dientes', svc_deshed: 'Deshedding',
    no_active_emp: 'No hay empleados activos — agrega uno primero.',

    vaccine_catalog: 'Catálogo de Vacunas', vax_new: 'Nueva Vacuna', vax_name: 'Nombre de Vacuna',
    duration_months: 'Vigencia (meses)',

    storage_used: 'Almacenamiento usado', backup: 'Respaldo',
    backup_desc: 'Exporta toda tu base de datos o restaura desde un archivo.',
    export_backup: 'Exportar Respaldo', restore_backup: 'Restaurar Respaldo',
    stat_dogs: 'Total Perros', stat_employees: 'Total Empleados',
    stat_appointments: 'Total Visitas', stat_photos: 'Total Fotos',
    language: 'Idioma',
    theme: 'Tema', themes_light: 'Claros', themes_dark: 'Oscuros',

    confirm_delete_dog: '¿Eliminar este perro y su historial?',
    confirm_delete_emp: '¿Eliminar este empleado?',
    confirm_delete_vax: '¿Eliminar esta vacuna del catálogo?',
    confirm_restore: 'Esto SOBRESCRIBIRÁ todos los datos actuales. ¿Continuar?',
    saved: 'Guardado', deleted: 'Eliminado', restored: 'Respaldo restaurado',
    exported: 'Respaldo exportado', invalid_backup: 'Archivo de respaldo inválido',
    required_name: 'El nombre es obligatorio',
    remind: 'Recordar', whatsapp: 'WhatsApp', sms: 'SMS', call: 'Llamar',
    reminder_msg: '¡Hola {owner}! 🐶 Te recordamos la cita de aseo de {dog} el {date} en Soto\'s Dog Grooming. ¡Te esperamos!',
    birthday_month: 'Cumpleaños este mes', has_alert: 'Tiene una alerta en notas',
    confirm_delete_appt: '¿Eliminar esta cita?',

    // auth + cloud
    save_failed: 'No se pudo guardar — revisa tu conexión a internet.',
    load_failed: 'No se pudieron cargar los datos — revisa tu conexión a internet.',
    refreshed: 'Actualizado',
    sign_in: 'Iniciar sesión', sign_in_subtitle: 'Inicia sesión para administrar tu negocio',
    email: 'Correo', password: 'Contraseña',
    login_failed: 'Correo o contraseña incorrectos.',
    signing_in: 'Iniciando sesión…',
    account: 'Cuenta', logout: 'Cerrar sesión', confirm_logout: '¿Cerrar sesión de esta cuenta?',
    cloud_label: 'Nube (Supabase)', cloud_desc: 'Tus datos se guardan de forma segura en línea.',
    migrate_title: 'Datos locales encontrados', migrate_btn: 'Subir a la nube',
    migrate_desc: 'Este dispositivo aún tiene datos guardados localmente. Súbelos a tu cuenta de Supabase.',
    migrating: 'Subiendo… {n}/{total}', migrate_done: 'Datos locales subidos a la nube',
    migrate_failed: 'Falló la subida — revisa tu conexión e intenta de nuevo.',

    // ---- Tablet de la entrada (kiosco) — texto que lee el CLIENTE ----
    k_welcome: 'Bienvenido a',
    k_tagline: 'Registra a tu perrito, o consulta su ficha de corte.',
    k_new_dog: 'Perro Nuevo', k_find_dog: 'Buscar mi perro',
    k_search_title: 'Busca a tu perrito', k_search_ph: 'Escribe el nombre de tu perrito…',
    k_search_btn: 'Buscar', k_pick_yours: 'Toca a tu perrito',
    k_no_results: 'No encontramos ningún perrito que se llame “{name}”.',
    k_no_results_hint: 'Revisa cómo se escribe, o regístralo como perro nuevo.',
    k_back: 'Volver', k_done: 'Listo',
    k_card_title: 'Ficha de corte',
    k_no_specs: 'Tu peluquera lo va a definir.',
    k_form_title: 'Registra a tu perrito',
    k_form_owner: 'Tus datos', k_form_dog: 'Datos de tu perrito',
    k_cut_request: '¿Cómo quieres el corte?',
    k_cut_request_ph: 'Ej. cortito del cuerpo, la cabecita redonda, uñas cortas…',
    k_cut_hint: 'Es totalmente opcional — también puedes decírnoslo en persona.',
    k_optional: 'Opcional',
    k_submit: 'Enviar', k_sending: 'Enviando…',
    k_thanks: '¡Gracias!',
    k_thanks_sub: 'Ya tenemos los datos de {dog}. En un momento te atendemos.',
    k_required_name: 'Escribe el nombre de tu perrito.',
    k_save_failed: 'No se pudo enviar. Por favor avísale a la recepción.',
    k_pin_title: 'Ingresa el PIN', k_pin_wrong: 'PIN incorrecto',

    // ---- Ajustes del kiosco + revisión — texto que lee el NEGOCIO ----
    kiosk_title: 'Tablet de la entrada',
    kiosk_desc: 'Convierte este dispositivo en una pantalla de bienvenida para los clientes. Pueden registrar un perro nuevo o consultar la ficha de su perrito — y nada más.',
    kiosk_start: 'Activar modo kiosco',
    kiosk_pin_label: 'PIN para salir del kiosco (4 dígitos)',
    kiosk_pin_saved: 'PIN guardado', kiosk_pin_invalid: 'El PIN debe tener 4 dígitos.',
    kiosk_lock_tip: 'Consejo: activa también el Acceso Guiado (iPad) o el anclaje de pantalla (Android) para que la tablet no pueda salirse de la app.',
    pending_title: 'Perros nuevos por revisar', pending_badge: 'Pendiente',
    pending_desc: 'Registrados por clientes en la tablet de la entrada. Revísalos y apruébalos para agregarlos a tu lista.',
    approve: 'Aprobar', approved: 'Perro aprobado',
    cut_request: 'Corte que pidió el cliente',
  },
};

export function getLang() { return store.data.settings.language || 'en'; }

export function t(key, vars) {
  const lang = getLang();
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

/** Apply translations to every [data-i18n] / [data-i18n-ph] node currently in DOM. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.documentElement.lang = getLang();
}
