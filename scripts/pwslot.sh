#!/bin/zsh
# Waits for a free Playwright slot (slot1 or slot2), runs the given command in
# the given directory, and always releases the slot. Usage:
#   pwslot.sh <dir> <log> <command...>
# The lock directory is shared with the site's sessions, so the two-run cap holds across every repo on this Mac.
# PW_SLOTS_DIR overrides it if that convention ever moves.
SLOTS="${PW_SLOTS_DIR:-/private/tmp/claude-501/-Users-asulbaran21-Personal-Projects-Personal-Website/1c9e7db2-62bc-4db0-af9a-bd2cfcb919a3/scratchpad/pw-slots}"
mkdir -p "$SLOTS"
dir=$1; log=$2; shift 2
taken=""
while [ -z "$taken" ]; do
  for s in slot1 slot2; do
    if mkdir "$SLOTS/$s" 2>/dev/null; then taken=$s; echo $$ > "$SLOTS/$s/pid"; break; fi
    # Reclaim an orphaned lock: its owner is dead, or it never wrote a pid and is over 2 hours old.
    if [ -f "$SLOTS/$s/pid" ]; then
      owner=$(cat "$SLOTS/$s/pid" 2>/dev/null)
      if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then stale=1; else stale=0; fi
    elif [ -n "$(find "$SLOTS/$s" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then stale=1
    else stale=0; fi
    if [ "$stale" = 1 ]; then
      echo "reclaiming orphaned $s"
      rm -rf "$SLOTS/$s"
      if mkdir "$SLOTS/$s" 2>/dev/null; then taken=$s; echo $$ > "$SLOTS/$s/pid"; break; fi
    fi
  done
  [ -z "$taken" ] && sleep 15
done
trap '[ -n "$taken" ] && rm -rf "$SLOTS/$taken" 2>/dev/null && echo "released $taken"' EXIT
echo "took $taken at $(date +%H:%M:%S)"
cd "$dir" || exit 1
start=$(date +%s)
"$@" > "$log" 2>&1
code=$?
echo "exit $code after $(( $(date +%s) - start ))s"
exit $code
