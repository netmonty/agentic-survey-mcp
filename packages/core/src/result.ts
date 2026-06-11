/**
 * Result type — every service function returns this rather than throwing
 * across the boundary. The `error` shape matches the brief's typed-error
 * contract ({ error: { code, message } }).
 */
export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: { code: string; message: string } };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const err = (code: string, message: string): Err => ({
  ok: false,
  error: { code, message },
});

export const isErr = <T>(r: Result<T>): r is Err => !r.ok;

/** Wrap an unknown thrown value into a typed Err. */
export function fromThrown(code: string, e: unknown): Err {
  const message = e instanceof Error ? e.message : String(e);
  return err(code, message);
}
