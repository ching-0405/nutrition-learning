import os, time

now = time.time()
for root, dirs, files in os.walk('.'):
    if '.git' in root:
        continue
    for f in files:
        p = os.path.join(root, f)
        try:
            mtime = os.path.getmtime(p)
            if now - mtime < 14400: # past 4 hours
                print(f"{p} (size={os.path.getsize(p)}, mtime={time.ctime(mtime)})")
        except:
            pass
