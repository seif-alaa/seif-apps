import { useEffect, useState } from "react";
import { usePrefs } from "@/store/ui";

const THEME_COLORS = { dark: "#0b0d14", light: "#faf8f4" };

/** Applies the theme preference to <html> and keeps the iOS status bar colour in sync. */
export function useApplyTheme() {
  const pref = usePrefs((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved = pref === "system" ? (systemDark ? "dark" : "light") : pref;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLORS[resolved]));
  }, [resolved]);

  return resolved;
}
