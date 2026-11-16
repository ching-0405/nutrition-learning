import sys

with open('web/css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

with open('web/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print("=== INLINE STYLE in index.html for stageBackdrop ===")
for line in html.splitlines():
    if 'stageBackdrop' in line or 'stage-backdrop' in line:
        print(line)

print("\n=== CSS style.css for step-0 or stage-backdrop background ===")
for i, line in enumerate(css.splitlines()):
    if 'trial-step-0' in line and ('stageBackdrop' in line or 'stage-backdrop' in line):
        print(f"{i+1}: {line}")
