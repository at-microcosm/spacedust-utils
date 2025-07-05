self.addEventListener('push', handlePush);

function handlePush(event) {
  const { title, body } = event.data.json();
  // const icon = '/images/icon.png';
  // const tag = 'simple-push-demo-notification-tag';
  event.waitUntil(self.registration.showNotification(title, { body }));
  // TODO: resubscribe to notifs to try to stay alive
}
