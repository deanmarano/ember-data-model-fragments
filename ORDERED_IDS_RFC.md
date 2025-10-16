# RFC: Fragments with Ordered IDs - Moving Away from Private APIs

## Summary

This RFC proposes a fundamental architecture change for ember-data-model-fragments to eliminate dependency on private Ember Data APIs (RecordData, recordDataFor, InternalModel) by giving fragments ordered composite IDs and treating them as regular Ember Data models with relationships.

## Motivation

**Current State:**
- Addon relies on `RecordData` API (removed in Ember Data 4.7+)
- Uses `recordDataFor()` and `InternalModel` lifecycle hooks (private APIs)
- Cannot upgrade beyond Ember Data 4.6.x
- 1,093 lines of custom RecordData implementation

**Problem:**
- Ember Data 4.7+ removed RecordData entirely
- No migration path to Cache API maintains current semantics
- Users stuck on old Ember Data versions
- Maintenance burden of private API dependencies

## Detailed Design

### Core Concept: Fragments as Models with Composite IDs

Instead of fragments being "sub-documents" managed by custom RecordData, they become **regular Ember Data models** with:

1. **Composite IDs** encoding parent context and position
2. **Standard relationships** (`hasMany`/`belongsTo`)
3. **Serializer magic** converting between nested JSON and separate models

### ID Format

```
Format: "{parentType}:{parentId}:{key}:{position}"

Examples:
- person:123:addresses:0  // First address
- person:123:addresses:1  // Second address
- person:123:name:0       // Singleton fragment

Polymorphic:
- activity:456:target:0:photo  // Photo target
- activity:456:target:0:video  // Video target
```

### Architecture Changes

#### 1. Fragment Models (No Changes to User Code!)

```javascript
// User's fragment model - NO CHANGES NEEDED
import Fragment from 'ember-data-model-fragments/fragment';
import { attr } from '@ember-data/model';

export default class AddressFragment extends Fragment {
  @attr('string') street;
  @attr('string') city;
  @attr('string') state;
  @attr('string') zip;
}
```

**Behind the scenes**, Fragment now:
- Extends `Model` (not custom RecordData)
- Adds internal metadata attributes (`__fragmentPosition`, `__fragmentParentId`, etc.)
- Uses standard Ember Data model lifecycle

#### 2. Owner Models (No Changes to User Code!)

```javascript
// User's owner model - NO CHANGES NEEDED
import Model from '@ember-data/model';
import { attr } from '@ember-data/model';
import { fragmentArray } from 'ember-data-model-fragments/attributes';

export default class PersonModel extends Model {
  @attr('string') name;
  @fragmentArray('address') addresses;
}
```

**Behind the scenes**, `@fragmentArray`:
- Creates a `@hasMany` relationship
- Registers fragment configuration
- Sets up dirty tracking propagation

#### 3. Serializer (Automatic)

The addon provides serializers that automatically:

**Normalize (Server → Client):**
```javascript
// Server sends:
{
  id: "123",
  name: "John",
  addresses: [
    { street: "123 Main", city: "Springfield" },
    { street: "456 Oak", city: "Shelbyville" }
  ]
}

// Serializer transforms to:
{
  data: {
    type: "person",
    id: "123",
    attributes: { name: "John" },
    relationships: {
      addresses: {
        data: [
          { type: "address", id: "person:123:addresses:0" },
          { type: "address", id: "person:123:addresses:1" }
        ]
      }
    }
  },
  included: [
    {
      type: "address",
      id: "person:123:addresses:0",
      attributes: {
        street: "123 Main",
        city: "Springfield",
        __fragmentPosition: 0,
        __fragmentParentId: "123",
        ...
      }
    },
    // ... address 1
  ]
}
```

**Serialize (Client → Server):**
```javascript
// Client models → Nested JSON (metadata stripped)
{
  id: "123",
  name: "John",
  addresses: [
    { street: "123 Main", city: "Springfield" },
    { street: "456 Oak", city: "Shelbyville" }
  ]
}
```

### Benefits

#### ✅ Zero Private APIs

| Current (Private) | New (Public) |
|-------------------|--------------|
| `RecordData` class | `Model` class |
| `recordDataFor()` | Standard relationships |
| `InternalModel` lifecycle | Model lifecycle |
| Custom state buckets | Standard dirty tracking |
| `identifierCache` | Standard `createRecord` |

#### ✅ Ember Data 4.6 AND 5.x Compatible

All APIs used exist in both versions:
- `@attr`, `@hasMany`, `@belongsTo`
- `JSONSerializer`
- `store.createRecord`, `store.push`
- Standard model lifecycle

#### ✅ Better Conflict Resolution

**Current Problem:**
```javascript
// Server data: [addrA, addrB]
// Client modifies addrB (position 1)
// Server returns: [addrB, addrA] (reordered!)
// Current behavior: Merges by index → DATA LOSS
```

**With Ordered IDs:**
```javascript
// addrB has ID: person:123:addresses:1
// Server returns it at position 0
// New ID would be: person:123:addresses:0
// We can DETECT the reordering and handle appropriately
```

#### ✅ Simpler Implementation

