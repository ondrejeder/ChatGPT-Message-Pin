"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = {
  console,
  URL,
  location: { href: "https://chatgpt.com/c/current-conversation" }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "src", "messages.js"), "utf8"),
  context
);

const messages = context.CGMB.messages;
assert.equal(messages.getConversationId(), "current-conversation");
assert.equal(messages.getConversationId("https://chatgpt.com/"), null);
assert.equal(messages.getConversationId("https://chatgpt.com/c/a%20b?x=1"), "a b");
assert.equal(messages.hashText(" Hello   WORLD "), messages.hashText("hello world"));
assert.notEqual(messages.hashText("one"), messages.hashText("two"));
assert.equal(messages.createTitle("Ok, This is a useful first sentence. More details follow."), "This is a useful first sentence.");
assert.ok(messages.createTitle("x".repeat(100)).length <= 64);
assert.ok(messages.createPreview("x".repeat(300)).length <= 200);

console.log("Logic tests passed.");
