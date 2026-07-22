# IAT Forms Portal

Internal forms portal for Innovative Air Technologies. A Typeform-inspired experience replacing Jotform.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres, Storage)
- **Resend** (transactional email)
- **Framer Motion** (step transitions)
- **jsPDF** (PDF downloads)
- **react-signature-canvas** (signature fields)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
RESEND_API_KEY=your_resend_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_PASSWORD=your_secure_password_here
```

### 3. Supabase setup

#### a) Run this SQL in the Supabase SQL editor:

```sql
-- Form categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Forms
create table forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id uuid references categories(id),
  slug text unique not null,
  is_active boolean default true,
  success_message text default 'Your submission has been received.',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Form fields
create table form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade,
  label text not null,
  field_type text not null,
  placeholder text,
  options jsonb,
  is_required boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Email notification rules
create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  send_on_submit boolean default true,
  email_subject text,
  created_at timestamptz default now()
);

-- Submissions
create table submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id),
  form_title text,
  data jsonb not null,
  submitted_at timestamptz default now(),
  is_read boolean default false
);

-- Enable RLS
alter table categories enable row level security;
alter table forms enable row level security;
alter table form_fields enable row level security;
alter table notification_rules enable row level security;
alter table submissions enable row level security;

-- Public read policies
create policy "Public read categories" on categories for select using (true);
create policy "Public read forms" on forms for select using (true);
create policy "Public read fields" on form_fields for select using (true);
create policy "Public insert submissions" on submissions for insert with check (true);

-- Service role full access
create policy "Service role all" on submissions for all using (true);
create policy "Service role forms" on forms for all using (true);
create policy "Service role fields" on form_fields for all using (true);
create policy "Service role notifications" on notification_rules for all using (true);
create policy "Service role categories" on categories for all using (true);

-- Seed categories
insert into categories (name, icon, sort_order) values
  ('HR & Time Off', 'clock', 1),
  ('QC & Production', 'clipboard-check', 2),
  ('Applications', 'user-plus', 3),
  ('Sales & External', 'send', 4),
  ('IT & Facilities', 'tool', 5);

-- Seed IT & Facilities Request form
do $$
declare
  cat_id uuid;
  form_id uuid;
begin
  select id into cat_id from categories where name = 'IT & Facilities';

  insert into forms (title, description, category_id, slug, success_message)
  values (
    'IT & Facilities Request',
    'Submit IT support tickets, equipment requests, software access, and facilities maintenance requests.',
    cat_id,
    'it-facilities-request',
    'Your request has been received. The IT & Facilities team will follow up within 1–2 business days.'
  )
  returning id into form_id;

  insert into form_fields (form_id, label, field_type, is_required, sort_order) values
    (form_id, 'Employee Name', 'text', true, 0),
    (form_id, 'Employee Email', 'email', true, 1);

  insert into form_fields (form_id, label, field_type, is_required, sort_order, options) values
    (form_id, 'Department', 'select', true, 2,
      '["Production", "Engineering", "Sales", "Shipping/Receiving", "Administration", "Management"]'::jsonb),
    (form_id, 'Request Type', 'select', true, 3,
      '["IT Support", "New Equipment", "Software Access", "Facilities/Maintenance", "Other"]'::jsonb),
    (form_id, 'Priority Level', 'radio', true, 4,
      '["Low - Can wait a few days", "Medium - Needed this week", "High - Urgent/Blocking work"]'::jsonb);

  insert into form_fields (form_id, label, field_type, is_required, sort_order) values
    (form_id, 'Request Title', 'text', true, 5),
    (form_id, 'Request Description', 'textarea', true, 6),
    (form_id, 'Preferred Completion Date', 'date', false, 7),
    (form_id, 'Supporting Files', 'file', false, 8),
    (form_id, 'Additional Notes', 'textarea', false, 9);

  insert into notification_rules (form_id, recipient_email, send_on_submit)
  values (form_id, 'placeholder@iatco.com', true);
end $$;
```

#### b) Create Storage bucket

In Supabase Dashboard → Storage → New bucket:
- Name: `form-uploads`
- Public: ✓ (enabled)

### 4. Run locally

```bash
npm run dev
```

Visit:
- Employee portal: http://localhost:3000
- Admin: http://localhost:3000/admin (password from `ADMIN_PASSWORD`)

---

## Deployment (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set all environment variables in the Vercel dashboard
4. Deploy — no extra config needed (`vercel.json` is already configured)

---

## App Structure

```
app/
  page.tsx                        → Employee portal homepage
  forms/[slug]/page.tsx           → Typeform-style form
  forms/[slug]/success/page.tsx   → Confirmation screen
  admin/
    page.tsx                      → Dashboard
    submissions/page.tsx          → All submissions
    submissions/[id]/page.tsx     → Submission detail + PDF download
    forms/page.tsx                → Form list
    forms/new/page.tsx            → Form builder
    forms/[id]/edit/page.tsx      → Edit form
components/
  FormRenderer.tsx                → Typeform-style step engine
  fields/                         → All field types
  admin/
    AdminSidebar.tsx
    FormBuilder.tsx               → Drag-and-drop builder
lib/
  supabase.ts                     → Public client + types
  supabase-admin.ts               → Service role client
  resend.ts                       → Email notifications
  pdf.ts                          → PDF generation
  utils.ts
```

## Admin Password

Set `ADMIN_PASSWORD` in your environment. The admin portal stores auth in an httpOnly cookie valid for 8 hours.
