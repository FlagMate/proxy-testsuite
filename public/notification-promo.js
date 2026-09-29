/**
 * ProxyCeptor Viral Push & Funky Notification Controller
 * Prompts user for notification permission with a witty brand toast,
 * then dispatches viral hooks, "Did you know?", and witty reminders
 * every 25 seconds driving self-promotion and sign-ups.
 */
(function() {
  if (typeof window === 'undefined') return;

  const NOTIF_INTERVAL_MS = 25000; // Exactly 25 seconds
  const STORAGE_KEY_PROMPT = 'pc_notif_prompt_dismissed';
  const STORAGE_KEY_INDEX = 'pc_notif_hook_idx';

  // Master Brand Icon (P with Chrome)
  const BRAND_ICON = (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.origin + '/brand/proxyceptor-mark.webp';
    }
    return 'https://proxyceptor.com/brand/proxyceptor-mark.webp';
  })();

  function getSignupUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5173/signup';
    }
    return 'https://proxyceptor.com/signup';
  }

  // Curated list of funky, witty, viral hooks, facts, and reminders
  const VIRAL_HOOKS = [
    {
      title: "💡 Did you know? (Backend on strike?)",
      body: "Staging API down again? Don't wait for DevOps — mock the response on the wire in 3s on ProxyCeptor. 👉 Tap to sign up free!",
    },
    {
      title: "🚀 Quick Reminder: No more redeploys!",
      body: "Hardcoding fake JSON in your frontend code is a crime against humanity. Mock on the fly with ProxyCeptor! 👉 Create your free account",
    },
    {
      title: "🕵️ Did you know? (Smart TV superpowers)",
      body: "ProxyCeptor SDK intercepts live HLS manifests & REST APIs on Samsung Tizen & LG webOS with ZERO SSL certs. 👉 Try it today!",
    },
    {
      title: "☕ Quick Reminder: Coffee break is over!",
      body: "While your backend builds for the 14th time today, you could have intercepted 20 edge cases. 👉 Claim free workspace",
    },
    {
      title: "⚡ Did you know? (Chaos Engineering trick)",
      body: "Want to test how your frontend handles a 10s lag or 504 gateway crash? Inject latency in 1 click on ProxyCeptor. 👉 Sign up now!",
    },
    {
      title: "🧠 Quick Reminder: Friends don't let friends...",
      body: "...test auth token expirations in production without ProxyCeptor rules active. Protect your sanity! 👉 Sign up in 10s",
    },
    {
      title: "🎯 Did you know? (JSON Deep Merge magic)",
      body: "You don't have to replace entire payloads — ProxyCeptor deep-merges mock fields while keeping live wire data intact. 👉 Join free!",
    },
    {
      title: "🔥 Quick Reminder: Bug found in 2 mins!",
      body: "QA found an edge case that only happens on leap years? Replay network traffic and fix it before lunch. 👉 Get started free",
    },
    {
      title: "🧙 Did you know? (The 0-cert miracle)",
      body: "MITM proxies usually demand trusted root certificates on every device. ProxyCeptor Cloud bypasses that completely. 👉 Start mocking!",
    },
    {
      title: "🚨 Quick Reminder: Staging server misses you",
      body: "Just kidding, it crashed 20 minutes ago. Keep developing seamlessly with ProxyCeptor Cloud mocks. 👉 Sign up free!",
    },
    {
      title: "💻 Did you know? (Postman alternative inside)",
      body: "ProxyCeptor Commander gives you a local-first API client with 0 telemetry and 16x faster wire execution. 👉 Explore free",
    },
    {
      title: "🎉 Quick Reminder: Free workspace waiting!",
      body: "Thousands of developers are saving 5+ hours a week. Get your free ProxyCeptor workspace today! 👉 Tap to claim free account",
    },
  ];

  let intervalId = null;

  function getCurrentIndex() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INDEX);
      return saved ? parseInt(saved, 10) % VIRAL_HOOKS.length : 0;
    } catch (e) {
      return 0;
    }
  }

  function setNextIndex(idx) {
    try {
      localStorage.setItem(STORAGE_KEY_INDEX, String((idx + 1) % VIRAL_HOOKS.length));
    } catch (e) {}
  }

  function triggerNotification() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const idx = getCurrentIndex();
    const hook = VIRAL_HOOKS[idx];
    setNextIndex(idx);

    try {
      const notif = new Notification(hook.title, {
        body: hook.body,
        icon: BRAND_ICON,
        badge: BRAND_ICON,
        tag: 'pc-viral-reminder',
        renotify: true,
        requireInteraction: false,
        data: { url: getSignupUrl() },
      });

      notif.onclick = function(event) {
        event.preventDefault();
        try {
          window.focus();
        } catch (e) {}
        window.open(getSignupUrl(), '_blank');
        this.close();
      };

      // Auto close after 10s if ignored so they don't stack up forever
      setTimeout(function() {
        try {
          notif.close();
        } catch (e) {}
      }, 10000);
    } catch (err) {
      console.warn('[ProxyCeptor Notifications]', err);
    }
  }

  function startNotificationLoop() {
    if (intervalId) return;

    // Send first notification immediately after approval
    triggerNotification();

    // Schedule every 25 seconds
    intervalId = setInterval(triggerNotification, NOTIF_INTERVAL_MS);
  }

  function injectPermissionToast() {
    if (document.getElementById('pc-notif-toast')) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    // Style tag
    const style = document.createElement('style');
    style.id = 'pc-notif-toast-style';
    style.textContent = `
      #pc-notif-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        max-width: 360px;
        background: rgba(13, 18, 29, 0.94);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 122, 24, 0.35);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(255, 122, 24, 0.2);
        border-radius: 14px;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f8fafc;
        animation: pcToastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes pcToastSlideIn {
        from { transform: translateY(40px) scale(0.95); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      #pc-notif-toast .pc-toast-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      #pc-notif-toast .pc-toast-logo {
        width: 26px;
        height: 26px;
        border-radius: 7px;
        background: #080c14;
        border: 1px solid rgba(255, 255, 255, 0.12);
        display: grid;
        place-items: center;
        overflow: hidden;
        flex-shrink: 0;
      }
      #pc-notif-toast .pc-toast-logo img {
        width: 18px;
        height: 18px;
        object-fit: contain;
        filter: drop-shadow(0 0 4px rgba(255, 122, 24, 0.45));
      }
      #pc-notif-toast .pc-toast-title {
        font-weight: 750;
        font-size: 13px;
        letter-spacing: -0.01em;
        color: #ffffff;
        flex: 1;
      }
      #pc-notif-toast .pc-toast-close {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 16px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      #pc-notif-toast .pc-toast-close:hover {
        color: #cbd5e1;
      }
      #pc-notif-toast .pc-toast-desc {
        font-size: 12px;
        line-height: 1.45;
        color: #94a3b8;
        margin-bottom: 14px;
      }
      #pc-notif-toast .pc-toast-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #pc-notif-toast .pc-btn-primary {
        flex: 1;
        background: linear-gradient(135deg, #ff9436 0%, #ff5e00 100%);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(255, 94, 0, 0.35);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      #pc-notif-toast .pc-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(255, 94, 0, 0.5);
      }
      #pc-notif-toast .pc-btn-dismiss {
        background: rgba(255, 255, 255, 0.06);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      #pc-notif-toast .pc-btn-dismiss:hover {
        background: rgba(255, 255, 255, 0.12);
      }
    `;
    document.head.appendChild(style);

    const toast = document.createElement('div');
    toast.id = 'pc-notif-toast';
    toast.innerHTML = `
      <div class="pc-toast-header">
        <div class="pc-toast-logo">
          <img src="${BRAND_ICON}" alt="ProxyCeptor" />
        </div>
        <span class="pc-toast-title">ProxyCeptor Dev Hacks 🔔</span>
        <button class="pc-toast-close" id="pc-toast-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="pc-toast-desc">
        Get quick network mocking tricks, live viral dev hooks, and API edge-case secrets every 25 seconds.
      </div>
      <div class="pc-toast-actions">
        <button class="pc-btn-primary" id="pc-toast-allow-btn">Enable Alerts 🚀</button>
        <button class="pc-btn-dismiss" id="pc-toast-dismiss-btn">Later</button>
      </div>
    `;

    document.body.appendChild(toast);

    function removeToast() {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }

    const allowBtn = document.getElementById('pc-toast-allow-btn');
    if (allowBtn) {
      allowBtn.addEventListener('click', function() {
        requestPermissionAndStart();
        removeToast();
      });
    }

    const dismissBtn = document.getElementById('pc-toast-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function() {
        removeToast();
      });
    }

    const closeBtn = document.getElementById('pc-toast-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        removeToast();
      });
    }
  }

  function requestPermissionAndStart() {
    if (!('Notification' in window)) return;

    Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        startNotificationLoop();
      }
    }).catch(function(e) {
      console.warn('[ProxyCeptor Notification Request]', e);
    });
  }

  function init() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      startNotificationLoop();
    } else if (Notification.permission === 'default') {
      // Auto-display permission banner after 1.8 seconds on page
      setTimeout(injectPermissionToast, 1800);

      // Also attach a one-time gesture listener on document click to prompt if user clicks anywhere
      function onFirstUserClick() {
        document.removeEventListener('click', onFirstUserClick);
        if (Notification.permission === 'default') {
          // If toast is open, clicking it will handle it directly
        }
      }
      document.addEventListener('click', onFirstUserClick, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
