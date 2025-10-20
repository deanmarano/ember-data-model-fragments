# Gradual Migration Strategy: Opt-In Ordered IDs

## Goal

Allow users to migrate to ordered IDs **incrementally** while keeping their app working:

1. Install updated package (v7.0.0)
2. Migrate models **one at a time** to ordered IDs
3. Old models continue using RecordData (no breaking changes)
4. Once all models migrated, remove old RecordData code
5. Then upgrade to Ember Data 4.12+ or 5.x

## User Experience

### Phase 1: Installation (No Breaking Changes)

```bash
npm install ember-data-model-fragments@7.0.0
```

All existing fragment models continue to work exactly as before. No code changes required.

### Phase 2: Gradual Migration (Opt-In Per Model)

Users migrate models one at a time using a new `orderedIds` option:

#### Before (Old RecordData Approach):
```javascript
// app/models/person.js
import Model, { attr } from '@ember-data/model';
import { fragmentArray } from 'ember-data-model-fragments/attributes';

export default class PersonModel extends Model {
  @attr('string') name;

  // Uses old RecordData - no IDs, no individual fragment identity
  @fragmentArray('address') addresses;
}
```

#### After (New Ordered IDs Approach):
```javascript
// app/models/person.js
import Model, { attr } from '@ember-data/model';
import { fragmentArray } from 'ember-data-model-fragments/attributes';

export default class PersonModel extends Model {
  @attr('string') name;

  // Opt-in to ordered IDs - fragments get stable IDs
  @fragmentArray('address', { orderedIds: true }) addresses;
}
```

#### Fragment Model (No Changes Needed):
```javascript
// app/models/address.js
import Fragment, { attr } from 'ember-data-model-fragments';

export default class AddressFragment extends Fragment {
  @attr('string') street;
  @attr('string') city;
  @attr('string') state;
  @attr('string') zip;
}
```

**Key Point**: The fragment model itself doesn't change! The `orderedIds: true` option tells the parent model to use the new ordered IDs implementation.

### Phase 3: Incremental Progress

Users can mix and match in the same app:

```javascript
// Old approach (still works)
@fragmentArray('legacy-fragment') oldFragments;

// New approach (opted in)
@fragmentArray('new-fragment', { orderedIds: true }) newFragments;
```

The app works fine with both approaches simultaneously.

### Phase 4: Complete Migration

Once all models are migrated:

```javascript
// All models now use orderedIds: true
@fragmentArray('address', { orderedIds: true }) addresses;
@fragmentArray('phone', { orderedIds: true }) phones;
@fragment('name', { orderedIds: true }) name;
```

### Phase 5: Remove Old Code

User adds to their `ember-cli-build.js`:

```javascript
// ember-cli-build.js
const app = new EmberApp(defaults, {
  'ember-data-model-fragments': {
    excludeRecordData: true,  // Remove old RecordData code from bundle
  },
});
```

This triggers a build-time removal of the old RecordData implementation, reducing bundle size.

### Phase 6: Upgrade Ember Data

Now the user can safely upgrade to ED 4.12 or 5.x:

```bash
npm install ember-data@~4.12.0
# or
npm install ember-data@~5.3.0
```

Their app continues to work because all fragments use the new ordered IDs approach.

## Implementation Architecture

### Two Parallel Implementations

```
addon/
  ├── attributes.js (exports both decorators)
  │   ├── fragment() - dispatches to old or new based on options
  │   ├── fragmentArray() - dispatches to old or new based on options
  │   └── array() - dispatches to old or new based on options
  │
  ├── ext.js (OLD: RecordData-based)
  │   ├── Store.createRecordDataFor() - custom RecordData
  │   ├── FragmentRecordData - handles fragment state
  │   └── Snapshot manipulation
  │
  ├── ext-v2.js (NEW: Ordered IDs - public APIs only)
  │   ├── Store.createFragment() - uses createRecord()
  │   ├── No RecordData needed
  │   └── No Snapshot manipulation
  │
  ├── transforms/
  │   ├── fragment.js (OLD transform)
  │   └── fragment-v2.js (NEW transform - uses relationships)
  │
  └── serializers/
      └── fragment-v2.js (auto-generated serializer for ordered IDs)
```

### Decorator Implementation

```javascript
// addon/attributes.js
import { fragmentArray as fragmentArrayOld } from './attributes/fragment-array';
import { fragmentArray as fragmentArrayV2 } from './attributes/fragment-array-v2';

export function fragmentArray(type, options = {}) {
  if (options.orderedIds === true) {
    // Use new ordered IDs implementation
    return fragmentArrayV2(type, options);
  } else {
    // Use old RecordData implementation
    return fragmentArrayOld(type, options);
  }
}
```

