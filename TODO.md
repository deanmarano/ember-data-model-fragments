# TODO: Gradual Migration to Ordered IDs

Implementation plan broken down into manageable PRs for incremental delivery.

## Overview

Goal: Support both RecordData (old) and Ordered IDs (new) approaches side-by-side, allowing users to migrate incrementally.

**Target Timeline**: 12-18 months (multiple minor releases)

## Version Strategy

Following semantic versioning:

- **v6.1.0** (Week 12): Add ordered IDs support (new feature, opt-in)
- **v6.2.0** (Week 16): Add ED 4.12 testing (new feature)
- **v6.3.0** (Week 20): Add ED 5.x testing (new feature)
- **v6.x.x** (Months 6-12): Additional features, bug fixes, community feedback
- **v7.0.0** (Month 12-18): BREAKING - Remove old RecordData code, ED 4.12+ only

### Migration Timeline for Users

1. **Install v6.1.0+** - Add `orderedIds: true` to models incrementally
2. **Migrate gradually** - Take weeks/months, no rush
3. **Once fully migrated** - Set `excludeRecordData: true` in build config
4. **Upgrade to v7.0.0** - Only when ready for ED 4.12+

---

## PR #1: POC Cleanup and Documentation (Week 1)

**Goal**: Document the POC, clean up code, and establish foundation.

**Status**: 🟢 Ready to start

### Tasks
- [x] POC tests passing (14/14) ✅
- [ ] Move POC files to official locations
  - [ ] `addon/utils/fragment-id.js` (already exists)
  - [ ] `tests/unit/fragment-id-test.js` (rename from `poc-ordered-ids-test.js`)
  - [ ] Keep `person-v2` and `address-v2` models in tests/dummy for integration testing
- [ ] Add comprehensive JSDoc comments to POC code
- [ ] Create CHANGELOG entry for v6.1.0-beta.1
- [ ] Update README with "What's New: Ordered IDs (Opt-In)" section

### Success Criteria
- [ ] POC code properly documented
- [ ] Tests renamed to standard naming convention
- [ ] README updated with migration preview

### Files Changed
- `addon/utils/fragment-id.js` (documentation)
- `tests/unit/fragment-id-test.js` (renamed)
- `tests/unit/poc-ordered-ids-test.js` (deleted)
- `README.md` (updated)
- `CHANGELOG.md` (updated)

**Estimated Effort**: 1 day
**Risk**: Low

---

## PR #2: Serializer Infrastructure (Week 2)

**Goal**: Create base serializer and auto-registration system for ordered IDs.

**Status**: ⏳ Blocked by PR #1

### Tasks
- [ ] Create `addon/serializers/fragment-base.js`
  - [ ] Base class for fragment serializers
  - [ ] `normalizeResponse()` - converts nested JSON to fragments with IDs
  - [ ] `serialize()` - converts fragments back to nested JSON
  - [ ] Handles `__fragmentPosition`, `__fragmentParentId`, etc.
- [ ] Create serializer registry system
  - [ ] `addon/registry.js` - tracks which models use ordered IDs
  - [ ] `registerFragmentOwner(modelName, key, fragmentType, options)`
  - [ ] `getFragmentConfig(modelName)` - returns fragment metadata
- [ ] Create serializer factory
  - [ ] `addon/serializers/factory.js`
  - [ ] Auto-generates serializers based on registry
  - [ ] Handles polymorphic fragments
- [ ] Add tests for serializer infrastructure
  - [ ] `tests/unit/serializers/fragment-base-test.js`
  - [ ] `tests/unit/registry-test.js`
  - [ ] `tests/unit/serializers/factory-test.js`

### Success Criteria
- [ ] Serializers can normalize nested JSON to fragments with IDs
- [ ] Serializers can serialize fragments back to nested JSON (no IDs/metadata)
- [ ] Registry correctly tracks fragment relationships
- [ ] All serializer tests passing

### Files Created
- `addon/serializers/fragment-base.js`
- `addon/registry.js`
- `addon/serializers/factory.js`
- `tests/unit/serializers/fragment-base-test.js`
- `tests/unit/registry-test.js`
- `tests/unit/serializers/factory-test.js`

### Files Changed
- `tests/dummy/app/serializers/person-v2.js` (refactor to use base class)

**Estimated Effort**: 3-4 days
**Risk**: Medium (serializer logic is complex)

---

## PR #3: New Decorator Implementation (Week 3)

**Goal**: Create v2 decorators that use ordered IDs with public APIs only.

**Status**: ⏳ Blocked by PR #2

