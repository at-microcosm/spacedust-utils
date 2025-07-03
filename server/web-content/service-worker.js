function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

self.addEventListener('push', function(event) {
  const { title, body } = event.data.json();

  // Display notification or handle data
  // Example: show a notification
  // const title = 'New Notification';
  // const body = event.data.text();
  // const icon = '/images/icon.png';
  // const tag = 'simple-push-demo-notification-tag';

  event.waitUntil(self.registration.showNotification(title, { body }));

  // TODO: resubscribe to notifs to try to stay alive
});
