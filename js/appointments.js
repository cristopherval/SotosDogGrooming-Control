// appointments.js — walk-in VISITS: dog arrives (arrival time), gets a service,
// and leaves (departure time). Data lives in the `appointments` table.
import { store } from './store.js';
import { t } from './i18n.js';
import {
  $, $$, openModal, closeModal, confirmDialog, toast, escapeHtml, optionsFrom,
  todayISO, nowTime, fmtDate, fmtTime, durationLabel, money,
} from './utils.js';
import { openDogProfile } from './dogs.js';
import { openVisitReceipt } from './print.js';

// Service definitions (order 1..5). 'full' is the master toggle.
export const SERVICES = [
  { key: 'bath', i18n: 'svc_bath' },
  { key: 'nail', i18n: 'svc_nail' },
  { key: 'anal', i18n: 'svc_anal' },
  { key: 'haircut', i18n: 'svc_haircut' },
  { key: 'bathdry', i18n: 'svc_bathdry' },
];

export function serviceLabels(visit) {
  if (visit.services && visit.services.full) return [t('full_service')];
  return SERVICES.filter((s) => visit.services && visit.services[s.key]).map((s) => t(s.i18n));
}

/** A visit is "in progress" when it's today and has no departure time yet. */
function isLive(v) { return v.date === todayISO() && !v.timeOut; }