### Tasks
- [ ] Create `addon/attributes/fragment-v2.js`
  - [ ] `fragment(type, options)` decorator
  - [ ] Uses `@belongsTo` under the hood
  - [ ] Registers fragment config in registry
  - [ ] Generates fragment ID on create
  - [ ] Adds helper methods: `createFragment()`, `removeFragment()`
- [ ] Create `addon/attributes/fragment-array-v2.js`
  - [ ] `fragmentArray(type, options)` decorator
  - [ ] Uses `@hasMany` under the hood
  - [ ] Registers fragment array config in registry
  - [ ] Generates fragment IDs on create
  - [ ] Adds helper methods: `createFragment()`, `addFragment()`, `removeFragment()`
- [ ] Create `addon/attributes/array-v2.js`
  - [ ] `array(type)` decorator for primitive arrays
  - [ ] Uses standard `@attr` with array transform
- [ ] Create `addon/fragment-v2.js`
  - [ ] Base Fragment class for v2
  - [ ] Extends `Model` (not RecordData)
  - [ ] Adds `isFragment` property
  - [ ] Adds fragment metadata attributes
- [ ] Add dirty tracking support
  - [ ] Override `hasDirtyAttributes` on parent model
  - [ ] Propagate fragment dirty state to parent
- [ ] Add tests for v2 decorators
  - [ ] `tests/unit/attributes/fragment-v2-test.js`
  - [ ] `tests/unit/attributes/fragment-array-v2-test.js`
  - [ ] `tests/integration/v2/fragment-test.js`
  - [ ] `tests/integration/v2/fragment-array-test.js`
  - [ ] `tests/integration/v2/dirty-tracking-test.js`

### Success Criteria
- [ ] Can use `@fragment('type', { orderedIds: true })`
- [ ] Can use `@fragmentArray('type', { orderedIds: true })`
- [ ] Fragments have stable IDs: `parent:id:key:position`
- [ ] Dirty tracking propagates from fragments to parent
- [ ] All v2 decorator tests passing

### Files Created
- `addon/attributes/fragment-v2.js`
- `addon/attributes/fragment-array-v2.js`
- `addon/attributes/array-v2.js`
- `addon/fragment-v2.js`
- `tests/unit/attributes/fragment-v2-test.js`
- `tests/unit/attributes/fragment-array-v2-test.js`
- `tests/integration/v2/fragment-test.js`
- `tests/integration/v2/fragment-array-test.js`
- `tests/integration/v2/dirty-tracking-test.js`

**Estimated Effort**: 4-5 days
**Risk**: Medium (dirty tracking can be tricky)

---

## PR #4: Dispatcher and Options Handling (Week 4)

**Goal**: Update existing decorators to dispatch to v1 or v2 based on `orderedIds` option.

**Status**: ⏳ Blocked by PR #3

### Tasks
- [ ] Update `addon/attributes.js`
  - [ ] Import both v1 and v2 implementations
  - [ ] `fragment(type, options)` - dispatch based on `options.orderedIds`
  - [ ] `fragmentArray(type, options)` - dispatch based on `options.orderedIds`
  - [ ] `array(type, options)` - dispatch based on `options.orderedIds`
- [ ] Add optional deprecation warnings (disabled by default in v6.x)
  - [ ] Use `@ember/debug` deprecate()
  - [ ] Clear message pointing to migration guide
  - [ ] Set `until: '7.0.0'` (breaking change in v7)
  - [ ] Can be enabled via config for users who want to prepare
- [ ] Update `addon/index.js`
  - [ ] Export both Fragment (v1) and FragmentV2
  - [ ] Export both decorator sets
  - [ ] Maintain backwards compatibility
- [ ] Add integration tests
  - [ ] `tests/integration/mixed-fragments-test.js` - v1 and v2 in same app
  - [ ] `tests/integration/dispatch-test.js` - verify correct implementation used

### Success Criteria
- [ ] `@fragmentArray('type')` uses v1 (old RecordData) - no deprecation warning yet
- [ ] `@fragmentArray('type', { orderedIds: true })` uses v2 (ordered IDs)
- [ ] Both work in the same app simultaneously
- [ ] No breaking changes - fully backwards compatible
- [ ] All dispatch tests passing

### Files Changed
- `addon/attributes.js` (add dispatcher logic)
- `addon/index.js` (export both versions)

### Files Created
- `tests/integration/mixed-fragments-test.js`
- `tests/integration/dispatch-test.js`

