import { useEffect, useState } from "react";
import { usePrefs } from "@/store/ui";

const THEME_COLORS = { dark: "#131211", light: "#f7f5f0" };

/** Applies theme, language and direction to <html>, and keeps the status bar colour in sync. */
export function useApplyAppearance() {
  const pref = usePrefs((s) => s.theme);
  const lang = usePrefs((s) => s.language);
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

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  return resolved;
}
