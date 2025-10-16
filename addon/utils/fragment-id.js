/**
 * Utilities for generating and parsing fragment IDs
 *
 * Fragment IDs are client-side only and follow the format:
 * "{parentType}:{parentId}:{key}:{position}"
 *
 * For polymorphic fragments:
 * "{parentType}:{parentId}:{key}:{position}:{fragmentType}"
 */

const ID_SEPARATOR = ':';

/**
 * Generate a fragment ID from its components
 *
 * @param {string} parentType - The type of the parent model (e.g., 'person')
 * @param {string|number} parentId - The ID of the parent model
 * @param {string} key - The attribute key on the parent (e.g., 'addresses')
 * @param {number} position - The position in the array (0 for singleton fragments)
 * @param {string|null} fragmentType - Optional type for polymorphic fragments
 * @returns {string} The generated fragment ID
 *
 * @example
 * generateFragmentId('person', '123', 'addresses', 0)
 * // => "person:123:addresses:0"
 *
 * @example
 * generateFragmentId('activity', '456', 'target', 0, 'photo')
 * // => "activity:456:target:0:photo"
 */
export function generateFragmentId(parentType, parentId, key, position, fragmentType = null) {
  const parts = [parentType, String(parentId), key, String(position)];
  if (fragmentType) {
    parts.push(fragmentType);
  }
  return parts.join(ID_SEPARATOR);
}

/**
 * Parse a fragment ID into its components
 *
 * @param {string} fragmentId - The fragment ID to parse
 * @returns {Object} Parsed components
 * @returns {string} return.parentType
 * @returns {string} return.parentId
 * @returns {string} return.key
 * @returns {number} return.position
 * @returns {string|null} return.fragmentType
 *
 * @example
 * parseFragmentId('person:123:addresses:0')
 * // => { parentType: 'person', parentId: '123', key: 'addresses', position: 0, fragmentType: null }
 */
export function parseFragmentId(fragmentId) {
  const parts = fragmentId.split(ID_SEPARATOR);

  if (parts.length < 4) {
    throw new Error(`Invalid fragment ID format: ${fragmentId}`);
  }

  return {
    parentType: parts[0],
    parentId: parts[1],
    key: parts[2],
    position: parseInt(parts[3], 10),
    fragmentType: parts[4] || null
  };
}

/**
 * Check if an ID is a fragment ID
 *
 * @param {string} id - The ID to check
 * @returns {boolean}
 */
export function isFragmentId(id) {
  if (typeof id !== 'string') return false;
  const parts = id.split(ID_SEPARATOR);
  return parts.length >= 4;
}

/**
 * Get the parent ID from a fragment ID
 *
 * @param {string} fragmentId - The fragment ID
 * @returns {string} The parent ID
 */
export function getParentIdFromFragment(fragmentId) {
  const { parentId } = parseFragmentId(fragmentId);
  return parentId;
}

/**
 * Get the parent type from a fragment ID
 *
 * @param {string} fragmentId - The fragment ID
 * @returns {string} The parent type
 */
export function getParentTypeFromFragment(fragmentId) {
  const { parentType } = parseFragmentId(fragmentId);
  return parentType;
}
