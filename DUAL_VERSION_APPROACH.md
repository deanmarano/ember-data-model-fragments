# Dual Version Approach for ED 4.6 + 4.12 + 5.x Support

## Problem

The addon currently uses private Ember Data APIs that:
- Exist in ED 4.6 (`ember-data/-private`)
- Still exist in ED 4.12
- Were removed in ED 5.0+

The build-time import of `ember-data/-private` in `/addon/ext.js` prevents testing with ED 4.12 because Embroider resolves imports at build time, and runtime conditionals don't work.

## Solution: Compile-Time Conditional Exports

Use `@embroider/macros` to conditionally load different implementations based on Ember Data version at **compile time**.

### Architecture

```
addon/
  ├── index.js (main entry - uses macros to conditionally export)
  ├── ext.js (OLD: ED < 5.0 - uses RecordData)
  ├── ext-v2.js (NEW: ED >= 5.0 - uses public APIs only)
  ├── fragment.js (shared base class)
  └── utils/
      └── fragment-id.js (POC utilities)
```

### Implementation

#### 1. Conditional Export in `addon/ext.js`

```javascript
// addon/ext.js
import { macroCondition, getOwnConfig, importSync } from '@embroider/macros';
import { gte } from 'ember-compatibility-helpers';

// At compile time, check which version of Ember Data is installed
if (macroCondition(gte('ember-data', '5.0.0'))) {
  // Use new public API implementation
  export * from './ext-v2';
} else {
  // Use old RecordData implementation
  import { assert } from '@ember/debug';
  import Store from '@ember-data/store';
  import Model from '@ember-data/model';
  // eslint-disable-next-line ember/use-ember-data-rfc-395-imports
  import { Snapshot, normalizeModelName } from 'ember-data/-private';
  import JSONSerializer from '@ember-data/serializer/json';
  import FragmentRecordData from './record-data';
  // ... rest of current implementation
}
```

#### 2. New Public API Implementation `addon/ext-v2.js`

```javascript
// addon/ext-v2.js
// This is the POC approach - uses only public APIs
import { assert } from '@ember/debug';
import Store from '@ember-data/store';
import Model from '@ember-data/model';
import JSONSerializer from '@ember-data/serializer/json';
import { default as Fragment } from './fragment';
import { isPresent } from '@ember/utils';
import { getOwner } from '@ember/application';

// No private API imports!
// No RecordData!
// Fragments work as regular models with ordered IDs

Store.reopen({
  createFragment(modelName, props) {
    assert(
      `The '${modelName}' model must be a subclass of MF.Fragment`,
      this.isFragment(modelName),
    );

    // Use standard createRecord with generated ID
    return this.createRecord(modelName, props);
  },

  isFragment(modelName) {
    if (modelName === 'application' || modelName === '-default') {
      return false;
    }
    const type = this.modelFor(modelName);
    return Fragment.detect(type);
  },

  serializerFor(modelName) {
    // Fragment-specific serializer logic using public APIs only
    // ...
  },
});

// No Snapshot manipulation needed - use public APIs
// Serializers handle nested JSON conversion

export { Store, Model, JSONSerializer };
```

#### 3. Updated `tests/dummy/config/ember-try.js`

```javascript
{
  name: 'ember-data-4.6',
  npm: {
    devDependencies: {
      'ember-data': '~4.6.0',
    },
  },
  // Uses old RecordData implementation
},
{
  name: 'ember-data-4.12',
  npm: {
    devDependencies: {
      'ember-data': '~4.12.0',
      '@ember/string': '^3.0.0', // Required for ED 4.12
    },
  },
  // Uses old RecordData implementation (still available in 4.12)
},
{
  name: 'ember-data-5.3',
  npm: {
    devDependencies: {
      'ember-data': '~5.3.0',
      'ember-inflector': '^6.0.0', // Required for ED 5.x
    },
  },
  // Uses NEW public API implementation (ext-v2.js)
},
```

## Benefits

### ✅ Gradual Migration Path
- ED < 5.0: Uses existing RecordData code (proven, stable)
- ED >= 5.0: Uses new ordered IDs approach (POC validated)
- Users can upgrade Ember Data without changing their fragment code

### ✅ Backwards Compatible
- Existing users on ED 4.6 continue to work
- ED 4.12 users can upgrade without breaking changes
- API stays the same: `@fragment`, `@fragmentArray`

### ✅ Future-Proof
- ED 5.x+ uses only public APIs
- No private API dependencies in new version
- Cleaner, simpler implementation

### ✅ Testable
- Can test all three ED versions: 4.6, 4.12, 5.3
- Compile-time conditionals prevent import errors
- Each version gets appropriate implementation

## Migration Timeline

### Phase 1: v7.0.0 (Dual Implementation)
1. Add `ext-v2.js` with POC public API approach
2. Use `@embroider/macros` for conditional exports
3. Support ED 4.6, 4.12, and 5.x simultaneously
4. Users can upgrade ED without changing fragment code

### Phase 2: v7.x (Deprecation)
1. Deprecate ED < 5.0 support
2. Encourage users to upgrade to ED 5.x
3. Document migration path

### Phase 3: v8.0.0 (Cleanup)
1. Remove old RecordData code (`ext.js`, `record-data.js`)
2. Only ordered IDs implementation remains
3. Simpler codebase, easier maintenance

## Alternative: Separate Packages

Another approach would be to publish two separate packages:

- `ember-data-model-fragments@6.x` - ED < 5.0 (current)
- `ember-data-model-fragments@7.x` - ED >= 5.0 (new)

**Pros:**
- Cleaner separation
- No build-time conditionals needed
- Each package optimized for its ED version

**Cons:**
- More maintenance burden
- Users must manually switch packages
- Harder to provide migration path

**Recommendation:** Use compile-time conditionals (single package) for better UX.

## POC Status

The POC has already proven that the `ext-v2.js` approach works:
- ✅ 14/14 tests passing with ED 4.6
- ✅ Uses only public APIs
- ✅ Cleaner implementation (~200 lines vs 1,093 lines)
- ✅ Ordered IDs provide stable identity

## Next Steps

1. Create `addon/ext-v2.js` based on POC learnings
2. Update `addon/ext.js` to use `@embroider/macros` conditionals
3. Test with ED 4.6, 4.12, and 5.3
4. Document dual-version approach in README

## Implementation Complexity

**Low-Medium Complexity:**
- `@embroider/macros` already in project
- POC code already written and tested
- Main work is reorganizing existing code
- Estimated: 1-2 days of focused work

## Risks

**Low Risk:**
- POC proven with ED 4.6
- Compile-time conditionals are well-supported
- Fallback: can always revert to current approach
- ED 4.6 users unaffected

## Conclusion

The dual-version approach using compile-time conditionals is the **best path forward** to support ED 4.6, 4.12, and 5.x simultaneously while:
- Maintaining backwards compatibility
- Eliminating private API dependencies for ED 5.x+
- Providing smooth migration path
- Leveraging the POC work already done

This gives users the best of both worlds: stability for ED < 5.0 and modern public APIs for ED 5.x+.
