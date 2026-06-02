// dogs.js — home list, smart search, advanced filters, dog form, profile, timeline, badges
import { store } from './store.js';
import { t } from './i18n.js';
import {
  $, $$, openModal, closeModal, confirmDialog, toast, escapeHtml, initials,
  readImageResized, optionsFrom, waLink, smsLink, telLink, fmtDate, todayISO, openLightbox,
} from './utils.js';
import {
  dogVaccineStatus, statusMeta, renderVaccineChecklist, bindVaccineChecklist,
} from './vaccines.js';
import { openAppointmentForm, serviceLabels, sendReminder } from './appointments.js';

// in-memory filter state for the home view
const filters = { search: '', breed: '', color: '', sex: '', status: '' };

const SEX_OPTIONS = [{ value: 'Male', label: 'male' }, { value: 'Female', label: 'female' }];

const BLADE_NUMBERS = Array.from({ length: 10 }, (_, i) => `#${i + 1}`); // #1 … #10

/** Build <select> options for a blade field, preserving any legacy/custom value. */
function bladeOptions(selected = '') {
  let html = `<option value="">${escapeHtml(t('select'))}</option>`;
  if (selected && !BLADE_NUMBERS.includes(selected)) {
    html += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`;
  }
  html += BLADE_NUMBERS
    .map((n) => `<option value="${n}" ${n === selected ? 'selected' : ''}>${n}</option>`)
    .join('');
  return html;
}

// ---------------- Badges (birthday / alert) ----------------
function birthdayThisMonth(dog) {
  if (!dog.birthday) return false;
  const d = new Date(dog.birthday + 'T00:00:00');
  return !isNaN(d) && d.getMonth() === new Date().getMonth();
}
function hasAlert(dog) {
  const n = (dog.notes || '').toLowerCase();
  return /(!|urgent|urgente|alert|alerta|bite|muerde|aggress|agres)/.test(n);
}

// ---------------- Home render ----------------
export function renderDogs() {
  syncFilterOptions();
  const list = $('#dogList');
  const empty = $('#dogEmpty');
  const dogs = filteredDogs();

  if (!store.data.dogs.length) { list.innerHTML = ''; empty.classList.remove('d-none'); }
  else { empty.classList.add('d-none'); }

  list.innerHTML = dogs.map((d) => {
    const status = dogVaccineStatus(d);
    const meta = statusMeta(status);
    const avatar = d.photo
      ? `<span class="dog-card__avatar"><img src="${d.photo}" alt=""/></span>`
      : `<span class="dog-card__avatar"><i class="ti ti-dog"></i></span>`;
    const badges =
      (birthdayThisMonth(d) ? `<span class="mini-badge badge-bday" title="${escapeHtml(t('birthday_month'))}"><i class="ti ti-cake"></i></span>` : '') +
      (hasAlert(d) ? `<span class="mini-badge badge-alert" title="${escapeHtml(t('has_alert'))}"><i class="ti ti-alert-triangle"></i></span>` : '');
    const owner = [d.ownerFirst, d.ownerLast].filter(Boolean).join(' ');
    return `
      <div class="dog-card" data-id="${escapeHtml(d.id)}">
        ${avatar}
        <div class="dog-card__body">
          <div class="dog-card__name">
            <span class="status-dot status-${status}"></span>
            ${escapeHtml(d.name)} ${badges}
          </div>
          <div class="dog-card__sub">${escapeHtml([d.breed, d.color].filter(Boolean).join(' · ') || '—')}</div>
          ${owner ? `<div class="dog-card__owner"><i class="ti ti-user"></i> ${escapeHtml(owner)}</div>` : ''}
        </div>
        <span class="status-pill pill-${meta.cls}"><i class="ti ${meta.icon}"></i></span>
      </div>`;
  }).join('');

  $$('.dog-card', list).forEach((c) => c.onclick = () => openDogProfile(c.getAttribute('data-id')));
}

function filteredDogs() {
  const q = filters.search.trim().toLowerCase();
  return store.data.dogs
    .filter((d) => {
      if (q) {
        const owner = `${d.ownerFirst || ''} ${d.ownerLast || ''}`.toLowerCase();
        if (!(`${d.name}`.toLowerCase().includes(q) || owner.includes(q))) return false;
      }
      if (filters.breed && d.breed !== filters.breed) return false;
      if (filters.color && d.color !== filters.color) return false;
      if (filters.sex && d.sex !== filters.sex) return false;
      if (filters.status && dogVaccineStatus(d) !== filters.status) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Populate breed/color filter dropdowns from existing data. */
function syncFilterOptions() {
  const breeds = [...new Set(store.data.dogs.map((d) => d.breed).filter(Boolean))].sort();
  const colors = [...new Set(store.data.dogs.map((d) => d.color).filter(Boolean))].sort();
  const fBreed = $('#fBreed'), fColor = $('#fColor');
  if (fBreed) fBreed.innerHTML = `<option value="">${escapeHtml(t('all'))}</option>` + optionsFrom(breeds, filters.breed);
  if (fColor) fColor.innerHTML = `<option value="">${escapeHtml(t('all'))}</option>` + optionsFrom(colors, filters.color);
}

// ---------------- Filter wiring (called once from app.js) ----------------
export function initDogFilters() {
  $('#dogSearch').addEventListener('input', (e) => { filters.search = e.target.value; renderDogs(); });

  $('#filterToggle').addEventListener('click', () => {
    $('#filterPanel').classList.toggle('d-none');
  });

  ['fBreed', 'fColor', 'fSex', 'fStatus'].forEach((id) => {
    $('#' + id).addEventListener('change', (e) => {
      const map = { fBreed: 'breed', fColor: 'color', fSex: 'sex', fStatus: 'status' };
      filters[map[id]] = e.target.value;
      updateFilterCount(); renderDogs();
    });
  });
}

function updateFilterCount() {
  const active = ['breed', 'color', 'sex', 'status'].filter((k) => filters[k]).length;
  const badge = $('#filterCount');
  badge.textContent = active;
  badge.classList.toggle('d-none', active === 0);
}

export function clearFilters() {
  filters.breed = filters.color = filters.sex = filters.status = '';
  ['fBreed', 'fColor', 'fSex', 'fStatus'].forEach((id) => { const el = $('#' + id); if (el) el.value = ''; });
  updateFilterCount(); renderDogs();
}

// ---------------- Dog form (create / edit) ----------------
export function openDogForm(id) {
  const d = id ? store.getDog(id) : null;
  // photos: array of data-URLs. Migrate legacy single `photo` field.
  let photos = d ? (Array.isArray(d.photos) ? [...d.photos] : (d.photo ? [d.photo] : [])) : [];

  const sexOpts = optionsFrom(SEX_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })), d ? d.sex : '', t('select'));

  openModal({
    title: d ? t('dog_edit') : t('dog_new'),
    bodyHTML: `
      <div class="photo-gallery" id="photoGallery"></div>
      <label class="photo-add-btn" id="photoPick">
        <i class="ti ti-camera"></i><span>${escapeHtml(t('add_photos'))}</span>
        <input type="file" id="dogPhoto" accept="image/*" multiple />
      </label>
      <div class="photo-hint">${escapeHtml(t('photo_hint'))}</div>

      <div class="field">
        <label class="form-label">${escapeHtml(t('name'))}</label>
        <input id="dName" class="form-control" value="${d ? escapeHtml(d.name) : ''}" />
      </div>
      <div class="form-row">
        <div class="field"><label class="form-label">${escapeHtml(t('breed'))}</label>
          <input id="dBreed" class="form-control" value="${d ? escapeHtml(d.breed || '') : ''}" /></div>
        <div class="field"><label class="form-label">${escapeHtml(t('color'))}</label>
          <input id="dColor" class="form-control" value="${d ? escapeHtml(d.color || '') : ''}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label class="form-label">${escapeHtml(t('sex'))}</label>
          <select id="dSex" class="form-select">${sexOpts}</select></div>
        <div class="field"><label class="form-label">${escapeHtml(t('birthday'))}</label>
          <input id="dBday" type="date" class="form-control" value="${d ? (d.birthday || '') : ''}" /></div>
      </div>

      <label class="form-label" style="margin-top:6px">${escapeHtml(t('owner_info'))}</label>
      <div class="form-row">
        <div class="field"><label class="form-label">${escapeHtml(t('owner_first'))}</label>
          <input id="dOwnerF" class="form-control" value="${d ? escapeHtml(d.ownerFirst || '') : ''}" /></div>
        <div class="field"><label class="form-label">${escapeHtml(t('owner_last'))}</label>
          <input id="dOwnerL" class="form-control" value="${d ? escapeHtml(d.ownerLast || '') : ''}" /></div>
      </div>
      <div class="field"><label class="form-label">${escapeHtml(t('phone'))}</label>
        <input id="dPhone" class="form-control" type="tel" inputmode="tel" value="${d ? escapeHtml(d.phone || '') : ''}" /></div>

      <label class="form-label" style="margin-top:6px">${escapeHtml(t('grooming_specs'))}</label>
      <div class="form-row">
        <div class="field"><label class="form-label">${escapeHtml(t('blade_head'))}</label>
          <select id="dBladeH" class="form-select">${bladeOptions(d ? (d.bladeHead || '') : '')}</select></div>
        <div class="field"><label class="form-label">${escapeHtml(t('blade_body'))}</label>
          <select id="dBladeB" class="form-select">${bladeOptions(d ? (d.bladeBody || '') : '')}</select></div>
      </div>
      <div class="field"><label class="form-label">${escapeHtml(t('notes'))}</label>
        <textarea id="dNotes" class="form-control" rows="2">${d ? escapeHtml(d.notes || '') : ''}</textarea></div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(t('cancel'))}</button>
      <button class="btn btn-primary" data-act="save">${escapeHtml(t('save'))}</button>`,
    onMount(body, foot) {
      const gallery = $('#photoGallery', body);

      // Render the thumbnails grid; re-bind remove buttons each time.
      function renderGallery() {
        gallery.classList.toggle('d-none', photos.length === 0);
        gallery.innerHTML = photos.map((src, i) => `
          <div class="photo-thumb">
            <img src="${src}" alt=""/>
            <button type="button" class="photo-thumb__del" data-rm="${i}" aria-label="Remove"><i class="ti ti-x"></i></button>
          </div>`).join('');
        $$('[data-rm]', gallery).forEach((b) => b.onclick = () => {
          photos.splice(Number(b.getAttribute('data-rm')), 1);
          renderGallery();
        });
      }
      renderGallery();

      const fileInput = $('#dogPhoto', body);
      fileInput.addEventListener('change', async () => {
        const files = [...fileInput.files];
        if (!files.length) return;
        for (const file of files) {
          const data = await readImageResized(file);
          if (data) photos.push(data);
        }
        fileInput.value = ''; // allow re-selecting the same file later
        renderGallery();
      });

      foot.querySelector('[data-act="cancel"]').onclick = closeModal;
      foot.querySelector('[data-act="save"]').onclick = () => {
        const name = $('#dName', body).value.trim();
        if (!name) { toast(t('required_name')); return; }
        const dog = {
          id: d ? d.id : store.uid('dog'),
          name,
          breed: $('#dBreed', body).value.trim(),
          color: $('#dColor', body).value.trim(),
          sex: $('#dSex', body).value,
          birthday: $('#dBday', body).value,
          ownerFirst: $('#dOwnerF', body).value.trim(),
          ownerLast: $('#dOwnerL', body).value.trim(),
          phone: $('#dPhone', body).value.trim(),
          bladeHead: $('#dBladeH', body).value.trim(),
          bladeBody: $('#dBladeB', body).value.trim(),
          notes: $('#dNotes', body).value.trim(),
          photos,
          photo: photos[0] || '', // first photo kept for card/avatar thumbnails
          vaccines: d ? (d.vaccines || {}) : {},
        };
        store.upsertDog(dog);
        closeModal(); renderDogs(); toast(t('saved'));
      };
    },
  });
}

// ---------------- Dog profile ----------------
export function openDogProfile(id) {
  const dog = store.getDog(id);
  if (!dog) return;
  const status = dogVaccineStatus(dog);
  const meta = statusMeta(status);
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ');

  const infoBox = (lbl, val) => `<div class="info-box"><div class="info-box__lbl">${escapeHtml(lbl)}</div><div class="info-box__val">${escapeHtml(val || '—')}</div></div>`;

  // all photos (migrate legacy single-photo records)
  const photos = Array.isArray(dog.photos) ? dog.photos : (dog.photo ? [dog.photo] : []);

  function bodyHTML() {
    return `
      <div class="profile-hero">
        <div class="profile-hero__avatar">
          ${photos[0] ? `<img src="${photos[0]}" alt="" data-zoom/>` : `<i class="ti ti-dog"></i>`}
        </div>
        <div class="profile-hero__name">${escapeHtml(dog.name)}</div>
        <div class="profile-hero__sub">${escapeHtml([dog.breed, dog.color, dog.sex && t(dog.sex.toLowerCase())].filter(Boolean).join(' · ') || '—')}</div>
        <div style="margin-top:8px">
          <span class="status-pill pill-${meta.cls}"><i class="ti ${meta.icon}"></i> ${escapeHtml(t(meta.key))}</span>
        </div>
      </div>

      ${photos.length > 1 ? `
      <div class="photo-gallery profile-gallery">
        ${photos.map((src) => `<div class="photo-thumb"><img src="${src}" alt="" data-zoom/></div>`).join('')}
      </div>` : ''}

      <div class="info-grid">
        ${infoBox(t('owner'), owner)}
        ${infoBox(t('birthday'), dog.birthday ? fmtDate(dog.birthday) : '')}
        ${infoBox(t('blade_head'), dog.bladeHead)}
        ${infoBox(t('blade_body'), dog.bladeBody)}
      </div>

      ${dog.phone ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px">
        <a class="btn btn-wa" href="${waLink(dog.phone)}" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp"></i> ${escapeHtml(t('whatsapp'))}</a>
        <a class="btn btn-sms" href="${smsLink(dog.phone)}"><i class="ti ti-message"></i> ${escapeHtml(t('sms'))}</a>
        <a class="btn btn-outline-secondary" href="${telLink(dog.phone)}"><i class="ti ti-phone"></i> ${escapeHtml(t('call'))}</a>
      </div>` : ''}

      ${dog.notes ? `<div class="info-box" style="margin-bottom:6px"><div class="info-box__lbl">${escapeHtml(t('notes'))}</div><div class="info-box__val" style="font-weight:400">${escapeHtml(dog.notes)}</div></div>` : ''}

      <div class="section-title"><i class="ti ti-vaccine"></i> ${escapeHtml(t('vaccines'))}</div>
      <div id="vaxBox">${renderVaccineChecklist(dog)}</div>

      <div class="section-title">
        <i class="ti ti-timeline"></i> ${escapeHtml(t('grooming_history'))}
        <button class="btn btn-sm btn-primary" data-act="add-appt" style="margin-left:auto"><i class="ti ti-plus"></i> ${escapeHtml(t('add_appointment'))}</button>
      </div>
      <div id="timelineBox">${renderTimeline(dog)}</div>`;
  }

  function mount(body, foot) {
    // tap any photo to view it full-screen (with an X in the corner to close)
    $$('[data-zoom]', body).forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.onclick = () => openLightbox(img.src);
    });

    // vaccine checklist live status update
    bindVaccineChecklist($('#vaxBox', body), dog, () => {
      renderDogs();
      // update pill + checklist meta in place
      $('#vaxBox', body).innerHTML = renderVaccineChecklist(store.getDog(id));
      bindVaccineChecklist($('#vaxBox', body), store.getDog(id), () => openDogProfile(id));
      const fresh = dogVaccineStatus(store.getDog(id));
      const m = statusMeta(fresh);
      const pill = body.querySelector('.profile-hero .status-pill');
      if (pill) { pill.className = `status-pill pill-${m.cls}`; pill.innerHTML = `<i class="ti ${m.icon}"></i> ${escapeHtml(t(m.key))}`; }
    });

    body.querySelector('[data-act="add-appt"]').onclick = () =>
      openAppointmentForm(id, () => openDogProfile(id));

    // timeline delete + reminder
    bindTimeline(body, dog, () => openDogProfile(id));

    foot.querySelector('[data-act="edit"]').onclick = () => { closeModal(); openDogForm(id); };
    foot.querySelector('[data-act="delete"]').onclick = async () => {
      if (await confirmDialog(t('confirm_delete_dog'))) {
        store.deleteDog(id); closeModal(); renderDogs(); toast(t('deleted'));
      }
    };
  }

  openModal({
    title: dog.name,
    bodyHTML: bodyHTML(),
    footHTML: `
      <button class="btn btn-outline-danger" data-act="delete"><i class="ti ti-trash"></i> ${escapeHtml(t('delete'))}</button>
      <button class="btn btn-primary" data-act="edit"><i class="ti ti-pencil"></i> ${escapeHtml(t('edit'))}</button>`,
    onMount: mount,
  });
}

