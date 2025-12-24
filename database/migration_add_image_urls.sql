-- ============================================
-- MIGRATION: Add image_urls column to reports
-- ============================================
-- Adds JSONB column to store array of image URLs
-- URLs will be public Supabase Storage URLs

-- Add image_urls column
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN reports.image_urls IS 'Array of public image URLs stored in Supabase Storage';

-- Verify column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'reports' 
    AND column_name = 'image_urls'
  ) THEN
    RAISE EXCEPTION 'Column image_urls was not created successfully';
  END IF;
END $$;

