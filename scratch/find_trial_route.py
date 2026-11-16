with open('web/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'trial-route' in l:
        print(f"Line {i+1}: {l.strip()[:100]}")
