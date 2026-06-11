import { getBrand } from '@/lib/branding';

export default function Home() {
  const brand = getBrand();
  return (
    <div className="animate-fade-up rounded-2xl border border-border bg-card p-8 shadow-card sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{brand.name}</p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
        Public survey pages, served statelessly.
      </h1>
      <div className="mt-5 space-y-3 text-[1.02rem] leading-relaxed text-muted-foreground">
        <p>
          Surveys open at a share link of the form{' '}
          <code className="rounded bg-secondary px-1.5 py-0.5 font-sans text-sm text-foreground">
            /s/&lt;project&gt;/&lt;survey&gt;#k=…
          </code>
          .
        </p>
        <p>
          This service stores nothing: each submission is written directly into the survey
          owner&rsquo;s own Supabase. Open source &amp; self-hostable.
        </p>
      </div>
    </div>
  );
}
