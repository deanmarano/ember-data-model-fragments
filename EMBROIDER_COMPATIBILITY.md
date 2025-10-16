# Embroider Compatibility Issues

## Current Status

The addon currently has **limited Embroider compatibility**. While tests show it works in embroider-safe and embroider-optimized modes with `@embroider/test-setup`, the addon uses patterns that prevent full Embroider compatibility and v2 addon migration.

## Identified Issues

### 1. Build-Time Code Generation (CRITICAL) 🔴

**Location:** `index.js:10-13`, `lib/version.js`, `lib/calculate-version.js`

**Problem:**

```javascript
// index.js
treeForAddon(tree) {
  const versioned = merge([version(), tree]);
  return this._super.treeForAddon.call(this, versioned);
}
```

This dynamically generates `addon/version.js` at build time containing:

```javascript
export default "6.0.10+abc1234567";
```

Which is then imported in `addon/index.js:3`:

```javascript
import VERSION from "./version";
```

**Why it breaks Embroider:**

- Embroider requires all imports to be statically analyzable
- `version.js` doesn't exist in source code, only generated at build time
- Embroider's static analysis fails because it can't resolve the import
- v2 addons cannot use `treeForAddon` hooks at all

**Impact:** Prevents v2 addon migration, may cause issues in strict Embroider builds

### 2. V1 Addon Format

**Current structure:**

```json
{
  "ember-addon": {
    "configPath": "tests/dummy/config"
  }
}
```

This is a classic v1 addon. V2 addons have a completely different structure:

- No build hooks allowed
- Different package.json format
- Uses Rollup for building
- Requires `@embroider/addon-dev`

### 3. Build Dependencies

**Current dependencies used for build-time features:**

- `broccoli-file-creator` - Creates version.js file
- `broccoli-merge-trees` - Merges version tree into addon
- `calculate-cache-key-for-tree` - Cache key calculation
- `git-repo-info` - Reads git info at build time
- `npm-git-info` - Reads npm git info at build time

These are typical v1 addon build tools that v2 addons don't use.

## Solutions

### Option 1: Remove Dynamic Version (Easiest) ✅

**Recommendation: START HERE**

Replace the dynamically generated version with a static import from `package.json`.

**Steps:**

1. Remove the build-time hooks from `index.js`:

```javascript
// index.js - BEFORE
module.exports = {
  name: require("./package").name,

  treeForAddon(tree) {
    const versioned = merge([version(), tree]);
    return this._super.treeForAddon.call(this, versioned);
  },

  cacheKeyForTree(treeType) {
    return calculateCacheKeyForTree(treeType, this);
  },
};

// index.js - AFTER
module.exports = {
  name: require("./package").name,
};
```

2. Create a static `addon/version.js`:

```javascript
// addon/version.js
import packageJson from "../package.json";
export default packageJson.version;
```

3. Update `addon/index.js` to not expose VERSION (or keep it if truly needed):

```javascript
// If VERSION export is unused, remove it entirely
// Otherwise it will just use the package.json version
```

4. Remove build dependencies from `package.json`:

```json
{
  "dependencies": {
    // REMOVE these:
    // "broccoli-file-creator": "^2.1.1",
    // "broccoli-merge-trees": "^3.0.0",
    // "calculate-cache-key-for-tree": "^1.1.0",
    // "git-repo-info": "^2.1.1",
    // "npm-git-info": "^1.0.3"
  }
}
```

5. Remove `lib/` directory (no longer needed)

**Trade-offs:**

- ✅ Embroider compatible
- ✅ Simple change
- ✅ Prepares for v2 migration
- ❌ Loses git SHA in version string (becomes just "6.0.10" instead of "6.0.10+abc1234567")

**Impact:** Minimal - the git SHA suffix is primarily useful for debugging pre-release versions from git installs, not production releases from npm.

### Option 2: Use @embroider/macros (Advanced)

Use compile-time macros to inject version at build time in an Embroider-compatible way.

```javascript
// addon/version.js
import { getOwnConfig } from "@embroider/macros";
export default getOwnConfig().version;
```

```javascript
// index.js
module.exports = {
  name: require("./package").name,
};
```

This requires apps to configure the macro, making it more complex.

### Option 3: Full V2 Migration (Future)

Migrate to v2 addon format using `@embroider/addon-dev`. This is a larger undertaking:

1. Restructure to v2 format
2. Use Rollup for building
3. Remove all build hooks
4. Update package.json structure
5. Add `@embroider/addon-shim` for backward compat

**When to do this:** When Ember Data compatibility issues are resolved and the addon has a clear future path.

## Recommended Action Plan

### Phase 1: Quick Fix (Embroider Compatibility) ⚡

**Do now:**

1. Implement Option 1 (remove dynamic version)
2. Test with existing embroider test scenarios
3. Release as patch/minor version

**Time estimate:** 1-2 hours
**Risk:** Very low
**Benefit:** Unblocks Embroider users

### Phase 2: V2 Migration (Future)

**Do later (when appropriate):**

1. Wait for Ember Data compatibility resolution
2. Assess if addon has long-term viability
3. If yes, migrate to v2 format
4. If no, deprecate in favor of alternatives

**Time estimate:** 1-2 days
**Risk:** Medium
**Benefit:** Full Embroider support, modern addon format

## Testing Embroider Compatibility

The addon already has embroider test scenarios in `tests/dummy/config/ember-try.js`:

```javascript
{
  name: 'embroider-safe',
  npm: { /* ... */ }
},
{
  name: 'embroider-optimized',
  npm: { /* ... */ }
}
```

After making changes, verify with:

```bash
# Test specific scenario
pnpm exec ember try:one embroider-safe
pnpm exec ember try:one embroider-optimized

# Or test all scenarios
pnpm run test:ember-compatibility
```

## Why Version Generation Exists

The dynamic version generation was likely added to:

1. **Track pre-release versions:** When installing from git, `6.0.10+abc1234567` shows the exact commit
2. **Debug issues:** Helps identify which version is running in development
3. **Historical reasons:** Common pattern in older Ember addons

However, for npm-published packages, the git SHA provides minimal value since:

- npm packages are built from tagged releases
- The version in package.json is the source of truth
- Users can check git history if needed

## Additional Resources

- [Embroider V2 Addon Format RFC](https://rfcs.emberjs.com/id/0507-embroider-v2-package-format/)
- [Porting Addons to V2](https://github.com/embroider-build/embroider/blob/main/docs/porting-addons-to-v2.md)
- [V2 Addon FAQ](https://embroider-build.github.io/embroider/docs/v2-faq.html)

## Related Issues

This embroider compatibility issue is separate from (but related to) the Ember Data 4.7+ compatibility issues documented in `EMBER_DATA_4.12_MIGRATION.md`. Both issues need to be addressed for the addon to work in modern Ember apps.

## Conclusion

**The embroider incompatibility is fixable** with a simple change (Option 1). This is unlike the Ember Data 4.7+ incompatibility which requires a fundamental rewrite.

**Recommended next steps:**

1. Implement Option 1 (remove dynamic version generation)
2. Test with embroider scenarios
3. Release update
4. Defer v2 migration until Ember Data compatibility is resolved
