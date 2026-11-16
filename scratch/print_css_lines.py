import sys

with open('web/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(13000, 13080):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end="")
