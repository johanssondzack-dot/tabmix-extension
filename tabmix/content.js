(() => {
  /** @type {Set<HTMLMediaElement>} */
  const mediaNodes = new Set();

  /** @param {number} x */
  function clamp01(x) {
    if (!Number.isFinite(x)) return 1;
    return Math.min(1, Math.max(0, x));
  }

  let lastGain = 1;

  function applyGain() {
    mediaNodes.forEach((el) => {
      try {
        el.volume = lastGain;
      } catch (_) {}
    });
  }

  /**
   * @param {number} value01
   */
  function setGain(value01) {
    lastGain = clamp01(value01);
    applyGain();
  }

  /**
   * @param {ParentNode | globalThis.Document} root
   */
  function collectMedia(root) {
    const scope =
      root && "querySelectorAll" in root
        /** @type {ParentNode & { querySelectorAll: ParentNode["querySelectorAll"] }} */
        ? (root)
        : document.documentElement;

    scope.querySelectorAll("video, audio").forEach((el) => {
      if (!(el instanceof HTMLMediaElement)) return;
      mediaNodes.add(el);
      try {
        el.volume = lastGain;
      } catch (_) {}
    });
  }

  collectMedia(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) collectMedia(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== "setVolume") return false;

    collectMedia(document.documentElement);
    setGain(Number(message.value));
    sendResponse({ success: true });
    return false;
  });
})();
