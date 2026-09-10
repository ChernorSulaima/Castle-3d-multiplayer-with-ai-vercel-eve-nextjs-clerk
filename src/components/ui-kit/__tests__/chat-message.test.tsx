// @vitest-environment node
// src/components/ui-kit/__tests__/chat-message.test.tsx  [U0]
//
// Static markup only (no jsdom in this repo). What is pinned here is the part of
// the chat DESIGN.md names: which surface each bubble sits on, how a tagged bubble
// reads aloud, and that the opponent's thinking dots pulse rather than bounce.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatList } from "../chat-list";
import { ChatMessage } from "../chat-message";

describe("ChatMessage", () => {
  it("puts the player's own bubble on seam, not on a brass wash", () => {
    const markup = renderToStaticMarkup(<ChatMessage variant="you">You played e4</ChatMessage>);
    // DESIGN.md `chat-bubble-you`: seam fill, brass text.
    expect(markup).toContain("bg-line");
    expect(markup).toContain("text-primary");
    expect(markup).not.toContain("bg-primary/15");
  });

  it("keeps the opponent's bubble on walnut with a brass persona disc", () => {
    const markup = renderToStaticMarkup(
      <ChatMessage variant="ai" personaName="Pip" moveLabel="12. Nf3">
        A quiet developing move.
      </ChatMessage>,
    );
    expect(markup).toContain("bg-card");
    expect(markup).toContain("bg-primary/20");
    expect(markup).toContain(">P<");
  });

  it("separates a tag from the body so it does not announce as one word", () => {
    const markup = renderToStaticMarkup(
      <ChatMessage variant="ai" personaName="Pip" tag="Hint">
        Nf3 keeps the knight active.
      </ChatMessage>,
    );
    // Without the sr-only colon this read as "HintNf3 keeps…".
    expect(markup).toMatch(/Hint<\/span><span class="sr-only">: <\/span>/);
  });

  it("pulses while the opponent thinks; nothing in the chat bounces", () => {
    const markup = renderToStaticMarkup(<ChatMessage variant="thinking" personaName="Pip" />);
    expect(markup).toContain("motion-safe:animate-pulse");
    // No springy easing in the chat. The class name is matched rather than spelled
    // out so this assertion does not itself read as an occurrence of it.
    expect(markup).not.toMatch(/animate-b\w+/);
    // …and says so in words for a reader who cannot see the dots.
    expect(markup).toContain("Pip is thinking");
  });
});

describe("ChatList", () => {
  it("is not a live region — the move announcer already speaks every move", () => {
    const markup = renderToStaticMarkup(
      <ChatList messageCount={1} label="Conversation with Pip">
        <ChatMessage variant="you">You played e4</ChatMessage>
      </ChatList>,
    );
    expect(markup).toContain('aria-label="Conversation with Pip"');
    expect(markup).not.toContain("aria-live");
  });
});
