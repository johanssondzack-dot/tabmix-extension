/** Placeholder when a tab has no favicon — avoids loading missing chrome-extension URLs. */
const DEFAULT_FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="6" fill="%23353a44"/>' +
      '<circle cx="16" cy="16" r="6" fill="%239aa0a6"/>' +
      '</svg>'
  );

function setupPopup() {
  const tabList = document.getElementById('tab-list');
  const masterSlider = document.getElementById('master-slider');
  const masterLabel = document.getElementById('master-label');

  if (!tabList || !masterSlider || !masterLabel) return;

  async function getSavedVolumes() {
    return new Promise((resolve) => {
      chrome.storage.local.get('tabVolumes', (data) => {
        resolve(data.tabVolumes ?? {});
      });
    });
  }

  async function saveVolume(tabId, value) {
    const volumes = await getSavedVolumes();
    volumes[tabId] = value;
    chrome.storage.local.set({ tabVolumes: volumes });
  }

  function sendVolume(tabId, value) {
    chrome.runtime.sendMessage(
      { action: 'setVolume', tabId, value },
      () => void chrome.runtime.lastError
    );
  }

  function createTabRow(tab, savedVol) {
    const vol = savedVol ?? 1.0;
    const percent = Math.round(vol * 100);

    const row = document.createElement('div');
    row.className = 'tab-row';
    row.dataset.tabId = String(tab.id);

    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.alt = '';
    favicon.src = tab.favIconUrl || DEFAULT_FAVICON;
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.src = DEFAULT_FAVICON;
    };

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title ?? 'Unknown Tab';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 100;
    slider.value = String(percent);
    slider.className = 'volume-slider';

    const label = document.createElement('span');
    label.className = 'vol-label';
    label.textContent = `${percent}%`;

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'mute-btn';
    muteBtn.textContent = vol === 0 ? '🔇' : '🔊';

    let preMuteVal = percent;

    muteBtn.addEventListener('click', () => {
      if (slider.value > 0) {
        preMuteVal = slider.value;
        slider.value = '0';
      } else {
        slider.value = String(preMuteVal);
      }
      const newVol = Number(slider.value) / 100;
      label.textContent = `${slider.value}%`;
      muteBtn.textContent = newVol === 0 ? '🔇' : '🔊';
      sendVolume(tab.id, newVol);
      saveVolume(tab.id, newVol);
    });

    slider.addEventListener('input', () => {
      const newVol = Number(slider.value) / 100;
      label.textContent = `${slider.value}%`;
      muteBtn.textContent = newVol === 0 ? '🔇' : '🔊';
      sendVolume(tab.id, newVol);
      saveVolume(tab.id, newVol);
    });

    row.append(favicon, title, slider, label, muteBtn);
    return row;
  }

  masterSlider.addEventListener('input', async () => {
    const masterVol = Number(masterSlider.value) / 100;
    masterLabel.textContent = `Master: ${masterSlider.value}%`;

    const rows = document.querySelectorAll('.tab-row');
    const volumes = await getSavedVolumes();

    rows.forEach((row) => {
      const tabId = parseInt(row.dataset.tabId, 10);
      const tabSlider = row.querySelector('.volume-slider');
      const tabLabel = row.querySelector('.vol-label');
      if (!tabSlider || !tabLabel || Number.isNaN(tabId)) return;
      const scaled = Math.min(100, Math.round(masterVol * 100));
      tabSlider.value = String(scaled);
      tabLabel.textContent = `${scaled}%`;
      sendVolume(tabId, scaled / 100);
      volumes[tabId] = scaled / 100;
    });

    chrome.storage.local.set({ tabVolumes: volumes });
  });

  async function init() {
    const [tabs, savedVolumes] = await Promise.all([
      new Promise((res) => chrome.tabs.query({}, res)),
      getSavedVolumes(),
    ]);

    const validTabs = tabs.filter(
      (t) =>
        t.url &&
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('edge://') &&
        !t.url.startsWith('chrome-extension://')
    );

    if (validTabs.length === 0) {
      tabList.innerHTML = '<p class="empty">No controllable tabs open.</p>';
      return;
    }

    validTabs.forEach((tab) => {
      const saved = savedVolumes[tab.id];
      const row = createTabRow(tab, saved);
      tabList.appendChild(row);
      if (saved !== undefined) sendVolume(tab.id, saved);
    });
  }

  init().catch(() => {
    tabList.innerHTML =
      '<p class="empty">Could not load tabs. Reload the popup.</p>';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPopup);
} else {
  setupPopup();
}
