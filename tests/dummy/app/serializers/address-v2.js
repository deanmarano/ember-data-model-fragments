import JSONSerializer from '@ember-data/serializer/json';

/**
 * POC: Address fragment serializer
 *
 * This serializer ensures fragment metadata is not sent to the server
 */
export default class AddressV2Serializer extends JSONSerializer {
  /**
   * Attributes to exclude when serializing
   */
  attrs = {
    __fragmentPosition: { serialize: false },
    __fragmentParentType: { serialize: false },
    __fragmentParentId: { serialize: false },
    __fragmentKey: { serialize: false }
  };

  /**
   * Serialize the address, excluding fragment metadata
   */
  serialize(snapshot, options) {
    const json = super.serialize(snapshot, options);

    // Remove any fragment metadata that might have slipped through
    delete json.__fragmentPosition;
    delete json.__fragmentParentType;
    delete json.__fragmentParentId;
    delete json.__fragmentKey;
    delete json.id; // Fragments don't have server-side IDs

    return json;
  }
}
