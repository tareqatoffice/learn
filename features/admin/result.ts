
export type FieldErrors = Record<string, string>;

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; errors: FieldErrors };

export const ok = <T extends object = object>(data?: T): ActionResult<T> => ({ ok: true, ...(data as T) });
export const fail = (errors: FieldErrors | string): { ok: false; errors: FieldErrors } => ({
  ok: false,
  errors: typeof errors === "string" ? { _: errors } : errors,
});

export const firstError = (errors: FieldErrors): string | undefined => errors._ ?? Object.values(errors)[0];
