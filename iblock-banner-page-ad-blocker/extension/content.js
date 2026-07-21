(() => {
  const STATE = {
    config: null,
    scanned: new WeakSet(),
    protectedRoots: new WeakSet(),
    observer: null,
    hiddenCount: 0,
    maxPerPass: 60
  };

  boot();

  async function boot() {
    const cfg = await message({ type: "GET_CONFIG", url: location.href }).catch(() => null);
    STATE.config = cfg || { enabled: false };
    if (!STATE.config.enabled) return;

    collectProtectedRoots();
    schedule(() => cleanupPass("pass-1"), 350);
    schedule(() => cleanupPass("pass-2"), 1400);
    if (STATE.config.mode === "super" || STATE.config.profile === "generic_sinkhole") {
      schedule(() => cleanupPass("pass-3"), 3200);
    }
    schedule(startObserver, 1800);
  }

  function schedule(fn, ms) {
    if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(fn, ms);
    else window.addEventListener("DOMContentLoaded", () => setTimeout(fn, ms), { once: true });
  }

  function message(payload) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage(payload, res => {
      const err = chrome.runtime.lastError;
      if (err) reject(err); else resolve(res);
    }));
  }

  function cleanupPass(reason) {
    if (!STATE.config?.enabled) return;
    collectProtectedRoots();
    let hidden = 0;
    for (const el of getCandidates()) {
      if (hidden >= STATE.maxPerPass) break;
      if (!(el instanceof Element) || STATE.scanned.has(el)) continue;
      STATE.scanned.add(el);
      if (isUntouchable(el)) continue;
      const score = scoreCandidate(el);
      const threshold = STATE.config.mode === "super" ? 60 : 80;
      if (score >= threshold) {
        hideElement(el, score, reason);
        hidden++;
      }
    }
    if (hidden > 0) STATE.hiddenCount += hidden;
  }

  function getCandidates() {
    const set = new Set();
    const selectors = [
      "iframe", "object", "embed",
      "[id*='ad' i]", "[class*='ad-' i]", "[class*=' ad' i]", "[class*='advert' i]", "[class*='sponsor' i]", "[class*='promo' i]",
      "[aria-label*='ad' i]", "[aria-label*='sponsor' i]",
      "a[href] > img", "a[href] picture", "a[href] source",
      "[style*='position: fixed' i]", "[style*='position: sticky' i]"
    ];
    for (const sel of selectors) {
      try { document.querySelectorAll(sel).forEach(el => set.add(candidateRoot(el))); } catch {}
    }
    // Native ads often appear as labeled cards; search small text labels, not every container.
    for (const label of document.querySelectorAll("span,div,p,small")) {
      if (set.size > 1000) break;
      const text = cleanText(label.textContent).slice(0, 80);
      if (/^(ad|ads|advertisement|sponsored|sponsor|promoted|paid content|around the web|recommended by)$/i.test(text)) {
        set.add(candidateRoot(label));
      }
    }
    return [...set].filter(Boolean);
  }

  function candidateRoot(el) {
    if (!el) return null;
    if (el.matches?.("iframe,object,embed")) return climbBox(el, 2);
    if (el.closest?.("a[href]")) return climbBox(el.closest("a[href]"), 2);
    return climbBox(el, 2);
  }

  function climbBox(el, depth) {
    let node = el;
    for (let i = 0; i < depth; i++) {
      const p = node?.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      const r = rect(p);
      const nr = rect(node);
      if (r.width <= Math.max(nr.width * 1.6, nr.width + 80) && r.height <= Math.max(nr.height * 2.2, nr.height + 160)) node = p;
    }
    return node;
  }

  function collectProtectedRoots() {
    const protectedSelectors = [
      "video", "audio", "canvas",
      "header", "nav", "footer", "form", "main[role='main']",
      "[role='navigation']", "[role='menubar']", "[role='menu']", "[role='toolbar']", "[role='tablist']", "[role='search']",
      "button", "select", "input", "textarea", "summary", "details",
      "[aria-haspopup]", "[aria-expanded]", "[data-testid*='player' i]", "[class*='player' i]", "[id*='player' i]",
      "[class*='video-player' i]", "[class*='jwplayer' i]", "[class*='vjs-' i]", "[class*='plyr' i]",
      "[class*='comments' i]", "[id*='comments' i]",
      "[class*='pagination' i]", "[class*='breadcrumb' i]",
      "[class*='gallery' i]", "[class*='grid' i]", "[class*='listing' i]", "[class*='mod-tile' i]", "[class*='file-tile' i]"
    ];
    for (const sel of protectedSelectors) {
      try { document.querySelectorAll(sel).forEach(el => STATE.protectedRoots.add(el)); } catch {}
    }
  }

  function isUntouchable(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    if (isInsideProtected(el)) return true;
    if (STATE.config.videoSafe && isNearOrInsidePlayer(el)) return true;
    if (isFunctionalUI(el)) return true;
    if (isSameSiteContentCard(el)) return true;
    if (STATE.config.profile === "safe_video_platform") {
      // On Twitch/YouTube, DOM blocking is deliberately minimal.
      return !isHighConfidenceOffPlayerAd(el);
    }
    if (STATE.config.profile === "content_grid_safe" && !isHighConfidenceOffPlayerAd(el)) return true;
    return false;
  }

  function isInsideProtected(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (STATE.protectedRoots.has(n)) return true;
      if (n.matches?.("header,nav,footer,form,button,select,input,textarea,summary,details")) return true;
      if (n.getAttribute?.("role") && /navigation|menu|menubar|toolbar|tablist|search|button/i.test(n.getAttribute("role"))) return true;
    }
    return false;
  }

  function isNearOrInsidePlayer(el) {
    if (el.closest?.("video,audio,canvas,[class*='player' i],[id*='player' i],[class*='jwplayer' i],[class*='vjs-' i],[class*='plyr' i]")) return true;
    const er = rect(el);
    if (!er.width || !er.height) return false;
    const players = [...document.querySelectorAll("video,[class*='player' i],[id*='player' i],[class*='jwplayer' i],[class*='vjs-' i],[class*='plyr' i]")].slice(0, 8);
    return players.some(p => {
      const pr = rect(p);
      if (!pr.width || !pr.height) return false;
      const horizontalOverlap = Math.max(0, Math.min(er.right, pr.right) - Math.max(er.left, pr.left));
      const nearY = Math.abs(er.top - pr.bottom) < 140 || Math.abs(er.bottom - pr.top) < 80;
      return nearY && horizontalOverlap > Math.min(er.width, pr.width) * 0.35;
    });
  }

  function isFunctionalUI(el) {
    if (el.closest?.("header,nav,footer,form,[role='navigation'],[role='menu'],[role='menubar'],[role='toolbar'],[role='tablist'],[role='search']")) return true;
    if (el.matches?.("button,[role='button'],a[aria-haspopup],a[aria-expanded],summary,details,label")) return true;
    const r = rect(el);
    if (r.width <= 120 && r.height <= 80 && el.querySelector?.("svg,img,span")) {
      const href = firstHref(el);
      if (!href || isSameSiteUrl(href)) return true;
    }
    return false;
  }

  function isSameSiteContentCard(el) {
    const hrefs = [...el.querySelectorAll?.("a[href]") || []].map(a => a.href).filter(Boolean);
    if (!hrefs.length) return false;
    const same = hrefs.filter(isSameSiteUrl).length;
    const imgs = el.querySelectorAll?.("img,picture,svg").length || 0;
    const titleish = el.querySelector?.("h1,h2,h3,h4,h5,[class*='title' i],[class*='name' i]");
    const repeatedParent = el.parentElement && [...el.parentElement.children].filter(c => c.tagName === el.tagName).length >= 4;
    return same >= Math.max(1, hrefs.length * 0.7) && (titleish || imgs) && repeatedParent;
  }

  function scoreCandidate(el) {
    let s = 0;
    const r = rect(el);
    const text = cleanText(el.innerText || el.textContent || "").slice(0, 400);
    const cls = `${el.id || ""} ${el.className || ""} ${el.getAttribute?.("aria-label") || ""}`.toLowerCase();
    const href = firstHref(el);
    const out = href && !isSameSiteUrl(href);
    const isFrame = !!el.querySelector?.("iframe,object,embed") || el.matches?.("iframe,object,embed");
    const imgs = el.querySelectorAll?.("img,picture,source,svg").length || 0;

    if (/\b(ad|ads|advert|advertisement|sponsored|sponsor|promoted|promo|native-ad|ad-slot|dfp|gpt|adsbygoogle)\b/i.test(cls)) s += 35;
    if (/^(ad|ads|advertisement|sponsored|sponsor|promoted|paid content)$/i.test(text)) s += 45;
    if (/\b(sponsored|promoted|paid content|advertisement|around the web|recommended by)\b/i.test(text)) s += 25;
    if (out) s += 25;
    if (href && hasTrackingParams(href)) s += 30;
    if (isFrame) s += out ? 40 : 20;
    if (isBannerShape(r)) s += 20;
    if (isFixedOrSticky(el)) s += 25;
    if (imgs > 0 && out && text.length < 160) s += 20;
    if (isRichMediaBox(el)) s += 20;
    if (STATE.config.mode === "super" && out && imgs > 0) s += 10;

    // Negative signals.
    if (isSameSiteContentCard(el)) s -= 90;
    if (isFunctionalUI(el)) s -= 90;
    if (isInsideProtected(el)) s -= 120;
    if (STATE.config.videoSafe && isNearOrInsidePlayer(el)) s -= 80;
    if (href && isSameSiteUrl(href)) s -= 40;

    return s;
  }

  function isHighConfidenceOffPlayerAd(el) {
    if (isInsideProtected(el) || isNearOrInsidePlayer(el)) return false;
    return scoreCandidate(el) >= 95;
  }

  function isBannerShape(r) {
    if (!r.width || !r.height) return false;
    const aspect = r.width / Math.max(1, r.height);
    const known = [
      [728,90],[970,90],[970,250],[300,250],[300,600],[320,50],[336,280]
    ].some(([w,h]) => Math.abs(r.width-w)<80 && Math.abs(r.height-h)<80);
    return known || (r.width > 420 && r.height >= 45 && r.height <= 280 && aspect > 2.2) || (r.width >= 250 && r.width <= 380 && r.height >= 240 && r.height <= 700);
  }

  function isRichMediaBox(el) {
    const media = el.querySelector?.("iframe,object,embed,video,canvas") || el.matches?.("iframe,object,embed,video,canvas");
    if (!media) return false;
    const href = firstHref(el);
    return !!href && !isSameSiteUrl(href);
  }

  function isFixedOrSticky(el) {
    const pos = getComputedStyle(el).position;
    return pos === "fixed" || pos === "sticky";
  }

  function firstHref(el) {
    const a = el.matches?.("a[href]") ? el : el.querySelector?.("a[href]");
    return a?.href || "";
  }

  function isSameSiteUrl(url) {
    try {
      const u = new URL(url, location.href);
      const a = stripWWW(u.hostname);
      const b = stripWWW(location.hostname);
      return a === b || a.endsWith("." + b) || b.endsWith("." + a);
    } catch { return false; }
  }

  function hasTrackingParams(url) {
    try {
      const u = new URL(url, location.href);
      const keys = [...u.searchParams.keys()].map(k => k.toLowerCase());
      const suspicious = ["aff","affid","affiliate","utm_source","utm_medium","utm_campaign","campaign","campid","zoneid","siteid","tag","subid","clickid","gclid","fbclid","msclkid","lptoken","source","redirect","url","ref","varid","cep","cost"];
      return keys.filter(k => suspicious.some(s => k.includes(s))).length >= 2;
    } catch { return false; }
  }

  function hideElement(el, score, reason) {
    el.classList.add("iblock-hidden-ad");
    el.setAttribute("data-iblock-hidden", `${reason}:${score}`);
    if (document.querySelector("video")) {
      message({ type: "LOG_VIDEO_AD_SITE", host: location.hostname }).catch(() => {});
    }
  }

  function startObserver() {
    if (STATE.observer || !STATE.config?.enabled) return;
    STATE.observer = new MutationObserver(mutations => {
      let likely = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n instanceof Element && looksLikeCandidateInsertion(n)) { likely = true; break; }
        }
        if (likely) break;
      }
      if (likely) debounceCleanup();
    });
    STATE.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  let cleanupTimer = null;
  function debounceCleanup() {
    clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => cleanupPass("mutation"), 300);
  }

  function looksLikeCandidateInsertion(el) {
    if (isUntouchable(el)) return false;
    if (el.matches?.("iframe,object,embed,[style*='position: fixed' i],[style*='position: sticky' i],a[href]")) return true;
    const cls = `${el.id || ""} ${el.className || ""}`.toLowerCase();
    return /ad|ads|advert|sponsor|promo|native|taboola|outbrain|mgid|revcontent/.test(cls);
  }

  function rect(el) {
    try { return el.getBoundingClientRect(); } catch { return { width:0,height:0,top:0,bottom:0,left:0,right:0}; }
  }
  function cleanText(t) { return (t || "").replace(/\s+/g, " ").trim(); }
  function stripWWW(h) { return (h || "").toLowerCase().replace(/^www\./, ""); }
})();
