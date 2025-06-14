-- =====================================================
-- YOLDAGILAR DATABASE SCHEMA - XATOLAR TUZATILDI
-- =====================================================
-- ✅ IMMUTABLE function xatolari tuzatildi
-- ✅ Barcha indexlar ishlatish mumkin
-- ✅ Frontend uchun optimallashtirildi

-- =====================================================
-- 1. USERS TABLE - Single name field
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tg_id BIGINT UNIQUE NOT NULL,
    
    -- ✅ Frontend requirement: Single name field
    name VARCHAR(200) NOT NULL,           -- "Muhammad Said Buxoriy"
    username VARCHAR(100),                -- "muhammadsaid_dev"
    photo_url TEXT,                       -- User profile photo URL
    
    -- Registration & Approval Flow
    is_registered BOOLEAN DEFAULT true,   -- Bot registration = true
    is_approved BOOLEAN DEFAULT false,    -- Admin approval required
    
    -- Achievements (Frontend expects array)
    achievements TEXT[] DEFAULT '{}',     -- ["consistent", "reader", "athlete"]
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance Indexes for Users
CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);
CREATE INDEX IF NOT EXISTS idx_users_approved ON users(is_approved) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_users_registration ON users(is_registered, is_approved);

-- =====================================================
-- 2. DAILY PROGRESS TABLE - Core functionality
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_progress (
    id SERIAL PRIMARY KEY,
    tg_id BIGINT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- 10 Daily Tasks (Boolean: 0 or 1)
    shart_1 INTEGER DEFAULT 0 CHECK (shart_1 IN (0,1)),
    shart_2 INTEGER DEFAULT 0 CHECK (shart_2 IN (0,1)),
    shart_3 INTEGER DEFAULT 0 CHECK (shart_3 IN (0,1)),
    shart_4 INTEGER DEFAULT 0 CHECK (shart_4 IN (0,1)),
    shart_5 INTEGER DEFAULT 0 CHECK (shart_5 IN (0,1)),
    shart_6 INTEGER DEFAULT 0 CHECK (shart_6 IN (0,1)),
    shart_7 INTEGER DEFAULT 0 CHECK (shart_7 IN (0,1)),
    shart_8 INTEGER DEFAULT 0 CHECK (shart_8 IN (0,1)),
    shart_9 INTEGER DEFAULT 0 CHECK (shart_9 IN (0,1)),
    shart_10 INTEGER DEFAULT 0 CHECK (shart_10 IN (0,1)),
    
    -- Additional Metrics
    pages_read INTEGER DEFAULT 0 CHECK (pages_read >= 0),
    distance_km DECIMAL(10,2) DEFAULT 0 CHECK (distance_km >= 0),
    
    -- Auto-calculated total points
    total_points INTEGER GENERATED ALWAYS AS (
        shart_1 + shart_2 + shart_3 + shart_4 + shart_5 + 
        shart_6 + shart_7 + shart_8 + shart_9 + shart_10
    ) STORED,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tg_id, date),  -- One entry per user per day
    FOREIGN KEY (tg_id) REFERENCES users(tg_id) ON DELETE CASCADE
);

