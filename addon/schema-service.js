import {
  macroCondition,
  dependencySatisfies,
  importSync,
} from '@embroider/macros';

/**
 * FragmentSchemaService extends ModelSchemaProvider to add support for fragment attributes.
 *
 * In ember-data 4.13+, the schema service only recognizes attributes with `kind: 'attribute'`.
 * Fragment attributes use `kind: 'fragment'`, `kind: 'fragment-array'`, or `kind: 'array'`,
 * so they need to be transformed to be included in the schema.
 *
 * NOTE: This class only exists in ember-data 4.13.x. For 4.12, this module exports null.
 * For warp-drive 5.8+, ModelSchemaProvider no longer exists, so runtime patching is used
 * instead (see ext.js _patchSchemaService).
 *
 * @class FragmentSchemaService
 * @extends ModelSchemaProvider
 * @public
 */
let FragmentSchemaService = null;

if (
  macroCondition(
    dependencySatisfies('ember-data', '>=4.13.0-alpha.0 <5.0.0'),
  )
) {
  const { ModelSchemaProvider } = importSync('@ember-data/model');

  FragmentSchemaService = class FragmentSchemaService extends (
    ModelSchemaProvider
  ) {
    /**
     * Override _loadModelSchema to include fragment attributes in the schema.
     *
     * @method _loadModelSchema
     * @param {String} type - The model type name
     * @return {Object} internalSchema
     * @private
     */
    _loadModelSchema(type) {
      const internalSchema = super._loadModelSchema(type);
      const modelClass = this.store.modelFor(type);

      modelClass.eachComputedProperty((name, meta) => {
        if (this._isFragmentAttribute(meta)) {
          const transformedMeta = {
            name,
            key: name,
            kind: 'attribute',
            type: meta.type,
            options: {
              ...meta.options,
              isFragment: true,
              fragmentKind: meta.kind,
              modelName: meta.modelName,
            },
            isAttribute: true,
            isFragment: true,
            modelName: meta.modelName,
          };

          internalSchema.attributes[name] = transformedMeta;
          internalSchema.fields.set(name, transformedMeta);
        }
      });

      internalSchema.schema.fields = Array.from(internalSchema.fields.values());

      return internalSchema;
    }

    /**
     * @method _isFragmentAttribute
     * @param {Object} meta
     * @return {Boolean}
     * @private
     */
    _isFragmentAttribute(meta) {
      return (
        typeof meta === 'object' &&
        meta !== null &&
        'kind' in meta &&
        meta.isFragment === true &&
        (meta.kind === 'fragment' ||
          meta.kind === 'fragment-array' ||
          meta.kind === 'array')
      );
    }
  };
}

export default FragmentSchemaService;
