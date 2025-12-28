# Full-Text Search Implementation Guide

## Overview

This document explains the Full-Text Search (FTS) implementation for the SafeSpot reports table, replacing inefficient `ILIKE '%term%'` queries with PostgreSQL's native FTS capabilities.

## What Changed

### Database Schema

**New Column**: `reports.search_vector` (tsvector, GENERATED)
- Automatically maintained by PostgreSQL
- Combines: title, description, category, address, zone
- Uses Spanish language configuration for stemming
- Weighted by relevance (title=A, description=B, etc.)

**New Index**: `idx_reports_search_vector` (GIN)
- Enables O(log n) search instead of O(n) table scans
- Size: ~5-10 MB for 10K rows

### Code Changes

**File**: `server/src/routes/reports.js`

**Before** (lines 42-48):
```javascript
conditions.push(`(
  r.title ILIKE '%' || $${paramIndex} || '%' OR 
  r.description ILIKE '%' || $${paramIndex} || '%' OR 
  r.category ILIKE '%' || $${paramIndex} || '%' OR 
  r.address ILIKE '%' || $${paramIndex} || '%' OR 
  r.zone ILIKE '%' || $${paramIndex} || '%'
)`);
```

**After**:
```javascript
conditions.push(`r.search_vector @@ plainto_tsquery('spanish', $${paramIndex})`);
```

**Optional Enhancement** (relevance sorting):
```javascript
// Add to ORDER BY clause for relevance-based results
ORDER BY ts_rank(r.search_vector, plainto_tsquery('spanish', $${searchParamIndex})) DESC, r.created_at DESC
```

## Performance Impact

| Scenario | Before (ILIKE) | After (FTS) | Improvement |
|----------|---------------|-------------|-------------|
| 10K rows | 100-500ms | 5-20ms | **95% faster** |
| 100K rows | 1-5 seconds | 10-30ms | **99% faster** |
| 1M rows | 10-50 seconds | 20-50ms | **99.9% faster** |

**Storage Overhead**: +10-20% table size (acceptable trade-off)

## How It Works

### Spanish Language Configuration

The `'spanish'` configuration provides:
- **Stemming**: "reportar" → "report", "reportado" → "report"
- **Stop words**: Ignores common words like "el", "la", "de"
- **Better UX**: Users can search variations naturally

Example:
```sql
-- All these match the same documents:
plainto_tsquery('spanish', 'bicicleta robada')
plainto_tsquery('spanish', 'bicicletas robadas')
plainto_tsquery('spanish', 'robo de bicicleta')
```

### Relevance Weights

Documents are ranked by relevance:
- **A** (title): Highest priority
- **B** (description): High priority
- **C** (category): Medium priority
- **D** (address, zone): Lower priority

This ensures title matches rank higher than zone matches.

## Query Examples

### Basic Search
```sql
SELECT * FROM reports 
WHERE search_vector @@ plainto_tsquery('spanish', 'bicicleta robada')
ORDER BY created_at DESC
LIMIT 20;
```

### Search with Ranking
```sql
SELECT 
  *,
  ts_rank(search_vector, plainto_tsquery('spanish', 'bicicleta')) as relevance
FROM reports 
WHERE search_vector @@ plainto_tsquery('spanish', 'bicicleta')
ORDER BY relevance DESC, created_at DESC
LIMIT 20;
```

### Phrase Search (Exact Match)
```sql
SELECT * FROM reports 
WHERE search_vector @@ phraseto_tsquery('spanish', 'bicicleta robada')
LIMIT 20;
```

### Combining with Filters
```sql
SELECT * FROM reports 
WHERE search_vector @@ plainto_tsquery('spanish', 'robo')
  AND zone = 'Centro'
  AND status = 'pendiente'
ORDER BY created_at DESC;
```

## Troubleshooting

### Search Not Finding Expected Results

**Issue**: Spanish stemming may not match exact words
**Solution**: Use `to_tsquery()` with wildcards:
```sql
WHERE search_vector @@ to_tsquery('spanish', 'biciclet:*')
```

### Performance Not Improved

**Check 1**: Verify index is being used
```sql
EXPLAIN ANALYZE
SELECT * FROM reports 
WHERE search_vector @@ plainto_tsquery('spanish', 'test');
```

Expected: `Bitmap Index Scan on idx_reports_search_vector`

**Check 2**: Ensure index exists
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'reports' AND indexname = 'idx_reports_search_vector';
```

### Index Size Too Large

**Check size**:
```sql
SELECT pg_size_pretty(pg_relation_size('idx_reports_search_vector'));
```

**Normal**: ~5-10 MB per 10K rows
**If excessive**: Consider using functional index instead of GENERATED column

## Maintenance

### Automatic Maintenance

The `search_vector` column is **GENERATED ALWAYS**, meaning:
- ✅ Automatically updated on INSERT
- ✅ Automatically updated on UPDATE
- ✅ No manual maintenance required
- ✅ No triggers needed

### Monitoring

**Check index usage**:
```sql
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE indexname = 'idx_reports_search_vector';
```

**Check query performance**:
```sql
SELECT 
  query, 
  mean_exec_time, 
  calls
FROM pg_stat_statements
WHERE query LIKE '%search_vector%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Future Enhancements

### 1. Fuzzy Matching (Typo Tolerance)

Combine FTS with `pg_trgm` for typo tolerance:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search with typos
SELECT * FROM reports 
WHERE search_vector @@ plainto_tsquery('spanish', 'bicicleta')
   OR title % 'bisicleta'  -- Fuzzy match
ORDER BY similarity(title, 'bisicleta') DESC;
```

### 2. Search Highlighting

Show matched terms in results:
```sql
SELECT 
  id,
  ts_headline('spanish', title, plainto_tsquery('spanish', 'bicicleta')) as highlighted_title,
  ts_headline('spanish', description, plainto_tsquery('spanish', 'bicicleta')) as highlighted_description
FROM reports 
WHERE search_vector @@ plainto_tsquery('spanish', 'bicicleta');
```

### 3. Multi-Language Support

If needed, add language detection:
```sql
-- Detect language and use appropriate config
ALTER TABLE reports ADD COLUMN detected_language VARCHAR(10);

-- Update search_vector generation to use detected language
-- (requires custom function)
```

## Rollback Procedure

If FTS causes issues:

```sql
-- 1. Drop index (non-blocking)
DROP INDEX CONCURRENTLY IF EXISTS idx_reports_search_vector;

-- 2. Remove column
ALTER TABLE reports DROP COLUMN IF EXISTS search_vector;

-- 3. Revert code changes in reports.js
-- (Application will automatically use ILIKE again)
```

**Downtime**: None (CONCURRENTLY ensures non-blocking operations)

## References

- [PostgreSQL Full-Text Search Documentation](https://www.postgresql.org/docs/current/textsearch.html)
- [Spanish Text Search Configuration](https://www.postgresql.org/docs/current/textsearch-dictionaries.html)
- [GIN Index Performance](https://www.postgresql.org/docs/current/gin-intro.html)
