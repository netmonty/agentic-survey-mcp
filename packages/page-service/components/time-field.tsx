'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 24-hour time input. The native <input type="time"> renders in the browser's
 * locale (often 12-hour AM/PM in en-US), so we roll our own HH:MM segments to
 * guarantee a 24-hour display everywhere. The emitted value is always 24-hour
 * `HH:MM` (zero-padded), matching the `time` AnswerValue contract.
 */

interface Props {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}

/** Strip to ≤2 digits and clamp to [0, max]; '' when empty. */
function norm(raw: string, max: number): string {
  let v = raw.replace(/\D/g, '').slice(0, 2);
  if (v !== '' && parseInt(v, 10) > max) v = String(max);
  return v;
}
const pad2 = (s: string): string => (s === '' ? '' : s.padStart(2, '0'));

export function TimeField({ value, onChange }: Props) {
  const [hh, setHh] = useState(() => value?.split(':')[0] ?? '');
  const [mm, setMm] = useState(() => value?.split(':')[1] ?? '');

  // Emit a valid 24-hour HH:MM only when both segments are filled.
  const emit = (h: string, m: string) =>
    onChange(h !== '' && m !== '' ? `${pad2(h)}:${pad2(m)}` : undefined);

  const step = (which: 'h' | 'm', delta: number) => {
    const max = which === 'h' ? 23 : 59;
    const cur = which === 'h' ? hh : mm;
    const wrapped = ((parseInt(cur || '0', 10) + delta) % (max + 1) + (max + 1)) % (max + 1);
    const next = pad2(String(wrapped));
    if (which === 'h') {
      setHh(next);
      emit(next, mm);
    } else {
      setMm(next);
      emit(hh, next);
    }
  };

  const seg =
    'w-9 bg-transparent text-center text-[0.95rem] font-medium tabular-nums outline-none placeholder:text-muted-foreground/60';

  const segmentInput = (
    which: 'h' | 'm',
    val: string,
    set: (v: string) => void,
    other: string,
    max: number,
    label: string,
  ) => (
    <input
      inputMode="numeric"
      aria-label={label}
      placeholder="––"
      className={seg}
      value={val}
      onChange={(e) => {
        const v = norm(e.target.value, max);
        set(v);
        which === 'h' ? emit(v, other) : emit(other, v);
      }}
      onBlur={() => {
        const p = pad2(val);
        set(p);
        which === 'h' ? emit(p, other) : emit(other, p);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); step(which, 1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); step(which, -1); }
      }}
    />
  );

  return (
    <div
      className={cn(
        'flex h-[var(--h-ctl)] w-fit items-center gap-0.5 rounded-lg border border-input bg-card px-3 shadow-sm',
        'transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background hover:border-primary/40',
      )}
    >
      {segmentInput('h', hh, setHh, mm, 23, 'Hour (24-hour, 00–23)')}
      <span className="select-none text-muted-foreground">:</span>
      {segmentInput('m', mm, setMm, hh, 59, 'Minute (00–59)')}
      <span className="ml-2 select-none border-l border-input pl-2.5 text-xs text-muted-foreground">24h</span>
    </div>
  );
}
