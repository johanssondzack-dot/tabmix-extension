chrome.runtime.onInstalled.addListener(() => {
  console.log('TabMix installed.');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('chrome-extension://')
  ) return;

  chrome.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
    })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'setVolume') return false;
  if (!message.tabId) return false;

  chrome.tabs.sendMessage(
    message.tabId,
    { action: 'setVolume', value: message.value },
    (response) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({
          target: { tabId: message.tabId, allFrames: true },
          files: ['content.js'],
        }).then(() => {
          setTimeout(() => {
            chrome.tabs.sendMessage(
              message.tabId,
              { action: 'setVolume', value: message.value },
              (retryResponse) => sendResponse(retryResponse ?? { success: false })
            );
          }, 200);
        }).catch(() => sendResponse({ success: false }));
      } else {
        sendResponse(response);
      }
    }
  );
  return true;
});