// ─── Message Detection ────────────────────────────────────────────────────────

function getMessageElements() {
  const primary = document.querySelectorAll(
    'div[data-testid^="user-message"], div[data-testid^="assistant-message"]'
  );
  if (primary.length > 0) return Array.from(primary);

  // Fallback: large div blocks inside the main scrollable area
  const scrollable =
    document.querySelector('div[class*="overflow-y-auto"]') ||
    document.querySelector("main");
  if (!scrollable) return [];

  return Array.from(scrollable.querySelectorAll("div")).filter(
    (el) => el.offsetHeight > 50 && el.children.length > 0
  );
}

// ─── Hover Buttons ────────────────────────────────────────────────────────────

function injectHoverButtons() {
  getMessageElements().forEach((msgEl) => {
    if (msgEl.querySelector(".geodude-bookmark-btn")) return; // already injected

    // Ensure the message element is a positioning context
    const pos = window.getComputedStyle(msgEl).position;
    if (pos === "static") msgEl.style.position = "relative";

    const btn = document.createElement("button");
    btn.className = "geodude-bookmark-btn";
    btn.textContent = "🪨";
    btn.title = "Add Geodude Bookmark";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      promptAndSave(msgEl);
    });

    msgEl.appendChild(btn);

    msgEl.addEventListener("mouseenter", () => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    });
    msgEl.addEventListener("mouseleave", () => {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    });
  });
}

// ─── Bookmark Storage Helpers ─────────────────────────────────────────────────

function getConversationId() {
  const match = window.location.href.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return match ? match[0] : null;
}

function loadBookmarks(callback) {
  chrome.storage.local.get("bookmarks", (result) => {
    callback(result.bookmarks || {});
  });
}

function saveBookmarks(bookmarks, callback) {
  chrome.storage.local.set({ bookmarks }, callback);
}

// ─── Prompt and Save ──────────────────────────────────────────────────────────

function promptAndSave(messageEl) {
  const name = window.prompt("Enter bookmark name:");
  if (!name || name.trim() === "") return;

  if (!messageEl.id) {
    messageEl.id = "geodude-" + Date.now();
  }

  const conversationId = getConversationId();
  if (!conversationId) {
    alert("Could not determine conversation ID from URL.");
    return;
  }

  loadBookmarks((bookmarks) => {
    if (!bookmarks[conversationId]) {
      bookmarks[conversationId] = [];
    }

    bookmarks[conversationId].push({
      id: "geodude-" + Date.now(),
      name: name.trim(),
      elementId: messageEl.id,
    });

    saveBookmarks(bookmarks, () => {
      renderSidebar();
    });
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function renderSidebar() {
  const conversationId = getConversationId();

  loadBookmarks((bookmarks) => {
    const entries = conversationId ? bookmarks[conversationId] || [] : [];

    // ── Toggle button ──────────────────────────────────────────────────────
    let toggle = document.getElementById("geodude-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "geodude-toggle";
      toggle.textContent = "🪨";
      toggle.title = "Toggle Geodude Bookmarks";
      toggle.addEventListener("click", () => {
        const sidebar = document.getElementById("geodude-sidebar");
        if (sidebar) {
          sidebar.classList.toggle("open");
        }
      });
      document.body.appendChild(toggle);
    }

    // ── Sidebar panel ──────────────────────────────────────────────────────
    let sidebar = document.getElementById("geodude-sidebar");
    if (!sidebar) {
      sidebar = document.createElement("div");
      sidebar.id = "geodude-sidebar";
      document.body.appendChild(sidebar);
    }

    // Build inner HTML
    const itemsHtml =
      entries.length === 0
        ? '<p class="geodude-empty">No bookmarks yet.<br>Right-click or hover a message to add one.</p>'
        : entries
            .map(
              (bm) => `
          <div class="geodude-item" data-element-id="${bm.elementId}">
            <span class="geodude-item-icon">🪨</span>
            <span class="geodude-item-name">${escapeHtml(bm.name)}</span>
          </div>`
            )
            .join("");

    sidebar.innerHTML = `
      <div class="geodude-header">
        <span>🪨 Geodude Bookmarks</span>
        <button class="geodude-close-btn" id="geodude-close">✕</button>
      </div>
      <div class="geodude-list">
        ${itemsHtml}
      </div>
    `;

    // Close button
    document.getElementById("geodude-close").addEventListener("click", () => {
      sidebar.classList.remove("open");
    });

    // Bookmark click → scroll
    sidebar.querySelectorAll(".geodude-item").forEach((item) => {
      item.addEventListener("click", () => {
        const el = document.getElementById(item.dataset.elementId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Brief highlight
          el.classList.add("geodude-highlight");
          setTimeout(() => el.classList.remove("geodude-highlight"), 1500);
        }
      });
    });
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Context Menu Listener ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "contextMenuBookmark") {
    const messages = getMessageElements();
    if (messages.length === 0) return;

    const viewportMid = window.scrollY + window.innerHeight / 2;

    let closest = messages[0];
    let minDist = Infinity;

    messages.forEach((el) => {
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
      el.classList.add("geodude-highlight");
      setTimeout(() => el.classList.remove("geodude-highlight"), 1500);
    }
    // Open the sidebar so the user can see the bookmark list
    const sidebar = document.getElementById("geodude-sidebar");
    if (sidebar) {
      sidebar.classList.add("open");
    }
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  injectHoverButtons();
  renderSidebar();

  // Watch for new messages being added to the DOM
  const chatContainer =
    document.querySelector('div[class*="overflow-y-auto"]') ||
    document.querySelector("main") ||
    document.body;

  const observer = new MutationObserver(() => {
    injectHoverButtons();
  });

  observer.observe(chatContainer, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
