"""
invite_service.py

Handles creation and redemption of one-time (or limited-use) invite links.
Invite links grant reader access at series, manuscript, or draft scope.
Only owners can create invites for their scopes.
"""

from repositories.invite_repo import (
    create_invite,
    get_invite,
    redeem_invite,
    revoke_invite,
    get_invites_for_scope,
)
from repositories.access_repo import grant_access
from repositories.draft_repo import get_draft_by_id
from repositories.manuscript_repo import get_manuscript_by_id
from services.permission_service import can_manage
from datetime import datetime


def create_invite_link(owner_email, scope_type, scope_id, expires_days=7, max_uses=1):
    """
    Create an invite. Validates owner has management rights at the scope.

    scope_type: 'series' | 'manuscript' | 'draft'
    scope_id:   the _id of the relevant document
    expires_days: how long the link is valid (default 7)
    max_uses:   how many times it can be redeemed (default 1)

    Returns the invite token (caller builds the full URL).
    """
    # Resolve the series/manuscript context for permission check
    series_id     = scope_id if scope_type == "series"     else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if scope_type == "draft":
        draft = get_draft_by_id(scope_id)
        if not draft:
            raise ValueError("Draft not found.")
        manuscript_id = draft["manuscript_id"]

    if not can_manage(owner_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("You do not have owner rights at this scope.")

    invite = create_invite(
        created_by=owner_email,
        scope_type=scope_type,
        scope_id=scope_id,
        role="reader",
        expires_days=expires_days,
        max_uses=max_uses,
    )
    return invite["token"]


def redeem_invite_link(token, email):
    """
    Redeem an invite token for a logged-in user.
    Validates the token, checks expiry and use count, then writes the access grant.

    Returns a dict describing what access was granted, or raises on failure.
    """
    invite = get_invite(token)

    if not invite:
        raise ValueError("Invite not found.")

    if not invite.get("active"):
        raise ValueError("This invite link has been revoked.")

    if invite["expires_at"] < datetime.utcnow():
        raise ValueError("This invite link has expired.")

    if invite["uses"] >= invite["max_uses"]:
        raise ValueError("This invite link has already been fully redeemed.")

    if email in invite.get("redeemed_by", []):
        # Already redeemed by this user — idempotent, just return success
        return _describe_grant(invite)

    # Atomically claim a redemption slot
    result = redeem_invite(token, email)
    if not result:
        raise ValueError("This invite link is no longer valid.")

    # Write the access grant
    grant_access(
        email=email,
        scope_type=invite["scope_type"],
        scope_id=invite["scope_id"],
        role=invite["role"],
        granted_by=invite["created_by"],
    )

    return _describe_grant(invite)


def revoke_invite_link(token, owner_email):
    """Revoke an invite. Only the creator can revoke."""
    invite = get_invite(token)
    if not invite:
        raise ValueError("Invite not found.")
    if invite["created_by"] != owner_email:
        raise PermissionError("Only the invite creator can revoke it.")
    revoke_invite(token, owner_email)


def list_invites(owner_email, scope_type, scope_id):
    """List active invites for a scope. Owner only."""
    series_id     = scope_id if scope_type == "series"     else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if not can_manage(owner_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("Only owners can view invites.")

    invites = get_invites_for_scope(scope_type, scope_id)
    for inv in invites:
        inv["_id"] = str(inv["_id"])
        inv["created_at"] = inv["created_at"].isoformat()
        inv["expires_at"] = inv["expires_at"].isoformat()
    return invites


def _describe_grant(invite):
    return {
        "scope_type": invite["scope_type"],
        "scope_id":   invite["scope_id"],
        "role":       invite["role"],
    }
