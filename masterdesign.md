---
version: 1.0
name: ECE-Copilot-Master-Design
description: "A master design system optimized for an AI-first Hardware Engineering IDE. This system fuses the absolute precision of Linear (void-black canvas, strict hairlines), the terminal-native developer focus of Voltagent (mono-typography, code blocks), and the AI-orchestration warmth of Cursor (dedicated timeline pastels for agent actions). The result is an ultra-modern, dark-mode engineering platform that feels both highly technical and guided by intelligent AI."

colors:
  # Primary Brand (Linear-inspired Lavender/Indigo)
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  primary-hover: "#828fff"
  primary-focus: "#5e69d1"
  
  # Secondary / Hardware (Voltagent-inspired Electric Green)
  secondary-accent: "#00d992"

  # Surfaces & Canvas (Linear deepest black)
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  
  # Borders (Linear / Voltagent hairlines)
  hairline: "#23252a"
  hairline-strong: "#34343a"

  # Text / Ink
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  
  # Semantic
  semantic-success: "#00d992"
  semantic-error: "#cf2d56"
  
  # AI Action Timeline (Cursor-inspired pastel indicators)
  timeline-routing: "#9fbbe0"     # Blue (Ingestion)
  timeline-thinking: "#dfa88f"    # Peach (LLM Analyzing)
  timeline-generating: "#c0a8dd"  # Lavender (Verilog/Math)
  timeline-done: "#00d992"        # Electric Green (Success)

typography:
  display-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 48px
    fontWeight: 600
    letterSpacing: -1.2px
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    letterSpacing: -0.6px
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  eyebrow-mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 1.5px
    textTransform: uppercase

rounded:
  sm: 4px
  md: 8px
  lg: 12px
  pill: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px

components:
  canvas-workspace:
    backgroundColor: "{colors.canvas}"
    description: "The void-black infinite canvas where circuits are drawn."
  
  tool-panel:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    description: "Floating toolbars and the AI Copilot sidebar."
    
  code-block:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    borderColor: "{colors.hairline-strong}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"

  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    
  ai-status-pill:
    typography: "{typography.eyebrow-mono}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    description: "Uses timeline colors depending on LangGraph node status."

---

## ECE Copilot Master UI/UX Philosophy

By synthesizing the best elements of Linear, Voltagent, and Cursor, ECE Copilot achieves a perfect balance of **technical precision** and **AI warmth**.

### 1. The Void-Black Canvas (Linear x Voltagent)
Engineering tools require zero distraction. We use Linear's deepest black (`#010102`) for the primary React Flow circuit canvas. Floating panels (like Truth Tables, BOMs, and Chat) sit on `surface-1` (`#0f1011`) separated exclusively by 1px hairlines (`#23252a`). **There are no drop shadows.** Depth is achieved entirely through borders and subtle surface lightening.

### 2. The Twin Typography System (Voltagent x Cursor)
- **Narrative & UI:** `Inter` handles all UI controls, chat bubbles, and panel headers. It provides a calm, highly-legible documentation feel.
- **Engineering Data:** `JetBrains Mono` handles all Verilog code blocks, Truth Table matrices, and system logs. This clear separation tells the user: "This is prose" vs "This is data."

### 3. The AI Timeline Pastels (Cursor)
When the LangGraph backend is processing a circuit, the UI shouldn't just show a generic spinner. We adopt Cursor's pastel timeline system to show exactly what the AI is doing:
- **Blue (`#9fbbe0`)**: Routing to the correct domain (Digital/Analog).
- **Peach (`#dfa88f`)**: LLM actively analyzing the circuit logic.
- **Lavender (`#c0a8dd`)**: Generating structural HDL / Math artifacts.
- **Electric Green (`#00d992`)**: Done and rendered.

### 4. Accent Hierarchy
- **Indigo/Lavender (`#5e6ad2`)**: The primary brand color. Used for UI interactions, active tabs, and AI chat bubbles.
- **Electric Green (`#00d992`)**: Inherited from Voltagent, this is the "Hardware Live" color. Used for high signals in Timing Diagrams, success toasts, and "Run Simulation" buttons.

### Execution Rules
1. **Never use pure white backgrounds** for any component.
2. **Never use drop shadows**; rely on the 4-step surface ladder and hairlines.
3. Keep padding dense (8px-16px) for technical panels to maximize screen real estate for the canvas.
4. Render all mathematical outputs (HDL, Tables) in `JetBrains Mono`.
