# Using the library from another computer (optional)

This guide is for an agent helping the user reach their Paper Assistant from a second computer. Read it with the user; every value in angle brackets is theirs to supply. The library itself keeps running on the computer where the repository is cloned ("the library computer"); the other machine ("your computer") only opens a browser window.

## How it works

The server accepts connections from the library computer itself only (`127.0.0.1:8765`) and has no login, so it is deliberately not reachable from the network. The launcher on your computer does two things:

1. opens an SSH tunnel that forwards the library computer's port 8765 to `localhost:8765` on your computer;
2. opens a browser window in app mode on `http://localhost:8765/?remote=1`.

```
your computer                                            library computer
browser window ── localhost:8765 ══ SSH tunnel ══▶ 127.0.0.1:8765  Paper Assistant server
                               (<library-host>:<ssh-port>)
```

| Item | Value |
|---|---|
| SSH host of the library computer | `<library-host>` (an IP or host name reachable from your computer: same LAN, a VPN such as Tailscale/WireGuard, or a port forward the user already has) |
| SSH port | `<ssh-port>` (22 unless the user changed it) |
| SSH user on the library computer | `<user>` |
| Paper Assistant port | `8765` (or whatever `PAPER_ASSISTANT_PORT` is) |

Steps 0–4 are done once. Afterwards the user double-clicks an icon.

**What the agent should establish with the user before starting**

- Is SSH already possible from your computer to the library computer (`ssh <user>@<library-host> -p <ssh-port>`)? If not, that is the user's network/firewall decision, not something to change silently: do not open ports, edit `sshd_config` or install VPN software without an explicit request.
- Do they want the tunnel to use a key (required for a background launcher) and are they fine creating one?
- Which browser is on your computer (Chrome/Edge/Chromium/Brave give an app-mode window; others open a normal tab)?

**Never** bind the server to `0.0.0.0`, forward it with `ssh -g`, or publish it through a reverse proxy, a tunnel service or a router port forward. Anyone who reached the port would own the whole library and the Claude sessions.

## What works remotely

Both ends use the same data: there is one server and one `library.json`, on the library computer. Changes made in the remote browser are written there and the library computer's window updates live, and vice versa. Verified over a tunnel: editing paper fields, driving Claude in the in-app console, highlighting and annotating in the reader, starting and ending reading sessions, adding survey requests.

**Remote mode.** Some buttons open windows on the library computer's screen, which a remote user cannot see. Remote mode makes them open in the remote browser instead:

| Button | Normal mode (library computer) | Remote mode (your browser) |
|---|---|---|
| Read | reader window + Claude terminal on the library computer | reader in a new browser window with Note, Explain, Ask; Claude's answers in a panel next to the PDF |
| Open PDF | the library computer's PDF viewer | a new browser tab |
| External links (arXiv, …) | the library computer's browser | your browser |
| Open in editor / Open transcript | an editor on the library computer | hidden; notes are editable inside the app |

Remote mode is remembered per browser. The server can tell when a connection arrives through an SSH tunnel (the TCP peer is an `sshd` process): the first time the app is opened that way it turns remote mode on and says so. The launcher's `?remote=1` does the same. It can be toggled in Settings → Reading sessions → Remote mode, or with `?remote=1` / `?remote=0` in the URL; a setting the user turned off by hand is not overridden by the auto-detection. The window on the library computer is always in normal mode.

**Reading remotely.** Press Read: the PDF opens in a new window and the clock starts. When done, close the PDF tab; the tab reports to the server every 20 s, and 2–3 minutes after the last report the session ends by itself with the time counted up to that report (so a closed laptop or a dropped tunnel never counts a whole night). Today → "Reading now" → End session ends it immediately; Open PDF reopens it. When the tunnel comes back the PDF tab shows "This reading session has ended" with a Resume button. Explain and Ask work remotely: a Claude panel slides out next to the PDF (Claude runs on the library computer); Hide keeps it running, End ends it after a confirmation. The same Claude appears under Explore → Consoles and on the "Reading now" card's Claude button, on both computers at once. Only the tab opened from Read or Open PDF reports; a tab opened from a paper's details is a plain viewer.

