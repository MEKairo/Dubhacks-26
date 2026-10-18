export const emptySocial = () => ({ friends: [], requests: [], groups: [], notifications: [] });
export function profilePerson(row) {
  const name = row.display_name || row.username || 'Member';
  return { id: row.id, name, username: row.username || '', initials: name.split(/\s+/).map(p => p[0]).slice(0, 2).join(''),
    avatarUrl: row.avatar_url, interests: Array.isArray(row.interests) ? row.interests : [], bio: row.bio || '', note: '' };
}
export function socialSnapshot(userId, rows) {
  const me = id => id === userId ? 'me' : id;
  const friends = rows.friendships.filter(f => f.status === 'accepted')
    .map(f => me(f.requester_id === userId ? f.addressee_id : f.requester_id));
  const groups = rows.groups.map(g => ({
    id: g.id, name: g.name, ownerId: me(g.owner_id), mode: 'social', color: 'var(--personal-color, #80619a)',
    joined: rows.members.some(m => m.group_id === g.id && m.user_id === userId),
    active: rows.members.filter(m => m.group_id === g.id).map(m => me(m.user_id)),
    pending: rows.invitations.filter(i => i.group_id === g.id && i.status === 'pending').map(i => me(i.invitee_id)),
  }));
  const notifications = [
    ...rows.friendships.filter(f => f.addressee_id === userId).map(f => ({
      id: f.id, type: 'friend', from: me(f.requester_id),
      status: f.status === 'rejected' ? 'declined' : f.status,
    })),
    ...rows.invitations.filter(i => i.invitee_id === userId).map(i => ({
      id: i.id, type: 'group', from: me(i.inviter_id), groupId: i.group_id, status: i.status,
    })),
  ];
  return { friends, groups, notifications,
    requests: rows.friendships.filter(f => f.requester_id === userId && f.status === 'pending').map(f => me(f.addressee_id)) };
}
async function unwrap(request) {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
}
export async function readRows(factory) {
  const result = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const page = await unwrap(factory().range(offset, offset + 499));
    result.push(...(page || []));
    if (!page || page.length < 500) return result;
  }
  throw new Error('Too many records to load safely. Narrow the request.');
}
export function socialBackend(client) {
  return {
    async load(userId) {
      const [friendships, groups, members, invitations] = await Promise.all([
        readRows(() => client.from('friendships').select('id,requester_id,addressee_id,status').order('id')),
        readRows(() => client.from('groups').select('id,name,owner_id').order('id')),
        readRows(() => client.from('group_members').select('group_id,user_id').order('group_id').order('user_id')),
        readRows(() => client.from('group_invitations').select('id,group_id,inviter_id,invitee_id,status').order('id')),
      ]);
      const ids = [...new Set([userId, ...friendships.flatMap(f => [f.requester_id, f.addressee_id]),
        ...groups.map(g => g.owner_id), ...members.map(m => m.user_id),
        ...invitations.flatMap(i => [i.inviter_id, i.invitee_id])])];
      const profiles = [];
      for (let i = 0; i < ids.length; i += 100) profiles.push(...await readRows(() => client.from('profiles')
        .select('id,username,display_name,avatar_url').in('id', ids.slice(i, i + 100)).order('id')));
      const ownDetails = await unwrap(client.rpc('get_profile_details', { target_user: userId }));
      const ownProfile = Array.isArray(ownDetails) ? ownDetails[0] : ownDetails;
      // Other users' protected interests are exposed only by the privacy-aware RPC.
      const people = await Promise.all(profiles.filter(p => p.id !== userId).map(async row => {
        const details = await unwrap(client.rpc('get_profile_details', { target_user: row.id }));
        return profilePerson({ ...row, ...(Array.isArray(details) ? details[0] : details) });
      }));
      return { social: socialSnapshot(userId, { friendships, groups, members, invitations }),
        people, profile: ownProfile || profiles.find(p => p.id === userId) || null };
    },
    async search(username) {
      const exact = username.trim().replace(/^@/, '');
      if (!exact || exact.length > 100) throw new Error('Enter an exact username.');
      const escaped = exact.replace(/[\\%_]/g, char => '\\' + char);
      const row = await unwrap(client.from('profiles').select('id,username,display_name,avatar_url')
        .ilike('username', escaped).maybeSingle());
      return row ? profilePerson(row) : null;
    },
    requestFriend(username) { return unwrap(client.rpc('send_friend_request', { target_username: username })); },
    answer(notification, accepted) {
      return notification.type === 'friend'
        ? unwrap(client.rpc('respond_friend_request', { request_id: notification.id, accept_request: accepted }))
        : unwrap(client.rpc('respond_group_invitation', { invitation_id: notification.id, accept_invite: accepted }));
    },
    async createGroup(name, invitees) {
      const groupId = await unwrap(client.rpc('create_group', { group_name: name.trim() }));
      const failures = [];
      for (const target of [...new Set(invitees)]) {
        try { await unwrap(client.rpc('invite_to_group', { target_group: groupId, target_user: target })); }
        catch { failures.push(target); }
      }
      return { groupId, failedInvites: failures };
    },
    leaveGroup(groupId, userId) {
      return unwrap(client.rpc('remove_group_member', { target_group: groupId, target_user: userId }));
    },
    saveProfile(userId, profile) {
      const changes = {
        display_name: (profile.name || '').trim(),
        bio: (profile.bio || '').trim(),
        interests: Array.isArray(profile.interests) ? profile.interests : [],
        availability_visibility: ['groups', 'friends', 'private'].includes(profile.availability) ? profile.availability : 'private',
        show_interests: Boolean(profile.showInterests),
        work_social: Boolean(profile.workSocial),
      };
      if (profile.username !== undefined) {
        const username = profile.username.trim().replace(/^@/, '');
        if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username))
          throw new Error('Username must be 3–30 characters (letters, numbers, dots, underscores or hyphens).');
        changes.username = username || null;
      }
      return unwrap(client.from('profiles').update(changes)
        .eq('id', userId).select('id,display_name').single());
    },
  };
}
