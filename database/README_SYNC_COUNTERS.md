# Counter Synchronization System

## Overview

This system provides a safety net to detect and fix desynchronized counters in the database. Counters can become incorrect if triggers fail or operations occur outside expected flows.

## Functions

The migration `migration_add_sync_counters_functions.sql` creates three SQL functions:

1. **`sync_report_counters()`**: Synchronizes counters in `reports` and `comments` tables
   - `reports.upvotes_count`
   - `reports.comments_count`
   - `comments.upvotes_count`

2. **`sync_user_counters()`**: Synchronizes counters in `anonymous_users` table
   - `anonymous_users.total_reports`
   - `anonymous_users.total_comments`
   - `anonymous_users.total_votes`

3. **`sync_all_counters()`**: Calls both functions above to sync all counters

## Usage

### Running the Script

From the `server/` directory:

```bash
npm run sync:counters
```

Or directly:

```bash
node src/scripts/syncCounters.js
```

### What It Does

The script:
1. Checks if sync functions exist in the database
2. Calls `sync_all_counters()` to recalculate all counters from actual data
3. Displays a summary of records fixed
4. Shows details for the first few fixed records

### Example Output

```
🔄 Starting counter synchronization...

✅ reports: Fixed 5 record(s)
   Preview (3 of 5):
   - ID abc-123: 10 → 12
   - ID def-456: 5 → 7
   - ID ghi-789: 0 → 1
   ... and 2 more

✓ comments: All counters are synchronized

✅ anonymous_users: Fixed 2 record(s)
   Preview (2 of 2):
   - User xyz-789: reports: 10 → 12, comments: 5 → 7

📊 Summary: 7 total record(s) fixed

✅ Synchronization completed successfully!
```

## When to Run

- **After database issues**: If you suspect counters are incorrect
- **Periodically**: As a maintenance task (e.g., weekly/monthly)
- **After bulk operations**: If you've done manual data changes
- **Before important reports**: To ensure data accuracy

## Safety

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Non-destructive**: Only updates incorrect counters
- ✅ **Performance**: Uses efficient CTEs and JOINs
- ✅ **No downtime**: Can run while the application is live

## Technical Details

The functions:
- Recalculate counters using `COUNT(*)` from actual data
- Only update records where counters differ
- Return JSONB details of what was fixed
- Do not interfere with existing triggers

## Maintenance

The sync functions are a **safety net**, not a replacement for triggers. Triggers are still the primary mechanism for maintaining counters. The sync functions exist to catch and correct any discrepancies that may occur.

