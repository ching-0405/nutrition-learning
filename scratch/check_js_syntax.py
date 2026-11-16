with open('web/js/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Check brackets balance
stack = []
pairs = {')': '(', ']': '[', '}': '{'}
in_string = False
str_char = None
escape = False
in_line_comment = False
in_block_comment = False

line_num = 1
col_num = 0

for i, ch in enumerate(text):
    col_num += 1
    if ch == '\n':
        line_num += 1
        col_num = 0
        in_line_comment = False
        continue

    if in_line_comment:
        continue

    if in_block_comment:
        if ch == '*' and i + 1 < len(text) and text[i+1] == '/':
            in_block_comment = False
        continue

    if in_string:
        if escape:
            escape = False
        elif ch == '\\':
            escape = True
        elif ch == str_char:
            in_string = False
            str_char = None
        continue

    if ch in ('"', "'", '`'):
        in_string = True
        str_char = ch
        continue

    if ch == '/' and i + 1 < len(text):
        if text[i+1] == '/':
            in_line_comment = True
            continue
        elif text[i+1] == '*':
            in_block_comment = True
            continue

    if ch in '([{':
        stack.append((ch, line_num, col_num))
    elif ch in ')]}':
        if not stack:
            print(f"Extra closing {ch} at line {line_num}:{col_num}")
            break
        top, tl, tc = stack.pop()
        if pairs[ch] != top:
            print(f"Mismatched {ch} at line {line_num}:{col_num}, expected closing for {top} from line {tl}:{tc}")
            break

print(f"Finished check. Stack size: {len(stack)}")
if stack:
    for s in stack[-5:]:
        print(f"Unclosed {s[0]} from line {s[1]}:{s[2]}")
