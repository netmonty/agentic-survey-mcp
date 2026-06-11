import type { Survey, SurveyStatus, SurveyConfig, Question } from '@agentic-survey/schema';
import type { Db } from './client.js';
import { ok, err, fromThrown, type Result } from './result.js';
import { toSurvey, toQuestion } from './mappers.js';
import { buildShareUrl, type LinkConfig } from './sharelink.js';

export async function createSurvey(
  db: Db,
  input: { title: string; description?: string; config?: SurveyConfig },
): Promise<Result<Survey>> {
  try {
    const { data, error } = await db
      .from('surveys')
      .insert({
        title: input.title,
        description: input.description ?? null,
        config: input.config ?? {},
      })
      .select()
      .single();
    if (error) return err('create_survey_failed', error.message);
    return ok(toSurvey(data));
  } catch (e) {
    return fromThrown('create_survey_failed', e);
  }
}

export async function updateSurvey(
  db: Db,
  id: string,
  patch: { title?: string; description?: string | null; config?: SurveyConfig },
): Promise<Result<Survey>> {
  try {
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.config !== undefined) row.config = patch.config;
    const { data, error } = await db.from('surveys').update(row).eq('id', id).select().single();
    if (error) return err('update_survey_failed', error.message);
    return ok(toSurvey(data));
  } catch (e) {
    return fromThrown('update_survey_failed', e);
  }
}

export async function publishSurvey(
  db: Db,
  id: string,
  link?: LinkConfig,
): Promise<Result<{ survey: Survey; shareUrl?: string }>> {
  try {
    const { data, error } = await db
      .from('surveys')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return err('publish_survey_failed', error.message);
    const survey = toSurvey(data);
    return ok({ survey, shareUrl: link ? buildShareUrl(link, survey.id) : undefined });
  } catch (e) {
    return fromThrown('publish_survey_failed', e);
  }
}

export async function closeSurvey(db: Db, id: string): Promise<Result<Survey>> {
  try {
    const { data, error } = await db
      .from('surveys')
      .update({ status: 'closed' })
      .eq('id', id)
      .select()
      .single();
    if (error) return err('close_survey_failed', error.message);
    return ok(toSurvey(data));
  } catch (e) {
    return fromThrown('close_survey_failed', e);
  }
}

export async function listSurveys(
  db: Db,
  opts: { status?: SurveyStatus } = {},
): Promise<Result<Survey[]>> {
  try {
    let q = db.from('surveys').select().order('created_at', { ascending: false });
    if (opts.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) return err('list_surveys_failed', error.message);
    return ok((data ?? []).map(toSurvey));
  } catch (e) {
    return fromThrown('list_surveys_failed', e);
  }
}

export async function getSurvey(
  db: Db,
  id: string,
): Promise<Result<{ survey: Survey; questions: Question[] }>> {
  try {
    const { data: sRow, error: sErr } = await db.from('surveys').select().eq('id', id).single();
    if (sErr) return err('get_survey_failed', sErr.message);
    const { data: qRows, error: qErr } = await db
      .from('questions')
      .select()
      .eq('survey_id', id)
      .order('position', { ascending: true });
    if (qErr) return err('get_survey_failed', qErr.message);
    return ok({ survey: toSurvey(sRow), questions: (qRows ?? []).map(toQuestion) });
  } catch (e) {
    return fromThrown('get_survey_failed', e);
  }
}
