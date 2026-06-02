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

/** YYYY-MM-DD -> localized readable date. */
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

/** Keep only digits for tel/wa links. */
export function cleanPhone(phone = '') { return phone.replace(/[^\d]/g, ''); }

export function waLink(phone, text = '') {
  const base = `https://wa.me/${cleanPhone(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
export function smsLink(phone, text = '') {
  const p = cleanPhone(phone);
  return text ? `sms:${p}?&body=${encodeURIComponent(text)}` : `sms:${p}`;
}
export function telLink(phone) { return `tel:${cleanPhone(phone)}`; }

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
/**
 * Read an <input type=file> image, downscale it and return a base64 data-URL (jpeg).
 * Keeps localStorage small while supporting camera/gallery on mobile.
 */
export function readImageResized(file, maxSize = 720, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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
