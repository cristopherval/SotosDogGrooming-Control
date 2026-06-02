// vaccines.js — dynamic vaccine status logic + catalog management UI
import { store } from './store.js';
import { t } from './i18n.js';
import { openModal, closeModal, confirmDialog, toast, escapeHtml, $, $$, addMonths, todayISO, fmtDate } from './utils.js';

/**
 * Compute a dog's vaccine status against the master catalog.
 * Returns one of: 'upToDate' | 'renewal' | 'missing'
 *   - missing  : at least one catalog vaccine never applied
 *   - renewal  : all applied, but at least one expired
 *   - upToDate : all applied and currently valid
 * (Empty catalog => upToDate.)
 */
export function dogVaccineStatus(dog) {
  const catalog = store.data.vaccineCatalog;
  if (!catalog.length) return 'upToDate';
  const records = dog.vaccines || {};
  let anyExpired = false;
  for (const vax of catalog) {
    const rec = records[vax.id];
    if (!rec || !rec.date) return 'missing';
    const expiry = addMonths(rec.date, vax.months);
    if (expiry < todayISO()) anyExpired = true;
  }
  return anyExpired ? 'renewal' : 'upToDate';
}

export function statusMeta(status) {
  switch (status) {
    case 'upToDate': return { key: 'st_uptodate', cls: 'upToDate', icon: 'ti-circle-check' };
    case 'renewal': return { key: 'st_renewal', cls: 'renewal', icon: 'ti-clock' };
    default: return { key: 'st_missing', cls: 'missing', icon: 'ti-alert-triangle' };
  }
}

/** HTML for the vaccine checklist inside the dog profile. Mutates dog on toggle. */
export function renderVaccineChecklist(dog, onChange) {
  const catalog = store.data.vaccineCatalog;
  const records = dog.vaccines || (dog.vaccines = {});
  if (!catalog.length) return `<p class="text-muted small">${escapeHtml(t('vaccine_catalog'))} —</p>`;

  return catalog.map((vax) => {
    const rec = records[vax.id];
    const applied = !!(rec && rec.date);
    let meta = '';
    if (applied) {
      const expiry = addMonths(rec.date, vax.months);
      const expired = expiry < todayISO();
      meta = expired
        ? `<span class="text-danger">${escapeHtml(t('expired'))} · ${fmtDate(expiry)}</span>`
        : `${escapeHtml(t('applied_on'))} ${fmtDate(rec.date)} · ${escapeHtml(t('valid_until'))} ${fmtDate(expiry)}`;
    } else {
      meta = escapeHtml(t('not_applied'));
    }
    return `
      <label class="vax-row">
        <input type="checkbox" data-vax="${escapeHtml(vax.id)}" ${applied ? 'checked' : ''}/>
        <span class="vax-row__info">
          <span class="vax-row__name">${escapeHtml(vax.name)} <small class="text-muted">· ${vax.months}m</small></span>
          <span class="vax-row__meta">${meta}</span>
        </span>
      </label>`;
  }).join('');
}

/** Wire checkbox toggles inside a container for a given dog. */
export function bindVaccineChecklist(container, dog, onChange) {
  $$('[data-vax]', container).forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.getAttribute('data-vax');
      dog.vaccines = dog.vaccines || {};
      if (cb.checked) dog.vaccines[id] = { date: todayISO() };
      else delete dog.vaccines[id];
      store.upsertDog(dog);
      if (typeof onChange === 'function') onChange();
    });
  });
}

// ---------------- Catalog management (Settings) ----------------
export function renderCatalog() {
  const wrap = $('#catalogList');
  if (!wrap) return;
  const catalog = store.data.vaccineCatalog;
  wrap.innerHTML = catalog.map((v) => `
    <div class="catalog-item" data-id="${escapeHtml(v.id)}">
      <div>
        <div class="catalog-item__name">${escapeHtml(v.name)}</div>
        <div class="catalog-item__dur">${v.months} ${escapeHtml(t('duration_months').toLowerCase())}</div>
      </div>
      <div class="d-flex gap-1">
        <button class="btn btn-icon btn-sm" data-edit-vax="${escapeHtml(v.id)}"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-icon btn-sm text-danger" data-del-vax="${escapeHtml(v.id)}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('') || `<p class="text-muted small mb-0">—</p>`;

  $$('[data-edit-vax]', wrap).forEach((b) =>
    b.onclick = () => openVaccineForm(b.getAttribute('data-edit-vax')));
  $$('[data-del-vax]', wrap).forEach((b) =>
    b.onclick = async () => {
      if (await confirmDialog(t('confirm_delete_vax'))) {
        store.deleteVaccine(b.getAttribute('data-del-vax'));
        renderCatalog(); toast(t('deleted'));
      }
    });
}

export function openVaccineForm(id) {
  const editing = id ? store.data.vaccineCatalog.find((v) => v.id === id) : null;
  openModal({
    title: editing ? editing.name : t('vax_new'),
    bodyHTML: `
      <div class="field">
        <label class="form-label">${escapeHtml(t('vax_name'))}</label>
        <input id="vxName" class="form-control" value="${editing ? escapeHtml(editing.name) : ''}" />
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('duration_months'))}</label>
        <input id="vxMonths" type="number" min="1" class="form-control" value="${editing ? editing.months : 12}" />
      </div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(t('cancel'))}</button>
      <button class="btn btn-primary" data-act="save">${escapeHtml(t('save'))}</button>`,
    onMount(body, foot) {
      foot.querySelector('[data-act="cancel"]').onclick = closeModal;
      foot.querySelector('[data-act="save"]').onclick = () => {
        const name = $('#vxName').value.trim();
        const months = parseInt($('#vxMonths').value, 10) || 12;
        if (!name) { toast(t('required_name')); return; }
        store.upsertVaccine({ id: editing ? editing.id : store.uid('vax'), name, months });
        closeModal(); renderCatalog(); toast(t('saved'));
      };
    },
  });
}
