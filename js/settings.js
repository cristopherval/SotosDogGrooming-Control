// settings.js — cloud status, stats, backup export/import, migration, language switch
import { store } from './store.js';
import { t, applyTranslations, getLang } from './i18n.js';
import { $, $$, confirmDialog, toast } from './utils.js';
import { renderCatalog } from './vaccines.js';

export function renderSettings() {
  const s = store.stats();
  $('#statDogs').textContent = s.dogs;
  $('#statEmployees').textContent = s.employees;
  $('#statAppointments').textContent = s.appointments;
  $('#statPhotos').textContent = s.photos;

  // show the "upload local data" card only when an old local database remains
  const migrateCard = $('#migrateCard');
  if (migrateCard) migrateCard.classList.toggle('d-none', !store.hasLocalData());

  renderCatalog();
  markActiveLang();
}

function markActiveLang() {
  $$('.lang-btn').forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-lang') === getLang()));
}

// ---------------- Backup ----------------
export function exportBackup() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sotos-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('exported'));
}

export function triggerImport() { $('#importFile').click(); }

export function handleImportFile(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const ok = await confirmDialog(t('confirm_restore'), {
      title: t('restore_backup'), confirmText: t('restore_backup'), confirmClass: 'btn-primary',
    });
    if (!ok) return;
    try {
      await store.importJSON(reader.result);
      toast(t('restored'));
      if (typeof onDone === 'function') await onDone();
    } catch (e) {
      console.warn('Import failed', e);
      toast(t('invalid_backup'));
    }
  };
  reader.readAsText(file);
}

// ---------------- Language ----------------
export function setLanguage(lang, onChange) {
  store.setSetting('language', lang);
  applyTranslations();
  markActiveLang();
  if (typeof onChange === 'function') onChange();
}
