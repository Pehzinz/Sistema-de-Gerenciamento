// Collect rendered messages so existing business-flow tests assert the visible UI.
export async function collectNotifications(page) {
  const messages = [];
  await page.exposeFunction('captureRenderedNotification', message => messages.push(message));
  await page.addInitScript(() => {
    const seen = new WeakSet();
    const collect = () => {
      for (const element of document.querySelectorAll('[data-notification-message]')) {
        if (seen.has(element)) continue;
        seen.add(element);
        void window.captureRenderedNotification(element.textContent);
      }
    };
    new MutationObserver(collect).observe(document, { childList: true, subtree: true });
  });
  return messages;
}
