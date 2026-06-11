'use client';
import { use, useEffect, useState } from 'react';
import { createPublicClient, urlFromRef, fetchPublishedSurvey, type PublicSurvey } from '@data';
import { SurveyForm } from '@/components/survey-form';
import { Card, CardContent } from '@/components/ui/card';

type State = 'loading' | 'nokey' | 'notfound' | 'ready';

export default function SurveyPage({ params }: { params: Promise<{ ref: string; surveyId: string }> }) {
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
    <Card>
      <CardContent className="py-16 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
