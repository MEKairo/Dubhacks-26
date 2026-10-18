// Comparisons do not create memberships or reveal anyone's event details.
export function comparisonMembers(friendIds, selectedIds, originalId) {
  return [...new Set(['me', ...(originalId ? [originalId] : []), ...selectedIds.filter(id => friendIds.includes(id))])];
}
