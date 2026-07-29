### {{params.messageMergeFields.subject}}

{% if params.messageMergeFields.ADDRESS_LINE %}{{params.messageMergeFields.ADDRESS_LINE}}{% endif %}

{{params.messageMergeFields.BODY_CONTENT_TOP}}

We've noticed that the Ramblers membership expiry date we have in our records for you has now passed, or Ramblers have stopped sending us your monthly member data. This email is therefore to notify you that we'll need to now remove you from our mailing lists in order to comply with GDPR regulations.

For your information, the membership data we have on file for you is as follows:

**Membership Id:** {{params.memberMergeFields.MEMBER_NUM}}

**Expiration Date:** {{params.memberMergeFields.MEMBER_EXP}}

If you intended for your {{params.systemMergeFields.APP_SHORTNAME}} membership to expire or be moved to another group, then no action needs to be taken by you. However, if you would like to renew your Ramblers membership or transfer your membership with another group back to {{params.systemMergeFields.APP_SHORTNAME}}, then please see the [join us]({{params.systemMergeFields.APP_URL}}/join-us) section on our website.

If you have any questions please don't hesitate to email me using the address below.

{{params.messageMergeFields.BODY_CONTENT_BOTTOM}}
