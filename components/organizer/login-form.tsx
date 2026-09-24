"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { describedBy, FieldError, FieldHint, FieldLabel } from "@/components/ui/field";
import { AlertIcon, ArrowRightIcon } from "@/components/ui/icons";

/** Organizer sign-in. Posts to /api/organizer/session, then continues to `next`. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const uid = useId();
  const nameId = `${uid}-name`;
  const passwordId = `${uid}-password`;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Enter your name so the activity log shows who made changes.";
    if (!password) errors.password = "Enter the organizer password.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      document.getElementById(errors.name ? nameId : passwordId)?.focus();
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/organizer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: Record<string, string>;
      } | null;
      if (res.ok && data?.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      if (data?.fieldErrors) setFieldErrors(data.fieldErrors);
      setError(data?.message ?? "Sign-in failed. Try again.");
      if (res.status === 401) {
        setPassword("");
        document.getElementById(passwordId)?.focus();
      }
      setPending(false);
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <FieldLabel htmlFor={nameId}>Your name</FieldLabel>
        <input
          id={nameId}
          name="name"
          type="text"
          autoComplete="name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={describedBy(nameId, { hint: true, error: Boolean(fieldErrors.name) })}
          className="field-control"
        />
        <FieldHint id={nameId}>Shown in each application’s activity log next to the changes you make.</FieldHint>
        <FieldError id={nameId}>{fieldErrors.name}</FieldError>
      </div>
      <div>
        <FieldLabel htmlFor={passwordId}>Organizer password</FieldLabel>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={describedBy(passwordId, { error: Boolean(fieldErrors.password) })}
          className="field-control"
        />
        <FieldError id={passwordId}>{fieldErrors.password}</FieldError>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-sm bg-danger-soft px-3 py-2.5 text-sm text-text">
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        {pending ? null : <ArrowRightIcon className="size-4" />}
      </Button>
    </form>
  );
}
