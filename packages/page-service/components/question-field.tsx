'use client';
import type { Question, AnswerValue } from '@agentic-survey/schema';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Props {
  question: Question;
  index: number;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | undefined) => void;
  error?: string;
}

const optionCard = (selected: boolean) =>
  cn(
    'flex items-center gap-3.5 rounded-lg border px-4 py-3.5 cursor-pointer transition-all duration-200',
    selected
      ? 'border-primary bg-primary/[0.06] shadow-sm'
      : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/40',
  );

export function QuestionField({ question, index, value, onChange, error }: Props) {
  const cfg = question.config as any;
  const id = question.id;

  function body() {
    switch (question.type) {
      case 'single_choice': {
        const sel = value?.kind === 'single_choice' ? value.selection.optionId : undefined;
        const choose = (optionId: string) => {
          const opt = (cfg.options ?? []).find((o: any) => o.id === optionId);
          onChange({ kind: 'single_choice', selection: { optionId, label: opt?.label ?? optionId } });
        };

        if (cfg.display === 'dropdown') {
          return (
            <Select value={sel} onValueChange={choose}>
              <SelectTrigger>
                <SelectValue placeholder="Select an option…" />
              </SelectTrigger>
              <SelectContent>
                {(cfg.options ?? []).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        return (
          <RadioGroup value={sel} onValueChange={choose} className="gap-2.5">
            {(cfg.options ?? []).map((o: any) => (
              <label key={o.id} htmlFor={`${id}-${o.id}`} className={optionCard(sel === o.id)}>
                <RadioGroupItem id={`${id}-${o.id}`} value={o.id} />
                <span className="text-[0.95rem]">{o.label}</span>
              </label>
            ))}
          </RadioGroup>
        );
      }

      case 'multi_choice': {
        const selected = new Set(
          value?.kind === 'multi_choice' ? value.selections.map((s) => s.optionId) : [],
        );
        const toggle = (o: any, on: boolean) => {
          const current = value?.kind === 'multi_choice' ? [...value.selections] : [];
          const next = on
            ? [...current, { optionId: o.id, label: o.label }]
            : current.filter((s) => s.optionId !== o.id);
          onChange(next.length ? { kind: 'multi_choice', selections: next } : undefined);
        };
        return (
          <div className="grid gap-2.5">
            {(cfg.options ?? []).map((o: any) => (
              <label key={o.id} htmlFor={`${id}-${o.id}`} className={optionCard(selected.has(o.id))}>
                <Checkbox
                  id={`${id}-${o.id}`}
                  checked={selected.has(o.id)}
                  onCheckedChange={(c) => toggle(o, c === true)}
                />
                <span className="text-[0.95rem]">{o.label}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'short_text':
        return (
          <Input
            placeholder={cfg.placeholder}
            maxLength={cfg.maxLength}
            value={value?.kind === 'short_text' ? value.text : ''}
            onChange={(e) => onChange(e.target.value ? { kind: 'short_text', text: e.target.value } : undefined)}
          />
        );

      case 'long_text':
        return (
          <Textarea
            placeholder={cfg.placeholder}
            maxLength={cfg.maxLength}
            value={value?.kind === 'long_text' ? value.text : ''}
            onChange={(e) => onChange(e.target.value ? { kind: 'long_text', text: e.target.value } : undefined)}
          />
        );

      case 'rating': {
        const min = cfg.min ?? 1;
        const max = cfg.max ?? 5;
        const current = value?.kind === 'rating' ? value.value : undefined;
        const scale = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {scale.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ kind: 'rating', value: n })}
                  className={cn(
                    'h-12 w-12 rounded-lg border text-[0.95rem] font-medium transition-all duration-200',
                    current === n
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/50',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {(cfg.labels?.min || cfg.labels?.max) && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{cfg.labels?.min}</span>
                <span>{cfg.labels?.max}</span>
              </div>
            )}
          </div>
        );
      }

      case 'yes_no': {
        const current = value?.kind === 'yes_no' ? value.value : undefined;
        const opt = (label: string, v: boolean) => (
          <button
            type="button"
            onClick={() => onChange({ kind: 'yes_no', value: v })}
            className={cn(
              'flex-1 rounded-lg border px-4 py-3.5 text-[0.95rem] font-medium transition-all duration-200',
              current === v
                ? 'border-primary bg-primary/[0.06] shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-secondary/40',
            )}
          >
            {label}
          </button>
        );
        return (
          <div className="flex gap-2.5">
            {opt(cfg.labels?.yes ?? 'Yes', true)}
            {opt(cfg.labels?.no ?? 'No', false)}
          </div>
        );
      }

      case 'number':
        return (
          <div className="relative">
            <Input
              type="number"
              min={cfg.min}
              max={cfg.max}
              step={cfg.step}
              className={cfg.unit ? 'pr-16' : undefined}
              value={value?.kind === 'number' ? String(value.value) : ''}
              onChange={(e) =>
                onChange(e.target.value === '' ? undefined : { kind: 'number', value: Number(e.target.value) })
              }
            />
            {cfg.unit && (
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {cfg.unit}
              </span>
            )}
          </div>
        );
    }
  }

  return (
    <fieldset className="space-y-3.5">
      <legend className="flex gap-3">
        <span className="q-num mt-1 select-none text-sm tabular-nums text-primary/70">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="font-display text-xl leading-snug text-foreground">
          {question.prompt}
          {question.required && <span className="text-primary"> *</span>}
        </span>
      </legend>
      <div className="pl-0 sm:pl-9">{body()}</div>
      {error && <p className="pl-0 text-sm text-destructive sm:pl-9">{error}</p>}
    </fieldset>
  );
}
