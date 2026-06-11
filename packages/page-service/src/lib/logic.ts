import type { Question, AnswerValue, LogicCondition } from './types';

/**
 * Skip-logic evaluation. Shared by the renderer (live show/hide) and submission
 * validation (so hidden required questions aren't required, and answers to
 * hidden questions are rejected). Pure — no I/O, no React.
 *
 * Conditions reference EARLIER questions only (enforced at authoring time by
 * `validateSurvey` in core), so a single pass in position order is enough and
 * cycles are impossible. A condition whose target question is itself hidden is
 * evaluated as if that question is unanswered.
 */

/** Test one condition against the answer to its target question. */
export function evalCondition(
  cond: LogicCondition,
  value: AnswerValue | undefined,
): boolean {
  if (cond.op === 'answered') return value !== undefined;
  if (cond.op === 'not_answered') return value === undefined;
  if (value === undefined) return false;

  switch (value.kind) {
    case 'single_choice': {
      const id = value.selection.optionId;
      if (cond.op === 'equals' || cond.op === 'includes') return id === cond.value;
      if (cond.op === 'not_equals') return id !== cond.value;
      return false;
    }
    case 'multi_choice': {
      const ids = value.selections.map((s) => s.optionId);
      if (cond.op === 'includes' || cond.op === 'equals') return ids.includes(cond.value as string);
      if (cond.op === 'not_equals') return !ids.includes(cond.value as string);
      return false;
    }
    case 'yes_no': {
      if (cond.op === 'equals') return value.value === cond.value;
      if (cond.op === 'not_equals') return value.value !== cond.value;
      return false;
    }
    case 'rating':
    case 'number':
    case 'slider': {
      const n = value.value;
      const target = cond.value;
      if (typeof target !== 'number') return false;
      switch (cond.op) {
        case 'equals':
          return n === target;
        case 'not_equals':
          return n !== target;
        case 'gt':
          return n > target;
        case 'gte':
          return n >= target;
        case 'lt':
          return n < target;
        case 'lte':
          return n <= target;
        default:
          return false;
      }
    }
    case 'short_text':
    case 'long_text': {
      if (cond.op === 'equals') return value.text === cond.value;
      if (cond.op === 'not_equals') return value.text !== cond.value;
      return false;
    }
    case 'date':
    case 'time': {
      // String compare works for ISO date / HH:MM ordering too.
      switch (cond.op) {
        case 'equals':
          return value.value === cond.value;
        case 'not_equals':
          return value.value !== cond.value;
        case 'gt':
          return value.value > String(cond.value);
        case 'gte':
          return value.value >= String(cond.value);
        case 'lt':
          return value.value < String(cond.value);
        case 'lte':
          return value.value <= String(cond.value);
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

/** Is a single question visible, given a lookup of effective (visible) answers? */
function isVisible(
  question: Question,
  getAnswer: (questionId: string) => AnswerValue | undefined,
): boolean {
  const logic = question.logic;
  if (!logic || !logic.conditions || logic.conditions.length === 0) return true;

  const results = logic.conditions.map((c) => evalCondition(c, getAnswer(c.questionId)));
  const matched = logic.match === 'any' ? results.some(Boolean) : results.every(Boolean);
  return logic.action === 'hide' ? !matched : matched;
}

/**
 * Compute the set of currently-visible question ids. Evaluates in position
 * order; an answer only counts toward a later condition if its own question is
 * visible.
 */
export function visibleQuestionIds(
  questions: Question[],
  answers: Map<string, AnswerValue | undefined>,
): Set<string> {
  const ordered = [...questions].sort((a, b) => a.position - b.position);
  const visible = new Set<string>();
  for (const q of ordered) {
    const vis = isVisible(q, (id) => (visible.has(id) ? answers.get(id) : undefined));
    if (vis) visible.add(q.id);
  }
  return visible;
}
