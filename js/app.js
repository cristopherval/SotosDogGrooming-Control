// app.js — bootstrap: routing, bottom nav, theme, global event delegation
import { store } from './store.js';
import { applyTranslations, t } from './i18n.js';
import { $, $$, closeModal, escapeHtml } from './utils.js';
import {
  renderDogs, initDogFilters, clearFilters, openDogForm,
} from './dogs.js';
import { renderEmployees, openEmployeeForm } from './employees.js';
import { renderSettings, exportBackup, triggerImport, handleImportFile, setLanguage } from './settings.js';
import { openVaccineForm } from './vaccines.js';
import { upcomingAppointments, sendReminder, serviceLabels, renderAppointments } from './appointments.js';
import { fmtDate } from './utils.js';

const views = {
  dogs: renderDogs,
  appointments: renderAppointments,
  employees: renderEmployees,
  settings: renderSettings,
};
let currentView = 'dogs';

// ---------------- Routing ----------------
function showView(name) {
  currentView = name;
  $$('.view').forEach((v) => v.classList.toggle('d-none', v.getAttribute('data-view') !== name));
  $$('.bottom-nav__item').forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-nav') === name));
  if (views[name]) views[name]();
  if (name === 'dogs') renderUpcoming();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------- Upcoming widget (home) ----------------
function renderUpcoming() {
  const wrap = $('#upcomingWrap');
  const list = $('#upcomingList');
  const items = upcomingAppointments().slice(0, 5);
  if (!items.length) { wrap.classList.add('d-none'); list.innerHTML = ''; return; }
  wrap.classList.remove('d-none');
  list.innerHTML = items.map((a) => {
    const dog = store.getDog(a.dogId);
    if (!dog) return '';
    return `
      <div class="upcoming-item">
        <div class="upcoming-item__info">
          <div class="upcoming-item__name">${escapeHtml(dog.name)}</div>
          <div class="upcoming-item__date"><i class="ti ti-calendar"></i> ${fmtDate(a.date)} · ${escapeHtml(serviceLabels(a).join(', ') || '—')}</div>
        </div>
        ${dog.phone ? `<button class="btn btn-sm btn-wa" data-up-remind="${escapeHtml(a.id)}"><i class="ti ti-brand-whatsapp"></i> ${escapeHtml(t('remind'))}</button>` : ''}
      </div>`;
  }).join('');
  $$('[data-up-remind]', list).forEach((b) => b.onclick = () => {
    const appt = store.data.appointments.find((a) => a.id === b.getAttribute('data-up-remind'));
    if (appt) sendReminder(appt);
  });
}

// ---------------- Theme ----------------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  const icon = $('#themeToggle i');
  icon.className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#14151c' : '#7B61FF');
}
function toggleTheme() {
  const next = (store.data.settings.theme === 'dark') ? 'light' : 'dark';
  store.setSetting('theme', next);
  applyTheme(next);
}

// ---------------- Global event wiring ----------------
function wireEvents() {
  // bottom nav
  $$('.bottom-nav__item').forEach((b) => b.onclick = () => showView(b.getAttribute('data-nav')));

  // theme
  $('#themeToggle').onclick = toggleTheme;

  // modal: close button only (backdrop click intentionally does NOT close)
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-action="close-modal"]');
    if (closer) closeModal();
  });
  // ESC closes modal (convenience; backdrop still won't)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // delegated action buttons across views
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.getAttribute('data-action')) {
      case 'add-dog': openDogForm(); break;
      case 'add-employee': openEmployeeForm(); break;
      case 'add-vaccine': openVaccineForm(); break;
      case 'clear-filters': clearFilters(); break;
      case 'export-backup': exportBackup(); break;
      case 'import-backup': triggerImport(); break;
    }
  });

  // filters
  initDogFilters();

  // import file input
  $('#importFile').addEventListener('change', (e) => {
    handleImportFile(e.target.files[0], () => {
      e.target.value = '';
      applyTheme(store.data.settings.theme);
      applyTranslations();
      showView('settings');
    });
  });

  // language buttons
  $$('.lang-btn').forEach((b) => b.onclick = () => {
    setLanguage(b.getAttribute('data-lang'), () => {
      // refresh dynamic content in current language
      if (views[currentView]) views[currentView]();
      if (currentView === 'dogs') renderUpcoming();
    });
  });
}

// ---------------- Boot ----------------
function init() {
  applyTheme(store.data.settings.theme || 'light');
  applyTranslations();
  wireEvents();
  showView('dogs');

  // register service worker (PWA) — ignored on file:// or unsupported
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {/* offline cache optional */});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