**Estimated Effort**: 2-3 days
**Risk**: Low (straightforward dispatch logic)

---

## PR #5: Store Extensions for V2 (Week 5)

**Goal**: Extend Store to support v2 fragment operations.

**Status**: ⏳ Blocked by PR #3

### Tasks
- [ ] Create `addon/ext-v2.js`
  - [ ] `Store.createFragment()` - uses `createRecord()` with generated ID
  - [ ] `Store.isFragmentV2()` - checks if model uses ordered IDs
  - [ ] `Store.serializerFor()` - auto-generates fragment serializers
  - [ ] No RecordData, no private APIs
- [ ] Update Store initialization
  - [ ] Load both `ext.js` (v1) and `ext-v2.js` (v2)
  - [ ] Both implementations available simultaneously
- [ ] Add serializer auto-registration
  - [ ] When model loaded, check registry for fragment config
  - [ ] Auto-register generated serializer
  - [ ] Cache generated serializers
- [ ] Add tests for Store extensions
  - [ ] `tests/unit/store-v2-test.js`
  - [ ] `tests/integration/store-v2-test.js`

### Success Criteria
- [ ] `store.createFragment()` works for v2 fragments
- [ ] Serializers auto-registered for models with `orderedIds: true`
- [ ] No private API usage in v2 code
- [ ] All Store v2 tests passing

### Files Created
- `addon/ext-v2.js`
- `tests/unit/store-v2-test.js`
- `tests/integration/store-v2-test.js`

### Files Changed
- `addon/index.js` (load ext-v2.js)

**Estimated Effort**: 3-4 days
**Risk**: Medium (Store interaction can be complex)

---

## PR #6: Ember Data 4.12 Testing (Week 6)

**Goal**: Verify v2 implementation works with Ember Data 4.12.

**Status**: ⏳ Blocked by PR #5

### Tasks
- [ ] Add `@ember/string` as dependency
  - [ ] Update `package.json`
  - [ ] Add to `dependencies` (not devDependencies)
- [ ] Update `ember-try.js`
  - [ ] Ensure ED 4.12 scenario includes `@ember/string`
  - [ ] Add scenario for ED 4.12 with v2 only
- [ ] Run full test suite with ED 4.12
  - [ ] V1 tests should pass (RecordData still available in 4.12)
  - [ ] V2 tests should pass (public APIs only)
  - [ ] Mixed tests should pass
- [ ] Fix any ED 4.12 specific issues
- [ ] Document ED 4.12 compatibility

### Success Criteria
- [ ] All tests pass with ED 4.6
- [ ] All tests pass with ED 4.12
- [ ] V2 implementation proven compatible with ED 4.12
- [ ] CI runs tests against both ED 4.6 and 4.12

### Files Changed
- `package.json` (add @ember/string)
- `tests/dummy/config/ember-try.js` (update ED 4.12 scenario)
- `.github/workflows/ci.yml` (add ED 4.12 to matrix)

**Estimated Effort**: 2-3 days
**Risk**: Medium (may uncover unexpected ED 4.12 issues)

---

## PR #7: Ember Data 5.x Testing (Week 7)

**Goal**: Verify v2 implementation works with Ember Data 5.3.

**Status**: ⏳ Blocked by PR #5

### Tasks
- [ ] Add `ember-inflector` as dependency
  - [ ] Update `package.json`
  - [ ] Add to `dependencies`
- [ ] Update `ember-try.js`
  - [ ] Ensure ED 5.3 scenario includes `ember-inflector`
  - [ ] Add scenario for ED 5.3 with v2 only
- [ ] Note: V1 (RecordData) won't work with ED 5.x
  - [ ] V1 tests should be skipped for ED 5.x
  - [ ] Only V2 tests run
- [ ] Run V2 test suite with ED 5.3
  - [ ] V2 tests should pass (public APIs only)
- [ ] Fix any ED 5.x specific issues
- [ ] Document ED 5.x compatibility

### Success Criteria
- [ ] V2 tests pass with ED 5.3
- [ ] V1 tests gracefully skipped/disabled for ED 5.x
- [ ] CI runs V2 tests against ED 5.3
- [ ] Documentation updated with ED 5.x support

### Files Changed
- `package.json` (add ember-inflector)
- `tests/dummy/config/ember-try.js` (add ED 5.3 scenario)
- `.github/workflows/ci.yml` (add ED 5.3 to matrix)
- Test helpers (skip v1 tests for ED 5.x)

**Estimated Effort**: 2-3 days
**Risk**: Medium (ED 5.x is a major change)

---

