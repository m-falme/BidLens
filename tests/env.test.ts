import { describe, expect, it } from "vitest";

import {
  databaseEnvSchema,
  EnvValidationError,
  parseEnv,
  publicEnvSchema,
  serverEnvSchema,
} from "@/lib/env/schema";

const validServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  LLM_PROVIDER: "openai",
  LLM_MODEL: "gpt-test",
  LLM_API_KEY: "llm-secret",
};

function captureError(run: () => unknown): EnvValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("returns typed values for a complete server environment", () => {
    const env = parseEnv(serverEnvSchema, validServerEnv, "server");

    expect(env.LLM_PROVIDER).toBe("openai");
    expect(env.SAUTI_API_URL).toBeUndefined();
  });

  it("lets the database config validate without the LLM variables", () => {
    const { LLM_MODEL: _model, LLM_API_KEY: _key, ...withoutLlm } = validServerEnv;
    void _model;
    void _key;
    expect(parseEnv(databaseEnvSchema, withoutLlm, "server").SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-secret");
    expect(captureError(() => parseEnv(serverEnvSchema, withoutLlm, "server")).problems).toEqual([
      "LLM_MODEL: missing",
      "LLM_API_KEY: missing",
    ]);
  });

  it("defaults LLM_PROVIDER to google when unset or blank", () => {
    const env = parseEnv(serverEnvSchema, { ...validServerEnv, LLM_PROVIDER: "" }, "server");

    expect(env.LLM_PROVIDER).toBe("google");
  });

  it("lists every missing variable at once, treating blank values as missing", () => {
    const error = captureError(() =>
      parseEnv(
        serverEnvSchema,
        { ...validServerEnv, LLM_API_KEY: "   ", SUPABASE_SERVICE_ROLE_KEY: undefined },
        "server",
      ),
    );

    expect(error.problems).toEqual(
      expect.arrayContaining(["SUPABASE_SERVICE_ROLE_KEY: missing", "LLM_API_KEY: missing"]),
    );
    expect(error.problems).toHaveLength(2);
    expect(error.message).toContain("Invalid server environment variables");
    expect(error.message).toContain(".env.example");
  });

  it("reports invalid values by name without echoing secrets", () => {
    const error = captureError(() =>
      parseEnv(
        serverEnvSchema,
        { ...validServerEnv, NEXT_PUBLIC_SUPABASE_URL: "not-a-url", LLM_PROVIDER: "llama" },
        "server",
      ),
    );

    expect(error.problems).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL: must be a URL, e.g. https://xyz.supabase.co",
      "LLM_PROVIDER: must be one of: google, openai, anthropic",
    ]);
    expect(error.message).not.toContain("service-role-secret");
    expect(error.message).not.toContain("llm-secret");
  });

  it("rejects a Supabase URL with a path, such as the REST endpoint", () => {
    const error = captureError(() =>
      parseEnv(
        serverEnvSchema,
        { ...validServerEnv, NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co/rest/v1/" },
        "server",
      ),
    );

    expect(error.problems).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL: must be the project URL with no path, e.g. https://xyz.supabase.co (not …/rest/v1)",
    ]);
    expect(parseEnv(serverEnvSchema, { ...validServerEnv, NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co/" }, "server"))
      .toMatchObject({ NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co/" });
  });

  it("accepts the new opaque publishable and secret key formats", () => {
    const env = parseEnv(
      serverEnvSchema,
      {
        ...validServerEnv,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
        SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
      },
      "server",
    );

    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("sb_publishable_test");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("sb_secret_test");
  });

  it("validates only public keys for the public scope", () => {
    const env = parseEnv(
      publicEnvSchema,
      {
        NEXT_PUBLIC_SUPABASE_URL: validServerEnv.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: validServerEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      "public",
    );

    expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  });
});
