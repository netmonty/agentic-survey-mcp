-- Agentic Survey MCP — migration 0002: add date / time / slider question types.
--
-- Upgrade path for projects already on 0001. Fresh installs get these from the
-- updated 0001 and can skip this file. Idempotent: drops and recreates the
-- questions.type check constraint to include the new types.

alter table public.questions
  drop constraint if exists questions_type_check;

alter table public.questions
  add constraint questions_type_check
  check (type in (
    'single_choice', 'multi_choice', 'short_text',
    'long_text', 'rating', 'yes_no', 'number',
    'date', 'time', 'slider'
  ));
