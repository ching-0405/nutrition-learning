import os, shutil, sys

def restore():
    print("=== Starting Restoration of 營養教學平台 to the Latest Complete Version ===")
    
    # Step 1: Copy index.html from Nutrition_student_trial to web/index.html
    print("Step 1: Restoring index.html from Nutrition_student_trial...")
    shutil.copy2('Nutrition_student_trial/index.html', 'web/index.html')
    
    # Step 2: Ensure '✅ 正確科學方法' badge is hidden in both index.html files
    print("Step 2: Ensuring '正確科學方法' badge is removed/hidden...")
    for html_path in ['web/index.html', 'Nutrition_student_trial/index.html']:
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
        target = '<div class="forest-overlay-result-badge correct">✅ 正確科學方法</div>'
        replacement = '<div class="forest-overlay-result-badge correct" style="display:none !important;"></div>'
        if target in html:
            html = html.replace(target, replacement)
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"  Hidden badge in {html_path}")
        else:
            print(f"  Badge already hidden or not present in {html_path}")

    # Step 3: Base js/app.js on the latest Nutrition_student_trial/js/app.js (PR #7)
    print("Step 3: Preparing js/app.js with PR #7 baseline...")
    with open('Nutrition_student_trial/js/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Step 4: Verify/Apply '輔英科技大學保健營養系 伊麗克絲 營養師'
    print("Step 4: Checking 伊麗克絲 營養師...")
    old_step0 = "if (speakerBadge) speakerBadge.textContent = '專業營養師';"
    new_step0 = "if (speakerBadge) speakerBadge.innerHTML = '<span class=\"speaker-name-highlight-white\">輔英科技大學保健營養系 伊麗克絲 營養師</span>';"
    if old_step0 in js:
        js = js.replace(old_step0, new_step0)
        js = js.replace("img.alt = '專業營養師';", "img.alt = '輔英科技大學保健營養系 伊麗克絲 營養師';")
        js = js.replace("if (tag) tag.textContent = '專業營養師';", "if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';")
        print("  Applied 伊麗克絲 營養師 replacement.")
    else:
        print("  伊麗克絲 營養師 already present.")

    # Step 5: Verify/Apply medical city video completion BGM resume
    print("Step 5: Checking medical city video BGM resume...")
    old_video_target = """        if (proceedToStage) {
            // 播放完畢或點擊「跳過影片」：直接進入挑選食物餐桌！
            showMedicalCityFoodTable();
        } else {
            // 點擊「返回健康大陸」
            if (medicalCityVideoBgmWasPlaying && soundEnabled) playBgm();
            medicalCityVideoBgmWasPlaying = false;
            returnToHealthContinent();
        }"""

    new_video_target = """        // 無論是播放完畢進入餐桌，還是點擊返回，只要原先有播放 BGM 且音效開啟，即刻恢復 BGM 播放
        if (medicalCityVideoBgmWasPlaying && soundEnabled) playBgm();
        medicalCityVideoBgmWasPlaying = false;

        if (proceedToStage) {
            // 播放完畢或點擊「跳過影片」：直接進入挑選食物餐桌！
            showMedicalCityFoodTable();
        } else {
            // 點擊「返回健康大陸」
            returnToHealthContinent();
        }"""
    
    # Handle line endings
    def replace_flexible(content, target, replacement):
        for t, r in [
            (target.replace('\r\n', '\n'), replacement.replace('\r\n', '\n')),
            (target.replace('\r\n', '\n').replace('\n', '\r\n'), replacement.replace('\r\n', '\n').replace('\n', '\r\n'))
        ]:
            if t in content:
                return content.replace(t, r)
        return content

    if '無論是播放完畢進入餐桌，還是點擊返回' not in js:
        js = replace_flexible(js, old_video_target, new_video_target)
        print("  Applied medical city video BGM fix.")
    else:
        print("  Medical city video BGM fix already present.")

    # Step 6: Apply research stage text & yellow highlights & '原因'
    print("Step 6: Applying research stage text highlights & 原因...")
    old_q1_title = "questionTitle: '調查結果發現，常喝含糖飲料的學生，體重過重及肥胖的比例比較高。以下哪個結論最合理？',"
    new_q1_title = "questionTitle: '調查結果發現，常喝<span style=\"color:#fef08a;\">含糖飲料</span>的學生，<span style=\"color:#fef08a;\">體重過重</span>及<span style=\"color:#fef08a;\">肥胖</span>的比例比較高。以下哪個結論最合理？',"

    old_q2_title = "questionTitle: '如果想了解某種飲食習慣與健康的關係，哪一種做法比較合理？',"
    new_q2_title = "questionTitle: '如果想了解某種<span style=\"color:#fef08a;\">飲食習慣</span>與<span style=\"color:#fef08a;\">健康</span>的關係，哪一種做法比較合理？',"

    old_step0_content = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「研究之都最近出現一項健康調查：研究人員發現，<span style="color: #fef08a;">常喝含糖飲料的學生，體重過重的比例似乎比較高</span>。研究團隊想知道，這是否代表喝含糖飲料一定會造成肥胖。」</span>`;'
    new_step0_content = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「研究之都最近出現一項健康調查：研究人員發現，常喝<span style="color: #fef08a;">含糖飲料</span>的學生，<span style="color: #fef08a;">體重過重</span>及<span style="color: #fef08a;">肥胖</span>的比例似乎比較高。研究團隊想知道，這是否代表喝<span style="color: #fef08a;">含糖飲料</span>一定會造成<span style="color: #fef08a;">肥胖</span>。」</span>`;'

    old_step3_content = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「原來<span style="color: #fef08a;">看到兩件事一起發生，不代表其中一件一定造成另一件！</span>研究真的像在辦案。」</span>`;'
    new_step3_content = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「原來<span style="color: #fef08a;">看到兩件事一起發生，不代表其中一件一定造成另一件的原因！</span>研究真的像在辦案。」</span>`;'

    js = replace_flexible(js, old_q1_title, new_q1_title)
    js = replace_flexible(js, old_q2_title, new_q2_title)
    js = replace_flexible(js, old_step0_content, new_step0_content)
    js = replace_flexible(js, old_step3_content, new_step3_content)
    print("  Applied research stage yellow highlights & 原因.")

    # Step 7: Apply research stage BGM (research_stage_bgm.mp3)
    print("Step 7: Applying research stage BGM...")
    old_configure = """        if (isMedicalCityActive) {
            nextSrc = 'assets/medical_city_bgm.mp3';
        } else if (activeContinentStageKey === 'sports') {
            nextSrc = 'assets/sportive_days_bgm.mp3';"""

    new_configure = """        if (isMedicalCityActive) {
            nextSrc = 'assets/medical_city_bgm.mp3';
        } else if (activeContinentStageKey === 'sports') {
            nextSrc = 'assets/sportive_days_bgm.mp3';
        } else if (activeContinentStageKey === 'research') {
            nextSrc = 'assets/research_stage_bgm.mp3';"""

    old_start_research = """        document.body.classList.remove(
            'health-continent-active', 'trial-step-0', 'trial-dialog-step',
            'continent-guide-dismissed', 'medical-city-active', 'sports-stage-active',
            'port-stage-active', 'forest-stage-active', 'community-stage-active', 'continent-scenery-stage-active'
        );
        document.body.classList.add('research-stage-active');"""

    new_start_research = """        document.body.classList.remove(
            'health-continent-active', 'trial-step-0', 'trial-dialog-step',
            'continent-guide-dismissed', 'medical-city-active', 'sports-stage-active',
            'port-stage-active', 'forest-stage-active', 'community-stage-active', 'continent-scenery-stage-active'
        );
        document.body.classList.add('research-stage-active');

        // 研究之都播放專屬背景音樂《research_stage_bgm.mp3》，並循環播放
        if (isTeacher && rpgBgmAudio) {
            const researchBgmSrc = 'assets/research_stage_bgm.mp3?v=20261025-research-bgm';
            const sourceChanged = !(rpgBgmAudio.getAttribute('src') || '').endsWith(researchBgmSrc);
            rpgBgmAudio.pause();
            bgmPlaying = false;
            bgmBaseVolume = 0.55;
            rpgBgmAudio.volume = bgmBaseVolume;
            rpgBgmAudio.loop = true;
            rpgBgmAudio.onended = null;

            const playResearchBgmFromStart = () => {
                if (!document.body.classList.contains('research-stage-active') || rpgBgmAudio.readyState < 1) return;
                rpgBgmAudio.currentTime = 0;
                playBgm();
            };

            if (sourceChanged) {
                rpgBgmAudio.setAttribute('src', researchBgmSrc);
                rpgBgmAudio.addEventListener('loadedmetadata', playResearchBgmFromStart, { once: true });
                rpgBgmAudio.load();
            } else {
                playResearchBgmFromStart();
            }
        }"""

    if 'activeContinentStageKey === \'research\'' not in js:
        js = replace_flexible(js, old_configure, new_configure)
    if 'research_stage_bgm.mp3' not in js:
        js = replace_flexible(js, old_start_research, new_start_research)
    print("  Applied research stage BGM.")

    # Save to both web/js/app.js and Nutrition_student_trial/js/app.js
    with open('web/js/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    with open('Nutrition_student_trial/js/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("  Saved synchronized js/app.js to web and Nutrition_student_trial.")

    # Step 8: Apply full cover and no-blur in css/style.css
    print("Step 8: Applying full cover & no-blur CSS...")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import apply_full_cover as afc
    afc.make_cover_and_remove_blur()

    # Step 9: Verify research_stage_bgm.mp3 exists in assets
    print("Step 9: Verifying audio assets...")
    uploaded_bgm = r'C:\Users\User\.gemini\antigravity\brain\ee1aa069-d013-4352-ab6f-1d9b0c14e891\.user_uploaded\uploaded_media_1792919281975.mp3'
    for dest_dir in ['web/assets', 'Nutrition_student_trial/assets']:
        dest_file = os.path.join(dest_dir, 'research_stage_bgm.mp3')
        if not os.path.exists(dest_file) or os.path.getsize(dest_file) == 0:
            shutil.copy2(uploaded_bgm, dest_file)
            print(f"  Copied {uploaded_bgm} to {dest_file}")
        else:
            print(f"  {dest_file} exists (size: {os.path.getsize(dest_file)} bytes)")

    print("=== Restoration Complete ===")

if __name__ == '__main__':
    restore()
