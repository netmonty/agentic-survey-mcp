import type { Question, AnswerValue } from './types';
import type { PublicClient } from './public-client';

export interface PublicSurvey {
  survey: { id: string; title: string; description: string | null; config: any };
  questions: Question[];
}

/**
 * Read a PUBLISHED survey for rendering. Returns null if it isn't published
 * (RLS hides drafts), so the page can 404 cleanly.
 */
export async function fetchPublishedSurvey(
  client: PublicClient,
  surveyId: string,
): Promise<PublicSurvey | null> {
  const { data: s } = await client
    .from('surveys')
    .select('id, title, description, config, status')
    .eq('id', surveyId)
    .eq('status', 'published')
    .maybeSingle();
  if (!s) return null;
  const { data: q } = await client
    .from('questions')
    .select('id, survey_id, position, type, prompt, required, config, logic')
    .eq('survey_id', surveyId)
    .order('position', { ascending: true });
  return {
    survey: { id: s.id, title: s.title, description: s.description ?? null, config: s.config ?? {} },
    questions: (q ?? []).map((row: any) => ({
      id: row.id,
      surveyId: row.survey_id,
      position: row.position,
      type: row.type,
      prompt: row.prompt,
      required: row.required,
      config: row.config ?? {},
      logic: row.logic ?? null,
    })),
  };
}

export interface SubmissionInput {
  surveyId: string;
  answers: { questionId: string; value: AnswerValue }[];
  respondentMeta?: Record<string, unknown>;
}

export type SubmitResult = { ok: true; responseId: string } | { ok: false; error: string };

/**
 * Write a submission via the publishable key. Uses CLIENT-GENERATED UUIDs and
 * NO `RETURNING` — the anon path has no SELECT policy on responses/answers, so
 * RETURNING would fail RLS (verified in the spike). supabase-js without
 * `.select()` sends Prefer: return=minimal, i.e. no RETURNING.
 */
export async function submitResponse(
  client: PublicClient,
  input: SubmissionInput,
): Promise<SubmitResult> {
  const responseId = crypto.randomUUID();
  const { error: rErr } = await client.from('responses').insert({
    id: responseId,
    survey_id: input.surveyId,
    respondent_meta: input.respondentMeta ?? {},
  });
  if (rErr) return { ok: false, error: rErr.message };

  if (input.answers.length > 0) {
    const rows = input.answers.map((a) => ({
      id: crypto.randomUUID(),
      response_id: responseId,
      question_id: a.questionId,
      value: a.value,
    }));
    const { error: aErr } = await client.from('answers').insert(rows);
    if (aErr) return { ok: false, error: aErr.message };
  }
  return { ok: true, responseId };
}
