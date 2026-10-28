import { Capacitor } from '@capacitor/core';
import { settings } from '../lib/settings';

export const isNative = Capacitor.isNativePlatform();

/** Solo preview build: no server connection, tutorial and practice only. */
export const offlineDemo = import.meta.env.VITE_OFFLINE_DEMO === '1';
export const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'

/** Game server origin. Empty string means "same origin as the page". */
export function serverUrl(): string {
  const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return '';
}

/** Public web origin used in invite links. */
export function publicUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (!isNative) return window.location.origin;
  return serverUrl();
}

export function inviteLink(code: string): string {
  return `${publicUrl()}/r/${code}`;
}

/* ---------------- Haptics ---------------- */

type HapticKind = 'tap' | 'place' | 'clear' | 'big' | 'warn' | 'error' | 'win';

let hapticsMod: typeof import('@capacitor/haptics') | null = null;
if (isNative) {
  void import('@capacitor/haptics').then((m) => (hapticsMod = m));
}

export function haptic(kind: HapticKind): void {
  if (!settings.get().haptics) return;
  if (hapticsMod) {
    const { Haptics, ImpactStyle, NotificationType } = hapticsMod;
    switch (kind) {
      case 'tap':
        void Haptics.selectionChanged();
        break;
      case 'place':
        void Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'clear':
        void Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'big':
        void Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'warn':
        void Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        void Haptics.notification({ type: NotificationType.Error });
        break;
      case 'win':
        void Haptics.notification({ type: NotificationType.Success });
        break;
    }
    return;
  }
  // Web fallback (Android browsers). iOS Safari has no vibration API.
  const pattern: Record<HapticKind, number | number[]> = {
    tap: 6,
    place: 10,
    clear: 18,
    big: [20, 30, 30],
    warn: [12, 40, 12],
    error: [25, 30, 25],
    win: [15, 40, 15, 40, 30],
  };
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern[kind]);
    } catch {
      // Some browsers throw without a user gesture; haptics are optional.
    }
  }
}

/* ---------------- Sharing ---------------- */

export async function shareInvite(code: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = inviteLink(code);
  const text = `Join my match. Room code ${code}`;
  if (isNative) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'Join my match', text, url, dialogTitle: 'Invite Friends' });
      return 'shared';
    } catch {
      // Fall through to clipboard.
    }
  } else if (navigator.share) {
    try {
      await navigator.share({ title: 'Join my match', text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews: fall back to a temporary textarea.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Share or save a generated PNG. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'saved' | 'failed'> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (isNative) {
    try {
      const { Share } = await import('@capacitor/share');
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      // Native share sheets need a real file, so write the image to the app cache first.
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const written = await Filesystem.writeFile({ path: filename, data: dataUrl.split(',')[1]!, directory: Directory.Cache });
      await Share.share({ title: 'Match result', text, files: [written.uri], dialogTitle: 'Share Result' });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'saved';
}

/* ---------------- Lifecycle and deep links ---------------- */

/** Extract a room code from /r/CODE, ?room=CODE or pulsearena://room/CODE. */
export function codeFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/r\/([A-Za-z0-9]{5})\b/) ?? (u.host === 'room' ? u.pathname.match(/^\/([A-Za-z0-9]{5})/) : null);
    if (m) return m[1]!.toUpperCase();
    const q = u.searchParams.get('room');
    if (q && /^[A-Za-z0-9]{5}$/.test(q)) return q.toUpperCase();
  } catch {
    // not a URL
  }
  return null;
}

export async function initNative(handlers: {
  onDeepLink: (code: string) => void;
  onResume: () => void;
  onPause: () => void;
  onBack: () => boolean;
}): Promise<void> {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handlers.onResume();
    else handlers.onPause();
  });
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  void App.addListener('appUrlOpen', (e) => {
    const code = codeFromUrl(e.url);
    if (code) handlers.onDeepLink(code);
  });
  void App.addListener('backButton', () => {
    if (!handlers.onBack()) void App.minimizeApp();
  });
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: '#07090D' });
  } catch {
    // Status bar plugin unavailable: purely cosmetic.
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // ignore
  }
}
