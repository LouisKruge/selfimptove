"use client";

import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        await signOut();
      }}
    >
      <button type="submit" className="btn">
        Sign out
      </button>
    </form>
  );
}
