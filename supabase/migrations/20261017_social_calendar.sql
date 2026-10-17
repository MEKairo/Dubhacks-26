-- Run AFTER the profiles SQL already applied in Supabase.
-- Each group is a row in groups, not a separate database table.
create extension if not exists pgcrypto;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint distinct_friends check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_unique
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- Only busy intervals are stored. Never persist event names, descriptions, locations or attendees.
create table if not exists public.busy_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint valid_busy_slot check (ends_at > starts_at)
);
create index if not exists busy_slots_user_time_idx on public.busy_slots(user_id, starts_at, ends_at);

-- SECURITY DEFINER avoids recursive RLS checks while verifying shared-group access.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create or replace function public.shares_group(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members x
    join public.group_members y on y.group_id = x.group_id
    where x.user_id = a and y.user_id = b
  );
$$;

create or replace function public.is_group_member(g uuid, u uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.group_members where group_id = g and user_id = u);
$$;

-- Friendship state changes are controlled by RPCs, not direct client UPDATEs.
create or replace function public.send_friend_request(target_username text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target_id uuid; friendship_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select id into target_id from public.profiles
    where lower(username) = lower(trim(target_username)) limit 1;
  if target_id is null then raise exception 'User not found'; end if;
  if target_id = auth.uid() then raise exception 'Cannot friend yourself'; end if;
  insert into public.friendships(requester_id, addressee_id)
  values (auth.uid(), target_id)
  returning id into friendship_id;
  return friendship_id;
exception when unique_violation then
  raise exception 'Friend request already exists';
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept_request boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.friendships
  set status = case when accept_request then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = request_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pending request not found'; end if;
end;
$$;

create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.groups(name, owner_id) values (group_name, auth.uid())
  returning id into new_id;
  insert into public.group_members(group_id, user_id) values (new_id, auth.uid());
  return new_id;
end;
$$;

create or replace function public.add_group_member(target_group uuid, target_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.groups where id = target_group and owner_id = auth.uid())
  then raise exception 'Only the group owner can add members'; end if;
  if not public.are_friends(auth.uid(), target_user)
  then raise exception 'Add this person as a friend first'; end if;
  insert into public.group_members(group_id, user_id)
  values (target_group, target_user) on conflict do nothing;
end;
$$;

create or replace function public.remove_group_member(target_group uuid, target_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if target_user <> auth.uid() and not exists(
    select 1 from public.groups where id = target_group and owner_id = auth.uid()
  ) then raise exception 'Not authorized'; end if;
  if exists(select 1 from public.groups where id = target_group and owner_id = target_user)
  then raise exception 'Owner must delete the group instead'; end if;
  delete from public.group_members where group_id = target_group and user_id = target_user;
end;
$$;

alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.busy_slots enable row level security;

create policy "participants read friendships" on public.friendships for select to authenticated
using (auth.uid() in (requester_id, addressee_id));
create policy "members read groups" on public.groups for select to authenticated
using (public.is_group_member(id, auth.uid()));
create policy "owners edit groups" on public.groups for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete groups" on public.groups for delete to authenticated
using (owner_id = auth.uid());
create policy "members read membership" on public.group_members for select to authenticated
using (public.is_group_member(group_id, auth.uid()));
create policy "allowed users read busy slots" on public.busy_slots for select to authenticated
using (
  user_id = auth.uid()
  or public.are_friends(auth.uid(), user_id)
  or public.shares_group(auth.uid(), user_id)
);

-- No direct INSERT/UPDATE/DELETE policies on friendships, members or busy_slots.
-- Only vetted SECURITY DEFINER RPCs or the service-role sync function can write.
revoke all on public.friendships, public.groups, public.group_members, public.busy_slots from anon;
grant select on public.friendships, public.groups, public.group_members, public.busy_slots to authenticated;
grant update, delete on public.groups to authenticated;
revoke all on function public.are_friends(uuid,uuid), public.shares_group(uuid,uuid),
  public.is_group_member(uuid,uuid) from public;
grant execute on function public.are_friends(uuid,uuid), public.shares_group(uuid,uuid),
  public.is_group_member(uuid,uuid) to authenticated;
revoke all on function public.send_friend_request(text), public.respond_friend_request(uuid,boolean),
  public.create_group(text), public.add_group_member(uuid,uuid),
  public.remove_group_member(uuid,uuid) from public;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid,boolean),
  public.create_group(text), public.add_group_member(uuid,uuid),
  public.remove_group_member(uuid,uuid) to authenticated;