- Remove 1,093 lines of FragmentRecordData
- Remove InternalModel coordination code
- Remove custom state management
- Use standard Ember Data patterns

#### ✅ Future-Proof

Based on stable, public APIs that won't be removed

### Tradeoffs

#### ❌ Breaking Change

- Requires full migration from current version
- Cannot provide compatibility layer
- Users must update all fragment code

#### ❌ Memory Overhead

- Every fragment is a full Model instance
- Fragments need IDs (small string overhead)
- More relationship tracking

#### ❌ Serialization Complexity

- Addon must flatten/nest on serialize/normalize
- Custom serializer required for each owner model (can be automated)

#### ❌ ID Immutability

- Ember Data doesn't allow changing IDs after creation
- Reordering fragments requires sparse positions OR delete/recreate
- Position in ID may not match current array position

### Migration Strategy

#### Phase 1: Parallel Implementation (v7.0.0-beta)

- Keep current RecordData implementation
- Add new ordered-ID implementation as opt-in
- Both APIs available, allowing gradual migration

```javascript
// Opt into new behavior
export default class PersonModel extends Model {
  @fragmentArray('address', { orderedIds: true }) addresses;
}
```

#### Phase 2: Deprecation (v7.x)

- Warn when using old API
- Document migration path
- Provide codemods

#### Phase 3: Remove Old Implementation (v8.0.0)

- Remove RecordData-based code
- Ordered IDs become default and only option
- Support Ember Data 4.6 through 5.x+

### Open Questions

1. **Server ID Visibility**: Should servers ever see fragment IDs, or always client-only?
   - **Recommendation**: Client-only (strip in serializer)

2. **Persistence Model**: Should fragments be independently saveable?
   - **Recommendation**: No - maintain current "save through parent" semantics

3. **Position Renumbering**: Automatic renumbering on reorder, or sparse positions?
   - **Recommendation**: Sparse positions (simpler, ID immutability)

4. **Polymorphic Encoding**: How to encode type in ID?
   - **Current**: `parent:id:key:pos:type`
   - **Alternative**: Separate field, not in ID

5. **Backwards Compatibility**: Can we provide any compatibility layer?
   - **Recommendation**: No - too fundamentally different

### POC Status

**Implemented:**
- ✅ Fragment ID generation/parsing utilities
- ✅ Fragment and owner model implementations
- ✅ Serializer normalization and serialization
- ✅ Dirty tracking propagation
- ✅ 10/14 POC tests passing

**Remaining Work:**
- ⏳ Fix remaining 4 tests (relationship loading edge cases)
- ⏳ Decorator API that matches current addon
- ⏳ Automatic serializer generation
- ⏳ Migration codemods
- ⏳ Full test coverage
- ⏳ Documentation

### Timeline

- **Week 1-2**: Complete POC, all tests passing
- **Week 3-4**: Decorator API matching current addon
- **Week 5-6**: Test coverage, Ember Data 4.12 & 5.x matrix
- **Week 7-8**: Documentation, migration guide
- **Week 9**: Beta release (v7.0.0-beta.1)

### Success Criteria

1. All existing tests pass with new implementation
2. Works with Ember Data 4.6, 4.12, and 5.x
3. Zero private API usage
4. Performance comparable to current implementation
5. Migration guide with codemods

## Alternatives Considered

### Alternative 1: Cache API Implementation

**Approach**: Rewrite using Ember Data 5.x Cache API instead of RecordData

**Pros:**
- Official replacement for RecordData
- Designed for custom state management

**Cons:**
- Only available in ED 5.x+ (not 4.6)
- Still a private API (` @ember-data/store/-private`)
- Cache API significantly different from RecordData
- Would still require ~1000 lines of custom code

**Verdict**: Rejected - doesn't solve private API problem

### Alternative 2: Nested Ember Data Models

**Approach**: Use EmbeddedRecordsMixin with proper IDs

**Pros:**
- Uses only public APIs
- Ember Data handles most logic

**Cons:**
- EmbeddedRecordsMixin has known limitations
- Doesn't support fragment-specific semantics (no save method, etc.)
- Less control over serialization

**Verdict**: Rejected - insufficient control

### Alternative 3: Stay on Ember Data 4.6 Forever

**Approach**: Pin to ED 4.6, maintain current implementation

**Pros**:
- No migration needed
- Current features work

**Cons:**
- Users stuck on old Ember Data
- Eventually unsustainable
- Security/bug fix concerns

**Verdict**: Rejected - not viable long-term

## Implementation

See POC implementation in:
- `addon/utils/fragment-id.js` - ID utilities
- `tests/dummy/app/models/address-v2.js` - Fragment model
- `tests/dummy/app/models/person-v2.js` - Owner model
- `tests/dummy/app/serializers/person-v2.js` - Serializer
- `tests/unit/poc-ordered-ids-test.js` - Test suite (10/14 passing)

## References

- [Ember Data 4.12 Migration Analysis](./EMBER_DATA_4.12_MIGRATION.md)
- [Private API Analysis](./CACHE_API_FEASIBILITY.md)
- [POC Test Results](./tests/unit/poc-ordered-ids-test.js)