**Both computers open at once.** Both see the same "Reading now" card and shelf; a change on one side shows on the other within seconds. One reading session at a time: Read on the other side asks whether to end the current one first. A forgotten reader window on the library computer is closed and recorded by End session or Switch paper from the remote side. A session left open overnight is capped at 240 minutes however it ends. "Go to page" on a highlight opens a reader tab on the computer where it was clicked. Sounds and the "Mark as finished?" dialog appear only in the window that was used; the other side gets a notification. After sleep or a dropped tunnel the page resyncs itself.

**Consoles.** "Ask Yan to survey" on Explore starts `claude "/paper-survey <request>"` on the library computer and shows it in a terminal panel inside the app, usable from either side (arrow keys and Enter answer Claude's questions; Esc and Ctrl+C go to Claude). Hide keeps it running (reattach from Explore → Consoles or the request card); End session ends it. Two browsers on the same panel both see and type; the size follows the smaller window like tmux. Keyboard focus in a panel goes to Claude, so the app's single-key shortcuts do not fire. Keystrokes are retried over a flaky tunnel. A panel idle for 8 hours ends by itself; a survey ended early returns its request to Open. At most 6 panels; ended panels stay readable for an hour. Restarting the server ends every panel and reloads both pages.

**Assistant and Expert pages** work the same way: on the library computer they open terminal windows, remotely they open console panels; a discussion open as a terminal window cannot be opened as a console at the same time (the page says "Terminal open on the library computer"). Transcripts are readable without opening Claude. Desktop notifications (briefings, reminders) stay on the library computer.

## Step 0 — keep the server running on the library computer (once)

`./start.sh --install` registered `paper-assistant-server` as a `systemd --user` service, which starts at login (README §3.2; run it now if the user skipped it). Without *linger*, it stops when the user logs out or the machine reboots until someone logs in again:

```bash
loginctl enable-linger <user>            # on the library computer; sudo if it asks
systemctl --user status paper-assistant-server --no-pager   # should say active (running)
```

On a library computer without `systemd --user` (macOS, a container), keep `python3 app/server.py` running some other way (a login item, `nohup`, a supervisor); the tunnel only needs port 8765 to answer.

## Step 1 — an SSH alias on your computer

Open `~/.ssh/config` (Windows: `$env:USERPROFILE\.ssh\config`; create the folder and file if missing, `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/config` on macOS/Linux) and append:

```
Host paperhub
    HostName <library-host>
    Port <ssh-port>
    User <user>
    ServerAliveInterval 30
    ServerAliveCountMax 3

Host paperhub-tunnel
    HostName <library-host>
    Port <ssh-port>
    User <user>
    LocalForward 127.0.0.1:8765 127.0.0.1:8765
    ExitOnForwardFailure yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

`paperhub` is for ordinary logins; `paperhub-tunnel` is used only by the launcher, so a normal shell session never competes for port 8765.

## Step 2 — key-based login

The launcher opens the tunnel in the background, where nobody can type a password.

macOS / Linux:

```bash
ssh-keygen -t ed25519          # Enter for the defaults; answer n to "Overwrite?" if a key exists
ssh-copy-id paperhub
```

Windows (PowerShell):

```powershell
ssh-keygen -t ed25519
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh paperhub "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

A passphrase-protected key needs an ssh-agent, otherwise the launcher cannot log in. Verify: `ssh paperhub echo ok` prints `ok` without asking for a password.

## Step 3 — test the tunnel by hand

```bash
ssh -N paperhub-tunnel
```

No output means the tunnel is up. Open `http://localhost:8765/?remote=1` in a browser: the app should appear. Ctrl+C ends the test.

## Step 4 — a launcher

### Windows

Save as `%USERPROFILE%\paperhub\paperhub.ps1` (keep it ASCII-only):

```powershell
# Paper Assistant remote launcher (Windows)
# Opens the SSH tunnel if needed, then shows the library in its own Edge app window.
# Closing the window also closes the tunnel this script opened.
$Port    = 8765
$Url     = "http://localhost:$Port/?remote=1"
$DataDir = Join-Path $env:LOCALAPPDATA "PaperHubBrowser"

function Test-Tunnel {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect("127.0.0.1", $Port)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

function Show-Error($msg) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($msg, "Paper Assistant") | Out-Null
}

$ssh = $null
if (-not (Test-Tunnel)) {
    $ssh = Start-Process ssh -ArgumentList "-N", "paperhub-tunnel" -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 30 -and -not (Test-Tunnel); $i++) {
        if ($ssh.HasExited) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Tunnel)) {
        if (-not $ssh.HasExited) { Stop-Process -Id $ssh.Id -Force }
        Show-Error "Could not open the SSH tunnel.`nRun this in PowerShell to see why:`n`n    ssh -N paperhub-tunnel"
        exit 1
    }
}

