// ─── Utilities ────────────────────────────────────────────────────────────────

function getConversationId() {
  return window.location.pathname;
}

function loadBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarks", (result) => {
      const all = result.bookmarks || {};
      resolve(all[getConversationId()] || []);
    });
  });
}

function saveBookmarks(list) {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarks", (result) => {
      const all = result.bookmarks || {};
      all[getConversationId()] = list;
      chrome.storage.local.set({ bookmarks: all }, resolve);
    });
  });
}

// ─── Prompt and Save ──────────────────────────────────────────────────────────

async function promptAndSave(messageEl) {
  const name = window.prompt("Bookmark name:");
  if (name === null || name.trim() === "") return;

  if (!messageEl.id) {
    messageEl.id = "geodude-" + Date.now();
  }

  const list = await loadBookmarks();
  list.push({
    id: Date.now(),
    name: name.trim(),
    elementId: messageEl.id,
  });
  await saveBookmarks(list);
  renderSidebar();
}

// ─── Inject Buttons ───────────────────────────────────────────────────────────

const injected = new WeakSet();

function injectButtons() {
  const onClaude = window.location.hostname.includes("claude.ai");

  let elements;
  if (onClaude) {
    elements = document.querySelectorAll('div[data-testid*="message"]');
  } else {
    const all = document.querySelectorAll(
      'article, [class*="message"], [class*="chat"], p, blockquote'
    );
    elements = Array.from(all).filter(
      (el) => (el.innerText || "").trim().length > 100
    );
  }

  elements.forEach((el) => {
    if (injected.has(el)) return;
    injected.add(el);

    if (window.getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }

    const btn = document.createElement("button");
    btn.className = "geodude-bookmark-btn";
    btn.textContent = "🪨";
    btn.style.display = "none";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      promptAndSave(el);
    });

    el.appendChild(btn);

    el.addEventListener("mouseenter", () => {
      btn.style.display = "block";
    });
    el.addEventListener("mouseleave", () => {
      btn.style.display = "none";
    });
  });
}

// ─── Render Sidebar ───────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderSidebar() {
  // Ensure sidebar exists
  let sidebar = document.getElementById("geodude-sidebar");
  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = "geodude-sidebar";
    document.body.appendChild(sidebar);
  }

  const list = await loadBookmarks();

  // Build items HTML
  const itemsHtml =
    list.length === 0
      ? `<div id="geodude-empty">No bookmarks yet.<br>Hover over any block and click 🪨</div>`
      : list
          .map(
            (bm, i) => `
          <div class="geodude-item" data-index="${i}" data-element-id="${escapeHtml(bm.elementId)}">
            <div class="geodude-item-name">${escapeHtml(bm.name)}</div>
            <button class="geodude-action-btn geodude-delete" data-index="${i}">🗑️</button>
          </div>`
          )
          .join("");

  sidebar.innerHTML = `
    <div class="geodude-header">
      <span class="geodude-header-title">🪨 Geodude</span>
      <button class="geodude-close-btn" id="geodude-close">✕</button>
    </div>
    <div class="geodude-list">
      ${itemsHtml}
    </div>
  `;

  // Close button
  sidebar.querySelector("#geodude-close").addEventListener("click", () => {
    sidebar.classList.remove("open");
  });

  // Item click → scroll (ignore clicks on the delete button)
  sidebar.querySelectorAll(".geodude-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".geodude-delete")) return;
      const elementId = item.dataset.elementId;
      const target = document.getElementById(elementId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  // Delete buttons
  sidebar.querySelectorAll(".geodude-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const current = await loadBookmarks();
      current.splice(idx, 1);
      await saveBookmarks(current);
      renderSidebar();
    });
  });
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "contextMenuBookmark") {
    const onClaude = window.location.hostname.includes("claude.ai");
    let candidates;

    if (onClaude) {
      candidates = Array.from(
        document.querySelectorAll('div[data-testid*="message"]')
      );
    } else {
      candidates = Array.from(
        document.querySelectorAll(
          'article, [class*="message"], [class*="chat"], p, blockquote'
        )
      ).filter((el) => (el.innerText || "").trim().length > 100);
    }

    if (candidates.length === 0) return;

    const viewportMid = window.scrollY + window.innerHeight / 2;
    let closest = candidates[0];
    let minDist = Infinity;

    candidates.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const elMid = window.scrollY + rect.top + rect.height / 2;
      const dist = Math.abs(elMid - viewportMid);
      if (dist < minDist) {
        minDist = dist;
        closest = el;
      }
    });

    promptAndSave(closest);
  }

  if (message.action === "scrollTo") {
    const el = document.getElementById(message.elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const sidebar = document.getElementById("geodude-sidebar");
    if (sidebar) sidebar.classList.add("open");
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  renderSidebar();
  injectButtons();

  const observer = new MutationObserver(() => {
    injectButtons();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
