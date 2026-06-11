/**
 * Read-side type contract for the page-service, mirroring the relevant parts of
 * `@agentic-survey/schema`. Kept local (not imported from the workspace package)
 * so the page-service builds standalone — it deploys as its own app and must not
 * depend on sibling packages being present in the build context.
 *
 * These mirror the Phase-0 locked contract; keep in sync with packages/schema.
 */

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

/** Branching / skip-logic — mirror of @agentic-survey/schema; keep in sync. */
export type LogicOp =
  | 'equals'
  | 'not_equals'
  | 'includes'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'answered'
  | 'not_answered';

export interface LogicCondition {
  questionId: string;
  op: LogicOp;
  value?: string | number | boolean;
}

export interface QuestionLogic {
  action: 'show' | 'hide';
  match: 'all' | 'any';
  conditions: LogicCondition[];
}

export interface Question {
  id: string;
  surveyId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  /** Per-type config (options, scale bounds, etc.) — read loosely at render. */
  config: Record<string, unknown>;
  /** Branching / skip-logic rules. `null`/absent = always shown. */
  logic?: QuestionLogic | null;
}

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
