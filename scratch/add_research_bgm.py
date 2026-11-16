import io

def run():
    with open('web/js/app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Update configureBgmForStage to check activeContinentStageKey === 'research'
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

    # 2. In startResearchStage, add BGM playback logic
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

    assert old_configure in text, "old_configure not found"
    assert old_start_research in text, "old_start_research not found"

    text = text.replace(old_configure, new_configure)
    text = text.replace(old_start_research, new_start_research)

    with open('web/js/app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully updated web/js/app.js with research BGM!")

if __name__ == '__main__':
    run()
