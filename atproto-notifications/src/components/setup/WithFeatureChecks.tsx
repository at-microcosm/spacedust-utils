export function WithFeatureChecks({ children }) {
  if (!('serviceWorker' in navigator)) {
    return (
      <p>sorry, your browser does not support the background task needd to deliver notifications</p>
    );
  }

  if (!('PushManager' in window)) {
    return (
      <p>sorry, your browser does not support WebPush for notifications</p>
    );
  }

  if (!('Notification' in window)) {
    return (
      <p>sorry, your browser does not support creating system notifications</p>
    );
  }

  return children;
}