function renderTimeline(dog) {
  const appts = store.appointmentsForDog(dog.id);
  if (!appts.length) return `<p class="text-muted small">${escapeHtml(t('no_history'))}</p>`;
  const today = todayISO();
  return `<div class="timeline">` + appts.map((a) => {
    const emp = a.employeeId ? store.getEmployee(a.employeeId) : null;
    const tags = serviceLabels(a).map((s) => `<span class="tl-tag">${escapeHtml(s)}</span>`).join('');
    const upcoming = a.date >= today;
    return `
      <div class="tl-item">
        <div class="tl-date">${fmtDate(a.date)}</div>
        <div class="tl-card">
          <div class="tl-emp"><i class="ti ti-user"></i> ${escapeHtml(emp ? emp.fullName : '—')}</div>
          <div class="tl-services">${tags || '<span class="text-muted small">—</span>'}</div>
          <div class="d-flex gap-2 mt-2">
            ${upcoming && dog.phone ? `<button class="btn btn-sm btn-wa" data-remind="${escapeHtml(a.id)}"><i class="ti ti-brand-whatsapp"></i> ${escapeHtml(t('remind'))}</button>` : ''}
            <button class="btn btn-sm btn-icon text-danger" data-del-appt="${escapeHtml(a.id)}" style="margin-left:auto"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`;
  }).join('') + `</div>`;
}

function bindTimeline(body, dog, refresh) {
  $$('[data-remind]', body).forEach((b) => b.onclick = () => {
    const appt = store.data.appointments.find((a) => a.id === b.getAttribute('data-remind'));
    if (appt) sendReminder(appt);
  });
  $$('[data-del-appt]', body).forEach((b) => b.onclick = async () => {
    if (await confirmDialog(t('confirm_delete_appt'))) {
      store.deleteAppointment(b.getAttribute('data-del-appt'));
      refresh();
    }
  });
}
