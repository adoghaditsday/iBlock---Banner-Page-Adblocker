const DEFAULTS = {
  enabled: true,
  mode: "regular",
  whitelist: [],
  videoSafe: true,
  detectedVideoAdSites: []
};

const RULESETS = {
  regular: ["sinkhole_core", "rich_media_ads"],
  super: ["sinkhole_core", "rich_media_ads", "popup_redirects", "native_tracking", "aggressive_streaming"]
};

const SAFE_VIDEO_HOSTS = [
  "twitch.tv", "youtube.com", "youtu.be", "jtvnw.net", "ttvnw.net",
  "googlevideo.com", "ytimg.com"
];

const CONTENT_GRID_SAFE_HOSTS = [
  "nexusmods.com", "github.com", "reddit.com", "wikipedia.org"
];

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  await chrome.storage.local.set({ ...DEFAULTS, ...current });
  await syncRulesets();
});

chrome.runtime.onStartup.addListener(syncRulesets);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.mode || changes.enabled || changes.whitelist)) {
    syncRulesets().catch(console.warn);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_CONFIG": {
      const url = sender?.tab?.url || message.url || "";
      const host = hostnameFromUrl(url);
      return buildPageConfig(host, await getSettings());
    }
    case "GET_POPUP_STATE": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const host = hostnameFromUrl(tab?.url || "");
      const settings = await getSettings();
      return { ...buildPageConfig(host, settings), settings, host };
    }
    case "SET_MODE": {
      const mode = message.mode === "super" ? "super" : "regular";
      await chrome.storage.local.set({ mode });
      await syncRulesets();
      return { ok: true, mode };
    }
    case "SET_ENABLED": {
      const enabled = Boolean(message.enabled);
      await chrome.storage.local.set({ enabled });
      await syncRulesets();
      return { ok: true, enabled };
    }
    case "ADD_WHITELIST": {
      const host = normalizeHost(message.host);
      if (!host) return { ok: false, error: "Invalid host" };
      const settings = await getSettings();
      const list = settings.whitelist || [];
      if (list.length >= 50 && !list.includes(host)) {
        return { ok: false, error: "Whitelist limit is 50 sites" };
      }
      const whitelist = [...new Set([...list, host])].slice(0, 50);
      await chrome.storage.local.set({ whitelist });
      await syncRulesets();
      return { ok: true, whitelist };
    }
    case "REMOVE_WHITELIST": {
      const host = normalizeHost(message.host);
      const settings = await getSettings();
      const whitelist = (settings.whitelist || []).filter(item => item !== host);
      await chrome.storage.local.set({ whitelist });
      await syncRulesets();
      return { ok: true, whitelist };
    }
    case "LOG_VIDEO_AD_SITE": {
      const host = normalizeHost(message.host || hostnameFromUrl(sender?.tab?.url || ""));
      if (!host) return { ok: false };
      const settings = await getSettings();
      const existing = settings.detectedVideoAdSites || [];
      if (!existing.includes(host) && existing.length < 1000) {
        await chrome.storage.local.set({ detectedVideoAdSites: [...existing, host] });
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: "Unknown message" };
  }
}

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
}

function hostnameFromUrl(url) {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return "";
  }
}

function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");
}

function hostMatches(host, base) {
  return host === base || host.endsWith(`.${base}`);
}

function isWhitelisted(host, whitelist) {
  return Boolean(host) && (whitelist || []).some(base => hostMatches(host, base));
}

function getSiteProfile(host) {
  if (SAFE_VIDEO_HOSTS.some(base => hostMatches(host, base))) return "safe_video_platform";
  if (CONTENT_GRID_SAFE_HOSTS.some(base => hostMatches(host, base))) return "content_grid_safe";
  return "generic";
}

function buildPageConfig(host, settings) {
  const whitelisted = isWhitelisted(host, settings.whitelist);
  return {
    ok: true,
    host,
    enabled: Boolean(settings.enabled) && !whitelisted,
    whitelisted,
    mode: settings.mode === "super" ? "super" : "regular",
    profile: getSiteProfile(host),
    videoSafe: settings.videoSafe !== false
  };
}

async function syncRulesets() {
  const settings = await getSettings();
  const mode = settings.mode === "super" ? "super" : "regular";
  const enabledRulesetIds = settings.enabled ? RULESETS[mode] : [];
  const allRulesetIds = [...new Set(Object.values(RULESETS).flat())];
  const disableRulesetIds = allRulesetIds.filter(id => !enabledRulesetIds.includes(id));

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabledRulesetIds,
    disableRulesetIds
  });

  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = existing
    .filter(rule => rule.id >= 900000 && rule.id < 901000)
    .map(rule => rule.id);

  const resourceTypes = [
    "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
    "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"
  ];

  const addRules = [];
  for (const [index, host] of (settings.whitelist || []).slice(0, 50).entries()) {
    addRules.push({
      id: 900000 + index * 2,
      priority: 100000,
      action: { type: "allow" },
      condition: {
        initiatorDomains: [host],
        resourceTypes
      }
    });
    addRules.push({
      id: 900001 + index * 2,
      priority: 100000,
      action: { type: "allow" },
      condition: {
        requestDomains: [host],
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });
  }

  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds, addRules });
}
