// appointments.js — appointment creation, "Full Service" logic, WhatsApp reminders
import { store } from './store.js';
import { t } from './i18n.js';
import {
  $, $$, openModal, closeModal, toast, escapeHtml, optionsFrom,
  todayISO, fmtDate, waLink,
} from './utils.js';

// Service definitions (order 1..5). 'full' is the master toggle.
export const SERVICES = [
  { key: 'bath', i18n: 'svc_bath' },
  { key: 'nail', i18n: 'svc_nail' },
  { key: 'anal', i18n: 'svc_anal' },
  { key: 'haircut', i18n: 'svc_haircut' },
  { key: 'bathdry', i18n: 'svc_bathdry' },
];

export function serviceLabels(appt) {
  if (appt.services && appt.services.full) return [t('full_service')];
  return SERVICES.filter((s) => appt.services && appt.services[s.key]).map((s) => t(s.i18n));
}

/** Open the "New Appointment" form for a dog. onSaved() refreshes the profile. */
export function openAppointmentForm(dogId, onSaved) {
  const dog = store.getDog(dogId);
  const active = store.activeEmployees();

  const empOptions = active.length
    ? optionsFrom(active.map((e) => ({ value: e.id, label: `${e.fullName}${e.role ? ' · ' + e.role : ''}` })), '', t('select'))
    : `<option value="">${escapeHtml(t('no_active_emp'))}</option>`;

  const servicesHTML = SERVICES.map((s) => `
    <label class="service-check">
      <input type="checkbox" data-svc="${s.key}" />
      <span>${escapeHtml(t(s.i18n))}</span>
    </label>`).join('');

  openModal({
    title: t('appt_new'),
    bodyHTML: `
      <div class="form-row">
        <div class="field">
          <label class="form-label">${escapeHtml(t('date'))}</label>
          <input id="aDate" type="date" class="form-control" value="${todayISO()}" />
        </div>
        <div class="field">
          <label class="form-label">${escapeHtml(t('employee'))}</label>
          <select id="aEmp" class="form-select">${empOptions}</select>
        </div>
      </div>
      <label class="form-label">${escapeHtml(t('services'))}</label>
      <div class="services-list">
        <label class="service-check service-full">
          <input type="checkbox" id="svcFull" />
          <span>${escapeHtml(t('full_service'))}</span>
        </label>
        ${servicesHTML}
      </div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(t('cancel'))}</button>
      <button class="btn btn-primary" data-act="save">${escapeHtml(t('save'))}</button>`,
    onMount(body, foot) {
      const full = $('#svcFull', body);
      const items = $$('[data-svc]', body);

      // Click "Full Service" -> toggle all the others.
      full.addEventListener('change', () => {
        items.forEach((cb) => { cb.checked = full.checked; });
      });
      // Manually toggling items syncs the Full Service master.
      items.forEach((cb) => cb.addEventListener('change', () => {
        full.checked = items.every((c) => c.checked);
      }));

      foot.querySelector('[data-act="cancel"]').onclick = closeModal;
      foot.querySelector('[data-act="save"]').onclick = () => {
        const date = $('#aDate', body).value || todayISO();
        const employeeId = $('#aEmp', body).value || '';
        const services = { full: full.checked };
        items.forEach((cb) => { services[cb.getAttribute('data-svc')] = cb.checked; });

        store.upsertAppointment({
          id: store.uid('appt'),
          dogId,
          date,
          employeeId,
          services,
          createdAt: todayISO(),
        });
        closeModal(); toast(t('saved'));
        if (typeof onSaved === 'function') onSaved();
      };
    },
  });
}

/** Build the reminder message and open WhatsApp for a given appointment. */
export function sendReminder(appt) {
  const dog = store.getDog(appt.dogId);
  if (!dog || !dog.phone) { toast(t('phone')); return; }
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ') || dog.name;
  const msg = t('reminder_msg', { owner, dog: dog.name, date: fmtDate(appt.date) });
  window.open(waLink(dog.phone, msg), '_blank', 'noopener');
}

/** Upcoming appointments (today or future), soonest first. */
export function upcomingAppointments() {
  const today = todayISO();
  return store.data.appointments
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}