## PR #8: Build Configuration for Code Exclusion (Week 8)

**Goal**: Allow users to exclude old RecordData code after full migration.

**Status**: ⏳ Blocked by PR #4

### Tasks
- [ ] Add build-time configuration option
  - [ ] `ember-cli-build.js` option: `excludeRecordData: true`
  - [ ] Use `@embroider/macros` for dead code elimination
- [ ] Update `addon/index.js`
  - [ ] Conditionally import `ext.js` based on config
  - [ ] Always import `ext-v2.js`
  - [ ] Use `macroCondition` and `getConfig`
- [ ] Update `addon/attributes.js`
  - [ ] Conditionally import v1 decorators
  - [ ] Throw error if v1 used when excluded
- [ ] Add tests for exclusion
  - [ ] Build test app with `excludeRecordData: true`
  - [ ] Verify v1 code not in bundle
  - [ ] Verify bundle size reduction
- [ ] Document exclusion configuration

### Success Criteria
- [ ] Users can set `excludeRecordData: true` in ember-cli-build
- [ ] Old RecordData code excluded from bundle when configured
- [ ] Bundle size reduction measurable (~100KB+)
- [ ] V2-only app works correctly
- [ ] Error thrown if trying to use v1 when excluded

### Files Changed
- `addon/index.js` (add macroCondition)
- `addon/attributes.js` (conditional imports)
- `index.js` (addon entry point - handle config)

### Files Created
- `tests/build/exclude-record-data-test.js`

**Estimated Effort**: 2-3 days
**Risk**: Medium (@embroider/macros can be tricky)

---

## PR #9: Migration Guide and Documentation (Week 9)

**Goal**: Complete, detailed documentation for users.

**Status**: ⏳ Blocked by PR #8

### Tasks
- [ ] Create `MIGRATION.md`
  - [ ] Complete migration guide with examples
  - [ ] Step-by-step instructions
  - [ ] Before/after code samples
  - [ ] Troubleshooting section
  - [ ] FAQ
- [ ] Update `README.md`
  - [ ] Document `orderedIds: true` option
  - [ ] Link to migration guide
  - [ ] Update compatibility matrix
  - [ ] Add "What's New in v7.0.0" section
- [ ] Create migration examples
  - [ ] `examples/migration/` directory
  - [ ] Before (v1) example
  - [ ] After (v2) example
  - [ ] Mixed (v1 + v2) example
- [ ] Update API documentation
  - [ ] Document all new decorators
  - [ ] Document fragment ID format
  - [ ] Document serializer behavior
  - [ ] Document build configuration
- [ ] Create upgrade checklist
  - [ ] `UPGRADE.md` with checklist
  - [ ] How to verify migration complete
  - [ ] How to test before upgrading ED

### Success Criteria
- [ ] Clear, comprehensive migration guide
- [ ] Examples for all scenarios
- [ ] API documentation complete
- [ ] Upgrade checklist available

### Files Created
- `MIGRATION.md`
- `UPGRADE.md`
- `examples/migration/before.js`
- `examples/migration/after.js`
- `examples/migration/mixed.js`

### Files Changed
- `README.md` (comprehensive update)
- `API.md` (update with v2 APIs)

**Estimated Effort**: 3-4 days
**Risk**: Low

---

## PR #10: Codemod for Automated Migration (Week 10)

**Goal**: Provide automated tool to help users migrate.

**Status**: ⏳ Blocked by PR #9

### Tasks
- [ ] Create codemod package
  - [ ] `codemods/add-ordered-ids/` directory
  - [ ] Use jscodeshift
  - [ ] Transform `@fragmentArray('type')` → `@fragmentArray('type', { orderedIds: true })`
  - [ ] Transform `@fragment('type')` → `@fragment('type', { orderedIds: true })`
  - [ ] Handle existing options (merge `orderedIds: true`)
- [ ] Add codemod tests
  - [ ] Input/output fixtures
  - [ ] Edge cases (already has options, etc.)
- [ ] Add codemod documentation
  - [ ] How to run
  - [ ] What it changes
  - [ ] Manual steps still needed
- [ ] Publish codemod to npm
  - [ ] `ember-data-model-fragments-codemod` package
  - [ ] Or include in main package

### Success Criteria
- [ ] Codemod can transform most common cases
- [ ] Clear documentation on usage
- [ ] Tests for codemod transformations
- [ ] Easy to run: `npx ember-data-model-fragments-codemod`

