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

Clicking on the button.When `JITSI_JWT_APP_ID` and `JITSI_JWT_APP_SECRET` are also set on the NGX server, NGX issues a
signed JWT per meeting so members join with enforced identity and committee members become
moderators — no separate Jitsi sign-in. Those two values must match `JWT_APP_ID` /
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

`docker compose down` stops it; the generated config lives under `$CONFIG` (default
`~/.jitsi-meet-cfg`).

## Self-hosting on Fly (honest status)

`../fly.jitsi.toml` and `../server/deploy/deploy-jitsi.ts` scaffold a dedicated
`ngx-ramblers-jitsi` Fly app, deployed through the same config-driven tooling as the
integration worker. **This is a starting point, not a finished one-command deploy.** Jitsi is
a four-container stack (web, prosody, jicofo, jvb) and Fly runs one container per machine, so
a production Fly deployment needs either a combined single-container image or Fly process
groups, plus a dedicated IPv4 with UDP 10000 exposed and `JVB_ADVERTISE_IPS` set to that IP.
The `docker-compose.yml` here is the proven route and runs unchanged on any Docker host (a
small VM is often the least-effort self-host). Budget some trial-and-error for the Fly path;
if UDP proves painful, Jitsi falls back to TCP 443, which is fine for small infrequent calls.
