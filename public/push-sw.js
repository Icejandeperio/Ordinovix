/*
 * Push handler of the Ordinovix service worker. The generated worker (vite-plugin-pwa, generateSW) loads this file with
 * importScripts (see workbox.importScripts in vite.config.ts), so it runs inside that worker and shares its scope.
 *
 * The Worker (worker/push) sends { title, body, url, tag }. The text is already lock-screen safe (client and task codes only,
 * spec 14), so it is shown as it is; nothing here adds names, amounts or contents.
 */
(function () {
  var FALLBACK_BODY = 'You have a reminder in Ordinovix.';

  /** Only a path inside the app: a notification must never take the person to another site. */
  function appPath(raw) {
    if (typeof raw !== 'string' || raw.charAt(0) !== '/' || raw.charAt(1) === '/' || raw.indexOf('\\') !== -1) return '/';
    return raw;
  }

  function readPayload(event) {
    if (!event.data) return {};
    try {
      return event.data.json() || {};
    } catch (e) {
      return {};
    }
  }

  self.addEventListener('push', function (event) {
    var data = readPayload(event);
    var title = typeof data.title === 'string' && data.title ? data.title : 'Ordinovix';
    var options = {
      body: typeof data.body === 'string' && data.body ? data.body : FALLBACK_BODY,
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: appPath(data.url) },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  });

  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var target = new URL(appPath(event.notification.data && event.notification.data.url), self.location.origin).href;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
        for (var i = 0; i < windows.length; i++) {
          var win = windows[i];
          if (win.url.indexOf(self.location.origin) !== 0) continue;
          // an open window of the app: bring it forward and take it to the link
          return win.focus().then(function () {
            return 'navigate' in win ? win.navigate(target) : undefined;
          });
        }
        return self.clients.openWindow(target);
      }),
    );
  });
})();
