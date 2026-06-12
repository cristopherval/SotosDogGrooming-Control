// employees.js — Employee CRUD module
import { store } from './store.js';
import { t } from './i18n.js';
import {
  $, $$, openModal, closeModal, confirmDialog, toast, escapeHtml,
  initials, waLink, telLink,
} from './utils.js';

export function renderEmployees() {
  const list = $('#employeeList');
  const empty = $('#employeeEmpty');
  const employees = store.data.employees.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));

  if (!employees.length) { list.innerHTML = ''; empty.classList.remove('d-none'); return; }
  empty.classList.add('d-none');

  list.innerHTML = employees.map((e) => `
    <div class="emp-card" data-id="${escapeHtml(e.id)}">
      <div class="emp-card__top">
        <div class="emp-avatar">${escapeHtml(initials(e.fullName))}</div>
        <div style="flex:1;min-width:0">
          <div class="emp-card__name">${escapeHtml(e.fullName)}</div>
          <div class="emp-card__role">${escapeHtml(e.role || '—')}</div>
        </div>
        <span class="dot-status ${e.active ? 'dot-active' : 'dot-inactive'}">
          ${escapeHtml(e.active ? t('active') : t('inactive'))}
        </span>
      </div>
      ${e.notes ? `<p class="text-muted small mt-2 mb-0">${escapeHtml(e.notes)}</p>` : ''}
      <div class="emp-card__actions">
        ${e.phone ? `<a class="btn btn-sm btn-wa" href="${waLink(e.phone)}" target="_blank" rel="noopener noreferrer"><i class="ti ti-brand-whatsapp"></i></a>
        <a class="btn btn-sm btn-outline-secondary" href="${telLink(e.phone)}"><i class="ti ti-phone"></i></a>` : ''}
        <button class="btn btn-sm btn-outline-primary" data-edit="${escapeHtml(e.id)}" style="margin-left:auto"><i class="ti ti-pencil"></i> ${escapeHtml(t('edit'))}</button>
        <button class="btn btn-sm btn-icon text-danger" data-del="${escapeHtml(e.id)}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');

  $$('[data-edit]', list).forEach((b) => b.onclick = () => openEmployeeForm(b.getAttribute('data-edit')));
  $$('[data-del]', list).forEach((b) => b.onclick = async () => {
    if (await confirmDialog(t('confirm_delete_emp'))) {
      try { await store.deleteEmployee(b.getAttribute('data-del')); renderEmployees(); toast(t('deleted')); }
      catch (e) { /* store toasted */ }
    }
  });
}

export function openEmployeeForm(id) {
  const e = id ? store.getEmployee(id) : null;
  openModal({
    title: e ? t('emp_edit') : t('emp_new'),
    bodyHTML: `
      <div class="field">
        <label class="form-label">${escapeHtml(t('full_name'))}</label>
        <input id="eName" class="form-control" value="${e ? escapeHtml(e.fullName) : ''}" />
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('role'))}</label>
        <input id="eRole" class="form-control" list="roleList" value="${e ? escapeHtml(e.role || '') : ''}" />
        <datalist id="roleList">
          <option value="Groomer"></option><option value="Assistant"></option>
          <option value="Bather"></option><option value="Receptionist"></option>
        </datalist>
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('phone'))}</label>
        <input id="ePhone" class="form-control" type="tel" inputmode="tel" value="${e ? escapeHtml(e.phone || '') : ''}" />
      </div>
      <div class="field">
        <label class="form-label d-flex justify-content-between align-items-center">
          ${escapeHtml(t('status'))}
          <span class="form-check form-switch m-0">
            <input id="eActive" class="form-check-input" type="checkbox" ${(!e || e.active) ? 'checked' : ''}/>
          </span>
        </label>
      </div>
      <div class="field">
        <label class="form-label">${escapeHtml(t('notes'))}</label>
        <textarea id="eNotes" class="form-control" rows="2">${e ? escapeHtml(e.notes || '') : ''}</textarea>
      </div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(t('cancel'))}</button>
      <button class="btn btn-primary" data-act="save">${escapeHtml(t('save'))}</button>`,
    onMount(body, foot) {
      foot.querySelector('[data-act="cancel"]').onclick = closeModal;
      const saveBtn = foot.querySelector('[data-act="save"]');
      saveBtn.onclick = async () => {
        const fullName = $('#eName').value.trim();
        if (!fullName) { toast(t('required_name')); return; }
        saveBtn.disabled = true;
        try {
          await store.upsertEmployee({
            id: e ? e.id : store.uid('emp'),
            fullName,
            role: $('#eRole').value.trim(),
            phone: $('#ePhone').value.trim(),
            active: $('#eActive').checked,
            notes: $('#eNotes').value.trim(),
          });
          closeModal(); renderEmployees(); toast(t('saved'));
        } catch (err) { saveBtn.disabled = false; }
      };
    },
  });
}