### Files Created
- `codemods/add-ordered-ids/transform.js`
- `codemods/add-ordered-ids/README.md`
- `codemods/add-ordered-ids/__tests__/`
- `codemods/add-ordered-ids/__testfixtures__/`

**Estimated Effort**: 3-4 days
**Risk**: Low (codemod is helpful but not critical)

---

## PR #11: Polymorphic Fragment Support (Week 11)

**Goal**: Ensure polymorphic fragments work with ordered IDs.

**Status**: ⏳ Blocked by PR #3

### Tasks
- [ ] Add polymorphic support to fragment ID utilities
  - [ ] Update `generateFragmentId()` to include type
  - [ ] Update `parseFragmentId()` to extract type
  - [ ] Format: `parent:id:key:position:fragmentType`
- [ ] Add polymorphic support to v2 decorators
  - [ ] `@fragment('base-type', { polymorphic: true, typeKey: 'type' })`
  - [ ] `@fragmentArray('base-type', { polymorphic: true, typeKey: 'type', orderedIds: true })`
- [ ] Add polymorphic support to serializers
  - [ ] Detect fragment type from typeKey
  - [ ] Include type in fragment ID
  - [ ] Create correct subclass
- [ ] Add polymorphic tests
  - [ ] `tests/integration/v2/polymorphic-test.js`
  - [ ] Test multiple fragment types
  - [ ] Test serialization/deserialization

### Success Criteria
- [ ] Polymorphic fragments work with ordered IDs
- [ ] Fragment IDs include type when polymorphic
- [ ] Serialization handles polymorphic types correctly
- [ ] All polymorphic tests passing

### Files Changed
- `addon/utils/fragment-id.js` (add polymorphic support)
- `addon/attributes/fragment-v2.js` (handle polymorphic)
- `addon/attributes/fragment-array-v2.js` (handle polymorphic)
- `addon/serializers/fragment-base.js` (polymorphic serialization)

### Files Created
- `tests/integration/v2/polymorphic-test.js`
- `tests/dummy/app/models/polymorphic-v2.js` (test fixtures)

**Estimated Effort**: 3-4 days
**Risk**: Medium (polymorphic logic is complex)

---

## PR #12: Performance Testing and Optimization (Week 12)

**Goal**: Ensure v2 performance is comparable or better than v1.

**Status**: ⏳ Blocked by PR #5

### Tasks
- [ ] Create performance benchmarks
  - [ ] `tests/performance/` directory
  - [ ] Benchmark fragment creation
  - [ ] Benchmark serialization/deserialization
  - [ ] Benchmark dirty tracking
  - [ ] Compare v1 vs v2
- [ ] Profile memory usage
  - [ ] Measure memory overhead of fragment IDs
  - [ ] Measure relationship tracking overhead
  - [ ] Compare v1 vs v2
- [ ] Optimize hot paths
  - [ ] Cache fragment IDs where possible
  - [ ] Optimize serializer performance
  - [ ] Optimize dirty tracking checks
- [ ] Document performance characteristics
  - [ ] Add performance section to README
  - [ ] Document any tradeoffs
  - [ ] Provide optimization tips

### Success Criteria
- [ ] V2 performance within 10% of v1 for common operations
- [ ] Memory overhead documented and acceptable
- [ ] Performance benchmarks in CI
- [ ] Performance documentation complete

### Files Created
- `tests/performance/fragment-creation-test.js`
- `tests/performance/serialization-test.js`
- `tests/performance/dirty-tracking-test.js`
- `docs/PERFORMANCE.md`

**Estimated Effort**: 3-4 days
**Risk**: Medium (may uncover performance issues requiring optimization)

---

## PR #13: Beta Release v6.1.0-beta.1 (Week 12)

**Goal**: Release v6.1.0-beta.1 for community testing (new feature: ordered IDs).

**Status**: ⏳ Blocked by PRs #1-5, #9-11

### Tasks
- [ ] Final review of core PRs (1-5, 9-11)
- [ ] Update CHANGELOG.md
  - [ ] Complete changelog for v6.1.0-beta.1
  - [ ] List new features:
    - [ ] Ordered IDs support (opt-in via `orderedIds: true`)
    - [ ] Auto-generated serializers
    - [ ] Fragment ID utilities
    - [ ] Polymorphic fragment support
  - [ ] Explicitly state: **NO BREAKING CHANGES**
  - [ ] Migration guide link
- [ ] Update package.json version
  - [ ] Set to `6.1.0-beta.1`
- [ ] Create GitHub release
  - [ ] Tag: `v6.1.0-beta.1`
  - [ ] Release notes emphasizing opt-in nature
  - [ ] Link to migration guide
