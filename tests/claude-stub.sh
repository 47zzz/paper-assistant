#!/bin/bash
# Test stand-in for the claude CLI.
#  - no arguments (the plain "Claude console"): behave like a shell so the console tests can run commands
#  - with arguments (survey / reading assistant): print them, then echo whatever is typed, staying alive like Claude Code
if [ $# -eq 0 ]; then exec bash; fi
printf 'ASSISTANT_STUB args: %s\n' "$*" | head -c 300; echo
printf 'LAST_ARG: %s\n' "${@: -1}" | head -c 400; echo
exec cat
