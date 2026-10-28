import { useEffect } from 'react';
import { app, go, toast } from './lib/app';
import { reducedMotion, settings } from './lib/settings';
import { useStore } from './lib/store';
import { joinRoom, leaveRoom, net } from './net/net';
import { audio } from './audio/audio';
import { codeFromUrl, initNative } from './native/platform';
import { OnlineGameScreen, PracticeScreen } from './screens/GameScreen';
import { HomeScreen, JoinScreen, LoadingScreen, LobbyScreen, QuickPlayScreen, UnreachableScreen } from './screens/Menus';
import { ResultsScreen } from './screens/Results';
import { SettingsOverlay } from './screens/Settings';
import { TutorialScreen } from './screens/Tutorial';
import { IconOffline } from './ui/icons';

/** Join a room from a deep link once the connection is up. */
async function handleDeepLink(code: string) {
  app.set({ pendingCode: code });
  const err = await joinRoom(code);
  if (err) {
    toast(err, 'bad', 4000);
    go('join');
  }
}

export function App() {
  const screen = useStore(app, (s) => s.screen);
  const settingsOpen = useStore(app, (s) => s.settingsOpen);
  const conn = useStore(app, (s) => s.conn);
  const toasts = useStore(app, (s) => s.toasts);
  const motion = useStore(settings, (s) => s.motion);

  useEffect(() => {
    net.connect();
    const linkCode = codeFromUrl(window.location.href);
    if (linkCode) window.history.replaceState(null, '', '/');
    void initNative({
      onDeepLink: (code) => {
        if (app.get().conn === 'online') void handleDeepLink(code);
        else app.set({ pendingCode: code });
      },
      onResume: () => {
        audio.resume();
        // Returning from the background: refresh the authoritative state.
        if (app.get().room) void net.resync();
      },
      onPause: () => audio.suspend(),
      onBack: () => {
        const s = app.get();
        if (s.settingsOpen) {
          app.set({ settingsOpen: false });
          return true;
        }
        if (['join', 'quickplay', 'practice', 'tutorial'].includes(s.screen)) {
          go('home');
          return true;
        }
        if (s.screen === 'lobby' || s.screen === 'results') {
          void leaveRoom();
          return true;
        }
        return s.screen === 'game';
      },
    });
    // Leave the loading screen once connected, or after a short grace period.
    const started = Date.now();
    const unsub = app.subscribe(() => {
      const s = app.get();
      if (s.screen !== 'loading') return;
      if (s.conn === 'online' && Date.now() - started > 500) {
        unsub();
        const code = linkCode ?? (s.pendingCode || null);
        if (code) void handleDeepLink(code);
        else go(settings.get().tutorialDone ? 'home' : 'tutorial');
      }
    });
    const fallback = setTimeout(() => {
      if (app.get().screen === 'loading') {
        if (linkCode) app.set({ pendingCode: linkCode });
        go(app.get().conn === 'online' ? 'home' : 'unreachable');
      }
    }, 4500);
    const kick = setTimeout(() => app.set({}), 600);
    return () => {
      unsub();
      clearTimeout(fallback);
      clearTimeout(kick);
    };
  }, []);

  // When the connection returns while on the error screen, go home.
  useEffect(() => {
    if (conn === 'online' && screen === 'unreachable') go('home');
  }, [conn, screen]);

  const reduce = motion === 'reduced' || (motion === 'system' && reducedMotion());
  const inMatch = screen === 'game';

  return (
    <div className={`app${reduce ? ' reduce-motion' : ''}${inMatch || screen === 'practice' ? ' in-match' : ''}`}>
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'home' && <HomeScreen />}
      {screen === 'quickplay' && <QuickPlayScreen />}
      {screen === 'join' && <JoinScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'game' && <OnlineGameScreen />}
      {screen === 'results' && <ResultsScreen />}
      {screen === 'practice' && <PracticeScreen />}
      {screen === 'tutorial' && <TutorialScreen />}
      {screen === 'unreachable' && <UnreachableScreen />}
      {screen === 'replaced' && <UnreachableScreen replaced />}
      {settingsOpen && <SettingsOverlay />}
      <div className="toasts" aria-live="polite">
        {toasts.slice(-2).map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
      {(conn === 'reconnecting' || conn === 'offline') && screen !== 'loading' && screen !== 'practice' && screen !== 'tutorial' && screen !== 'unreachable' && (
        <div className="conn-banner" role="status">
          {conn === 'reconnecting' ? <span className="spinner" /> : <IconOffline size={18} />}
          {conn === 'reconnecting' ? (inMatch ? 'Connection lost. Reconnecting, your board is safe for 30 seconds' : 'Reconnecting') : 'Offline. Retrying'}
        </div>
      )}
    </div>
  );
}
