// themes.js — swappable color themes. Single source of truth for the menu, the
// browser-bar color, validation and persistence. Adding a theme = one entry
// here + one `[data-theme='id']` block in css/themes.css.
import { store } from './store.js';
import { t } from './i18n.js';
import { toast } from './utils.js';

// color = browser bar (matches surface). dots = 3 preview swatches [bg, accent, ink].
export const THEMES = [
  { id: 'minimal',    name: 'Minimal',    mode: 'light', color: '#ffffff', dots: ['#fafafa', '#171717', '#171717'] },
  { id: 'arena',      name: 'Arena',      mode: 'light', color: '#fffdf8', dots: ['#faf6ed', '#925b1e', '#3c2f21'] },
  { id: 'oceano',     name: 'Océano',     mode: 'light', color: '#ffffff', dots: ['#f0f7fc', '#026cac', '#0c2a42'] },
  { id: 'esmeralda',  name: 'Esmeralda',  mode: 'light', color: '#ffffff', dots: ['#f0faf5', '#047857', '#103326'] },
  { id: 'coral',      name: 'Coral',      mode: 'light', color: '#ffffff', dots: ['#fdf4f4', '#be2947', '#411a20'] },
  { id: 'glass',      name: 'Cristal',    mode: 'light', color: '#ffffff', dots: ['#e2e8f0', '#2563eb', '#0f172a'] },
  { id: 'clay',       name: 'Arcilla',    mode: 'light', color: '#f5f3ff', dots: ['#ede9fe', '#4f46e5', '#312e81'] },
  { id: 'brutal',     name: 'Brutal',     mode: 'light', color: '#ffffff', dots: ['#f5f5eb', '#facc15', '#111111'] },
  { id: 'dark',       name: 'Oscuro',     mode: 'dark',  color: '#18181b', dots: ['#0a0a0a', '#f4f4f5', '#f4f4f5'] },
  { id: 'medianoche', name: 'Medianoche', mode: 'dark',  color: '#11192c', dots: ['#080e1c', '#60a5fa', '#e2eaf8'] },
  { id: 'bosque',     name: 'Bosque',     mode: 'dark',  color: '#0f2018', dots: ['#08140f', '#34d399', '#deeee5'] },
  { id: 'vino',       name: 'Vino',       mode: 'dark',  color: '#261118', dots: ['#180a0f', '#f47294', '#f5e3e7'] },
  { id: 'carbon',     name: 'Carbón',     mode: 'dark',  color: '#0c0c0c', dots: ['#000000', '#ffffff', '#f0f0f0'] },
];

const DEFAULT_ID = 'minimal';
const LEGACY = { light: 'minimal', dark: 'dark' }; // migrate the old two-mode setting
const byId = (id) => THEMES.find((th) => th.id === id);

/** Resolve a stored value into a valid theme id (handles legacy + unknown). */
export function resolveTheme(stored) {
  let id = LEGACY[stored] || stored;
  return byId(id) ? id : DEFAULT_ID;
}

/** Apply a theme to the document (no persistence). */
export function applyTheme(id) {
  const th = byId(id) || byId(DEFAULT_ID);
  const root = document.documentElement;
  root.setAttribute('data-theme', th.id);
  root.setAttribute('data-bs-theme', th.mode); // keep Tabler components in sync
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th.color);
  return th.id;
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_ID;
}

/** Persist to localStorage and confirm it actually stuck. */
function persist(id) {
  store.setSetting('theme', id);
  try {
    const raw = localStorage.getItem('sotos_settings');
    return !!raw && JSON.parse(raw).theme === id;
  } catch (e) { return false; }
}

/** Apply instantly, then persist. Revert to the previous theme if saving fails. */
export function setTheme(id) {
  const prev = currentTheme();
  applyTheme(id);
  if (!persist(id)) {
    applyTheme(prev);         // showing an unsaved theme would lie to the user
    persist(prev);
    toast(t('save_failed'));
    return false;
  }
  return true;
}

// ---------------- Selector (card button + bottom sheet) ----------------
function renderButton() {
  const th = byId(currentTheme()) || byId(DEFAULT_ID);
  const dots = document.getElementById('themeBtnDots');
  const name = document.getElementById('themeBtnName');
  if (dots) dots.innerHTML = th.dots.map((c) => `<span style="background:${c}"></span>`).join('');
  if (name) name.textContent = th.name;
}

function group(mode, title) {
  return `
    <div class="theme-sheet__title">${title}</div>
    ${THEMES.filter((th) => th.mode === mode).map((th) => `
      <button class="theme-opt" data-theme-id="${th.id}">
        <span class="theme-opt__dots">${th.dots.map((c) => `<span style="background:${c}"></span>`).join('')}</span>
        <span class="theme-opt__name">${th.name}</span>
        <i class="ti ti-check theme-opt__check"></i>
      </button>`).join('')}`;
}

function markActive(sheet) {
  const cur = currentTheme();
  sheet.querySelectorAll('[data-theme-id]').forEach((b) =>
    b.classList.toggle('is-active', b.getAttribute('data-theme-id') === cur));
}

export function initThemes() {
  applyTheme(resolveTheme(store.data.settings.theme));
  renderButton();

  const sheet = document.createElement('div');
  sheet.className = 'theme-sheet';
  sheet.innerHTML = `
    <div class="theme-sheet__backdrop" data-theme-close></div>
    <div class="theme-sheet__panel">
      ${group('light', t('themes_light'))}
      ${group('dark', t('themes_dark'))}
    </div>`;
  document.body.appendChild(sheet);

  const btn = document.getElementById('themeBtn');
  if (btn) btn.onclick = () => { markActive(sheet); sheet.classList.add('is-open'); };

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-close]')) { sheet.classList.remove('is-open'); return; }
    const opt = e.target.closest('[data-theme-id]');
    if (!opt) return;
    // Apply instantly: the sheet itself uses the variables, so it repaints and
    // the user sees the real result before closing. Then persist.
    setTheme(opt.getAttribute('data-theme-id'));
    renderButton();
    markActive(sheet);
  });
}
