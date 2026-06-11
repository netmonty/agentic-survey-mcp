import type { Question, LogicCondition } from '@agentic-survey/schema';

/**
 * Static checks an agent should run before publishing — especially once skip
 * logic is involved. Pure and DB-free: operates on the survey's questions.
 *
 * Errors block a sensible publish (broken/cyclic logic); warnings flag likely
 * mistakes (e.g. a comparison op on a non-numeric question).
 */

export interface SurveyLintIssue {
  level: 'error' | 'warning';
  code: string;
  questionId?: string;
  message: string;
}

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);
const NUMERIC_TYPES = new Set(['rating', 'number', 'slider']);
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);
const CHOICE_OPS = new Set(['equals', 'not_equals', 'includes']);

function optionIds(q: Question): string[] {
  const opts = (q.config as { options?: { id: string }[] }).options ?? [];
  return opts.map((o) => o.id);
}

export function validateSurvey(questions: Question[]): SurveyLintIssue[] {
  const issues: SurveyLintIssue[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));

  // Structural: choice questions need options; option ids must be unique.
  for (const q of questions) {
    if (CHOICE_TYPES.has(q.type)) {
      const ids = optionIds(q);
      if (ids.length === 0)
        issues.push({ level: 'error', code: 'no_options', questionId: q.id, message: `${q.type} question "${q.prompt}" has no options.` });
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dupes.length)
        issues.push({ level: 'error', code: 'duplicate_option_id', questionId: q.id, message: `Duplicate option id(s): ${[...new Set(dupes)].join(', ')}.` });
    }
  }

  // Logic checks.
  for (const q of questions) {
    const logic = q.logic;
    if (!logic) continue;

    if (!logic.conditions || logic.conditions.length === 0) {
      issues.push({ level: 'warning', code: 'empty_logic', questionId: q.id, message: `Question "${q.prompt}" has a logic rule with no conditions (it has no effect).` });
      continue;
    }

    for (const c of logic.conditions) {
      const target = byId.get(c.questionId);
      if (!target) {
        issues.push({ level: 'error', code: 'dangling_reference', questionId: q.id, message: `Condition references unknown question id "${c.questionId}".` });
        continue;
      }
      if (target.id === q.id) {
        issues.push({ level: 'error', code: 'self_reference', questionId: q.id, message: `Question "${q.prompt}" references itself in its logic.` });
        continue;
      }
      if (target.position >= q.position) {
        issues.push({ level: 'error', code: 'forward_reference', questionId: q.id, message: `Condition references a later question ("${target.prompt}"). Conditions may only reference earlier questions.` });
      }
      checkOpCompatibility(q, target, c, issues);
    }
  }

  return issues;
}

function checkOpCompatibility(
  q: Question,
  target: Question,
  c: LogicCondition,
  issues: SurveyLintIssue[],
): void {
  if (c.op === 'answered' || c.op === 'not_answered') return;

  if (NUMERIC_OPS.has(c.op)) {
    if (!NUMERIC_TYPES.has(target.type))
      issues.push({ level: 'warning', code: 'op_type_mismatch', questionId: q.id, message: `Op "${c.op}" targets a ${target.type} question; expected rating/number.` });
    if (typeof c.value !== 'number')
      issues.push({ level: 'error', code: 'bad_operand', questionId: q.id, message: `Op "${c.op}" needs a numeric value.` });
    return;
  }

  // Choice equality against a choice question: operand must be a real option id.
  if (CHOICE_OPS.has(c.op) && CHOICE_TYPES.has(target.type)) {
    const ids = optionIds(target);
    if (typeof c.value !== 'string' || !ids.includes(c.value))
      issues.push({ level: 'error', code: 'unknown_option', questionId: q.id, message: `Condition value "${String(c.value)}" is not an option of "${target.prompt}" — this question can never become visible as written.` });
    return;
  }

  if (target.type === 'yes_no' && (c.op === 'equals' || c.op === 'not_equals') && typeof c.value !== 'boolean')
    issues.push({ level: 'warning', code: 'bad_operand', questionId: q.id, message: `yes_no comparison expects a boolean value.` });
}
