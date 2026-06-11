import type {
  Question,
  AnswerValue,
  GetResultsPayload,
  QuestionAggregate,
  ChoiceAggregate,
  NumericAggregate,
  TextAggregate,
} from '@agentic-survey/schema';
import type { Db } from './client.js';
import { ok, err, isErr, fromThrown, type Result } from './result.js';
import { getSurvey } from './surveys.js';
import { listResponses } from './responses.js';

const pct = (count: number, total: number): number =>
  total ? Math.round((count / total) * 1000) / 10 : 0;

function choiceAggregate(q: Question, values: AnswerValue[]): ChoiceAggregate {
  const opts = ((q.config as any).options ?? []) as { id: string; label: string }[];
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const o of opts) {
    counts.set(o.id, 0);
    labels.set(o.id, o.label);
  }
  let totalAnswered = 0;
  const bump = (sel: { optionId: string; label: string }) => {
    counts.set(sel.optionId, (counts.get(sel.optionId) ?? 0) + 1);
    if (!labels.has(sel.optionId)) labels.set(sel.optionId, sel.label);
  };
  for (const v of values) {
    if (v.kind === 'single_choice') {
      totalAnswered++;
      bump(v.selection);
    } else if (v.kind === 'multi_choice') {
      totalAnswered++;
      for (const s of v.selections) bump(s);
    }
  }
  const options = [...counts.entries()].map(([optionId, count]) => ({
    optionId,
    label: labels.get(optionId) ?? optionId,
    count,
    pct: pct(count, totalAnswered),
  }));
  return { kind: 'choice', options, totalAnswered };
}

function yesNoAggregate(values: AnswerValue[]): ChoiceAggregate {
  let yes = 0;
  let no = 0;
  let total = 0;
  for (const v of values) {
    if (v.kind === 'yes_no') {
      total++;
      if (v.value) yes++;
      else no++;
    }
  }
  return {
    kind: 'choice',
    totalAnswered: total,
    options: [
      { optionId: 'yes', label: 'Yes', count: yes, pct: pct(yes, total) },
      { optionId: 'no', label: 'No', count: no, pct: pct(no, total) },
    ],
  };
}

function numericAggregate(values: AnswerValue[]): NumericAggregate {
  const nums: number[] = [];
  for (const v of values)
    if (v.kind === 'rating' || v.kind === 'number' || v.kind === 'slider') nums.push(v.value);
  const totalAnswered = nums.length;
  if (!totalAnswered) {
    return { kind: 'numeric', mean: null, median: null, min: null, max: null, distribution: [], totalAnswered: 0 };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const distMap = new Map<number, number>();
  for (const n of nums) distMap.set(n, (distMap.get(n) ?? 0) + 1);
  const distribution = [...distMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, count]) => ({ bucket: String(bucket), count }));
  return {
    kind: 'numeric',
    mean: Math.round((sum / totalAnswered) * 100) / 100,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    distribution,
    totalAnswered,
  };
}

function textAggregate(values: AnswerValue[]): TextAggregate {
  const responses: string[] = [];
  for (const v of values) {
    if (v.kind === 'short_text' || v.kind === 'long_text') responses.push(v.text);
    else if (v.kind === 'date' || v.kind === 'time') responses.push(v.value);
  }
  return { kind: 'text', totalAnswered: responses.length, responses };
}

function aggregateQuestion(q: Question, values: AnswerValue[]): QuestionAggregate {
  switch (q.type) {
    case 'single_choice':
    case 'multi_choice':
      return choiceAggregate(q, values);
    case 'yes_no':
      return yesNoAggregate(values);
    case 'rating':
    case 'number':
    case 'slider':
      return numericAggregate(values);
    case 'short_text':
    case 'long_text':
    case 'date':
    case 'time':
      return textAggregate(values);
  }
}

/**
 * Aggregates (over ALL responses) + a page of raw responses. Cheap arithmetic
 * is done here so the consumer agent doesn't burn tokens on it; text answers
 * are handed back raw for the agent to theme.
 */
export async function getResults(
  db: Db,
  surveyId: string,
  opts: { responsesLimit?: number; cursor?: string } = {},
): Promise<Result<GetResultsPayload>> {
  try {
    const sv = await getSurvey(db, surveyId);
    if (isErr(sv)) return sv;
    const { survey, questions } = sv.data;

    const { count, error: cErr } = await db
      .from('responses')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', surveyId);
    if (cErr) return err('get_results_failed', cErr.message);
    const responseCount = count ?? 0;

    // All answers for the survey (joined via the response's survey_id).
    const { data: ansRows, error: aErr } = await db
      .from('answers')
      .select('question_id, value, responses!inner(survey_id)')
      .eq('responses.survey_id', surveyId);
    if (aErr) return err('get_results_failed', aErr.message);

    const byQuestion = new Map<string, AnswerValue[]>();
    for (const r of (ansRows ?? []) as any[]) {
      const arr = byQuestion.get(r.question_id) ?? [];
      arr.push(r.value as AnswerValue);
      byQuestion.set(r.question_id, arr);
    }

    const page = await listResponses(db, surveyId, {
      limit: opts.responsesLimit,
      cursor: opts.cursor,
    });
    if (isErr(page)) return page;

    return ok({
      survey: {
        id: survey.id,
        title: survey.title,
        status: survey.status,
        questionCount: questions.length,
        responseCount,
      },
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        aggregate: aggregateQuestion(q, byQuestion.get(q.id) ?? []),
      })),
      responses: page.data.responses.map((r) => ({
        id: r.id,
        submittedAt: r.submittedAt,
        answers: r.answers,
      })),
      pagination: { nextCursor: page.data.nextCursor },
    });
  } catch (e) {
    return fromThrown('get_results_failed', e);
  }
}
