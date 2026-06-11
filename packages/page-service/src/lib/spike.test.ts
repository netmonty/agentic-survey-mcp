import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient } from './public-client.js';
import { fetchPublishedSurvey, submitResponse } from './survey.js';
import { validateSubmission } from './validation.js';

const SB_URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
const skip =
  !SB_URL || !SECRET || !PUBLISHABLE
    ? 'set SUPABASE_URL + SUPABASE_SECRET_KEY + SUPABASE_PUBLISHABLE_KEY to run'
    : false;

// Secret client: test fixtures + verification (bypasses RLS).
const secret = () => createClient(SB_URL!, SECRET!, { auth: { persistSession: false } });

let publishedId = '';
let draftId = '';
let questionId = '';
const option = { optionId: 'opt_a', label: 'Option A' };

before(async () => {
  if (skip) return;
  const db = secret();
  const pub = await db
    .from('surveys')
    .insert({ title: 'Page-service spike', status: 'published', published_at: new Date().toISOString() })
    .select('id')
    .single();
  publishedId = pub.data!.id;
  const q = await db
    .from('questions')
    .insert({
      survey_id: publishedId,
      position: 0,
      type: 'single_choice',
      prompt: 'Pick one',
      required: true,
      config: { options: [{ id: option.optionId, label: option.label }, { id: 'opt_b', label: 'Option B' }] },
    })
    .select('id')
    .single();
  questionId = q.data!.id;
  const draft = await db.from('surveys').insert({ title: 'Draft spike', status: 'draft' }).select('id').single();
  draftId = draft.data!.id;
});

after(async () => {
  if (skip) return;
  const db = secret();
  for (const id of [publishedId, draftId]) if (id) await db.from('surveys').delete().eq('id', id);
});

test('publishable key reads a published survey, hides drafts + responses', { skip }, async () => {
  const pub = createPublicClient(SB_URL!, PUBLISHABLE!);

  const got = await fetchPublishedSurvey(pub, publishedId);
  assert.ok(got, 'published survey should be readable');
  assert.equal(got!.survey.title, 'Page-service spike');
  assert.equal(got!.questions.length, 1);

  const draft = await fetchPublishedSurvey(pub, draftId);
  assert.equal(draft, null, 'draft must be hidden from the publishable key');

  // Cannot read responses at all (no SELECT policy → empty, not error).
  const { data: resp } = await pub.from('responses').select('id').eq('survey_id', publishedId);
  assert.deepEqual(resp ?? [], []);
});

test('validateSubmission catches a missing required answer', { skip }, async () => {
  const pub = createPublicClient(SB_URL!, PUBLISHABLE!);
  const { questions } = (await fetchPublishedSurvey(pub, publishedId))!;
  const errs = validateSubmission(questions, []);
  assert.equal(errs.length, 1);
  assert.equal(errs[0].questionId, questionId);
});

test('publishable key submits to published, is blocked on draft', { skip }, async () => {
  const pub = createPublicClient(SB_URL!, PUBLISHABLE!);

  const good = await submitResponse(pub, {
    surveyId: publishedId,
    answers: [{ questionId, value: { kind: 'single_choice', selection: option } }],
    respondentMeta: { source: 'spike' },
  });
  assert.equal(good.ok, true, good.ok ? '' : (good as any).error);

  const blocked = await submitResponse(pub, {
    surveyId: draftId,
    answers: [],
  });
  assert.equal(blocked.ok, false, 'submitting to a draft must be blocked by RLS');

  // Verify via the secret key that exactly one response + answer landed.
  const db = secret();
  const { count: respCount } = await db
    .from('responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', publishedId);
  assert.equal(respCount, 1);
  const { data: answers } = await db
    .from('answers')
    .select('value, responses!inner(survey_id)')
    .eq('responses.survey_id', publishedId);
  assert.equal(answers!.length, 1);
  assert.equal((answers![0].value as any).selection.optionId, 'opt_a');
});
