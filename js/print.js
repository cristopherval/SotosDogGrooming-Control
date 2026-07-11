// print.js — printable / shareable documents: the dog grooming sheet and the
// visit receipt. Both render the same HTML twice: once as an in-app preview
// (inside a modal) and once into #printRoot, which is the only thing the
// @media print stylesheet shows.
import { store, normalizePhotos, firstPhoto } from './store.js';
import { t } from './i18n.js';
import {
  $, openModal, closeModal, escapeHtml, toast,
  fmtDate, fmtTime, todayISO, durationLabel, waLink, money,
} from './utils.js';
import { combLabel } from './dogs.js';
import { serviceLabels } from './appointments.js';

const SHOP = "Soto's Dog Grooming";

// ---------------- Print plumbing ----------------

/** Wait until every <img> inside el finished loading (or failed), max `timeout`. */
function waitForImages(el, timeout = 8000) {
  const imgs = [...el.querySelectorAll('img')];
  if (!imgs.length) return Promise.resolve();
  const loaded = imgs.map((img) => (img.complete && img.naturalWidth)
    ? Promise.resolve()
    : new Promise((res) => { img.onload = res; img.onerror = res; }));
  return Promise.race([
    Promise.all(loaded),
    new Promise((res) => setTimeout(res, timeout)), // never hang on a slow photo
  ]);
}

/** Render HTML into the print layer and open the system print dialog. */
async function printHTML(html) {
  const root = $('#printRoot');
  if (!root) return;
  root.innerHTML = html;
  await waitForImages(root); // photos must be decoded before the dialog opens
  const cleanup = () => {
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 60000); // safety net if afterprint never fires
  window.print();
}

// ---------------- Share plumbing ----------------

/** Share via the system sheet; falls back to copying the text to the clipboard. */
async function shareContent({ title, text, files }) {
  try {
    if (navigator.share) {
      const payload = { title, text };
      if (files && files.length && navigator.canShare && navigator.canShare({ files })) {
        payload.files = files;
      }
      await navigator.share(payload);
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return true; // user closed the share sheet
    console.warn('Share failed', e);
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(t('copied'));
    return true;
  } catch (e) { /* clipboard unavailable too */ }
  toast(t('share_failed'));
  return false;
}

/** Download the dog's photos so they can be attached to a share. */
async function photoFiles(urls, baseName) {
  const files = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const blob = await (await fetch(urls[i])).blob();
      const type = blob.type || 'image/jpeg';
      const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      files.push(new File([blob], `${baseName}-${i + 1}.${ext}`, { type }));
    } catch (e) { /* skip a photo we can't fetch; the text still goes out */ }
  }
  return files;
}

// ---------------- Shared markup ----------------

const row = (label, value) => (value
  ? `<div class="sheet-row"><span class="sheet-row__lbl">${escapeHtml(label)}</span><span class="sheet-row__val">${escapeHtml(value)}</span></div>`
  : '');


/** Photo collage: 1 photo big, 2-4 in a 2-col grid, 5+ in a 3-col grid. */
function collageHTML(list) {
  if (!list.length) return '';
  const cols = list.length === 1 ? 1 : (list.length <= 4 ? 2 : 3);
  const one = list.length === 1 ? ' sheet-collage--one' : '';
  return `
    <div class="sheet-collage${one}" style="grid-template-columns:repeat(${cols},1fr)">
      ${list.map((src) => `<img src="${escapeHtml(src)}" alt="" />`).join('')}
    </div>`;
}

// The official logo already contains the shop name, so it stands alone as the
// letterhead — no duplicated brand text next to it.
const LOGO = 'icons/logosotos.jpg';

function sheetHead(subtitle) {
  return `
    <div class="sheet__head">
      <img class="sheet__logo" src="${LOGO}" alt="${escapeHtml(SHOP)}" />
      <div class="sheet__kind">${escapeHtml(subtitle)}</div>
    </div>`;
}

// ---------------- Dog grooming sheet ----------------

