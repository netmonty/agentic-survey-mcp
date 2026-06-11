import type { Question, AnswerValue } from './types';
import { visibleQuestionIds } from './logic';

export interface ValidationError {
  questionId: string;
  message: string;
}

/** Validate a submission against the survey definition before writing. */
export function validateSubmission(
  questions: Question[],
  answers: { questionId: string; value: AnswerValue }[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const byQ = new Map(answers.map((a) => [a.questionId, a.value]));

  // Skip-logic: a hidden question is neither required nor allowed to carry an
  // answer. Visibility is computed from the submitted answers themselves.
  const visible = visibleQuestionIds(questions, byQ);
  for (const q of questions) {
    if (!visible.has(q.id) && byQ.get(q.id) !== undefined)
      errors.push({ questionId: q.id, message: 'Answer submitted for a hidden question.' });
  }

  const wrongKind = (q: Question) =>
    errors.push({ questionId: q.id, message: `Expected a ${q.type} answer.` });

  for (const q of questions) {
    if (!visible.has(q.id)) continue; // hidden → not required, not validated
    const v = byQ.get(q.id);
    if (v === undefined) {
      if (q.required) errors.push({ questionId: q.id, message: 'This question is required.' });
      continue;
    }
    const cfg = q.config as any;
    switch (q.type) {
      case 'single_choice': {
        if (v.kind !== 'single_choice') { wrongKind(q); break; }
        const opts = cfg.options ?? [];
        if (!opts.some((o: any) => o.id === v.selection.optionId))
          errors.push({ questionId: q.id, message: 'Unknown option selected.' });
        break;
      }
      case 'multi_choice': {
        if (v.kind !== 'multi_choice') { wrongKind(q); break; }
        const opts = cfg.options ?? [];
        for (const s of v.selections)
          if (!opts.some((o: any) => o.id === s.optionId))
            errors.push({ questionId: q.id, message: 'Unknown option selected.' });
        if (cfg.min != null && v.selections.length < cfg.min)
          errors.push({ questionId: q.id, message: `Select at least ${cfg.min}.` });
        if (cfg.max != null && v.selections.length > cfg.max)
          errors.push({ questionId: q.id, message: `Select at most ${cfg.max}.` });
        break;
      }
      case 'rating':
      case 'number':
      case 'slider': {
        if (v.kind !== q.type) { wrongKind(q); break; }
        if (cfg.min != null && v.value < cfg.min)
          errors.push({ questionId: q.id, message: `Must be ≥ ${cfg.min}.` });
        if (cfg.max != null && v.value > cfg.max)
          errors.push({ questionId: q.id, message: `Must be ≤ ${cfg.max}.` });
        break;
      }
      case 'date':
      case 'time': {
        if (v.kind !== q.type) { wrongKind(q); break; }
        if (q.required && !v.value)
          errors.push({ questionId: q.id, message: 'This question is required.' });
        if (cfg.min != null && v.value && v.value < cfg.min)
          errors.push({ questionId: q.id, message: `Must be on or after ${cfg.min}.` });
        if (cfg.max != null && v.value && v.value > cfg.max)
          errors.push({ questionId: q.id, message: `Must be on or before ${cfg.max}.` });
        break;
      }
      case 'yes_no':
        if (v.kind !== 'yes_no') wrongKind(q);
        break;
      case 'short_text':
      case 'long_text': {
        if (v.kind !== q.type) { wrongKind(q); break; }
        if (q.required && !v.text.trim())
          errors.push({ questionId: q.id, message: 'This question is required.' });
        if (cfg.maxLength && v.text.length > cfg.maxLength)
          errors.push({ questionId: q.id, message: `Max ${cfg.maxLength} characters.` });
        break;
      }
    }
  }
  return errors;
}
