// store.js — single source of truth, persisted in localStorage
const KEY = 'sotos_dog_grooming_v1';

const DEFAULTS = () => ({
  version: 1,
  settings: { language: 'en', theme: 'light' },
  vaccineCatalog: [
    { id: 'vax_rabies', name: 'Rabies', months: 12 },
  ],
  dogs: [],
  employees: [],
  appointments: [],
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    // shallow-merge to survive schema additions
    const base = DEFAULTS();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      vaccineCatalog: parsed.vaccineCatalog || base.vaccineCatalog,
      dogs: parsed.dogs || [],
      employees: parsed.employees || [],
      appointments: parsed.appointments || [],
    };
  } catch (e) {
    console.warn('Store load failed, using defaults', e);
    return DEFAULTS();
  }
}

export const store = {
  data: load(),

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Store save failed (quota?)', e);
      alert('Storage full — could not save. Try removing some photos.');
    }
  },

  // ---- generic helpers ----
  uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  },

  // ---- dogs ----
  getDog(id) { return this.data.dogs.find((d) => d.id === id); },
  upsertDog(dog) {
    const i = this.data.dogs.findIndex((d) => d.id === dog.id);
    if (i >= 0) this.data.dogs[i] = dog; else this.data.dogs.push(dog);
    this.save();
  },
  deleteDog(id) {
    this.data.dogs = this.data.dogs.filter((d) => d.id !== id);
    this.data.appointments = this.data.appointments.filter((a) => a.dogId !== id);
    this.save();
  },

  // ---- employees ----
  getEmployee(id) { return this.data.employees.find((e) => e.id === id); },
  activeEmployees() { return this.data.employees.filter((e) => e.active); },
  upsertEmployee(emp) {
    const i = this.data.employees.findIndex((e) => e.id === emp.id);
    if (i >= 0) this.data.employees[i] = emp; else this.data.employees.push(emp);
    this.save();
  },
  deleteEmployee(id) {
    this.data.employees = this.data.employees.filter((e) => e.id !== id);
    this.save();
  },

  // ---- appointments ----
  appointmentsForDog(dogId) {
    return this.data.appointments
      .filter((a) => a.dogId === dogId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  upsertAppointment(appt) {
    const i = this.data.appointments.findIndex((a) => a.id === appt.id);
    if (i >= 0) this.data.appointments[i] = appt; else this.data.appointments.push(appt);
    this.save();
  },
  deleteAppointment(id) {
    this.data.appointments = this.data.appointments.filter((a) => a.id !== id);
    this.save();
  },

  // ---- vaccine catalog ----
  upsertVaccine(vax) {
    const i = this.data.vaccineCatalog.findIndex((v) => v.id === vax.id);
    if (i >= 0) this.data.vaccineCatalog[i] = vax; else this.data.vaccineCatalog.push(vax);
    this.save();
  },
  deleteVaccine(id) {
    this.data.vaccineCatalog = this.data.vaccineCatalog.filter((v) => v.id !== id);
    // also clean dog records
    this.data.dogs.forEach((d) => { if (d.vaccines) delete d.vaccines[id]; });
    this.save();
  },

  // ---- settings ----
  setSetting(key, value) { this.data.settings[key] = value; this.save(); },

  // ---- backup ----
  exportJSON() { return JSON.stringify(this.data, null, 2); },
  importJSON(jsonStr) {
    const incoming = JSON.parse(jsonStr);
    if (!incoming || typeof incoming !== 'object' || !('dogs' in incoming)) {
      throw new Error('Invalid backup structure');
    }
    const base = DEFAULTS();
    this.data = {
      ...base,
      ...incoming,
      settings: { ...base.settings, ...(incoming.settings || {}) },
      vaccineCatalog: incoming.vaccineCatalog || base.vaccineCatalog,
      dogs: incoming.dogs || [],
      employees: incoming.employees || [],
      appointments: incoming.appointments || [],
    };
    this.save();
  },

  // ---- stats ----
  stats() {
    return {
      dogs: this.data.dogs.length,
      employees: this.data.employees.length,
      appointments: this.data.appointments.length,
      photos: this.data.dogs.reduce((n, d) => n + (Array.isArray(d.photos) ? d.photos.length : (d.photo ? 1 : 0)), 0),
      bytes: new Blob([this.exportJSON()]).size,
    };
  },
};
