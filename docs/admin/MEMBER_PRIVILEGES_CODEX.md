# Member Privileges Guide

This guide explains how to assign privileges to members in the NGX Ramblers system and what effect each privilege has on system behavior.

## Overview

Member privileges control access to different areas of the system and determine what actions members can perform. Privileges are assigned through the **Member Admin** interface under the **Privileges** tab.

## Accessing the Privileges Screen

1. Navigate to **Admin → Member Admin**
2. Select a member to edit
3. Click on the **Privileges** tab
4. Select or deselect privileges using the checkboxes
5. Click **Save** to apply changes

---

## Privilege Descriptions

### Basic Membership Status

#### Approved Group Member
**Field:** `groupMember`

**Purpose:** Enables member login access to the system

**Effect:**
- **Required** for members to log in to the system
- Without this privilege, login attempts will be blocked with the message: "Logins for member [username] have been disabled"
- This is the foundational privilege that must be set for any active member

**When to assign:**
- Assign to all active, paid-up members who should have access to the system
- Remove from members who should be denied access (e.g., lapsed membership, suspended accounts)

**Code reference:** `server/lib/mongo/controllers/auth-common.ts:39`

---

#### Approved Social Member
**Field:** `socialMember`

**Purpose:** Allows members to view detailed social event information

**Effect:**
- Enables viewing of full social event details
- Social events may have restricted visibility for non-social members

**When to assign:**
- Assign to members who participate in social events
- Typically assigned to most active members alongside "Approved Group Member"

**Code reference:** `projects/ngx-ramblers/src/app/services/member/member-login.service.ts:67-69`

---

#### Revoked Member
**Field:** `revoked`

**Purpose:** Historical/legacy field for marking revoked members

**Effect:**
- Currently stored in the database but **not actively enforced** in the current codebase
- The field exists in the member model but is not checked by authorization guards

**When to assign:**
- Not recommended for active use
- Use "Approved Group Member" (unchecked) instead to disable member access

**Code reference:** `projects/ngx-ramblers/src/app/models/member.model.ts:126`

---

### Administrative Privileges

#### Member Admin
**Field:** `memberAdmin`

**Purpose:** Controls access to member administration features

**Effect:**
- Grants access to the **Admin** section of the site
- Enables viewing and editing member records
- Allows access to:
  - Member Admin page (`/admin/member-admin`)
  - Member Login Audit page (`/admin/member-login-audit`)
  - Member Bulk Load page (`/admin/member-bulk-load`)
  - Mailing Preferences page (`/admin/mailing-preferences`)
  - System Settings page (`/admin/system-settings`)
  - Mailchimp Settings, Mail Settings, Committee Settings, Migration Settings
  - Page Content Navigator and Fragment Index
- Protects routes with `AdminAuthGuard`

**When to assign:**
- Assign to committee members responsible for managing memberships
- Typically assigned to Membership Secretary or similar roles
- Exercise caution as this gives broad administrative access

**Code reference:** `projects/ngx-ramblers/src/app/guards/admin-auth-guard.ts:9`

---

#### Content Admin
**Field:** `contentAdmin`

**Purpose:** Controls ability to edit website content and pages

**Effect:**
- Enables editing of page content, shared fragments, and site text
- Allows management of carousels, images, and content metadata
- Controls visibility of content editing tools throughout the site
- Grants access to:
  - Page editing interface
  - Shared fragment management
  - Carousel editor
  - Image management tools

**When to assign:**
- Assign to committee members or volunteers responsible for maintaining website content
- Typically assigned to Webmaster, Communications Officer, or similar roles
- Does not grant access to member data or system settings

**Code reference:**
- `projects/ngx-ramblers/src/app/services/member/member-login.service.ts:25-27`
- `projects/ngx-ramblers/src/app/services/content-metadata.service.ts:251`

---

#### Walk Admin
**Field:** `walkAdmin`

**Purpose:** Controls ability to create and edit group walks

**Effect:**
- Grants access to walk editing features
- Enables creation, modification, and deletion of walks
- Allows uploading of walks to Ramblers Walks Manager
- Protects walk editing routes with `WalksAuthGuard`
- Provides access to:
  - Walk creation/editing interface
  - Walk leader assignment
  - Walk upload to Ramblers

**When to assign:**
- Assign to Walk Coordinators and Walk Leaders
- Typically assigned to committee members responsible for walk programme management
- Consider assigning to active walk leaders who need to edit their own walks

**Code reference:** `projects/ngx-ramblers/src/app/guards/walks-auth-guard.ts:9`

---

#### Walk Change Notifications
**Field:** `walkChangeNotifications`