- [ ] Publish to npm
  - [ ] `npm publish --tag beta`
- [ ] Announce beta release
  - [ ] Ember Discourse post
  - [ ] Discord announcement
  - [ ] Emphasize: "Try the new ordered IDs feature!"
  - [ ] Request community feedback

### Success Criteria
- [ ] All tests passing with ED 4.6
- [ ] V2 implementation complete and tested
- [ ] V1 still works exactly as before (no breaking changes)
- [ ] Documentation complete
- [ ] Beta published to npm
- [ ] Community aware and testing

### Files Changed
- `package.json` (version bump to 6.1.0-beta.1)
- `CHANGELOG.md` (beta release notes)

**Estimated Effort**: 1 day
**Risk**: Low

---

## Post-Beta: Community Feedback on v6.1.0 (Weeks 13-16)

**Goal**: Gather feedback on ordered IDs feature, fix issues, iterate.

### Tasks
- [ ] Monitor GitHub issues for beta feedback
- [ ] Fix any reported bugs
- [ ] Address any migration pain points
- [ ] Update documentation based on feedback
- [ ] Consider additional features requested
- [ ] Plan for v6.1.0 stable release

**Estimated Effort**: Ongoing
**Risk**: Varies based on feedback

---

## PR #14: Stable Release v6.1.0 (Week 16)

**Goal**: Release stable v6.1.0 after beta period (new feature: ordered IDs).

**Status**: ⏳ Blocked by beta feedback

### Tasks
- [ ] Address all beta feedback
- [ ] Final documentation review
- [ ] Update CHANGELOG for stable release
- [ ] Update package.json version to `6.1.0`
- [ ] Create GitHub release
  - [ ] Tag: `v6.1.0`
  - [ ] Release notes
- [ ] Publish to npm (stable)
  - [ ] `npm publish`
- [ ] Announce stable release
  - [ ] Ember Discourse
  - [ ] Discord
  - [ ] Blog post: "Introducing Ordered IDs for Fragments"

### Success Criteria
- [ ] No critical bugs from beta
- [ ] Community feedback incorporated
- [ ] Stable v6.1.0 published
- [ ] Users beginning to adopt ordered IDs
- [ ] **NO BREAKING CHANGES**

---

## PR #15: Add ED 4.12 Support - v6.2.0 (Week 20)

**Goal**: Test and document ED 4.12 compatibility (new feature).

**Status**: ⏳ Blocked by PR #6 (ED 4.12 testing)

### Tasks
- [ ] Ensure PR #6 is complete and merged
- [ ] Add `@ember/string` as dependency (if not already done)
- [ ] Update documentation
  - [ ] ED 4.12 listed as supported
  - [ ] Note: Requires `orderedIds: true` for ED 4.12 users
- [ ] Update CHANGELOG
  - [ ] v6.2.0: Add ED 4.12 support
  - [ ] **NO BREAKING CHANGES**
- [ ] Update package.json version to `6.2.0`
- [ ] Create GitHub release
- [ ] Publish to npm

### Success Criteria
- [ ] All tests pass with ED 4.6
- [ ] All V2 tests pass with ED 4.12
- [ ] V1 tests pass with ED 4.12 (RecordData still exists)
- [ ] Documentation updated
- [ ] v6.2.0 published

**Estimated Effort**: 1-2 days
**Risk**: Low

---

## PR #16: Add ED 5.x Support - v6.3.0 (Week 24)

**Goal**: Test and document ED 5.x compatibility (new feature).

**Status**: ⏳ Blocked by PR #7 (ED 5.x testing)

