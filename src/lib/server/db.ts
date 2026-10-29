import "server-only";
import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const globalDatabase = globalThis as typeof globalThis & {
  easySolarSql?: SqlClient;
};

export function isDatabaseConfigured() {
  return Boolean(
    process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.SUPABASE_POSTGRES_URL,
  );
}

export function getDb(): SqlClient {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }

  if (!globalDatabase.easySolarSql) {
    globalDatabase.easySolarSql = postgres(databaseUrl, {
      idle_timeout: 20,
      max: Number(process.env.DATABASE_POOL_MAX ?? 1),
      prepare: false,
    });
  }

  return globalDatabase.easySolarSql;
}
