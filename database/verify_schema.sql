-- ============================================
-- VERIFICATION SCRIPT FOR SAFESPOT ANONYMOUS BACKEND
-- ============================================
-- Run this script to verify database structure
-- ============================================

-- 1. Verify tables exist
DO $$
BEGIN
    RAISE NOTICE '=== VERIFYING TABLES ===';
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'anonymous_users') THEN
        RAISE NOTICE '✅ anonymous_users table exists';
    ELSE
        RAISE EXCEPTION '❌ anonymous_users table MISSING';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
        RAISE NOTICE '✅ reports table exists';
    ELSE
        RAISE EXCEPTION '❌ reports table MISSING';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comments') THEN
        RAISE NOTICE '✅ comments table exists';
    ELSE
        RAISE EXCEPTION '❌ comments table MISSING';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'votes') THEN
        RAISE NOTICE '✅ votes table exists';
    ELSE
        RAISE EXCEPTION '❌ votes table MISSING';
    END IF;
END $$;

-- 2. Verify NO auth tables exist
DO $$
BEGIN
    RAISE NOTICE '=== VERIFYING NO AUTH TABLES ===';
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE WARNING '⚠️ public.users table EXISTS (should not exist)';
    ELSE
        RAISE NOTICE '✅ No public.users table (correct)';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE WARNING '⚠️ public.profiles table EXISTS (should not exist)';
    ELSE
        RAISE NOTICE '✅ No public.profiles table (correct)';
    END IF;
END $$;

-- 3. Verify RLS is enabled
DO $$
DECLARE
    v_rls_enabled BOOLEAN;
BEGIN
    RAISE NOTICE '=== VERIFYING RLS ===';
    
    -- Check anonymous_users
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'anonymous_users';
    
    IF v_rls_enabled THEN
        RAISE NOTICE '✅ RLS enabled on anonymous_users';
    ELSE
        RAISE WARNING '⚠️ RLS NOT enabled on anonymous_users';
    END IF;
    
    -- Check reports
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'reports';
    
    IF v_rls_enabled THEN
        RAISE NOTICE '✅ RLS enabled on reports';
    ELSE
        RAISE WARNING '⚠️ RLS NOT enabled on reports';
    END IF;
    
    -- Check comments
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'comments';
    
    IF v_rls_enabled THEN
        RAISE NOTICE '✅ RLS enabled on comments';
    ELSE
        RAISE WARNING '⚠️ RLS NOT enabled on comments';
    END IF;
    
    -- Check votes
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'votes';
    
    IF v_rls_enabled THEN
        RAISE NOTICE '✅ RLS enabled on votes';
    ELSE
        RAISE WARNING '⚠️ RLS NOT enabled on votes';
    END IF;
END $$;

-- 4. Verify policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. Verify functions exist
DO $$
BEGIN
    RAISE NOTICE '=== VERIFYING FUNCTIONS ===';
    
    IF EXISTS (SELECT FROM pg_proc WHERE proname = 'get_or_create_anonymous_user') THEN
        RAISE NOTICE '✅ get_or_create_anonymous_user function exists';
    ELSE
        RAISE WARNING '⚠️ get_or_create_anonymous_user function MISSING';
    END IF;
    
    IF EXISTS (SELECT FROM pg_proc WHERE proname = 'current_anonymous_id') THEN
        RAISE NOTICE '✅ current_anonymous_id function exists';
    ELSE
        RAISE WARNING '⚠️ current_anonymous_id function MISSING';
    END IF;
END $$;

-- 6. Count records
SELECT 
    'anonymous_users' as table_name,
    COUNT(*) as record_count
FROM anonymous_users
UNION ALL
SELECT 
    'reports' as table_name,
    COUNT(*) as record_count
FROM reports
UNION ALL
SELECT 
    'comments' as table_name,
    COUNT(*) as record_count
FROM comments
UNION ALL
SELECT 
    'votes' as table_name,
    COUNT(*) as record_count
FROM votes;

-- 7. Verify foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

