(function initializeStorage(global) {
  "use strict";

  const root = global.CGMB = global.CGMB || {};
  const KEY_PREFIX = "cgmb-conversation-v1:";
  const BACKEND_PREFIX = "cgmb-backend-v1:";

  function dataKey(conversationId) {
    return `${KEY_PREFIX}${conversationId}`;
  }

  function backendKey(conversationId) {
    return `${BACKEND_PREFIX}${conversationId}`;
  }

  function emptyRecord() {
    return { version: 1, bookmarks: [] };
  }

  function normalizeRecord(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.bookmarks)) {
      return emptyRecord();
    }

    return {
      version: 1,
      bookmarks: value.bookmarks.filter((bookmark) => bookmark && typeof bookmark.id === "string")
    };
  }

  async function readArea(area, key) {
    const result = await area.get(key);
    return normalizeRecord(result[key]);
  }

  async function getPreferredBackend(conversationId) {
    try {
      const key = backendKey(conversationId);
      const result = await browser.storage.local.get(key);
      return result[key] === "local" ? "local" : "sync";
    } catch (error) {
      console.warn("[CGMB] Could not read the storage backend marker.", error);
      return "sync";
    }
  }

  async function getConversation(conversationId) {
    if (!conversationId) {
      return emptyRecord();
    }

    const key = dataKey(conversationId);
    const preferredBackend = await getPreferredBackend(conversationId);

    if (preferredBackend === "local") {
      try {
        return await readArea(browser.storage.local, key);
      } catch (error) {
        console.warn("[CGMB] Could not read local bookmark storage.", error);
        return emptyRecord();
      }
    }

    try {
      return await readArea(browser.storage.sync, key);
    } catch (error) {
      console.warn("[CGMB] Sync storage is unavailable; reading local fallback.", error);
      try {
        return await readArea(browser.storage.local, key);
      } catch (localError) {
        console.warn("[CGMB] Could not read local bookmark storage.", localError);
        return emptyRecord();
      }
    }
  }

  async function saveConversation(conversationId, record) {
    if (!conversationId) {
      throw new Error("A conversation ID is required before bookmarks can be saved.");
    }

    const key = dataKey(conversationId);
    const normalized = normalizeRecord(record);

    try {
      await browser.storage.sync.set({ [key]: normalized });
      await browser.storage.local.remove([key, backendKey(conversationId)]);
      return "sync";
    } catch (error) {
      console.warn("[CGMB] Sync write failed; using local storage fallback.", error);
      await browser.storage.local.set({
        [key]: normalized,
        [backendKey(conversationId)]: "local"
      });
      return "local";
    }
  }

  async function updateConversation(conversationId, updater) {
    const current = await getConversation(conversationId);
    const updated = normalizeRecord(await updater(current));
    await saveConversation(conversationId, updated);
    return updated;
  }

  function isConversationStorageKey(key, conversationId) {
    return key === dataKey(conversationId);
  }

  root.storage = {
    getConversation,
    saveConversation,
    updateConversation,
    isConversationStorageKey
  };
})(globalThis);
