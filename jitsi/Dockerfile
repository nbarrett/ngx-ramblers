FROM jitsi/web:stable AS web
FROM jitsi/jicofo:stable AS jicofo
FROM jitsi/jvb:stable AS jvb

FROM jitsi/prosody:stable

RUN groupadd -g 1000 jitsi \
  && useradd -u 999 -g jitsi -M -s /usr/sbin/nologin jicofo \
  && useradd -u 998 -g jitsi -M -s /usr/sbin/nologin jvb \
  && usermod -aG jitsi prosody

ENV XMPP_SERVER=localhost \
    XMPP_BOSH_URL_BASE=http://localhost:5280 \
    XMPP_DOMAIN=meet.jitsi \
    XMPP_AUTH_DOMAIN=auth.meet.jitsi \
    XMPP_MUC_DOMAIN=muc.meet.jitsi \
    XMPP_INTERNAL_MUC_DOMAIN=internal-muc.meet.jitsi \
    XMPP_GUEST_DOMAIN=guest.meet.jitsi \
    XMPP_RECORDER_DOMAIN=recorder.meet.jitsi \
    ENABLE_XMPP_WEBSOCKET=1 \
    ENABLE_AUTH=1 \
    ENABLE_GUESTS=0 \
    AUTH_TYPE=jwt \
    JWT_APP_ID=ngx-ramblers \
    JWT_ACCEPTED_ISSUERS=ngx-ramblers \
    JWT_ACCEPTED_AUDIENCES=ngx-ramblers \
    JVB_PORT=10000 \
    JVB_BREWERY_MUC=jvbbrewery \
    JICOFO_AUTH_USER=focus \
    JVB_AUTH_USER=jvb \
    TZ=Europe/London

RUN apt-get update \
  && apt-get install -y --no-install-recommends default-jre-headless nginx-extras \
  && rm -rf /var/lib/apt/lists/*

COPY --from=web /usr/share/jitsi-meet /usr/share/jitsi-meet
COPY --from=web /defaults /defaults
COPY --from=web /etc/services.d/nginx /etc/services.d/nginx
COPY --from=web /etc/cont-init.d/10-config /etc/cont-init.d/10-config-web

COPY --from=jicofo /usr/share/jicofo /usr/share/jicofo
COPY --from=jicofo /etc/jitsi/jicofo /etc/jitsi/jicofo
COPY --from=jicofo /defaults /defaults
COPY --from=jicofo /etc/services.d/jicofo /etc/services.d/jicofo
COPY --from=jicofo /etc/cont-init.d/10-config /etc/cont-init.d/10-config-jicofo

COPY --from=jvb /usr/share/jitsi-videobridge /usr/share/jitsi-videobridge
COPY --from=jvb /etc/jitsi/videobridge /etc/jitsi/videobridge
COPY --from=jvb /defaults /defaults
COPY --from=jvb /etc/services.d/jvb /etc/services.d/jvb
COPY --from=jvb /etc/cont-init.d/10-config /etc/cont-init.d/10-config-jvb

COPY jitsi/docker/99-fix-config-perms /etc/cont-init.d/99-fix-config-perms
RUN chmod +x /etc/cont-init.d/99-fix-config-perms

EXPOSE 80 443 10000/udp
