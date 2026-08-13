"use client";

import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signIn}>
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Password"
        name="password"
        type="password"
        required
        autoFocus
        placeholder="••••••••"
      />
      <SubmitButton size="lg" className="w-full">
        Unlock
      </SubmitButton>
    </ActionForm>
  );
}
