import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

async function resetDatabase() {
  try {
    console.log('Dropping existing tables...');
    
    await sql`DROP TABLE IF EXISTS "usage_tracking" CASCADE`;
    await sql`DROP TABLE IF EXISTS "sessions" CASCADE`;
    await sql`DROP TABLE IF EXISTS "accounts" CASCADE`;
    await sql`DROP TABLE IF EXISTS "users" CASCADE`;
    await sql`DROP TABLE IF EXISTS "organizations" CASCADE`;
    await sql`DROP TYPE IF EXISTS "plan_tier" CASCADE`;
    await sql`DROP TYPE IF EXISTS "user_role" CASCADE`;
    
    console.log('✓ All tables dropped successfully');
    console.log('Now run: npm run db:push');
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
    process.exit(1);
  }
}

resetDatabase();
