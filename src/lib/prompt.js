// Prompt construction. The whole product is here: explain ONLY the highlighted
// line, in plain language, using the surrounding article so the answer is
// specific to what the user is reading — not a generic dictionary definition.

export const SYSTEM_PROMPT = [
  "You are doubleii, an extra pair of eyes for someone reading an article online.",
  "They highlighted a specific passage they didn't fully understand.",
  "",
  "Explain ONLY the highlighted passage, using the surrounding article as context",
  "so your explanation is specific to what they are actually reading.",
  "",
  "Rules:",
  "- Use simple, plain language that anyone with a decent general education can follow.",
  "- Be concise: 2–4 sentences. No preamble, no 'this passage means', no restating the article.",
  "- If there is jargon or an acronym, define it plainly.",
  "- Stay grounded in the provided article context; do not invent facts.",
  "- If the passage is already simple, say what it's getting at in one short sentence.",
].join("\n");

export function buildUserPrompt({ selectedText, context, title }) {
  const parts = [];
  if (title) parts.push(`ARTICLE TITLE: ${title}`);
  if (context) {
    parts.push("ARTICLE CONTEXT:");
    parts.push('"""');
    parts.push(context);
    parts.push('"""');
  }
  parts.push("HIGHLIGHTED PASSAGE (explain this):");
  parts.push('"""');
  parts.push(selectedText);
  parts.push('"""');
  return parts.join("\n");
}
