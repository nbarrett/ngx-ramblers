# Self-hosted Jitsi for NGX-Ramblers video meetings

NGX video meetings (see issue #357) embed [Jitsi Meet](https://jitsi.org/) via its iframe
External API when the host is **ours**. The public `meet.jit.si` instance no longer allows
production embedding: an iframe call is treated as a demo and Jitsi ends it after five
minutes. With no host configured, NGX therefore opens the room on Jitsi's own page instead
(unlimited, but it is their site and their Google/GitHub login). This directory is what you
need for meetings that stay inside NGX with no time limit.

## How NGX chooses where meetings run

NGX resolves the Jitsi host with the same one-value toggle the integration worker uses for
`INTEGRATION_WORKER_URL` (see `server/lib/video-meetings/video-meetings-config.ts`):

| Mode | What is set | Media server |
| --- | --- | --- |
| Default | nothing | Jitsi's public page (`meet.jit.si`), not an embed |
| Local dev | `JITSI_HOST_URL=https://localhost:8443` (or System Settings → Video → host URL) | this docker stack on your machine |
| Self-hosted | `JITSI_HOST_URL=https://ngx-ramblers-jitsi.fly.dev` | the `ngx-ramblers-jitsi` app |

When `JITSI_JWT_APP_ID` and `JITSI_JWT_APP_SECRET` are also set on the NGX server, NGX issues a
signed JWT per meeting so members join with enforced identity and committee members become
moderators, with no separate Jitsi sign-in. Those two values must match `JWT_APP_ID` /
`JWT_APP_SECRET` here.

## Local development

```bash
cd jitsi
cp .env.example .env
# set JWT_APP_SECRET and the JICOFO/JVB secrets to long random values
docker compose up -d
```

Then set `JITSI_HOST_URL=https://localhost:8443` in `server/.env` (and the matching
`JITSI_JWT_APP_ID` / `JITSI_JWT_APP_SECRET`), restart the NGX server, and open
`/video-meetings`. Two browser tabs joining the same room proves the stack end to end; the
one thing localhost cannot exercise is cross-network NAT traversal.

Two macOS / Docker Desktop notes so the first call actually connects:

- **Accept the self-signed certificate once.** The web container serves `https://localhost:8443`
  with a self-signed cert. Visit that URL directly in the browser and accept it before opening
  `/video-meetings`, otherwise the embedded `external_api.js` fails to load.
- **Set `DOCKER_HOST_ADDRESS` so media flows.** On Docker Desktop the video bridge cannot
  auto-detect a reachable IP, so participants join but see no audio/video. Set
  `DOCKER_HOST_ADDRESS` in `jitsi/.env` to your machine's LAN IP (`ipconfig getifaddr en0`) and
  `docker compose up -d` again.

`docker compose down` stops it; the generated config lives under `$CONFIG` (default
`~/.jitsi-meet-cfg`).

## Live verification procedure

Everything in #357 is built, compiles, lints, and is unit-tested. The items below are the
things that can only be proven on a running self-hosted stack. This is the repeatable
procedure; do the Local development setup above first.

Each check is tagged:

- **[driven]** — can be verified headlessly against the running stack (a second browser tab, the
  API, the DB, a 375px viewport). No physical hardware needed.
- **[human]** — needs real hardware or a real third party (a second device, a phone, a mail
  client, Brevo delivery, two people with cameras). Nothing but a person can stand in for these.

Prerequisites: docker stack up, `JITSI_HOST_URL=https://localhost:8443` plus the two
`JITSI_JWT_*` values set in `server/.env`, the NGX server restarted, logged in to NGX as a
**committee** member. Confirm the wiring first:

```
GET /api/video-meetings/config
→ expect { enabled:true, host:"https://localhost:8443", publicHost:false, jwtRequired:true, ... }
```

`publicHost:false` and `jwtRequired:true` is the whole point: it means NGX will embed the call
and issue a JWT, not redirect to the public page.

### B. JWT identity + committee moderator  [driven] + [human confirm]

1. Open `admin/video-meetings` → **Start a meeting now**.
2. Expect the call to **embed inside NGX** (an iframe), not redirect to another site.
3. Your name in the call is your NGX member name, with no second sign-in.
4. As a committee member you have moderator powers (mute others, kick, control lobby).

Cross-checks (driven):
- `POST /api/video-meetings/token {room}` → `{ token:<jwt>, moderator:true }`. Decode the JWT:
  `context.user.name` = your member name, `context.user.moderator` = `"true"`.
- Repeat logged in as a **non-committee** member → `moderator:false`.

Pass: embedded (not redirected), correct identity, committee = moderator, non-committee = not.

### C. Guest access + email invite  [driven link] + [human email]

1. In a call → **Invite a guest by email**, enter an address.
2. If Brevo is configured: `{ sent:true, link }` and the guest receives the email **[human:**
   **check a real inbox]**. If not configured: `{ sent:false, link }` and the copyable link is
   shown — that graceful fallback is itself a pass.
3. Open the returned link in a **fresh browser with no NGX login** → joins the room as a
   **non-moderator** guest [driven].

Pass: guest joins via the link with no NGX account and has no moderator controls; the emailed
path is confirmed once against a real inbox.

### D/E. Shared notes persistence  [driven, writes to DB]

1. In a call, open the notes panel, type a note, save.
2. Reload the room. The note is still there.
3. Confirm the `meetingNotes` collection holds the record, tagged source `member`.

Pass: notes survive a reload and a server round-trip. **Note:** this writes to whatever Mongo
`server/.env` targets — run it against a dev/local DB, or accept a couple of test rows in the
remote cluster and delete them after.

### F. Mobile layout  [driven 375px] + [human device]

1. Resize the viewport to 375px wide. Expect: full-screen call (`100dvh`, safe-area insets),
   notes and invite as **bottom sheets** (not side panels), controls ≥44px, labels collapsed to
   icons [driven].
2. Repeat on a **real phone** over the LAN (camera/mic permission, rotation, a real call) [human].

Pass: the 375px layout is correct headlessly, and a real handset can join and hold a call.

### J. Committee agenda + `.ics` + calendar event  [driven] + [human mail client]

1. `admin/video-meetings/plan` → pick a date → choose a committee meeting type (AGM / Committee
   Meeting). With AI on (`AI_ENABLED=true`), an agenda is drafted from the latest matching
   Minutes, including a matters-arising/carryover section [driven].
2. Planning creates a `CommitteeFile` with `eventDate` → it appears on the plan calendar **and**
   the committee documents page [driven].
3. `GET /api/calendar/meeting/:room` → a `METHOD:REQUEST` `.ics` with the committee secretary as
   organiser [driven — fetch and eyeball the VEVENT].
4. Send the invite → the `.ics` is attached, and it opens as an **add-to-calendar** invite in a
   real mail client (Apple Mail / Gmail) [human].

Pass: agenda generated, committee event on the calendar, valid `.ics` from the endpoint, and the
attachment adds to a real calendar.

### L. AI minutes from a transcript  [driven seeded] + [human real call]

1. Seeded (driven): `POST /api/video-meetings/minutes` with a sample `{ room, transcript, chat }`.
   Expect a single AI note saved (author `AI notes`); posting again **replaces** it; any
   hand-written notes are preserved and folded in.
2. Real (human): on an actual call with transcription enabled, let the capture build, hit
   **Write notes now** (and confirm the ~3-minute auto-write), and read the generated minutes for
   sense.

Pass: seeded minutes generate and de-duplicate correctly; a real transcript produces sensible
minutes.

### K. Multi-participant call  [driven join] + [human media]

1. Join the room from two or more browser tabs → all appear in the participants pane,
   tile/gallery view updates [driven].
2. A genuine two-device call with real audio/video between two people [human].

Pass: multiple participants share a room and see each other; real media flows between two devices.

### Which checks can be automated

The **[driven]** rows can all be verified headlessly against the running stack: config wiring,
JWT decode + moderator matrix, guest-link join, notes persistence, 375px layout, agenda +
`.ics` fetch + committee-event-on-calendar, and seeded AI minutes. Only the **[human]** rows —
a real inbox, a real phone, a real mail-client `.ics`, and real two-person media — need a person.

## Self-hosting on Fly

Managed entirely from **Global Settings → Video Meetings** in the admin UI and deployed by
`../server/deploy/deploy-jitsi.ts` (and the manual `Deploy Self-Hosted Jitsi` GitHub workflow),
the same config-driven pattern as the integration worker.

- **`Dockerfile`** builds a combined single-container image: it bases on the official
  `jitsi/prosody` image and grafts the web (nginx), jicofo and jvb services onto it, so Fly's
  one-container-per-machine model is satisfied and the standard s6 `/init` runs all four,
  driven by environment variables. `../fly.jitsi.toml` builds this image (Fly's edge terminates
  TLS and forwards to nginx on port 80) and exposes UDP 10000 for the video bridge.
- **`deploy-jitsi.ts`** reads the Video Meetings config, ensures the app and a dedicated IPv4
  exist, and injects the secrets and host-specific values (`PUBLIC_URL`, `JVB_ADVERTISE_IPS`,
  `JWT_APP_SECRET`, plus everything in the global secrets map). The standard non-secret config
  (XMPP domains, `localhost` wiring, JWT app id) is baked into the image.
- **Required secrets** (set once in Global Settings → GitHub Secrets, so the deploy injects
  them): `JICOFO_COMPONENT_SECRET`, `JICOFO_AUTH_PASSWORD`, `JVB_AUTH_PASSWORD` (generate with
  `docker run --rm jitsi/base:stable gen-passwords.sh`), plus the Video Meetings JWT secret.

The combined image has been verified locally end to end: all four services start and
authenticate, the web front end serves, an NGX-issued JWT is accepted, and a 3-participant
call negotiates media through jvb over UDP 10000 (`docker build jitsi/ -f jitsi/Dockerfile`
then run with the secrets, and join the room from a few browser tabs). If UDP proves painful
on Fly, Jitsi falls back to TCP 443, which is fine for small infrequent calls.

`docker-compose.yml` remains the simplest route on a plain Docker host / small VM.
