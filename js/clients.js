// clients.js — Clients: the people, and the dogs that belong to them.
//
// A client owns zero or more dogs. Their name and phone live in the `clients`
// table and are projected onto each of their dogs by store.js, so editing a
// client once updates every one of their dogs at the same time.
import { store, clientName } from './store.js';
import { t } from './i18n.js';
import {
  $, $$, openModal, closeModal, confirmDialog, toast, escapeHtml, initials,
  waLink, smsLink, telLink, fmtDate, cleanPhone, normText,
} from './utils.js';
import { dogVaccineStatus, statusMeta } from './vaccines.js';
import { openDogProfile } from './dogs.js';

// in-memory filter state for the clients view
const filters = { search: '' };

/**
 * Wire the search box. Called ONCE from app.js, never from renderClients:
 * renderClients runs on every tap of the tab and on every language switch, so
 * adding the listener there would stack one copy per render.
 */
export function initClientFilters() {
  const box = $('#clientSearch');
  if (!box) return;
  box.addEventListener('input', (e) => { filters.search = e.target.value; renderClients(); });
}

/** Visits + last visit across all of a client's dogs. */
function visitStats(dogs) {
  const ids = new Set(dogs.map((d) => d.id));
  let count = 0;
  let last = '';
  store.data.appointments.forEach((a) => {
    if (!ids.has(a.dogId)) return;
    count++;
    if (a.date && a.date > last) last = a.date;
  });
  return { count, last };
}

function matchesSearch(c) {
  const q = normText(filters.search);
  if (!q) return true;
  // Accent-insensitive, so "lopez" finds "López".
  if (normText(clientName(c)).includes(q)) return true;
  // Digits only, so "9988" finds "+504 9988-7766".
  const digits = cleanPhone(q);
  return !!digits && cleanPhone(c.phone).includes(digits);
}

// ---------------- List ----------------
export function renderClients() {
  const list = $('#clientList');
  const empty = $('#clientEmpty');
  if (!list) return;

  const clients = store.clientsSorted().filter(matchesSearch);

  if (!store.data.clients.length) { list.innerHTML = ''; empty.classList.remove('d-none'); return; }
  empty.classList.add('d-none');

  if (!clients.length) { // there are clients, the search just matched none
    list.innerHTML = `<p class="text-muted small">${escapeHtml(t('no_clients_found'))}</p>`;
    return;
  }

  list.innerHTML = clients.map((c) => {
    const dogs = store.dogsForClient(c.id);
    const names = dogs.map((d) => d.name).join(' · ');
    return `
      <div class="client-card" data-id="${escapeHtml(c.id)}">
        <span class="client-card__avatar">${escapeHtml(initials(clientName(c)))}</span>
        <div class="client-card__body">
          <div class="client-card__name">${escapeHtml(clientName(c) || '—')}</div>
          <div class="client-card__dogs">
            <i class="ti ti-dog"></i> ${escapeHtml(names || t('no_dogs_linked'))}
          </div>
          ${c.phone ? `<div class="client-card__phone"><i class="ti ti-phone"></i> ${escapeHtml(c.phone)}</div>` : ''}
        </div>
        <span class="client-card__count">${dogs.length}</span>
      </div>`;
  }).join('');

  $$('.client-card', list).forEach((el) => el.onclick = () => openClientProfile(el.getAttribute('data-id')));
}

