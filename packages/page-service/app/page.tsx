import { getBrand } from '@/lib/branding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const brand = getBrand();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{brand.name}</CardTitle>
        <CardDescription>Public survey pages, served statelessly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          This is the survey page-service. Surveys open at a share link of the form{' '}
          <code className="rounded bg-muted px-1 py-0.5">/s/&lt;project&gt;/&lt;survey&gt;#k=…</code>.
        </p>
        <p>
          It stores nothing: each submission is written directly into the survey owner&rsquo;s own
          Supabase. Open source &amp; self-hostable.
        </p>
      </CardContent>
    </Card>
  );
}
