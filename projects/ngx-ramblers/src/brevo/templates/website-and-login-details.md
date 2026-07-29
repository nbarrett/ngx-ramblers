### {{params.messageMergeFields.subject}}

{% if params.messageMergeFields.ADDRESS_LINE %}{{params.messageMergeFields.ADDRESS_LINE}}{% endif %}

{{params.messageMergeFields.BODY_CONTENT_TOP}}

Welcome to {{params.systemMergeFields.APP_LONGNAME}}!

This is the first email sent to you via our website, using [Brevo](https://www.brevo.com), the email automation system behind every [NGX-Ramblers](https://www.ngx-ramblers.org.uk) website.

This email shows the kind of communication you can expect from our group, and includes important information about your login details.

{% block FINDING_THE_SITE_SECTION %}

#### How can I find the {{params.systemMergeFields.APP_SHORTNAME}} site?

You can reach the {{params.systemMergeFields.APP_SHORTNAME}} site at: [{{params.systemMergeFields.APP_URL}}]({{params.systemMergeFields.APP_URL}})

Navigate to different pages by clicking the links in the navigation bar at the top. The yellow buttons at the very top link to other Ramblers websites.

{% endblock %}

{% block LOGIN_DETAILS_SECTION %}

#### Your {{params.systemMergeFields.APP_SHORTNAME}} login details

Most content on the {{params.systemMergeFields.APP_SHORTNAME}} site is publicly accessible. However, logging in as a member unlocks additional features. Committee members have extra permissions to administer the website and manage members.

{% endblock %}

{% block ACCOUNT_ACTIVATION_SECTION %}

#### Activating your {{params.systemMergeFields.APP_SHORTNAME}} account

I've set up a {{params.systemMergeFields.APP_SHORTNAME}} user profile for you. Note that this is completely separate from the [National Ramblers site](https://www.ramblers.org.uk) - these credentials only apply to {{params.systemMergeFields.APP_SHORTNAME}}.

To activate your login, click [Activate Your Account]({{params.systemMergeFields.PW_RESET_LINK}}).

You'll see a login popup where your User Name **{{params.memberMergeFields.USERNAME}}** will be pre-filled. Enter a **New Password** and **Confirm New Password**, then click **Confirm Reset**.

{% endblock %}

{% block LOGGING_IN_SECTION %}

#### Logging into the website

When not logged in, you'll see a "Login to {{params.systemMergeFields.APP_SHORTNAME}} Site" link at the top. Click it, enter your User Name **{{params.memberMergeFields.USERNAME}}** and password, then click Login.

{% endblock %}

{% block ADMIN_PAGE_SECTION %}

#### The Admin Page

Once logged in, you can manage your account from the [admin page]({{params.systemMergeFields.APP_URL}}/admin):

- [Update contact details]({{params.systemMergeFields.APP_URL}}/admin/profile/contact-details)
- [Change password]({{params.systemMergeFields.APP_URL}}/admin/profile/change-password)
- [Manage email subscriptions]({{params.systemMergeFields.APP_URL}}/admin/profile/email-subscriptions)

Any queries about the above or anything else, please don't hesitate to contact me.

{% endblock %}

{{params.messageMergeFields.BODY_CONTENT_BOTTOM}}