### Tasks
- [ ] Ensure PR #7 is complete and merged
- [ ] Add `ember-inflector` as dependency (if not already done)
- [ ] Update documentation
  - [ ] ED 5.x listed as supported
  - [ ] Note: REQUIRES `orderedIds: true` for ED 5.x (v1 won't work)
- [ ] Update CHANGELOG
  - [ ] v6.3.0: Add ED 5.x support
  - [ ] **NO BREAKING CHANGES** (v1 still works for ED < 5.0)
- [ ] Update package.json version to `6.3.0`
- [ ] Create GitHub release
- [ ] Publish to npm

### Success Criteria
- [ ] All tests pass with ED 4.6
- [ ] All V2 tests pass with ED 5.3
- [ ] V1 tests gracefully skipped for ED 5.x
- [ ] Documentation updated
- [ ] v6.3.0 published

**Estimated Effort**: 1-2 days
**Risk**: Low

---

## Community Adoption Period (Months 6-12)

**Goal**: Let community migrate at their own pace.

### Activities
- [ ] Monitor GitHub issues
- [ ] Release bug fix versions (v6.3.1, v6.3.2, etc.)
- [ ] Gather migration stories
- [ ] Track adoption metrics
- [ ] Build confidence in ordered IDs approach
- [ ] Collect feedback on when to release v7.0.0

### Success Metrics
- [ ] High percentage of users on v6.x
- [ ] Positive feedback on ordered IDs
- [ ] Many users have migrated models
- [ ] Community ready for v7.0.0 breaking change

---

## PR #17: Deprecation Warnings - v6.x.0 (Month 9-10)

**Goal**: Start showing deprecation warnings for v1 usage.

**Status**: ⏳ After significant adoption of v6.1+

### Tasks
- [ ] Enable deprecation warnings for v1 usage
  - [ ] Update `addon/attributes.js`
  - [ ] Show warning when `orderedIds` not specified
  - [ ] Message: "Not using orderedIds is deprecated and will be removed in v7.0.0"
  - [ ] Set `until: '7.0.0'`
- [ ] Update documentation
  - [ ] Announce deprecation timeline
  - [ ] Provide clear migration path
- [ ] Release as minor version (v6.x.0)

### Success Criteria
- [ ] Users see warnings in console when using v1
- [ ] Clear path to silence warnings (add `orderedIds: true`)
- [ ] No functionality changes
- [ ] Documentation clear

---

## PR #18: v7.0.0-beta.1 - RecordData Removal (Month 12-15)

**Goal**: Remove old RecordData code - BREAKING CHANGE.

**Status**: ⏳ After community adoption period

### Tasks
- [ ] Remove v1 implementation
  - [ ] Delete `addon/ext.js` (old RecordData code)
  - [ ] Delete `addon/record-data.js`
  - [ ] Delete `addon/attributes/fragment.js` (v1 decorators)
  - [ ] Delete `addon/attributes/fragment-array.js` (v1 decorators)
  - [ ] Delete all v1-specific code
- [ ] Remove v1 tests
  - [ ] Delete all v1 test files
  - [ ] Keep only v2 tests
- [ ] Update `addon/attributes.js`
  - [ ] Remove dispatcher logic
  - [ ] Only export v2 decorators
  - [ ] Remove `orderedIds` option (always true now)
- [ ] Update documentation
  - [ ] v7.0.0 BREAKING CHANGES section
  - [ ] Migration guide from v6.x to v7.0.0
  - [ ] Supported ED versions: 4.6, 4.12, 5.x
  - [ ] **Dropped support for ED < 4.6**
- [ ] Update CHANGELOG
  - [ ] v7.0.0-beta.1 BREAKING CHANGES
  - [ ] List removed features
  - [ ] Migration instructions
- [ ] Update package.json
  - [ ] Version: `7.0.0-beta.1`
  - [ ] Update peerDependencies: `ember-data >= 4.6.0`
- [ ] Create GitHub release
- [ ] Publish to npm with beta tag
- [ ] Announce beta
  - [ ] Discourse: "v7.0.0 beta - RecordData removed"
  - [ ] Request final feedback

### Success Criteria
- [ ] All old code removed
- [ ] Bundle size significantly reduced
- [ ] Only public APIs used
- [ ] Tests pass with ED 4.6, 4.12, 5.x
- [ ] Clear migration guide
- [ ] Community aware of breaking changes

**Estimated Effort**: 3-5 days
**Risk**: Low (well-prepared, long migration period)

---

## PR #19: Stable Release v7.0.0 (Month 15-18)

**Goal**: Release stable v7.0.0 - modern, RecordData-free version.

**Status**: ⏳ Blocked by v7.0.0-beta feedback

### Tasks
- [ ] Address beta feedback
- [ ] Final testing across ED versions
- [ ] Update CHANGELOG for stable release
- [ ] Update package.json version to `7.0.0`
- [ ] Create GitHub release
  - [ ] Tag: `v7.0.0`
  - [ ] Detailed release notes
  - [ ] Migration guide
  - [ ] Celebration of milestone!
- [ ] Publish to npm (stable)
- [ ] Announce stable release
  - [ ] Ember Discourse
  - [ ] Discord
  - [ ] Twitter
  - [ ] Blog post: "Fragments 7.0: Modern, Public APIs, ED 4.12+ Support"

### Success Criteria
- [ ] No critical bugs from beta
- [ ] Community successfully migrated
- [ ] Stable v7.0.0 published
- [ ] Supports ED 4.6, 4.12, 5.x
- [ ] Significantly smaller bundle
- [ ] Easier to maintain
- [ ] Future-proof architecture

---

## Summary

**Total Development PRs**: 19
**Estimated Timeline**: 15-18 months to v7.0.0 stable
**Risk Level**: Low (well-planned, incremental, long migration period)

### Version Release Timeline

| Version | Timing | Type | Description |
|---------|--------|------|-------------|
| v6.1.0-beta.1 | Week 12 | Minor | Ordered IDs (opt-in) |
| v6.1.0 | Week 16 | Minor | Ordered IDs stable |
| v6.2.0 | Week 20 | Minor | ED 4.12 support |
| v6.3.0 | Week 24 | Minor | ED 5.x support |
| v6.x.x | Months 6-12 | Patch | Bug fixes, community feedback |
| v6.x.0 | Month 9-10 | Minor | Deprecation warnings |
| v7.0.0-beta.1 | Month 12-15 | Major | Remove RecordData (BREAKING) |
| v7.0.0 | Month 15-18 | Major | Stable modern version |

### Key Milestones

1. **Week 4**: Core v2 implementation complete (PRs #1-4)
2. **Week 5**: Store extensions complete (PR #5)
3. **Week 6**: ED 4.12 testing (PR #6)
4. **Week 7**: ED 5.x testing (PR #7)
5. **Week 9**: Documentation complete (PR #9)
6. **Week 12**: v6.1.0-beta.1 - Ordered IDs feature (PR #13)
7. **Week 16**: v6.1.0 stable (PR #14)
8. **Week 20**: v6.2.0 - ED 4.12 support (PR #15)
9. **Week 24**: v6.3.0 - ED 5.x support (PR #16)
10. **Month 9-10**: Deprecation warnings (PR #17)
11. **Month 12-15**: v7.0.0-beta.1 - Remove RecordData (PR #18)
12. **Month 15-18**: v7.0.0 stable (PR #19)

### Success Metrics

#### For v6.1.0 (New Feature Release)
- [ ] ✅ 100% test coverage for v2
- [ ] ✅ ED 4.6 fully supported
- [ ] ✅ Zero breaking changes
- [ ] ✅ Opt-in via `orderedIds: true`
- [ ] ✅ Clear migration path documented
- [ ] ✅ V1 and V2 coexist peacefully

#### For v6.2.0 (ED 4.12 Support)
- [ ] ✅ ED 4.12 fully tested
- [ ] ✅ V2 works with ED 4.12
- [ ] ✅ V1 still works with ED 4.12 (RecordData available)
- [ ] ✅ Documentation updated

#### For v6.3.0 (ED 5.x Support)
- [ ] ✅ ED 5.3 fully tested
- [ ] ✅ V2 works with ED 5.x
- [ ] ✅ Documentation clear about V1/V2 requirements

#### For v7.0.0 (Breaking Release)
- [ ] ✅ Community has had 12+ months to migrate
- [ ] ✅ Old RecordData code removed
- [ ] ✅ Bundle size significantly reduced
- [ ] ✅ Only public APIs used
- [ ] ✅ ED 4.6, 4.12, 5.x all supported
- [ ] ✅ Smooth community transition

### Migration Path for Users

**Month 1-4 (v6.1.0 released):**
- Users install v6.1.0
- Begin migrating models with `orderedIds: true`
- No pressure, take your time

**Month 4-6 (v6.2.0, v6.3.0 released):**
- ED 4.12 and 5.x officially supported
- Users can upgrade ED when ready
- Still migrating models at their own pace

**Month 6-12 (Adoption period):**
- Most users have migrated some/all models
- Community shares migration experiences
- Bug fixes and improvements

**Month 9-10 (Deprecation warnings):**
- Warnings appear for V1 usage
- Clear timeline to v7.0.0
- Users know they have time

**Month 12-15 (v7.0.0-beta):**
- Beta release without RecordData
- Final testing period
- Community provides feedback

**Month 15-18 (v7.0.0 stable):**
- Stable release
- Modern, clean codebase
- Full ED 4.6/4.12/5.x support

### Benefits of This Approach

✅ **No Surprise Breaking Changes** - 12+ month warning period
✅ **Semantic Versioning** - Minor versions for new features
✅ **User Control** - Migrate at own pace
✅ **Long Support** - v6.x supported throughout migration
✅ **Clear Communication** - Version numbers signal intent
✅ **Low Risk** - Gradual, well-tested changes
