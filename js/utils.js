// utils.js — DOM helpers, modal system, toast, photo handling, contact links
import { t } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

/** YYYY-MM-DD -> US date format MM/DD/YYYY. */
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** "HH:MM" (24h) -> US 12-hour time, e.g. "2:30 PM". Empty string if no time. */
export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Add N months to an ISO date, return ISO. */
export function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

/** Keep only digits. */
export function cleanPhone(phone = '') { return phone.replace(/[^\d]/g, ''); }

/**
 * Normalize a phone number to full international digits (no '+').
 * Most numbers here are from the USA, so a bare 10-digit number gets the
 * country code '1' added. Numbers that already include a country code are
 * left as-is.
 */
export function normalizePhone(phone = '') {
  let d = cleanPhone(phone);
  if (d.length === 10) d = '1' + d;                 // US/Canada local number
  // 11 digits starting with 1 -> already US country code; longer -> already international
  return d;
}

export function waLink(phone, text = '') {
  const base = `https://wa.me/${normalizePhone(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
export function smsLink(phone, text = '') {
  const p = '+' + normalizePhone(phone);
  return text ? `sms:${p}?&body=${encodeURIComponent(text)}` : `sms:${p}`;
}
export function telLink(phone) { return `tel:+${normalizePhone(phone)}`; }

// ---------------- Toast ----------------
let toastTimer;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('d-none');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('d-none'), 2200);
}

// ---------------- Modal ----------------
// Clicking the backdrop does NOT close (per requirement). Only explicit close/cancel.
let modalOnClose = null;

export function openModal({ title, bodyHTML, footHTML = '', onMount, onClose }) {
  const root = $('#modalRoot');
  $('#modalTitle').textContent = title || '';
  $('#modalBody').innerHTML = bodyHTML || '';
  $('#modalFoot').innerHTML = footHTML;
  modalOnClose = onClose || null;
  root.classList.remove('d-none');
  document.body.style.overflow = 'hidden';
  if (typeof onMount === 'function') onMount($('#modalBody'), $('#modalFoot'));
}

export function closeModal() {
  const root = $('#modalRoot');
  if (root.classList.contains('d-none')) return;
  root.classList.add('d-none');
  document.body.style.overflow = '';
  $('#modalBody').innerHTML = '';
  $('#modalFoot').innerHTML = '';
  const cb = modalOnClose; modalOnClose = null;
  if (typeof cb === 'function') cb();
}

export function isModalOpen() {
  return !$('#modalRoot').classList.contains('d-none');
}

// ---------------- Lightbox (full-screen image viewer) ----------------
/** Open an image full-screen with an X in the corner to close it. */
export function openLightbox(src) {
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `
    <button class="lightbox__close" aria-label="Close"><i class="ti ti-x"></i></button>
    <img class="lightbox__img" src="${src}" alt="" />`;

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    // intercept ESC before the global modal handler so only the lightbox closes
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }
  // close on X or on the dark backdrop (but not when tapping the image itself)
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.lightbox__close') || e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
}

/** Simple confirm dialog returning a Promise<boolean>. */
export function confirmDialog(message, opts = {}) {
  const title = opts.title || t('delete');
  const confirmText = opts.confirmText || t('delete');
  const confirmClass = opts.confirmClass || 'btn-danger';
  return new Promise((resolve) => {
    let done = false;
    openModal({
      title,
      bodyHTML: `<p style="margin:6px 0 2px">${escapeHtml(message)}</p>`,
      footHTML: `
        <button class="btn btn-outline-secondary" data-confirm="no">${escapeHtml(t('cancel'))}</button>
        <button class="btn ${confirmClass}" data-confirm="yes">${escapeHtml(confirmText)}</button>`,
      onMount(body, foot) {
        foot.querySelector('[data-confirm="no"]').onclick = () => { done = true; closeModal(); resolve(false); };
        foot.querySelector('[data-confirm="yes"]').onclick = () => { done = true; closeModal(); resolve(true); };
      },
      onClose() { if (!done) resolve(false); },
    });
  });
}

// ---------------- Photo handling ----------------
//
// GUARANTEE: every photo we hand back is a JPEG we successfully decoded and
// re-encoded ourselves. We NEVER upload the original file untouched — doing so
// once let HEIC/HEIF camera photos (which Android Chrome cannot display) get
// stored and then show up blank. If we can't turn a file into a real JPEG, we
// throw so the caller shows an error instead of saving an invisible photo.

/**
 * Decode a blob with an <img> element. Tried FIRST because mobile browsers
 * auto-downsample huge images here (so a 50MP photo won't run the tab out of
 * memory) and apply EXIF orientation automatically.
 */
function decodeWithImg(blob, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const cleanup = () => { clearTimeout(to); URL.revokeObjectURL(url); };
    const to = setTimeout(() => { img.src = ''; cleanup(); reject(new Error('image timeout')); }, timeout);
    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = () => { cleanup(); reject(new Error('image decode failed')); };
    img.src = url;
  });
}

/** Get a drawable source (<img> or ImageBitmap) from a blob, or throw. */
async function decodeImage(blob) {
  try { return await decodeWithImg(blob); } catch (e) { /* try the next decoder */ }
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* */ }
    try { return await createImageBitmap(blob); } catch (e) { /* */ }
  }
  throw new Error('decode failed');
}

// Lazily load the heic2any converter. Tries the local copy first (offline), then
// the CDN as a fallback in case the bundled file didn't load on the device.
let heicLibPromise = null;
function loadHeicConverter() {
  if (heicLibPromise) return heicLibPromise;
  const sources = [
    './vendor/heic2any.min.js',
    'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
  ];
  heicLibPromise = new Promise((resolve, reject) => {
    if (window.heic2any) return resolve(window.heic2any);
    let i = 0;
    const tryNext = () => {
      if (i >= sources.length) return reject(new Error('heic converter unavailable'));
      const s = document.createElement('script');
      s.src = sources[i++];
      s.onload = () => (window.heic2any ? resolve(window.heic2any) : tryNext());
      s.onerror = () => tryNext();
      document.head.appendChild(s);
    };
    tryNext();
  });
  return heicLibPromise;
}

/** Convert a HEIC/HEIF blob to a JPEG blob using the converter. */
async function heicToJpeg(file) {
  const heic2any = await loadHeicConverter();
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

/**
 * Get a drawable image source from a picked file, or throw if impossible.
 * Tries a direct decode first; if that fails, assumes HEIC/HEIF (Android often
 * mis-reports the type) and converts before decoding.
 */
async function getDrawableSource(file) {
  try { return await decodeImage(file); } catch (e) { /* probably HEIC */ }
  try { return await decodeImage(await heicToJpeg(file)); } catch (e) { /* give up below */ }
  throw new Error('unsupported image');
}

/**
 * Turn a picked image File into an uploadable JPEG base64 data-URL.
 * Always returns a freshly re-encoded JPEG (guaranteed to display everywhere),
 * or throws if the file can't be decoded at all.
 */
export async function readImageResized(file, maxSize = 1600, quality = 0.85) {
  if (!file) return null;

  const source = await getDrawableSource(file); // throws if we truly can't read it
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  let width = sw, height = sh;
  if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
  else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }

  const canvas = document.createElement('canvas');
  canvas.width = width || sw; canvas.height = height || sh;
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === 'function') source.close(); // free ImageBitmap memory

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl || dataUrl.length < 64) throw new Error('encode failed'); // never store a blank
  return dataUrl;
}

/** Build a <select> options string with a default placeholder. */
export function optionsFrom(values, selected = '', placeholder = '') {
  let html = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '';
  html += values.map((v) => {
    const val = typeof v === 'object' ? v.value : v;
    const label = typeof v === 'object' ? v.label : v;
    const sel = String(val) === String(selected) ? 'selected' : '';
    return `<option value="${escapeHtml(val)}" ${sel}>${escapeHtml(label)}</option>`;
  }).join('');
  return html;
}
