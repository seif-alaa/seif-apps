/**
 * Light haptic tap. Android uses the Vibration API; iOS Safari (18+) has no
 * API, but toggling a native `<input type="checkbox" switch>` produces the
 * system haptic, so we keep a hidden one around and click its label.
 */
let label: HTMLLabelElement | null = null;

function iosSwitch() {
  if (label || typeof document === "undefined") return label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.id = "__haptic";
  input.style.display = "none";
  label = document.createElement("label");
  label.htmlFor = "__haptic";
  label.style.display = "none";
  document.body.append(input, label);
  return label;
}

export function haptic(kind: "light" | "medium" | "success" | "warning" = "light") {
  try {
    if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
      const pattern = { light: 8, medium: 16, success: [10, 40, 14], warning: [20, 60, 20] }[kind];
      if (navigator.vibrate(pattern)) return;
    }
    iosSwitch()?.click();
  } catch {
    /* haptics are best-effort */
  }
}