function dogSheetHTML(dog, photos) {
  const sub = [dog.breed, dog.color, dog.sex && t(dog.sex.toLowerCase())].filter(Boolean).join(' · ');
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ');
  return `
    <div class="sheet">
      ${sheetHead(t('dog_sheet'))}

      <div class="sheet__name">${escapeHtml(dog.name)}</div>
      ${sub ? `<div class="sheet__sub">${escapeHtml(sub)}</div>` : ''}

      <div class="sheet__box">
        ${row(t('owner'), owner)}
        ${row(t('blade_head'), dog.bladeHead)}
        ${row(t('blade_body'), dog.bladeBody)}
        ${row(t('comb_head'), dog.combHead ? combLabel(dog.combHead) : '')}
        ${row(t('comb_body'), dog.combBody ? combLabel(dog.combBody) : '')}
      </div>

      ${dog.notes ? `
        <div class="sheet__notes">
          <div class="sheet-row__lbl">${escapeHtml(t('notes'))}</div>
          <p>${escapeHtml(dog.notes)}</p>
        </div>` : ''}

      ${collageHTML(photos)}

      <div class="sheet__foot">${escapeHtml(SHOP)} · ${escapeHtml(fmtDate(todayISO()))}</div>
    </div>`;
}

function dogSheetText(dog) {
  const lines = [
    `🐾 ${SHOP} — ${t('dog_sheet')}`,
    '',
    `${t('name')}: ${dog.name}`,
  ];
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ');
  if (owner) lines.push(`${t('owner')}: ${owner}`);
  if (dog.bladeHead) lines.push(`${t('blade_head')}: ${dog.bladeHead}`);
  if (dog.bladeBody) lines.push(`${t('blade_body')}: ${dog.bladeBody}`);
  if (dog.combHead) lines.push(`${t('comb_head')}: ${combLabel(dog.combHead)}`);
  if (dog.combBody) lines.push(`${t('comb_body')}: ${combLabel(dog.combBody)}`);
  if (dog.notes) lines.push(`${t('notes')}: ${dog.notes}`);
  return lines.join('\n');
}

/**
 * Open the printable / shareable grooming sheet for a dog.
 * `onClose` runs when the sheet is dismissed (used to reopen the dog profile,
 * since both live in the same single modal root).
 */
export function openDogSheet(dogId, onClose) {
  const dog = store.getDog(dogId);
  if (!dog) return;

  // Photos, main photo first so the collage leads with it.
  const p = normalizePhotos(dog.photos);
  const cover = firstPhoto(p);
  const photos = cover ? [cover, ...p.list.filter((s) => s !== cover)] : p.list.slice();

  const html = dogSheetHTML(dog, photos);
  const text = dogSheetText(dog);

  openModal({
    title: t('dog_sheet'),
    bodyHTML: `<div class="sheet-preview">${html}</div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="close">${escapeHtml(t('close'))}</button>
      <button class="btn btn-outline-primary" data-act="share"><i class="ti ti-share"></i> ${escapeHtml(t('share'))}</button>
      <button class="btn btn-primary" data-act="print"><i class="ti ti-printer"></i> ${escapeHtml(t('print'))}</button>`,
    onClose,
    onMount(body, foot) {
      foot.querySelector('[data-act="close"]').onclick = closeModal;
      foot.querySelector('[data-act="print"]').onclick = () => printHTML(html);

      const shareBtn = foot.querySelector('[data-act="share"]');
      shareBtn.onclick = async () => {
        shareBtn.disabled = true;
        const label = shareBtn.innerHTML;
        shareBtn.textContent = t('preparing');
        // attach the real photos when the device supports sharing files
        const files = photos.length ? await photoFiles(photos, dog.name.replace(/\s+/g, '-').toLowerCase()) : [];
        await shareContent({ title: `${dog.name} — ${SHOP}`, text, files });
        shareBtn.disabled = false;
        shareBtn.innerHTML = label;
      };
    },
  });
}

