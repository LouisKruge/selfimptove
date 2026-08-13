import type { Metadata } from "next";
import { lockRequired } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Locked" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const misconfigured = lockRequired();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <div className="mb-10">
        <p className="label text-ink-ghost">Command</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {misconfigured ? "Not configured" : "Locked"}
        </h1>
      </div>

      {misconfigured ? (
        <div className="space-y-4 border-l border-critical pl-4">
          <p className="text-sm leading-relaxed text-ink-dim">
            COMMAND is deployed without a password, so it is refusing to serve anything. This system
            holds your body, money, business and private reflection — it will not run open on a
            public address.
          </p>
          <p className="text-sm leading-relaxed text-ink-dim">
            Set <code className="text-ink">COMMAND_PASSWORD</code> in the environment variables of
            your host, then restart. This page will become the sign-in screen.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-8 text-sm leading-relaxed text-ink-dim">
            One operator, one password. Enter it to continue.
          </p>
          <LoginForm next={next ?? "/"} />
        </>
      )}
    </div>
  );
}
