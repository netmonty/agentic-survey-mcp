import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, type Db } from './client.js';
import {
  createSurvey,
  updateSurvey,
  publishSurvey,
  closeSurvey,
  listSurveys,
  getSurvey,
} from './surveys.js';
import { addQuestion, updateQuestion, removeQuestion, reorderQuestions } from './questions.js';
import { getResults } from './results.js';
import { listResponses } from './responses.js';
import { isErr, type Result } from './result.js';

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

// Integration tests need a real Supabase project; skip cleanly without one.
const skip = !URL || !SECRET ? 'set SUPABASE_URL + SUPABASE_SECRET_KEY to run' : false;

function unwrap<T>(r: Result<T>): T {
  if (isErr(r)) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.data;
}

let db: Db;
const createdSurveyIds: string[] = [];

before(() => {
  if (skip) return;
  db = createDb(URL!, SECRET!);
});

// Tests manage (and clean up) their own data — no reliance on hand-seeded rows.
after(async () => {
  if (skip) return;
  for (const id of createdSurveyIds) {
    await db.from('surveys').delete().eq('id', id); // cascades to questions/responses/answers
  }
});

test('survey lifecycle: create → questions → publish → close', { skip }, async () => {
  const survey = unwrap(
    await createSurvey(db, { title: 'Core test survey', description: 'mixed types' }),
  );
  createdSurveyIds.push(survey.id);
  assert.equal(survey.status, 'draft');
  assert.equal(survey.title, 'Core test survey');

  const updated = unwrap(await updateSurvey(db, survey.id, { title: 'Renamed' }));
  assert.equal(updated.title, 'Renamed');

  const q1 = unwrap(
    await addQuestion(db, survey.id, {
      type: 'single_choice',
      prompt: 'Favourite colour?',
      required: true,
      config: {
        options: [
          { id: 'opt_red', label: 'Red' },
          { id: 'opt_green', label: 'Green' },
          { id: 'opt_blue', label: 'Blue' },
        ],
      },
    }),
  );
  assert.equal(q1.position, 0);

  const q2 = unwrap(
    await addQuestion(db, survey.id, {
      type: 'rating',
      prompt: 'How likely to recommend?',
      config: { min: 1, max: 5 },
    }),
  );
  assert.equal(q2.position, 1);

  const q3 = unwrap(
    await addQuestion(db, survey.id, { type: 'long_text', prompt: 'Any comments?' }),
  );

  // reorder: q3 first
  unwrap(await reorderQuestions(db, survey.id, [q3.id, q1.id, q2.id]));
  const reordered = unwrap(await getSurvey(db, survey.id));
  assert.deepEqual(
    reordered.questions.map((q) => q.id),
    [q3.id, q1.id, q2.id],
  );

  // update + remove a throwaway question
  const tmp = unwrap(await addQuestion(db, survey.id, { type: 'yes_no', prompt: 'temp?' }));
  const renamedQ = unwrap(await updateQuestion(db, tmp.id, { prompt: 'Subscribed?' }));
  assert.equal(renamedQ.prompt, 'Subscribed?');
  unwrap(await removeQuestion(db, tmp.id));

  const published = unwrap(await publishSurvey(db, survey.id));
  assert.equal(published.survey.status, 'published');
  assert.ok(published.survey.publishedAt);

  const drafts = unwrap(await listSurveys(db, { status: 'draft' }));
  assert.ok(!drafts.some((s) => s.id === survey.id));

  const closed = unwrap(await closeSurvey(db, survey.id));
  assert.equal(closed.status, 'closed');
});

test('publishSurvey builds a share URL when link config is supplied', { skip }, async () => {
  const survey = unwrap(await createSurvey(db, { title: 'Share link test' }));
  createdSurveyIds.push(survey.id);
  const published = unwrap(
    await publishSurvey(db, survey.id, {
      pageEndpoint: 'https://pages.example.com/',
      projectRef: 'abc123',
      publishableKey: 'sb_publishable_xyz',
    }),
  );
  assert.equal(
    published.shareUrl,
    `https://pages.example.com/s/abc123/${survey.id}#k=sb_publishable_xyz`,
  );
});

