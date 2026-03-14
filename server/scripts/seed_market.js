
import { supabase } from '../db/lib/supabase.js';

const INITIAL_MARKET = [
    { resource_type: 'OIL', base_price: 2.5, current_price: 2.5 },
    { resource_type: 'AMMO', base_price: 1.5, current_price: 1.5 },
    { resource_type: 'GOLD', base_price: 15.0, current_price: 15.0 },
    { resource_type: 'DIAMOND', base_price: 500.0, current_price: 500.0 }
];

async function seedMarket() {
    console.log('📈 Inicializando Mercado Global...');
    const { error } = await supabase.from('global_market').upsert(INITIAL_MARKET);
    
    if (error) {
        console.error('Error al inicializar mercado:', error);
    } else {
        console.log('✅ Mercado inicializado con éxito.');
    }
    process.exit(0);
}

seedMarket();