$browser = Start-Process "msedge" -PassThru -ArgumentList "--app=$Url", "--user-data-dir=`"$DataDir`"", "--no-first-run"
$browser.WaitForExit()

if ($ssh -and -not $ssh.HasExited) { Stop-Process -Id $ssh.Id -Force }
```

Desktop shortcut: right-click the desktop → New → Shortcut, location

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%USERPROFILE%\paperhub\paperhub.ps1"
```

Replace `msedge` with `chrome` for Google Chrome. A blue window may flash briefly when the shortcut is opened.

### macOS / Linux

Save as `~/paperhub/paperhub.sh` and `chmod +x` it:

```bash
#!/bin/bash
# Paper Assistant remote launcher (macOS / Linux)
# Opens the SSH tunnel if needed, then shows the library in its own browser window.
# The tunnel stays open in the background and is reused next time.
PORT=8765
URL="http://localhost:$PORT/?remote=1"
DATA="$HOME/.paperhub-browser"

tunnel_up() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; }

fail() {
  echo "$1"
  command -v notify-send >/dev/null && notify-send "Paper Assistant" "$1"
  exit 1
}

if ! tunnel_up; then
  ssh -f -N paperhub-tunnel || fail "SSH tunnel failed. Run this to see why: ssh -N paperhub-tunnel"
  for _ in $(seq 1 30); do tunnel_up && break; sleep 0.5; done
  tunnel_up || fail "The tunnel did not come up on port $PORT."
fi

if [ "$(uname)" = "Darwin" ]; then
  for app in "Google Chrome" "Microsoft Edge" "Chromium" "Brave Browser"; do
    if [ -d "/Applications/$app.app" ]; then
      open -na "$app" --args --app="$URL" --user-data-dir="$DATA" --no-first-run
      exit 0
    fi
  done
  open "$URL"
else
  for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
    if command -v "$b" >/dev/null; then
      nohup "$b" --app="$URL" --user-data-dir="$DATA" --no-first-run >/dev/null 2>&1 &
      exit 0
    fi
  done
  xdg-open "$URL" >/dev/null 2>&1 &
fi
```

macOS: `cp ~/paperhub/paperhub.sh ~/Desktop/"Paper Assistant.command"` gives a double-clickable icon (a Terminal window opens first and can be closed). Linux: an application-menu entry:

```bash
mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/paperhub-remote.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Paper Assistant (remote)
Exec=$HOME/paperhub/paperhub.sh
Icon=web-browser
Terminal=false
EOF
```

## Everyday use

- Open: double-click the icon. Close: close the window (Windows also closes the tunnel; macOS/Linux keep it for next time).
- Always use `http://localhost:8765/?remote=1`, never the library computer's IP: the server refuses state-changing requests whose `Host` is not localhost.
- Reading: close the PDF tab when done; the session ends a few minutes later. End session on Today ends it at once.
- Close the tunnel by hand: `pkill -f "ssh -f -N paperhub-tunnel"` (macOS/Linux) or, in PowerShell, `Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object CommandLine -like "*paperhub-tunnel*" | ForEach-Object { Stop-Process -Id $_.ProcessId }`.
