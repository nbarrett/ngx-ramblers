### {{params.messageMergeFields.subject}}

{% if params.messageMergeFields.ADDRESS_LINE %}{{params.messageMergeFields.ADDRESS_LINE}}{% endif %}

{{params.messageMergeFields.BODY_CONTENT_TOP}}

We take photographs and video on walks and events to show what {{params.systemMergeFields.APP_SHORTNAME}} does, on our website, Facebook page, newsletters and noticeboards. You can opt out of appearing in those if you would rather not.

That setting is on your {{params.systemMergeFields.APP_SHORTNAME}} website profile. You need a website login to change it. That login is only for this group's site, not the national Ramblers website.

{% block ALREADY_HAVE_A_LOGIN_SECTION %}

#### If you already have a login

Open [Photos and video]({{params.systemMergeFields.APP_URL}}/admin/profile/photos-and-video). You will be asked to sign in if you are not already.

{% endblock %}

{% block NEVER_LOGGED_IN_SECTION %}

#### If you have never logged in

You will need to set a password first. Click [Set a password]({{params.systemMergeFields.PW_RESET_LINK}}?redirect=/admin/profile/photos-and-video). After that you can confirm your profile, including this preference.

{% endblock %}

{{params.messageMergeFields.BODY_CONTENT_BOTTOM}}
