'use client';
import type { Question, AnswerValue } from '@agentic-survey/schema';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | undefined) => void;
  error?: string;
}

export function QuestionField({ question, value, onChange, error }: Props) {
  const cfg = question.config as any;
  const id = question.id;

  function body() {
    switch (question.type) {
      case 'single_choice': {
        const sel = value?.kind === 'single_choice' ? value.selection.optionId : undefined;
        return (
          <RadioGroup
            value={sel}
            onValueChange={(optionId) => {
              const opt = (cfg.options ?? []).find((o: any) => o.id === optionId);
              onChange({ kind: 'single_choice', selection: { optionId, label: opt?.label ?? optionId } });
            }}
          >
            {(cfg.options ?? []).map((o: any) => (
              <label key={o.id} htmlFor={`${id}-${o.id}`} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-secondary">
                <RadioGroupItem id={`${id}-${o.id}`} value={o.id} />
                <span className="text-sm">{o.label}</span>
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
          <div className="grid gap-2">
            {(cfg.options ?? []).map((o: any) => (
              <label key={o.id} htmlFor={`${id}-${o.id}`} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-secondary">
                <Checkbox
                  id={`${id}-${o.id}`}
                  checked={selected.has(o.id)}
                  onCheckedChange={(c) => toggle(o, c === true)}
                />
                <span className="text-sm">{o.label}</span>
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
          <div className="flex flex-wrap gap-2">
            {scale.map((n) => (
              <Button
                key={n}
                type="button"
                variant={current === n ? 'default' : 'outline'}
                size="sm"
                className="w-11"
                onClick={() => onChange({ kind: 'rating', value: n })}
              >
                {n}
              </Button>
            ))}
          </div>
        );
      }
      case 'yes_no': {
        const current = value?.kind === 'yes_no' ? value.value : undefined;
        return (
          <div className="flex gap-2">
            <Button type="button" variant={current === true ? 'default' : 'outline'} onClick={() => onChange({ kind: 'yes_no', value: true })}>
              {cfg.labels?.yes ?? 'Yes'}
            </Button>
            <Button type="button" variant={current === false ? 'default' : 'outline'} onClick={() => onChange({ kind: 'yes_no', value: false })}>
              {cfg.labels?.no ?? 'No'}
            </Button>
          </div>
        );
      }
      case 'number':
        return (
          <Input
            type="number"
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            value={value?.kind === 'number' ? String(value.value) : ''}
            onChange={(e) =>
              onChange(e.target.value === '' ? undefined : { kind: 'number', value: Number(e.target.value) })
            }
          />
        );
    }
  }

  return (
    <div className="space-y-3">
      <Label className="text-base">
        {question.prompt}
        {question.required && <span className="text-destructive"> *</span>}
      </Label>
      {body()}
      {error && <p className={cn('text-sm text-destructive')}>{error}</p>}
    </div>
  );
}
