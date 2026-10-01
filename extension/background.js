// Service worker: keeps a per-tab badge reflecting the last validation result.
const badges = new Map(); // tabId -> { errors, warnings }

function renderBadge(tabId) {
  const b = badges.get(tabId);
  let text = '';
  let color = '#5f6368';
  if (b && b.errors > 0) { text = String(b.errors); color = '#d93025'; }
  else if (b && b.warnings > 0) { text = String(b.warnings); color = '#e37400'; }
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'validation-summary') return;
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;
  badges.set(tabId, { errors: msg.errors | 0, warnings: msg.warnings | 0 });
  renderBadge(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  badges.delete(tabId);
});
