with open('web/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '#charNurse' in l and ('display' in l or 'opacity' in l or 'visibility' in l) and '!important' in l:
        print(f"Line {i+1}: {l.strip()[:100]}")
