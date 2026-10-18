// Deterministic sample availability; replace this with synced busy intervals later.
export function isFree(personId, date, hour) {
  const seed = [...personId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const day = date.getDate() + date.getMonth() * 31;
  const slot = Math.round(hour * 2);
  return (seed * 3 + day * 7 + Math.floor(slot / 3) * 11) % 13 > 4;
}
export function freeCount(memberIds, date, hour) {
  return memberIds.filter(id => isFree(id, date, hour)).length;
}
export function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - (result.getDay() + 6) % 7);
  return result;
}
export function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}
