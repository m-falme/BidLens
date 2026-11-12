/** Quote check: a field is source_confirmed only if its quote is found on the cited page. Pure; the LLM never sets status. */
export { isQuoteOnPage, normalizeForQuoteCheck, statusFromQuoteCheck } from "./quote-check";
export { decideFieldStatus, hasBlankMarker, meaningfulValue, STATUS_REASON_TEXT } from "./field-status";
