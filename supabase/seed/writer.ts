import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConflictMode, SeedStep, SeedTable } from "./rows";

/** Upserts rows keyed on `id`. `insert_only` must leave existing rows untouched. */
export interface SeedWriter {
  upsert(table: SeedTable, rows: readonly object[], mode: ConflictMode): Promise<void>;
}

export async function runSeed(steps: readonly SeedStep[], writer: SeedWriter): Promise<void> {
  for (const step of steps) {
    await writer.upsert(step.table, step.rows, step.mode);
  }
}

const CHUNK_SIZE = 500;

export function supabaseWriter(client: SupabaseClient): SeedWriter {
  return {
    async upsert(table, rows, mode) {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const { error } = await client
          .from(table)
          .upsert(rows.slice(i, i + CHUNK_SIZE), { onConflict: "id", ignoreDuplicates: mode === "insert_only" });
        if (error) throw new Error(`seed ${table}: ${error.message}`);
      }
    },
  };
}
