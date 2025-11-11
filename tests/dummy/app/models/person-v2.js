import Model, { attr, hasMany } from '@ember-data/model';

/**
 * POC: Person model with fragment relationships
 *
 * This demonstrates how a parent model works with ordered fragment IDs:
 * - Uses standard hasMany relationships (no private APIs)
 * - Fragments are stored as separate models with IDs
 * - Dirty tracking propagates from fragments to parent
 */
export default class PersonV2Model extends Model {
  @attr('string') name;
  @attr('string') title;

  // Fragment relationships
  // These look like regular relationships but are serialized as nested JSON
  @hasMany('address-v2', { async: false, inverse: null }) addresses;

  /**
   * Override hasDirtyAttributes to include fragment relationships
   *
   * This ensures that changes to fragments mark the parent as dirty,
   * preserving the original fragment behavior.
   *
   * Note: Using volatile() to ensure this always recalculates when accessed,
   * as relationship dirty tracking can be tricky across Ember Data versions.
   */
  get hasDirtyAttributes() {
    // Check regular attributes
    if (super.hasDirtyAttributes) {
      return true;
    }

    // Check if any addresses (fragments) are dirty
    const addresses = this.addresses || [];
    return addresses.any(addr => addr.get('hasDirtyAttributes'));
  }

  /**
   * Get addresses sorted by position
   */
  get sortedAddresses() {
    const addresses = this.addresses || [];
    return addresses.sortBy('__fragmentPosition');
  }

  /**
   * Create a new address fragment
   *
   * This helper creates a new address with the correct fragment metadata
   */
  createAddress(properties = {}) {
    const position = this.addresses.length;
    const store = this.store;

    // Import at runtime to avoid circular deps
    const { generateFragmentId } = require('ember-data-model-fragments/utils/fragment-id');

    const id = generateFragmentId('person-v2', this.id, 'addresses', position);

    const address = store.createRecord('address-v2', {
      id,
      __fragmentPosition: position,
      __fragmentParentType: 'person-v2',
      __fragmentParentId: this.id,
      __fragmentKey: 'addresses',
      ...properties
    });

    this.addresses.pushObject(address);
    return address;
  }

  /**
   * Remove an address fragment
   *
   * Note: In the POC, we can't easily renumber IDs because Ember Data
   * doesn't allow changing IDs after creation. In a real implementation,
   * this would either:
   * 1. Keep sparse positions (just update __fragmentPosition)
   * 2. Use unloadRecord and recreate with new IDs
   * 3. Accept that IDs reflect original position, not current
   */
  removeAddress(address) {
    this.addresses.removeObject(address);

    // Mark for deletion
    address.deleteRecord();

    // Update positions (but keep original IDs)
    this.addresses.forEach((addr, index) => {
      addr.set('__fragmentPosition', index);
    });
  }
}
