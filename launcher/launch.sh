#!/bin/bash
# Launchers made by an older `npm run setup` run this; it hands over to launch.mjs.
exec node "$(dirname "$0")/launch.mjs"
