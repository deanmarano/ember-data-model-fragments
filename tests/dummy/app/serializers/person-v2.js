import JSONSerializer from '@ember-data/serializer/json';
import { generateFragmentId } from 'ember-data-model-fragments/utils/fragment-id';

/**
 * POC: Serializer that converts between nested JSON and fragment models
 *
 * This is the magic that makes fragments work:
 * - NORMALIZE: Server nested JSON → Client fragment models with IDs
 * - SERIALIZE: Client fragment models → Server nested JSON (no IDs)
 *
 * Works with ED 4.6 and 5.0+ (uses only public APIs)
 */
export default class PersonV2Serializer extends JSONSerializer {
  /**
   * Normalize server JSON into Ember Data format
   *
   * Converts nested address objects into separate models with generated IDs
   */
  normalize(typeClass, hash) {
    // Process addresses array if present
    if (hash.addresses && Array.isArray(hash.addresses)) {
      hash.addresses = hash.addresses.map((addressData, index) => {
        // Generate a stable ID for this fragment
        const id = generateFragmentId('person-v2', hash.id, 'addresses', index);

        return {
          id,
          type: 'address-v2',
          attributes: {
            street: addressData.street,
            city: addressData.city,
            state: addressData.state,
            zip: addressData.zip,
            // Fragment metadata
            __fragmentPosition: index,
            __fragmentParentType: 'person-v2',
            __fragmentParentId: hash.id,
            __fragmentKey: 'addresses'
          }
        };
      });
    }

    return super.normalize(typeClass, hash);
  }

  /**
   * Normalize the response from the server
   *
   * Ensures fragment models are pushed into the store alongside the parent
   */
  normalizeResponse(store, primaryModelClass, payload, id, requestType) {
    // Ensure ID is a string
    const recordId = String(payload.id || id);

    // First, push fragment records into the store
    if (payload.addresses && Array.isArray(payload.addresses)) {
      payload.addresses.forEach((addressData, index) => {
        const fragmentId = generateFragmentId('person-v2', recordId, 'addresses', index);

        // Push each fragment directly into the store
        store.push({
          data: {
            type: 'address-v2',
            id: fragmentId,
            attributes: {
              street: addressData.street,
              city: addressData.city,
              state: addressData.state,
              zip: addressData.zip,
              __fragmentPosition: index,
              __fragmentParentType: 'person-v2',
              __fragmentParentId: recordId,
              __fragmentKey: 'addresses'
            }
          }
        });
      });
    }

    // Create modified payload with address IDs for relationship
    const modifiedPayload = {
      ...payload,
      id: recordId
    };

    // Replace addresses array with IDs
    if (payload.addresses && Array.isArray(payload.addresses)) {
      modifiedPayload.addresses = payload.addresses.map((_, index) =>
        generateFragmentId('person-v2', recordId, 'addresses', index)
      );
    }

    // Call super with modified payload (addresses are now just IDs)
    return super.normalizeResponse(
      store,
      primaryModelClass,
      modifiedPayload,
      recordId,
      requestType
    );
  }

  /**
   * Serialize model into JSON for server
   *
   * Converts fragment models back into nested JSON objects
   */
  serialize(snapshot, options) {
    const json = super.serialize(snapshot, options);

    // Get addresses relationship
    const addresses = snapshot.hasMany('addresses');

    if (addresses && addresses.length > 0) {
      // Convert to array and sort by position
      const addressArray = addresses.map(snap => snap);

      // Sort by fragment position
      addressArray.sort((a, b) => {
        const posA = a.attr('__fragmentPosition') || 0;
        const posB = b.attr('__fragmentPosition') || 0;
        return posA - posB;
      });

      json.addresses = addressArray.map(addrSnapshot => {
        return {
          street: addrSnapshot.attr('street'),
          city: addrSnapshot.attr('city'),
          state: addrSnapshot.attr('state'),
          zip: addrSnapshot.attr('zip')
          // Note: We deliberately exclude fragment metadata (__fragment*)
          // and the ID - server never sees these
        };
      });
    }

    return json;
  }

  /**
   * Extract relationships from normalized data
   */
  extractRelationships(modelClass, resourceHash) {
    const relationships = super.extractRelationships(...arguments);

    // Addresses are handled in normalizeResponse
    // This ensures they're treated as a proper relationship

    return relationships;
  }
}
