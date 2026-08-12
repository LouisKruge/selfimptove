"use client";

import { useEffect, useState } from "react";
import { cx } from "../primitives";

type Theme = "dark" | "light";

/**
 * COMMAND is dark by default — a command centre, not a document. Light exists
 * for daylight use and is an explicit choice that persists.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("command-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("command-theme", theme);
  }, [theme]);

  return (
    <div className="mt-1 flex items-center gap-px px-3 py-1">
      {(["dark", "light"] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          className={cx(
            "flex-1 border px-2 py-1 text-[0.5625rem] uppercase tracking-[0.14em] transition-colors",
            theme === t
              ? "border-line-strong text-ink"
              : "border-transparent text-ink-ghost hover:text-ink-faint",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** Applies the stored theme before paint so there is no flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('command-theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;
