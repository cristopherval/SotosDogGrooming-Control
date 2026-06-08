# Supabase Setup — Soto's Dog Grooming

This app now stores all data in **Supabase** (online database + login + photo storage)
instead of the browser. Follow these one-time steps to connect it to your own
Supabase project. Takes ~10 minutes.

---

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → sign up / log in → **New project**.
2. Pick a name (e.g. `sotos-dog-grooming`), set a strong **database password** (save it somewhere safe), choose the region closest to you, and create the project.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Get your keys

1. In the project, open **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
3. Copy the **anon public** key (a long string).
4. Open `js/config.js` in this app and paste both values:
   ```js
   export const SUPABASE_URL = 'https://abcdxyz.supabase.co';
   export const SUPABASE_ANON_KEY = 'paste-the-anon-public-key-here';
   ```
   > The anon key is **safe to put in the app** — it only works for logged-in users because of the security rules below.

## 3. Create the database tables + security

1. In Supabase, open **SQL Editor** → **New query**.
2. Paste **all** of the SQL below and click **Run**.

```sql
-- Tables --------------------------------------------------------------
create table employees (
  id text primary key,
  full_name text not null,
  role text, phone text,
  active boolean default true,
  notes text
);

create table dogs (
  id text primary key,
  name text not null,
  breed text, color text, sex text,
  birthday date,
  owner_first text, owner_last text, phone text,
  employee_id text references employees(id) on delete set null,
  blade_head text, blade_body text, comb_head text, comb_body text,
  notes text, price text,
  photos jsonb default '{}'::jsonb,
  vaccines jsonb default '{}'::jsonb
);

create table appointments (
  id text primary key,
  dog_id text references dogs(id) on delete cascade,
  date date,
  time text,
  employee_id text references employees(id) on delete set null,
  services jsonb default '{}'::jsonb,
  created_at text
);

create table vaccine_catalog (
  id text primary key,
  name text not null,
  months integer default 12
);

insert into vaccine_catalog (id, name, months)
values ('vax_rabies', 'Rabies', 12) on conflict (id) do nothing;

-- Security (Row Level Security): only logged-in users can read/write -----
alter table dogs enable row level security;
alter table employees enable row level security;
alter table appointments enable row level security;
alter table vaccine_catalog enable row level security;

create policy "auth full access" on dogs            for all to authenticated using (true) with check (true);
create policy "auth full access" on employees       for all to authenticated using (true) with check (true);
create policy "auth full access" on appointments    for all to authenticated using (true) with check (true);
create policy "auth full access" on vaccine_catalog for all to authenticated using (true) with check (true);
```

> **Already created the tables in an earlier version?** Don't re-run the block
> above. Instead, just add the new **price** column (the three-section photos
> need no change — they reuse the existing `photos` column):
> ```sql
> alter table dogs add column if not exists price text;
> ```

## 4. Create the photo storage bucket

1. Open **Storage** → **New bucket**.
2. Name it exactly **`dog-photos`**.
3. Turn **Public bucket ON** → **Create bucket**.
   > Public means the photo URLs load directly in the app. Files have random,
   > unguessable names. Only logged-in users can *upload* or *delete* (next step).
4. Open **SQL Editor** → **New query**, paste and **Run**:

```sql
create policy "auth upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'dog-photos');
create policy "auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'dog-photos');
```

## 5. Create your shop login

1. Open **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the **email** and **password** the shop will use to log in. Tick
   **Auto Confirm User** so it works immediately. **Create user**.
3. (Recommended) Open **Authentication** → **Providers** → **Email** and turn
   **OFF** "Enable sign-ups", so only this one account can ever exist.

## 6. Run the app

The app must be served over `http://` or `https://` (opening the file directly
with `file://` will **not** work — ES modules and login are blocked there).

**Easiest (VS Code):** install the **Live Server** extension
(by Ritwick Dey), then right-click `index.html` → **Open with Live Server**.
It opens at something like `http://127.0.0.1:5500`.

**Alternative (if you have Node):**
```
npx serve
```

Then open the local URL it gives you and **sign in** with the account from step 5.

> Once it's running, you can also **Add to Home Screen** on your phone (open the
> hosted URL there) to install it as an app.

## 7. Move your existing data to the cloud (one time)

If you already used the app before (data saved in this browser):

1. Open the app **in that same browser** and sign in.
2. Go to **Settings**. If local data is found, you'll see an **"Upload to cloud"**
   button — tap it and wait (photos upload one by one).
3. When it finishes, your dogs, employees, appointments and photos are in Supabase.
   You can verify in the Supabase dashboard under **Table Editor** and **Storage**.

---

### Notes
- **Online-only:** the app needs an internet connection to load and save. The app
  screen itself still loads offline (cached), but data won't.
- **Multiple devices:** everyone who logs in with the shop account sees the same
  data. A device sees another's changes after a reload.
- **Backups:** Settings → *Export Backup* downloads a full JSON copy any time.
