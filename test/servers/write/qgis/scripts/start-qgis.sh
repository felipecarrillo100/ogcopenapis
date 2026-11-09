#!/bin/bash
# Replacement for the image's start-xvfb-nginx.sh: under Rosetta (amd64 image on
# Apple Silicon) `pidof /usr/bin/Xvfb` never matches, so the stock script loops forever.
# Same steps, without the pidof wait and without the embedded nginx.
rm -f /tmp/.X99-lock
/usr/bin/Xvfb :99 -ac -screen 0 1280x1024x16 +extension GLX +render -noreset >/dev/null 2>&1 &
sleep 2
exec spawn-fcgi -n -u www-data -g www-data -d /var/lib/qgis -P /run/qgis.pid -p 9993 -- /usr/lib/cgi-bin/qgis_mapserv.fcgi
