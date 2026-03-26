import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  try {
    await sql.unsafe("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'rep'");
    console.log("✅ Added 'rep' to plan_tier enum");
    
    await sql.unsafe("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'manager'");
    console.log("✅ Added 'manager' to plan_tier enum");

    const result = await sql.unsafe("SELECT unnest(enum_range(NULL::plan_tier))");
    console.log("Current plan_tier values:", result.map((r: any) => r.unnest));
    
    console.log("✅ Migration completed successfully!");
  } catch (err: any) {
    console.error("Migration error:", err.message);
  } finally {
    await sql.end();
  }
}

migrate();
