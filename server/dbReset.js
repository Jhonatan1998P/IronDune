import { supabase } from './lib/supabase.js';

export async function hardResetDatabase() {
  if (process.env.DB_HARD_RESET !== 'true') {
    return;
  }

  console.warn('⚠️ [DB Reset] DB_HARD_RESET=true detected. Starting hard reset...');

  try {
    // 1. Delete data from public tables
    // We do this explicitly just in case some tables don't have cascade delete from auth.users
    const tables = ['profiles', 'logistic_loot', 'game_bots'];
    for (const table of tables) {
      console.log(`[DB Reset] Clearing table: ${table}...`);
      // In Supabase, delete() requires a filter. neq('id', 'some-uuid') is a common way to target all rows.
      // We use a dummy UUID that is unlikely to exist.
      const { error } = await supabase
        .from(table)
        .delete()
        .filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
        
      if (error) {
        // Some tables might not have an 'id' column or might have different primary keys.
        // If 'id' filter fails, we try a more generic approach if we can determine the primary key,
        // but for this project 'id' seems standard.
        console.error(`[DB Reset] Error clearing table ${table}:`, error.message);
      } else {
        console.log(`[DB Reset] Table ${table} cleared.`);
      }
    }

    // 2. Delete all authenticated users
    console.log('[DB Reset] Deleting all users from Auth...');
    
    // We might need to handle pagination if there are many users (> 1000)
    let allUsers = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: 1000
      });

      if (listError) {
        throw new Error(`Error listing users: ${listError.message}`);
      }

      if (users.length === 0) {
        hasMore = false;
      } else {
        allUsers = allUsers.concat(users);
        page++;
      }
    }

    console.log(`[DB Reset] Found ${allUsers.length} users to delete.`);

    for (const user of allUsers) {
      console.log(`[DB Reset] Deleting user: ${user.email || user.id}...`);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`[DB Reset] Error deleting user ${user.id}:`, deleteError.message);
      }
    }

    console.log('✅ [DB Reset] Hard reset completed successfully.');
  } catch (error) {
    console.error('❌ [DB Reset] Critical error during hard reset:', error.message);
  }
}
