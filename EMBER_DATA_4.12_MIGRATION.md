# Ember Data 4.12 Migration Analysis

## Summary

Ember Data 4.12 removes the `RecordData` API entirely, which is the core abstraction this addon relies on. The addon currently extends `RecordData` to provide custom fragment state management.

## Private APIs Used by This Addon

### From `ember-data/-private` (main package)

**Status in 4.12:**

- ✅ `Snapshot` - Still available, moved to `@ember-data/legacy-compat/-private`
- ✅ `normalizeModelName` - Still available in `@ember-data/store/-private`
- ❌ **`RecordData` - REMOVED** - Was from `@ember-data/record-data/-private` which no longer exists in 4.12

### From `@ember-data/store/-private`

**Status in 4.12:**

- ❌ **`recordDataFor` - REMOVED** - This function accessed the RecordData for a given record
- ✅ `recordIdentifierFor` - Available (replacement approach, but different API)

### From `@ember-data/model/-private`

**Status in 4.12:**

- ✅ `diffArray` - Still available

## Files Affected

### Critical - Uses RecordData class

1. **addon/record-data.js** - Extends `RecordData` class
   - Line 2: `import { RecordData } from 'ember-data/-private'`
   - The entire `FragmentRecordData` class extends `RecordData`

### Uses recordDataFor function

2. **addon/fragment.js** - Line 6
3. **addon/array/fragment.js** - Line 6
4. **addon/attributes/fragment.js** - Line 4
5. **addon/attributes/array.js** - Line 4
6. **addon/attributes/fragment-owner.js** - Line 4
7. **addon/attributes/fragment-array.js** - Line 5
8. **addon/record-data.js** - Line 4

## Breaking Changes

### 1. RecordData API Removed (CRITICAL)

**What it was:** RecordData was a public-private API that allowed customization of how Ember Data stores and manages record state. The addon extends this class as `FragmentRecordData`.

**Why it's gone:** Ember Data 4.x moved to a new architecture based on:

- `Cache` interface (from `@ember-data/store`)
- `SchemaService`
- Direct identifier-based APIs

**Impact:** The entire `addon/record-data.js` file (1093 lines) needs to be rewritten.

### 2. recordDataFor Function Removed

**What it was:** A utility function to get the RecordData instance for a given record.

**Why it's gone:** No more RecordData instances to retrieve.

**Potential replacement:** `recordIdentifierFor()` + store's cache API

## Migration Path

### Option 1: Rewrite using Cache API (Recommended for 5.x+)

The Cache API is the official replacement for RecordData. However, this would require:

1. Implementing a custom `Cache` class instead of extending `RecordData`
2. Registering the custom cache with the store
3. Updating all fragment state management logic
4. **Major architectural changes** - Cache works differently than RecordData

### Option 2: Use Internal Model Hooks

Some fragment-like behavior might be achievable through:

- Model lifecycle hooks
- Computed properties
- Custom serializer/adapter logic

However, this would significantly reduce functionality.

### Option 3: Fork and Maintain RecordData (Not recommended)

Copy the old RecordData implementation into this addon. This would:

- Make the addon much larger
- Require ongoing maintenance of ember-data internals
- Likely break with future ember-data versions anyway

## Recommended Action

The addon is **not compatible with Ember Data >= 4.7** due to the removal of RecordData API. The breaking changes are too substantial for a simple migration.

**Options for users:**

1. Stay on Ember Data 4.6.x (current supported version)
2. Complete rewrite of the addon using Cache API (major undertaking)
3. Consider alternative approaches:
   - Use nested JSON with computed properties
   - Use embedded records with proper IDs
   - Use `@ember-data/json-api` with includes/relationships

## Private APIs Still Working

These APIs are still available in 4.12 and should continue to work:

- `Snapshot` (from `@ember-data/legacy-compat/-private`)
- `normalizeModelName` (from `@ember-data/store/-private`)
- `diffArray` (from `@ember-data/model/-private`)
- `recordIdentifierFor` (from `@ember-data/store/-private`)

## Conclusion

**RecordData is the blocker.** Without it, the core architecture of this addon cannot function. A full rewrite using the Cache API would be required to support Ember Data 4.7+.

The README already correctly states: "Not Compatible" with Ember Data >= 4.7.
