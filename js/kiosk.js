// kiosk.js — the entrance tablet.
//
// A full-screen, customer-facing skin that covers the whole app. The tablet is
// still signed in as the shop (that's how it reaches Supabase at all), so the
// job here is to make sure a customer standing at the door can do exactly two
// things and nothing else:
//
//   1. Register a new dog  → saved with `pending = true`, so it lands in the
//      shop's review panel instead of straight in the real client list.
//   2. Look up a dog       → read-only grooming card. No editing, no deleting.
//
// Leaving kiosk mode needs the 4-digit PIN (long-press the logo). That keeps a
// curious customer out of Settings, the backup export and the full client list.
// It is a deterrent, not real security — pair it with the tablet's own Guided
// Access / screen pinning, as SUPABASE_SETUP.md explains.
import { store, normalizePhotos, firstPhoto } from './store.js';
import { t } from './i18n.js';
import { $, $$, escapeHtml, fmtDate } from './utils.js';
import { CARE_OPTIONS, careLabels, combLabel } from './dogs.js';

// Cut-out shot of three dogs (real transparency, so it sits straight on the
// background with no photo box around it).
const HERO = 'img/welcome-dogs.webp';
const DEFAULT_PIN = '1234';

// Send the tablet back to the welcome screen if a customer walks away
// mid-flow, so their dog's card isn't left on screen for the next person.
const IDLE_MS = 90_000;
// How long the "Thank you!" screen stays up before resetting itself.
const THANKS_MS = 6_000;

let idleTimer = null;
let onExit = null; // set by init(): hands control back to app.js

// ---------------- helpers ----------------

/** Lowercase + strip accents, so "Lolá" matches "lola". */
function norm(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function photoOf(dog) {
  return firstPhoto(normalizePhotos(dog.photos));
}

function root() { return $('#kioskRoot'); }

// What drifts up behind the welcome screen. Mostly soap bubbles (the logo is
// a dog in a bubble bath), with the odd bone or ball mixed in.
const TOYS = ['kiosk-toy--bone', 'kiosk-toy--teal', 'kiosk-toy--pink', 'kiosk-toy--tennis'];

const rand = (min, max) => min + Math.random() * (max - min);

/** One floating thing: a bubble, or a toy every so often. */
function floaty(isToy) {
  const cls = isToy
    ? `kiosk-float kiosk-toy ${TOYS[Math.floor(Math.random() * TOYS.length)]}`
    : 'kiosk-float kiosk-bubble';
  // Toys read as heavier, so they run a little bigger and slower than bubbles.
  const size = isToy ? rand(34, 72) : rand(20, 92);
  const dur = isToy ? rand(20, 34) : rand(13, 29);
  const style = [
    `width:${size.toFixed(0)}px`,
    // A bubble is a circle; a toy gets its height from its aspect-ratio.
    isToy ? '' : `height:${size.toFixed(0)}px`,
    `left:${rand(0, 100).toFixed(1)}%`,
    `animation-duration:${dur.toFixed(1)}s`,
    // Negative delay: they are already mid-rise on the first paint, so the
    // screen never starts empty and then fills up.
    `animation-delay:${(-rand(0, 30)).toFixed(1)}s`,
    `--drift:${rand(-60, 60).toFixed(0)}px`,
    isToy ? `--spin-from:${rand(-30, 0).toFixed(0)}deg` : '',
    isToy ? `--spin-to:${rand(10, 40).toFixed(0)}deg` : '',
  ].filter(Boolean).join(';');
  return `<span class="${cls}" style="${style}"></span>`;
}

/** The whole backdrop: bubbles with toys sprinkled through them. */
function floatiesHTML(bubbles = 15, toys = 6) {
  const items = [];
  for (let i = 0; i < bubbles; i++) items.push(floaty(false));
  for (let i = 0; i < toys; i++) items.push(floaty(true));
  // Interleave so the toys aren't all stacked at the end of the DOM order
  // (which also keeps the :nth-child(5n) pink bubbles spread out).
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.join('');
}

/**
 * Build the parts that never change: the bubble backdrop and the hidden
 * long-press corner. Screens are swapped inside #kioskScreen, so the bubbles
 * keep drifting instead of restarting on every navigation.
 */
function buildShell() {
  const el = root();
  if ($('#kioskScreen', el)) return; // already built
  el.innerHTML = `
    <div class="kiosk-bg" aria-hidden="true">${floatiesHTML()}</div>
    <button class="kiosk-exit" id="kioskExit" aria-hidden="true" tabindex="-1"></button>
    <div id="kioskScreen" style="display:contents"></div>`;
  wireExit();
}

/** Swap the current kiosk screen and restart the idle countdown. */
function screen(html, mount) {
  buildShell();
  const host = $('#kioskScreen');
  host.innerHTML = html;
  if (mount) mount(host);
  const scroller = host.querySelector('.kiosk__screen');
  if (scroller) scroller.scrollTop = 0;
  resetIdle();
}

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(renderWelcome, IDLE_MS);
}

