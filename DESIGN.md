---
name: Castle
description: An online 3D chess club — a lit board in a room you chose, an opponent who talks, people watching.
colors:
  espresso: "#120e0a"
  walnut: "#1c1610"
  cellar: "#0c0907"
  ivory: "#f1e7d3"
  parchment: "#b3a48c"
  seam: "#2d241b"
  brass: "#c9a24a"
  brass-ink: "#1a130d"
  baize: "#3f9b73"
  ember: "#d4644a"
  board-light: "#d9b98a"
  board-dark: "#7a4a22"
  board-select: "#e0bb63"
  board-legal: "#3f9b73"
  board-capture: "#dd7256"
  board-check: "#c4402a"
  light-ivory-ground: "#f3ecdd"
  light-paper: "#fbf7ee"
  light-vellum: "#e9e0cf"
  light-espresso-ink: "#1a130d"
  light-umber: "#5c503f"
  light-seam: "#d9cdb7"
  light-brass: "#806018"
  light-baize: "#1f6b4d"
  light-ember: "#a63d27"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(3rem, 6vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 144, 'SOFT' 40, 'WONK' 1"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 72, 'SOFT' 40, 'WONK' 1"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.12em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  chip: "999px"
  control: "0.625rem"
  card: "1rem"
  panel: "0.75rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-ink}"
  button-outline:
    backgroundColor: "{colors.walnut}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    textColor: "{colors.ivory}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "32px"
  button-danger:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  input-text:
    textColor: "{colors.ivory}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.walnut}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.card}"
    padding: "24px"
  chip:
    backgroundColor: "{colors.walnut}"
    textColor: "{colors.parchment}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "4px 10px"
  chat-bubble-ai:
    backgroundColor: "{colors.walnut}"
    textColor: "{colors.ivory}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "10px 14px"
  chat-bubble-you:
    backgroundColor: "{colors.seam}"
    textColor: "{colors.brass}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "8px 12px"
---

# Design System: Castle

## Overview

**Creative North Star: "The Castle Games Room"**

Castle is the games room of a great house: stone-cool shadows, timber warmth, a board already
set under one good lamp. The interface borrows its materials from the rooms the player actually
sits in — espresso grounds, ivory text, brass for anything you can press, baize green for
anything live — and stays out of the way of the board. The mood is warm, unhurried and assured:
a host who knows the game and does not need to raise their voice.

Density is generous on marketing surfaces and disciplined inside the app frame, where the board
owns the viewport and every control sits in a labelled bar beneath it. Depth comes from tone
(espresso, walnut, cellar) rather than from shadow; shadows belong only to things that float.
The one bold gesture in the whole system is the live 3D board: on the landing page it plays a
historic game in the room the visitor is pointing at, its glow anchored to the top-right corner
and dissolving toward the headline. Everything around that moment is quiet on purpose.

Confirmed rejections: blue-grey shadows and neutral greys (every neutral is warm), decorative
gradients (the only gradient is the hero's light), and personality painted onto the chrome —
character lives in the rooms, the personas and the type, not in ornament.

**Key Characteristics:**
- Palette taken from real materials: espresso, walnut, ivory, brass, baize, ember.
- One accent (brass) for action; baize strictly for live/turn/success; ember strictly for danger/check.
- Fraunces with its optical size and "wonk" axes for headlines only; Geist for UI; Geist Mono, tabular, for anything numeric or notational.
- Tonal layering for depth; a single warm shadow reserved for floating layers.
- The board is the hero and the controls are never hidden.

## Colors

A warm, low-light palette in which brass is the only thing that asks for attention.

### Primary
- **Brass** (`{colors.brass}`): every primary action, the focus ring, selected states, the active tab rule, the last-move square, the italic word in a headline. It reads as the metal on the pieces' bases and the lamp's fitting. Text on brass is **Brass Ink** (`{colors.brass-ink}`).

### Secondary
- **Baize** (`{colors.baize}`): the tournament-table green. Live indicators, "to move" dots, success states, legal-move markers on the board. Never used for buttons.

### Tertiary
- **Ember** (`{colors.ember}`): resign, destructive confirmations, the check indicator, capture markers. Never decorative.

### Neutral
- **Espresso** (`{colors.espresso}`): the page ground.
- **Walnut** (`{colors.walnut}`): cards, the sidebar, the header once it has scrolled, chat bubbles from the opponent.
- **Cellar** (`{colors.cellar}`): sunken wells — the move list, the chat scroll area, inputs, code.
- **Ivory** (`{colors.ivory}`): primary text and icons.
- **Parchment** (`{colors.parchment}`): secondary text, labels, eyebrows, notation that is not the current move.
- **Seam** (`{colors.seam}`): hairlines, borders, the player's own chat bubbles.
- **Board Light / Board Dark** (`{colors.board-light}` / `{colors.board-dark}`): the squares in mini boards and illustrations; the 3D rooms carry their own square colours.
- Light theme counterparts (`light-*`) keep the same roles on an ivory ground; nothing is designed light-first.

### Named Rules
**The One Metal Rule.** Brass is the only accent used for actions and emphasis, and it covers no more than a tenth of any screen. Its rarity is what makes a primary button read as primary.

**The Live Green Rule.** Baize means "happening now": a live game, the side to move, a success. If it is not live, it is not green.

**The Warm Neutral Rule.** No neutral is grey. Every background, border and muted text is a tint of espresso or ivory, so the chrome and the wooden rooms belong to the same world.

## Typography

**Display Font:** Fraunces (variable; with Georgia, serif)
**Body Font:** Geist (with system-ui, sans-serif)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace)

**Character:** An engraved serif with soft terminals set against a plain modern grotesk. Fraunces
at large optical sizes with the "wonk" axis on reads like lettering on a trophy; Geist keeps the
interface neutral and legible; Geist Mono gives notation, ratings and clocks the tabular
discipline of a scoresheet.

### Hierarchy
- **Display** (500, clamp(3rem, 6vw, 4.5rem), 0.98): landing headline and result-dialog verdicts only; one italic word per headline at most, set in brass.
- **Headline** (500, 2.5rem, 1.05): section titles on marketing pages, page titles in the app frame at a smaller size (1.25–2.25rem).
- **Title** (600, 1.25rem, 1.3): card titles, dialog titles, sidebar tab headings.
- **Body** (400, 0.9375rem marketing / 0.875rem app frame, 1.6): copy; keep measure to 46–60 characters.
- **Label** (500, 0.8125rem, 0.12em tracking, uppercase): eyebrows, section labels, table headers.
- **Data** (500, 0.8125rem mono, tabular figures): move notation, ratings, clocks, coordinates, IDs.

### Named Rules
**The Scoresheet Rule.** Anything a player would write on a scoresheet — moves, ratings, clocks, coordinates — is set in Geist Mono with tabular figures, never in the UI face.

**The One Italic Rule.** A display headline carries at most one italic word, and that word is brass.

## Layout

Marketing pages sit on a 12-column grid, max width 1280px, 24px gutters, with sections spaced by
96px on desktop and 64px on mobile. The app frame has no page scroll on desktop: a 56px header,
then a grid of a board column and a 380px sidebar (400px from 1440px), sized to the viewport
height; the board is a square fitted to the remaining height, with 48px player rows above and
below and a 56px action bar beneath. Below 1024px the game screen becomes a single column: player
row, square board at full width, sticky action bar, then a bottom sheet carrying the sidebar
tabs. Spacing follows a 4px base (4 / 8 / 16 / 24 / 40) with 96px between marketing sections.
Buttons are 32px tall by default (36px large) with at least 36px of tappable area on touch; the action bar's buttons show icon and label from 1280px and
icon-only with a tooltip below that.

## Elevation & Depth

Depth is tonal. Surfaces step up from espresso (ground) to walnut (cards, sidebar) to cellar
wells that sink back; hairlines in seam separate regions. The single shadow token is warm and
soft and appears only on layers that genuinely float above the page: popovers, dialogs, the
fullscreen HUD and the hero board's glow. Cards at rest carry no shadow; the scrolled header
uses a walnut tint with a blur rather than a shadow.

### Shadow Vocabulary
- **Soft float** (`box-shadow: 0 20px 60px -30px rgb(0 0 0 / 0.35)`): dialogs, popovers, the floating HUD, hero canvas glow. Nothing else.

### Named Rules
**The Only-Floating-Things-Cast-Shadows Rule.** If an element is part of the page's structure it gets tone and a hairline, never a shadow.

## Shapes

Softly rounded, never pill-shaped except for chips. Controls use a 10px radius, panels and
bubbles 12px, cards 16px, chips and avatars are fully round. Chat bubbles from the opponent
tuck their top-left corner to 4px so the tail points at the speaker; the player's bubbles tuck the
top-right. Hairline borders are 1px seam; the brass focus ring is a 3px ring at 50% opacity
outside the control. The board's frame and squares are the only hard-edged rectangles in the
system.

## Components

Tactile and confident: solid brass primaries, generous hit areas, crisp 120ms colour changes.
Things feel like well-made pieces you can pick up.

### Buttons
- **Shape:** softly rounded (10px radius), 32px tall by default and 36px for the large size, 10px horizontal padding, medium weight label.
- **Primary:** brass fill with brass-ink text; hover darkens the fill slightly (80% mix) over 120ms; focus shows the brass ring.
- **Outline:** walnut fill with a seam hairline and ivory text; used for the second action beside a primary.
- **Ghost:** no fill, ivory or parchment text; hover paints a faint walnut wash. Used in the action bar and header.
- **Danger:** ember fill, ivory text; always behind a confirmation dialog when the action is irreversible.
- **Action bar buttons:** icon plus label, label hidden below 1280px, tooltip with the keyboard shortcut in a `Kbd` cap; disabled buttons keep their tooltip and explain why.

### Chips
- **Style:** fully round, walnut fill, parchment label text; a leading baize dot when the chip means "live".
- **State:** selected chips switch to a seam fill with ivory text and a brass ring; the pool tabs on the leaderboard and the room cards follow the same selected treatment.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** walnut on the espresso ground; nested wells use cellar.
- **Shadow Strategy:** none at rest (see Elevation); floating variants use the single soft shadow.
- **Border:** 1px seam hairline.
- **Internal Padding:** 24px on marketing cards, 16px in the app frame.

### Inputs / Fields
- **Style:** transparent over its surface (a faint seam tint in dark mode), seam hairline, ivory text, 10px radius, 32px tall, 10px padding; placeholders in parchment.
- **Focus:** hairline turns brass and the 3px brass ring appears; no glow.
- **Error / Disabled:** error hairline in ember with a one-line message beneath in ember; disabled drops to 50% opacity and keeps its label.

### Navigation
- **Header:** 56px, knight glyph plus the wordmark "Castle" in Geist 600, primary links in parchment turning ivory on hover with a walnut wash for the active route. Transparent with no border over the landing hero; walnut at 80% with blur and a seam hairline once scrolled. Hidden entirely in the game's focus (fullscreen) layout.
- **Sidebar tabs (game):** three tabs with a brass underline on the active one; on mobile the same tabs sit in a bottom sheet opened at a 40% peek.

### Signature Component: the lit board
The 3D board is the system's one theatrical element. On the landing page it runs in showcase
mode — non-interactive, slow cinematic orbit, medium quality, no post-processing — with its
canvas masked so the room's glow is anchored to the top-right corner and dissolves diagonally
toward the headline. In play it fills the board column, square, with the labelled action bar
directly beneath. It is never framed, boxed or given a border; the room's light is its edge.

### Signature Component: the chat
The opponent's commentary is a chat, not a log. Opponent messages are walnut bubbles with a
lettered brass disc for the persona and the move number as a label; the player's actions are
seam bubbles with brass text on the right; system events are centred parchment chips. A
thinking bubble with three pulsing dots holds the place while the opponent decides, and after
three seconds says so plainly.

## Do's and Don'ts

### Do:
- **Do** keep brass under a tenth of any screen and use it for exactly one thing per view: the primary action, the selection, or the emphasised word.
- **Do** set every move, rating, clock and coordinate in Geist Mono with tabular figures.
- **Do** put every game action in the visible action bar with a text label at desktop widths and a tooltip below that; disabled actions keep their tooltip and say why.
- **Do** step depth by tone (espresso → walnut → cellar) and reserve the soft shadow for dialogs, popovers, the HUD and the hero glow.
- **Do** respect `prefers-reduced-motion`: no staggers, no auto-orbit, instant room swaps, static bubbles.

### Don't:
- **Don't** introduce a second accent, a gradient, or a cool grey; the only gradient in the system is the hero's light.
- **Don't** use baize or ember for anything that is not live or dangerous respectively.
- **Don't** set body copy or UI labels in Fraunces, or exceed one italic word in a headline.
- **Don't** frame the 3D board with a border, card or box; its light is its edge.
- **Don't** hide primary game actions behind a menu on desktop, and don't exclaim in chrome copy.
