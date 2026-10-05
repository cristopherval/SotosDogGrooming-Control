// store.js — Supabase-backed data layer.
//
// Strategy: "hydrate on boot". After login, `store.init()` loads every table
// into the in-memory `store.data` object once. All render code keeps reading
// `store.data` synchronously. Writes mutate memory first (so the UI updates
// instantly) and then push to Supabase asynchronously.
//
// Device preferences (language / theme) stay in localStorage because they are
// read synchronously everywhere (getLang, applyTheme) and aren't shop data.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { t } from './i18n.js';
import { toast, normalizePhone } from './utils.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Keep the user logged in across reloads / app restarts (stored in this
    // browser) and silently refresh the token so they don't re-enter credentials.
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'sotos_auth',
  },
});

const BUCKET = 'dog-photos';
const SETTINGS_KEY = 'sotos_settings';
const OLD_KEY = 'sotos_dog_grooming_v1'; // legacy localStorage blob (pre-Supabase)

// A unique file name. crypto.randomUUID only exists in secure contexts (HTTPS),
// so we fall back to a timestamp+random name to avoid crashing photo uploads.
function uniqueName() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
// File extension for a mime type, so non-JPEG photos keep a sensible name.
function extForMime(m) {
  m = (m || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('heic') || m.includes('heif')) return 'heic';
  return 'jpg';
}

// ---------------- Device settings (localStorage) ----------------
function loadSettings() {
  const base = { language: 'en', theme: 'light' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
    // first run after upgrade: inherit language/theme from the old blob
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const parsed = JSON.parse(old);
      return { ...base, ...(parsed.settings || {}) };
    }
  } catch (e) { /* ignore, use defaults */ }
  return base;
}
function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

// ---------------- Row <-> object mapping (snake_case <-> camelCase) ----------------
const nz = (v) => (v === '' || v === undefined ? null : v); // '' -> null for the DB

// Photos are grouped in three sections. Legacy rows stored a flat array — we
// migrate those into the "before" section on read.
/**
 * All photos live in a single `list`, plus an optional `cover` (the chosen main
 * photo). Older rows stored either a flat array or three sections
 * (before/after/details); both are merged into `list` on read.
 */
export function normalizePhotos(raw) {
  const out = { list: [], cover: '' };
  if (Array.isArray(raw)) { out.list = raw.slice(); return out; } // legacy flat array
  if (!raw || typeof raw !== 'object') return out;

  if (Array.isArray(raw.list)) {
    out.list = raw.list.slice();
  } else {
    // legacy three-section shape -> merge into one list
    const before = Array.isArray(raw.before) ? raw.before : [];
    const after = Array.isArray(raw.after) ? raw.after : [];
    const details = Array.isArray(raw.details) ? raw.details : [];
    out.list = [...before, ...after, ...details];
    // keep whichever photo used to be shown as the main one
    if (!(typeof raw.cover === 'string' && raw.cover)) out.cover = after[0] || before[0] || details[0] || '';
  }
  if (typeof raw.cover === 'string' && raw.cover) out.cover = raw.cover;
  return out;
}
/** The photo shown for the dog (card + hero): the chosen `cover`, else the first. */
export function firstPhoto(photos) {
  const p = normalizePhotos(photos);
  if (p.cover && p.list.includes(p.cover)) return p.cover;
  return p.list[0] || '';
}

function rowToDog(r) {
  const photos = normalizePhotos(r.photos);
  return {
    id: r.id, name: r.name || '', breed: r.breed || '', color: r.color || '',
    sex: r.sex || '', birthday: r.birthday || '',
    // Owner fields are a projection of `clientId` once it is set — see the
    // Clients section above.
    clientId: r.client_id || '',
    ownerFirst: r.owner_first || '', ownerLast: r.owner_last || '', phone: r.phone || '',
    employeeId: r.employee_id || '', price: r.price || '',
    bladeHead: r.blade_head || '', bladeBody: r.blade_body || '',
    combHead: r.comb_head || '', combBody: r.comb_body || '',
    notes: r.notes || '', photos, photo: firstPhoto(photos),
    vaccines: r.vaccines || {},
    care: r.care || {}, // routine care checkboxes; {} for rows saved before it existed
    // Registered by a customer on the entrance tablet and not reviewed yet.
    // Kept out of the normal dog list until the shop approves it.
    pending: !!r.pending,
    cutRequest: r.cut_request || '', // the customer's own words (optional)
    updatedAt: r.updated_at || '', // last modification (for "recently updated" sort)
  };
}
function dogToRow(d) {
  return {
    id: d.id, name: d.name, breed: nz(d.breed), color: nz(d.color), sex: nz(d.sex),
    birthday: nz(d.birthday), client_id: nz(d.clientId),
    owner_first: nz(d.ownerFirst), owner_last: nz(d.ownerLast),
    phone: nz(d.phone), employee_id: nz(d.employeeId), price: nz(d.price),
    blade_head: nz(d.bladeHead), blade_body: nz(d.bladeBody),
    comb_head: nz(d.combHead), comb_body: nz(d.combBody),
    notes: nz(d.notes), photos: normalizePhotos(d.photos), vaccines: d.vaccines || {},
    care: d.care || {},
    pending: !!d.pending, cut_request: nz(d.cutRequest),
    updated_at: nz(d.updatedAt),
  };
}

