import type { Question, QuestionType, QuestionConfig } from '@agentic-survey/schema';
import type { Db } from './client.js';
import { ok, err, fromThrown, type Result } from './result.js';
import { toQuestion } from './mappers.js';

export async function addQuestion(
  db: Db,
  surveyId: string,
  input: {
    type: QuestionType;
    prompt: string;
    required?: boolean;
    config?: QuestionConfig;
    position?: number;
  },
): Promise<Result<Question>> {
  try {
    let position = input.position;
    if (position === undefined) {
      // Append: one past the current max position for this survey.
      const { data, error } = await db
        .from('questions')
        .select('position')
        .eq('survey_id', surveyId)
        .order('position', { ascending: false })
        .limit(1);
      if (error) return err('add_question_failed', error.message);
      position = data && data.length > 0 ? data[0].position + 1 : 0;
    }
    const { data, error } = await db
      .from('questions')
      .insert({
        survey_id: surveyId,
        type: input.type,
        prompt: input.prompt,
        required: input.required ?? false,
        config: input.config ?? {},
        position,
      })
      .select()
      .single();
    if (error) return err('add_question_failed', error.message);
    return ok(toQuestion(data));
  } catch (e) {
    return fromThrown('add_question_failed', e);
  }
}

export async function updateQuestion(
  db: Db,
  questionId: string,
  patch: {
    type?: QuestionType;
    prompt?: string;
    required?: boolean;
    config?: QuestionConfig;
    position?: number;
  },
): Promise<Result<Question>> {
  try {
    const row: Record<string, unknown> = {};
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.prompt !== undefined) row.prompt = patch.prompt;
    if (patch.required !== undefined) row.required = patch.required;
    if (patch.config !== undefined) row.config = patch.config;
    if (patch.position !== undefined) row.position = patch.position;
    const { data, error } = await db
      .from('questions')
      .update(row)
      .eq('id', questionId)
      .select()
      .single();
    if (error) return err('update_question_failed', error.message);
    return ok(toQuestion(data));
  } catch (e) {
    return fromThrown('update_question_failed', e);
  }
}

export async function removeQuestion(db: Db, questionId: string): Promise<Result<void>> {
  try {
    const { error } = await db.from('questions').delete().eq('id', questionId);
    if (error) return err('remove_question_failed', error.message);
    return ok(undefined);
  } catch (e) {
    return fromThrown('remove_question_failed', e);
  }
}

/**
 * Reorder a survey's questions to match `orderedIds`. Positions become the
 * index in the array. Done sequentially; there's no unique constraint on
 * position, so intermediate states are fine.
 */
export async function reorderQuestions(
  db: Db,
  surveyId: string,
  orderedIds: string[],
): Promise<Result<void>> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await db
        .from('questions')
        .update({ position: i })
        .eq('id', orderedIds[i])
        .eq('survey_id', surveyId);
      if (error) return err('reorder_questions_failed', error.message);
    }
    return ok(undefined);
  } catch (e) {
    return fromThrown('reorder_questions_failed', e);
  }
}
