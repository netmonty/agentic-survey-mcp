'use client';
import { useMemo, useState } from 'react';
import type { Question, AnswerValue } from '@data';
import { validateSubmission, visibleQuestionIds, type ValidationError } from '@data';
import { QuestionField } from '@/components/question-field';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface Props {
  projectRef: string;
  publishableKey: string;
  survey: { id: string; title: string; description: string | null; config: any };
  questions: Question[];
}

export function SurveyForm({ projectRef, publishableKey, survey, questions }: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const thankYou = survey.config?.thankYou as string | undefined;

  // Skip-logic: only show questions whose conditions are currently met.
  const visibleIds = useMemo(
    () => visibleQuestionIds(questions, new Map(Object.entries(answers))),
    [answers, questions],
  );
  const visibleQuestions = useMemo(
    () => questions.filter((q) => visibleIds.has(q.id)),
    [questions, visibleIds],
  );
  const answeredCount = visibleQuestions.filter((q) => answers[q.id] !== undefined).length;
  const progress = visibleQuestions.length
    ? Math.round((answeredCount / visibleQuestions.length) * 100)
    : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const list = visibleQuestions
      .map((q) => ({ questionId: q.id, value: answers[q.id] }))
      .filter((a): a is { questionId: string; value: AnswerValue } => a.value !== undefined);
    const validation: ValidationError[] = validateSubmission(questions, list);
    if (validation.length) {
      setErrors(Object.fromEntries(validation.map((v) => [v.questionId, v.message])));
      document.getElementById(validation[0].questionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: projectRef, key: publishableKey, surveyId: survey.id, answers: list }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data?.error ?? `Submission failed (${res.status}).`);
        return;
      }
      setDone(true);
    } catch {
      setFormError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="survey-card animate-fade-up rounded-2xl border border-border bg-card px-8 py-16 text-center shadow-card">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-7 w-7 text-primary" strokeWidth={2.5} />
        </div>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {thankYou ?? 'Thank you'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
          Your response has been recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="survey-card rounded-2xl border border-border bg-card shadow-card">
      {/* header */}
      <header className="animate-fade-up space-y-4 px-[var(--pad-x)] pt-[var(--pad-y)] sm:px-[var(--pad-x-sm)]">
        <p className="kicker text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Survey</p>
        <h1 className="font-display text-[length:var(--fs-title)] font-medium leading-[1.1] tracking-tight sm:text-[length:var(--fs-title-sm)]">
          {survey.title}
        </h1>
        {survey.description && (
          <p className="max-w-prose text-[1.05rem] leading-relaxed text-muted-foreground">
            {survey.description}
          </p>
        )}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {answeredCount}/{questions.length}
          </span>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-[var(--gap-q)] px-[var(--pad-x)] py-[var(--pad-y)] sm:px-[var(--pad-x-sm)]"
      >
        {visibleQuestions.map((q, i) => (
          <div
            key={q.id}
            id={q.id}
            className="animate-fade-up scroll-mt-8"
            style={{ animationDelay: `${80 + i * 55}ms` }}
          >
            <QuestionField
              question={q}
              index={i}
              value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              error={errors[q.id]}
            />
          </div>
        ))}

        <div
          className="animate-fade-up space-y-4 border-t border-border/70 pt-2"
          style={{ animationDelay: `${120 + visibleQuestions.length * 55}ms` }}
        >
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit response'}
          </Button>
        </div>
      </form>
    </div>
  );
}