-- =====================================================
-- 3. SIMPLE PERFORMANCE INDEXES (NO FUNCTION DEPENDENCY)
-- =====================================================
-- Basic indexes without function dependencies
CREATE INDEX IF NOT EXISTS idx_progress_tg_id ON daily_progress(tg_id);
CREATE INDEX IF NOT EXISTS idx_progress_date ON daily_progress(date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_points ON daily_progress(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_progress_composite ON daily_progress(tg_id, date DESC);

-- For recent data queries (simple date comparison)
CREATE INDEX IF NOT EXISTS idx_progress_recent ON daily_progress(date DESC, total_points DESC);

-- For leaderboard queries (no WHERE clause with functions)
CREATE INDEX IF NOT EXISTS idx_leaderboard_daily ON daily_progress(date, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly ON daily_progress(date, total_points);
CREATE INDEX IF NOT EXISTS idx_leaderboard_alltime ON daily_progress(tg_id, total_points DESC);

-- For today's leaderboard
CREATE INDEX IF NOT EXISTS idx_leaderboard_today ON daily_progress(total_points DESC, tg_id);

-- =====================================================
-- 4. USER STATISTICS VIEW - Frontend Compatible
-- =====================================================
-- Drop existing view if exists
DROP VIEW IF EXISTS user_statistics;

-- Create optimized view
CREATE VIEW user_statistics AS
SELECT 
    u.tg_id,
    u.name,
    u.username,
    u.photo_url,
    u.is_registered,
    u.is_approved,
    u.achievements,
    u.created_at,
    u.updated_at,
    
    -- TODAY STATISTICS
    COALESCE(today.total_points, 0) as daily_points,
    COALESCE(today.pages_read, 0) as daily_pages,
    COALESCE(today.distance_km, 0) as daily_distance,
    
    -- WEEKLY STATISTICS (Last 7 days including today)
    COALESCE(weekly.weekly_points, 0) as weekly_points,
    COALESCE(weekly.weekly_pages, 0) as weekly_pages,
    COALESCE(weekly.weekly_distance, 0) as weekly_distance,
    
    -- ALL TIME STATISTICS
    COALESCE(all_time.total_points, 0) as total_points,
    COALESCE(all_time.total_pages, 0) as total_pages,
    COALESCE(all_time.total_distance, 0) as total_distance,
    COALESCE(all_time.total_days, 0) as total_days
    
FROM users u

-- TODAY'S DATA
LEFT JOIN (
    SELECT 
        tg_id,
        total_points,
        pages_read,
        distance_km
    FROM daily_progress 
    WHERE date = CURRENT_DATE
) today ON u.tg_id = today.tg_id

-- WEEKLY DATA (Last 7 days including today)
LEFT JOIN (
    SELECT 
        tg_id,
        SUM(total_points) as weekly_points,
        SUM(pages_read) as weekly_pages,
        SUM(distance_km) as weekly_distance
    FROM daily_progress 
    WHERE date >= CURRENT_DATE - INTERVAL '6 days'
      AND date <= CURRENT_DATE
    GROUP BY tg_id
) weekly ON u.tg_id = weekly.tg_id

-- ALL TIME DATA
LEFT JOIN (
    SELECT 
        tg_id,
        SUM(total_points) as total_points,
        SUM(pages_read) as total_pages,
        SUM(distance_km) as total_distance,
        COUNT(DISTINCT date) as total_days
    FROM daily_progress 
    GROUP BY tg_id
) all_time ON u.tg_id = all_time.tg_id

WHERE u.is_approved = true;  -- Only approved users

-- Index for view performance
CREATE INDEX IF NOT EXISTS idx_user_statistics_base ON users(tg_id) WHERE is_approved = true;

-- =====================================================
-- 5. HELPER FUNCTIONS FOR FRONTEND
-- =====================================================

-- Function to get user rank in leaderboard
CREATE OR REPLACE FUNCTION get_user_rank(
    user_tg_id BIGINT,
    period_type VARCHAR DEFAULT 'weekly',
    metric_type VARCHAR DEFAULT 'overall'
) RETURNS INTEGER AS $$
DECLARE
    user_rank INTEGER := 0;
BEGIN
    -- Weekly overall ranking
    IF period_type = 'weekly' AND metric_type = 'overall' THEN
        SELECT COALESCE(sub.rank, 0) INTO user_rank
        FROM (
            SELECT tg_id, 
                   RANK() OVER (ORDER BY weekly_points DESC, tg_id ASC) as rank
            FROM user_statistics 
            WHERE weekly_points > 0
        ) sub
        WHERE sub.tg_id = user_tg_id;
        
    -- Daily ranking
    ELSIF period_type = 'daily' AND metric_type = 'overall' THEN
        SELECT COALESCE(sub.rank, 0) INTO user_rank
        FROM (
            SELECT tg_id,
                   RANK() OVER (ORDER BY daily_points DESC, tg_id ASC) as rank
            FROM user_statistics 
            WHERE daily_points > 0
        ) sub
        WHERE sub.tg_id = user_tg_id;
        
    -- All time ranking
    ELSIF period_type = 'all_time' AND metric_type = 'overall' THEN
        SELECT COALESCE(sub.rank, 0) INTO user_rank
        FROM (
            SELECT tg_id,
                   RANK() OVER (ORDER BY total_points DESC, tg_id ASC) as rank
            FROM user_statistics 
            WHERE total_points > 0
        ) sub
        WHERE sub.tg_id = user_tg_id;
        
    -- Reading rankings
    ELSIF metric_type = 'reading' THEN
        IF period_type = 'weekly' THEN
            SELECT COALESCE(sub.rank, 0) INTO user_rank
            FROM (
                SELECT tg_id,
                       RANK() OVER (ORDER BY weekly_pages DESC, tg_id ASC) as rank
                FROM user_statistics 
                WHERE weekly_pages > 0
            ) sub
            WHERE sub.tg_id = user_tg_id;
        ELSIF period_type = 'daily' THEN
            SELECT COALESCE(sub.rank, 0) INTO user_rank
            FROM (
                SELECT tg_id,
                       RANK() OVER (ORDER BY daily_pages DESC, tg_id ASC) as rank
                FROM user_statistics 
                WHERE daily_pages > 0
            ) sub
            WHERE sub.tg_id = user_tg_id;
        ELSE
            SELECT COALESCE(sub.rank, 0) INTO user_rank
            FROM (
                SELECT tg_id,
                       RANK() OVER (ORDER BY total_pages DESC, tg_id ASC) as rank
                FROM user_statistics 
                WHERE total_pages > 0
            ) sub
            WHERE sub.tg_id = user_tg_id;
        END IF;
        
    -- Distance rankings
    ELSIF metric_type = 'distance' THEN
        IF period_type = 'weekly' THEN
            SELECT COALESCE(sub.rank, 0) INTO user_rank
            FROM (
                SELECT tg_id,
                       RANK() OVER (ORDER BY weekly_distance DESC, tg_id ASC) as rank
                FROM user_statistics 
                WHERE weekly_distance > 0
            ) sub
            WHERE sub.tg_id = user_tg_id;
        ELSIF period_type = 'daily' THEN
            SELECT COALESCE(sub.rank, 0) INTO user_rank
            FROM (
                SELECT tg_id,
                       RANK() OVER (ORDER BY daily_distance DESC, tg_id ASC) as rank
                FROM user_statistics 
                WHERE daily_distance > 0
            ) sub
            WHERE sub.tg_id = user_tg_id;
        ELSE
            SELECT COALESCE(sub.rank, 0) INTO user_rank
            FROM (
                SELECT tg_id,
                       RANK() OVER (ORDER BY total_distance DESC, tg_id ASC) as rank
                FROM user_statistics 
                WHERE total_distance > 0
            ) sub
            WHERE sub.tg_id = user_tg_id;
        END IF;
    END IF;
    
    RETURN COALESCE(user_rank, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. DATA TRIGGERS FOR CONSISTENCY
-- =====================================================

-- Update user updated_at on changes
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_timestamp();

-- Update progress updated_at on changes
CREATE OR REPLACE FUNCTION update_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_progress_updated_at ON daily_progress;
CREATE TRIGGER trigger_progress_updated_at
    BEFORE UPDATE ON daily_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_progress_timestamp();

-- =====================================================
-- 7. ADMIN USER SETUP 
-- =====================================================
-- Your admin user (replace with correct data)
INSERT INTO users (tg_id, name, username, is_registered, is_approved, achievements) 
VALUES (1176941228, 'Muhammad Said Admin', 'muhammadsaid_buxoriy', true, true, ARRAY['admin'])
ON CONFLICT (tg_id) DO UPDATE SET
    is_approved = true,
    achievements = EXCLUDED.achievements,
    updated_at = NOW();

-- =====================================================
-- 8. TEST QUERIES (for verification)
-- =====================================================

-- Test user statistics view
-- SELECT * FROM user_statistics LIMIT 5;

-- Test leaderboard query
-- SELECT tg_id, name, weekly_points, 
--        RANK() OVER (ORDER BY weekly_points DESC, tg_id ASC) as rank
-- FROM user_statistics 
-- WHERE weekly_points > 0
-- ORDER BY weekly_points DESC 
-- LIMIT 10;

-- Count users
-- SELECT COUNT(*) as total_users, 
--        COUNT(*) FILTER (WHERE is_approved = true) as approved_users
-- FROM users;

-- =====================================================
-- XATOLAR TUZATILDI! 🚀
-- =====================================================
-- 
-- ✅ IMMUTABLE function xatolari yo'q
-- ✅ Barcha indexlar oddiy va tez
-- ✅ View optimallashtirildi
-- ✅ Triggerlar ishlaydi
-- ✅ Admin user qo'shildi
--
-- ISHLATISHGA TAYYOR!
-- =====================================================