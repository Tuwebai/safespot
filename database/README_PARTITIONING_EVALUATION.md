# Table Partitioning Evaluation

## Executive Summary

**Recommendation**: **DO NOT IMPLEMENT PARTITIONING** at this time.

**Reasoning**: Premature optimization. Current table sizes and growth rates do not justify the operational complexity of partitioning.

---

## Analysis

### Reports Table

**Current State**:
- Estimated rows: <100K (based on typical usage)
- Growth rate: ~1K-10K reports/month
- Time to 1M rows: 8-80 months
- Time to 10M rows: 7-17 years

**Query Patterns**:
```sql
-- Most frequent queries (from reports.js analysis)
1. SELECT * FROM reports WHERE zone = 'X' ORDER BY created_at DESC LIMIT 20
2. SELECT * FROM reports WHERE category = 'X' AND zone = 'Y' ORDER BY created_at DESC
3. SELECT * FROM reports WHERE status = 'pendiente' ORDER BY created_at DESC
4. SELECT * FROM reports WHERE created_at > NOW() - INTERVAL '30 days'
```

**Current Optimization**:
- ✅ Composite indices: `(category, zone, created_at)`, `(zone, created_at)`, `(status, created_at)`
- ✅ Single indices: `anonymous_id`, `created_at`, `incident_date`
- ✅ Full-text search: `search_vector` (GIN index)

**Performance**:
- Current latency: <50ms for filtered queries (with composite indices)
- Expected at 1M rows: <100ms (still acceptable)
- Expected at 10M rows: <500ms (partitioning becomes relevant)

**Partitioning Complexity**:
- Manual partition creation (monthly/quarterly)
- Partition pruning logic in queries
- Backup/restore complexity
- Supabase managed service limitations

**Verdict**: **NOT NEEDED**. Composite indices handle current and near-future load efficiently.

---

### Comments Table

**Current State**:
- Estimated rows: <500K
- Growth rate: ~5K-50K comments/month
- Primary access: `WHERE report_id = X` (already indexed)

**Query Patterns**:
```sql
-- Most frequent queries
1. SELECT * FROM comments WHERE report_id = X ORDER BY created_at ASC
2. SELECT * FROM comments WHERE anonymous_id = X ORDER BY created_at DESC
3. SELECT COUNT(*) FROM comments WHERE report_id = X
```

**Current Optimization**:
- ✅ Index on `report_id` (FK, most common filter)
- ✅ Index on `anonymous_id`
- ✅ Index on `created_at`

**Partitioning Challenges**:
- Foreign key to `reports` (partitioning both tables is complex)
- Access pattern is by `report_id`, not `created_at` (partition key mismatch)
- Partition pruning would not help most queries

**Verdict**: **NOT NEEDED**. Foreign key access pattern makes partitioning ineffective.

---

## When to Revisit Partitioning

### Trigger Conditions

Implement partitioning if **ALL** of the following occur:

1. **Volume**: Reports table exceeds **5 million rows**
2. **Performance**: Query latency exceeds **500ms** for filtered queries
3. **Growth**: Monthly growth rate exceeds **100K rows/month**
4. **Storage**: Table size exceeds **50 GB**

### Recommended Strategy (Future)

**Type**: RANGE partitioning by `created_at`

**Granularity**: Monthly (balance between partition count and size)

**Example Implementation**:

```sql
-- Step 1: Create partitioned table
CREATE TABLE reports_partitioned (
  LIKE reports INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Step 2: Create partitions (automate with cron)
CREATE TABLE reports_2024_01 PARTITION OF reports_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE reports_2024_02 PARTITION OF reports_partitioned
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Step 3: Create indices on each partition (automatic with INCLUDING ALL)
-- Indices: anonymous_id, status, category, zone, created_at, search_vector

-- Step 4: Migrate data (requires downtime)
INSERT INTO reports_partitioned SELECT * FROM reports;

-- Step 5: Rename tables
ALTER TABLE reports RENAME TO reports_old;
ALTER TABLE reports_partitioned RENAME TO reports;

-- Step 6: Drop old table after verification
DROP TABLE reports_old;
```

**Maintenance**:
```sql
-- Monthly cron job to create new partition
CREATE TABLE reports_2024_03 PARTITION OF reports
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- Quarterly archival (move old partitions to cold storage)
ALTER TABLE reports DETACH PARTITION reports_2022_01;
-- Move to archive table or export to S3
```

---

## Alternative Strategy: Archival

**Recommendation**: Implement **archival** instead of partitioning.

**Approach**:
1. Create `reports_archive` table (same schema)
2. Move reports older than 2 years to archive
3. Keep main table lean (<1M rows)
4. Archive table can be partitioned if needed

**Benefits**:
- Simpler than partitioning
- No query changes needed
- Reversible (can restore from archive)
- Lower operational complexity

**Implementation**:
```sql
-- Create archive table
CREATE TABLE reports_archive (LIKE reports INCLUDING ALL);

-- Quarterly archival job
INSERT INTO reports_archive 
SELECT * FROM reports 
WHERE created_at < NOW() - INTERVAL '2 years';

DELETE FROM reports 
WHERE created_at < NOW() - INTERVAL '2 years';

-- Vacuum to reclaim space
VACUUM FULL reports;
```

---

## Monitoring Plan

### Quarterly Review

**Metrics to Track**:
```sql
-- 1. Table size
SELECT 
  pg_size_pretty(pg_total_relation_size('reports')) as total_size,
  pg_size_pretty(pg_relation_size('reports')) as table_size,
  pg_size_pretty(pg_total_relation_size('reports') - pg_relation_size('reports')) as index_size;

-- 2. Row count
SELECT COUNT(*) FROM reports;

-- 3. Growth rate (monthly)
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as new_reports
FROM reports
WHERE created_at > NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month DESC;

-- 4. Query performance
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%FROM reports%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Decision Matrix**:
| Metric | Current | Threshold | Action |
|--------|---------|-----------|--------|
| Rows | <100K | >5M | Partition |
| Table Size | <5 GB | >50 GB | Partition |
| Query Latency | <50ms | >500ms | Partition |
| Monthly Growth | <10K | >100K | Partition |

---

## Conclusion

**Current Status**: ✅ **Optimized without partitioning**

**Optimizations in Place**:
1. Composite indices for common filter combinations
2. Full-text search for efficient text queries
3. Proper index strategy (B-Tree + GIN)

**Next Steps**:
1. Monitor table growth quarterly
2. Implement archival strategy when table reaches 1M rows
3. Revisit partitioning only if trigger conditions are met

**Estimated Timeline**:
- Archival needed: 1-2 years
- Partitioning needed: 5-10 years (if ever)

**Recommendation**: Focus on application-level optimizations (caching, pagination, query optimization) rather than database partitioning.
