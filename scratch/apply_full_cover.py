def make_cover_and_remove_blur():
    filepaths = [
        'web/css/style.css',
        'web/css/style-LAPTOP-E05S4EJA.css',
        'Nutrition_student_trial/css/style.css'
    ]

    for fp in filepaths:
        with open(fp, 'r', encoding='utf-8') as f:
            text = f.read()

        # 1. Disable the blurred ::before
        old_before = """body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::before,
body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::before,
body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::before {
    position: absolute;
    inset: -18px;
    z-index: 0;
    content: "";
    background: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') center / cover no-repeat;
    filter: blur(16px) brightness(0.58);
    transform: scale(1.04);
}"""

        new_before = """body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::before,
body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::before,
body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::before {
    display: none !important;
}"""

        # 2. Set ::after to cover + center top
        old_after = """body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
    position: absolute;
    inset: 0;
    z-index: 1;
    content: "";
    background-image: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') !important;
    background-position: center top !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    pointer-events: none;
}"""

        new_after = """body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
    position: absolute;
    inset: 0;
    z-index: 1;
    content: "";
    background-image: url('../assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v2') !important;
    background-position: center top !important;
    background-size: cover !important;
    background-repeat: no-repeat !important;
    pointer-events: none;
}"""

        # 3. In mobile media query, also ensure cover
        old_mobile = """    body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
        background-size: contain !important;
        background-position: center center !important;
        background-repeat: no-repeat !important;
    }

    body.is-teacher.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
        background-size: contain !important;
        background-position: center center !important;
        background-repeat: no-repeat !important;
    }"""

        new_mobile = """    body.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-new_student_trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-f47185.trial-step-0 .stage-backdrop.new-student-trial-theme::after,
    body.is-teacher.unit-trial.trial-step-0 .stage-backdrop.new-student-trial-theme::after {
        background-size: cover !important;
        background-position: center top !important;
        background-repeat: no-repeat !important;
    }"""

        # Replace LF / CRLF
        for old, new in [(old_before, new_before), (old_after, new_after), (old_mobile, new_mobile)]:
            old_lf = old.replace('\r\n', '\n')
            old_crlf = old.replace('\r\n', '\n').replace('\n', '\r\n')
            new_crlf = new.replace('\r\n', '\n').replace('\n', '\r\n')
            new_lf = new.replace('\r\n', '\n')

            if old_crlf in text:
                text = text.replace(old_crlf, new_crlf)
            elif old_lf in text:
                text = text.replace(old_lf, new_lf)
            else:
                print(f"Warning: pattern not found in {fp}")

        with open(fp, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated {fp}")

if __name__ == '__main__':
    make_cover_and_remove_blur()
