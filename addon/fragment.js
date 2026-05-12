import { get, set, computed } from '@ember/object';
import Ember from 'ember';
import { isDestroying, isDestroyed } from '@ember/destroyable';
// DS.Model gets munged to add fragment support, which must be included first
import { Model } from './ext';
import { copy } from './util/copy';
import { recordIdentifierFor } from '@ember-data/store';

/**
  @module ember-data-model-fragments
*/

/**
 * Helper to get the FragmentRecordDataProxy for a fragment.
 * This provides backwards compatibility with existing code.
 */
export function fragmentRecordDataFor(fragment) {
  const identifier = recordIdentifierFor(fragment);
  return fragment.store.cache.createFragmentRecordData(identifier);
}

/**
  The class that all nested object structures, or 'fragments', descend from.
  Fragments are bound to a single 'owner' record (an instance of `DS.Model`)
  and cannot change owners once set. They behave like models, but they have
  no `save` method since their persistence is managed entirely through their
  owner. Because of this, a fragment's state directly influences its owner's
  state, e.g. when a record's fragment `hasDirtyAttributes`, its owner
  `hasDirtyAttributes`.

  Example:

  ```javascript
  import Model from '@ember-data/model';
  import MF from 'ember-data-model-fragments';

  class Person extends Model {
    @MF.fragment('name') name;
  }

  class Name extends MF.Fragment {
    @attr('string') first;
    @attr('string') last;
  }
  ```

  With JSON response:

  ```json
  {
    'id': '1',
    'name': {
      'first': 'Robert',
      'last': 'Jackson'
    }
  }
  ```

  ```javascript
  let person = store.getbyid('person', '1');
  let name = person.name;

  person.hasDirtyAttributes; // false
  name.hasDirtyAttributes; // false
  name.first; // 'Robert'

  name.first = 'The Animal';
  name.hasDirtyAttributes; // true
  person.hasDirtyAttributes; // true

  person.rollbackAttributes();
  name.first; // 'Robert'
  person.hasDirtyAttributes; // false
  ```

  @class Fragment
  @namespace MF
  @extends Model
  @uses Ember.Comparable
  @public
*/
// Note: We use Model.extend() with Ember.Comparable mixin for now
// as mixins are being phased out but still work in ember-data 4.12+
const Fragment = Model.extend(Ember.Comparable, {
  /**
    Compare two fragments by identity to allow `FragmentArray` to diff arrays.

    @method compare
    @param {Fragment} f1 - The first fragment to compare
    @param {Fragment} f2 - The second fragment to compare
    @return {Integer} The result of the comparison (0 if equal, 1 if not)
    @public
  */
  compare(f1, f2) {
    return f1 === f2 ? 0 : 1;
  },

  /**
    Create a new fragment that is a copy of the current fragment. Copied
    fragments do not have the same owner record set, so they may be added
    to other records safely.

    @method copy
    @return {Fragment} The newly created fragment
    @public
  */
  copy() {
    const type = this.constructor;
    const regularProps = Object.create(null);
    const fragmentProps = Object.create(null);
    const modelName = type.modelName || this._internalModel.modelName;

    // Look up model via store to avoid schema access deprecation in ember-data 4.12+
    const modelClass = this.store.modelFor(modelName);

    // Loop over each attribute and copy individually to ensure nested fragments
    // are also copied. Separate fragment attributes from regular ones because
    // clientDidCreate doesn't route fragment data through the fragment state manager.
    modelClass.eachAttribute((name, meta) => {
      const value = copy(get(this, name));
      if (meta.isFragment) {
        fragmentProps[name] = value;
      } else {
        regularProps[name] = value;
      }
    });

    const fragment = this.store.createFragment(modelName, regularProps);

    // Set fragment attributes via property setters, which properly route
    // through the fragment state manager (cache.setDirtyFragment)
    for (const [name, value] of Object.entries(fragmentProps)) {
      set(fragment, name, value);
    }

    return fragment;
  },

  /**
    @method toStringExtension
    @return {String}
    @public
  */
  toStringExtension() {
    if (isDestroying(this) || isDestroyed(this)) {
      return '';
    }
    const identifier = recordIdentifierFor(this);
    const owner = this.store.cache.getFragmentOwner(identifier);
    return owner ? `owner(${owner.ownerIdentifier?.id})` : '';
  },

  /**
    Override toString to include the toStringExtension output.
    ember-data 4.12+ doesn't call toStringExtension in Model.toString().

    @method toString
    @return {String}
    @public
  */
  toString() {
    if (isDestroying(this) || isDestroyed(this)) {
      return `<fragment(destroyed)>`;
    }
    const identifier = recordIdentifierFor(this);
    const extension = this.toStringExtension();
    const extensionStr = extension ? `:${extension}` : '';
    return `<${identifier.type}:${identifier.id}${extensionStr}>`;
  },
});