// ---------------- Clients ----------------
//
// The `clients` table is the source of truth for owner data. The dogs table
// keeps owner_first / owner_last / phone as a PROJECTION of the linked client,
// so that every existing read site (dog cards, owner sort, printed sheet and
// receipt, the visit picker, the kiosk search) keeps working untouched.
//
// Invariant: when dog.clientId is set, dog.ownerFirst/ownerLast/phone equal the
// client's. When it is empty, those fields are the legacy free text AND are the
// source of truth — that's what keeps dogs registered on the entrance tablet,
// and everything from before the migration, displaying correctly.
//
// Only this module may write that projection, and it does so in exactly three
// places: upsertDog (derives from the client), upsertClient (fans out to the
// linked dogs) and hydrateDogOwners (on load).

function rowToClient(r) {
  return {
    id: r.id, firstName: r.first_name || '', lastName: r.last_name || '',
    phone: r.phone || '', notes: r.notes || '', updatedAt: r.updated_at || '',
  };
}
function clientToRow(c) {
  return {
    id: c.id, first_name: nz(c.firstName), last_name: nz(c.lastName),
    phone: nz(c.phone), notes: nz(c.notes), updated_at: nz(c.updatedAt),
  };
}

/** Display name of a client, e.g. "María López". */
export function clientName(c) {
  if (!c) return '';
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
}

/**
 * The identity of a client, for "is this the same person?" decisions.
 *
 * Lowercased, accent-stripped, whitespace-collapsed name plus the normalized
 * phone. Exported because three different features need to agree on it — the
 * owner backfill, approving a dog from the entrance tablet, and creating a
 * client from the dog form. Three separate implementations is exactly how you
 * end up with "maría lópez" and "maria lopez" as two different clients.
 *
 * The phone is part of the key on purpose: two dogs that carry the same owner
 * name but different phone numbers are two contacts, and collapsing them would
 * silently throw one of the numbers away.
 */
