#!/usr/bin/env bash
# Terminal launcher (same behavior as start.command):
# bash start.sh
exec "$(cd "$(dirname "$0")" && pwd)/start.command"
