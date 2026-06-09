# doubleii — Demo Ideas & Use Cases

A living list of demo scenarios, use cases, and the hook for each.
Add new ones here as they come up.

---

## Core demos

### 1. Research paper / technical article
**The problem it solves:** One sentence stops you. You open a new tab, search, read three other articles, lose your place, forget what you were doing.
**The demo:** Open a dense article (AI, medicine, finance, law). Find a sentence with real jargon. Select it. Hit ⌥B. Explanation appears — specific to the article, not a dictionary definition.
**The line:** "It read the surrounding article to explain that one sentence. You didn't leave the page."
**Best pages to use:** arXiv abstracts, Investopedia deep dives, medical study summaries, legal analysis blogs.

### 2. WhatsApp Web — understand what someone meant
**The problem it solves:** Someone says something confusing. You don't know if it's slang, a reference, or a context thing. You can't ask without seeming out of the loop.
**The demo:** Open WhatsApp Web. Find a message that's ambiguous — slang, a cultural reference, or something that only makes sense given the conversation history. Select it. Explain.
**The hook:** It reads the surrounding thread, not just the message. It tells you what the person *meant*, not just what the words mean.
**The line:** "It read the thread to understand what they actually meant."
**Privacy note to include in demo:** Only the surrounding messages (not full history) are sent directly to your AI provider. doubleii never sees it.

---

## Strong supporting use cases

### 3. Legal / terms of service
**Hook:** Classic "I'll never read this" content — but now you can highlight the one clause that matters and get it in plain English in 3 seconds.

### 4. Financial news / earnings reports
**Hook:** "Revenue was up 12% YoY on a non-GAAP basis excluding one-time restructuring charges" — this is exactly where most people tab away. One selection, explained.

### 5. Hacker News / Reddit technical threads
**Hook:** Someone drops a concept name assuming you know it. You don't. The thread is 200 comments. You just want to understand the point, not do a deep dive.

### 6. Wikipedia rabbit holes
**Hook:** You're 5 articles deep. One sentence references something you don't know. Select it — stay in the rabbit hole without going deeper.

### 7. Foreign language content / mixed-language chats
**Hook:** Someone texted you in Hindi or Spanish. Select the message. Set response language to English. Done. Works on WhatsApp Web, Gmail, anything.

### 8. The tab-saving moment (meta-demo)
**Don't show a feature — show the problem first.**
Show the old flow: reading → stop → open new tab → search → read something unrelated → forget where you were.
Then show doubleii: reading → highlight → read → continue. No tab switch.
This contrast is stronger than any feature walkthrough.

---

## Demo format notes
- Show the problem before the solution — the contrast is the pitch
- Use real pages, not staged content — authenticity matters
- The explanation should visibly use the article's own framing, not a generic definition — this is the product's core differentiator
- Keep each demo under 60 seconds for social; 2–3 minutes for a full walkthrough

---

## Context limits (for demos involving long pages)
doubleii sends a maximum of **6,000 characters** to the LLM, centred on your selection (~3,000 before, ~3,000 after). A 500-page book online is ~1.5M characters — only a small window around what you highlighted is ever sent. Cost is always bounded.