/** In-progress visits (dogs currently in the shop), earliest arrival first. */
export function activeVisits() {
  return store.data.appointments
    .filter(isLive)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

/**
 * Open the visit form.
 *   - openVisitForm()                 → new walk-in, shows a dog picker
 *   - openVisitForm(dogId, onSaved)   → new visit for a known dog (from profile)
 *   - openVisitForm(dogId, onSaved, visitId) → edit an existing visit
 * onSaved() refreshes the caller (visits view / dog profile).
 */
export function openVisitForm(dogId, onSaved, visitId) {
  const visit = visitId ? store.data.appointments.find((a) => a.id === visitId) : null;
  const fixedDogId = visit ? visit.dogId : (dogId || '');
  const showPicker = !fixedDogId; // only when it's a brand-new walk-in with no dog yet
  const fixedDog = fixedDogId ? store.getDog(fixedDogId) : null;

  // dog picker (searchable combobox) — all dogs, by name
  const dogs = store.data.dogs.slice().sort((a, b) => a.name.localeCompare(b.name));

  // employees (optional): active + the currently-assigned one if now inactive
  const active = store.activeEmployees();
  const empList = visit && visit.employeeId && !active.some((e) => e.id === visit.employeeId)
    ? [...active, store.getEmployee(visit.employeeId)].filter(Boolean)
    : active;
  const empOptions = optionsFrom(
    empList.map((e) => ({ value: e.id, label: `${e.fullName}${e.role ? ' · ' + e.role : ''}` })),
    visit ? (visit.employeeId || '') : '', t('select'));

  const svc = visit ? (visit.services || {}) : {};
  const servicesHTML = SERVICES.map((s) => `
    <label class="service-check">
      <input type="checkbox" data-svc="${s.key}" ${svc[s.key] ? 'checked' : ''} />
      <span>${escapeHtml(t(s.i18n))}</span>
    </label>`).join('');

  const dogFieldHTML = showPicker
    ? `<div class="field">
         <label class="form-label">${escapeHtml(t('dog'))}</label>
         <div class="dog-combo">
           <span class="input-icon-addon dog-combo__ico"><i class="ti ti-search"></i></span>
           <input type="text" id="vDogSearch" class="form-control dog-combo__input" placeholder="${escapeHtml(t('choose_dog'))}" autocomplete="off" />
           <input type="hidden" id="vDog" value="" />
           <div class="dog-combo__list d-none" id="vDogList"></div>
         </div>
       </div>`
    : `<div class="field">
         <label class="form-label">${escapeHtml(t('dog'))}</label>
         <input class="form-control" value="${escapeHtml(fixedDog ? fixedDog.name : '')}" disabled />
       </div>`;

  const priceValue = visit ? (visit.price || '') : (fixedDog ? (fixedDog.price || '') : '');

  openModal({
    title: visit ? t('visit_edit') : t('visit_new'),
    bodyHTML: `
      ${dogFieldHTML}

      <label class="form-label">${escapeHtml(t('services'))}</label>
      <div class="services-list">
        <label class="service-check service-full">
          <input type="checkbox" id="svcFull" ${svc.full ? 'checked' : ''} />
          <span>${escapeHtml(t('full_service'))}</span>
        </label>
        ${servicesHTML}
      </div>

      <div class="form-row">
        <div class="field">
          <label class="form-label">${escapeHtml(t('date'))}</label>
          <input id="vDate" type="date" class="form-control" value="${visit ? (visit.date || todayISO()) : todayISO()}" />
        </div>
        <div class="field">
          <label class="form-label">${escapeHtml(t('arrival'))}</label>
          <input id="vIn" type="time" class="form-control" value="${visit ? (visit.time || '') : nowTime()}" />
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label class="form-label">${escapeHtml(t('departure'))}</label>
          <input id="vOut" type="time" class="form-control" value="${visit ? (visit.timeOut || '') : ''}" />
        </div>
        <div class="field">
          <label class="form-label">${escapeHtml(t('amount'))}</label>
          <input id="vPrice" class="form-control" inputmode="decimal" placeholder="$" value="${escapeHtml(priceValue)}" />
        </div>
      </div>

      <div class="field">
        <label class="form-label">${escapeHtml(t('employee'))}</label>
        <select id="vEmp" class="form-select">${empOptions}</select>
      </div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(t('cancel'))}</button>
      <button class="btn btn-primary" data-act="save">${escapeHtml(t('save'))}</button>`,
    onMount(body, foot) {
      const full = $('#svcFull', body);
      const items = $$('[data-svc]', body);
      full.checked = full.checked || (items.length > 0 && items.every((c) => c.checked));
      full.addEventListener('change', () => { items.forEach((cb) => { cb.checked = full.checked; }); });
      items.forEach((cb) => cb.addEventListener('change', () => { full.checked = items.every((c) => c.checked); }));

      // Searchable dog picker (combobox): type to filter by dog or owner name.
      const search = $('#vDogSearch', body);
      const hidden = $('#vDog', body);
      const listEl = $('#vDogList', body);
      if (search) {
        const priceInput = $('#vPrice', body);

        const renderOptions = (q = '') => {
          const ql = q.trim().toLowerCase();
          const matches = dogs.filter((d) => {
            if (!ql) return true;
            const owner = `${d.ownerFirst || ''} ${d.ownerLast || ''}`.toLowerCase();
            return d.name.toLowerCase().includes(ql) || owner.includes(ql);
          }).slice(0, 50);

          listEl.innerHTML = matches.length
            ? matches.map((d) => {
                const owner = [d.ownerFirst, d.ownerLast].filter(Boolean).join(' ');
                return `<button type="button" class="dog-combo__opt" data-id="${escapeHtml(d.id)}">
                  <span class="dog-combo__name">${escapeHtml(d.name)}</span>
                  ${owner ? `<span class="dog-combo__owner">${escapeHtml(owner)}</span>` : ''}
                </button>`;
              }).join('')
            : `<div class="dog-combo__empty">${escapeHtml(t('no_dogs'))}</div>`;

          // mousedown (not click) so selection beats the input's blur on mobile/desktop
          $$('[data-id]', listEl).forEach((b) => b.addEventListener('mousedown', (e) => {
            e.preventDefault();
            pick(b.getAttribute('data-id'));
          }));
        };

        const pick = (id) => {
          const d = store.getDog(id);
          hidden.value = id;
          search.value = d ? d.name : '';
          listEl.classList.add('d-none');
          if (d && d.price && !priceInput.value.trim()) priceInput.value = d.price;
        };

        const open = () => { renderOptions(search.value); listEl.classList.remove('d-none'); };
        search.addEventListener('focus', open);
        search.addEventListener('input', () => { hidden.value = ''; open(); });
        search.addEventListener('blur', () => { setTimeout(() => listEl.classList.add('d-none'), 150); });
      }

      foot.querySelector('[data-act="cancel"]').onclick = closeModal;
      const saveBtn = foot.querySelector('[data-act="save"]');
      saveBtn.onclick = async () => {
        let chosenDog = fixedDogId;
        if (showPicker) {
          chosenDog = $('#vDog', body).value || '';
          // fallback: user typed an exact dog name but didn't tap the option
          if (!chosenDog) {
            const typed = ($('#vDogSearch', body).value || '').trim().toLowerCase();
            const hit = dogs.filter((d) => d.name.toLowerCase() === typed);
            if (hit.length === 1) chosenDog = hit[0].id;
          }
        }
        if (!chosenDog) { toast(t('required_dog')); return; }

        const services = { full: full.checked };
        items.forEach((cb) => { services[cb.getAttribute('data-svc')] = cb.checked; });

        saveBtn.disabled = true;
        try {
          await store.upsertAppointment({
            id: visit ? visit.id : store.uid('visit'),
            dogId: chosenDog,
            date: $('#vDate', body).value || todayISO(),
            time: $('#vIn', body).value || nowTime(),
            timeOut: $('#vOut', body).value || '',
            price: $('#vPrice', body).value.trim(),
            employeeId: $('#vEmp', body).value || '',
            services,
            createdAt: visit ? (visit.createdAt || todayISO()) : todayISO(),
          });
          closeModal(); toast(t('saved'));
          if (typeof onSaved === 'function') onSaved();
        } catch (e) { saveBtn.disabled = false; }
      };
    },
  });
}

/** Stamp the departure time (now) on a live visit and save. */
export async function markDeparture(visit, onDone) {
  if (!visit) return;
  try {
    await store.upsertAppointment({ ...visit, timeOut: nowTime() });
    toast(t('checked_out'));
    if (typeof onDone === 'function') onDone();
  } catch (e) { /* store toasted */ }
}

// ---------------- Visits view (bottom-nav) ----------------
/** Render the "Visits" view: in-progress on top, history grouped by day below. */
export function renderAppointments() {
  const list = $('#apptList');
  const empty = $('#apptEmpty');
  if (!list) return;

  const all = store.data.appointments.slice();
  if (!all.length) { list.innerHTML = ''; empty.classList.remove('d-none'); return; }
  empty.classList.add('d-none');

  const today = todayISO();
  const live = activeVisits();
  const history = all.filter((v) => !isLive(v));

  // ---- In-progress block ----
  let html = '';
  if (live.length) {
    html += `
      <div class="visit-live-wrap">
        <div class="visit-live__head"><i class="ti ti-dog"></i> ${escapeHtml(t('in_shop_now'))}</div>
        ${live.map((v) => liveCard(v)).join('')}
      </div>`;
  }

  // ---- History grouped by day (newest first) ----
  if (history.length) {
    const groups = {};
    history.forEach((v) => { (groups[v.date] = groups[v.date] || []).push(v); });
    const dates = Object.keys(groups).sort((a, b) => (a > b ? -1 : 1));

    html += dates.map((date) => {
      const rows = groups[date]
        .slice()
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
        .map((v) => historyRow(v)).join('');
      const cls = date === today ? 'appt-day--today' : 'appt-day--log';
      return `
        <div class="appt-day ${cls}">
          <div class="appt-day__head">
            <span class="appt-day__date"><i class="ti ti-calendar"></i> ${escapeHtml(fmtDate(date))}</span>
            <span class="appt-day__count">${groups[date].length}</span>
          </div>
          ${rows}
        </div>`;
    }).join('');
  }

  list.innerHTML = html;

  const visitById = (id) => store.data.appointments.find((a) => a.id === id);

  // open the dog profile when a row/card body is tapped
  $$('[data-dog]', list).forEach((r) => r.onclick = () => openDogProfile(r.getAttribute('data-dog')));
  // "Check out" buttons on live visits
  $$('[data-checkout]', list).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const v = visitById(b.getAttribute('data-checkout'));
    if (v) markDeparture(v, renderAppointments);
  });
  // printable / shareable receipt
  $$('[data-receipt]', list).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    openVisitReceipt(b.getAttribute('data-receipt'));
  });
  // edit a visit
  $$('[data-edit-visit]', list).forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const v = visitById(b.getAttribute('data-edit-visit'));
    if (v) openVisitForm(v.dogId, renderAppointments, v.id);
  });
  // delete a visit
  $$('[data-del-visit]', list).forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    if (await confirmDialog(t('confirm_delete_visit'))) {
      try { await store.deleteAppointment(b.getAttribute('data-del-visit')); renderAppointments(); toast(t('deleted')); }
      catch (err) { /* store toasted */ }
    }
  });
}

