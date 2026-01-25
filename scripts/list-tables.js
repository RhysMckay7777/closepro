import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

async function listTables() {
  try {
    console.log('Fetching tables from database...\n');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('Tables in database:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    console.log('\n--- Checking accounts table ---');
    const accountsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position;
    `;
    
    if (accountsColumns.length > 0) {
      console.log('Accounts table columns:');
      accountsColumns.forEach(c => {
        console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
      });
    } else {
      console.log('⚠️  Accounts table not found!');
    }
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
    process.exit(1);
  }
}

listTables();