// ---------------- 1. Welcome ----------------

export function renderWelcome() {
  // Split screen on anything tablet-landscape and wider: the brand on one
  // half, the two choices on the other. On a narrow or portrait screen the
  // CSS stacks the same markup instead.
  screen(`
    <div class="kiosk__screen kiosk-centred kiosk-welcome">
      <div class="kiosk-frame">
      <div class="kiosk-split">

        <div class="kiosk-split__visual">
          <img class="kiosk-hero" src="${HERO}" alt="" />
        </div>

        <div class="kiosk-split__panel">
          <div class="kiosk-welcome__hi">${escapeHtml(t('k_welcome'))}</div>
          <h1 class="kiosk-welcome__shop">Soto's Dog Grooming</h1>
          <p class="kiosk-welcome__tagline">${escapeHtml(t('k_tagline'))}</p>

          <div class="kiosk-choices">
            <button class="kiosk-choice kiosk-choice--new" id="kNew">
              <i class="ti ti-plus"></i>
              <span>${escapeHtml(t('k_new_dog'))}</span>
            </button>
            <button class="kiosk-choice kiosk-choice--find" id="kFind">
              <i class="ti ti-search"></i>
              <span>${escapeHtml(t('k_find_dog'))}</span>
            </button>
          </div>

          <button class="kiosk-exitbtn" id="kExit">
            <i class="ti ti-lock"></i>${escapeHtml(t('k_exit_system'))}
          </button>
        </div>

      </div>
      </div>
    </div>`, (el) => {
    // NOTE: these must be wrapped, not passed straight as the handler.
    // `onclick = renderSearch` would hand the click event to renderSearch as
    // its `prefill` argument, and the box would open showing "[object PointerEvent]".
    $('#kNew', el).onclick = () => renderForm();
    $('#kFind', el).onclick = () => renderSearch();

    // Three ways for staff to get out, all of them behind the PIN: the
    // visible button, three taps on the photo, and the hidden corner.
    // (The taps used to be on the logo, which this screen no longer shows.)
    $('#kExit', el).onclick = () => openPinPad();
    wireTripleTap($('.kiosk-hero', el), openPinPad);
  });
}

// ---------------- 2. Search ----------------

function renderSearch(prefillArg = '') {
  // Defensive: only ever treat a real string as the prefill, so wiring this up
  // as a bare event handler can never leak an event object into the box.
  const prefill = typeof prefillArg === 'string' ? prefillArg : '';
  screen(`
    <div class="kiosk__screen">
      <div class="kiosk-head">
        <h2 class="kiosk-title">${escapeHtml(t('k_search_title'))}</h2>
      </div>

      <div class="kiosk-search__row">
        <input id="kQ" class="kiosk-search__input" type="text" inputmode="text"
               autocomplete="off" autocapitalize="words" spellcheck="false"
               placeholder="${escapeHtml(t('k_search_ph'))}" value="${escapeHtml(prefill)}" />
        <button class="kiosk-btn kiosk-btn--primary" id="kGo">
          <i class="ti ti-search"></i>${escapeHtml(t('k_search_btn'))}
        </button>
      </div>

      <div id="kResults"></div>

      <div class="kiosk-foot">
        <button class="kiosk-btn" id="kBack"><i class="ti ti-arrow-left"></i>${escapeHtml(t('k_back'))}</button>
      </div>
    </div>`, (el) => {
    const input = $('#kQ', el);
    const go = () => showResults(input.value, el);
    $('#kGo', el).onclick = go;
    // Enter on the tablet's on-screen keyboard searches too.
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    $('#kBack', el).onclick = renderWelcome;
    input.focus();
    if (prefill) go();
  });
}

