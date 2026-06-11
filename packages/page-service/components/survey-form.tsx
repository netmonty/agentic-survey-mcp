'use client';
import { useState } from 'react';
import type { Question, AnswerValue } from '@agentic-survey/schema';
import { validateSubmission, type ValidationError } from '@data';
import { QuestionField } from '@/components/question-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const list = questions
      .map((q) => ({ questionId: q.id, value: answers[q.id] }))
      .filter((a): a is { questionId: string; value: AnswerValue } => a.value !== undefined);
    const validation: ValidationError[] = validateSubmission(questions, list);
    if (validation.length) {
      setErrors(Object.fromEntries(validation.map((v) => [v.questionId, v.message])));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref: projectRef,
          key: publishableKey,
          surveyId: survey.id,
          answers: list,
        }),
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
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <p className="text-lg font-medium">{thankYou ?? 'Thanks — your response was recorded.'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{survey.title}</CardTitle>
        {survey.description && <CardDescription>{survey.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-8">
          {questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              error={errors[q.id]}
            />
          ))}
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