export function clientKey(firstName, lastName, phone) {
  const name = `${firstName || ''} ${lastName || ''}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  return `${name}|${normalizePhone(phone || '')}`;
}

function rowToEmployee(r) {
  return {
    id: r.id, fullName: r.full_name || '', role: r.role || '',
    phone: r.phone || '', active: r.active !== false, notes: r.notes || '',
  };
}
function employeeToRow(e) {
  return {
    id: e.id, full_name: e.fullName, role: nz(e.role), phone: nz(e.phone),
    active: e.active !== false, notes: nz(e.notes),
  };
}

// A "visit" (walk-in): dog arrives (date + time = arrival), gets a service, and
// leaves (timeOut = departure). Stored in the `appointments` table for
// continuity with existing data; `time_out` and `price` are the new columns.
function rowToAppt(r) {
  return {
    id: r.id, dogId: r.dog_id, date: r.date || '', time: r.time || '',
    timeOut: r.time_out || '', price: r.price || '',
    employeeId: r.employee_id || '', services: r.services || {}, createdAt: r.created_at || '',
  };
}
function apptToRow(a) {
  return {
    id: a.id, dog_id: a.dogId, date: nz(a.date), time: nz(a.time),
    time_out: nz(a.timeOut), price: nz(a.price),
    employee_id: nz(a.employeeId), services: a.services || {}, created_at: nz(a.createdAt),
  };
}

function rowToVax(r) { return { id: r.id, name: r.name, months: r.months }; }
function vaxToRow(v) { return { id: v.id, name: v.name, months: v.months }; }

// ---------------- Store ----------------
export const store = {
  data: {
    settings: loadSettings(),
    vaccineCatalog: [],
    dogs: [],
    employees: [],
    appointments: [],
    clients: [],
  },

  // Fetch every table into memory. Call once after login.
  async init() {
    const [dg, em, ap, vc, cl] = await Promise.all([
      sb.from('dogs').select('*'),
      sb.from('employees').select('*'),
      sb.from('appointments').select('*'),
      sb.from('vaccine_catalog').select('*'),
      sb.from('clients').select('*'),
    ]);
    const err = dg.error || em.error || ap.error || vc.error;
    if (err) { console.error('Store init failed', err); throw err; }
    this.data.dogs = (dg.data || []).map(rowToDog);
    this.data.employees = (em.data || []).map(rowToEmployee);
    this.data.appointments = (ap.data || []).map(rowToAppt);
    this.data.vaccineCatalog = (vc.data || []).map(rowToVax);

    // The clients table is deliberately NOT part of the `err` check above: if
    // it doesn't exist yet (the SQL migration hasn't been run), the app must
    // degrade to exactly its previous behaviour instead of refusing to load.
    // In that case every dog keeps its own owner text and nothing is hydrated.
    if (cl.error) {
      console.warn('Clients table unavailable — owner data stays per-dog', cl.error);
      this.data.clients = [];
      return;
    }
    this.data.clients = (cl.data || []).map(rowToClient);

    // Materialize the owner projection. This lives INSIDE init() on purpose:
    // init() has four callers (boot, the refresh button, the local migration
    // and a backup restore) and doing it here covers all of them.
    this.hydrateDogOwners();
  },

  /** Copy each linked client's name + phone onto its dogs (the projection). */
  hydrateDogOwners() {
    if (!this.data.clients.length) return;
    const byId = new Map(this.data.clients.map((c) => [c.id, c]));
    this.data.dogs.forEach((d) => {
      const c = d.clientId ? byId.get(d.clientId) : null;
      if (!c) return; // no client -> the dog's own fields stay authoritative
      d.ownerFirst = c.firstName;
      d.ownerLast = c.lastName;
      d.phone = c.phone;
    });
  },

  // ---- generic helpers ----
  uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  },

  // Upload one array of (possibly base64) photos, returning https URLs.
  async _uploadPhotoArray(dogId, arr) {
    const out = [];
    for (const p of (arr || [])) {
      if (typeof p !== 'string') continue;
      if (p.startsWith('data:')) {
        const blob = await (await fetch(p)).blob();
        const mime = blob.type || 'image/jpeg';
        const path = `${dogId}/${uniqueName()}.${extForMime(mime)}`;
        const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        out.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      } else {
        out.push(p); // already an https URL
      }
    }
    return out;
  },

  // Upload any base64 photos in the list, replacing them with URLs.
  // NOTE: _uploadPhotoArray above (the actual upload) is intentionally untouched.
  async _uploadNewPhotos(dog) {
    const photos = normalizePhotos(dog.photos);
    photos.list = await this._uploadPhotoArray(dog.id, photos.list);
    dog.photos = photos;
  },

  // ---- dogs ----
  getDog(id) { return this.data.dogs.find((d) => d.id === id); },
  async upsertDog(dog) {
    dog.updatedAt = new Date().toISOString(); // any save counts as a modification
    // Derive the owner projection HERE, not in the callers. Every save site
    // builds a fresh dog object literal (the dog form, the kiosk form), so a
    // caller that forgot to carry the owner fields over would otherwise write
    // NULL on top of them and silently blank the owner out of the dog list,
    // the owner sort, both printed documents and the visit picker.
    if (dog.clientId) {
      const c = this.getClient(dog.clientId);
      if (c) {
        dog.ownerFirst = c.firstName;
        dog.ownerLast = c.lastName;
        dog.phone = c.phone;
      } else {
        dog.clientId = ''; // client is gone: keep the text, drop the dead link
      }
    }
    try {
      await this._uploadNewPhotos(dog); // can fail on Storage upload (perms/network)
    } catch (e) {
      toast(t('save_failed') + (e && e.message ? ': ' + e.message : ''));
      throw e;
    }
    dog.photo = firstPhoto(dog.photos);
    const i = this.data.dogs.findIndex((d) => d.id === dog.id);
    if (i >= 0) this.data.dogs[i] = dog; else this.data.dogs.push(dog);
    const { error } = await sb.from('dogs').upsert(dogToRow(dog));
    if (error) { toast(t('save_failed') + ': ' + error.message); throw error; }
  },
  /** Dogs registered on the entrance tablet that the shop hasn't reviewed yet. */
  pendingDogs() {
    return this.data.dogs
      .filter((d) => d.pending)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)); // newest first
  },
  /** Dogs that belong in the normal list (everything except unreviewed ones). */
  approvedDogs() { return this.data.dogs.filter((d) => !d.pending); },

  /**
   * Clear the pending flag — the dog joins the normal list.
   *
   * This is also where a customer's registration becomes a real client. The
   * entrance tablet deliberately does NOT create clients itself: that would
   * let anyone at the door write straight into the shop's client list, which
   * is the very thing the pending review exists to prevent.
   */
  async approveDog(id) {
    const dog = this.getDog(id);
    if (!dog) return;

    // Resolve (or create) the client FIRST. A client with no dogs yet is
    // harmless and visible in the list; a dog pointing at a client row that
    // failed to insert is not.
    let client = null;
    if (!dog.clientId && (dog.ownerFirst || dog.ownerLast || dog.phone)) {
      client = await this.resolveClient(dog.ownerFirst, dog.ownerLast, dog.phone);
    }

    const prev = { pending: dog.pending, clientId: dog.clientId };
    dog.pending = false;
    const patch = { pending: false };
    if (client) {
      dog.clientId = client.id;
      patch.client_id = client.id;
    }

    const { error } = await sb.from('dogs').update(patch).eq('id', id);
    if (error) {
      dog.pending = prev.pending;
      dog.clientId = prev.clientId;
      toast(t('save_failed'));
      throw error;
    }
  },

  async deleteDog(id) {
    this.data.dogs = this.data.dogs.filter((d) => d.id !== id);
    this.data.appointments = this.data.appointments.filter((a) => a.dogId !== id);
    const { error } = await sb.from('dogs').delete().eq('id', id); // DB cascades appointments
    if (error) { toast(t('save_failed')); throw error; }
  },

  // ---- clients ----
  getClient(id) { return this.data.clients.find((c) => c.id === id); },
  clientsSorted() {
    return this.data.clients.slice()
      .sort((a, b) => clientName(a).localeCompare(clientName(b)));
  },
  /** The dogs of a client. Pending (unreviewed) dogs have no client yet. */
  dogsForClient(id) {
    return this.data.dogs
      .filter((d) => d.clientId === id)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Find the client matching this owner data, or create one. */
  async resolveClient(firstName, lastName, phone) {
    const key = clientKey(firstName, lastName, phone);
    const found = this.data.clients
      .find((c) => clientKey(c.firstName, c.lastName, c.phone) === key);
    if (found) return found;
    const client = {
      id: this.uid('cli'),
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      phone: (phone || '').trim(),
      notes: '',
    };
    await this.upsertClient(client);
    return client;
  },

  async upsertClient(client) {
    client.updatedAt = new Date().toISOString();
    const i = this.data.clients.findIndex((c) => c.id === client.id);
    if (i >= 0) this.data.clients[i] = client; else this.data.clients.push(client);

    const { error } = await sb.from('clients').upsert(clientToRow(client));
    if (error) { toast(t('save_failed') + ': ' + error.message); throw error; }

    // Fan the new name/phone out to every dog of this client — ONE statement,
    // never a loop. It is atomic server-side and costs a single round trip; a
    // loop that failed half way would leave memory and the database
    // disagreeing with nothing sensible to roll back to.
    const linked = this.data.dogs.filter((d) => d.clientId === client.id);
    if (!linked.length) return;
    linked.forEach((d) => {
      d.ownerFirst = client.firstName;
      d.ownerLast = client.lastName;
      d.phone = client.phone;
    });
    const { error: dogErr } = await sb.from('dogs')
      .update({
        owner_first: nz(client.firstName),
        owner_last: nz(client.lastName),
        phone: nz(client.phone),
      })
      .eq('client_id', client.id);
    if (dogErr) { toast(t('save_failed') + ': ' + dogErr.message); throw dogErr; }
  },

  async deleteClient(id) {
    // Memory first (like deleteEmployee) so the clients list and the dog cards
    // agree straight away.
    this.data.clients = this.data.clients.filter((c) => c.id !== id);
    const linked = this.data.dogs.filter((d) => d.clientId === id);
    linked.forEach((d) => { d.clientId = ''; d.ownerFirst = ''; d.ownerLast = ''; d.phone = ''; });

    // The owner text has to be cleared too, not just the link: `on delete set
    // null` only nulls client_id, which would leave dogs displaying an owner
    // that no longer exists AND make the backfill card reappear offering to
    // re-create the client that was just deleted. The caller's confirm dialog
    // says how many dogs this affects.
    if (linked.length) {
      const { error } = await sb.from('dogs')
        .update({ client_id: null, owner_first: null, owner_last: null, phone: null })
        .eq('client_id', id);
      if (error) { toast(t('save_failed')); throw error; }
    }
    const { error } = await sb.from('clients').delete().eq('id', id);
    if (error) { toast(t('save_failed')); throw error; }
  },

  /** Dogs that carry owner text but aren't linked to a client yet. */
  unlinkedOwnerDogs() {
    return this.data.dogs.filter((d) =>
      !d.clientId && !d.pending && (d.ownerFirst || d.ownerLast || d.phone));
  },
  needsClientBackfill() { return this.unlinkedOwnerDogs().length > 0; },

  /**
   * One-time migration: turn the owner text already typed on each dog into
   * real client rows. Groups by `clientKey`, so one person with three dogs
   * becomes a single client with three dogs linked to them.
   */
  async backfillClients(onProgress) {
    const dogs = this.unlinkedOwnerDogs();
    if (!dogs.length) return 0;

    const groups = new Map();
    dogs.forEach((d) => {
      const key = clientKey(d.ownerFirst, d.ownerLast, d.phone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    });

    let n = 0;
    const total = groups.size;
    for (const group of groups.values()) {
      const head = group[0];
      const client = await this.resolveClient(head.ownerFirst, head.ownerLast, head.phone);
      const ids = group.map((d) => d.id);
      group.forEach((d) => { d.clientId = client.id; });
      const { error } = await sb.from('dogs').update({ client_id: client.id }).in('id', ids);
      if (error) {
        group.forEach((d) => { d.clientId = ''; }); // roll the link back in memory
        toast(t('save_failed')); throw error;
      }
      n++;
      if (typeof onProgress === 'function') onProgress(n, total);
    }
    return n;
  },

  // ---- employees ----
  getEmployee(id) { return this.data.employees.find((e) => e.id === id); },
  activeEmployees() { return this.data.employees.filter((e) => e.active); },
  async upsertEmployee(emp) {
    const i = this.data.employees.findIndex((e) => e.id === emp.id);
    if (i >= 0) this.data.employees[i] = emp; else this.data.employees.push(emp);
    const { error } = await sb.from('employees').upsert(employeeToRow(emp));
    if (error) { toast(t('save_failed')); throw error; }
  },
  async deleteEmployee(id) {
    this.data.employees = this.data.employees.filter((e) => e.id !== id);
    this.data.dogs.forEach((d) => { if (d.employeeId === id) d.employeeId = ''; });
    this.data.appointments.forEach((a) => { if (a.employeeId === id) a.employeeId = ''; });
    const { error } = await sb.from('employees').delete().eq('id', id); // dogs/appts FK set null
    if (error) { toast(t('save_failed')); throw error; }
  },

  // ---- appointments ----
  appointmentsForDog(dogId) {
    return this.data.appointments
      .filter((a) => a.dogId === dogId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  async upsertAppointment(appt) {
    const i = this.data.appointments.findIndex((a) => a.id === appt.id);
    if (i >= 0) this.data.appointments[i] = appt; else this.data.appointments.push(appt);
    const { error } = await sb.from('appointments').upsert(apptToRow(appt));
    if (error) { toast(t('save_failed')); throw error; }
  },
  async deleteAppointment(id) {
    this.data.appointments = this.data.appointments.filter((a) => a.id !== id);
    const { error } = await sb.from('appointments').delete().eq('id', id);
    if (error) { toast(t('save_failed')); throw error; }
  },

  // ---- vaccine catalog ----
  async upsertVaccine(vax) {
    const i = this.data.vaccineCatalog.findIndex((v) => v.id === vax.id);
    if (i >= 0) this.data.vaccineCatalog[i] = vax; else this.data.vaccineCatalog.push(vax);
    const { error } = await sb.from('vaccine_catalog').upsert(vaxToRow(vax));
    if (error) { toast(t('save_failed')); throw error; }
  },
  async deleteVaccine(id) {
    this.data.vaccineCatalog = this.data.vaccineCatalog.filter((v) => v.id !== id);
    const affected = this.data.dogs.filter((d) => d.vaccines && d.vaccines[id]);
    affected.forEach((d) => { delete d.vaccines[id]; });
    const { error } = await sb.from('vaccine_catalog').delete().eq('id', id);
    if (error) { toast(t('save_failed')); throw error; }
    // clean the now-orphaned vaccine key from every affected dog row
    await Promise.all(affected.map((d) =>
      sb.from('dogs').update({ vaccines: d.vaccines }).eq('id', d.id)));
  },

  // ---- settings (device-local) ----
  setSetting(key, value) { this.data.settings[key] = value; saveSettings(this.data.settings); },

  // ---- backup / migration ----
  exportJSON() { return JSON.stringify(this.data, null, 2); },

  /** True when an old pre-Supabase localStorage database is still present. */
  hasLocalData() { return !!localStorage.getItem(OLD_KEY); },

  /** Push a full data object ({employees,vaccineCatalog,dogs,appointments}) to Supabase. */
  async pushAll(data, onProgress) {
    const employees = data.employees || [];
    const vax = data.vaccineCatalog || [];
    const dogs = data.dogs || [];
    const appts = data.appointments || [];
    // Missing on backups exported before clients existed — those restore fine,
    // and importJSON re-runs the owner backfill afterwards.
    const clients = data.clients || [];

    if (employees.length) {
      const { error } = await sb.from('employees').upsert(employees.map(employeeToRow));
      if (error) throw error;
    }
    if (vax.length) {
      const { error } = await sb.from('vaccine_catalog').upsert(vax.map(vaxToRow));
      if (error) throw error;
    }
    // Clients MUST go in before dogs: dogs.client_id references them, so the
    // other order makes Postgres reject every single dog row.
    if (clients.length) {
      const { error } = await sb.from('clients').upsert(clients.map(clientToRow));
      if (error) throw error;
    }
    let n = 0;
    for (const d of dogs) {
      const dog = { ...d };
      // Legacy local dogs stored a flat array (or a single `photo`).
      dog.photos = normalizePhotos(dog.photos);
      if (!dog.photos.list.length && d.photo) dog.photos.list = [d.photo];
      await this._uploadNewPhotos(dog);
      const { error } = await sb.from('dogs').upsert(dogToRow(dog));
      if (error) throw error;
      n++; if (typeof onProgress === 'function') onProgress(n, dogs.length);
    }
    if (appts.length) {
      const { error } = await sb.from('appointments').upsert(appts.map(apptToRow));
      if (error) throw error;
    }
  },

  /** One-time migration of the legacy localStorage database to Supabase. */
  async migrateLocalData(onProgress) {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    await this.pushAll(data, onProgress);
    if (data.settings) { this.data.settings = { ...this.data.settings, ...data.settings }; saveSettings(this.data.settings); }
    localStorage.setItem(OLD_KEY + '_migrated', raw); // keep a copy, then retire the active key
    localStorage.removeItem(OLD_KEY);
    await this.init();
    return true;
  },

  /** Restore from an exported backup file (writes to Supabase). */
  async importJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object' || !('dogs' in data)) throw new Error('Invalid backup structure');
    await this.pushAll(data);
    if (data.settings) { this.data.settings = { ...this.data.settings, ...data.settings }; saveSettings(this.data.settings); }
    await this.init();
    // A backup taken before clients existed brings dogs with owner text and no
    // client_id, which unlinks them from clients that are still in the
    // database. Re-link them so the invariant holds again instead of breaking
    // invisibly until someone next edits one of those clients.
    if (this.needsClientBackfill()) {
      try { await this.backfillClients(); } catch (e) { console.warn('Client re-link after restore failed', e); }
    }
  },

  // ---- stats ----
  stats() {
    return {
      dogs: this.data.dogs.length,
      clients: this.data.clients.length,
      employees: this.data.employees.length,
      appointments: this.data.appointments.length,
      photos: this.data.dogs.reduce((n, d) => n + normalizePhotos(d.photos).list.length, 0),
    };
  },
};
