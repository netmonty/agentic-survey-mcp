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
  | 'number'
  | 'date'
  | 'time'
  | 'slider';

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

/** Date question. Bounds are ISO `YYYY-MM-DD` strings. */
export interface DateConfig {
  min?: string;
  max?: string;
}

/** Time-of-day question, 24-hour. Bounds are `HH:MM` strings. */
export interface TimeConfig {
  min?: string;
  max?: string;
}

/** Slider. Defaults to a 0–100 percentage (step 1, unit "%"). */
export interface SliderConfig {
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
  | NumberConfig
  | DateConfig
  | TimeConfig
  | SliderConfig;

// ---------------------------------------------------------------------------
// Branching / skip logic (stored in questions.logic jsonb; null = always shown)
//
// A question's visibility is computed from conditions on EARLIER questions
// (lower position). Backward-only references keep evaluation single-pass and
// cycle-free. The same rules are evaluated by the page-service renderer (to
// show/hide live) and by submission validation (so a hidden required question
// isn't required, and answers to hidden questions are rejected).
// ---------------------------------------------------------------------------

export type LogicOp =
  | 'equals'
  | 'not_equals'
  | 'includes' // multi_choice contains the option / single_choice equals it
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'answered'
  | 'not_answered';

/** A single condition tested against the answer to `questionId`. */
export interface LogicCondition {
  /** The earlier question whose answer is tested. */
  questionId: string;
  op: LogicOp;
  /**
   * Comparison operand. Choice ops compare against an option `id` (string);
   * rating/number ops against a number; yes_no equality against a boolean.
   * Omitted for `answered` / `not_answered`.
   */
  value?: string | number | boolean;
}

export interface QuestionLogic {
  /**
   * `show`: the question is shown only when the conditions match (hidden
   * otherwise). `hide`: shown by default, hidden when the conditions match.
   */
  action: 'show' | 'hide';
  /** Combine conditions with AND (`all`) or OR (`any`). */
  match: 'all' | 'any';
  conditions: LogicCondition[];
}

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
  /** Branching / skip-logic rules. `null` = always shown. */
  logic: QuestionLogic | null;
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
  | { kind: 'number'; value: number }
  | { kind: 'date'; value: string } // ISO YYYY-MM-DD
  | { kind: 'time'; value: string } // 24-hour HH:MM
  | { kind: 'slider'; value: number };

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
