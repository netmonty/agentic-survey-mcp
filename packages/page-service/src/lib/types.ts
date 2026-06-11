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
  | 'number';

export interface Question {
  id: string;
  surveyId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  required: boolean;
  /** Per-type config (options, scale bounds, etc.) — read loosely at render. */
  config: Record<string, unknown>;
  logic?: unknown | null;
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
  | { kind: 'number'; value: number };
