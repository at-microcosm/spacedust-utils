import { Chrome } from './Chrome';

export function WithFeatureChecks({ children }) {
  if (!('serviceWorker' in navigator)) {
    return (
      <p>sorry, your browser does not support the background task needd to deliver notifications</p>
    );
  }

  if (!('PushManager' in window)) {
    return (
      <Chrome>
        <p>Sorry, your browser does not support Web Push for notifications</p>
      </Chrome>
    );
  }

  if (!('Notification' in window)) {
    return (
      <Chrome>
        <p>Sorry, your browser does not support the Notifications API for creating system notifications</p>
        <p>If you're on iOS, you can try tapping <strong>add to home screen</strong> from the <strong>share</strong> menu, and then opening <strong>Spacedust</strong> from your home screen to unlock notifications support, but note that Web Push in iOS is unreliable.</p>
      </Chrome>
    );
  }

  return children;
}
