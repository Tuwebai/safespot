
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixFunction() {
    const client = await pool.connect();
    try {
        console.log('--- Applying Fix for calculate_trust_score ---');

        // Redefine the function without the invalid column 'flags_given_false'
        const query = `
      CREATE OR REPLACE FUNCTION calculate_trust_score(target_id UUID)
      RETURNS DECIMAL AS $$
      DECLARE
          -- Factors
          base_score DECIMAL := 50.0;
          
          -- Metrics
          v_votes_received INTEGER;
          v_reports_verified INTEGER;
          v_flags_received INTEGER;
          v_reports_deleted INTEGER;
          v_comments_deleted INTEGER;
          v_antiquity_weeks INTEGER;
          
          -- Calculation
          calculated_score DECIMAL;
      BEGIN
          -- Fetch metrics from table
          SELECT 
              votes_received_up,
              reports_verified,
              flags_received_count,
              reports_deleted,
              comments_deleted,
              EXTRACT(EPOCH FROM (NOW() - created_at)) / 604800 -- Weeks active
          INTO 
              v_votes_received,
              v_reports_verified,
              v_flags_received,
              v_reports_deleted,
              v_comments_deleted,
              v_antiquity_weeks
          FROM anonymous_trust_scores
          WHERE anonymous_id = target_id;
      
          -- Handle case where user not found
          IF NOT FOUND THEN
              RETURN 50.0;
          END IF;
      
          -- Apply Formula
          -- 1. Positive Factors
          -- Upvotes: +0.1 per upvote (so +1 per 10 upvotes), Max +20 pts total
          calculated_score := base_score + LEAST(20.0, (v_votes_received * 0.1));
          
          -- Verified Reports: +5 per report
          calculated_score := calculated_score + (v_reports_verified * 5.0);
          
          -- Antiquity: +1 per week, Max +10 pts
          calculated_score := calculated_score + LEAST(10.0, (v_antiquity_weeks * 1.0));
      
          -- 2. Negative Factors (Penalties)
          -- Flags Received: -2 points per unique flag
          calculated_score := calculated_score - (v_flags_received * 2.0);
          
          -- Reports Deleted (Spam/TOS): -20 points (Severe)
          calculated_score := calculated_score - (v_reports_deleted * 20.0);
          
          -- Comments Deleted: -5 points
          calculated_score := calculated_score - (v_comments_deleted * 5.0);
      
          -- 3. Clamp Result (0 to 100)
          IF calculated_score > 100.0 THEN
              calculated_score := 100.0;
          ELSIF calculated_score < 0.0 THEN
              calculated_score := 0.0;
          END IF;
      
          RETURN calculated_score;
      END;
      $$ LANGUAGE plpgsql;
    `;

        await client.query(query);
        console.log('✅ Function calculate_trust_score successfully updated.');

    } catch (err) {
        console.error('❌ Error updating function:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixFunction();
