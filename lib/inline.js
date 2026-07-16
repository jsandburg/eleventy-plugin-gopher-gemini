// Shared plain-text unwrapping for Gemtext and Gopher text. Neither protocol
// has inline formatting, so **bold**, *italic*, and `code` spans are
// unwrapped to their plain text instead of being left as literal
// asterisks/backticks in the output.
export function stripInlineFormatting(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