// ---------------- Profile ----------------
export function openClientProfile(id) {
  const client = store.getClient(id);
  if (!client) return;
  const dogs = store.dogsForClient(id);
  const stats = visitStats(dogs);
  const name = clientName(client);

  const infoBox = (lbl, val) =>
    `<div class="info-box"><div class="info-box__lbl">${escapeHtml(lbl)}</div><div class="info-box__val">${escapeHtml(val || '—')}</div></div>`;

  // The same card the home list uses, so a dog looks the same everywhere.
  const dogCards = () => {
    if (!dogs.length) return `<p class="text-muted small">${escapeHtml(t('no_dogs_linked'))}</p>`;
    return `<div class="card-grid">` + dogs.map((d) => {
      const status = dogVaccineStatus(d);
      const meta = statusMeta(status);
      const avatar = d.photo
        ? `<span class="dog-card__avatar"><img src="${escapeHtml(d.photo)}" alt=""/></span>`
        : `<span class="dog-card__avatar"><i class="ti ti-dog"></i></span>`;
      return `
        <div class="dog-card" data-dog="${escapeHtml(d.id)}">
          ${avatar}
          <div class="dog-card__body">
            <div class="dog-card__name">
              <span class="status-dot status-${status}"></span>
              ${escapeHtml(d.name)}
            </div>
            <div class="dog-card__sub">${escapeHtml([d.breed, d.color].filter(Boolean).join(' · ') || '—')}</div>
          </div>
          <span class="status-pill pill-${meta.cls}"><i class="ti ${meta.icon}"></i></span>
        </div>`;
    }).join('') + `</div>`;
  };

  openModal({
    title: name || t('client_edit'),
    bodyHTML: `
      <div class="profile-hero">
        <div class="profile-hero__avatar profile-hero__avatar--initials">${escapeHtml(initials(name))}</div>
        <div class="profile-hero__name">${escapeHtml(name || '—')}</div>
        <div class="profile-hero__sub">${escapeHtml(`${dogs.length} ${t('client_dogs').toLowerCase()}`)}</div>
      </div>

      <div class="info-grid">
        ${infoBox(t('phone'), client.phone)}
        ${infoBox(t('client_dogs'), String(dogs.length))}
        ${infoBox(t('total_visits'), String(stats.count))}
        ${infoBox(t('last_visit'), stats.last ? fmtDate(stats.last) : '')}
      </div>

      ${client.phone ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px">
        <a class="btn btn-wa" href="${waLink(client.phone)}" target="_blank" rel="noopener noreferrer"><i class="ti ti-brand-whatsapp"></i> ${escapeHtml(t('whatsapp'))}</a>
        <a class="btn btn-sms" href="${smsLink(client.phone)}"><i class="ti ti-message"></i> ${escapeHtml(t('sms'))}</a>
        <a class="btn btn-outline-secondary" href="${telLink(client.phone)}"><i class="ti ti-phone"></i> ${escapeHtml(t('call'))}</a>
      </div>` : ''}

      ${client.notes ? `
      <div class="info-box" style="margin-bottom:6px">
        <div class="info-box__lbl">${escapeHtml(t('notes'))}</div>
        <div class="info-box__val" style="font-weight:400;white-space:pre-wrap">${escapeHtml(client.notes)}</div>
      </div>` : ''}

      <div class="section-title"><i class="ti ti-dog"></i> ${escapeHtml(t('client_dogs'))}</div>
      ${dogCards()}`,
    footHTML: `
      <button class="btn btn-outline-danger" data-act="delete"><i class="ti ti-trash"></i> ${escapeHtml(t('delete'))}</button>
      <button class="btn btn-primary" data-act="edit"><i class="ti ti-pencil"></i> ${escapeHtml(t('edit'))}</button>`,
    onMount(body, foot) {
      // There is a single modal root, so the dog profile REPLACES this one.
      // Closing it therefore returns to the clients list, not here — the same
      // flat behaviour the printable sheet already has.
      $$('[data-dog]', body).forEach((el) => el.onclick = () => openDogProfile(el.getAttribute('data-dog')));

      foot.querySelector('[data-act="edit"]').onclick = () => { closeModal(); openClientForm(id); };

      foot.querySelector('[data-act="delete"]').onclick = async () => {
        // Deleting a client also clears the owner info from their dogs, so say
        // so plainly instead of letting the shop find out afterwards.
        const msg = dogs.length
          ? `${t('confirm_delete_client')} ${t('client_dogs_orphaned', { n: dogs.length })}`
          : t('confirm_delete_client');
        if (!(await confirmDialog(msg))) { openClientProfile(id); return; }
        try {
          await store.deleteClient(id);
          closeModal();
          renderClients();
          toast(t('deleted'));
        } catch (e) { /* store toasted */ }
      };
    },
  });
}

// ---------------- Form (create / edit) ----------------
export function openClientForm(id, onSaved) {
  const c = id ? store.getClient(id) : null;

  openModal({
    title: c ? t('client_edit') : t('client_new'),
    bodyHTML: `
      <div class="form-row">
        <div class="field">
          <label class="form-label">${escapeHtml(t('owner_first'))}</label>
          <input id="cFirst" class="form-control" autocapitalize="words" value="${c ? escapeHtml(c.firstName) : ''}" />
        </div>
        <div class="field">
          <label class="form-label">${escapeHtml(t('owner_last'))}</label>
          <input id="cLast" class="form-control" autocapitalize="words" value="${c ? escapeHtml(c.lastName) : ''}" />
        </div>
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('phone'))}</label>
        <input id="cPhone" class="form-control" type="tel" inputmode="tel" value="${c ? escapeHtml(c.phone) : ''}" />
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('notes'))}</label>
        <textarea id="cNotes" class="form-control" rows="2">${c ? escapeHtml(c.notes) : ''}</textarea>
      </div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(t('cancel'))}</button>
      <button class="btn btn-primary" data-act="save">${escapeHtml(t('save'))}</button>`,
    onMount(body, foot) {
      foot.querySelector('[data-act="cancel"]').onclick = () => {
        // Cancelling an edit goes back where it came from.
        if (c) openClientProfile(c.id); else closeModal();
      };

      const saveBtn = foot.querySelector('[data-act="save"]');
      saveBtn.onclick = async () => {
        const firstName = $('#cFirst', body).value.trim();
        const lastName = $('#cLast', body).value.trim();
        if (!firstName && !lastName) { toast(t('required_name')); return; }

        const client = {
          id: c ? c.id : store.uid('cli'),
          firstName,
          lastName,
          phone: $('#cPhone', body).value.trim(),
          notes: $('#cNotes', body).value.trim(),
        };
        saveBtn.disabled = true;
        try {
          await store.upsertClient(client); // also refreshes every linked dog
          closeModal();
          renderClients();
          toast(t('saved'));
          if (typeof onSaved === 'function') onSaved(client);
          else openClientProfile(client.id);
        } catch (e) {
          saveBtn.disabled = false; // store already toasted the reason
        }
      };
    },
  });
}
