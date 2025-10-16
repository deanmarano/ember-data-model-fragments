import Model, { attr } from '@ember-data/model';

/**
 * POC: Address fragment using ordered IDs
 *
 * This is a fragment model that demonstrates the new approach:
 * - Has a real ID (generated from parent context)
 * - Stores position for ordering
 * - No RecordData dependency
 * - Works with ED 4.6 and 5.0+
 */
export default class AddressV2Model extends Model {
  // Regular fragment attributes
  @attr('string') street;
  @attr('string') city;
  @attr('string') state;
  @attr('string') zip;

  // Fragment metadata (internal, not serialized to server)
  @attr('number') __fragmentPosition;
  @attr('string') __fragmentParentType;
  @attr('string') __fragmentParentId;
  @attr('string') __fragmentKey;

  // Note: We don't use belongsTo for parent to avoid circular serialization
  // The parent relationship is maintained via metadata attributes

  /**
   * Get the composite key for sorting/comparison
   */
  get sortKey() {
    return this.__fragmentPosition ?? 0;
  }

  /**
   * Check if this model is a fragment
   */
  get isFragment() {
    return this.__fragmentParentType != null;
  }

  /**
   * Get parent identifier
   */
  get parentIdentifier() {
    if (!this.isFragment) return null;
    return {
      type: this.__fragmentParentType,
      id: this.__fragmentParentId,
      key: this.__fragmentKey
    };
  }
}
