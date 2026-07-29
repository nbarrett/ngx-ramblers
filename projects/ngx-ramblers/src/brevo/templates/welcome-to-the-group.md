### {{params.messageMergeFields.subject}}

{% if params.messageMergeFields.ADDRESS_LINE %}{{params.messageMergeFields.ADDRESS_LINE}}{% endif %}

{{params.messageMergeFields.BODY_CONTENT_TOP}}

Welcome to [{{params.systemMergeFields.APP_LONGNAME}}]({{params.systemMergeFields.APP_URL}}). We're really pleased you've joined us, and we hope to see you out on a walk before too long.

{% block WALKS_PROGRAMME_SECTION %}

#### The walks programme

Everything we've got coming up is on our [walks programme]({{params.systemMergeFields.APP_URL}}/walks). Use the quick search to find walks by leader, place or grade.

{{override.WALKS_PROGRAMME_IMAGE}}

{% endblock %}

{% block SOCIAL_EVENTS_SECTION %}

#### Social events

[Social events]({{params.systemMergeFields.APP_URL}}/social) covers our get-togethers away from the trail.

{{override.SOCIAL_PAGE_IMAGE}}

{% endblock %}

{% block KEEPING_IN_TOUCH_SECTION %}

#### Keeping in touch

The easiest way to reach us, whatever you need, is through our [contact us page]({{params.systemMergeFields.APP_URL}}/contact-us), where you'll find the right person to get in touch with.

From time to time we'll also email you about walks and social events. You can change what you receive, or stop the emails altogether, at any time using the links at the foot of any email we send. That keeps us in line with [GDPR](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/).

{% endblock %}

{{params.messageMergeFields.BODY_CONTENT_BOTTOM}}
