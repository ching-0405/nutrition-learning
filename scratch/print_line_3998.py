with open('web/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(3980, 4015):
    print(f"{i+1}: {repr(lines[i])}")
