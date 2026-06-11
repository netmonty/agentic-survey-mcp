import type {
  Survey,
  Question,
  Response,
  Answer,
  SurveyConfig,
  QuestionConfig,
  AnswerValue,
} from '@agentic-survey/schema';

/* DB rows are snake_case; domain types are camelCase. Map at the boundary. */

export function toSurvey(row: any): Survey {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    config: (row.config ?? {}) as SurveyConfig,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? null,
  };
}

export function toQuestion(row: any): Question {
  return {
    id: row.id,
    surveyId: row.survey_id,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    required: row.required,
    config: (row.config ?? {}) as QuestionConfig,
    logic: row.logic ?? null,
  };
}

export function toResponse(row: any): Response {
  return {
    id: row.id,
    surveyId: row.survey_id,
    submittedAt: row.submitted_at,
    respondentMeta: (row.respondent_meta ?? {}) as Record<string, unknown>,
  };
}

export function toAnswer(row: any): Answer {
  return {
    id: row.id,
    responseId: row.response_id,
    questionId: row.question_id,
    value: row.value as AnswerValue,
  };
}
