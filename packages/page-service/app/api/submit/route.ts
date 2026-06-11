import { NextResponse } from 'next/server';
import {
  createPublicClient,
  urlFromRef,
  isValidProjectRef,
  fetchPublishedSurvey,
  submitResponse,
  validateSubmission,
} from '@data';
import { rateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const rl = rateLimit(`submit:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many submissions — please slow down.' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfter ?? 60) } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { ref, key, surveyId, answers, turnstileToken } = body ?? {};
  if (!ref || !key || !surveyId || !Array.isArray(answers)) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  if (!isValidProjectRef(ref)) {
    return NextResponse.json({ error: 'Invalid project ref.' }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json({ error: 'Bot check failed.' }, { status: 403 });
  }

  // Re-fetch + re-validate server-side against the real definition (never trust the client).
  const client = createPublicClient(urlFromRef(ref), key);
  const survey = await fetchPublishedSurvey(client, surveyId);
  if (!survey) {
    return NextResponse.json({ error: 'Survey not found, or not published.' }, { status: 404 });
  }

  const errors = validateSubmission(survey.questions, answers);
  if (errors.length) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 });
  }

  const result = await submitResponse(client, {
    surveyId,
    answers,
    respondentMeta: { source: 'page-service' },
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
