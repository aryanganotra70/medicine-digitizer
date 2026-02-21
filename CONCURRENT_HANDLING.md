# Concurrent User Handling Documentation

## Overview
The system uses **Redis locks with TTL** for distributed locking, ensuring multiple users can work on the same project simultaneously without conflicts.

## Architecture

### Redis-Based Locking
- **Lock Key**: `lock:entry:{entryId}`
- **Lock Value**: `userId` (who owns the lock)
- **TTL**: 10 minutes (600 seconds)
- **Auto-expiration**: Lock automatically releases after TTL

### Database Status Tracking
- Database tracks final status (COMPLETED, SKIPPED, FAILED)
- Redis lock is the source of truth for "in progress" state
- Database `IN_PROGRESS` status is for tracking only

## Entry Assignment Flow

### 1. User Requests Next Entry (`/api/projects/[id]/next-entry`)

**Step 1: Find PENDING Entries**
- Query database for entries with `status = PENDING`
- Fetch first 20 entries (ordered by creation date)

**Step 2: Check Redis Locks**
- For each entry, check if locked in Redis
- Skip locked entries (being processed by other users)

**Step 3: Acquire Lock**
- Try to acquire Redis lock with `SET lock:entry:{id} {userId} EX 600 NX`
- `NX` = Only set if not exists (atomic operation)
- `EX 600` = Expire after 10 minutes
- If lock acquired, assign entry to user

**Step 4: Update Database**
- Mark entry as `IN_PROGRESS` in database
- Set `assignedTo = userId`
- Update `updatedAt` timestamp

**Result**: User gets unique entry, Redis prevents duplicates

## Status Lifecycle

```
PENDING → [Redis Lock] → IN_PROGRESS → COMPLETED/SKIPPED/FAILED
                ↓
         (TTL expires after 10 min)
                ↓
         Lock auto-released
```

### Status Definitions

- **PENDING**: Available for assignment, not locked
- **IN_PROGRESS**: Locked in Redis, being worked on
- **COMPLETED**: User clicked Next, images processed successfully
- **SKIPPED**: User clicked Skip
- **FAILED**: Image processing failed

## Redis Lock Operations

### Lock Entry
```typescript
lockEntry(entryId, userId, 600) // 10 min TTL
```

### Unlock Entry
```typescript
unlockEntry(entryId) // Manual release
```

### Check Lock Status
```typescript
isEntryLocked(entryId) // Returns boolean
```

### Get Lock Owner
```typescript
getEntryLock(entryId) // Returns userId or null
```

## Concurrent Scenarios

### Scenario 1: Two Users Request Entry Simultaneously
- User A requests entry
- User B requests entry at same time
- Both see Entry #1 as PENDING
- User A tries to lock → Redis SET NX succeeds
- User B tries to lock → Redis SET NX fails (already exists)
- User A gets Entry #1
- User B gets Entry #2

### Scenario 2: User Closes Browser Mid-Work
- Entry locked in Redis with 10-minute TTL
- User closes browser
- After 10 minutes, Redis lock expires automatically
- Entry becomes available again (still PENDING in DB)
- Another user can pick it up

### Scenario 3: User Completes Entry
- User clicks "Next"
- API calls `unlockEntry()` immediately
- Background processing starts
- Lock released, entry available if processing fails
- Database updated to COMPLETED when done

### Scenario 4: User Skips Entry
- User clicks "Skip"
- API calls `unlockEntry()` immediately
- Database updated to SKIPPED
- Entry won't be shown again (status filter)

### Scenario 5: Processing Fails
- Background processing encounters error
- `unlockEntry()` called in catch block
- Database updated to FAILED
- Entry can be manually reassigned by admin

## Why Redis Locks > Database TTL

### Problems with Database TTL Approach
❌ Race conditions between checking and updating
❌ Requires complex transactions
❌ Database load for frequent checks
❌ No atomic "check and set" operation
❌ Stale data issues

### Benefits of Redis Locks
✅ Atomic operations (`SET NX`)
✅ Automatic TTL expiration
✅ Fast in-memory operations
✅ Distributed lock support
✅ No database transactions needed
✅ Clean separation of concerns

## Ensuring Complete Coverage

### All Entries Are Processed
1. **Initial State**: All entries start as `PENDING`
2. **Lock Check**: Only unlocked `PENDING` entries are assigned
3. **TTL Safety**: Locks auto-expire after 10 minutes
4. **Completion**: Entry must reach `COMPLETED`, `SKIPPED`, or `FAILED`
5. **Lock Release**: Always released on Skip/Next/Error

### No Duplicate Processing
- Redis `SET NX` ensures only one user can lock an entry
- Lock must be released before entry can be reassigned
- Database status prevents re-showing completed entries

### Abandoned Entry Recovery
- Redis TTL automatically releases locks after 10 minutes
- No manual cleanup needed
- Entry becomes available immediately after TTL

## Monitoring

### Redis Keys
```bash
# Check all locks
redis-cli KEYS "lock:entry:*"

# Check specific lock
redis-cli GET "lock:entry:{entryId}"

# Check TTL
redis-cli TTL "lock:entry:{entryId}"
```

### Database Queries
```sql
-- Entries in progress
SELECT * FROM "MedicineEntry" WHERE status = 'IN_PROGRESS';

-- Completed entries
SELECT * FROM "MedicineEntry" WHERE status = 'COMPLETED';

-- Available entries
SELECT * FROM "MedicineEntry" WHERE status = 'PENDING';
```

## Performance

- **Lock Acquisition**: ~1ms (Redis in-memory)
- **Lock Check**: ~1ms (Redis GET)
- **Database Query**: ~10-50ms (PostgreSQL)
- **Total Assignment**: ~50-100ms

## Scalability

- Redis handles 100k+ ops/second
- Supports multiple app instances
- Horizontal scaling ready
- No single point of failure (Redis cluster)