**Purpose:** Determines who receives email notifications when walks are modified

**Effect:**
- Members with this privilege receive automated email notifications when:
  - Walks are created, updated, or cancelled
  - Walk details are changed (date, time, meeting point, etc.)
  - Walk leaders are changed
- Notifications are sent to help coordinators track walk programme changes
- **Note:** This is a notification privilege only—it does not grant editing rights

**When to assign:**
- Assign to Walk Coordinators who need to be informed of all walk changes
- Typically assigned to 1-3 key walk coordinators
- Can be assigned independently of Walk Admin privilege

**Code reference:**
- `projects/ngx-ramblers/src/app/services/walks/walk-notification.service.ts:211-224`
- Emails sent to all members where `walkChangeNotifications === true`

---

#### Social Admin
**Field:** `socialAdmin`

**Purpose:** Controls ability to create and edit social events

**Effect:**
- Grants access to social event editing features
- Enables creation, modification, and deletion of social events
- Protects social event editing routes with `SocialAuthGuard`
- Provides access to:
  - Social event creation/editing interface
  - Social event attendance management
  - Social event notifications

**When to assign:**
- Assign to Social Secretary or Social Coordinators
- Typically assigned to committee members responsible for organizing social events
- Assign to volunteers who help organize social activities

**Code reference:** `projects/ngx-ramblers/src/app/guards/social-auth-guard.ts:11`

---

### Financial Privileges

#### Finance Admin
**Field:** `financeAdmin`

**Purpose:** Controls ability to approve expense claims

**Effect:**
- Grants access to expense claim approval features
- Enables viewing and approving/rejecting expense claims submitted by members
- Members with this privilege receive automated email notifications when:
  - New expense claims are submitted
  - Expense claims require approval
- Works in conjunction with Treasury Admin for complete expense workflow
- Provides access to expense claim management interface

**When to assign:**
- Assign to Treasurer or committee members authorized to approve expenses
- Typically assigned to 1-2 committee members
- Assign to those with budgetary oversight responsibility

**Code reference:**
- `projects/ngx-ramblers/src/app/services/member/member-login.service.ts:33-35`
- `projects/ngx-ramblers/src/app/services/expenses/expense-notification.service.ts:127`

---

#### Treasury Admin
**Field:** `treasuryAdmin`

**Purpose:** Controls ability to process approved expense payments

**Effect:**
- Grants access to payment processing for approved expense claims
- Enables marking expenses as paid and recording payment details
- Members with this privilege receive automated email notifications when:
  - Expense claims have been approved and are ready for payment
- Works alongside Finance Admin in the expense approval workflow
- Provides access to payment processing interface

**When to assign:**
- Assign to Treasurer or authorized payment processors
- Typically assigned to 1-2 committee members
- Should only be assigned to those with access to group bank account
- Often assigned to the same person as Finance Admin, but can be separate

**Code reference:**
- `projects/ngx-ramblers/src/app/services/member/member-login.service.ts:41-43`
- `projects/ngx-ramblers/src/app/services/expenses/expense-notification.service.ts:139`

---

### Committee and Document Management

#### Committee Member
**Field:** `committee`

**Purpose:** Grants access to committee-only areas and documents

**Effect:**
- Enables access to committee pages and private committee files
- Allows viewing of documents marked as "Committee Only"
- Unlocks committee-specific sections of the website
- Protects committee routes with `CommitteeAuthGuard`
- Filters visible files to include those restricted to committee members

**When to assign:**
- Assign to all elected committee members
- Assign to co-opted committee members
- May be assigned to other volunteers who need access to committee materials

**Code reference:**
- `projects/ngx-ramblers/src/app/guards/committee-auth-guard.ts:9`
- `projects/ngx-ramblers/src/app/services/committee/committee-query.service.ts:189`

---

#### File Admin
**Field:** `fileAdmin`

**Purpose:** Controls ability to upload and manage committee files and member resources

**Effect:**
- Grants ability to add, edit, and delete committee files (minutes, agendas, policies, etc.)
- Enables management of member resources (guides, forms, how-to documents)
- Allows sending of committee file notifications
- Controls file type configuration
- Provides access to:
  - Committee file upload/management
  - Member resource management
  - File visibility settings

**When to assign:**
- Assign to Secretary or Webmaster
- Assign to committee members responsible for maintaining documents
- Typically assigned to 1-3 committee members
- Often combined with Committee Member privilege

**Code reference:**
- `projects/ngx-ramblers/src/app/services/member/member-login.service.ts:45-47`
- `projects/ngx-ramblers/src/app/pages/committee/committee-display.service.ts:74-78`

---

