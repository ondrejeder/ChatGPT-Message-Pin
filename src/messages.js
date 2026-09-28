(function initializeMessages(global) {
  "use strict";

  const root = global.CGMB = global.CGMB || {};

  // Keep ChatGPT-specific DOM knowledge here. These selectors are intentionally
  // based on semantic attributes first; update this one module if the site changes.
  const SELECTORS = Object.freeze({
    turn: '[data-testid^="conversation-turn-"][data-turn], [data-turn][data-turn-id]',
    role: '[data-message-author-role="user"], [data-message-author-role="assistant"]',
    message: '[data-testid^="conversation-turn-"][data-turn], [data-turn][data-turn-id], [data-message-author-role="user"], [data-message-author-role="assistant"]',
    messageId: "[data-message-id]",
    actionButton: '[data-testid$="-turn-action-button"]',
    excludedText: "button, svg, script, style, textarea, input, [role=button], .cgmb-message-actions"
  });

  function getConversationId(url = global.location?.href || "") {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^\/c\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
      console.warn("[CGMB] Could not parse the current URL.", error);
      return null;
    }
  }

  function findMessages(rootNode = document) {
    const turns = Array.from(rootNode.querySelectorAll(SELECTORS.turn))
      .filter((element) => getMessageRole(element));
    if (turns.length) {
      return turns;
    }

    const roleElements = Array.from(rootNode.querySelectorAll(SELECTORS.role));
    return roleElements.filter((element) => !element.parentElement?.closest(SELECTORS.role));
  }

  function getRoleElement(element) {
    return element.matches(SELECTORS.role)
      ? element
      : element.querySelector(SELECTORS.role);
  }

  function getMessageRole(element) {
    const turnRole = element.getAttribute("data-turn");
    const role = turnRole || getRoleElement(element)?.getAttribute("data-message-author-role");
    return role === "user" || role === "assistant" ? role : null;
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getMessageText(element) {
    const contentElement = getRoleElement(element) || element;
    const clone = contentElement.cloneNode(true);
    clone.querySelectorAll(SELECTORS.excludedText).forEach((node) => node.remove());
    return normalizeText(clone.textContent);
  }

  function getMessageStableId(element) {
    const roleElement = getRoleElement(element);
    const idElement = element.hasAttribute("data-message-id")
      ? element
      : roleElement?.hasAttribute("data-message-id")
        ? roleElement
        : element.querySelector(SELECTORS.messageId);
    return idElement?.getAttribute("data-message-id")
      || element.getAttribute("data-turn-id")
      || null;
  }

  function hashText(text) {
    const normalized = normalizeText(text).toLocaleLowerCase();
    let hash = 2166136261;
    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function getMessageInfo(element, allMessages = findMessages()) {
    const text = getMessageText(element);
    return {
      element,
      messageId: getMessageStableId(element),
      messageHash: hashText(text),
      messageIndex: allMessages.indexOf(element),
      role: getMessageRole(element),
      text
    };
  }

  function matchesBookmark(info, bookmark, allowIndex = true) {
    if (bookmark.messageId && info.messageId === bookmark.messageId) {
      return true;
    }
    if (bookmark.role === info.role && bookmark.messageHash === info.messageHash) {
      return true;
    }
    return Boolean(
      allowIndex &&
      bookmark.role === info.role &&
      bookmark.messageIndex === info.messageIndex &&
      bookmark.preview &&
      info.text.toLocaleLowerCase().includes(bookmark.preview.slice(0, 48).toLocaleLowerCase())
    );
  }

  function findMessageForBookmark(bookmark) {
    const elements = findMessages();
    const infos = elements.map((element) => getMessageInfo(element, elements));
    return infos.find((info) => bookmark.messageId && info.messageId === bookmark.messageId)?.element
      || infos.find((info) => bookmark.role === info.role && info.messageHash === bookmark.messageHash)?.element
      || infos.find((info) => matchesBookmark(info, bookmark, true))?.element
      || null;
  }

  function truncate(text, maxLength) {
    const normalized = normalizeText(text);
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
  }

  function createPreview(text) {
    return truncate(text, 200);
  }

  function createTitle(text) {
    let normalized = normalizeText(text)
      .replace(/^(ok(?:ay)?|dobře|jasně|tak|hele|prosím|please|thanks|děkuji)[,.:;!\-\s]+/i, "")
      .trim();
    const sentence = normalized.match(/^(.{12,}?[.!?])(?:\s|$)/)?.[1] || normalized;
    return truncate(sentence || "Bookmarked message", 64);
  }

  root.messages = {
    SELECTORS,
    getConversationId,
    findMessages,
    getMessageRole,
    getMessageText,
    getMessageStableId,
    getMessageInfo,
    hashText,
    matchesBookmark,
    findMessageForBookmark,
    createPreview,
    createTitle
  };
})(globalThis);
