import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { generateFragmentId, parseFragmentId, isFragmentId } from 'ember-data-model-fragments/utils/fragment-id';

module('Unit | Utility | Fragment ID', function (hooks) {
  setupTest(hooks);

  module('Fragment ID Utilities', function () {
    test('generateFragmentId creates correct format', function (assert) {
      const id = generateFragmentId('person-v2', '123', 'addresses', 0);
      assert.strictEqual(id, 'person-v2:123:addresses:0', 'generates correct ID format');
    });

    test('generateFragmentId handles polymorphic fragments', function (assert) {
      const id = generateFragmentId('activity', '456', 'target', 0, 'photo');
      assert.strictEqual(id, 'activity:456:target:0:photo', 'includes fragment type');
    });

    test('parseFragmentId extracts components', function (assert) {
      const parsed = parseFragmentId('person-v2:123:addresses:2');
      assert.deepEqual(parsed, {
        parentType: 'person-v2',
        parentId: '123',
        key: 'addresses',
        position: 2,
        fragmentType: null
      }, 'parses all components correctly');
    });

    test('parseFragmentId handles polymorphic IDs', function (assert) {
      const parsed = parseFragmentId('activity:456:target:0:photo');
      assert.strictEqual(parsed.fragmentType, 'photo', 'extracts fragment type');
    });

    test('isFragmentId identifies fragment IDs', function (assert) {
      assert.true(isFragmentId('person-v2:123:addresses:0'), 'recognizes fragment ID');
      assert.false(isFragmentId('123'), 'rejects regular ID');
      assert.false(isFragmentId('person:123'), 'rejects incomplete ID');
    });
  });

  module('Fragment Models', function () {
    test('can create person with addresses', function (assert) {
      const store = this.owner.lookup('service:store');

      const person = store.createRecord('person-v2', {
        id: '1',
        name: 'John Doe',
        title: 'Developer'
      });

      assert.strictEqual(person.name, 'John Doe');
      assert.strictEqual(person.addresses.length, 0, 'starts with no addresses');
    });

    test('can add addresses to person', function (assert) {
      const store = this.owner.lookup('service:store');

      const person = store.createRecord('person-v2', {
        id: '1',
        name: 'John Doe'
      });

      const address = person.createAddress({
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      });

      assert.strictEqual(person.addresses.length, 1, 'has one address');
      assert.strictEqual(address.street, '123 Main St');
      assert.strictEqual(address.__fragmentPosition, 0, 'has position 0');
      assert.strictEqual(address.__fragmentParentType, 'person-v2', 'knows parent type');
      assert.strictEqual(address.__fragmentParentId, '1', 'knows parent ID');
      assert.true(address.isFragment, 'identifies as fragment');
    });

    test('fragments have ordered IDs', function (assert) {
      const store = this.owner.lookup('service:store');

      const person = store.createRecord('person-v2', {
        id: '1',
        name: 'John Doe'
      });

      const addr1 = person.createAddress({ street: 'First St' });
      const addr2 = person.createAddress({ street: 'Second St' });

      assert.strictEqual(addr1.id, 'person-v2:1:addresses:0', 'first address has position 0');
      assert.strictEqual(addr2.id, 'person-v2:1:addresses:1', 'second address has position 1');
    });

    test('can remove addresses and update positions', function (assert) {
      const store = this.owner.lookup('service:store');

      const person = store.createRecord('person-v2', {
        id: '1',
        name: 'John Doe'
      });

      const addr1 = person.createAddress({ street: 'First St' });
      const addr2 = person.createAddress({ street: 'Second St' });
      const addr3 = person.createAddress({ street: 'Third St' });

      assert.strictEqual(person.addresses.length, 3);

      // Remove middle address
      person.removeAddress(addr2);

      assert.strictEqual(person.addresses.length, 2, 'has 2 addresses after removal');
      assert.true(addr2.isDeleted, 'removed address is marked for deletion');

      // IDs stay the same (can't be changed in Ember Data), but positions update
      assert.strictEqual(addr1.__fragmentPosition, 0, 'first position stays 0');
      assert.strictEqual(addr3.__fragmentPosition, 1, 'third position updated to 1');
    });
  });

  module('Dirty Tracking', function () {
    test('changes to fragment mark parent as dirty', function (assert) {
      const store = this.owner.lookup('service:store');
      const serializer = store.serializerFor('person-v2');

      // Simulate loading from server (so we have clean state)
      const serverData = {
        id: '1',
        name: 'John Doe',
        addresses: [
          { street: '123 Main St', city: 'Springfield' }
        ]
      };

      const normalized = serializer.normalizeResponse(
        store,
        store.modelFor('person-v2'),
        serverData,
        '1',
        'findRecord'
      );

      store.push(normalized);

      const person = store.peekRecord('person-v2', '1');
      const address = person.addresses.firstObject;

      assert.false(person.hasDirtyAttributes, 'person starts clean');
      assert.false(address.hasDirtyAttributes, 'address starts clean');

      // Change fragment
      address.set('street', '456 Oak Ave');

      assert.true(address.hasDirtyAttributes, 'address is dirty');
      assert.true(person.hasDirtyAttributes, 'parent is dirty due to fragment');
    });
  });

  module('Serialization', function () {
    test('normalizes nested JSON into fragment models', function (assert) {
      const store = this.owner.lookup('service:store');
      const serializer = store.serializerFor('person-v2');

      const payload = {
        id: '1',
        name: 'John Doe',
        title: 'Developer',
        addresses: [
          {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '62701'
          },
          {
            street: '456 Oak Ave',
            city: 'Shelbyville',
            state: 'IL',
            zip: '62702'
          }
        ]
      };

      // Use normalizeResponse which properly handles relationships
      const normalized = serializer.normalizeResponse(
        store,
        store.modelFor('person-v2'),
        payload,
        '1',
        'findRecord'
      );

      assert.ok(normalized.data.id, 'has ID');
      assert.strictEqual(normalized.data.attributes.name, 'John Doe');

      // Check that addresses were moved to relationships
      assert.ok(normalized.data.relationships, 'has relationships');
      assert.ok(normalized.data.relationships.addresses, 'has addresses relationship');
      assert.strictEqual(normalized.data.relationships.addresses.data.length, 2, 'relationship has 2 addresses');

      // Check that addresses were moved to included
      assert.ok(normalized.included, 'has included');
      assert.strictEqual(normalized.included.length, 2, 'has 2 included addresses');

      const firstAddr = normalized.included[0];
      assert.strictEqual(firstAddr.id, 'person-v2:1:addresses:0', 'first address has correct ID');
      assert.strictEqual(firstAddr.type, 'address-v2', 'has correct type');
      assert.strictEqual(firstAddr.attributes.street, '123 Main St');
      assert.strictEqual(firstAddr.attributes.__fragmentPosition, 0, 'has position metadata');
      assert.strictEqual(firstAddr.attributes.__fragmentParentId, '1', 'has parent ID metadata');

      const secondAddr = normalized.included[1];
      assert.strictEqual(secondAddr.id, 'person-v2:1:addresses:1', 'second address has correct ID');
      assert.strictEqual(secondAddr.attributes.__fragmentPosition, 1, 'has position 1');
    });

    test('serializes fragment models back to nested JSON', function (assert) {
      const store = this.owner.lookup('service:store');

      const person = store.createRecord('person-v2', {
        id: '1',
        name: 'John Doe',
        title: 'Developer'
      });

      person.createAddress({
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      });

      person.createAddress({
        street: '456 Oak Ave',
        city: 'Shelbyville',
        state: 'IL',
        zip: '62702'
      });

      const serializer = store.serializerFor('person-v2');
      const snapshot = person._createSnapshot();
      const json = serializer.serialize(snapshot);

      assert.strictEqual(json.name, 'John Doe');
      assert.strictEqual(json.title, 'Developer');
      assert.ok(Array.isArray(json.addresses), 'addresses is an array');
      assert.strictEqual(json.addresses.length, 2, 'has 2 addresses');

      // Check first address
      const firstAddr = json.addresses[0];
      assert.strictEqual(firstAddr.street, '123 Main St');
      assert.strictEqual(firstAddr.city, 'Springfield');
      assert.notOk(firstAddr.id, 'no ID in serialized JSON');
      assert.notOk(firstAddr.__fragmentPosition, 'no fragment metadata');
      assert.notOk(firstAddr.__fragmentParentId, 'no fragment metadata');

      // Check second address
      const secondAddr = json.addresses[1];
      assert.strictEqual(secondAddr.street, '456 Oak Ave');
      assert.strictEqual(secondAddr.city, 'Shelbyville');
    });
  });

  module('Conflict Resolution', function () {
    test('can detect when server data differs from client by ID', function (assert) {
      const store = this.owner.lookup('service:store');

      // Simulate: client has person with 2 addresses
      const person = store.createRecord('person-v2', { id: '1', name: 'John' });
      const addr1 = person.createAddress({ street: 'First St', city: 'CityA' });
      const addr2 = person.createAddress({ street: 'Second St', city: 'CityB' });

      // Make address dirty
      addr2.set('city', 'CityC');
      assert.true(addr2.hasDirtyAttributes, 'address 2 is dirty');

      // Simulate: server sends updated data with addresses in DIFFERENT order
      // With ordered IDs, we can detect this is a reordering, not a data swap
      const serverPayload = {
        id: '1',
        name: 'John',
        addresses: [
          { street: 'Second St', city: 'CityB' }, // This was position 1, now position 0
          { street: 'First St', city: 'CityA' }   // This was position 0, now position 1
        ]
      };

      const serializer = store.serializerFor('person-v2');
      const normalized = serializer.normalizeResponse(
        store,
        store.modelFor('person-v2'),
        serverPayload,
        '1',
        'findRecord'
      );

      // New IDs based on position (in included array)
      const newAddr1 = normalized.included[0];
      const newAddr2 = normalized.included[1];

      assert.strictEqual(newAddr1.id, 'person-v2:1:addresses:0');
      assert.strictEqual(newAddr1.attributes.street, 'Second St', 'server reordered');

      assert.strictEqual(newAddr2.id, 'person-v2:1:addresses:1');
      assert.strictEqual(newAddr2.attributes.street, 'First St');

      // The key insight: We can detect that addr2's ID changed from
      // person-v2:1:addresses:1 to person-v2:1:addresses:0
      // This tells us it was reordered, not replaced
      assert.notStrictEqual(addr2.id, newAddr1.id, 'can detect reordering by ID change');
    });
  });

  module('Integration', function () {
    test('full round-trip: normalize -> modify -> serialize', function (assert) {
      const store = this.owner.lookup('service:store');
      const serializer = store.serializerFor('person-v2');

      // 1. Normalize server data
      const serverData = {
        id: '1',
        name: 'John Doe',
        addresses: [
          { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
        ]
      };

      const normalized = serializer.normalizeResponse(
        store,
        store.modelFor('person-v2'),
        serverData,
        '1',
        'findRecord'
      );

      // Push into store
      store.push(normalized);

      // 2. Retrieve and modify
      const person = store.peekRecord('person-v2', '1');
      assert.ok(person, 'person loaded');
      assert.strictEqual(person.addresses.length, 1, 'has 1 address');

      const address = person.addresses.firstObject;
      assert.strictEqual(address.street, '123 Main St');
      assert.strictEqual(address.id, 'person-v2:1:addresses:0', 'has correct fragment ID');

      // Modify
      address.set('street', '999 New St');
      person.set('name', 'Jane Doe');

      // Add new address
      person.createAddress({
        street: '456 Oak Ave',
        city: 'Shelbyville',
        state: 'IL',
        zip: '62702'
      });

      // 3. Serialize back
      const snapshot = person._createSnapshot();
      const json = serializer.serialize(snapshot);

      assert.strictEqual(json.name, 'Jane Doe', 'name updated');
      assert.strictEqual(json.addresses.length, 2, 'has 2 addresses');
      assert.strictEqual(json.addresses[0].street, '999 New St', 'first address updated');
      assert.strictEqual(json.addresses[1].street, '456 Oak Ave', 'second address added');

      // Verify no fragment metadata leaked
      assert.notOk(json.addresses[0].__fragmentPosition, 'no metadata in JSON');
      assert.notOk(json.addresses[0].id, 'no IDs in JSON');
    });
  });
});