## Common Privilege Combinations

### Standard Member
- ✓ Approved Group Member
- ✓ Approved Social Member

**Purpose:** Regular member with full access to public features

---

### Walk Leader
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ Walk Admin

**Purpose:** Member who can create and edit walks

---

### Walk Coordinator
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ Walk Admin
- ✓ Walk Change Notifications

**Purpose:** Coordinates walk programme and receives notifications of all walk changes

---

### Social Secretary
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ Social Admin
- ✓ Committee Member

**Purpose:** Manages social events and has access to committee materials

---

### Membership Secretary
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ Member Admin
- ✓ Committee Member

**Purpose:** Manages member records and has access to admin features

---

### Treasurer
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ Finance Admin
- ✓ Treasury Admin
- ✓ Committee Member

**Purpose:** Manages expense claims (approval and payment)

---

### Secretary
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ File Admin
- ✓ Committee Member

**Purpose:** Manages committee documents and minutes

---

### Webmaster / Chairman (Full Access)
- ✓ Approved Group Member
- ✓ Approved Social Member
- ✓ Content Admin
- ✓ Walk Admin
- ✓ Walk Change Notifications
- ✓ Social Admin
- ✓ Member Admin
- ✓ Finance Admin
- ✓ Treasury Admin
- ✓ File Admin
- ✓ Committee Member

**Purpose:** Full administrative access to all system features

---

## Security Best Practices

### Principle of Least Privilege
- Only assign privileges that are necessary for the member's role
- Regularly review member privileges and remove unnecessary access
- When members leave committee roles, update their privileges accordingly

### Audit Trail
- All member login activity is recorded in the Member Login Audit
- Member Admin users can view this audit at `/admin/member-login-audit`
- Changes to member records are tracked with timestamps and user identification

### Multiple Administrators
- Assign Member Admin to at least 2 people to avoid single points of failure
- Ensure Walk Admin is assigned to multiple walk coordinators
- Consider having backup administrators for critical roles

### Regular Reviews
- Review member privileges quarterly or when committee roles change
- Remove "Approved Group Member" from lapsed or resigned members
- Update privileges immediately when committee elections occur

---

## Troubleshooting

### Member Cannot Log In
**Check:** Is "Approved Group Member" selected?
- If unchecked, the member will be denied login access
- This is the most common cause of login issues

### Member Cannot See Admin Menu
**Check:** Does the member have at least one admin privilege?
- Member Admin, Content Admin, Walk Admin, Social Admin, or File Admin

### Member Not Receiving Walk Notifications
**Check:** Is "Walk Change Notifications" selected?
- This must be explicitly enabled to receive walk change emails
- Walk Admin alone does not trigger notifications

### Member Cannot Approve Expenses
**Check:** Is "Finance Admin" selected?
- This privilege is required to approve expense claims
- Treasury Admin is for payment processing, not approval

### Member Cannot Access Committee Files
**Check:** Is "Committee Member" selected?
- Files marked as "Committee Only" require this privilege
- File Admin allows editing but requires Committee Member to view restricted files

---

## Technical Notes

### Database Storage
All privileges are stored as boolean fields in the `members` collection in MongoDB:
```javascript
{
  groupMember: Boolean,
  socialMember: Boolean,
  revoked: Boolean,
  walkAdmin: Boolean,
  walkChangeNotifications: Boolean,
  socialAdmin: Boolean,
  memberAdmin: Boolean,
  contentAdmin: Boolean,
  financeAdmin: Boolean,
  treasuryAdmin: Boolean,
  fileAdmin: Boolean,
  committee: Boolean
}
```

### Authorization Mechanism
Privileges are checked at two levels:
1. **Route Guards:** Prevent unauthorized access to protected pages
2. **UI Controls:** Show/hide edit buttons and admin features based on logged-in member's privileges

### Privilege Cookie
When a member logs in successfully, their privileges are stored in a JWT token (MemberCookie) that contains:
- Member ID, name, username, postcode
- All boolean privilege flags
- This token is validated on each request to protected resources

**Code reference:** `server/lib/mongo/controllers/auth-common.ts:117-139`

---

## Related Documentation

- Member Admin Component: `projects/ngx-ramblers/src/app/pages/admin/member-admin/member-admin.component.ts`
- Authorization Guards: `projects/ngx-ramblers/src/app/guards/`
- Member Login Service: `projects/ngx-ramblers/src/app/services/member/member-login.service.ts`
- Member Model: `projects/ngx-ramblers/src/app/models/member.model.ts`

---

**Document Version:** 1.0
**Last Updated:** 2025-10-21
**Applies To:** NGX Ramblers System
