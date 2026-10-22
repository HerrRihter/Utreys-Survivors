// The Android app (Capacitor, docs/ANDROID.md). In a browser every function here does nothing,
// and the native plugin is loaded only inside the app.
import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();

// The system Back button acts as Escape: it closes the open screen or pauses the run, instead
// of closing the app. Returns a function that removes the listener.
export function bindBackButton(window) {
  if (!isNativeApp()) return () => {};
  let removed = false,
    handle = null;
  import('@capacitor/app').then(({ App }) =>
    App.addListener('backButton', () => {
      const press = (type) =>
        window.dispatchEvent(new window.KeyboardEvent(type, { code: 'Escape', key: 'Escape' }));
      press('keydown');
      press('keyup');
    }).then((listener) => {
      if (removed) listener.remove();
      else handle = listener;
    }),
  );
  return () => {
    removed = true;
    handle?.remove();
  };
}
