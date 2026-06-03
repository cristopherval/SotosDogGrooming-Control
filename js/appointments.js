// appointments.js — appointment creation, "Full Service" logic, WhatsApp reminders
import { store } from './store.js';
import { t } from './i18n.js';
import {
  $, $$, openModal, closeModal, toast, escapeHtml, optionsFrom,
  todayISO, fmtDate, fmtTime, waLink, smsLink,
} from './utils.js';
import { openDogProfile } from './dogs.js';

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

/**
 * Open the appointment form for a dog. Pass `apptId` to edit an existing one.
 * onSaved() refreshes the caller (profile / appointments view).
 */
export function openAppointmentForm(dogId, onSaved, apptId) {
  const appt = apptId ? store.data.appointments.find((a) => a.id === apptId) : null;
  const active = store.activeEmployees();
  // when editing, make sure the saved employee is selectable even if now inactive
  const empList = appt && appt.employeeId && !active.some((e) => e.id === appt.employeeId)
    ? [...active, store.getEmployee(appt.employeeId)].filter(Boolean)
    : active;

  const empOptions = empList.length
    ? optionsFrom(empList.map((e) => ({ value: e.id, label: `${e.fullName}${e.role ? ' · ' + e.role : ''}` })), appt ? (appt.employeeId || '') : '', t('select'))
    : `<option value="">${escapeHtml(t('no_active_emp'))}</option>`;

  const svc = appt ? (appt.services || {}) : {};
  const servicesHTML = SERVICES.map((s) => `
    <label class="service-check">
      <input type="checkbox" data-svc="${s.key}" ${svc[s.key] ? 'checked' : ''} />
      <span>${escapeHtml(t(s.i18n))}</span>
    </label>`).join('');

  openModal({
    title: appt ? t('appt_edit') : t('appt_new'),
    bodyHTML: `
      <div class="form-row">
        <div class="field">
          <label class="form-label">${escapeHtml(t('date'))}</label>
          <input id="aDate" type="date" class="form-control" value="${appt ? (appt.date || todayISO()) : todayISO()}" />
        </div>
        <div class="field">
          <label class="form-label">${escapeHtml(t('time'))}</label>
          <input id="aTime" type="time" class="form-control" value="${appt ? (appt.time || '') : ''}" />
        </div>
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('employee'))}</label>
        <select id="aEmp" class="form-select">${empOptions}</select>
      </div>
      <label class="form-label">${escapeHtml(t('services'))}</label>
      <div class="services-list">
        <label class="service-check service-full">
          <input type="checkbox" id="svcFull" ${svc.full ? 'checked' : ''} />
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

      // Keep "Full Service" master in sync on load and on changes.
      full.checked = full.checked || items.every((c) => c.checked);
      full.addEventListener('change', () => {
        items.forEach((cb) => { cb.checked = full.checked; });
      });
      items.forEach((cb) => cb.addEventListener('change', () => {
        full.checked = items.every((c) => c.checked);
      }));

      foot.querySelector('[data-act="cancel"]').onclick = closeModal;
      const saveBtn = foot.querySelector('[data-act="save"]');
      saveBtn.onclick = async () => {
        const date = $('#aDate', body).value || todayISO();
        const time = $('#aTime', body).value || '';
        const employeeId = $('#aEmp', body).value || '';
        const services = { full: full.checked };
        items.forEach((cb) => { services[cb.getAttribute('data-svc')] = cb.checked; });

        saveBtn.disabled = true;
        try {
          await store.upsertAppointment({
            id: appt ? appt.id : store.uid('appt'),
            dogId: appt ? appt.dogId : dogId,
            date,
            time,
            employeeId,
            services,
            createdAt: appt ? (appt.createdAt || todayISO()) : todayISO(),
          });
          closeModal(); toast(t('saved'));
          if (typeof onSaved === 'function') onSaved();
        } catch (e) { saveBtn.disabled = false; }
      };
    },
  });
}

/**
 * Build the reminder message and open WhatsApp ('wa') or SMS ('sms')
 * for a given appointment.
 */
export function sendReminder(appt, channel = 'wa') {
  const dog = store.getDog(appt.dogId);
  if (!dog || !dog.phone) { toast(t('phone')); return; }
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ') || dog.name;
  const when = fmtDate(appt.date) + (appt.time ? ` ${fmtTime(appt.time)}` : '');
  const msg = t('reminder_msg', { owner, dog: dog.name, date: when });
  const link = channel === 'sms' ? smsLink(dog.phone, msg) : waLink(dog.phone, msg);
  window.open(link, '_blank', 'noopener');
}

/** Upcoming appointments (today or future), soonest first. */
export function upcomingAppointments() {
  const today = todayISO();
  return store.data.appointments
    .filter((a) => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

// ---------------- Appointments view (all, grouped by day) ----------------

/** Render the bottom-nav "Appointments" view: grouped by day, on-time vs past. */
export function renderAppointments() {
  const list = $('#apptList');
  const empty = $('#apptEmpty');
  if (!list) return;

  const all = store.data.appointments.slice();
  if (!all.length) { list.innerHTML = ''; empty.classList.remove('d-none'); return; }
  empty.classList.add('d-none');

  const today = todayISO();

  // group by date -> sort groups (upcoming first ascending, then past descending)
  const groups = {};
  all.forEach((a) => { (groups[a.date] = groups[a.date] || []).push(a); });
  const dates = Object.keys(groups).sort((a, b) => {
    const aPast = a < today, bPast = b < today;
    if (aPast !== bPast) return aPast ? 1 : -1;          // upcoming groups before past ones
    return aPast ? (a < b ? 1 : -1) : (a > b ? 1 : -1);  // past: newest first; upcoming: soonest first
  });

  list.innerHTML = dates.map((date) => {
    const past = date < today;
    const isToday = date === today;
    const statusCls = isToday ? 'appt-day--today' : (past ? 'appt-day--past' : 'appt-day--upcoming');
    const statusLbl = isToday ? t('appt_today') : (past ? t('appt_past') : t('appt_ontime'));

    const rows = groups[date]
      .slice()
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      .map((a) => {
        const dog = store.getDog(a.dogId);
        if (!dog) return '';
        const emp = a.employeeId ? store.getEmployee(a.employeeId) : null;
        const tags = serviceLabels(a).map((s) => `<span class="tl-tag">${escapeHtml(s)}</span>`).join('');
        return `
          <div class="appt-row" data-dog="${escapeHtml(dog.id)}">
            <div class="appt-row__time">${a.time ? escapeHtml(fmtTime(a.time)) : '—'}</div>
            <div class="appt-row__main">
              <div class="appt-row__dog">${escapeHtml(dog.name)}</div>
              <div class="appt-row__meta">${emp ? `<i class="ti ti-user"></i> ${escapeHtml(emp.fullName)}` : ''}</div>
              <div class="tl-services">${tags || '<span class="text-muted small">—</span>'}</div>
            </div>
            <i class="ti ti-chevron-right appt-row__chevron"></i>
          </div>`;
      }).join('');

    return `
      <div class="appt-day ${statusCls}">
        <div class="appt-day__head">
          <span class="appt-day__date"><i class="ti ti-calendar"></i> ${escapeHtml(fmtDate(date))}</span>
          <span class="appt-day__status">${escapeHtml(statusLbl)}</span>
        </div>
        ${rows}
      </div>`;
  }).join('');

  $$('.appt-row', list).forEach((r) => r.onclick = () => openDogProfile(r.getAttribute('data-dog')));
}
