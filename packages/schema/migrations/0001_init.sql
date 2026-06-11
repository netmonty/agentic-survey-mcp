-- Agentic Survey MCP — initial schema migration
--
-- Runs into the USER'S OWN Supabase project (public schema).
-- Idempotent: safe to re-run against a fresh project.
--
-- Tables: surveys -> questions, responses -> answers.
-- Options for choice questions live inside questions.config (jsonb), each as
-- { "id": "...", "label": "..." }. A choice answer stores BOTH the stable id
-- and a label snapshot (see answers.value), so exports stay human-readable and
-- aggregation stays rename-proof.
--
-- RLS: the user's secret key (service_role-equivalent) bypasses RLS and is used
-- by the MCP server. The public path (page-service, publishable key / anon role)
-- is constrained to: read only PUBLISHED surveys + questions, and INSERT
-- responses/answers — never read responses or drafts.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.surveys (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  status       text not null default 'draft'
                 check (status in ('draft', 'published', 'closed')),
  config       jsonb not null default '{}'::jsonb,  -- branding/theme + settings
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references public.surveys(id) on delete cascade,
  position   integer not null,
  type       text not null
               check (type in (
                 'single_choice', 'multi_choice', 'short_text',
                 'long_text', 'rating', 'yes_no', 'number'
               )),
  prompt     text not null,
  required   boolean not null default false,
  config     jsonb not null default '{}'::jsonb,  -- options, scale bounds, validation
  logic      jsonb                                -- nullable; branching rules (v2)
);

create table if not exists public.responses (
  id              uuid primary key default gen_random_uuid(),
  survey_id       uuid not null references public.surveys(id) on delete cascade,
  submitted_at    timestamptz not null default now(),
  respondent_meta jsonb not null default '{}'::jsonb  -- anonymous by default; no PII
);

create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  value       jsonb not null  -- typed by question type (see schema package types)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists questions_survey_position_idx
  on public.questions (survey_id, position);
create index if not exists responses_survey_submitted_idx
  on public.responses (survey_id, submitted_at);
create index if not exists answers_response_idx
  on public.answers (response_id);
create index if not exists answers_question_idx   -- supports get_results aggregation
  on public.answers (question_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.survey_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists surveys_set_updated_at on public.surveys;
create trigger surveys_set_updated_at
  before update on public.surveys
  for each row execute function public.survey_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- NOTE: policies target the `anon` role (the publishable key under the new
-- Supabase key model). Verify scoping in the spike before relying on it.
-- The secret key bypasses RLS, so the MCP server is unaffected by these.
-- ---------------------------------------------------------------------------

alter table public.surveys   enable row level security;
alter table public.questions enable row level security;
alter table public.responses enable row level security;
alter table public.answers   enable row level security;

-- Surveys: public can read ONLY published surveys.
drop policy if exists surveys_public_read on public.surveys;
create policy surveys_public_read
  on public.surveys for select
  to anon
  using (status = 'published');

-- Questions: public can read questions of published surveys only.
drop policy if exists questions_public_read on public.questions;
create policy questions_public_read
  on public.questions for select
  to anon
  using (exists (
    select 1 from public.surveys s
    where s.id = questions.survey_id and s.status = 'published'
  ));

-- Responses: public can INSERT only, and only against a published survey.
-- No SELECT policy => public cannot read responses at all.
drop policy if exists responses_public_insert on public.responses;
create policy responses_public_insert
  on public.responses for insert
  to anon
  with check (exists (
    select 1 from public.surveys s
    where s.id = responses.survey_id and s.status = 'published'
  ));

-- Answers: public can INSERT only, and only attached to a response whose
-- survey is published. No SELECT policy.
drop policy if exists answers_public_insert on public.answers;
create policy answers_public_insert
  on public.answers for insert
  to anon
  with check (exists (
    select 1
    from public.responses r
    join public.surveys s on s.id = r.survey_id
    where r.id = answers.response_id and s.status = 'published'
  ));
