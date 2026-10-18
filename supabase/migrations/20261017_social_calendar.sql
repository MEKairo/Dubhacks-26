-- ============================================================
-- DUBHACKS 2026: FRIENDS, GROUPS, AND CALENDAR AVAILABILITY
-- Run AFTER the profiles table has been created.
-- Keep the existing profiles table.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. FRIENDSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT distinct_friends CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
ON public.friendships (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_addressee_idx
ON public.friendships(addressee_id, status);

-- ============================================================
-- 2. GROUPS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 80),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. GROUP MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_user_idx
ON public.group_members(user_id);

-- ============================================================
-- 4. GROUP INVITATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE (group_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS group_invitations_invitee_idx
ON public.group_invitations(invitee_id, status);

-- ============================================================
-- 5. BUSY SLOTS
-- Store only busy intervals, never event details.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.busy_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_busy_slot CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS busy_slots_user_time_idx
ON public.busy_slots(user_id, starts_at, ends_at);

-- ============================================================
-- 6. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE f.status = 'accepted'
        AND (
            (f.requester_id = a AND f.addressee_id = b)
            OR
            (f.requester_id = b AND f.addressee_id = a)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.shares_group(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_members x
        JOIN public.group_members y
            ON x.group_id = y.group_id
        WHERE x.user_id = a
        AND y.user_id = b
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(g UUID, u UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_members
        WHERE group_id = g
        AND user_id = u
    );
$$;

CREATE OR REPLACE FUNCTION public.is_group_invitee(g UUID, u UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_invitations
        WHERE group_id = g
        AND invitee_id = u
    );
$$;

-- ============================================================
-- 7. FRIEND REQUESTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_friend_request(
    target_username TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_id UUID;
    friendship_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required';
    END IF;

    SELECT id INTO target_id
    FROM public.profiles
    WHERE LOWER(username) = LOWER(TRIM(target_username))
    LIMIT 1;

    IF target_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF target_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot friend yourself';
    END IF;

    INSERT INTO public.friendships(requester_id, addressee_id)
    VALUES (auth.uid(), target_id)
    RETURNING id INTO friendship_id;

    RETURN friendship_id;

EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Friend request already exists';
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(
    request_id UUID,
    accept_request BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.friendships
    SET status = CASE
            WHEN accept_request THEN 'accepted'
            ELSE 'rejected'
        END,
        updated_at = NOW()
    WHERE id = request_id
    AND addressee_id = auth.uid()
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending request not found';
    END IF;
END;
$$;

-- ============================================================
-- 8. CREATE GROUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_group(
    group_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required';
    END IF;

    INSERT INTO public.groups(name, owner_id)
    VALUES (group_name, auth.uid())
    RETURNING id INTO new_id;

    INSERT INTO public.group_members(group_id, user_id)
    VALUES (new_id, auth.uid());

    RETURN new_id;
END;
$$;

-- ============================================================
-- 9. INVITE TO GROUP
-- Only the creator can invite.
-- Friendship is NOT required.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invite_to_group(
    target_group UUID,
    target_user UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_invitation_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.groups
        WHERE id = target_group
        AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only the group creator can invite users';
    END IF;

    IF target_user = auth.uid() THEN
        RAISE EXCEPTION 'Creator is already a member';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.group_members
        WHERE group_id = target_group
        AND user_id = target_user
    ) THEN
        RAISE EXCEPTION 'Already a member';
    END IF;

    INSERT INTO public.group_invitations(
        group_id,
        inviter_id,
        invitee_id
    )
    VALUES (
        target_group,
        auth.uid(),
        target_user
    )
    ON CONFLICT (group_id, invitee_id)
    DO UPDATE SET
        status = 'pending',
        inviter_id = EXCLUDED.inviter_id,
        created_at = NOW(),
        responded_at = NULL
    RETURNING id INTO new_invitation_id;

    RETURN new_invitation_id;
END;
$$;

-- ============================================================
-- 10. ACCEPT OR DECLINE GROUP INVITATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.respond_group_invitation(
    invitation_id UUID,
    accept_invite BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    accepted_group UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required';
    END IF;

    UPDATE public.group_invitations
    SET status = CASE
            WHEN accept_invite THEN 'accepted'
            ELSE 'declined'
        END,
        responded_at = NOW()
    WHERE id = invitation_id
    AND invitee_id = auth.uid()
    AND status = 'pending'
    RETURNING group_id INTO accepted_group;

    IF accepted_group IS NULL THEN
        RAISE EXCEPTION 'Pending invitation not found';
    END IF;

    IF accept_invite THEN
        INSERT INTO public.group_members(group_id, user_id)
        VALUES (accepted_group, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

-- ============================================================
-- 11. LEAVE GROUP / REMOVE MEMBER
-- ============================================================

CREATE OR REPLACE FUNCTION public.remove_group_member(
    target_group UUID,
    target_user UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required';
    END IF;

    IF target_user <> auth.uid()
    AND NOT EXISTS (
        SELECT 1
        FROM public.groups
        WHERE id = target_group
        AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.groups
        WHERE id = target_group
        AND owner_id = target_user
    ) THEN
        RAISE EXCEPTION 'Creator must delete the group instead';
    END IF;

    DELETE FROM public.group_members
    WHERE group_id = target_group
    AND user_id = target_user;
END;
$$;

-- ============================================================
-- 12. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.busy_slots ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. SECURITY POLICIES
-- ============================================================

CREATE POLICY "participants read friendships"
ON public.friendships
FOR SELECT TO authenticated
USING (
    auth.uid() IN (requester_id, addressee_id)
);

CREATE POLICY "members read groups"
ON public.groups
FOR SELECT TO authenticated
USING (
    public.is_group_member(id, auth.uid())
    OR public.is_group_invitee(id, auth.uid())
);

CREATE POLICY "owners edit groups"
ON public.groups
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owners delete groups"
ON public.groups
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "members read membership"
ON public.group_members
FOR SELECT TO authenticated
USING (
    public.is_group_member(group_id, auth.uid())
);

CREATE POLICY "participants read invitations"
ON public.group_invitations
FOR SELECT TO authenticated
USING (
    invitee_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
    OR public.is_group_invitee(group_id, auth.uid())
);

-- Friends and group members can see busy/free availability.
-- This includes clicking a group member's profile.
CREATE POLICY "allowed users read busy slots"
ON public.busy_slots
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.are_friends(auth.uid(), user_id)
    OR public.shares_group(auth.uid(), user_id)
);

-- ============================================================
-- 14. PERMISSIONS
-- ============================================================

REVOKE ALL ON
    public.friendships,
    public.groups,
    public.group_members,
    public.group_invitations,
    public.busy_slots
FROM anon;

GRANT SELECT ON
    public.friendships,
    public.groups,
    public.group_members,
    public.group_invitations,
    public.busy_slots
TO authenticated;

GRANT UPDATE, DELETE ON public.groups TO authenticated;

REVOKE ALL ON FUNCTION
    public.are_friends(UUID, UUID),
    public.shares_group(UUID, UUID),
    public.is_group_member(UUID, UUID),
    public.is_group_invitee(UUID, UUID)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.are_friends(UUID, UUID),
    public.shares_group(UUID, UUID),
    public.is_group_member(UUID, UUID),
    public.is_group_invitee(UUID, UUID)
TO authenticated;

REVOKE ALL ON FUNCTION
    public.send_friend_request(TEXT),
    public.respond_friend_request(UUID, BOOLEAN),
    public.create_group(TEXT),
    public.invite_to_group(UUID, UUID),
    public.respond_group_invitation(UUID, BOOLEAN),
    public.remove_group_member(UUID, UUID)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.send_friend_request(TEXT),
    public.respond_friend_request(UUID, BOOLEAN),
    public.create_group(TEXT),
    public.invite_to_group(UUID, UUID),
    public.respond_group_invitation(UUID, BOOLEAN),
    public.remove_group_member(UUID, UUID)
TO authenticated;