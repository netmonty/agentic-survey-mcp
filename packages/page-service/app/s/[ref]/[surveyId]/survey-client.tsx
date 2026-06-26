'use client';
import { use, useEffect, useState } from 'react';
import { createPublicClient, urlFromRef, isValidProjectRef, fetchPublishedSurvey, type PublicSurvey } from '@data';
import { SurveyForm } from '@/components/survey-form';

type State = 'loading' | 'nokey' | 'notfound' | 'ready';

export function SurveyClient({ params }: { params: Promise<{ ref: string; surveyId: string }> }) {
  // Next 16: route params are async; unwrap with React's use().
  const { ref, surveyId } = use(params);
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<PublicSurvey | null>(null);
  const [publishableKey, setPublishableKey] = useState('');

  useEffect(() => {
    // The publishable key rides in the URL fragment (#k=…) — client-only, never
    // sent to this server on page load.
    const m = window.location.hash.match(/k=([^&]+)/);
    const key = m ? decodeURIComponent(m[1]) : '';
    if (!key) {
      setState('nokey');
      return;
    }
    if (!isValidProjectRef(ref)) {
      setState('notfound');
      return;
    }
    setPublishableKey(key);
    const client = createPublicClient(urlFromRef(ref), key);
    fetchPublishedSurvey(client, surveyId)
      .then((res) => {
        if (!res) {
          setState('notfound');
          return;
        }
        setData(res);
        setState('ready');
      })
      .catch(() => setState('notfound'));
  }, [ref, surveyId]);

  // Reflect the survey's real title in the browser tab once loaded. The shared
  // link preview uses the ?t= param (server-rendered); this keeps the open tab
  // accurate even if the title was edited after the link was shared.
  useEffect(() => {
    if (data?.survey.title) document.title = data.survey.title;
  }, [data]);

  if (state === 'loading') return <Centered>Loading…</Centered>;
  if (state === 'nokey') return <Centered>This link is missing its access key.</Centered>;
  if (state === 'notfound') return <Centered>Survey not found, or not published.</Centered>;
  return (
    <SurveyForm
      projectRef={ref}
      publishableKey={publishableKey}
      survey={data!.survey}
      questions={data!.questions}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="survey-card animate-fade-up rounded-2xl border border-border bg-card px-8 py-16 text-center text-muted-foreground shadow-card">
      {children}
    </div>
  );
}
