/**
 * Shared types for the Agentic Survey MCP data model.
 *
 * Imported by `core`, `mcp-server`, and `page-service` so the whole system
 * shares one definition. Keep this file framework-free.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type SurveyStatus = 'draft' | 'published' | 'closed';

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'short_text'
  | 'long_text'
  | 'rating'
  | 'yes_no'
  | 'number';

// ---------------------------------------------------------------------------
// Question configuration (stored in questions.config jsonb)
// ---------------------------------------------------------------------------

/** A selectable option. `id` is stable across edits; `label` is what's shown. */
export interface QuestionOption {
  id: string;
  label: string;
}

export interface SingleChoiceConfig {
  options: QuestionOption[];
  /** Presentation hint for the page-service renderer. */
  display?: 'radio' | 'dropdown';
}

export interface MultiChoiceConfig {
  options: QuestionOption[];
  /** Min/max selections the respondent must/can choose. */
  min?: number;
  max?: number;
}

export interface TextConfig {
  placeholder?: string;
  maxLength?: number;
}

export interface RatingConfig {
  min: number;
  max: number;
  step?: number;
  /** Optional endpoint labels, e.g. { min: "Poor", max: "Excellent" }. */
  labels?: { min?: string; max?: string };
}

export interface YesNoConfig {
  /** Optional custom labels; defaults to "Yes" / "No". */
  labels?: { yes?: string; no?: string };
}

export interface NumberConfig {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export type QuestionConfig =
  | SingleChoiceConfig
  | MultiChoiceConfig
  | TextConfig
  | RatingConfig
  | YesNoConfig
  | NumberConfig;

/** Survey-level branding/settings (stored in surveys.config jsonb). One theme for v1. */
export interface SurveyConfig {
  theme?: {
    brandColor?: string;
    logoUrl?: string;
    font?: string;
  };
  intro?: string;
  thankYou?: string;
}

// ---------------------------------------------------------------------------
// Row types (mirror the SQL tables)
// ---------------------------------------------------------------------------

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  config: SurveyConfig;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface Question {
  id: string;
  surveyId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  config: QuestionConfig;
  logic: unknown | null; // branching rules — v2
}

export interface Response {
  id: string;
  surveyId: string;
  submittedAt: string;
  respondentMeta: Record<string, unknown>;
}

export interface Answer {
  id: string;
  responseId: string;
  questionId: string;
  value: AnswerValue;
}

// ---------------------------------------------------------------------------
// Answer values (stored in answers.value jsonb, typed by question type)
//
// Choice answers carry BOTH the stable optionId and a label snapshot:
// rename-proof for aggregation, human-readable on raw export.
// ---------------------------------------------------------------------------

export interface ChoiceSelection {
  optionId: string;
  label: string;
}

export type AnswerValue =
  | { kind: 'single_choice'; selection: ChoiceSelection }
  | { kind: 'multi_choice'; selections: ChoiceSelection[] }
  | { kind: 'short_text'; text: string }
  | { kind: 'long_text'; text: string }
  | { kind: 'rating'; value: number }
  | { kind: 'yes_no'; value: boolean }
  | { kind: 'number'; value: number };

// ---------------------------------------------------------------------------
// get_results contract — what consumer agents depend on.
// Pre-computed aggregates (cheap arithmetic done server-side) + raw responses
// (paginated) for the agent to theme/analyse itself.
// ---------------------------------------------------------------------------

export interface ChoiceAggregate {
  kind: 'choice';
  options: { optionId: string; label: string; count: number; pct: number }[];
  totalAnswered: number;
}

export interface NumericAggregate {
  kind: 'numeric';
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  distribution: { bucket: string; count: number }[];
  totalAnswered: number;
}

export interface TextAggregate {
  kind: 'text';
  totalAnswered: number;
  responses: string[]; // raw text, for the agent to theme
}

export type QuestionAggregate = ChoiceAggregate | NumericAggregate | TextAggregate;

export interface GetResultsPayload {
  survey: {
    id: string;
    title: string;
    status: SurveyStatus;
    questionCount: number;
    responseCount: number;
  };
  questions: {
    id: string;
    type: QuestionType;
    prompt: string;
    aggregate: QuestionAggregate;
  }[];
  responses: {
    id: string;
    submittedAt: string;
    answers: { questionId: string; value: AnswerValue }[];
  }[];
  pagination?: { nextCursor: string | null };
}

// ---------------------------------------------------------------------------
// Typed error (functions return these rather than throwing across boundaries)
// ---------------------------------------------------------------------------

export interface ServiceError {
  error: { code: string; message: string };
}
