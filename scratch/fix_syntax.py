def fix():
    for filepath in ['web/css/style.css', 'web/css/style-LAPTOP-E05S4EJA.css', 'Nutrition_student_trial/css/style.css']:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
            
            old = "background: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') center contain no-repeat;"
            # Valid CSS: background-image, background-position, background-size, background-repeat
            new = """background-image: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') !important;
    background-position: center top !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;"""

            if old in text:
                text = text.replace(old, new)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(text)
                print(f"Fixed {filepath}")
            else:
                print(f"Old string not found in {filepath}")
        except Exception as e:
            print(f"Error on {filepath}:", e)

if __name__ == '__main__':
    fix()
