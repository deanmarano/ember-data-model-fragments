# Cache API Feasibility Analysis

## Executive Summary

**Answer: Partially, but with significant architectural changes required.**

The Cache API in Ember Data 4.12+ provides some of the necessary capabilities to implement fragment-like behavior, but it operates at a fundamentally different level of abstraction than RecordData. A migration would require substantial rearchitecting of how fragments work.

## Cache API Capabilities vs. Requirements

### ✅ What the Cache API Provides

The Cache interface in Ember Data 4.12 includes these relevant methods:

#### State Management

- `put(doc)` - Cache responses with replace semantics
- `patch(op)` - Update canonical/remote state
- `mutate(mutation)` - Update local/current state
- `peek(identifier)` - Retrieve resource data
- `upsert(identifier, data, hasRecord)` - Push remote data

#### Lifecycle Hooks

- `clientDidCreate(identifier, createArgs)` - New record created
- `willCommit(identifier)` - Resource will be saved
- `didCommit(identifier, data)` - Save succeeded
- `commitWasRejected(identifier, errors)` - Save failed
- `unloadRecord(identifier)` - Clear resource data

#### Attribute Operations

- `getAttr(identifier, field)` - Get attribute value
- `setAttr(identifier, field, value)` - Set attribute value
- `hasChangedAttrs(identifier)` - Check for dirty attributes
- `rollbackAttrs(identifier)` - Discard uncommitted changes

#### State Queries

- `isEmpty(identifier)` - Check if resource has data
- `isNew(identifier)` - Check if locally created
- `isDeleted(identifier)` - Check if marked deleted

### ❌ What's Missing or Different

#### 1. **No Built-in Hierarchical/Nested State Management**

**Current approach (RecordData):**

```javascript
// FragmentRecordData maintains 3 state buckets PER FRAGMENT:
_fragmentData; // canonical state
_fragments; // dirty state
_inFlightFragments; // saving state

// Each fragment is a RecordData instance with full lifecycle
```

**Cache API approach:**

```javascript
// Cache operates at RESOURCE level with identifiers
// Attributes are flat - no built-in parent/child relationships
// Would need to manage fragment identity/hierarchy manually
```

**Impact:** Fragments don't have IDs/identifiers. The entire Cache API is built around `StableRecordIdentifier`. You would need to either:

- Generate synthetic identifiers for fragments (breaking the "fragments have no identity" principle)
- Store fragments as opaque nested JSON in attributes (losing lifecycle hooks)

#### 2. **No Automatic Dirty State Propagation**

**Current approach:**

```javascript
// Fragment → Parent propagation is automatic
fragmentDidDirty() {
  if (!this._fragmentOwner) return;
  const { recordData: owner, key } = this._fragmentOwner;
  owner._fragments[key] = owner._fragmentData[key];
  owner.notifyStateChange(key);
  owner.fragmentDidDirty(); // RECURSIVE
}
```

**Cache API approach:**

```javascript
// No built-in parent/child dirty tracking
// hasChangedAttrs() only checks the resource, not nested data
// Would need manual propagation logic
```

**Impact:** Need to manually implement the entire dirty tracking chain from deeply nested fragments up to the root record.

#### 3. **No Fragment-Specific Lifecycle**

**Current RecordData:** Each fragment has full lifecycle:

- `willCommit()` on fragment
- `didCommit()` on fragment
- `commitWasRejected()` on fragment
- `rollbackAttributes()` on fragment

**Cache API:** Lifecycle methods accept `identifier` parameter:

- Only works for resources with identifiers
- No way to hook into nested object changes within an attribute

**Impact:** Would lose granular fragment lifecycle control.

## Required RecordData Features

Here's what `FragmentRecordData` currently does:

### Core State Management (1093 lines)

1. **Three-Level State Tracking**

   - Canonical state (`_fragmentData`)
   - Dirty state (`_fragments`)
   - In-flight state (`_inFlightFragments`)

2. **Fragment Owner Tracking**

   - `setFragmentOwner(recordData, key)` - Track parent
   - `getFragmentOwner()` - Access parent
   - Enforce single-owner constraint

3. **Recursive Dirty State Propagation**

   - Changes in deeply nested fragments bubble up
   - Parent `hasDirtyAttributes` reflects child changes
   - Auto-propagation on `setDirtyFragment()`

4. **Granular Lifecycle Management**

   - Per-fragment `willCommit()`
   - Per-fragment `didCommit()`
   - Per-fragment `commitWasRejected()`
   - Per-fragment `rollbackAttributes()`
   - Per-fragment `unloadRecord()`

5. **Fragment Array Support**

   - Array-level dirty tracking
   - Item-level dirty tracking
   - Index-based merging on `pushData()`

6. **Polymorphic Fragment Support**
   - Dynamic type resolution via `typeKey`
   - Instantiate correct fragment subclass

## Migration Challenges

### Challenge 1: Identity Problem

**Fragment philosophy:** Fragments have no identity (no ID)
**Cache API requirement:** Everything needs a `StableRecordIdentifier`

**Potential solutions:**
a) Generate synthetic IDs for fragments

- **Pro:** Could use Cache API normally
- **Con:** Violates fragment principle, adds ID tracking overhead

