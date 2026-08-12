"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "./primitives";

type Result = { ok: true; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Every write in COMMAND goes through a server action. This wrapper gives all
 * of them the same behaviour: pending state, a readable error, and an optional
 * reset once the write succeeds.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
}: {
  action: (form: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<Result | null, FormData>(async (_prev, formData) => {
    const result = await action(formData);
    if (result.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    return result;
  }, null);

  return (
    <form ref={ref} action={formAction} className={cx("space-y-4", className)}>
      {children}
      {state && !state.ok ? (
        <p role="alert" className="border-l border-critical pl-3 text-xs leading-relaxed text-critical">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  size,
  disabled,
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "default" | "ghost";
  className?: string;
  size?: "lg";
  disabled?: boolean;
  /** Submitter name/value — lets one form carry two distinct intents. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={cx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        size === "lg" && "btn-lg",
        className,
      )}
    >
      {pending ? "···" : children}
    </button>
  );
}

/** A single-purpose button that fires a server action with fixed arguments. */
export function ActionButton({
  action,
  children,
  variant = "default",
  className,
  confirm,
  title,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  variant?: "primary" | "default" | "ghost";
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={title}
        disabled={pending}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setPending(true);
          setError(null);
          try {
            const result = await action();
            if (!result.ok) setError(result.error);
          } catch {
            setError("Something went wrong. Try again.");
          } finally {
            setPending(false);
          }
        }}
        className={cx(
          "btn",
          variant === "primary" && "btn-primary",
          variant === "ghost" && "btn-ghost",
          className,
        )}
      >
        {pending ? "···" : children}
      </button>
      {error ? <span className="text-[0.625rem] leading-tight text-critical">{error}</span> : null}
    </span>
  );
}

/* ----------------------------------------------------------------- FIELDS */

export function Field({
  label,
  name,
  children,
  hint,
  className,
}: {
  label: string;
  name?: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cx("block", className)} htmlFor={name}>
      <span className="label mb-2 block">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[0.6875rem] text-ink-ghost">{hint}</span> : null}
    </label>
  );
}

export function TextField(props: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number" | "date" | "time" | "email";
  step?: string;
  min?: string;
  max?: string;
  hint?: string;
  className?: string;
  inputMode?: "text" | "numeric" | "decimal";
  autoFocus?: boolean;
}) {
  const { label, hint, className, defaultValue, ...rest } = props;
  return (
    <Field label={label} name={props.name} hint={hint} className={className}>
      <input
        id={props.name}
        {...rest}
        defaultValue={defaultValue ?? undefined}
        type={props.type ?? "text"}
      />
    </Field>
  );
}

export function TextArea(props: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  const { label, hint, className, defaultValue, ...rest } = props;
  return (
    <Field label={label} name={props.name} hint={hint} className={className}>
      <textarea id={props.name} rows={props.rows ?? 3} {...rest} defaultValue={defaultValue ?? undefined} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
  className,
  includeBlank,
  blankLabel = "—",
  required,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | null;
  hint?: string;
  className?: string;
  includeBlank?: boolean;
  blankLabel?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} required={required}>
        {includeBlank ? <option value="">{blankLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        <span className="block text-xs text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[0.6875rem] text-ink-ghost">{hint}</span> : null}
      </span>
    </label>
  );
}

export function FieldRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const map = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={cx("grid grid-cols-1 gap-4", map[cols])}>{children}</div>;
}

/* ---------------------------------------------------------------- DRAWER */

/** Progressive disclosure: forms stay out of the way until they are wanted. */
export function Disclosure({
  label,
  children,
  defaultOpen,
  className,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen(!open)} className="btn btn-ghost">
        {open ? "Close" : label}
      </button>
      {open ? <div className="enter mt-4">{children}</div> : null}
    </div>
  );
}
