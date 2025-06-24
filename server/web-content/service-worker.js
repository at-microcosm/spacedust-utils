console.log('hello????');

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
  console.log('Received a push message', event);

  // Display notification or handle data
  // Example: show a notification
  const title = 'New Notification';
  const body = event.data.text();
  const icon = '/images/icon.png';
  const tag = 'simple-push-demo-notification-tag';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      tag: tag
    })
  );

  // Attempt to resubscribe after receiving a notification
  event.waitUntil(resubscribeToPush());
});

function resubscribeToPush() {
  return self.registration.pushManager.getSubscription()
    .then(function(subscription) {
      if (subscription) {
        return subscription.unsubscribe();
      }
    })
    .then(function() {
      return self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBKEY)
      });
    })
    .then(function(subscription) {
      console.log('Resubscribed to push notifications:', subscription);
      // Optionally, send new subscription details to your server
    })
    .catch(function(error) {
      console.error('Failed to resubscribe:', error);
    });
}
