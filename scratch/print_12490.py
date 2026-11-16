with open('web/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(12490, 12520):
    print(f"{i+1}: {lines[i]}", end="")
