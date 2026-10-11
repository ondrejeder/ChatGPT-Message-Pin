(function initializeContentScript(global) {
  "use strict";

  const root = global.CGMB;
  if (!root?.storage || !root?.messages || !root?.ui) {
    console.error("[CGMB] Extension modules did not initialize in the expected order.");
    return;
  }

  const state = {
    conversationId: null,
    bookmarks: [],
    panelOpen: false,
    refreshTimer: null,
    loadToken: 0,
    navigationToken: 0,
    suppressStorageUntil: 0,
    shell: null
  };

  function makeId() {
    if (global.crypto?.randomUUID) {
      return global.crypto.randomUUID();
    }
    return `cgmb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function bookmarkForMessage(messageElement, allowIndex = false) {
    const messages = root.messages.findMessages();
    const info = root.messages.getMessageInfo(messageElement, messages);
    return state.bookmarks.find((bookmark) => root.messages.matchesBookmark(info, bookmark, allowIndex)) || null;
  }

  function refreshControls() {
    root.ui.refreshNewChatLinks();
    const messages = root.messages.findMessages();
    messages.forEach((messageElement) => {
      const button = root.ui.addMessageControl(messageElement, { onToggleBookmark });
      button.hidden = !state.conversationId;
      root.ui.setMessageControlState(messageElement, Boolean(bookmarkForMessage(messageElement, false)));
    });
  }

  function render() {
    if (!state.shell) {
      return;
    }
    state.shell.toggle.hidden = !state.conversationId;
    if (!state.conversationId) {
      root.ui.setStatus(state.shell, "Open a saved conversation to use message bookmarks.");
      root.ui.renderList(state.shell, [], listHandlers());
      refreshControls();
      return;
    }
    root.ui.setStatus(state.shell, "");
    root.ui.renderList(state.shell, state.bookmarks, listHandlers());
    refreshControls();
  }

  function listHandlers() {
    return {
      onNavigate: navigateToBookmark,
      onRemove: removeBookmark,
      onRename: renameBookmark
    };
  }

  async function loadConversation(force = false) {
    const nextId = root.messages.getConversationId();
    if (!force && nextId === state.conversationId) {
      refreshControls();
      return;
    }

    const token = ++state.loadToken;
    state.conversationId = nextId;
    state.bookmarks = [];
    root.ui.setPanelOpen(state.shell, false);
    state.panelOpen = false;
    render();

    if (!nextId) {
      return;
    }

    try {
      const record = await root.storage.getConversation(nextId);
      if (token !== state.loadToken || nextId !== state.conversationId) {
        return;
      }
      state.bookmarks = record.bookmarks;
      render();
    } catch (error) {
      console.error("[CGMB] Could not load bookmarks.", error);
      root.ui.setStatus(state.shell, "Bookmarks could not be loaded.");
    }
  }

  async function persistBookmarks() {
    const conversationId = state.conversationId;
    if (!conversationId) {
      return;
    }
    state.suppressStorageUntil = Date.now() + 1000;
    try {
      await root.storage.saveConversation(conversationId, {
        version: 1,
        bookmarks: state.bookmarks
      });
    } finally {
      state.suppressStorageUntil = Math.max(state.suppressStorageUntil, Date.now() + 250);
    }
  }

  async function onToggleBookmark(messageElement) {
    if (!state.conversationId) {
      return;
    }

    const previousBookmarks = state.bookmarks;
    try {
      const existing = bookmarkForMessage(messageElement, false);
      if (existing) {
        state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== existing.id);
      } else {
        const messages = root.messages.findMessages();
        const info = root.messages.getMessageInfo(messageElement, messages);
        if (!info.role || !info.text) {
          return;
        }
        state.bookmarks = [
          ...state.bookmarks,
          {
            id: makeId(),
            messageId: info.messageId,
            turnKey: info.turnKey,
            messageHash: info.messageHash,
            messageIndex: info.messageIndex,
            role: info.role,
            title: root.messages.createTitle(info.text),
            preview: root.messages.createPreview(info.text),
            createdAt: Date.now()
          }
        ];
      }
      await persistBookmarks();
      render();
    } catch (error) {
      state.bookmarks = previousBookmarks;
      render();
      console.error("[CGMB] Could not update the bookmark.", error);
      root.ui.setStatus(state.shell, "The bookmark could not be saved.");
    }
  }

  async function removeBookmark(bookmarkId) {
    const previousBookmarks = state.bookmarks;
    state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId);
    try {
      await persistBookmarks();
      render();
    } catch (error) {
      state.bookmarks = previousBookmarks;
      render();
      console.error("[CGMB] Could not remove the bookmark.", error);
      root.ui.setStatus(state.shell, "The bookmark could not be removed.");
    }
  }

  async function renameBookmark(bookmarkId, title) {
    const previousBookmarks = state.bookmarks;
    state.bookmarks = state.bookmarks.map((bookmark) => bookmark.id === bookmarkId
      ? { ...bookmark, title: title.slice(0, 64) }
      : bookmark);
    try {
      await persistBookmarks();
      render();
    } catch (error) {
      state.bookmarks = previousBookmarks;
      render();
      console.error("[CGMB] Could not rename the bookmark.", error);
      root.ui.setStatus(state.shell, "The new title could not be saved.");
    }
  }

  async function navigateToBookmark(bookmark) {
    const token = ++state.navigationToken;
    const conversationId = state.conversationId;
    const cancelled = () => token !== state.navigationToken
      || conversationId !== root.messages.getConversationId();
    const element = await root.messages.resolveBookmark(bookmark, cancelled);
    if (!element || cancelled()) {
      return false;
    }
    // Upgrade old bookmarks after finding them without changing their labels.
    const info = root.messages.getMessageInfo(element);
    if (info.turnKey && bookmark.turnKey !== info.turnKey) {
      state.bookmarks = state.bookmarks.map((entry) => entry.id === bookmark.id
        ? { ...entry, turnKey: info.turnKey, messageId: info.messageId || entry.messageId }
        : entry);
      persistBookmarks().catch((error) => console.warn('[CGMB] Could not save navigation anchor.', error));
    }
    state.panelOpen = false;
    root.ui.setPanelOpen(state.shell, false);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    root.ui.highlightMessage(element);
    return true;
  }

  function togglePanel() {
    if (!state.conversationId) {
      return;
    }
    state.panelOpen = !state.panelOpen;
    root.ui.setPanelOpen(state.shell, state.panelOpen);
  }

  function closePanel() {
    state.panelOpen = false;
    root.ui.setPanelOpen(state.shell, false);
  }

  function scheduleRefresh() {
    global.clearTimeout(state.refreshTimer);
    state.refreshTimer = global.setTimeout(() => {
      state.refreshTimer = null;
      const nextId = root.messages.getConversationId();
      if (nextId !== state.conversationId) {
        loadConversation();
      } else {
        refreshControls();
      }
    }, 180);
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => {
        if (mutation.target.nodeType === Node.ELEMENT_NODE
          && mutation.target.closest?.('.cgmb-panel, .cgmb-message-actions, .cgmb-new-chat-row')) {
          return false;
        }
        if (mutation.target.nodeType === Node.ELEMENT_NODE
          && mutation.target.closest?.(root.messages.SELECTORS.message)) {
          return true;
        }
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
          }
          return node.matches?.(root.messages.SELECTORS.message)
            || node.querySelector?.(root.messages.SELECTORS.message)
            || node.querySelector?.("main")
            || node.matches?.('nav, aside, button, a')
            || node.querySelector?.('nav, aside, button, a');
        });
      });
      if (relevant || root.messages.getConversationId() !== state.conversationId) {
        scheduleRefresh();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    // pushState is page-world-only; polling the URL catches navigation even
    // when React changes history without a matching message mutation.
    global.setInterval(() => {
      if (root.messages.getConversationId() !== state.conversationId) {
        loadConversation();
      }
    }, 700);
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && state.panelOpen) {
      closePanel();
      return;
    }
    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      togglePanel();
    }
  }

  function handleStorageChange(changes, areaName) {
    if (Date.now() < state.suppressStorageUntil) {
      return;
    }
    if ((areaName === "sync" || areaName === "local") && state.conversationId) {
      const changed = Object.keys(changes).some((key) => root.storage.isConversationStorageKey(key, state.conversationId));
      if (changed) {
        loadConversation(true);
      }
    }
  }

  function init() {
    state.shell = root.ui.createShell({
      onTogglePanel: togglePanel,
      onClosePanel: closePanel
    });
    document.addEventListener("keydown", handleKeydown, true);
    const cancelNavigation = (event) => {
      if (event.isTrusted && !event.target.closest?.('.cgmb-panel')) {
        state.navigationToken += 1;
      }
    };
    document.addEventListener('wheel', cancelNavigation, { passive: true, capture: true });
    document.addEventListener('touchstart', cancelNavigation, { passive: true, capture: true });
    document.addEventListener('keydown', (event) => {
      if (['Escape', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        cancelNavigation(event);
      }
    }, true);
    global.addEventListener("popstate", () => loadConversation());
    global.addEventListener("hashchange", () => loadConversation());
    global.addEventListener("pageshow", () => loadConversation(true));
    browser.storage.onChanged.addListener(handleStorageChange);
    startObserver();
    loadConversation(true);
  }

  try {
    init();
  } catch (error) {
    console.error("[CGMB] The extension could not initialize.", error);
  }
})(globalThis);
