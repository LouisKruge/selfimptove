"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV, MOBILE_NAV, isActive } from "@/lib/nav";
import { cx } from "../primitives";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar({ openPalette }: { openPalette: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-7">
      {NAV.map((group) => (
        <div key={group.label}>
          <div className="label mb-2.5 px-3">{group.label}</div>
          <ul className="space-y-px">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cx(
                      "relative block px-3 py-1.5 text-[0.8125rem] leading-snug transition-colors",
                      active ? "text-ink" : "text-ink-faint hover:text-ink-dim",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-3.5 w-px -translate-y-1/2 bg-ink" />
                    ) : null}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-panel lg:flex">
        <div className="flex h-16 flex-none items-center border-b border-line px-5">
          <Link href="/" className="text-[0.8125rem] font-medium tracking-[0.3em] text-ink">
            COMMAND
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-6">{nav}</div>
        <div className="flex-none border-t border-line p-3">
          <button
            type="button"
            onClick={openPalette}
            className="flex w-full items-center justify-between px-3 py-2 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink"
          >
            <span>Command</span>
            <kbd className="numeral border border-line px-1.5 py-0.5 text-[0.625rem] normal-case tracking-normal">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-panel px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 items-center justify-center text-ink-dim"
        >
          <span className="flex flex-col gap-[3px]">
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
          </span>
        </button>
        <Link href="/" className="text-[0.75rem] font-medium tracking-[0.3em] text-ink">
          COMMAND
        </Link>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          className="flex h-9 w-9 items-center justify-center text-ink-dim"
        >
          <span className="text-base leading-none">⌕</span>
        </button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className="enter absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel">
            <div className="flex h-14 flex-none items-center border-b border-line px-5">
              <span className="text-[0.75rem] font-medium tracking-[0.3em] text-ink">COMMAND</span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-6">{nav}</div>
            <div className="flex-none border-t border-line p-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom bar — execution surfaces only */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-panel lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.5625rem] uppercase tracking-[0.12em] transition-colors",
                active ? "text-ink" : "text-ink-ghost",
              )}
            >
              <span className={cx("h-px w-5", active ? "bg-ink" : "bg-transparent")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