b) Store fragments as opaque JSON attributes

- **Pro:** No ID needed
- **Con:** Lose all Cache lifecycle hooks, becomes "dumb" JSON

c) Use composite identifiers (parent ID + path)

- **Pro:** Unique identification
- **Con:** Complex, need custom identifier generation

### Challenge 2: Hierarchy Management

The Cache API has no concept of parent/child resources. You'd need to:

1. **Manually track fragment ownership**

   - Store `parentIdentifier + attributePath` mapping
   - Implement custom owner lookup

2. **Manually propagate dirty state**

   - Hook into `setAttr()` for fragment attributes
   - Walk up parent chain marking dirty
   - Much more complex than current automatic propagation

3. **Coordinate nested commits**
   - Override `willCommit()` to handle fragment tree
   - Override `didCommit()` to update fragment tree
   - Handle partial failures in fragment array items

### Challenge 3: Transform Integration

Current approach uses Ember Data transforms:

```javascript
// Fragments are transformed attributes
@fragment('name') name;
@fragmentArray('address') addresses;

// Transforms handle serialization/deserialization
```

Cache API approach:

```javascript
// Attributes are primitives or opaque objects
// Would need custom handling in Cache.setAttr()/getAttr()
// Or handle in serializer, losing runtime manipulation
```

## Could It Work?

### Theoretical Approach

```javascript
class FragmentCache extends JSONAPICache {
  // Override setAttr to intercept fragment attribute changes
  setAttr(identifier, field, value) {
    const def = this.schema.fields({ type: identifier.type }).get(field);

    if (def && def.kind === "fragment") {
      // Generate synthetic identifier for fragment
      const fragmentId = this._createFragmentIdentifier(identifier, field);

      // Store fragment as separate resource
      this.upsert(fragmentId, value, false);

      // Store reference in parent
      super.setAttr(identifier, field, { fragmentId });

      // Manually propagate dirty state
      this._propagateDirtyState(identifier);
    } else {
      super.setAttr(identifier, field, value);
    }
  }

  _propagateDirtyState(identifier) {
    // Need to manually check if this is a fragment
    const owner = this._getFragmentOwner(identifier);
    if (owner) {
      // Mark owner as dirty
      // Recursively propagate if owner is also a fragment
    }
  }
}
```

**Problems:**

1. Still need synthetic identifiers
2. Fragments become "real" resources (clutter identity cache)
3. Manual dirty propagation is error-prone
4. Relationship tracking becomes complex
5. Serialization/deserialization needs custom handling

### Practical Assessment

| Requirement                 | Cache API Support            | Effort Level |
| --------------------------- | ---------------------------- | ------------ |
| Nested object storage       | ✅ Via opaque attributes     | Easy         |
| Dirty tracking              | ⚠️ Manual only               | Hard         |
| State propagation           | ❌ Not built-in              | Very Hard    |
| Lifecycle hooks             | ⚠️ Resource-level only       | Hard         |
| Fragment arrays             | ⚠️ Possible but awkward      | Hard         |
| Polymorphic fragments       | ⚠️ Possible with workarounds | Medium       |
| No IDs (fragment principle) | ❌ Conflicts with Cache API  | Impossible\* |

\*Without generating synthetic identifiers

## Recommendation

### Short Answer: No, not practically

While the Cache API _could_ theoretically support fragments with extensive custom code, the implementation would be:

1. **Extremely complex** - More code than current RecordData approach
2. **Fighting the API** - Cache assumes identified resources, fragments don't have identity
3. **Performance concerns** - Manual dirty tracking and propagation overhead
4. **Maintenance burden** - Deep integration with Cache internals
5. **Breaking changes** - Fragment API/behavior would change significantly

### Better Alternative

If Ember Data 4.7+ compatibility is required, consider:

#### Option A: Embedded Records with IDs

Use proper JSON:API relationships with embedded records:

```javascript
// Instead of fragments
@hasMany('address', { embedded: true }) addresses;

// addresses now have IDs and full lifecycle
```

**Tradeoffs:**

- Fragments must have IDs
- More complex JSON structure
- But: Full Ember Data support

#### Option B: Computed Properties + JSON Attributes

```javascript
class Person extends Model {
  @attr("raw") nameData; // stores { first, last }

  @computed("nameData.{first,last}")
  get name() {
    return Name.create(this.nameData);
  }
}
```

**Tradeoffs:**

- No automatic dirty tracking
- Manual serialization
- But: Simple, no identity issues

#### Option C: Maintain Ember Data 4.6.x

The README is correct: stick with Ember Data 4.6.x until a proper migration path exists.

## Conclusion

The Cache API does NOT provide an easy migration path for ember-data-model-fragments. The fundamental mismatch is:

- **Fragments:** ID-less nested objects with automatic state management
- **Cache API:** ID-based resource management with flat attributes

Migrating would require either:

1. Abandoning the fragment concept (use IDs)
2. Building a RecordData-equivalent layer on top of Cache (massive work)
3. Storing fragments as opaque JSON (losing all lifecycle features)

**None of these preserve the current fragment functionality.**

The addon should remain on Ember Data 4.6.x until either:

- Ember Data adds first-class nested object support
- A new fragment-specific API emerges
- The community develops a Cache-based fragment solution
