import type { AnswerValue } from '@agentic-survey/schema';
import type { Db } from './client.js';
import { ok, err, fromThrown, type Result } from './result.js';

export interface ResponseWithAnswers {
  id: string;
  submittedAt: string;
  respondentMeta: Record<string, unknown>;
  answers: { questionId: string; value: AnswerValue }[];
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function encodeCursor(c: { submittedAt: string; id: string }): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

function decodeCursor(s: string): { submittedAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
    if (typeof parsed?.submittedAt === 'string' && typeof parsed?.id === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Paginated raw responses (with their answers), keyset-ordered by
 * (submitted_at, id) so the agent can page through everything stably.
 */
export async function listResponses(
  db: Db,
  surveyId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<Result<{ responses: ResponseWithAnswers[]; nextCursor: string | null }>> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  try {
    let q = db
      .from('responses')
      .select('id, submitted_at, respondent_meta, answers(question_id, value)')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit + 1);
    if (opts.cursor) {
      const c = decodeCursor(opts.cursor);
      if (c) {
        q = q.or(
          `submitted_at.gt."${c.submittedAt}",and(submitted_at.eq."${c.submittedAt}",id.gt.${c.id})`,
        );
      }
    }
    const { data, error } = await q;
    if (error) return err('list_responses_failed', error.message);
    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const responses: ResponseWithAnswers[] = page.map((r: any) => ({
      id: r.id,
      submittedAt: r.submitted_at,
      respondentMeta: r.respondent_meta ?? {},
      answers: (r.answers ?? []).map((a: any) => ({ questionId: a.question_id, value: a.value })),
    }));
    const last: any = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor({ submittedAt: last.submitted_at, id: last.id }) : null;
    return ok({ responses, nextCursor });
  } catch (e) {
    return fromThrown('list_responses_failed', e);
  }
}
