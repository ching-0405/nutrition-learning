import os, re

def update_file(filepath, transforms):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for old, new in transforms:
        old_lf = old.replace('\r\n', '\n')
        old_crlf = old.replace('\r\n', '\n').replace('\n', '\r\n')
        new_crlf = new.replace('\r\n', '\n').replace('\n', '\r\n')
        new_lf = new.replace('\r\n', '\n')

        if old_crlf in content:
            content = content.replace(old_crlf, new_crlf)
        elif old_lf in content:
            content = content.replace(old_lf, new_lf)
        else:
            print(f"Warning: pattern not found in {filepath}:\n{old[:100]}...")

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes made to {filepath}")

def run():
    print("=== Applying Entrance & Login Screen Fixes ===")

    # 1. Update index.html in both folders
    for html_path in ['web/index.html', 'Nutrition_student_trial/index.html']:
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()

        # Update <body> tag to include trial-step-0 and unit-new_student_trial initially
        html = re.sub(r'<body(?:\s+class="[^"]*")?>', '<body class="unit-new_student_trial trial-step-0">', html, count=1)

        # Update #stageBackdrop to have initial classes and background-image style
        old_backdrop_tag = '<div class="stage-backdrop" id="stageBackdrop">'
        new_backdrop_tag = '<div class="stage-backdrop new-student-trial-theme step-0-fullscreen" id="stageBackdrop" style="background-image: url(\'assets/new_student_trial_login_bg.jpg?v=20261025-login-hd-v1\') !important; background-size: cover !important; background-position: center top !important;">'
        if old_backdrop_tag in html:
            html = html.replace(old_backdrop_tag, new_backdrop_tag)

        # Add robust Step 0 defense in index.html <style>
        step0_css_fix = """
        /* Step 0 首頁防禦性樣式：確保背景滿版顯示、徹底隱藏人物與對話框 */
        body.trial-step-0 #stageBackdrop,
        body.trial-step-0 .stage-backdrop.new-student-trial-theme,
        .stage-backdrop.new-student-trial-theme.step-0-fullscreen {
            background-image: url('assets/new_student_trial_login_bg.jpg?v=20261025-login-hd-v1') !important;
            background-size: cover !important;
            background-position: center top !important;
            background-repeat: no-repeat !important;
            width: 100% !important;
            height: 100% !important;
        }

        body.trial-step-0 #characterStage,
        body.trial-step-0 .character-stage,
        body.trial-step-0 #charNurse,
        body.trial-step-0 #charNurse.speaking,
        body.trial-step-0 #charNurse.inactive,
        body.trial-step-0 #charNurse .char-sprite,
        body.trial-step-0 #charStudent,
        body.trial-step-0 #charStudent.speaking,
        body.trial-step-0 #charStudent.inactive,
        body.trial-step-0 #charStudent .char-sprite,
        body.trial-step-0 #sportsAzheCharacter,
        body.trial-step-0 #rpgBottomPanel,
        body.trial-step-0 .rpg-bottom-panel,
        body.trial-step-0 #dialogBox,
        body.trial-step-0 .rpg-dialog-box,
        body.trial-step-0 #dialogContent,
        body.trial-step-0 #patientBanner,
        body.trial-step-0 #stageIndicatorBar,
        body.trial-step-0 #rpgChoicesArea,
        body.trial-step-0 #optionsGrid {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        """

        if '/* Step 0 首頁防禦性樣式' not in html:
            # Insert right after <style>
            html = html.replace('<style>', '<style>' + step0_css_fix, 1)

        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"Updated {html_path}")

    # 2. Update style.css in both folders
    for css_path in ['web/css/style.css', 'Nutrition_student_trial/css/style.css']:
        with open(css_path, 'r', encoding='utf-8') as f:
            css = f.read()

        step0_style_append = """
/* ========================================================
   Step 0 首頁滿版封面與無干擾防護（終極優先權）
   ======================================================== */
body.trial-step-0 #stageBackdrop,
body.trial-step-0 .stage-backdrop.new-student-trial-theme,
.stage-backdrop.new-student-trial-theme.step-0-fullscreen,
html.trial-route #stageBackdrop,
html.trial-route .stage-backdrop.new-student-trial-theme {
    background-image: url('../assets/new_student_trial_login_bg.jpg?v=20261025-login-hd-v1') !important;
    background-size: cover !important;
    background-position: center top !important;
    background-repeat: no-repeat !important;
    width: 100% !important;
    height: 100% !important;
}

body.trial-step-0 #characterStage,
body.trial-step-0 .character-stage,
body.trial-step-0 #charNurse,
body.trial-step-0 #charNurse.speaking,
body.trial-step-0 #charNurse.inactive,
body.trial-step-0 #charNurse .char-sprite,
body.trial-step-0 #charStudent,
body.trial-step-0 #charStudent.speaking,
body.trial-step-0 #charStudent.inactive,
body.trial-step-0 #charStudent .char-sprite,
body.trial-step-0 #sportsAzheCharacter,
body.trial-step-0 #rpgBottomPanel,
body.trial-step-0 .rpg-bottom-panel,
body.trial-step-0 #dialogBox,
body.trial-step-0 .rpg-dialog-box,
body.trial-step-0 #dialogContent,
body.trial-step-0 #patientBanner,
body.trial-step-0 #stageIndicatorBar,
body.trial-step-0 #rpgChoicesArea,
body.trial-step-0 #optionsGrid,
body.unit-new_student_trial.trial-step-0 #characterStage,
body.unit-new_student_trial.trial-step-0 .character-stage,
body.unit-new_student_trial.trial-step-0 #charNurse,
body.unit-new_student_trial.trial-step-0 #charNurse.speaking,
body.unit-new_student_trial.trial-step-0 #charNurse.inactive,
body.unit-new_student_trial.trial-step-0 #charNurse .char-sprite,
body.unit-new_student_trial.trial-step-0 #charStudent,
body.unit-new_student_trial.trial-step-0 #charStudent.speaking,
body.unit-new_student_trial.trial-step-0 #charStudent.inactive,
body.unit-new_student_trial.trial-step-0 #charStudent .char-sprite,
body.unit-new_student_trial.trial-step-0 #sportsAzheCharacter,
body.unit-new_student_trial.trial-step-0 #rpgBottomPanel,
body.unit-new_student_trial.trial-step-0 .rpg-bottom-panel,
body.unit-new_student_trial.trial-step-0 #dialogBox,
body.unit-new_student_trial.trial-step-0 .rpg-dialog-box,
body.unit-new_student_trial.trial-step-0 #dialogContent,
body.unit-new_student_trial.trial-step-0 #patientBanner,
body.unit-new_student_trial.trial-step-0 #stageIndicatorBar,
body.unit-new_student_trial.trial-step-0 #rpgChoicesArea,
body.unit-new_student_trial.trial-step-0 #optionsGrid {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}
"""
        if '/* Step 0 首頁滿版封面與無干擾防護' not in css:
            css = css + "\n" + step0_style_append

        with open(css_path, 'w', encoding='utf-8') as f:
            f.write(css)
        print(f"Updated {css_path}")

    # 3. Update js/app.js in both folders
    for js_path in ['web/js/app.js', 'Nutrition_student_trial/js/app.js']:
        with open(js_path, 'r', encoding='utf-8') as f:
            js = f.read()

        old_step0_block = """        if (step === 0) {
            if (sceneLogin) sceneLogin.classList.add('hidden');
            if (rpgMainStage) rpgMainStage.classList.remove('hidden');
            document.body.classList.remove('trial-dialog-step', 'health-continent-active');
            document.body.classList.add('trial-step-0');
            if (stageBackdropEl) {
                stageBackdropEl.className = 'stage-backdrop new-student-trial-theme step-0-fullscreen';
            }
            if (typeof zoomOutContinentMap === 'function') zoomOutContinentMap(false, false);
            if (continentMapEl) continentMapEl.classList.add('hidden');
            if (trialBgStartArea) {
                trialBgStartArea.classList.remove('hidden');
                trialBgStartArea.style.setProperty('display', 'flex', 'important');
                trialBgStartArea.style.setProperty('visibility', 'visible', 'important');
                trialBgStartArea.style.setProperty('opacity', '1', 'important');
                trialBgStartArea.style.setProperty('pointer-events', 'auto', 'important');
                trialBgStartArea.style.setProperty('position', 'absolute', 'important');
                trialBgStartArea.style.setProperty('inset', '0', 'important');
                trialBgStartArea.style.setProperty('left', '0', 'important');
                trialBgStartArea.style.setProperty('right', '0', 'important');
                trialBgStartArea.style.setProperty('width', '100%', 'important');
                trialBgStartArea.style.setProperty('transform', 'none', 'important');
                trialBgStartArea.style.setProperty('z-index', '200', 'important');
                trialBgStartArea.style.setProperty('align-items', 'flex-end', 'important');
                trialBgStartArea.style.setProperty('justify-content', 'center', 'important');
                trialBgStartArea.style.setProperty('padding-bottom', 'max(16%, calc(110px + env(safe-area-inset-bottom, 0px)))', 'important');
                const trialStartButton = document.getElementById('btnTrialStartDirect');
                if (trialStartButton) {
                    trialStartButton.style.setProperty('display', 'inline-flex', 'important');
                    trialStartButton.style.setProperty('margin-left', 'auto', 'important');
                    trialStartButton.style.setProperty('margin-right', 'auto', 'important');
                }
            }
            if (dialogBox) dialogBox.classList.add('hidden');
            if (bottomPanel) bottomPanel.style.setProperty('display', 'none', 'important');
            if (charNurse) charNurse.classList.add('hidden');
            if (charStudent) charStudent.classList.add('hidden');
        }"""

        new_step0_block = """        if (step === 0) {
            document.documentElement.classList.add('trial-route');
            if (sceneLogin) sceneLogin.classList.add('hidden');
            if (sceneLobby) sceneLobby.classList.add('hidden');
            if (rpgMainStage) rpgMainStage.classList.remove('hidden');
            document.body.classList.remove('trial-dialog-step', 'health-continent-active', 'medical-city-active', 'sports-stage-active', 'port-stage-active', 'forest-stage-active', 'community-stage-active', 'research-stage-active');
            document.body.classList.add('trial-step-0', 'unit-new_student_trial');
            if (stageBackdropEl) {
                stageBackdropEl.className = 'stage-backdrop new-student-trial-theme step-0-fullscreen';
                stageBackdropEl.style.setProperty('background-image', "url('assets/new_student_trial_login_bg.jpg?v=20261025-login-hd-v1')", 'important');
                stageBackdropEl.style.setProperty('background-size', 'cover', 'important');
                stageBackdropEl.style.setProperty('background-position', 'center top', 'important');
                stageBackdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            }
            if (typeof zoomOutContinentMap === 'function') zoomOutContinentMap(false, false);
            if (continentMapEl) continentMapEl.classList.add('hidden');
            if (characterStage) {
                characterStage.classList.add('hidden');
                characterStage.style.setProperty('display', 'none', 'important');
            }
            ['charNurse', 'charStudent', 'sportsAzheCharacter'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('hidden');
                    el.classList.remove('speaking', 'inactive');
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                }
            });
            if (bottomPanel) {
                bottomPanel.classList.add('hidden');
                bottomPanel.style.setProperty('display', 'none', 'important');
            }
            if (dialogBox) {
                dialogBox.classList.add('hidden');
                dialogBox.style.setProperty('display', 'none', 'important');
            }
            if (rpgChoicesAreaEl) {
                rpgChoicesAreaEl.classList.add('hidden');
                rpgChoicesAreaEl.style.setProperty('display', 'none', 'important');
            }
            if (optionsGridEl) {
                optionsGridEl.classList.add('hidden');
                optionsGridEl.style.setProperty('display', 'none', 'important');
            }
            const patientBanner = document.getElementById('patientBanner');
            if (patientBanner) patientBanner.style.setProperty('display', 'none', 'important');
            const stageIndicatorBar = document.getElementById('stageIndicatorBar');
            if (stageIndicatorBar) stageIndicatorBar.style.setProperty('display', 'none', 'important');

            if (trialBgStartArea) {
                trialBgStartArea.classList.remove('hidden');
                trialBgStartArea.style.setProperty('display', 'flex', 'important');
                trialBgStartArea.style.setProperty('visibility', 'visible', 'important');
                trialBgStartArea.style.setProperty('opacity', '1', 'important');
                trialBgStartArea.style.setProperty('pointer-events', 'auto', 'important');
                trialBgStartArea.style.setProperty('position', 'absolute', 'important');
                trialBgStartArea.style.setProperty('inset', '0', 'important');
                trialBgStartArea.style.setProperty('left', '0', 'important');
                trialBgStartArea.style.setProperty('right', '0', 'important');
                trialBgStartArea.style.setProperty('width', '100%', 'important');
                trialBgStartArea.style.setProperty('transform', 'none', 'important');
                trialBgStartArea.style.setProperty('z-index', '200', 'important');
                trialBgStartArea.style.setProperty('align-items', 'flex-end', 'important');
                trialBgStartArea.style.setProperty('justify-content', 'center', 'important');
                trialBgStartArea.style.setProperty('padding-bottom', 'max(16%, calc(110px + env(safe-area-inset-bottom, 0px)))', 'important');
                const trialStartButton = document.getElementById('btnTrialStartDirect');
                if (trialStartButton) {
                    trialStartButton.style.setProperty('display', 'inline-flex', 'important');
                    trialStartButton.style.setProperty('margin-left', 'auto', 'important');
                    trialStartButton.style.setProperty('margin-right', 'auto', 'important');
                }
            }
        }"""

        def replace_flexible(c, old, new):
            for t, r in [
                (old.replace('\r\n', '\n'), new.replace('\r\n', '\n')),
                (old.replace('\r\n', '\n').replace('\n', '\r\n'), new.replace('\r\n', '\n').replace('\n', '\r\n'))
            ]:
                if t in c:
                    return c.replace(t, r)
            return c

        js = replace_flexible(js, old_step0_block, new_step0_block)
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js)
        print(f"Updated {js_path}")

    print("=== All Entrance & Login Fixes Applied Successfully ===")

if __name__ == '__main__':
    run()