function showResults(query, el) {
  const q = norm(query).trim();
  const box = $('#kResults', el);
  resetIdle();
  if (!q) { box.innerHTML = ''; return; }

  // Only approved dogs: a dog still waiting for review isn't findable yet.
  const hits = store.approvedDogs()
    .filter((d) => norm(d.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!hits.length) {
    box.innerHTML = `
      <div class="kiosk-empty">
        <i class="ti ti-dog"></i>
        <div class="kiosk-empty__title">${escapeHtml(t('k_no_results', { name: query.trim() }))}</div>
        <p>${escapeHtml(t('k_no_results_hint'))}</p>
      </div>`;
    return;
  }

  // Big cards in a horizontal carousel: swipe on the tablet, or use the
  // arrows. Cards snap into place so one is always squarely in view.
  box.innerHTML = `
    <p class="kiosk-hint-strong">${escapeHtml(t('k_pick_yours'))}</p>
    <div class="kiosk-carousel__wrap">
      <button class="kiosk-carousel__nav kiosk-carousel__nav--prev" id="kPrev" hidden aria-label="◀">
        <i class="ti ti-chevron-left"></i>
      </button>
      <div class="kiosk-carousel" id="kCar">
        ${hits.map((d) => {
          const pic = photoOf(d);
          // Breed/colour only — enough for an owner to recognise their dog,
          // without putting other clients' phone numbers on screen.
          const sub = [d.breed, d.color].filter(Boolean).join(' · ');
          return `
            <button class="kiosk-result" data-dog="${escapeHtml(d.id)}">
              ${pic
                ? `<img class="kiosk-result__pic" src="${escapeHtml(pic)}" alt="" />`
                : `<span class="kiosk-result__pic kiosk-result__pic--empty"><i class="ti ti-dog"></i></span>`}
              <span class="kiosk-result__name">${escapeHtml(d.name)}</span>
              ${sub ? `<span class="kiosk-result__sub">${escapeHtml(sub)}</span>` : ''}
            </button>`;
        }).join('')}
      </div>
      <button class="kiosk-carousel__nav kiosk-carousel__nav--next" id="kNext" hidden aria-label="▶">
        <i class="ti ti-chevron-right"></i>
      </button>
    </div>`;

  $$('[data-dog]', box).forEach((b) => {
    b.onclick = () => {
      const dog = store.getDog(b.getAttribute('data-dog'));
      if (dog) renderCard(dog);
    };
  });

  wireCarousel(box);
}

/** Show the arrows only while the row actually overflows, and scroll by a card. */
function wireCarousel(box) {
  const car = $('#kCar', box);
  const prev = $('#kPrev', box);
  const next = $('#kNext', box);
  if (!car || !prev || !next) return;

  const step = () => {
    const card = car.querySelector('.kiosk-result');
    return card ? card.offsetWidth + 22 : car.clientWidth * .8;
  };

  const sync = () => {
    const overflow = car.scrollWidth - car.clientWidth > 8;
    // 2px of slack so a rounded scroll position still counts as "at the end".
    prev.hidden = !overflow || car.scrollLeft <= 2;
    next.hidden = !overflow || car.scrollLeft >= car.scrollWidth - car.clientWidth - 2;
  };

  prev.onclick = () => { car.scrollBy({ left: -step(), behavior: 'smooth' }); resetIdle(); };
  next.onclick = () => { car.scrollBy({ left: step(), behavior: 'smooth' }); resetIdle(); };
  car.addEventListener('scroll', sync, { passive: true });
  // Photos loading changes the width, so re-check once they settle.
  $$('.kiosk-result__pic', car).forEach((img) => img.addEventListener && img.addEventListener('load', sync));
  window.addEventListener('resize', sync);
  sync();
}

// ---------------- 3. Dog card (read-only) ----------------

function renderCard(dog) {
  const pic = photoOf(dog);
  const sub = [dog.breed, dog.color, dog.sex && t(dog.sex.toLowerCase())].filter(Boolean).join(' · ');
  const care = careLabels(dog);

  const spec = (lbl, val) => `
    <div class="kiosk-spec">
      <div class="kiosk-spec__lbl">${escapeHtml(lbl)}</div>
      <div class="kiosk-spec__val">${escapeHtml(val || '—')}</div>
    </div>`;

  const hasSpecs = dog.bladeHead || dog.bladeBody || dog.combHead || dog.combBody;

  screen(`
    <div class="kiosk__screen">
      <div class="kiosk-head">
        <h2 class="kiosk-title">${escapeHtml(t('k_card_title'))}</h2>
      </div>

      <div class="kiosk-card__hero">
        ${pic
          ? `<img class="kiosk-card__pic" src="${escapeHtml(pic)}" alt="" />`
          : `<span class="kiosk-card__pic kiosk-card__pic--empty"><i class="ti ti-dog"></i></span>`}
        <div>
          <div class="kiosk-card__name">${escapeHtml(dog.name)}</div>
          ${sub ? `<div class="kiosk-card__sub">${escapeHtml(sub)}</div>` : ''}
          ${dog.birthday ? `<div class="kiosk-card__sub"><i class="ti ti-cake"></i> ${escapeHtml(fmtDate(dog.birthday))}</div>` : ''}
        </div>
      </div>

      ${hasSpecs ? `
        <div class="kiosk-specs">
          ${spec(t('blade_head'), dog.bladeHead)}
          ${spec(t('blade_body'), dog.bladeBody)}
          ${spec(t('comb_head'), dog.combHead ? combLabel(dog.combHead) : '')}
          ${spec(t('comb_body'), dog.combBody ? combLabel(dog.combBody) : '')}
        </div>`
        : `<div class="kiosk-note"><p>${escapeHtml(t('k_no_specs'))}</p></div>`}

      ${care.length ? `
        <div class="kiosk-note">
          <div class="kiosk-spec__lbl">${escapeHtml(t('care_specs'))}</div>
          <div class="kiosk-chips">
            ${care.map((c) => `<span class="kiosk-chip">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>` : ''}

      ${dog.cutRequest ? `
        <div class="kiosk-note kiosk-note--accent">
          <div class="kiosk-spec__lbl">${escapeHtml(t('cut_request'))}</div>
          <p>${escapeHtml(dog.cutRequest)}</p>
        </div>` : ''}

      <div class="kiosk-foot">
        <button class="kiosk-btn" id="kBack"><i class="ti ti-arrow-left"></i>${escapeHtml(t('k_back'))}</button>
        <button class="kiosk-btn kiosk-btn--primary" id="kDone" style="margin-left:auto">
          <i class="ti ti-check"></i>${escapeHtml(t('k_done'))}
        </button>
      </div>
    </div>`, (el) => {
    $('#kBack', el).onclick = () => renderSearch();
    $('#kDone', el).onclick = renderWelcome;
  });
}

// ---------------- 4. New dog form ----------------

function renderForm() {
  const field = (id, label, extra = '', optional = true) => `
    <div class="kiosk-field">
      <label class="kiosk-field__lbl" for="${id}">
        ${escapeHtml(label)}${optional ? ` <span class="kiosk-field__opt">· ${escapeHtml(t('k_optional'))}</span>` : ''}
      </label>
      <input id="${id}" class="kiosk-input" ${extra} />
    </div>`;

  screen(`
    <div class="kiosk__screen">
      <div class="kiosk-head">
        <h2 class="kiosk-title">${escapeHtml(t('k_form_title'))}</h2>
      </div>

      <div class="kiosk-form">
        <div id="kErr" class="kiosk-error d-none"></div>

        <div class="kiosk-form__section">${escapeHtml(t('k_form_owner'))}</div>
        <div class="kiosk-grid">
          ${field('kOwnerF', t('owner_first'), 'autocapitalize="words"')}
          ${field('kOwnerL', t('owner_last'), 'autocapitalize="words"')}
          ${field('kPhone', t('phone'), 'type="tel" inputmode="tel"')}
        </div>

        <div class="kiosk-form__section">${escapeHtml(t('k_form_dog'))}</div>
        <div class="kiosk-grid">
          ${field('kName', t('name'), 'autocapitalize="words"', false)}
          ${field('kBreed', t('breed'), 'autocapitalize="words"')}
          ${field('kColor', t('color'), 'autocapitalize="words"')}
          <div class="kiosk-field">
            <label class="kiosk-field__lbl" for="kSex">
              ${escapeHtml(t('sex'))} <span class="kiosk-field__opt">· ${escapeHtml(t('k_optional'))}</span>
            </label>
            <select id="kSex" class="kiosk-select">
              <option value="">${escapeHtml(t('select'))}</option>
              <option value="Male">${escapeHtml(t('male'))}</option>
              <option value="Female">${escapeHtml(t('female'))}</option>
            </select>
          </div>
          ${field('kBday', t('birthday'), 'type="date"')}
        </div>

        <div class="kiosk-form__section">${escapeHtml(t('k_cut_request'))}</div>
        <div class="kiosk-field">
          <label class="kiosk-field__lbl" for="kCut">
            <span class="kiosk-field__opt">${escapeHtml(t('k_optional'))}</span>
          </label>
          <textarea id="kCut" class="kiosk-textarea" placeholder="${escapeHtml(t('k_cut_request_ph'))}"></textarea>
          <p class="kiosk-hint">${escapeHtml(t('k_cut_hint'))}</p>
        </div>

        <div class="kiosk-form__section">${escapeHtml(t('care_specs'))}</div>
        <div class="kiosk-checks">
          ${CARE_OPTIONS.map((o) => `
            <label class="kiosk-check">
              <input type="checkbox" data-care="${o.key}" />
              <span>${escapeHtml(t(o.i18n))}</span>
            </label>`).join('')}
        </div>

        <button class="kiosk-btn kiosk-btn--primary kiosk-btn--lg" id="kSend" style="margin-top:8px">
          <i class="ti ti-send"></i>${escapeHtml(t('k_submit'))}
        </button>
      </div>

      <div class="kiosk-foot">
        <button class="kiosk-btn" id="kBack"><i class="ti ti-arrow-left"></i>${escapeHtml(t('k_back'))}</button>
      </div>
    </div>`, (el) => {
    $('#kBack', el).onclick = renderWelcome;

    const err = $('#kErr', el);
    const send = $('#kSend', el);

    send.onclick = async () => {
      const name = $('#kName', el).value.trim();
      if (!name) {
        err.textContent = t('k_required_name');
        err.classList.remove('d-none');
        $('#kName', el).focus();
        resetIdle();
        return;
      }
      err.classList.add('d-none');
      send.disabled = true;
      send.innerHTML = `<i class="ti ti-loader-2"></i>${escapeHtml(t('k_sending'))}`;

      const dog = {
        id: store.uid('dog'),
        name,
        breed: $('#kBreed', el).value.trim(),
        color: $('#kColor', el).value.trim(),
        sex: $('#kSex', el).value,
        birthday: $('#kBday', el).value,
        ownerFirst: $('#kOwnerF', el).value.trim(),
        ownerLast: $('#kOwnerL', el).value.trim(),
        phone: $('#kPhone', el).value.trim(),
        employeeId: '',
        // Blades and combs stay empty on purpose: the groomer fills those in.
        bladeHead: '', bladeBody: '', combHead: '', combBody: '',
        care: Object.fromEntries(
          $$('[data-care]', el).map((cb) => [cb.getAttribute('data-care'), cb.checked])),
        cutRequest: $('#kCut', el).value.trim(),
        price: '', notes: '',
        photos: normalizePhotos(null),
        vaccines: {},
        pending: true, // waits for the shop to review it
      };

      try {
        await store.upsertDog(dog);
        renderThanks(dog.name);
      } catch (e) {
        console.error('Kiosk registration failed', e);
        send.disabled = false;
        send.innerHTML = `<i class="ti ti-send"></i>${escapeHtml(t('k_submit'))}`;
        err.textContent = t('k_save_failed');
        err.classList.remove('d-none');
        resetIdle();
      }
    };
  });
}

// ---------------- 5. Thank you ----------------

function renderThanks(dogName) {
  screen(`
    <div class="kiosk__screen kiosk-centred kiosk-thanks">
      <div class="kiosk-thanks__ico"><i class="ti ti-circle-check"></i></div>
      <h2 class="kiosk-thanks__title">${escapeHtml(t('k_thanks'))}</h2>
      <p class="kiosk-thanks__sub">${escapeHtml(t('k_thanks_sub', { dog: dogName }))}</p>
      <button class="kiosk-btn kiosk-btn--primary" id="kDone">
        <i class="ti ti-check"></i>${escapeHtml(t('k_done'))}
      </button>
    </div>`, (el) => {
    $('#kDone', el).onclick = renderWelcome;
  });
  // Reset itself even if the customer just walks off.
  clearTimeout(idleTimer);
  idleTimer = setTimeout(renderWelcome, THANKS_MS);
}

// ---------------- PIN pad (staff only) ----------------

function currentPin() {
  const pin = store.data.settings.kioskPin;
  return /^\d{4}$/.test(pin || '') ? pin : DEFAULT_PIN;
}

/**
 * Three taps in quick succession on `el` run `fn`. Used on the logo so staff
 * have an obvious way in, while a customer tapping the logo once or twice out
 * of curiosity never triggers it. The counter resets after a short pause.
 */
function wireTripleTap(el, fn, taps = 3, windowMs = 800) {
  if (!el) return;
  let count = 0;
  let timer = null;
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    count++;
    clearTimeout(timer);
    if (count >= taps) { count = 0; fn(); return; }
    timer = setTimeout(() => { count = 0; }, windowMs);
  });
}

/** Long-press the top-right corner to ask for the PIN (works on every screen). */
function wireExit() {
  const btn = $('#kioskExit');
  if (!btn) return;
  let timer = null;
  const start = () => { timer = setTimeout(openPinPad, 1200); };
  const cancel = () => clearTimeout(timer);
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function openPinPad() {
  const pad = $('#kioskPin');
  let entered = '';

  const draw = (errMsg = '') => {
    pad.innerHTML = `
      <div class="kiosk-pin__title">${escapeHtml(t('k_pin_title'))}</div>
      <div class="kiosk-pin__dots">
        ${[0, 1, 2, 3].map((i) => `<span class="kiosk-pin__dot ${i < entered.length ? 'is-on' : ''}"></span>`).join('')}
      </div>
      <div class="kiosk-pin__err">${escapeHtml(errMsg)}</div>
      <div class="kiosk-pin__pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="kiosk-pin__key" data-k="${n}">${n}</button>`).join('')}
        <button class="kiosk-pin__key kiosk-pin__key--wide" data-k="cancel"><i class="ti ti-x"></i></button>
        <button class="kiosk-pin__key" data-k="0">0</button>
        <button class="kiosk-pin__key kiosk-pin__key--wide" data-k="del"><i class="ti ti-backspace"></i></button>
      </div>`;

    $$('[data-k]', pad).forEach((b) => {
      b.onclick = () => {
        const k = b.getAttribute('data-k');
        if (k === 'cancel') { closePinPad(); return; }
        if (k === 'del') { entered = entered.slice(0, -1); draw(); return; }
        if (entered.length >= 4) return;
        entered += k;
        if (entered.length < 4) { draw(); return; }
        if (entered === currentPin()) { closePinPad(); exitKiosk(); return; }
        entered = '';
        draw(t('k_pin_wrong'));
      };
    });
  };

  pad.classList.remove('d-none');
  draw();
  resetIdle();
}

function closePinPad() {
  const pad = $('#kioskPin');
  pad.classList.add('d-none');
  pad.innerHTML = '';
}

// ---------------- Enter / leave ----------------

/** True when this device is set up as the entrance tablet. */
export function isKioskOn() { return !!store.data.settings.kiosk; }

let idleBound = false;

/** Show the kiosk. `exitCb` runs when staff unlock it with the PIN. */
export function enterKiosk(exitCb) {
  if (exitCb) onExit = exitCb;
  store.setSetting('kiosk', true);
  document.body.classList.add('kiosk-on');
  root().classList.remove('d-none');
  // Any touch anywhere postpones the idle reset. Bound once: leaving and
  // re-entering kiosk mode must not stack duplicate listeners.
  if (!idleBound) {
    root().addEventListener('pointerdown', resetIdle);
    idleBound = true;
  }
  renderWelcome();
}

/** Unlock back to the normal app (and stop booting into kiosk next time). */
export function exitKiosk() {
  clearTimeout(idleTimer);
  store.setSetting('kiosk', false);
  document.body.classList.remove('kiosk-on');
  const el = root();
  el.classList.add('d-none');
  el.innerHTML = '';
  closePinPad();
  if (onExit) onExit();
}

/** Called once at boot so the module can hand control back to app.js later. */
export function initKiosk(exitCb) { onExit = exitCb; }
