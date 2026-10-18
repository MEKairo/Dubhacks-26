import { defaultTimeline } from '../lib/workPolicy.js';
export const people = [
  { id: 'maya', name: 'Maya Chen', username: 'maya.climbs', initials: 'MC', color: '#e3c8bc', bio: 'Usually at the climbing gym. Always down for a post-climb snack.', interests: ['Climbing', 'Coffee', 'Hiking'], note: 'Anyone up for a climbing session this week?' },
  { id: 'harley', name: 'Harley Kim', username: 'harley.k', initials: 'HK', color: '#bfcfb8', bio: 'Building things, finding new cafés, and taking the scenic route.', interests: ['Coffee', 'Gaming', 'Art'], note: 'Would love a coffee + study afternoon.' },
  { id: 'kairo', name: 'Kairo Rivera', username: 'kairo.r', initials: 'KR', color: '#c4c8e1', bio: 'A little code, a little music, a lot of good food.', interests: ['Music', 'Gym', 'Food'], note: 'Looking for a gym buddy this week.' },
  { id: 'jules', workInterests: true, companyEmail: 'jules@example.com', name: 'Jules Park', username: 'jules.p', initials: 'JP', color: '#e4cbd9', bio: 'Sketchbook in my bag, headphones on.', interests: ['Art', 'Reading'], note: 'An art museum afternoon?' },
  { id: 'sam', workInterests: false, companyEmail: 'sam@example.com', name: 'Sam Patel', username: 'sam.p', initials: 'SP', color: '#d9d2ac', bio: 'Here for good walks and good conversations.', interests: ['Hiking', 'Coffee'], note: 'A weekend trail walk sounds nice.' },
  { id: 'alex', name: 'Alex Morgan', username: 'alex.m', initials: 'AM', color: '#bdcfce', bio: 'Trying a new recipe every week.', interests: ['Food', 'Gaming'], note: 'Let’s try a new restaurant.' },
];
export const groupColors = [
  { name: 'Lavender', value: '#80619a' }, { name: 'Sage', value: '#5d795b' },
  { name: 'Rose', value: '#a85f7c' }, { name: 'Ocean', value: '#527d99' },
  { name: 'Terracotta', value: '#ae7250' },
];
export function createDemoState() {
  return {
    friends: ['maya', 'harley', 'kairo'], requests: [],
    groups: [
      { id: 'project', mode: 'work', name: 'Product team', color: groupColors[1].value, active: ['me', 'harley', 'jules', 'sam'], pending: ['kairo'], joined: true, timeline: { ...defaultTimeline } },
      { mode: 'social', id: 'weekend', name: 'Weekend people', color: groupColors[0].value, active: ['me', 'maya', 'harley', 'jules'], pending: ['sam'], joined: true },
      { mode: 'social', id: 'study', name: 'Study & snacks', color: groupColors[1].value, active: ['me', 'harley', 'kairo'], pending: [], joined: true },
      { mode: 'social', id: 'outside', name: 'Outside club', color: groupColors[2].value, active: ['maya', 'sam'], pending: ['me', 'alex'], joined: false },
    ],
    notifications: [
      { id: 'invite-1', type: 'group', from: 'maya', groupId: 'outside', status: 'pending' },
      { id: 'friend-1', type: 'friend', from: 'alex', status: 'pending' },
    ],
  };
}


