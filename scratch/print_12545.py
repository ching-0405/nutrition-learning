with open('web/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(12545, 12585):
    print(f"{i+1}: {lines[i]}", end="")
