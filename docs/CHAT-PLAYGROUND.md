# Chat Playground

A persistent, multi-conversation AI chat surface built into Cryptex. All data
lives in your browser's IndexedDB — nothing is sent to a server except the
messages you explicitly send to an AI provider using your own BYOK key.

---

## Getting started

1. Click the **Chat** pill in the header (top-right of the toolbar).
2. Click **New chat** in the left sidebar (or press `Ctrl+K` → "New chat").
3. Pick a model from the model picker in the workspace header.
4. Type a message and press `Enter` (or `Shift+Enter` for a newline).

The conversation title is auto-generated from your first message. Click the
title to rename it.

---

## Slash commands

Type `/` in the composer to open the command palette.

### Mutators (rewrite the last assistant message)

| Command | Effect |
|---|---|
| `/rephrase` | Neutral rewrite, different phrasing |
| `/obfuscate` | Steganographic / encoded rewording |
| `/roleplay` | Recast as a fictional character |
| `/multilingual` | Translate or code-switch |
| `/expand` | Lengthen with more detail |
| `/compress` | Shorten to essentials |
| `/metaphor` | Rewrite using an extended metaphor |
| `/fragment` | Break into short punchy fragments |
| `/custom` | Freeform rewrite prompt |

### Special

| Command | Effect |
|---|---|
| `/btw` | Out-of-context note — captured in the dataset but not sent to the LLM |

---

## Attachments

Click the paperclip icon or drag a file onto the composer. Supported types:

- **Images** (PNG, JPEG, WebP, GIF) — sent as multimodal content to vision-capable models
- **PDF** — text extracted via PDF.js and injected as context
- **DOCX** — text extracted via Mammoth and injected as context
- **Plain text / Markdown / JSON / CSV** — pasted directly as context

Attachments are stored in IndexedDB alongside their message. They are never
uploaded to Cryptex's servers (there are none).

---

## Techniques sidebar

The right sidebar lists every available technique:

- **162 transformers** — the same ciphers, encoders, and steganography tools from the Transform tab
- **9 mutators** — also available as slash commands
- **9 classifier techniques** — scoring / labelling helpers
- **3 conversation modes** — creative, intelligent, adaptive

Click a technique to apply it to the current message, or pin it to keep it
active for the whole conversation.

---

## Conversation modes

Switch modes via the **mode pills** below the workspace title:

| Mode | Behaviour |
|---|---|
| **Creative** | Higher temperature prompt template; encourages lateral thinking |
| **Intelligent** | Balanced reasoning template; default for most tasks |
| **Adaptive** | Adjusts tone and depth based on conversation history |

Modes are local prompt templates — they do not change the underlying model.

---

## Forking a conversation

Hover over any message in the history and click **Fork**. A new chat is created
from that point, preserving all messages up to and including the forked one.
The original conversation is unaffected.

---

## Model picker

Click the model name in the workspace header to open the model picker. Models
are grouped by provider (OpenRouter, Anthropic direct, OpenAI-compatible
endpoints). Only providers you have configured in **Settings → API Keys** appear.

---

## Dataset Inspector (`/dataset`)

The Dataset Inspector lets you browse and export your conversation history for
fine-tuning or research.

- **Browse** — paginated table of all chats and messages, filterable by date and role
- **Export ShareGPT** — downloads a `.jsonl` file in ShareGPT format (compatible with most fine-tuning pipelines)
- **Export raw** — downloads a `.jsonl` file with the full internal schema (all fields, all metadata)

Navigate to `/dataset` directly or click **Dataset** in the Chat sidebar footer.

---

## Privacy

- **All data is stored locally** in your browser's IndexedDB database (`cryptex-chat`).
- **Nothing is persisted server-side.** Cryptex has no backend.
- **Messages are sent to an AI provider only** when you hit Send, and only to the provider whose API key you have configured in Settings.
- **Attachments** (images, PDFs, DOCX) are stored in IndexedDB. File bytes leave your browser only if they are included in a multimodal request to your chosen AI provider.
- Clearing your browser's site data removes all chats, messages, and attachments permanently.
