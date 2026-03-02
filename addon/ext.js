import Model from '@ember-data/model';
import { Snapshot } from '@ember-data/legacy-compat/-private';
/**
  @module ember-data-model-fragments
*/

/**
  Override `Snapshot._attributes` to snapshot fragment attributes before they are
  passed to the `DS.Model#serialize`.

  @private
*/
const oldSnapshotAttributes = Object.getOwnPropertyDescriptor(
  Snapshot.prototype,
  '_attributes',
);

// Symbol to store our converted attributes cache
const FRAGMENT_ATTRS = Symbol('fragmentAttrs');

Object.defineProperty(Snapshot.prototype, '_attributes', {
  get() {
    // Return cached converted attrs if available
    if (this[FRAGMENT_ATTRS]) {
      return this[FRAGMENT_ATTRS];
    }

    const cachedAttrs = oldSnapshotAttributes.get.call(this);

    // Create a new object to avoid modifying the cached __attributes in place
    // This is needed because ember-data caches __attributes and reuses it
    const attrs = Object.create(null);

    // In warp-drive 5.8+, eachAttribute only iterates kind === 'attribute',
    // so fragment attributes are missing. Add them from the cache.
    const cache = this._store.cache;
    if (cache && typeof cache.getFragment === 'function') {
      const schema = this._store.schema;
      if (schema) {
        const definitions = schema.attributesDefinitionFor(this.identifier);
        for (const [key, definition] of Object.entries(definitions)) {
          if (definition.isFragment && !(key in cachedAttrs)) {
            cachedAttrs[key] = cache.getAttr(this.identifier, key);
          }
        }
      }
    }

    Object.keys(cachedAttrs).forEach((key) => {
      const attr = cachedAttrs[key];

      // If the attribute has a `_createSnapshot` method, invoke it before the
      // snapshot gets passed to the serializer
      if (attr && typeof attr._createSnapshot === 'function') {
        attrs[key] = attr._createSnapshot();
      } else if (Array.isArray(attr)) {
        // Handle arrays of fragments (fragment arrays)
        attrs[key] = attr.map((item) => {
          if (item && typeof item._createSnapshot === 'function') {
            return item._createSnapshot();
          }
          return item;
        });
      } else {
        attrs[key] = attr;
      }
    });

    // Cache the converted attrs
    this[FRAGMENT_ATTRS] = attrs;

    return attrs;
  },
});

// Patch Model.attributes to include fragment-kind computed properties.
// In warp-drive 5.8+, isAttributeSchema checks `kind === 'attribute'` which
// excludes our fragment kinds.
const _originalAttributesDescriptor = Object.getOwnPropertyDescriptor(
  Model,
  'attributes',
);
if (_originalAttributesDescriptor && _originalAttributesDescriptor.get) {
  Object.defineProperty(Model, 'attributes', {
    get() {
      const map = _originalAttributesDescriptor.get.call(this);
      // Add any fragment attributes that were excluded
      this.eachComputedProperty((name, meta) => {
        if (meta.isFragment && !map.has(name)) {
          meta.key = name;
          meta.name = name;
          map.set(name, meta);
        }
      });
      return map;
    },
    configurable: true,
  });
}

export { Model };
