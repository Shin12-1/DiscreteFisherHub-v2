"""Tiny local-only static server for DiscreteFisher Hub."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 5173
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))

try:
    server = ThreadingHTTPServer((HOST, PORT), handler)
except OSError as error:
    print(f"Could not start server on http://localhost:{PORT}: {error}", file=sys.stderr)
    raise SystemExit(1) from error

print(f"Serving on http://localhost:{PORT}", flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
