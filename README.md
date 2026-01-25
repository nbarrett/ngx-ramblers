![NGX-Ramblers Logo](https://ngx-ramblers.org.uk/api/aws/s3/logos/21b1e74f-f0f0-4ad3-9bf4-6d894ed02fcd.png)

# Welcome to NGX-Ramblers!

![Deploy to Fly.io (main)](https://github.com/nbarrett/ngx-ramblers/actions/workflows/build-push-and-deploy-ngx-ramblers-docker-image.yml/badge.svg?branch=main)
![Pre-main Build & Tests](https://github.com/nbarrett/ngx-ramblers/actions/workflows/build-push-and-deploy-ngx-ramblers-docker-image.yml/badge.svg?branch=pre-main)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/nbarrett/ngx-ramblers)](https://github.com/nbarrett/ngx-ramblers/issues)

[NGX-Ramblers](https://ngx-ramblers.org.uk/) is a [completely free and open-source framework](https://github.com/nbarrett/ngx-ramblers) for building Local Ramblers Group websites using the latest Ramblers Branding, without the webmaster needing technical or programming skills. It's the culmination of over 10 years voluntary work by members of [Kent Ramblers](https://ngx-ramblers.org.uk/how-to/committee/editing-content/example-pages/site-migrations/kent-ramblers), but is free to use by any other group.

- You can see some examples of existing websites that have been built using NGX-Ramblers see [here](https://www.ekwg.co.uk/) and [here](https://www.canterburyramblers.org.uk/).
  - An example of an area website is [here](https://www.kent.ngx-ramblers.org.uk).

- Visit the [Project website](https://ngx-ramblers.org.uk/) and have a look around to find out more. The site acts as the documentation centre for the project as well as showing many example pages that show the kind of content you can create.
- You may be interested to note that all the content you see on this site was created using [NGX-Ramblers](https://ngx-ramblers.org.uk/)!
- Explore the [Codebase Evolution snapshot](https://rawcdn.githack.com/nbarrett/ngx-ramblers/main/codebase-evolution-stats.html) (or open `codebase-evolution-stats.html` locally) for interactive charts covering the 13-year development journey.

## What does NGX-Ramblers do?

- [NGX-Ramblers](https://ngx-ramblers.org.uk/) provides a way to create a website for your group without your webmaster _ever needing to do any programming at all_. Yes, you read that right! You will be able to build any aspect of your group’s website _without ever having to write a single line of HTML, Javascript or CSS_!
- You will be able to add any number of pages to your site to any nesting depth, and on these pages you will be able to add and format text, images, action buttons, and albums using an advanced content management system that will automatically produce pages that embody the new Ramblers Brand.
- All page, text and image changes can be made in real-time to the live running site and software releases are not required to be applied by webmasters in order to put changes live.

## How can it help my group?

- NGX-Ramblers features comprehensive but user-friendly Admin and Committee modules that sit above the technical aspects of the solution.
- These modules allow Webmasters and Committee members to manage the website content, group members, walks and social events, committee information, and all aspects of group to member email communication, but without needing to understand the technology that underpins these functions.

## What Third Party Systems can NGX-Ramblers connect to?

There are a mature set of server-side APIs to third party systems and social media platforms used by the Ramblers community. These include:

- [Ramblers Walks Manager](https://walks-manager.ramblers.org.uk/walks-manager) — for listing walks and groups. For publishing walks in CSV format.
- [Ramblers Insighthub](https://insight.ramblers.org.uk/) — for importing member data and email lists.
- [Facebook](https://www.facebook.com/) — feed plugin for recent posts and likes.
- [Instagram](https://www.instagram.com/) — recent image posts feed.
- [Meetup](https://www.meetup.com/) — publishing of walks and venues, listing of events.
- [Mailchimp](https://mailchimp.com/) or [Brevo](https://www.brevo.com/) — synchronisation of mailing lists from member data, sending of transactional and campaign emails to members.
- [Google Maps](https://developers.google.com/maps) — visualisation of walk start and endpoints, driving directions from home to walks. Requires API key.
- [OpenStreetMaps](https://www.openstreetmap.org/) / [OS Maps](https://osdatahub.os.uk/) — map views of walks, editing of routes, GPX authoring, and OS basemap overlays throughout walk planning workflows. OS Maps requires API key.

### Geocoding & Location Services (no API keys required)

- [postcodes.io](https://postcodes.io/) — UK postcode lookup, reverse geocoding (coordinates to postcode), and grid reference calculation.
- [Nominatim](https://nominatim.openstreetmap.org/) — OpenStreetMap's geocoding service for place name search and address lookup with UK filtering.

## Why the name NGX-Ramblers?

The NGX-prefix is there because the web framework that underlies the [NGX-Ramblers](https://ngx-ramblers.org.uk/) project is called [Angular](https://angular.dev/) and ngx is the prefix traditionally used when an angular component or library is created and made available to the wider community. However, as a webmaster or committee member, you don't need to worry about this or anything to do with angular at all. [NGX-Ramblers](https://ngx-ramblers.org.uk/) has been designed in such a way that you only ever need to interact with user-friendly admin screens and pages _built_ by angular so all of the technical sophistication will be hidden away!

## How-To?

There's a comprehensive [How-To](https://ngx-ramblers.org.uk/how-to/committee) documentation area on the [NGX-Ramblers](https://ngx-ramblers.org.uk/) website that will guide you through all aspects of managing your group website. This includes how to create and edit pages, add and format text, images, action buttons, and albums, manage group members, walks and social events, committee information, and all aspects of group to member email communication.

## Technologies used by NGX-Ramblers
You don't need to understand any of these technologies to use NGX-Ramblers, but if you're interested, here's a list of the main technologies used in the project:
- [Angular 20](https://angular.dev/) with [RxJS](https://rxjs.dev/) and [es-toolkit](https://github.com/es-toolkit/es-toolkit) — the modern frontend stack powering all modules.
- [PrimeNG](https://primeng.org/), [PrimeIcons](https://primeng.org/icons), [PrimeUIX](https://primeng.org/uix), and [ngx-bootstrap](https://valor-software.com/ngx-bootstrap) — component suites layered on top of [Bootstrap 5](https://getbootstrap.com/) and custom Sass tokens.
- [Leaflet](https://leafletjs.com/), [@bluehalo/ngx-leaflet](https://www.bluehalo.com/), [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster), [proj4](https://proj.org/), and [proj4leaflet](https://github.com/kartena/Proj4Leaflet) — geospatial rendering for walks, routes, and start locations.
- [Chart.js](https://www.chartjs.org/) with [ng2-charts](https://valor-software.com/ng2-charts/) — analytics and insight visualisations.
- [Luxon](https://moment.github.io/luxon/), [heic2any](https://github.com/alexcorvi/heic2any), and [papaparse](https://www.papaparse.com/) — scheduling, media conversion, and CSV workflows.
- [ngx-markdown](https://github.com/jfcere/ngx-markdown), [marked](https://marked.js.org/), and [turndown](https://github.com/mixmark-io/turndown) — markdown ingestion, conversion, and publishing.
- [ng-gallery](https://ngx-gallery.netlify.app/), [ng2-file-upload](https://valor-software.com/ng2-file-upload/), [ngx-image-cropper](https://github.com/Mawi137/ngx-image-cropper.git), [ngx-tagify](https://github.com/Brakebein/ngx-tagify), and [ngx-capture](https://github.com/Wanchai/ngx-capture) — media creation and management.
- [AWS S3](https://aws.amazon.com/pm/serv-s3/) — storage for media, documents, and generated exports.
- [MongoDB Atlas](https://www.mongodb.com/lp/cloud/atlas/try4) with [mongoose](https://mongoosejs.com/) — persistence for all structured data.
- [Express](https://expressjs.com/), [method-override](https://www.npmjs.com/package/method-override), [winston](https://github.com/winstonjs/winston), and supporting middleware — the Node.js backend API layer.

## Contact Us

If you'd like to discuss whether [NGX-Ramblers](https://ngx-ramblers.org.uk/) could be a fit for your group send an email to [info@ngx-ramblers.org.uk](mailto:info@ngx-ramblers.org.uk) and we'll get straight back to you.
Our current deployment approach is to host your website for you and migrate existing content from your current group website to kick start your new site. But we can also discuss self-hosting options as well if that's the way you want to proceed.
