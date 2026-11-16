with open('web/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'charNurse' in l and ('let ' in l or 'const ' in l or 'var ' in l):
        print(f"Line {i+1}: {l.strip()[:100]}")
