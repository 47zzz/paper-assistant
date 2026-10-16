"""Minimal stdlib CDP client for the headless Chrome on --remote-debugging-port. One Tab per target."""
import json, os, socket, base64, struct, time, urllib.request

# Shared test knobs. TEST_XDG is the test server's own XDG_RUNTIME_DIR: it keeps the copy's bridge sockets apart from a real
# instance (which uses /run/user/<uid>) and keeps the path short (unix socket paths are limited to ~108 bytes).
TEST_XDG = os.environ.get("PA_TEST_XDG") or "/tmp/pa-test-xdg-%d" % os.getuid()
# Paper ids the suites use; the test copy's library must contain them with PDFs attached (PA_TEST_PAPERS="id1,id2,id3").
PAPER_IDS = [x.strip() for x in (os.environ.get("PA_TEST_PAPERS") or "1706.03762,1512.03385,1810.04805").split(",") if x.strip()]


class Tab:
    def __init__(self, port, url="about:blank"):
        self.port = port
        tgt = json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:%d/json/new?%s" % (port, url), method="PUT")))
        self.tid = tgt["id"]
        path = tgt["webSocketDebuggerUrl"].split(str(port), 1)[1]
        self.s = socket.create_connection(("127.0.0.1", port))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(("GET %s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, port, key)).encode())
        self.buf = b""
        while b"\r\n\r\n" not in self.buf:
            self.buf += self.s.recv(4096)
        self.buf = self.buf.split(b"\r\n\r\n", 1)[1]
        self.cid = 0
        self.log = []
        self.call("Runtime.enable"); self.call("Page.enable")

    def _send(self, obj):
        d = json.dumps(obj).encode(); m = os.urandom(4); n = len(d)
        hdr = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        self.s.sendall(hdr + m + bytes(b ^ m[i % 4] for i, b in enumerate(d)))

    def _need(self, k):
        while len(self.buf) < k:
            self.buf += self.s.recv(65536)

    def _recv(self):
        self._need(2); n = self.buf[1] & 0x7f; off = 2
        if n == 126: self._need(4); n = struct.unpack(">H", self.buf[2:4])[0]; off = 4
        elif n == 127: self._need(10); n = struct.unpack(">Q", self.buf[2:10])[0]; off = 10
        self._need(off + n); d = self.buf[off:off + n]; self.buf = self.buf[off + n:]
        return json.loads(d)

    def _note(self, m):
        if m.get("method") == "Runtime.exceptionThrown":
            d = m["params"]["exceptionDetails"]; self.log.append("EXCEPTION: " + str((d.get("exception") or {}).get("description", d.get("text")))[:300])
        elif m.get("method") == "Runtime.consoleAPICalled" and m["params"]["type"] in ("error", "warning"):
            self.log.append("console.%s: %s" % (m["params"]["type"], " ".join(str(a.get("value", a.get("description", "")))[:200] for a in m["params"]["args"])))

    def call(self, method, params=None):
        self.cid += 1; my = self.cid; self._send({"id": my, "method": method, "params": params or {}})
        while True:
            m = self._recv(); self._note(m)
            if m.get("id") == my: return m

    def drain(self, sec):
        end = time.time() + sec; self.s.settimeout(0.3)
        while time.time() < end:
            try: m = self._recv()
            except (socket.timeout, BlockingIOError): continue
            self._note(m)
        self.s.settimeout(None)

    def nav(self, url, wait=2.5):
        self.call("Page.navigate", {"url": url}); self.drain(wait)

    def eval(self, js, gesture=True):
        r = self.call("Runtime.evaluate", {"expression": js, "returnByValue": True, "awaitPromise": True, "userGesture": gesture})
        res = r.get("result", {})
        if "exceptionDetails" in res:
            return {"__error": str((res["exceptionDetails"].get("exception") or {}).get("description", res["exceptionDetails"].get("text")))[:400]}
        return res.get("result", {}).get("value")

    def key(self, name, text="", code=None):
        self.call("Input.dispatchKeyEvent", {"type": "keyDown", "key": name, "code": code or name, "text": text})
        self.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": name, "code": code or name})

    def shot(self, path):
        r = self.call("Page.captureScreenshot", {"format": "png"}); open(path, "wb").write(base64.b64decode(r["result"]["data"]))

    def close(self):
        try: urllib.request.urlopen("http://127.0.0.1:%d/json/close/%s" % (self.port, self.tid)).read()
        except Exception: pass
        try: self.s.close()
        except Exception: pass


def close_all(port):
    for t in json.load(urllib.request.urlopen("http://127.0.0.1:%d/json/list" % port)):
        if t.get("type") == "page":
            try: urllib.request.urlopen("http://127.0.0.1:%d/json/close/%s" % (port, t["id"])).read()
            except Exception: pass
