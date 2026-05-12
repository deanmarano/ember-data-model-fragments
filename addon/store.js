import { assert } from '@ember/debug';
import Store from 'ember-data/store';
import {
  macroCondition,
  dependencySatisfies,
  importSync,
} from '@embroider/macros';
import { dasherize } from '@ember/string';
import { getOwner } from '@ember/application';
import FragmentCache from './cache/fragment-cache';
import { default as Fragment } from './fragment';
import FragmentSerializer from './serializers/fragment';

// Import side-effects to ensure monkey-patches are applied
// These must be imported before any store instances are created
import './ext'; // Applies Snapshot monkey-patch for fragment serialization

/**
 * Patch the schema service's attributesDefinitionFor to include fragment
 * attributes. In warp-drive 5.8+, the schema service filters out non-attribute
 * kinds (fragment, fragment-array, array). This runtime patch adds them back.
 *
 * @private
 */
function _patchSchemaService(schemaService, store) {
  if (schemaService.__fragmentPatched) {
    return schemaService;
  }
  const _origAttrsFor =
    schemaService.attributesDefinitionFor.bind(schemaService);
  schemaService.attributesDefinitionFor = function (identifier) {
    // Guard against calls after store is destroyed (e.g., during unload)
    if (store.isDestroying || store.isDestroyed) {
      try {
        return _origAttrsFor(identifier);
      } catch {
        return {};
      }
    }
    const definitions = _origAttrsFor(identifier);
    // Check if fragment attributes are missing (5.8+ filters by kind)
    try {
      const modelClass = store.modelFor(identifier.type);
      if (modelClass) {
        modelClass.eachComputedProperty((name, meta) => {
          if (meta.isFragment && !(name in definitions)) {
            definitions[name] = Object.assign({ name }, meta);
          }
        });
      }
    } catch {
      // modelFor may fail for non-existent types or destroyed store
    }
    return definitions;
  };
  schemaService.__fragmentPatched = true;
  return schemaService;
}

/**
 * Look up a serializer for a fragment model, falling back through the
 * serializer:-fragment and serializer:-default registrations.
 *
 * @private
 */
function serializerForFragment(
  owner,
  normalizedModelName,
  originalSerializerFor,
) {
  let serializer = owner.lookup(`serializer:${normalizedModelName}`);

  if (serializer !== undefined) {
    return serializer;
  }

  // Standard ember-data fallback: use the original serializerFor to look up
  // 'application', ensuring we get the same instance as non-fragment lookups.
  if (originalSerializerFor) {
    try {
      serializer = originalSerializerFor('application');
      if (serializer !== undefined) {
        return serializer;
      }
    } catch {
      // originalSerializerFor may throw; fall through to manual lookups
    }
  }

  // Manual fallback: application serializer
  serializer = owner.lookup('serializer:application');
  if (serializer !== undefined) {
    return serializer;
  }

  // Fallback to fragment-specific serializer
  serializer = owner.lookup('serializer:-fragment');
  if (serializer !== undefined) {
    return serializer;
  }

  // Final fallback: use the -default serializer
  serializer = owner.lookup('serializer:-default');
  if (serializer !== undefined) {
    return serializer;
  }

  // In ember-data 5.8+, serializer:-default may not be registered.
  // Register FragmentSerializer (which handles -mf- transforms) as the
  // default fragment serializer.
  if (!owner.hasRegistration('serializer:-fragment')) {
    owner.register('serializer:-fragment', FragmentSerializer);
  }
  return owner.lookup('serializer:-fragment');
}

/**
 * Wrap serializerFor on a store instance if it's an own property (class field).
 * In warp-drive 5.8+, serializerFor is defined as a class field (arrow fn)
 * which shadows our prototype/extends method. We re-wrap it on the instance.
 *
 * @private
 */
function _maybeWrapSerializerFor(store) {
  if (store.__serializerForWrapped) {
    return;
  }
  const ownDesc = Object.getOwnPropertyDescriptor(store, 'serializerFor');
  // Only wrap if the own property exists and is NOT the same as the prototype
  // method. In warp-drive 5.8+, serializerFor is a class field (arrow fn) that
  // shadows the prototype method. In ember-data 4.13, serializerFor may also
  // appear as an own property but doesn't need wrapping since the built-in
  // fallback chain already works for fragments.
  const protoDesc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Object.getPrototypeOf(store)),
    'serializerFor',
  );
  if (
    ownDesc &&
    typeof ownDesc.value === 'function' &&
    (!protoDesc || ownDesc.value !== protoDesc.value)
  ) {
    const originalFn = ownDesc.value;
    store.serializerFor = function (...args) {
      const modelName = args[0];
      if (typeof modelName === 'string') {
        const normalizedModelName = dasherize(modelName);
        if (store.isFragment(normalizedModelName)) {
          return serializerForFragment(
            getOwner(store),
            normalizedModelName,
            originalFn,
          );
        }
      }
      return originalFn.apply(store, args);
    };
  }
  store.__serializerForWrapped = true;
}

