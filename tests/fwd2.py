import asyncio, sys, ctypes
L, R, NAME = int(sys.argv[1]), int(sys.argv[2]), (sys.argv[3] if len(sys.argv) > 3 else None)
if NAME:
    libc = ctypes.CDLL(None, use_errno=True); libc.prctl(15, NAME.encode(), 0, 0, 0)  # PR_SET_NAME → /proc/self/comm
async def pipe(r, w):
    try:
        while (d := await r.read(65536)): w.write(d); await w.drain()
    except Exception: pass
    finally: w.close()
async def handle(cr, cw):
    sr, sw = await asyncio.open_connection('127.0.0.1', R); await asyncio.gather(pipe(cr, sw), pipe(sr, cw))
async def main():
    srv = await asyncio.start_server(handle, '127.0.0.1', L)
    async with srv: await srv.serve_forever()
asyncio.run(main())
