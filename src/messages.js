(function initializeMessages(global) {
  "use strict";

  const root = global.CGMB = global.CGMB || {};

  // Keep ChatGPT-specific DOM knowledge here. These selectors are intentionally
  // based on semantic attributes first; update this one module if the site changes.
  const SELECTORS = Object.freeze({
    turn: '[data-testid^="conversation-turn-"], [data-turn][data-turn-id]',
    role: '[data-message-author-role="user"], [data-message-author-role="assistant"]',
    modernUser: '[data-content-search-unit-key$=":user"]',
    modernAssistant: '[data-content-search-unit-key$=":assistant"], [data-content-search-turn-key]',
    message: '[data-testid^="conversation-turn-"], [data-turn][data-turn-id], [data-message-author-role="user"], [data-message-author-role="assistant"], [data-content-search-unit-key$=":user"], [data-content-search-unit-key$=":assistant"], [data-content-search-turn-key], [data-user-message-bubble="true"]',
    messageId: "[data-message-id]",
    actionButton: '[data-testid$="-turn-action-button"]',
    actionBar: ".turn-action-controls",
    excludedText: "button, svg, script, style, textarea, input, [role=button], .sr-only, .turn-action-controls, .cgmb-message-actions"
  });

  function getConversationId(url = global.location?.href || "") {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/(?:^|\/)c\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (error) {
      console.warn("[CGMB] Could not parse the current URL.", error);
      return null;
    }
  }

  function findMessages(rootNode = document) {
    const candidates = Array.from(rootNode.querySelectorAll(
      `${SELECTORS.turn}, ${SELECTORS.modernUser}, ${SELECTORS.modernAssistant}`
    )).filter((element) => getMessageRole(element));

    rootNode.querySelectorAll(SELECTORS.actionBar).forEach((actionBar) => {
      const modernMessage = actionBar.closest(
        `${SELECTORS.modernUser}, ${SELECTORS.modernAssistant}`
      );
      if (modernMessage) {
        candidates.push(modernMessage);
      }
    });

    rootNode.querySelectorAll(`${SELECTORS.role}, [data-user-message-bubble="true"]`).forEach((element) => {
      if (!candidates.some((candidate) => candidate.contains(element))) {
        candidates.push(element);
      }
    });

    const messages = Array.from(new Set(candidates))
      .filter((element) => getMessageRole(element))
      .filter((element, index, all) => !all.some((other, otherIndex) =>
        index !== otherIndex && other.contains(element) && getMessageRole(other) === getMessageRole(element)))
      .sort((left, right) => {
        if (left === right) {
          return 0;
        }
        return left.compareDocumentPosition(right) & 4 ? -1 : 1;
      });
    if (messages.length) {
      return messages;
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
    const unitKey = element.getAttribute("data-content-search-unit-key") || "";
    let modernRole = null;
    if (unitKey.endsWith(":user") || element.matches('[data-user-message-bubble="true"]')) {
      modernRole = "user";
    } else if (unitKey.endsWith(":assistant")) {
      modernRole = "assistant";
    } else if (element.matches("[data-content-search-turn-key]")
      && !element.querySelector('[data-user-message-bubble="true"]')) {
      modernRole = "assistant";
    }
    const role = turnRole
      || getRoleElement(element)?.getAttribute("data-message-author-role")
      || modernRole;
    return role === "user" || role === "assistant" ? role : null;
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getMessageText(element) {
    const contentElement = getRoleElement(element)
      || element.querySelector('[data-user-message-bubble="true"]')
      || element;
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
      || (element.getAttribute("data-chatgpt-search-message-ids")
        || element.closest('[data-chatgpt-search-message-ids]')?.getAttribute("data-chatgpt-search-message-ids"))?.trim().split(/\s+/)[0]
      || null;
  }

  function getActionButton(element) {
    return element.querySelector(SELECTORS.actionButton)
      || element.querySelector(`${SELECTORS.actionBar} button`);
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
      turnKey: element.closest('[data-turn-key]')?.getAttribute('data-turn-key') || null,
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

  function findTurnAnchor(bookmark) {
    return Array.from(document.querySelectorAll('[data-turn-key]')).find((element) =>
      element.getAttribute('data-turn-key') === (bookmark.turnKey || bookmark.messageId)) || null;
  }

  function getConversationScroller() {
    let element = document.querySelector('[data-turn-key], [data-content-search-unit-key]');
    while (element?.parentElement) {
      element = element.parentElement;
      if (/(auto|scroll)/.test(global.getComputedStyle(element).overflowY)
        && element.scrollHeight > element.clientHeight) {
        return element;
      }
    }
    return document.scrollingElement;
  }

  async function resolveBookmark(bookmark, isCancelled = () => false) {
    let found = findMessageForBookmark(bookmark);
    if (found || isCancelled()) {
      return found;
    }
    const scroller = getConversationScroller();
    if (!scroller) {
      return null;
    }
    const originalTop = scroller.scrollTop;
    const deadline = Date.now() + 30000;
    const pause = () => new Promise((resolve) => global.setTimeout(resolve, 180));
    const jump = (top) => scroller.scrollTo({ top, behavior: 'instant' });
    const anchor = findTurnAnchor(bookmark);
    if (anchor) {
      // An empty virtualized turn still has a measured height. Bringing its
      // anchor into view asks ChatGPT to mount the message content again.
      anchor.scrollIntoView({ block: 'center', behavior: 'instant' });
      for (let retry = 0; retry < 10 && !isCancelled(); retry += 1) {
        await pause();
        found = findMessageForBookmark(bookmark);
        if (found) {
          return found;
        }
      }
    }
    // Older bookmarks have no turn anchor. Scan overlapping viewports from
    // the start so that lazy-loaded and unmounted messages can be rediscovered.
    jump(0);
    let stalled = 0;
    let previousHeight = -1;
    for (let step = 0; step < 140 && Date.now() < deadline && !isCancelled(); step += 1) {
      await pause();
      if (isCancelled()) {
        break;
      }
      found = findMessageForBookmark(bookmark);
      if (found) {
        return found;
      }
      const targetAnchor = findTurnAnchor(bookmark);
      if (targetAnchor) {
        targetAnchor.scrollIntoView({ block: 'center', behavior: 'instant' });
        await pause();
        found = findMessageForBookmark(bookmark);
        if (found) {
          return found;
        }
      }
      // Give prepended history a moment to settle before leaving the top.
      if (step < 5) {
        jump(0);
        continue;
      }
      const before = scroller.scrollTop;
      jump(before + Math.max(240, scroller.clientHeight * 0.65));
      if (Math.abs(scroller.scrollTop - before) < 2 && previousHeight === scroller.scrollHeight) {
        stalled += 1;
        if (stalled >= 8) {
          break;
        }
      } else {
        stalled = 0;
      }
      previousHeight = scroller.scrollHeight;
    }
    if (!isCancelled()) {
      jump(originalTop);
    }
    return null;
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
    getActionButton,
    getMessageInfo,
    hashText,
    matchesBookmark,
    findMessageForBookmark,
    resolveBookmark,
    createPreview,
    createTitle
  };
})(globalThis);