function liveCard(v) {
  const dog = store.getDog(v.dogId);
  if (!dog) return '';
  const emp = v.employeeId ? store.getEmployee(v.employeeId) : null;
  const tags = serviceLabels(v).map((s) => `<span class="tl-tag">${escapeHtml(s)}</span>`).join('');
  return `
    <div class="visit-live">
      <div class="visit-live__body" data-dog="${escapeHtml(dog.id)}">
        <div class="visit-live__top">
          <span class="visit-live__dog">${escapeHtml(dog.name)}</span>
          <span class="visit-live__in"><i class="ti ti-login-2"></i> ${escapeHtml(fmtTime(v.time))}</span>
        </div>
        <div class="visit-live__meta">${emp ? `<i class="ti ti-user"></i> ${escapeHtml(emp.fullName)}` : ''}${v.price ? ` · ${escapeHtml(money(v.price))}` : ''}</div>
        <div class="tl-services">${tags || `<span class="text-muted small">—</span>`}</div>
      </div>
      <div class="visit-live__actions">
        <button class="btn btn-sm btn-checkout" data-checkout="${escapeHtml(v.id)}">
          <i class="ti ti-logout-2"></i> ${escapeHtml(t('mark_departure'))}
        </button>
        <button class="btn btn-sm btn-icon btn-outline-secondary" data-receipt="${escapeHtml(v.id)}" aria-label="${escapeHtml(t('receipt'))}"><i class="ti ti-receipt"></i></button>
        <button class="btn btn-sm btn-icon btn-outline-primary" data-edit-visit="${escapeHtml(v.id)}" aria-label="${escapeHtml(t('edit'))}"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-sm btn-icon text-danger" data-del-visit="${escapeHtml(v.id)}" aria-label="${escapeHtml(t('delete'))}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function historyRow(v) {
  const dog = store.getDog(v.dogId);
  if (!dog) return '';
  const emp = v.employeeId ? store.getEmployee(v.employeeId) : null;
  const tags = serviceLabels(v).map((s) => `<span class="tl-tag">${escapeHtml(s)}</span>`).join('');
  const span = fmtTime(v.time) + (v.timeOut ? ` – ${fmtTime(v.timeOut)}` : '');
  const dur = durationLabel(v.time, v.timeOut);
  return `
    <div class="appt-row">
      <div class="appt-row__time" data-dog="${escapeHtml(dog.id)}">${v.time ? escapeHtml(span) : '—'}</div>
      <div class="appt-row__main" data-dog="${escapeHtml(dog.id)}">
        <div class="appt-row__dog">${escapeHtml(dog.name)}${v.price ? ` <span class="visit-price">${escapeHtml(money(v.price))}</span>` : ''}</div>
        <div class="appt-row__meta">${emp ? `<i class="ti ti-user"></i> ${escapeHtml(emp.fullName)}` : ''}${dur ? `${emp ? ' · ' : ''}<i class="ti ti-clock"></i> ${escapeHtml(dur)}` : ''}</div>
        <div class="tl-services">${tags || `<span class="text-muted small">—</span>`}</div>
      </div>
      <div class="appt-row__actions">
        <button class="btn btn-sm btn-icon btn-outline-secondary" data-receipt="${escapeHtml(v.id)}" aria-label="${escapeHtml(t('receipt'))}"><i class="ti ti-receipt"></i></button>
        <button class="btn btn-sm btn-icon btn-outline-primary" data-edit-visit="${escapeHtml(v.id)}" aria-label="${escapeHtml(t('edit'))}"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-sm btn-icon text-danger" data-del-visit="${escapeHtml(v.id)}" aria-label="${escapeHtml(t('delete'))}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}
