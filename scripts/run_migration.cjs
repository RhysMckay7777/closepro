const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.query("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'rep'");
    console.log("Added 'rep' to plan_tier enum");
    
    await pool.query("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'manager'");
    console.log("Added 'manager' to plan_tier enum");

    const result = await pool.query("SELECT unnest(enum_range(NULL::plan_tier))");
    console.log("Current plan_tier values:", result.rows.map(r => r.unnest));
    
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    await pool.end();
  }
}

migrate();
