export interface MigrationAdapter {
  exec(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  transaction<T>(fn: (tx: Omit<MigrationAdapter, "transaction">) => Promise<T>): Promise<T>;
}

export const SCHEMA_MIGRATIONS_SQL: string;
export function normalizeSchemaName(value: string | null | undefined): string | null;
export function searchPathStatement(schema: string): string;
export function listMigrations(dir: string): Promise<{ version: string; sql: string }[]>;
export function applyMigrations(
  adapter: MigrationAdapter,
  dir: string,
  log?: (message: string) => void,
  options?: { schema?: string | null; sessionSettings?: string[] },
): Promise<string[]>;
export function pgliteAdapter(db: unknown): MigrationAdapter;
export function postgresAdapter(sql: unknown): MigrationAdapter;
export function normalizePostgresUrl(raw: string): { url: string; ssl: false | "require" | "prefer" | "verify-full" };
