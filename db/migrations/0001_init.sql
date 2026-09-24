-- Founders × Founders Week — office-hours applications.
--
-- Content (events, mentors, availability windows, appointment slots) lives in /content and is
-- referenced here by stable text ids. Applicant data lives only here and is read exclusively by
-- the server (organizer view) using the database owner / service role.

-- Also safe to paste into the Supabase SQL editor as-is: it records itself in schema_migrations.
create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Client-generated per form session; makes retries and double-clicks idempotent.
  idempotency_key uuid not null,
  status text not null default 'submitted',
  full_name text not null,
  email text not null,
  -- Lowercased/trimmed email used to detect duplicates and schedule conflicts for one student.
  email_normalized text not null,
  year text not null,
  major text not null,
  participation text not null,
  team_name text,
  teammates text,
  stage text not null,
  working_on text not null,
  question text not null,
  link_url text,
  availability_notes text,
  first_choice_mentor_id text not null,
  acknowledged_no_guarantee boolean not null,
  consent_to_share boolean not null,
  referrer_mentor_id text,
  organizer_notes text not null default '',
  -- HMAC of the submitter IP (never the raw IP); used only for rate limiting and abuse review.
  submitted_ip_hash text,
  user_agent text,
  constraint applications_idempotency_key_key unique (idempotency_key),
  constraint applications_status_check check (
    status in ('submitted', 'under_review', 'selected', 'waitlisted', 'confirmed', 'canceled', 'attended')
  ),
  constraint applications_participation_check check (participation in ('individual', 'team')),
  constraint applications_stage_check check (stage in ('exploring', 'idea', 'building', 'launched')),
  constraint applications_consent_check check (acknowledged_no_guarantee and consent_to_share),
  constraint applications_length_check check (
    char_length(full_name) between 1 and 100
    and char_length(email) between 3 and 254
    and char_length(major) between 1 and 100
    and char_length(coalesce(team_name, '')) <= 100
    and char_length(coalesce(teammates, '')) <= 400
    and char_length(working_on) between 1 and 1000
    and char_length(question) between 1 and 1000
    and char_length(coalesce(link_url, '')) <= 500
    and char_length(coalesce(availability_notes, '')) <= 400
    and char_length(organizer_notes) <= 5000
  )
);

create index if not exists applications_created_at_idx on applications (created_at desc);
create index if not exists applications_status_idx on applications (status);
create index if not exists applications_email_idx on applications (email_normalized);

-- Preferred mentors. rank 1 = first choice.
create table if not exists application_mentors (
  application_id uuid not null references applications (id) on delete cascade,
  mentor_id text not null,
  rank smallint not null check (rank >= 1),
  primary key (application_id, mentor_id),
  unique (application_id, rank)
);
create index if not exists application_mentors_mentor_idx on application_mentors (mentor_id);

-- Availability the student selected: a whole window, or a specific slot.
create table if not exists application_availability (
  application_id uuid not null references applications (id) on delete cascade,
  mentor_id text not null,
  option_kind text not null check (option_kind in ('window', 'slot')),
  option_id text not null,
  primary key (application_id, option_kind, option_id)
);
create index if not exists application_availability_option_idx on application_availability (option_kind, option_id);

-- An application assigned to an appointment slot.
--   proposed  = offered to the student, awaiting confirmation (holds a seat)
--   confirmed = confirmed with the student
--   canceled  = released (does not count toward capacity)
-- starts_at/ends_at snapshot the slot time so conflicts can be checked in SQL.
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  mentor_id text not null,
  slot_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null,
  constraint appointments_status_check check (status in ('proposed', 'confirmed', 'canceled')),
  constraint appointments_time_check check (ends_at > starts_at)
);
create unique index if not exists appointments_active_unique
  on appointments (application_id, slot_id) where status <> 'canceled';
create index if not exists appointments_slot_active_idx on appointments (slot_id) where status <> 'canceled';
create index if not exists appointments_application_idx on appointments (application_id);

-- Audit trail of organizer actions and submissions.
create table if not exists application_activity (
  id bigint generated always as identity primary key,
  application_id uuid not null references applications (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists application_activity_app_idx on application_activity (application_id, at desc);

-- Sliding-window rate limiting (application submissions, organizer sign-in).
create table if not exists rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup_idx on rate_limit_events (bucket, key_hash, at desc);

-- Defense in depth: nothing here is public. The server connects as the table owner / service
-- role (which bypasses RLS). With RLS enabled and no policies, any other role — e.g. Supabase's
-- `anon` and `authenticated` API roles — can read nothing.
alter table applications enable row level security;
alter table application_mentors enable row level security;
alter table application_availability enable row level security;
alter table appointments enable row level security;
alter table application_activity enable row level security;
alter table rate_limit_events enable row level security;
alter table schema_migrations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on applications, application_mentors, application_availability, appointments,
      application_activity, rate_limit_events, schema_migrations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on applications, application_mentors, application_availability, appointments,
      application_activity, rate_limit_events, schema_migrations from authenticated;
  end if;
  -- When installed in a dedicated schema (DATABASE_SCHEMA, e.g. inside an existing Supabase
  -- project), also shut the API roles out of the schema itself. `public` is left untouched so a
  -- shared project's other app keeps working.
  if current_schema() <> 'public' then
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on schema %I from anon', current_schema());
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on schema %I from authenticated', current_schema());
    end if;
  end if;
end
$$;

insert into schema_migrations (version) values ('0001_init') on conflict (version) do nothing;
