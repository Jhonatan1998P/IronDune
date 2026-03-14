
import { supabase } from '../db/lib/supabase.js';

async function initializeAllProduction() {
    console.log('🚀 Inicializando tasas de producción para todos los jugadores...');
    
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id');
    if (pErr) {
        console.error('Error al obtener perfiles:', pErr);
        return;
    }

    console.log(`Encontrados ${profiles.length} perfiles. Procesando...`);

    for (const profile of profiles) {
        const { error } = await supabase.rpc('update_player_production_rates', { p_id: profile.id });
        if (error) {
            console.error(`Error procesando perfil ${profile.id}:`, error);
        } else {
            console.log(`✅ Perfil ${profile.id} sincronizado.`);
        }
    }

    console.log('🎉 Inicialización completada.');
    process.exit(0);
}

initializeAllProduction();