### New Ordered IDs Decorator

```javascript
// addon/attributes/fragment-array-v2.js
import { hasMany } from '@ember-data/model';
import { registerFragmentArray } from '../registry';

export function fragmentArray(type, options = {}) {
  // Register fragment metadata for serializer generation
  registerFragmentArray(type, options);

  // Use standard hasMany relationship
  return hasMany(type, {
    async: false,
    inverse: null,
    ...options,
  });
}
```

### Automatic Serializer Generation

When a model uses `orderedIds: true`, the addon automatically generates a serializer:

```javascript
// Automatically registered serializer for person model
export default class PersonSerializer extends JSONSerializer {
  normalize(typeClass, hash) {
    // Convert nested addresses to fragment models with IDs
    if (hash.addresses && Array.isArray(hash.addresses)) {
      hash.addresses = hash.addresses.map((data, index) => {
        const id = generateFragmentId('person', hash.id, 'addresses', index);
        return {
          id,
          type: 'address',
          attributes: {
            ...data,
            __fragmentPosition: index,
            __fragmentParentType: 'person',
            __fragmentParentId: hash.id,
            __fragmentKey: 'addresses',
          },
        };
      });
    }
    return super.normalize(typeClass, hash);
  }

  serialize(snapshot, options) {
    // Convert fragment models back to nested JSON (strip IDs)
    const json = super.serialize(snapshot, options);
    const addresses = snapshot.hasMany('addresses');
    if (addresses && addresses.length > 0) {
      json.addresses = addresses
        .sortBy('__fragmentPosition')
        .map(addr => ({
          street: addr.attr('street'),
          city: addr.attr('city'),
          // No IDs, no metadata
        }));
    }
    return json;
  }
}
```

This serializer is auto-registered when the model is loaded.

## Build Configuration

### Including Both Implementations (Default)

```javascript
// ember-cli-build.js
const app = new EmberApp(defaults, {
  // Both implementations included by default
  // Users can use old or new approach
});
```

### Excluding Old RecordData (After Full Migration)

```javascript
// ember-cli-build.js
const app = new EmberApp(defaults, {
  'ember-data-model-fragments': {
    excludeRecordData: true,  // Remove old code from bundle
  },
});
```

This uses `@embroider/macros` to dead-code eliminate the old RecordData implementation:

```javascript
// addon/index.js
import { macroCondition, getConfig } from '@embroider/macros';

let ext;
if (macroCondition(getConfig('ember-data-model-fragments').excludeRecordData !== true)) {
  ext = require('./ext');  // Include old RecordData code
}

// Always include new implementation
import * as extV2 from './ext-v2';

export { ext, extV2 };
```

## Migration Guide

### Step 1: Install Updated Package

```bash
npm install ember-data-model-fragments@7.0.0
```

**No code changes needed yet.** All existing fragments continue to work.

### Step 2: Choose a Model to Migrate

Pick a simple model with fragments to migrate first (e.g., `person` with `addresses`).

### Step 3: Add `orderedIds: true`

```diff
  export default class PersonModel extends Model {
    @attr('string') name;
-   @fragmentArray('address') addresses;
+   @fragmentArray('address', { orderedIds: true }) addresses;
  }
```

### Step 4: Test Thoroughly

- Load records from server
- Modify fragments
- Save records back to server
- Ensure nested JSON format unchanged

### Step 5: Repeat for Other Models

Migrate models one at a time, testing each before moving to the next.

### Step 6: Verify All Models Migrated

Search codebase for fragment decorators without `orderedIds`:

```bash
# Find any fragments still using old approach
grep -r "@fragmentArray\|@fragment" app/models | grep -v "orderedIds: true"
```

### Step 7: Remove Old Code

Once all models use `orderedIds: true`, exclude old RecordData:

```javascript
// ember-cli-build.js
'ember-data-model-fragments': {
  excludeRecordData: true,
}
```

Verify bundle size reduction:

```bash
npm run build -- --environment=production
# Check dist/assets/*.js file sizes
```

### Step 8: Upgrade Ember Data

Now safe to upgrade to ED 4.12+ or 5.x:

```bash
npm install ember-data@~4.12.0
npm install @ember/string@^3.0.0  # Required for ED 4.12
```

Or:

```bash
npm install ember-data@~5.3.0
npm install ember-inflector@^6.0.0  # Required for ED 5.x
```

Run full test suite to verify everything works.

## Deprecation Warnings

