import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const databasePath = path.join(dataDir, "sportpolis.db");

fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as { sportpolisDb?: Database.Database };

export const db = globalForDb.sportpolisDb ?? new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS policy_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_number TEXT NOT NULL UNIQUE,
    policy_type TEXT NOT NULL CHECK (policy_type IN ('VK', 'VI', 'SYS')),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'issued')),
    application_id TEXT,
    tournament_slug TEXT,
    participant_name TEXT,
    reserved_at TEXT,
    issued_at TEXT,
    pdf_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_policy_numbers_type_status ON policy_numbers(policy_type, status);
  CREATE INDEX IF NOT EXISTS idx_policy_numbers_application ON policy_numbers(application_id, policy_type);
  CREATE INDEX IF NOT EXISTS idx_policy_numbers_tournament ON policy_numbers(tournament_slug);
  CREATE INDEX IF NOT EXISTS idx_policy_numbers_participant ON policy_numbers(participant_name);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_numbers_active_application_type
    ON policy_numbers(application_id, policy_type)
    WHERE application_id IS NOT NULL AND status IN ('reserved', 'issued');
`);

if (process.env.NODE_ENV !== "production") globalForDb.sportpolisDb = db;

export { databasePath };
