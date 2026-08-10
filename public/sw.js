// 智习 · Web Push Service Worker
// 负责接收服务器推送 (push 事件) 并展示系统通知，点击后跳转到目标页面。
// 该文件位于 public/，构建后处于站点根（或 BASE_URL 子路径），作用域覆盖整个应用。

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: '智习消息', body: '', url: '/', tag: 'zxs-push', module: '' }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = Object.assign(data, parsed)
    }
  } catch (e) {
    // 非 JSON 负载时把原文塞进 body
    data.body = event.data ? event.data.text() : ''
  }

  const origin = self.location.origin
  const base = self.location.pathname.replace(/sw\.js$/, '')
  const iconUrl = origin + base + 'logo.svg'
  const badgeUrl = origin + base + 'favicon.ico'

  const options = {
    body: data.body || '',
    icon: iconUrl,
    badge: badgeUrl,
    tag: data.tag || data.module || 'zxs-push',
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
    requireInteraction: false,
    // 振动（移动端）
    vibrate: [120, 60, 120]
  }

  event.waitUntil(self.registration.showNotification(data.title || '智习消息', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  const base = self.location.pathname.replace(/sw\.js$/, '')
  const absolute = target.startsWith('http') ? target : self.location.origin + base + target.replace(/^\//, '')

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'zxs-push-click', url: absolute })
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute)
      }
    })
  )
})