The addon can emit deprecation warnings to encourage migration:

```javascript
// When using old approach
if (!options.orderedIds) {
  deprecate(
    'Using fragments without `orderedIds: true` is deprecated. ' +
    'Please migrate to ordered IDs for Ember Data 4.12+ compatibility. ' +
    'See migration guide: https://github.com/adopted-ember-addons/ember-data-model-fragments#migration',
    false,
    {
      id: 'ember-data-model-fragments.ordered-ids',
      until: '8.0.0',
      for: 'ember-data-model-fragments',
      since: {
        available: '7.0.0',
        enabled: '7.0.0',
      },
    }
  );
}
```

Users see warnings in console but app continues to work.

## Version Timeline

### v7.0.0 - Dual Implementation (Q1 2025)
- ✅ Both old (RecordData) and new (ordered IDs) available
- ✅ Opt-in via `orderedIds: true` option
- ✅ Supports ED 3.28 - 4.6
- ⚠️ Deprecation warnings for old approach
- 📚 Migration guide published

### v7.x - Deprecation Period (Q2-Q3 2025)
- ⚠️ Louder deprecation warnings
- 📚 Codemods to automate migration
- 🔧 Tooling to detect unmigrated models
- 💬 Community support for migration

### v8.0.0 - Ordered IDs Only (Q4 2025)
- ❌ Remove old RecordData code entirely
- ✅ Only ordered IDs approach
- ✅ Support ED 4.6, 4.12, 5.x
- ✅ Significantly smaller bundle
- ✅ Easier maintenance

## Benefits of This Approach

### ✅ Zero-Risk Migration
- Users install v7.0.0 with **no breaking changes**
- App continues working exactly as before
- Migration is **completely optional** until ready

### ✅ Incremental Progress
- Migrate one model at a time
- Test each model thoroughly before next
- Team can work on different models in parallel
- No "big bang" migration

### ✅ Flexibility
- Users control migration pace
- Can pause migration if issues arise
- Can keep some models on old approach indefinitely
- Can even mix old/new in same app

### ✅ Clear Upgrade Path
- Structured process: Install → Migrate → Remove → Upgrade
- Each step is safe and reversible
- Clear indicators of progress
- Deprecation warnings guide users

### ✅ Future-Proof
- ED 4.12 and 5.x support built-in
- Public APIs only in new approach
- Smaller bundle after migration complete
- Easier to maintain long-term

## Comparison to Other Approaches

### ❌ Big Bang Migration (v7.0.0 breaks everything)
- All fragments break immediately
- Users must migrate entire app before deploying
- High risk, high stress
- Blocks ED upgrades

### ❌ Separate Packages
- `ember-data-model-fragments` (old)
- `ember-data-model-fragments-v2` (new)
- Users install both during migration
- Confusing, higher maintenance burden
- Harder to remove old package

### ✅ Opt-In Gradual Migration (Recommended)
- Same package, both implementations
- Users control migration pace
- Low risk, smooth transition
- Clear path to ED 4.12/5.x

## Implementation Effort

### Addon Development
- **Create `ext-v2.js`**: POC already done (2-3 days to productionize)
- **Dispatcher in `attributes.js`**: 1 day
- **Automatic serializer generation**: 2-3 days
- **Build config for exclusion**: 1 day
- **Tests for both approaches**: 2-3 days
- **Documentation & migration guide**: 2-3 days

**Total: 2-3 weeks** of focused development

### User Migration
- **Per model**: 15-30 minutes (add option, test)
- **Typical app with 10 fragment models**: 3-5 hours
- **Large app with 50+ fragment models**: 1-2 days
- **Can be spread over weeks/months**

## Success Metrics

### For Addon Maintainers
- ✅ Both implementations coexist peacefully
- ✅ Tests pass for ED 4.6, 4.12, 5.x
- ✅ Bundle size reduction when old code excluded
- ✅ No breaking changes in v7.0.0

### For Users
- ✅ App works immediately after installing v7.0.0
- ✅ Can migrate incrementally at own pace
- ✅ Clear deprecation warnings guide migration
- ✅ Can upgrade to ED 4.12/5.x after migration

## Conclusion

The **opt-in gradual migration strategy** gives users the best experience:

1. **Safe**: No breaking changes, app continues working
2. **Flexible**: Migrate at own pace, one model at a time
3. **Clear**: Well-defined steps with deprecation warnings
4. **Future-proof**: Path to ED 4.12/5.x built-in

This approach respects users' time and reduces migration risk while still achieving the goal of eliminating private API dependencies and supporting modern Ember Data versions.
