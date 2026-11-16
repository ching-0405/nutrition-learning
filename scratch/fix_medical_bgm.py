import io

def fix_bgm_resume(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    old_target = """        if (proceedToStage) {
            // 播放完畢或點擊「跳過影片」：直接進入挑選食物餐桌！
            showMedicalCityFoodTable();
        } else {
            // 點擊「返回健康大陸」
            if (medicalCityVideoBgmWasPlaying && soundEnabled) playBgm();
            medicalCityVideoBgmWasPlaying = false;
            returnToHealthContinent();
        }"""

    new_replacement = """        // 無論是播放完畢進入餐桌，還是點擊返回，只要原先有播放 BGM 且音效開啟，即刻恢復 BGM 播放
        if (medicalCityVideoBgmWasPlaying && soundEnabled) playBgm();
        medicalCityVideoBgmWasPlaying = false;

        if (proceedToStage) {
            // 播放完畢或點擊「跳過影片」：直接進入挑選食物餐桌！
            showMedicalCityFoodTable();
        } else {
            // 點擊「返回健康大陸」
            returnToHealthContinent();
        }"""

    old_target_crlf = old_target.replace('\r\n', '\n').replace('\n', '\r\n')
    old_target_lf = old_target.replace('\r\n', '\n')
    new_replacement_crlf = new_replacement.replace('\r\n', '\n').replace('\n', '\r\n')

    if old_target_crlf in text:
        text = text.replace(old_target_crlf, new_replacement_crlf)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated {filepath} (CRLF)")
    elif old_target_lf in text:
        text = text.replace(old_target_lf, new_replacement)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated {filepath} (LF)")
    else:
        print(f"Target not found in {filepath}")

if __name__ == '__main__':
    fix_bgm_resume('web/js/app.js')
    fix_bgm_resume('Nutrition_student_trial/js/app.js')
