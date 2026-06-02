// settings.js — storage gauge, stats, backup export/import, language switch
import { store } from './store.js';
import { t, applyTranslations, getLang } from './i18n.js';
import { $, $$, confirmDialog, toast } from './utils.js';
import { renderCatalog } from './vaccines.js';

// Rough localStorage budget for the progress bar (most browsers ~5MB).
const STORAGE_BUDGET = 5 * 1024 * 1024;

export function renderSettings() {
  const s = store.stats();
  $('#statDogs').textContent = s.dogs;
  $('#statEmployees').textContent = s.employees;
  $('#statAppointments').textContent = s.appointments;
  $('#statPhotos').textContent = s.photos;

  const kb = s.bytes / 1024;
  const label = kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(1) + ' KB';
  $('#storageLabel').textContent = label;
  const pct = Math.min(100, (s.bytes / STORAGE_BUDGET) * 100);
  $('#storageBar').style.width = pct.toFixed(1) + '%';

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
      store.importJSON(reader.result);
      toast(t('restored'));
      if (typeof onDone === 'function') onDone();
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
