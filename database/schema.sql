-- =====================================================
-- YOLDAGILAR DATABASE SCHEMA - PRODUCTION READY
-- =====================================================
-- Fixed IMMUTABLE function errors
-- Removed fake data for clean production start

-- =====================================================
-- 1. USERS TABLE - Single name field (Frontend requirement)
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tg_id BIGINT UNIQUE NOT NULL,
    
    -- ✅ CRITICAL: Single name field (Frontend expects this)
    name VARCHAR(200) NOT NULL,           -- "Muhammad Said Buxoriy"
    username VARCHAR(100),                -- "muhammadsaid_dev" (nullable)
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
CREATE INDEX idx_users_tg_id ON users(tg_id);
CREATE INDEX idx_users_approved ON users(is_approved) WHERE is_approved = true;
CREATE INDEX idx_users_registration ON users(is_registered, is_approved);

-- =====================================================
-- 2. DAILY PROGRESS TABLE - Core functionality
-- =====================================================
CREATE TABLE daily_progress (
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
    
    -- Additional Metrics (Frontend requirement)
    pages_read INTEGER DEFAULT 0 CHECK (pages_read >= 0),
    distance_km DECIMAL(10,2) DEFAULT 0 CHECK (distance_km >= 0),
    
    -- Auto-calculated total points (Frontend expects this)
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

-- Critical Performance Indexes for Daily Progress
CREATE INDEX idx_progress_tg_id ON daily_progress(tg_id);
CREATE INDEX idx_progress_date ON daily_progress(date DESC);
CREATE INDEX idx_progress_points ON daily_progress(total_points DESC);
CREATE INDEX idx_progress_composite ON daily_progress(tg_id, date DESC);

-- =====================================================
-- 3. FIXED WEEKLY PERFORMANCE INDEX
-- =====================================================
-- Create IMMUTABLE function for date comparison
CREATE OR REPLACE FUNCTION is_recent_date(check_date DATE)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT check_date >= '2024-01-01'::DATE  -- Always true for recent dates
$$;

-- Now create the conditional index using IMMUTABLE function
CREATE INDEX idx_progress_weekly ON daily_progress(date, total_points DESC) 
    WHERE is_recent_date(date);

-- Alternative: Simple unconditional index (more reliable)
CREATE INDEX idx_progress_recent ON daily_progress(date DESC, total_points DESC);

-- =====================================================
-- 4. USER STATISTICS VIEW - Frontend Compatible
-- =====================================================
-- This view provides all statistics that frontend needs
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.tg_id,
    u.name,
    u.username,
    u.photo_url,
    u.is_registered,
    u.is_approved,
    u.achievements,
    u.created_at,
    
    -- TODAY STATISTICS
    COALESCE(today.total_points, 0) as daily_points,
    COALESCE(today.pages_read, 0) as daily_pages,
    COALESCE(today.distance_km, 0) as daily_distance,
    
    -- WEEKLY STATISTICS (Last 7 days)
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

-- WEEKLY DATA (Last 7 days)
LEFT JOIN (
    SELECT 
        tg_id,
        SUM(total_points) as weekly_points,
        SUM(pages_read) as weekly_pages,
        SUM(distance_km) as weekly_distance
    FROM daily_progress 
    WHERE date >= CURRENT_DATE - INTERVAL '6 days'
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

-- Index for the view
CREATE INDEX idx_user_statistics_tg_id ON users(tg_id) WHERE is_approved = true;

-- =====================================================
-- 5. LEADERBOARD OPTIMIZATION INDEXES
-- =====================================================

-- For daily leaderboard (simple and fast)
CREATE INDEX idx_leaderboard_daily ON daily_progress(date, total_points DESC);

-- For all-time leaderboard (composite)
CREATE INDEX idx_leaderboard_alltime ON daily_progress(tg_id, total_points DESC);

-- =====================================================
-- 6. HELPER FUNCTIONS FOR FRONTEND
-- =====================================================

-- Function to get user rank in leaderboard
CREATE OR REPLACE FUNCTION get_user_rank(
    user_tg_id BIGINT,
    period_type VARCHAR DEFAULT 'weekly',
    metric_type VARCHAR DEFAULT 'overall'
) RETURNS INTEGER AS $$
DECLARE
    user_rank INTEGER;
BEGIN
    -- Weekly overall ranking
    IF period_type = 'weekly' AND metric_type = 'overall' THEN
        SELECT rank() OVER (ORDER BY weekly_points DESC, tg_id ASC) 
        INTO user_rank
        FROM user_statistics 
        WHERE tg_id = user_tg_id;
        
    -- Daily ranking
    ELSIF period_type = 'daily' AND metric_type = 'overall' THEN
        SELECT rank() OVER (ORDER BY daily_points DESC, tg_id ASC)
        INTO user_rank
        FROM user_statistics 
        WHERE tg_id = user_tg_id;
        
    -- All time ranking
    ELSIF period_type = 'all_time' AND metric_type = 'overall' THEN
        SELECT rank() OVER (ORDER BY total_points DESC, tg_id ASC)
        INTO user_rank
        FROM user_statistics 
        WHERE tg_id = user_tg_id;
        
    END IF;
    
    RETURN COALESCE(user_rank, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. DATA TRIGGERS FOR CONSISTENCY
-- =====================================================

-- Update user updated_at on changes
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER trigger_progress_updated_at
    BEFORE UPDATE ON daily_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_progress_timestamp();

-- =====================================================
-- 8. ADMIN USER SETUP (Replace with your actual data)
-- =====================================================

-- Create your admin user - REPLACE WITH YOUR ACTUAL TELEGRAM ID & NAME
-- INSERT INTO users (tg_id, name, username, is_registered, is_approved, achievements) 
-- VALUES (YOUR_TELEGRAM_ID, 'Your Full Name', 'your_username', true, true, ARRAY['admin'])
-- ON CONFLICT (tg_id) DO NOTHING;

-- Example (commented out - replace with your data):
-- INSERT INTO users (tg_id, name, username, is_registered, is_approved, achievements) 
-- VALUES (1176941228, 'Admin User', 'admin_username', true, true, ARRAY['admin'])
-- ON CONFLICT (tg_id) DO NOTHING;

-- =====================================================
-- 9. PERFORMANCE MONITORING QUERIES
-- =====================================================

-- Check database performance (uncomment to use)
-- SELECT schemaname, tablename, attname, n_distinct, correlation
-- FROM pg_stats 
-- WHERE schemaname = 'public' AND tablename IN ('users', 'daily_progress');

-- Monitor index usage (uncomment to use)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public';

-- =====================================================
-- 10. VERIFICATION QUERIES (for testing)
-- =====================================================

-- Test user statistics view (uncomment to test)
-- SELECT * FROM user_statistics LIMIT 5;

-- Test leaderboard query (uncomment to test)
-- SELECT tg_id, name, weekly_points, 
--        rank() OVER (ORDER BY weekly_points DESC, tg_id ASC) as rank
-- FROM user_statistics 
-- WHERE weekly_points > 0
-- ORDER BY weekly_points DESC 
-- LIMIT 10;

-- Count total users
-- SELECT COUNT(*) as total_users, 
--        COUNT(*) FILTER (WHERE is_approved = true) as approved_users,
--        COUNT(*) FILTER (WHERE is_approved = false) as pending_users
-- FROM users;

-- =====================================================
-- 11. CLEANUP COMMANDS (if needed)
-- =====================================================

-- If you need to reset the database (DANGER - deletes all data!)
-- DROP VIEW IF EXISTS user_statistics CASCADE;
-- DROP TABLE IF EXISTS daily_progress CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP FUNCTION IF EXISTS get_user_rank(BIGINT, VARCHAR, VARCHAR);
-- DROP FUNCTION IF EXISTS is_recent_date(DATE);
-- DROP FUNCTION IF EXISTS update_user_timestamp();
-- DROP FUNCTION IF EXISTS update_progress_timestamp();

-- =====================================================
-- PRODUCTION READY SCHEMA! 🚀
-- =====================================================
-- 
-- ✅ Fixed IMMUTABLE function errors
-- ✅ Removed fake test data
-- ✅ Added proper indexes for performance
-- ✅ Frontend compatible structure
-- ✅ Admin user setup template
-- ✅ Performance monitoring queries
-- ✅ Cleanup commands for reset if needed
--
-- READY FOR DEPLOYMENT!
-- =====================================================