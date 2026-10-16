#!/bin/bash
# Install / remove the Paper Assistant desktop integration:
#   .desktop launcher (app menu, Dock), icons, systemd --user background server (needed for reminder notifications).
# Usage: bash app/install.sh           install
#        bash app/install.sh --remove  remove
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
ID="io.github._47zzz.PaperAssistant"
PY="$(command -v python3)"
APPS="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor"
UNITS="$HOME/.config/systemd/user"
SVC="paper-assistant-server.service"

if [[ "${1:-}" == "--remove" ]]; then
  systemctl --user disable --now "$SVC" 2>/dev/null || true
  rm -f "$UNITS/$SVC" "$APPS/$ID.desktop" "$ICONS/256x256/apps/$ID.png" "$ICONS/128x128/apps/$ID.png" "$ICONS/scalable/apps/$ID.svg" "$HOME/.config/autostart/$ID.desktop"
  systemctl --user daemon-reload 2>/dev/null || true
  update-desktop-database "$APPS" 2>/dev/null || true
  echo "Desktop integration removed. The folder $ROOT was left untouched."
  exit 0
fi

mkdir -p "$APPS" "$ICONS/256x256/apps" "$ICONS/128x128/apps" "$ICONS/scalable/apps" "$UNITS"

# ---- desktop entry
sed -e "s|@ROOT@|$ROOT|g" -e "s|@PY@|$PY|g" -e "s|@ID@|$ID|g" "$HERE/paper-assistant.desktop" > "$APPS/$ID.desktop"
chmod 644 "$APPS/$ID.desktop"
command -v desktop-file-validate >/dev/null && desktop-file-validate "$APPS/$ID.desktop" || true

# ---- icons
install -Dm644 "$HERE/icon-256.png" "$ICONS/256x256/apps/$ID.png"
install -Dm644 "$HERE/icon-128.png" "$ICONS/128x128/apps/$ID.png"
install -Dm644 "$HERE/icon.svg" "$ICONS/scalable/apps/$ID.svg"
touch "$ICONS"
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -f -t "$ICONS" 2>/dev/null || true
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" 2>/dev/null || true

# ---- systemd user service (backend always on → reminders fire even when the window is closed)
sed -e "s|@ROOT@|$ROOT|g" -e "s|@PY@|$PY|g" "$HERE/paper-assistant-server.service" > "$UNITS/$SVC"
systemctl --user daemon-reload
systemctl --user enable --now "$SVC"
sleep 1
if systemctl --user is-active --quiet "$SVC"; then
  echo "✔ Server service started (systemctl --user status $SVC)"
else
  echo "✘ Server service failed to start: journalctl --user -u $SVC -e"
fi
echo "✔ Launcher installed: $APPS/$ID.desktop (search for \"Paper Assistant\" in the app menu)"
echo "✔ Icons installed."
echo "Test a notification: $PY $HERE/notify.py"