/**
  FragmentStore is the base store class for ember-data-model-fragments.

  To use this addon, you must create an application store service that extends FragmentStore:

  ```js
  // app/services/store.js
  import FragmentStore from 'ember-data-model-fragments/store';

  export default class extends FragmentStore {}
  ```

  Your application serializer should also extend one of the fragment-aware serializers:

  ```js
  // app/serializers/application.js
  import FragmentSerializer from 'ember-data-model-fragments/serializer';

  export default class extends FragmentSerializer {}
  ```

  @class FragmentStore
  @extends Store
  @public
*/
export default class FragmentStore extends Store {
  constructor() {
    super(...arguments);
    // In warp-drive 5.8+, serializerFor is a class field (arrow fn) that
    // shadows class methods and doesn't properly fall back for fragments.
    // Wrap it immediately after construction.
    // In ember-data 4.13, serializerFor is also a class field but the
    // built-in fallback chain already works correctly for fragments.
    if (macroCondition(dependencySatisfies('ember-data', '>=5.0.0'))) {
      _maybeWrapSerializerFor(this);
    }
  }

  /**
   * Override createCache to return our FragmentCache
   * This is the V2 Cache hook introduced in ember-data 4.7+
   *
   * @method createCache
   * @param {Object} storeWrapper
   * @return {FragmentCache}
   * @public
   */
  createCache(storeWrapper) {
    return new FragmentCache(storeWrapper);
  }

  /**
   * Override the cache getter to ensure FragmentCache wrapping.
   * In warp-drive 5.8+, the parent Store class defines its own createCache()
   * that returns a JSONAPICache, which can shadow our override. This getter
   * intercepts at a higher level and wraps the cache if needed.
   *
   * Also triggers serializerFor wrapping on first access (after constructor).
   */
  get cache() {
    const cache = super.cache;
    if (cache && !(cache instanceof FragmentCache)) {
      const fragmentCache = new FragmentCache(
        this._instanceCache._storeWrapper,
        cache,
      );
      this._instanceCache.cache = fragmentCache;
      return fragmentCache;
    }
    return cache;
  }

  /**
   * Override the schema getter to patch the schema service for fragment support.
   * In warp-drive 5.8+, attributesDefinitionFor filters out non-attribute kinds.
   * This getter patches the schema service to include fragment attributes.
   */
  get schema() {
    const schema = super.schema;
    if (schema) {
      _patchSchemaService(schema, this);
    }
    return schema;
  }

  /**
   * Override createSchemaService to provide fragment-aware schema for ember-data 4.13.x
   *
   * In ember-data 4.13, ModelSchemaProvider exists and can be extended.
   * In warp-drive 5.8+, ModelSchemaProvider is removed, so we use runtime
   * patching via the schema getter instead.
   *
   * @method createSchemaService
   * @return {FragmentSchemaService|undefined}
   * @public
   */
  createSchemaService() {
    if (
      macroCondition(
        dependencySatisfies('ember-data', '>=4.13.0-alpha.0 <5.0.0'),
      )
    ) {
      const FragmentSchemaService = importSync('./schema-service').default;
      return new FragmentSchemaService(this);
    }
    // For ember-data 4.12 and 5.8+, schema patching happens via the schema getter
    return super.createSchemaService?.() ?? undefined;
  }

  /**
   * Override teardownRecord to handle fragments in a disconnected state.
   * In ember-data 4.12+, fragments can end up disconnected during unload,
   * and the default teardownRecord fails when trying to destroy them.
   *
   * @method teardownRecord
   * @param {Model} record
   * @public
   */
  teardownRecord(record) {
    // Check if record is a fragment (by checking if it has no id or by model type)
    // We need to handle the case where the fragment's store is disconnected
    if (record.isDestroyed || record.isDestroying) {
      return;
    }
    try {
      record.destroy();
    } catch (e) {
      // If the error is about disconnected state, just let it go
      // The fragment will be cleaned up by ember's garbage collection
      if (
        e?.message?.includes?.('disconnected state') ||
        e?.message?.includes?.('cannot utilize the store')
      ) {
        return;
      }
      throw e;
    }
  }

  /**
    Create a new fragment that does not yet have an owner record.
    The properties passed to this method are set on the newly created
    fragment.

    To create a new instance of the `name` fragment:

    ```js
    store.createFragment('name', {
      first: 'Alex',
      last: 'Routé'
    });
    ```

    @method createFragment
    @param {String} modelName - The type of fragment to create
    @param {Object} props - A hash of properties to set on the newly created fragment
    @return {Fragment} fragment
    @public
  */
  createFragment(modelName, props) {
    assert(
      `The '${modelName}' model must be a subclass of MF.Fragment`,
      this.isFragment(modelName),
    );
    // Create a new identifier for the fragment
    const identifier = this.identifierCache.createIdentifierForNewRecord({
      type: modelName,
    });
    // Signal to cache that this is a new record
    this.cache.clientDidCreate(identifier, props || {});
    // Get the record instance
    const record = this._instanceCache.getRecord(identifier, props);

    // In warp-drive 5.8+, getRecord no longer accepts createRecordArgs.
    // Set any arbitrary (non-attribute) props on the record after creation.
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (record[key] === undefined) {
          record.set(key, value);
        }
      }
    }

    return record;
  }

  /**
    Returns true if the modelName is a fragment, false if not

    @method isFragment
    @param {String} modelName - The modelName to check if a fragment
    @return {Boolean}
    @public
  */
  isFragment(modelName) {
    if (modelName === 'application' || modelName === '-default') {
      return false;
    }

    const type = this.modelFor(modelName);
    return Fragment.detect(type);
  }
}
