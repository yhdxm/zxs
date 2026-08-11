import urllib.request, sys
url = "https://cdn.jsdelivr.net/npm/lodash/lodash.min.js"
try:
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read(2048)
        print("STATUS ok, got bytes:", len(data))
        print("FIRST 120:", repr(data[:120]))
except Exception as e:
    print("FAIL:", repr(e)[:200])
