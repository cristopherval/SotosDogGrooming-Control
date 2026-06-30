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
import { toast } from './utils.js';

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
export const PHOTO_CATS = ['before', 'after', 'details', 'carnet'];
const THUMB_CATS = ['before', 'after', 'details']; // carnet (vaccine card) is a document, not the dog's photo
export function normalizePhotos(raw) {
  const out = { before: [], after: [], details: [], carnet: [] };
  if (Array.isArray(raw)) { out.before = raw.slice(); return out; } // legacy flat array
  if (raw && typeof raw === 'object') {
    for (const c of PHOTO_CATS) if (Array.isArray(raw[c])) out[c] = raw[c];
  }
  return out;
}
/** First photo of the dog (excludes the vaccine card) for card/avatar thumbnails. */
export function firstPhoto(photos) {
  const p = normalizePhotos(photos);
  for (const c of THUMB_CATS) { if (p[c][0]) return p[c][0]; }
  return '';
}

function rowToDog(r) {
  const photos = normalizePhotos(r.photos);
  return {
    id: r.id, name: r.name || '', breed: r.breed || '', color: r.color || '',
    sex: r.sex || '', birthday: r.birthday || '',
    ownerFirst: r.owner_first || '', ownerLast: r.owner_last || '', phone: r.phone || '',
    employeeId: r.employee_id || '', price: r.price || '',
    bladeHead: r.blade_head || '', bladeBody: r.blade_body || '',
    combHead: r.comb_head || '', combBody: r.comb_body || '',
    notes: r.notes || '', photos, photo: firstPhoto(photos),
    vaccines: r.vaccines || {},
  };
}
function dogToRow(d) {
  return {
    id: d.id, name: d.name, breed: nz(d.breed), color: nz(d.color), sex: nz(d.sex),
    birthday: nz(d.birthday), owner_first: nz(d.ownerFirst), owner_last: nz(d.ownerLast),
    phone: nz(d.phone), employee_id: nz(d.employeeId), price: nz(d.price),
    blade_head: nz(d.bladeHead), blade_body: nz(d.bladeBody),
    comb_head: nz(d.combHead), comb_body: nz(d.combBody),
    notes: nz(d.notes), photos: normalizePhotos(d.photos), vaccines: d.vaccines || {},
  };
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

function rowToAppt(r) {
  return {
    id: r.id, dogId: r.dog_id, date: r.date || '', time: r.time || '',
    employeeId: r.employee_id || '', services: r.services || {}, createdAt: r.created_at || '',
  };
}
function apptToRow(a) {
  return {
    id: a.id, dog_id: a.dogId, date: nz(a.date), time: nz(a.time),
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
  },

  // Fetch every table into memory. Call once after login.
  async init() {
    const [dg, em, ap, vc] = await Promise.all([
      sb.from('dogs').select('*'),
      sb.from('employees').select('*'),
      sb.from('appointments').select('*'),
      sb.from('vaccine_catalog').select('*'),
    ]);
    const err = dg.error || em.error || ap.error || vc.error;
    if (err) { console.error('Store init failed', err); throw err; }
    this.data.dogs = (dg.data || []).map(rowToDog);
    this.data.employees = (em.data || []).map(rowToEmployee);
    this.data.appointments = (ap.data || []).map(rowToAppt);
    this.data.vaccineCatalog = (vc.data || []).map(rowToVax);
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
        const path = `${dogId}/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        out.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      } else {
        out.push(p); // already an https URL
      }
    }
    return out;
  },

  // Upload any base64 photos across all three sections, replacing them with URLs.
  async _uploadNewPhotos(dog) {
    const photos = normalizePhotos(dog.photos);
    for (const c of PHOTO_CATS) {
      photos[c] = await this._uploadPhotoArray(dog.id, photos[c]);
    }
    dog.photos = photos;
  },

  // ---- dogs ----
  getDog(id) { return this.data.dogs.find((d) => d.id === id); },
  async upsertDog(dog) {
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
  async deleteDog(id) {
    this.data.dogs = this.data.dogs.filter((d) => d.id !== id);
    this.data.appointments = this.data.appointments.filter((a) => a.dogId !== id);
    const { error } = await sb.from('dogs').delete().eq('id', id); // DB cascades appointments
    if (error) { toast(t('save_failed')); throw error; }
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

    if (employees.length) {
      const { error } = await sb.from('employees').upsert(employees.map(employeeToRow));
      if (error) throw error;
    }
    if (vax.length) {
      const { error } = await sb.from('vaccine_catalog').upsert(vax.map(vaxToRow));
      if (error) throw error;
    }
    let n = 0;
    for (const d of dogs) {
      const dog = { ...d };
      // Legacy local dogs stored a flat array (or single `photo`); fold into "before".
      dog.photos = normalizePhotos(dog.photos);
      if (!dog.photos.before.length && !dog.photos.after.length && !dog.photos.details.length && d.photo) {
        dog.photos.before = [d.photo];
      }
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
  },

  // ---- stats ----
  stats() {
    return {
      dogs: this.data.dogs.length,
      employees: this.data.employees.length,
      appointments: this.data.appointments.length,
      photos: this.data.dogs.reduce((n, d) => {
        const p = normalizePhotos(d.photos);
        return n + PHOTO_CATS.reduce((s, c) => s + p[c].length, 0);
      }, 0),
    };
  },
};