test('get_results: aggregates mixed question types + paginates raw', { skip }, async () => {
  const survey = unwrap(await createSurvey(db, { title: 'Results test' }));
  createdSurveyIds.push(survey.id);
  const colour = unwrap(
    await addQuestion(db, survey.id, {
      type: 'single_choice',
      prompt: 'Colour?',
      config: {
        options: [
          { id: 'opt_red', label: 'Red' },
          { id: 'opt_blue', label: 'Blue' },
        ],
      },
    }),
  );
  const rating = unwrap(
    await addQuestion(db, survey.id, { type: 'rating', prompt: 'Rate', config: { min: 1, max: 5 } }),
  );
  const comment = unwrap(
    await addQuestion(db, survey.id, { type: 'long_text', prompt: 'Comment' }),
  );
  unwrap(await publishSurvey(db, survey.id));

  // Seed 3 responses directly (secret key bypasses RLS).
  const seed = [
    { colour: { optionId: 'opt_red', label: 'Red' }, rating: 5, comment: 'great' },
    { colour: { optionId: 'opt_red', label: 'Red' }, rating: 3, comment: 'ok' },
    { colour: { optionId: 'opt_blue', label: 'Blue' }, rating: 4, comment: 'good' },
  ];
  for (const s of seed) {
    const { data: resp, error } = await db
      .from('responses')
      .insert({ survey_id: survey.id })
      .select('id')
      .single();
    assert.ifError(error);
    const { error: aErr } = await db.from('answers').insert([
      { response_id: resp!.id, question_id: colour.id, value: { kind: 'single_choice', selection: s.colour } },
      { response_id: resp!.id, question_id: rating.id, value: { kind: 'rating', value: s.rating } },
      { response_id: resp!.id, question_id: comment.id, value: { kind: 'long_text', text: s.comment } },
    ]);
    assert.ifError(aErr);
  }

  const results = unwrap(await getResults(db, survey.id));
  assert.equal(results.survey.responseCount, 3);
  assert.equal(results.survey.questionCount, 3);

  const colourAgg = results.questions.find((q) => q.id === colour.id)!.aggregate;
  assert.equal(colourAgg.kind, 'choice');
  if (colourAgg.kind === 'choice') {
    assert.equal(colourAgg.totalAnswered, 3);
    const red = colourAgg.options.find((o) => o.optionId === 'opt_red')!;
    assert.equal(red.count, 2);
    assert.equal(red.pct, 66.7);
  }

  const ratingAgg = results.questions.find((q) => q.id === rating.id)!.aggregate;
  assert.equal(ratingAgg.kind, 'numeric');
  if (ratingAgg.kind === 'numeric') {
    assert.equal(ratingAgg.mean, 4);
    assert.equal(ratingAgg.median, 4);
    assert.equal(ratingAgg.min, 3);
    assert.equal(ratingAgg.max, 5);
  }

  const commentAgg = results.questions.find((q) => q.id === comment.id)!.aggregate;
  assert.equal(commentAgg.kind, 'text');
  if (commentAgg.kind === 'text') {
    assert.equal(commentAgg.totalAnswered, 3);
    assert.deepEqual([...commentAgg.responses].sort(), ['good', 'great', 'ok']);
  }

  assert.equal(results.responses.length, 3);

  // pagination: limit 2 → a nextCursor, then the remaining 1
  const pg1 = unwrap(await listResponses(db, survey.id, { limit: 2 }));
  assert.equal(pg1.responses.length, 2);
  assert.ok(pg1.nextCursor);
  const pg2 = unwrap(await listResponses(db, survey.id, { limit: 2, cursor: pg1.nextCursor! }));
  assert.equal(pg2.responses.length, 1);
  assert.equal(pg2.nextCursor, null);
});