// ---------------- Visit receipt ----------------

function receiptHTML(v, dog, emp) {
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ');
  const services = serviceLabels(v).join(', ');
  const dur = durationLabel(v.time, v.timeOut);
  const when = v.time ? fmtTime(v.time) + (v.timeOut ? ` – ${fmtTime(v.timeOut)}` : '') : '';
  return `
    <div class="sheet">
      ${sheetHead(t('receipt'))}

      <div class="sheet__name">${escapeHtml(dog.name)}</div>
      ${owner ? `<div class="sheet__sub">${escapeHtml(owner)}</div>` : ''}

      <div class="sheet__box">
        ${row(t('date'), fmtDate(v.date))}
        ${row(when ? t('time') : '', when)}
        ${row(dur ? t('duration') : '', dur)}
        ${row(t('attended_by'), emp ? emp.fullName : '')}
        ${row(t('services'), services)}
      </div>

      ${v.price ? `
        <div class="sheet__total">
          <span>${escapeHtml(t('total'))}</span>
          <strong>${escapeHtml(money(v.price))}</strong>
        </div>` : ''}

      <div class="sheet__thanks">${escapeHtml(t('thanks'))}</div>
      <div class="sheet__foot">${escapeHtml(SHOP)}</div>
    </div>`;
}

function receiptText(v, dog, emp) {
  const owner = [dog.ownerFirst, dog.ownerLast].filter(Boolean).join(' ');
  const services = serviceLabels(v).join(', ');
  const when = v.time ? fmtTime(v.time) + (v.timeOut ? ` – ${fmtTime(v.timeOut)}` : '') : '';
  const lines = [
    `🐾 ${SHOP} — ${t('receipt')}`,
    '',
    `${t('date')}: ${fmtDate(v.date)}`,
    `${t('dog')}: ${dog.name}`,
  ];
  if (owner) lines.push(`${t('owner')}: ${owner}`);
  if (emp) lines.push(`${t('attended_by')}: ${emp.fullName}`);
  if (services) lines.push(`${t('services')}: ${services}`);
  if (when) lines.push(`${t('time')}: ${when}`);
  if (v.price) lines.push(`${t('total')}: ${money(v.price)}`);
  lines.push('', t('thanks'));
  return lines.join('\n');
}

/** Open the printable / shareable receipt for a visit. */
export function openVisitReceipt(visitId) {
  const v = store.data.appointments.find((a) => a.id === visitId);
  if (!v) return;
  const dog = store.getDog(v.dogId);
  if (!dog) return;
  const emp = v.employeeId ? store.getEmployee(v.employeeId) : null;

  const html = receiptHTML(v, dog, emp);
  const text = receiptText(v, dog, emp);

  openModal({
    title: t('receipt'),
    bodyHTML: `<div class="sheet-preview">${html}</div>`,
    footHTML: `
      <button class="btn btn-outline-secondary" data-act="close">${escapeHtml(t('close'))}</button>
      ${dog.phone ? `<button class="btn btn-wa" data-act="wa"><i class="ti ti-brand-whatsapp"></i> ${escapeHtml(t('whatsapp'))}</button>` : ''}
      <button class="btn btn-outline-primary" data-act="share"><i class="ti ti-share"></i> ${escapeHtml(t('share'))}</button>
      <button class="btn btn-primary" data-act="print"><i class="ti ti-printer"></i> ${escapeHtml(t('print'))}</button>`,
    onMount(body, foot) {
      foot.querySelector('[data-act="close"]').onclick = closeModal;
      foot.querySelector('[data-act="print"]').onclick = () => printHTML(html);
      foot.querySelector('[data-act="share"]').onclick = () =>
        shareContent({ title: `${t('receipt')} — ${dog.name}`, text });

      const wa = foot.querySelector('[data-act="wa"]');
      if (wa) wa.onclick = () => window.open(waLink(dog.phone, text), '_blank', 'noopener');
    },
  });
}
