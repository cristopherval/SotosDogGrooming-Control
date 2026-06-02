// i18n.js — English (default) & Spanish dictionaries + helpers
import { store } from './store.js';

export const STRINGS = {
  en: {
    brand_subtitle: 'Dog Grooming',
    nav_dogs: 'Dogs', nav_employees: 'Employees', nav_settings: 'Settings',
    add_dog: 'Add Dog', add_employee: 'Add Employee', add: 'Add',
    search_placeholder: 'Search dog or owner…',
    all: 'All', f_breed: 'Breed', f_color: 'Color', f_sex: 'Sex', f_status: 'Vaccine Status',
    male: 'Male', female: 'Female', clear_filters: 'Clear filters',
    st_uptodate: 'Up to Date', st_renewal: 'Needs Renewal', st_missing: 'Missing Vaccines',
    no_dogs: 'No dogs yet. Tap "Add Dog" to start.',
    no_employees: 'No employees yet.',
    upcoming_title: 'Upcoming appointments',

    // dog form
    dog_new: 'New Dog', dog_edit: 'Edit Dog',
    photo_hint: 'Tap to add photos (camera or gallery)',
    add_photos: 'Add photos',
    name: 'Name', breed: 'Breed', color: 'Color', sex: 'Sex', birthday: 'Birthday',
    owner_info: 'Owner', owner_first: 'Owner First Name', owner_last: 'Owner Last Name',
    phone: 'Phone Number', grooming_specs: 'Grooming Specs',
    blade_head: 'Blade used on Head', blade_body: 'Blade used on Body', notes: 'Notes',
    select: 'Select…',

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
    appt_new: 'New Appointment', date: 'Date', employee: 'Employee',
    services: 'Services', full_service: 'Full Service',
    svc_bath: 'Bath', svc_nail: 'Nail Clipping', svc_anal: 'Anal Gland Expression',
    svc_haircut: 'Haircut', svc_bathdry: 'Bath & Dry',
    no_active_emp: 'No active employees — add one first.',

    // vaccine catalog
    vaccine_catalog: 'Vaccine Catalog', vax_new: 'New Vaccine', vax_name: 'Vaccine Name',
    duration_months: 'Validity (months)',

    // settings / backup
    storage_used: 'Storage used', backup: 'Backup',
    backup_desc: 'Export your full database or restore from a file.',
    export_backup: 'Export Backup', restore_backup: 'Restore Backup',
    stat_dogs: 'Total Dogs', stat_employees: 'Total Employees',
    stat_appointments: 'Total Appointments', stat_photos: 'Total Photos',
    language: 'Language',

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
  },

  es: {
    brand_subtitle: 'Estética Canina',
    nav_dogs: 'Perros', nav_employees: 'Empleados', nav_settings: 'Ajustes',
    add_dog: 'Agregar Perro', add_employee: 'Agregar Empleado', add: 'Agregar',
    search_placeholder: 'Buscar perro o dueño…',
    all: 'Todos', f_breed: 'Raza', f_color: 'Color', f_sex: 'Sexo', f_status: 'Estado Vacunas',
    male: 'Macho', female: 'Hembra', clear_filters: 'Limpiar filtros',
    st_uptodate: 'Al día', st_renewal: 'Necesita Renovar', st_missing: 'Faltan Vacunas',
    no_dogs: 'Aún no hay perros. Toca "Agregar Perro" para empezar.',
    no_employees: 'Aún no hay empleados.',
    upcoming_title: 'Próximas citas',

    dog_new: 'Nuevo Perro', dog_edit: 'Editar Perro',
    photo_hint: 'Toca para agregar fotos (cámara o galería)',
    add_photos: 'Agregar fotos',
    name: 'Nombre', breed: 'Raza', color: 'Color', sex: 'Sexo', birthday: 'Cumpleaños',
    owner_info: 'Dueño', owner_first: 'Nombre del Dueño', owner_last: 'Apellido del Dueño',
    phone: 'Teléfono', grooming_specs: 'Especificaciones de Corte',
    blade_head: 'Cuchilla en Cabeza', blade_body: 'Cuchilla en Cuerpo', notes: 'Notas',
    select: 'Seleccionar…',

    edit: 'Editar', delete: 'Eliminar', cancel: 'Cancelar', save: 'Guardar', close: 'Cerrar',
    owner: 'Dueño', vaccines: 'Vacunas', grooming_history: 'Historial de Cortes',
    no_history: 'Aún no hay citas registradas.',
    add_appointment: 'Agregar Cita', applied_on: 'Aplicada el', not_applied: 'No aplicada',
    expired: 'Expirada', valid_until: 'Válida hasta',

    emp_new: 'Nuevo Empleado', emp_edit: 'Editar Empleado',
    full_name: 'Nombre Completo', role: 'Cargo / Puesto', status: 'Estado',
    active: 'Activo', inactive: 'Inactivo',

    appt_new: 'Nueva Cita', date: 'Fecha', employee: 'Empleado',
    services: 'Servicios', full_service: 'Servicio Completo',
    svc_bath: 'Baño', svc_nail: 'Corte de Uñas', svc_anal: 'Glándulas Anales',
    svc_haircut: 'Corte de Pelo', svc_bathdry: 'Baño y Secado',
    no_active_emp: 'No hay empleados activos — agrega uno primero.',

    vaccine_catalog: 'Catálogo de Vacunas', vax_new: 'Nueva Vacuna', vax_name: 'Nombre de Vacuna',
    duration_months: 'Vigencia (meses)',

    storage_used: 'Almacenamiento usado', backup: 'Respaldo',
    backup_desc: 'Exporta toda tu base de datos o restaura desde un archivo.',
    export_backup: 'Exportar Respaldo', restore_backup: 'Restaurar Respaldo',
    stat_dogs: 'Total Perros', stat_employees: 'Total Empleados',
    stat_appointments: 'Total Citas', stat_photos: 'Total Fotos',
    language: 'Idioma',

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
