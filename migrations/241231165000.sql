-- clicker
CREATE SCHEMA IF NOT EXISTS clicker;
GRANT USAGE
ON SCHEMA clicker
TO postgres, anon, authenticated, service_role, dashboard_user;

-- --Game Profile
CREATE TABLE clicker.game_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid() UNIQUE,
    total_earned_points FLOAT DEFAULT 0,
    point_balance FLOAT DEFAULT 0,
    energy_balance INTEGER DEFAULT 0,
    mining_level INTEGER DEFAULT 0,

    last_energy_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_point_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE POLICY "service_role_full_access"
ON clicker.game_profile
FOR ALL
USING (auth.role() = 'service_role');

ALTER TABLE clicker.game_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY insert_profile ON clicker.game_profile FOR INSERT TO authenticated;

CREATE POLICY update_profile ON clicker.game_profile FOR UPDATE TO authenticated USING (
    auth.uid() = owner
);

CREATE POLICY delete_profile ON clicker.game_profile FOR DELETE TO authenticated USING (
    auth.uid() = owner
);

CREATE POLICY select_profile ON clicker.game_profile FOR SELECT TO authenticated;

-- --Booster
CREATE TABLE clicker.booster (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    type VARCHAR(30) NOT NULL,
    base_price FLOAT DEFAULT 0
);

CREATE POLICY "service_role_full_access"
ON clicker.booster
FOR ALL
USING (auth.role() = 'service_role');
INSERT INTO clicker.booster (title, description, type, base_price) VALUES
    ('Multi Tap', 'Increase the number of points you get per tap', 'MULTI_TAP', 1000),
    ('Energy Limit', 'Increase the max energy limit', 'ENERGY_LIMIT', 1000);


-- --User Booster
CREATE TABLE clicker.user_booster (
    id SERIAL PRIMARY KEY,
    game_profile_id UUID REFERENCES clicker.game_profile(id) NOT NULL,
    booster_id INTEGER REFERENCES clicker.booster(id) NOT NULL,
    level INTEGER DEFAULT 0,
    last_upgraded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (game_profile_id, booster_id)
);

CREATE POLICY "service_role_full_access"
ON clicker.user_booster
FOR ALL
USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION upgrade_booster (
    game_profile_id UUID,
    user_booster_id INTEGER,
    points_to_decrease INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE clicker.user_booster
    SET level = level + 1
    WHERE id = user_booster_id;

    UPDATE clicker.game_profile
    SET point_balance = point_balance - points_to_decrease
    WHERE id = game_profile_id;

    IF (SELECT point_balance FROM clicker.game_profile WHERE id = game_profile_id) < 0 THEN
                RAISE EXCEPTION 'Insufficient points';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- --Daily booster
CREATE TABLE clicker.daily_booster (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'DAILY_REFILL',
    max_available INTEGER DEFAULT 0
);

CREATE POLICY "service_role_full_access"
ON clicker.daily_booster
FOR ALL
USING (auth.role() = 'service_role');

INSERT INTO clicker.daily_booster (title, description, type, max_available) VALUES
    ('Daily Refill', 'Refill your energy daily', 'DAILY_REFILL', 5);

-- --User Daily booster
CREATE TABLE clicker.user_daily_booster (
    id SERIAL PRIMARY KEY,
    game_profile_id UUID REFERENCES clicker.game_profile(id) NOT NULL,
    daily_booster_id INTEGER REFERENCES clicker.daily_booster(id) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remaining INTEGER DEFAULT 0,
    UNIQUE (game_profile_id, daily_booster_id)
);

CREATE POLICY "service_role_full_access"
ON clicker.user_daily_booster
FOR ALL
USING (auth.role() = 'service_role');

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA clicker
TO postgres, authenticated, service_role, dashboard_user, anon;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA clicker
TO postgres, authenticated, service_role, dashboard_user, anon;
