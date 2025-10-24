# Member Privileges Guide

Use this guide to assign the right privileges to members and understand what each checkbox changes in NGX‑Ramblers.

## Core Membership
- Approved Group Member
  - Marks the person as an active group member (member.groupMember).
  - Included in member lists and email segments that target the full group.
  - Required for Committee Member and Social Member lists.
- Approved Social Member
  - Marks the person as a social member (member.socialMember).
  - Enables Social detail views for logged‑in members.
  - Used for email audience selection when targeting social members.
- Revoked Member
  - Excludes this person from automated updates and bulk changes (CSV updates skip revoked).
  - Use when someone leaves the group or should no longer receive communications.

## Administrator Roles
- Content Admin
  - Can edit website content (Markdown pages, fragments, site edit modes).
- Walk Admin
  - Can create and manage Walks (group walks, updates).
- Walk Change Notifications
  - Receives coordinator emails for walk create/update/cancel events.
- Social Admin
  - Can create and manage Social events.
- Member Admin
  - Can manage members and privileges via Member Admin screens.
- Finance Admin
  - Receives approval emails for expense claims.
- Treasury Admin
  - Receives payment emails for expense claims (post‑approval).
- File Admin
  - Can upload and manage Committee files (documents, minutes, assets).
- Committee Member
  - Shows the person in committee listings; used for committee visibility and access.

## How Permissions Are Applied
- Logged‑in checks
  - The app reads a logged‑in member profile and gates features accordingly:
    - Content Admin → content editing
    - Walk Admin → walk editing
    - Social Admin → social editing
    - Member Admin → member admin edits
    - Finance Admin / Treasury Admin → expense notifications
    - File Admin / Committee → committee files and visibility
    - Social Member → view social details
- Email notifications
  - Walk changes → members with Walk Change Notifications.
  - Expense approvals → Finance Admin.
  - Expense payments → Treasury Admin.
- Lists and filters
  - Committee lists → Approved Group Member + Committee Member.
  - Social lists → Approved Group Member + Approved Social Member.

## Recommended Patterns
- Core membership: Grant Approved Group Member to active members; add Approved Social Member for social communications.
- Committee: Add Committee Member; layer File Admin for document maintenance.
- Walks: Use Walk Admin for editors; add Walk Change Notifications for coordinators.
- Offboarding: Set Revoked Member when a person leaves; remove other privileges if access must be removed.

## Quick Reference
- View social details: Approved Social Member
- Edit content: Content Admin
- Edit walks: Walk Admin
- Edit social events: Social Admin
- Manage members: Member Admin
- Receive walk change emails: Walk Change Notifications
- Expense approvals: Finance Admin
- Expense payments: Treasury Admin
- Manage committee files: File Admin
- Show in committee listings: Committee Member
- Suppress updates: Revoked Member
