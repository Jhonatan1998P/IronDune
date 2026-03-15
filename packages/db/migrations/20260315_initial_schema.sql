-- FASE 3: Modelo de Datos - Iron Dune Operations

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Worlds
CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Players
CREATE TABLE players (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    world_id UUID REFERENCES worlds(id),
    username TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Player Profiles (Estadísticas y preferencias)
CREATE TABLE player_profiles (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    avatar_url TEXT,
    bio TEXT,
    settings JSONB DEFAULT '{}'
);

-- 4. Planets
CREATE TABLE planets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id),
    world_id UUID REFERENCES worlds(id),
    name TEXT NOT NULL,
    coordinates TEXT NOT NULL, -- Formato "1:15:4"
    type TEXT DEFAULT 'normal',
    max_fields INTEGER DEFAULT 163,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Planet Snapshots (Estado de recursos en un momento T)
CREATE TABLE planet_snapshots (
    planet_id UUID PRIMARY KEY REFERENCES planets(id) ON DELETE CASCADE,
    last_update_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    money BIGINT DEFAULT 10000,
    oil BIGINT DEFAULT 5000,
    ammo BIGINT DEFAULT 2000,
    gold BIGINT DEFAULT 0,
    diamond BIGINT DEFAULT 0,
    -- Tasas de producción por segundo (enteros fijos * 10^6 para precisión si es necesario, 
    -- pero aquí usaremos precisión por minuto o segundo en el código)
    money_rate_per_sec BIGINT DEFAULT 0,
    oil_rate_per_sec BIGINT DEFAULT 0,
    ammo_rate_per_sec BIGINT DEFAULT 0,
    gold_rate_per_sec BIGINT DEFAULT 0,
    diamond_rate_per_sec BIGINT DEFAULT 0,
    version BIGINT DEFAULT 1
);

-- 6. Planet Buildings
CREATE TABLE planet_buildings (
    planet_id UUID REFERENCES planets(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    PRIMARY KEY (planet_id, building_id)
);

-- 7. Player Research
CREATE TABLE player_research (
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    research_id TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    PRIMARY KEY (player_id, research_id)
);

-- 8. Building Queue
CREATE TABLE building_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planet_id UUID REFERENCES planets(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL,
    target_level INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    version BIGINT DEFAULT 1
);

-- 9. Shipyard Queue
CREATE TABLE shipyard_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planet_id UUID REFERENCES planets(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,
    amount BIGINT NOT NULL,
    amount_done BIGINT DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL,
    last_tick_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending'
);

-- 10. Fleet Movements
CREATE TABLE fleet_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id),
    origin_planet_id UUID REFERENCES planets(id),
    destination_planet_id UUID REFERENCES planets(id),
    departure_at TIMESTAMPTZ NOT NULL,
    arrival_at TIMESTAMPTZ NOT NULL,
    return_at TIMESTAMPTZ, -- NULL si no es ida y vuelta
    mission_type TEXT NOT NULL, -- attack, transport, deploy, espionage
    units JSONB NOT NULL, -- {"tank": 10, "soldier": 50}
    resources JSONB DEFAULT '{}',
    status TEXT DEFAULT 'moving' -- moving, returning, arrived
);

-- 11. Game Events (Cola para el Worker)
CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- building_finish, research_finish, fleet_arrival, etc.
    scheduled_at TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    error_log TEXT
);
CREATE INDEX idx_game_events_scheduled_at ON game_events(scheduled_at) WHERE status = 'pending';

-- 12. Event Outbox (Para Sockets)
CREATE TABLE event_outbox (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX idx_event_outbox_player_unsent ON event_outbox(player_id) WHERE sent_at IS NULL;

-- 13. Player Points & Rankings
CREATE TABLE player_points (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    building_points BIGINT DEFAULT 0,
    research_points BIGINT DEFAULT 0,
    fleet_points BIGINT DEFAULT 0,
    total_points BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE leaderboard_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
);

-- 14. Idempotency & Audit
CREATE TABLE idempotency_keys (
    key TEXT PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    response_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID,
    action TEXT NOT NULL,
    entity_id TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- SEGURIDAD: RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE planets ENABLE ROW LEVEL SECURITY;
ALTER TABLE planet_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE planet_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipyard_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura (Jugadores ven lo suyo)
CREATE POLICY "Players can view own data" ON players FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Players can view own planets" ON planets FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can view own snapshots" ON planet_snapshots FOR SELECT USING (
    planet_id IN (SELECT id FROM planets WHERE player_id = auth.uid())
);
-- Las escrituras se bloquean para el rol 'anon' y 'authenticated' directo, 
-- solo el rol 'service_role' (Backend) debería escribir en las tablas core 
-- si queremos máxima seguridad, o restringir vía políticas.

-- Para este proyecto, el Backend usará SERVICE_ROLE para saltar RLS en escrituras críticas.
-- El frontend solo leerá.
