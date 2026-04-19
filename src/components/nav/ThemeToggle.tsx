"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { clsx } from "@/components/ui/clsx";
import { THEME_STORAGE_KEY } from "@/lib/brand";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = THEME_STORAGE_KEY;

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark") return stored;
      return "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function choose(t: Theme) {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    applyTheme(t);
  }

  const options: { value: Theme; Icon: React.ComponentType<{ size?: number }>; label: string }[] = [
    { value: "light",  Icon: Sun,     label: "Light"  },
    { value: "system", Icon: Monitor, label: "System" },
    { value: "dark",   Icon: Moon,    label: "Dark"   },
  ];

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-md border bg-[var(--bg)] p-0.5"
    >
      {options.map(({ value, Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => choose(value)}
          className={clsx(
            "flex items-center justify-center rounded p-1.5 transition-colors",
            theme === value
              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
