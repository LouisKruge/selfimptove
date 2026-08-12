"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

/** g-then-key jumps. Two keystrokes to any primary surface. */
const GOTO: Record<string, string> = {
  h: "/",
  t: "/today",
  m: "/missions",
  g: "/goals",
  b: "/body/training",
  n: "/body/nutrition",
  r: "/body/running",
  x: "/body/hyrox",
  s: "/business/sales",
  f: "/finance/cash-flow",
  c: "/character",
  l: "/learning",
  i: "/ideas",
  v: "/reviews",
  a: "/analytics",
  z: "/strategist",
};

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const awaitingGoto = useRef(false);
  const gotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (paletteOpen || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (awaitingGoto.current) {
        const target = GOTO[e.key.toLowerCase()];
        awaitingGoto.current = false;
        if (gotoTimer.current) clearTimeout(gotoTimer.current);
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        return;
      }
      if (e.key === "g") {
        awaitingGoto.current = true;
        if (gotoTimer.current) clearTimeout(gotoTimer.current);
        gotoTimer.current = setTimeout(() => {
          awaitingGoto.current = false;
        }, 1200);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gotoTimer.current) clearTimeout(gotoTimer.current);
    };
  }, [paletteOpen, router]);

  return (
    <>
      <Sidebar openPalette={openPalette} />
      <div className="lg:pl-56">
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-20 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
