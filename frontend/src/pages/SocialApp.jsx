import React, { useEffect, useState } from 'react';
import AvailabilityCalendar from '../components/AvailabilityCalendar.jsx';
import { people as demoPeople, groupColors } from '../data/demo.js';
import { isFree } from '../lib/availability.js';
import { defaultTimeline, timelineSummary } from '../lib/workPolicy.js';
import NoteEditor from './NoteEditor.jsx';
import { comparisonMembers } from '../lib/comparison.js';


function Avatar({ person, small = false }) { return <span className={`person-avatar ${small ? 'small-avatar' : ''}`} style={{ background: person?.color }} aria-label={person?.name ? `${person.name} avatar` : 'Your avatar'}>{person?.initials || 'You'}</span>; }
function PageHeading({ eyebrow, title, children }) { return <div className="social-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>; }

export default function SocialApp({ route, demo, setDemo, profile, setProfile, theme, people = demoPeople, backend }) {
  const work = theme === 'work';
  const [actionNotice, setActionNotice] = useState('');
  const [sessionGroupColors, setGroupColors] = useState({});
  const getPerson = id => people.find(person => person.id === id) || {
    id, name: id === 'me' ? (profile.name || 'You') : 'Member', username: '', initials: '', bio: '', interests: [], note: '',
  };
  if (backend) demo = { ...demo, groups: demo.groups.map(group => ({
    ...group, color: sessionGroupColors[group.id] || group.color,
  })) };
  const drawerRef = React.useRef(null);
  const [navOpen, setNavOpen] = useState(false);
  const leaveRef = React.useRef(null);
  const [inspectedSlot, setInspectedSlot] = useState(null);
  const [noteSelections, setNoteSelections] = useState([]);
  const [profileSelections, setProfileSelections] = useState({});
  const [friendSearch, setFriendSearch] = useState('');
  const [timeline, setTimeline] = useState({ ...defaultTimeline });
  useEffect(() => {
    drawerRef.current?.close();
    leaveRef.current?.close();
    setInspectedSlot(null);
    setFriendSearch('');
  }, [route, theme]);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [newName, setNewName] = useState('');
  const [invitees, setInvitees] = useState([]);
  const [color, setColor] = useState(groupColors[0].value);
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [section, id] = route.split('/');
  const activeGroups = demo.groups.filter(group => group.joined && (group.mode || 'social') === theme);
  const notifications = demo.notifications.filter(item => item.type === 'friend' || (demo.groups.find(group => group.id === item.groupId)?.mode || 'social') === theme);
  const unread = notifications.filter(item => item.status === 'pending').length;
  const friends = people.filter(person => demo.friends.includes(person.id));
  const group = activeGroups.find(item => item.id === id);
  const person = people.find(item => item.id === id);
  const friend = person && demo.friends.includes(person.id);
  const requestSent = person && demo.requests.includes(person.id);
  const coworkerGroup = person && demo.groups.find(item => item.mode === 'work' && item.joined && item.active.includes(person.id));
  const noteMembers = comparisonMembers(demo.friends, work ? [] : noteSelections);
  const extraFriends = profileSelections[id] || [];
  const profileMembers = comparisonMembers(demo.friends, work ? [] : extraFriends, person?.id);
  const comparisonTitle = ids => ids.map(memberId => memberId === 'me' ? 'You' : getPerson(memberId).name.split(' ')[0]).join(' + ');
  function toggleNote(personId) {
    setNoteSelections(previous => previous.includes(personId) ? previous.filter(item => item !== personId) : [...previous, personId]);
  }
  function toggleComparison(personId) {
    setProfileSelections(previous => ({ ...previous, [id]: extraFriends.includes(personId) ? extraFriends.filter(item => item !== personId) : [...extraFriends, personId] }));
  }

  async function requestFriend(personId) {
    if (backend) {
      const target = getPerson(personId);
      await backend.perform(api => api.requestFriend(target.username));
      return;
    }
    setDemo(previous => ({ ...previous, requests: [...new Set([...previous.requests, personId])] }));
  }
  async function answerNotification(notification, accepted) {
    if (backend) {
      await backend.perform(api => api.answer(notification, accepted));
      return;
    }
    setDemo(previous => ({
      ...previous,
      notifications: previous.notifications.map(item => item.id === notification.id ? { ...item, status: accepted ? 'accepted' : 'declined' } : item),
      friends: accepted && notification.type === 'friend' ? [...new Set([...previous.friends, notification.from])] : previous.friends,
      requests: accepted && notification.type === 'friend' ? previous.requests.filter(request => request !== notification.from) : previous.requests,
      groups: accepted && notification.type === 'group' ? previous.groups.map(item => item.id === notification.groupId ? { ...item, joined: true, active: [...new Set([...item.active, 'me'])], pending: item.pending.filter(member => member !== 'me') } : item) : previous.groups,
    }));
  }
  async function createGroup(event) {
    event.preventDefault();
    if (!newName.trim() || (work && timeline.endHour <= timeline.startHour)) return;
    if (backend) {
      if (work) { setActionNotice('Work-group modes and sharing windows are not supported by the backend yet. Nothing was saved.'); return; }
      const result = await backend.perform(api => api.createGroup(newName, invitees));
      if (!result) return;
      const { groupId, failedInvites } = result.data;
      setGroupColors(old => ({ ...old, [groupId]: color }));
      setActionNotice(failedInvites.length ? 'Group created, but some invitations failed. They were not sent.' : '');
      setNewName(''); setInvitees([]);
      window.location.hash = 'group/' + groupId;
      return;
    }
    const groupId = `group-${Date.now()}`;
    setDemo(previous => ({ ...previous, groups: [...previous.groups, { id: groupId, mode: theme, timeline: work ? { ...timeline } : undefined, name: newName.trim(), color, joined: true, active: ['me'], pending: invitees }] }));
    setNewName(''); setInvitees([]);
    window.location.hash = `group/${groupId}`;
  }
  async function leaveGroup() {
    if (backend) {
      const result = await backend.perform(api => api.leaveGroup(group.id, backend.session.user.id));
      if (!result) { leaveRef.current?.close(); return; }
    } else setDemo(previous => ({ ...previous, groups: previous.groups.map(item => item.id === group.id ? { ...item, joined: false, active: item.active.filter(memberId => memberId !== 'me') } : item) }));
    leaveRef.current?.close();
    window.location.hash = 'groups';
  }
  async function searchPeople(event) {
    event.preventDefault();
    setActionNotice('');
    if (backend) {
      try { await backend.search(query); }
      catch (error) { setActionNotice(error.message); setSearched(false); return; }
    }
    setSearched(true);
  }
  function cancelRequest(personId) {
    if (backend) { setActionNotice('Canceling friend requests is not supported by the backend yet. The request is unchanged.'); return; }
    setDemo(previous => ({ ...previous, requests: previous.requests.filter(item => item !== personId) }));
  }
  function memberStatus(memberId) {
    return backend ? inspectedSlot?.statuses?.[memberId] ?? null : isFree(memberId, inspectedSlot.day, inspectedSlot.hour);
  }
  function memberLink(memberId, pending = false) {
    const member = getPerson(memberId);
    return <a key={memberId} className="member-pill" href={memberId === 'me' ? '#profile' : `#person/${memberId}`}><Avatar person={member} small /><span>{memberId === 'me' ? 'You' : member.name}</span>{pending && <small>Invited</small>}</a>;
  }
  function personCard(member) {
    return <a className="person-card" key={member.id} href={`#person/${member.id}`}><Avatar person={member} /><div><h2>{member.name}</h2><p>@{member.username}</p><div className="preview-tags">{member.interests.slice(0, 3).map(interest => <span key={interest}>{interest}</span>)}</div></div><span className="card-arrow">↗</span></a>;
  }

  const sidebar = <>
      
      <nav aria-label="Main navigation">{[['calendar','▦','My calendar'],['notifications','♧','Notifications'],['people','♡',work ? 'Company directory' : 'My people'],['groups','▤','My groups']].map(([path, icon, label]) => <a key={path} href={`#${path}`} aria-current={section === path || path === 'groups' && ['group','new-group'].includes(section) ? 'page' : undefined}><span aria-hidden="true">{icon}</span>{label}{path === 'notifications' && unread > 0 && <b className="notification-count">{unread}</b>}</a>)}</nav>
      <div className="sidebar-groups"><div><span>MY GROUPS</span><a href="#new-group" aria-label="Create a group">+</a></div>{activeGroups.map(item => <a key={item.id} href={`#group/${item.id}`}><i style={{ background: item.color }} />{item.name}</a>)}{!activeGroups.length && <p>No groups yet. Start a little circle.</p>}</div>
      <a className="sidebar-profile" href="#profile"><span className="person-avatar small-avatar">{profile.name?.slice(0,1) || 'E'}</span><span>{profile.name || 'Your profile'}<small>Edit profile & sharing</small></span></a>
      <p className="demo-label">{backend ? 'Connected to Supabase · unsupported preview settings stay in this session.' : 'Interactive demo · sample people & availability. Changes reset on refresh.'}</p>
    </>;
  return <main className="social-shell">
    <div className="mobile-navigation"><button className="secondary-button" type="button" aria-haspopup="dialog" aria-expanded={navOpen} aria-controls="mobile-navigation" onClick={() => { drawerRef.current?.showModal(); setNavOpen(true); }}>☰ <span>Menu</span></button><span>{work ? 'Work' : 'Social'} workspace</span></div>
    <aside className="social-sidebar desktop-sidebar">{sidebar}</aside>
    <dialog id="mobile-navigation" className="navigation-dialog" ref={drawerRef} aria-label="Navigation" onClose={() => setNavOpen(false)} onClick={event => { if (event.target === event.currentTarget || event.target.closest('a')) drawerRef.current?.close(); }}><div className="drawer-header"><strong>Navigation</strong><button className="secondary-button" aria-label="Close navigation" onClick={() => drawerRef.current?.close()}>×</button></div><div className="social-sidebar">{sidebar}</div></dialog>
    <dialog className="confirm-dialog" ref={leaveRef} aria-labelledby="leave-title"><h2 id="leave-title">Leave {group?.name}?</h2><p>You’ll lose access to this group’s availability. You’ll need a new invitation to rejoin.</p><div className="panel-actions"><button className="secondary-button" autoFocus onClick={() => leaveRef.current?.close()}>Stay in group</button><button className="primary-button" onClick={leaveGroup}>Leave group</button></div></dialog>
    <div className="social-content">{(actionNotice || backend?.error || backend?.pending) && <p className="inline-notice" role="status">{actionNotice || backend?.error || 'Loading…'}</p>}
      {theme === 'work' && <p className="work-preview-banner">Work availability · work-group policies are a preview until supported by the backend.</p>}
      {section === 'note' && (work ? <section className="surface"><h1>Activity notes are in Social mode.</h1><a href="#calendar">Back to calendar</a></section> : <NoteEditor profile={profile} setProfile={setProfile} backend={backend} />)}
      {section === 'calendar' && <>
        <PageHeading eyebrow={work ? 'AVAILABILITY OVERVIEW' : 'A LITTLE ROOM FOR GOOD THINGS'} title={work ? 'My workspace' : profile.name ? `Your time, ${profile.name}.` : 'Make room for a moment.'}><a className="secondary-button button-link" href="#profile">Edit my profile ↗</a></PageHeading>
        <div className={`dashboard-layout ${work ? 'work-dashboard' : ''}`}><div><div className="sync-preview">{backend?.session.provider_token ? '○ Calendar connected' : '○ Calendar connection pending'} <a href="#profile">Link your calendar →</a></div><AvailabilityCalendar title={noteMembers.length > 1 ? comparisonTitle(noteMembers) : 'My calendar'} memberIds={noteMembers} /></div>{!work && <aside className="activity-panel"><h2>This week, together</h2><p className="description">A reason to reach out. Take the conversation wherever you like.</p><a className="secondary-button button-link" href="#note">Write an activity note ↗</a>{profile.note && (!profile.noteExpiresAt || profile.noteExpiresAt > now) && <article className="wish-card"><small>YOUR NOTE · {profile.noteDuration === 'forever' ? 'UNTIL REMOVED' : profile.noteDuration === 'day' ? 'ONE DAY' : 'ONE WEEK'}</small><p>{profile.note}</p><a className="text-button" href="#note">Edit note →</a></article>}<div className="comparison-toolbar"><span>{noteSelections.length} selected</span><button className="text-button" disabled={!noteSelections.length} onClick={() => setNoteSelections([])}>Deselect all</button></div><p className="comparison-hint">Select friends to compare your free time. No group or invitation needed.</p><div className="friends-notes" aria-label="Friends activity notes">{friends.map(member => <article className={`wish-card ${noteSelections.includes(member.id) ? 'selected-note' : ''}`} key={member.id}><div className="note-person-row"><a href={`#person/${member.id}`}><Avatar person={member} small /><strong>{member.name.split(' ')[0]}</strong></a><input type="checkbox" aria-label={`Include ${member.name} in calendar comparison`} checked={noteSelections.includes(member.id)} onChange={() => toggleNote(member.id)} /></div><p>{member.note}</p><a className="text-button" href={`#person/${member.id}`}>Find time together →</a></article>)}</div></aside>}</div>
      </>}
      {section === 'people' && work && <section className="surface empty-state"><h1>Company directory</h1><p>Company-wide discovery is planned for a later version. For now, open a work group to view its members.</p><a className="primary-button button-link" href="#groups">Open work groups →</a></section>}
      {section === 'people' && !work && <>
        <PageHeading eyebrow="GOOD COMPANY" title="My people" />
        <section className="surface search-panel"><h2>Find your person</h2><p className="description">Search an exact username to send a friend request.</p><form className="people-search" onSubmit={searchPeople}><label className="sr-only" htmlFor="username-search">Exact username</label><input id="username-search" placeholder="e.g. sam.p" value={query} onChange={event => { setQuery(event.target.value); setSearched(false); }} required /><button className="primary-button" type="submit">Find person</button></form><small className="demo-label">{backend ? 'Enter the exact username of a registered user.' : 'Demo usernames: sam.p · jules.p · alex.m'}</small>{searched && (() => {
          const match = people.find(member => member.username.toLowerCase() === query.trim().replace(/^@/, '').toLowerCase());
          return match ? <div className="search-result"><a href={`#person/${match.id}`}><Avatar person={match} small />@{match.username}</a>{demo.friends.includes(match.id) ? <span className="badge">Already friends</span> : <button className="secondary-button" disabled={demo.requests.includes(match.id)} onClick={() => requestFriend(match.id)}>{demo.requests.includes(match.id) ? 'Request sent' : 'Send friend request'}</button>}</div> : <p role="status" className="inline-notice">{backend ? 'No exact match found.' : 'No exact match. Try one of the demo usernames above.'}</p>;
        })()}</section>
        <h2 className="section-subtitle">Your friends <span>{friends.length}</span></h2><div className="people-grid">{friends.map(personCard)}</div>{demo.requests.length > 0 && <section className="surface"><h2>Sent requests</h2>{demo.requests.map(personId => <div className="search-result" key={personId}><span>@{getPerson(personId).username}</span><button className="text-button" onClick={() => cancelRequest(personId)}>Cancel request</button></div>)}</section>}
      </>}
      {section === 'groups' && <>
        <PageHeading eyebrow={work ? 'COLLABORATION' : 'YOUR CIRCLES'} title={work ? 'My work groups' : 'My groups'}><a className="primary-button button-link" href="#new-group">+ Create a group</a></PageHeading>
        {activeGroups.length ? <div className="group-grid">{activeGroups.map(item => <a className="group-card surface" key={item.id} href={`#group/${item.id}`}><span className="group-symbol" style={{ background: item.color }}>▦</span><h2>{item.name}</h2>{item.timeline && <p className="privacy-note">{timelineSummary(item.timeline)}</p>}<p>{item.active.length} active · {item.pending.length} invited</p><div className="avatar-stack">{item.active.slice(0,4).map(memberId => <Avatar key={memberId} person={getPerson(memberId)} small />)}</div><span className="text-button">Find your overlap →</span></a>)}</div> : <section className="empty-state surface"><h2>A group starts with you.</h2><p>Invite your friends and find a time that works.</p><a href="#new-group" className="primary-button button-link">Create your first group</a></section>}
      </>}
      {section === 'new-group' && <>
        <PageHeading eyebrow={work ? 'SHARED AVAILABILITY' : 'MAKE A LITTLE CIRCLE'} title={work ? 'Create a work group' : 'Create a group'} />
        <form className="surface create-group-form" onSubmit={createGroup}><label htmlFor="group-name">Group name</label><input id="group-name" placeholder="Weekend people" value={newName} onChange={event => setNewName(event.target.value)} maxLength={60} required pattern=".*\S.*" /><fieldset><legend>Choose an availability color</legend><div className="color-choices">{groupColors.map(choice => <button key={choice.name} type="button" style={{ '--swatch': choice.value }} className={color === choice.value ? 'chosen' : ''} aria-pressed={color === choice.value} onClick={() => setColor(choice.value)}><i />{choice.name}</button>)}</div></fieldset>{work && <fieldset className="work-timeline-fields"><legend>Availability sharing window</legend><p className="privacy-note">Only these days and hours are visible to this group. Times use Pacific time.</p><label className="weekends-option"><input type="checkbox" checked={timeline.includeWeekends} onChange={event => setTimeline(previous => ({ ...previous, includeWeekends: event.target.checked }))} />Include weekends</label><div className="time-range-fields"><label>From<select aria-label="Work group start hour" value={timeline.startHour} onChange={event => setTimeline(previous => ({ ...previous, startHour: Number(event.target.value) }))}>{Array.from({ length: 48 }, (_, i) => i / 2).map(hour => <option key={hour} value={hour}>{String(Math.floor(hour)).padStart(2, '0')}:{hour % 1 ? '30' : '00'}</option>)}</select></label><label>Until<select aria-label="Work group end hour" value={timeline.endHour} onChange={event => setTimeline(previous => ({ ...previous, endHour: Number(event.target.value) }))}>{Array.from({ length: 48 }, (_, i) => (i + 1) / 2).map(hour => <option key={hour} value={hour}>{String(Math.floor(hour)).padStart(2, '0')}:{hour % 1 ? '30' : '00'}</option>)}</select></label></div>{timeline.endHour <= timeline.startHour && <p className="field-error" role="alert">End time must be later than start time.</p>}<p className="timeline-summary">{timelineSummary(timeline)}</p></fieldset>}<fieldset><legend>{work ? 'Invite people you know' : 'Invite from your friends'}</legend><p className="privacy-note">Everyone invited will be listed on the invitation, including people who haven’t accepted.</p>{friends.map(member => <label className="invite-friend" key={member.id}><Avatar person={member} small /><span>{member.name}<small>@{member.username}</small></span><input type="checkbox" checked={invitees.includes(member.id)} onChange={() => setInvitees(previous => previous.includes(member.id) ? previous.filter(item => item !== member.id) : [...previous, member.id])} /></label>)}</fieldset><p className="privacy-note">Joining a group lets its active members view your availability, including selecting only your calendar. Event details stay private. Invited members get access after joining.</p><div className="panel-actions"><a className="text-button" href="#groups">Cancel</a><button className="primary-button" type="submit" disabled={work && timeline.endHour <= timeline.startHour}>{invitees.length ? `Create & invite ${invitees.length}` : 'Create group'}</button></div></form>
      </>}
      {section === 'notifications' && <>
        <PageHeading eyebrow={work ? 'REQUESTS & INVITATIONS' : 'A LITTLE HELLO'} title="Notifications" />
        <div className="notification-list">{notifications.map(notification => {
          const sender = getPerson(notification.from);
          const invitedGroup = demo.groups.find(item => item.id === notification.groupId);
          return <article className="surface notification-card" key={notification.id}><div className="notification-title"><Avatar person={sender} /><div><h2>{sender.name} {notification.type === 'group' ? <>invited you to join <strong>{invitedGroup.name}</strong>.</> : 'sent you a friend request.'}</h2><span className="badge">{notification.status === 'pending' ? 'Waiting for you' : notification.status}</span></div></div>{notification.type === 'group' && <div className="invite-details">{invitedGroup.timeline && <p className="timeline-summary">Shared window: {timelineSummary(invitedGroup.timeline)}</p>}<h3>Who’s in this circle</h3><p className="privacy-note">If you join, active members can view your availability individually. People invited below will gain access if they join too.</p><h4>Active members</h4><div className="member-list">{invitedGroup.active.map(memberId => memberLink(memberId))}</div><h4>Also invited</h4><div className="member-list">{invitedGroup.pending.length ? invitedGroup.pending.map(memberId => memberLink(memberId, true)) : <span className="privacy-note">No pending invitations.</span>}</div></div>}{notification.status === 'pending' ? <div className="notification-actions"><button className="text-button" onClick={() => answerNotification(notification, false)}>Decline</button><button className="primary-button" onClick={() => answerNotification(notification, true)}>{notification.type === 'group' ? 'Accept & join group' : 'Accept friend request'}</button></div> : notification.status === 'accepted' && <a className="text-button" href={notification.type === 'group' ? `#group/${notification.groupId}` : `#person/${notification.from}`}>{notification.type === 'group' ? 'Open group' : 'View friend'} →</a>}</article>;
        })}</div>
      </>}
      {section === 'group' && (group ? <>
        <PageHeading eyebrow={work ? 'TEAM AVAILABILITY' : 'A MOMENT FOR EVERYONE'} title={group.name}><a href="#groups" className="text-button">← All groups</a></PageHeading>
        <div className="group-calendar-layout"><section className="surface group-members"><h2>Whose time?</h2><p className="privacy-note">Hover, focus, or tap a time to see who is free. Your member selection stays the same.</p>{inspectedSlot && <p className="inspected-time">{inspectedSlot.day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {String(Math.floor(inspectedSlot.hour)).padStart(2, '0')}:{inspectedSlot.hour % 1 ? '30' : '00'}</p>}<div className="member-selection-actions"><button className="text-button" onClick={() => setSelectedByGroup(previous => ({ ...previous, [group.id]: [...group.active] }))}>Select all</button><button className="text-button" onClick={() => setSelectedByGroup(previous => ({ ...previous, [group.id]: [] }))}>Clear</button></div>{group.active.map(memberId => {
          const selected = selectedByGroup[group.id] ?? group.active;
          return <div className={`member-checkbox-row ${inspectedSlot && memberStatus(memberId) === false ? 'member-busy' : ''}`} key={memberId}><input aria-label={`Show ${memberId === 'me' ? 'your' : getPerson(memberId).name + '’s'} availability`} type="checkbox" checked={selected.includes(memberId)} onChange={() => setSelectedByGroup(previous => ({ ...previous, [group.id]: selected.includes(memberId) ? selected.filter(item => item !== memberId) : [...selected, memberId] }))} />{memberLink(memberId)}{inspectedSlot && <small className="member-availability">{memberStatus(memberId) === null ? 'Unknown' : memberStatus(memberId) ? 'Free' : 'Busy'}</small>}</div>;
        })}<h3>Invited · {group.pending.length}</h3><p className="privacy-note">Not included in availability until they join.</p><div className="member-list">{group.pending.map(memberId => memberLink(memberId, true))}</div><p className="privacy-note">Members can view each other’s availability. Event names stay private.</p><button className="text-button" onClick={() => leaveRef.current?.showModal()}>Leave group</button></section><AvailabilityCalendar key={group.id} title="Group availability" memberIds={(selectedByGroup[group.id] ?? group.active).filter(memberId => group.active.includes(memberId))} color={group.color} timeline={group.timeline} onInspect={setInspectedSlot} /></div>
      </> : <section className="surface empty-state"><h1>This group isn’t in your circles.</h1><a href="#groups">Back to my groups</a></section>)}
      {section === 'person' && (person ? <>
        <a className="back-link" href="#people">← My people</a>
        {friend ? <><section className="surface friend-profile"><Avatar person={person} /><div><p className="eyebrow">YOUR FRIEND</p><h1>{person.name}</h1><p className="username">@{person.username}</p><p>{person.bio}</p><div className="preview-tags">{person.interests.map(interest => <span key={interest}>{interest}</span>)}</div>{!work && <p className="friend-note">This week: “{person.note}”</p>}</div></section><p className="privacy-note">Compare your availability below, then reach out off-platform to make a plan.</p><div className={`friend-comparison-layout ${work ? 'work-comparison' : ''}`}><AvailabilityCalendar key={`${person.id}-${theme}`} memberIds={profileMembers} title={comparisonTitle(profileMembers)} timeline={work ? coworkerGroup?.timeline || defaultTimeline : undefined} />{!work && <aside className="activity-panel friend-comparison-panel"><h2>Make it a few of us</h2><p className="description">Compare friends’ availability, then make the plan off-platform.</p><p className="pinned-friend">You + {person.name.split(' ')[0]} are always included.</p><label htmlFor="comparison-search" className="sr-only">Search your friends</label><input id="comparison-search" type="search" placeholder="Search your friends…" value={friendSearch} onChange={event => setFriendSearch(event.target.value)} /><div className="comparison-toolbar"><span>{extraFriends.length} added</span><button className="text-button" disabled={!extraFriends.length} onClick={() => setProfileSelections(previous => ({ ...previous, [id]: [] }))}>Deselect all</button></div><div className="comparison-friends">{friends.filter(member => `${member.name} ${member.username}`.toLowerCase().includes(friendSearch.trim().toLowerCase())).map(member => <label key={member.id} className="comparison-friend"><Avatar person={member} small /><span>{member.name}<small>{member.id === person.id ? 'Always included' : `@${member.username}`}</small></span><input type="checkbox" aria-label={`Include ${member.name} in comparison`} checked={member.id === person.id || extraFriends.includes(member.id)} disabled={member.id === person.id} onChange={() => toggleComparison(member.id)} /></label>)}{!friends.some(member => `${member.name} ${member.username}`.toLowerCase().includes(friendSearch.trim().toLowerCase())) && <p className="privacy-note" role="status">No friends match that search.</p>}</div></aside>}</div></> : <section className="surface locked-profile"><Avatar person={person} />{work && coworkerGroup && <>{person.companyEmail && <a href={`mailto:${person.companyEmail}`}>{person.companyEmail}</a>}{person.workInterests && <div className="preview-tags">{person.interests.map(interest => <span key={interest}>{interest}</span>)}</div>}</>}<button className="primary-button" disabled={requestSent} onClick={() => requestFriend(person.id)}>{requestSent ? 'Friend request sent' : 'Send friend request'}</button></section>}
      </> : <section className="surface empty-state"><h1>Profile not found.</h1><a href="#people">Back to my people</a></section>)}
      
    </div>
  </main>;
}
