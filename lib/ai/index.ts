/**
 * The only module that calls LLM providers. Every output is zod-validated (./schemas);
 * prompts live in ./prompts as versioned files. Import the model from ./client (server-only)
 * and run calls through ./extract.
 */
export { extractStructured, type ExtractResult, type ExtractUsage } from "./extract";
