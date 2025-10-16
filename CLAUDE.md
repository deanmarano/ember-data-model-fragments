# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `ember-data-model-fragments`, an Ember Data addon that provides support for nested JSON documents through "fragments" - sub-models that behave like relationships but persist entirely through their parent record.

**Important compatibility note:** This addon uses private Ember Data APIs and is sensitive to minor Ember Data version changes. Currently supports Ember Data >= v3.28.x < v4.7.x. Not compatible with Ember Data v4.7.x+.

## Commands

### Development

- `pnpm install` - Install dependencies
- `pnpm start` - Start the dummy application (visits http://localhost:4200)

### Testing

- `pnpm test` - Run linting and all tests
- `pnpm test:ember` - Run tests on current Ember version
- `pnpm test:ember --server` - Run tests in watch mode
- `pnpm test:ember-compatibility` - Run tests against multiple Ember versions (uses ember-try scenarios)

### Linting

- `pnpm lint` - Run all linters (JS, CSS, HBS, formatting)
- `pnpm lint:fix` - Auto-fix all linting issues
- `pnpm lint:js` - ESLint only
- `pnpm lint:js:fix` - Auto-fix ESLint issues

### Building

- `pnpm build` - Production build

### Formatting

- `pnpm format` - Format code with Prettier

## Architecture

### Core Components

The addon architecture consists of several key layers:

1. **Fragment Class** (`addon/fragment.js`)

   - Extends Ember Data's Model but cannot be saved independently
   - Has no `save()` method - persistence managed through owner record
   - Dirty state propagates up to owner record
   - Supports copying via `copy()` method (creates new fragment without owner)

2. **FragmentRecordData** (`addon/record-data.js`)

   - Custom RecordData implementation extending Ember Data's RecordData
   - Manages three fragment state buckets:
     - `_fragmentData` - canonical/saved state
     - `_fragments` - current dirty state
     - `_inFlightFragments` - fragments being saved
   - Implements behavior classes for each fragment type:
     - `FragmentBehavior` - single fragment attribute
     - `FragmentArrayBehavior` - array of fragments
     - `ArrayBehavior` - array of primitives
   - Handles dirty tracking, rollback, commit, and state propagation

3. **Store Extensions** (`addon/ext.js`)

   - Extends DS.Store with `createFragment()` method
   - Extends DS.Store with `isFragment()` check
   - Overrides `serializerFor()` to use fragment-specific serializers
   - Custom `createRecordDataFor()` to instantiate FragmentRecordData
   - Extends JSONSerializer to handle fragment transforms
   - Extends Snapshot to snapshot fragment attributes

4. **Attribute Decorators** (`addon/attributes/`)

   - `@fragment(type, options)` - single fragment (like belongsTo)
   - `@fragmentArray(type, options)` - array of fragments (like hasMany)
   - `@array(type)` - array of primitives
   - `@fragmentOwner()` - reference to owner record
   - Options support: `defaultValue`, `polymorphic`, `typeKey`

5. **Fragment Arrays** (`addon/array/fragment.js`)
   - Proxy array that maintains owner/key relationship
   - Provides `createFragment()` method to add new fragments
   - Changes to fragments mark owner as dirty

### State Management

Fragment state flows through the owner record:

- Changes to fragments mark owner `hasDirtyAttributes: true`
- Saving owner saves all fragments atomically
- Rolling back owner rolls back all fragment changes
- Fragments have no independent persistence

### Conflict Resolution Strategy

**Critical limitation:** Fragment arrays merge by index position, NOT by identity (fragments have no IDs). When reloading, data swaps into existing fragment instances by array position. Reordering server data causes semantic changes to in-memory fragments. This can cause data loss if fragments are dirty during reload.

### Polymorphic Fragments

Fragments support polymorphic types using a `typeKey` field (default: 'type'):

- `typeKey` can be a string or function returning string
- Fragment class must be subclass of declared type
- Reading polymorphic fragments is fully supported
- Writing polymorphic fragments requires custom serializer with manual introspection

### TypeScript Support

TypeScript declarations included. Use `FragmentRegistry` interface to register fragment types for type safety:

```typescript
declare module "ember-data-model-fragments/types/registries/fragment" {
  export default interface FragmentRegistry {
    address: AddressFragment;
  }
}
```

## Testing Strategy

- Unit tests in `tests/unit/` - test individual fragment behaviors
- Integration tests in `tests/integration/` - test fragment integration with models/store
- Dummy app in `tests/dummy/` - provides example models for testing
- Ember-try scenarios test compatibility across Ember versions (LTS 5.8, 5.12, release, beta, canary, embroider)

## Generator

Use `ember generate fragment <name> [attrs]` to create fragments:

- Creates `app/models/<name>.js` extending Fragment
- Example: `ember generate fragment address street:string city:string`

## Package Manager

This project uses **pnpm** (not npm or yarn). Always use `pnpm` commands.

## Git Workflow

- Main branch: `master`
- Never commit directly to main (per user instructions)
- Uses release-plan for versioning/releases
