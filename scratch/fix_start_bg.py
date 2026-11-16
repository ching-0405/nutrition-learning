import io

def update_css(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Update ::after rule around line 8078:
    old_rule_1 = """body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
    position: absolute;
    inset: 0;
    z-index: 1;
    content: "";
    background: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') center / cover no-repeat;
    pointer-events: none;
}"""

    new_rule_1 = """body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
    position: absolute;
    inset: 0;
    z-index: 1;
    content: "";
    background: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') center contain no-repeat;
    background-size: contain !important;
    background-position: center center !important;
    background-repeat: no-repeat !important;
    pointer-events: none;
}"""

    # 2. Update media query around line 9060:
    old_rule_2 = """    body.is-teacher.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
        background-size: cover !important;
        background-position: center center !important;
    }"""

    new_rule_2 = """    body.is-teacher.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
        background-size: contain !important;
        background-position: center center !important;
        background-repeat: no-repeat !important;
    }"""

    old_rule_1_crlf = old_rule_1.replace('\r\n', '\n').replace('\n', '\r\n')
    old_rule_1_lf = old_rule_1.replace('\r\n', '\n')
    new_rule_1_crlf = new_rule_1.replace('\r\n', '\n').replace('\n', '\r\n')
    new_rule_1_lf = new_rule_1.replace('\r\n', '\n')

    old_rule_2_crlf = old_rule_2.replace('\r\n', '\n').replace('\n', '\r\n')
    old_rule_2_lf = old_rule_2.replace('\r\n', '\n')
    new_rule_2_crlf = new_rule_2.replace('\r\n', '\n').replace('\n', '\r\n')
    new_rule_2_lf = new_rule_2.replace('\r\n', '\n')

    updated = False
    if old_rule_1_crlf in text:
        text = text.replace(old_rule_1_crlf, new_rule_1_crlf)
        updated = True
    elif old_rule_1_lf in text:
        text = text.replace(old_rule_1_lf, new_rule_1_lf)
        updated = True

    if old_rule_2_crlf in text:
        text = text.replace(old_rule_2_crlf, new_rule_2_crlf)
        updated = True
    elif old_rule_2_lf in text:
        text = text.replace(old_rule_2_lf, new_rule_2_lf)
        updated = True

    if updated:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated {filepath} successfully!")
    else:
        print(f"Rules not found in {filepath}")

if __name__ == '__main__':
    for path in [
        'web/css/style.css',
        'web/css/style-LAPTOP-E05S4EJA.css',
        'Nutrition_student_trial/css/style.css',
        'Nutrition_student_trial/css/style-LAPTOP-E05S4EJA.css'
    ]:
        update_css(path)