// Override static toString to avoid warp-drive 5.8's assert that checks
// this.modelName before allowing schema access. Ember's Namespace.create()
// calls toString() on all registered classes during initialization, before
// store.modelFor() has a chance to set modelName.
Fragment.reopenClass({
  toString() {
    return `model:${this.modelName || 'fragment'}`;
  },
});

// Add static property using native class syntax approach
// This replaces reopenClass which is deprecated
Object.defineProperty(Fragment, 'fragmentOwnerProperties', {
  get() {
    return computed(function () {
      const props = [];

      this.eachComputedProperty((name, meta) => {
        if (meta.isFragmentOwner) {
          props.push(name);
        }
      });

      return props;
    }).readOnly();
  },
  configurable: true,
});

/**
 * `getActualFragmentType` returns the actual type of a fragment based on its declared type
 * and whether it is configured to be polymorphic.
 *
 * @private
 * @param {String} declaredType the type as declared by `MF.fragment` or `MF.fragmentArray`
 * @param {Object} options the fragment options
 * @param {Object} data the fragment data
 * @return {String} the actual fragment type
 */
export function getActualFragmentType(declaredType, options, data, owner) {
  if (!options.polymorphic || !data) {
    return declaredType;
  }

  const typeKey = options.typeKey || 'type';
  const actualType =
    typeof typeKey === 'function' ? typeKey(data, owner) : data[typeKey];

  return actualType || declaredType;
}

// Sets the owner/key values on a fragment
export function setFragmentOwner(fragment, ownerRecordDataOrIdentifier, key) {
  const fragmentIdentifier = recordIdentifierFor(fragment);
  const ownerIdentifier =
    ownerRecordDataOrIdentifier.identifier || ownerRecordDataOrIdentifier;
  fragment.store.cache.setFragmentOwner(
    fragmentIdentifier,
    ownerIdentifier,
    key,
  );

  // Notify any observers of `fragmentOwner` properties
  // Look up model via store to avoid schema access deprecation in ember-data 4.12+
  const modelClass = fragment.store.modelFor(fragment.constructor.modelName);

  // Get the fragment owner properties array
  // In 4.13+, we need to iterate computed properties directly since static property access may not work
  const ownerProps = [];
  modelClass.eachComputedProperty((name, meta) => {
    if (meta.isFragmentOwner) {
      ownerProps.push(name);
    }
  });

  ownerProps.forEach((name) => {
    try {
      fragment.notifyPropertyChange(name);
    } catch (e) {
      // In warp-drive 5.8+, notifyPropertyChange during rendering can trigger
      // a "mutation-after-consumption" error if the property tag was consumed
      // in the same computation (e.g., fragment created in a component constructor).
      // This is safe to suppress: the fragment owner was just set for the first
      // time, and any future access in a new tracking context will recompute.
      if (!e?.message?.includes?.('You attempted to update')) {
        throw e;
      }
    }
  });

  return fragment;
}

// Determine whether an object is a fragment instance using a stamp to reduce
// the number of instanceof checks
export function isFragment(obj) {
  return obj instanceof Fragment;
}

// Override hasDirtyAttributes on Fragment prototype to directly query our cache.
// This ensures we always get fresh dirty state even for fragments in fragment
// arrays where ember-data's tracking might not invalidate properly.
// We use Object.defineProperty to override the inherited getter from Model.
Object.defineProperty(Fragment.prototype, 'hasDirtyAttributes', {
  get() {
    const identifier = recordIdentifierFor(this);
    return this.store.cache.hasChangedAttrs(identifier);
  },
  configurable: true,
});

export default Fragment;
