require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

(async () => {
    try {
        // Check calls per user (by userId on sales_calls)
        const callsByUser = await sql`
      SELECT u.name, u.email, u.id,
             count(sc.id) as call_count,
             count(ca.id) as analysis_count
      FROM users u
      INNER JOIN sales_calls sc ON u.id = sc.user_id
      LEFT JOIN call_analysis ca ON sc.id = ca.call_id
      GROUP BY u.id, u.name, u.email
      ORDER BY call_count DESC
    `;
        console.log('=== CALLS OWNED BY USER (salesCalls.userId) ===');
        callsByUser.forEach(c => console.log(`${c.name} (${c.email}): ${c.call_count} calls, ${c.analysis_count} analyses | uid: ${c.id}`));

        // Check roleplay sessions per user
        const rpByUser = await sql`
      SELECT u.name, u.email, u.id,
             count(rs.id) as rp_count
      FROM users u
      INNER JOIN roleplay_sessions rs ON u.id = rs.user_id
      GROUP BY u.id, u.name, u.email
      ORDER BY rp_count DESC
    `;
        console.log('\n=== ROLEPLAY SESSIONS BY USER ===');
        rpByUser.forEach(r => console.log(`${r.name} (${r.email}): ${r.rp_count} sessions | uid: ${r.id}`));

        // Check the "Close Pro" org specifically — who are its members and what calls exist?
        const closeProUsers = await sql`
      SELECT u.name, u.email, u.id, uo.organization_id, o.name as org_name
      FROM users u
      JOIN user_organizations uo ON u.id = uo.user_id
      JOIN organizations o ON uo.organization_id = o.id
      WHERE o.name ILIKE '%close%pro%' OR o.name ILIKE '%closepro%'
      ORDER BY o.name
    `;
        console.log('\n=== USERS IN CLOSE PRO ORGS ===');
        closeProUsers.forEach(u => console.log(`${u.name} (${u.email}): org=${u.org_name} (${u.organization_id}) | uid: ${u.id}`));

        // Check: are there calls in 'Close Pro' org that DON'T match any user's ID?
        const orphanCalls = await sql`
      SELECT sc.id, sc.title, sc.user_id, sc.organization_id, o.name as org_name,
             u.name as user_name, u.email as user_email
      FROM sales_calls sc
      JOIN organizations o ON sc.organization_id = o.id
      LEFT JOIN users u ON sc.user_id = u.id
      WHERE o.name ILIKE '%close%pro%' OR o.name ILIKE '%closepro%'
      ORDER BY sc.created_at DESC
      LIMIT 10
    `;
        console.log('\n=== CALLS IN CLOSE PRO ORGS (sample) ===');
        orphanCalls.forEach(c => console.log(`${c.id} | "${c.title}" | user: ${c.user_name} (${c.user_email}) | org: ${c.org_name} (${c.organization_id})`));

        // Check Connor's data specifically
        const connorCalls = await sql`
      SELECT sc.id, sc.title, sc.user_id, sc.organization_id, u.email,
             ca.overall_score
      FROM sales_calls sc
      JOIN users u ON sc.user_id = u.id
      LEFT JOIN call_analysis ca ON sc.id = ca.call_id
      WHERE u.email ILIKE '%connor%'
      ORDER BY sc.created_at DESC
      LIMIT 10
    `;
        console.log('\n=== CONNOR CALLS ===');
        connorCalls.forEach(c => console.log(`${c.id} | "${c.title}" | score:${c.overall_score} | user:${c.email} | org:${c.organization_id}`));

        await sql.end();
    } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
    }
})();
