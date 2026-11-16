import io

def run():
    with open('web/js/app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Update RESEARCH_STAGE_DATA q1 questionTitle:
    old_q1_title = "questionTitle: '調查結果發現，常喝含糖飲料的學生，體重過重及肥胖的比例比較高。以下哪個結論最合理？',"
    new_q1_title = "questionTitle: '調查結果發現，常喝<span style=\"color:#fef08a;\">含糖飲料</span>的學生，<span style=\"color:#fef08a;\">體重過重</span>及<span style=\"color:#fef08a;\">肥胖</span>的比例比較高。以下哪個結論最合理？',"

    # 2. Update RESEARCH_STAGE_DATA q2 questionTitle:
    old_q2_title = "questionTitle: '如果想了解某種飲食習慣與健康的關係，哪一種做法比較合理？',"
    new_q2_title = "questionTitle: '如果想了解某種<span style=\"color:#fef08a;\">飲食習慣</span>與<span style=\"color:#fef08a;\">健康</span>的關係，哪一種做法比較合理？',"

    # 3. Update step 0 dialogContent (伊麗克絲前導對話):
    old_step0 = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「研究之都最近出現一項健康調查：研究人員發現，<span style="color: #fef08a;">常喝含糖飲料的學生，體重過重的比例似乎比較高</span>。研究團隊想知道，這是否代表喝含糖飲料一定會造成肥胖。」</span>`;'
    new_step0 = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「研究之都最近出現一項健康調查：研究人員發現，常喝<span style="color: #fef08a;">含糖飲料</span>的學生，<span style="color: #fef08a;">體重過重</span>及<span style="color: #fef08a;">肥胖</span>的比例似乎比較高。研究團隊想知道，這是否代表喝<span style="color: #fef08a;">含糖飲料</span>一定會造成<span style="color: #fef08a;">肥胖</span>。」</span>`;'

    # 4. Update step 3 dialogContent (實習營養師對話):
    # 原文: 「原來看到兩件事一起發生，不代表其中一件一定造成另一件！研究真的像在辦案。」
    # 修改: 「原來看到兩件事一起發生，不代表其中一件一定造成另一件的"原因"！研究真的像在辦案。」
    old_step3 = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「原來<span style="color: #fef08a;">看到兩件事一起發生，不代表其中一件一定造成另一件！</span>研究真的像在辦案。」</span>`;'
    new_step3 = 'dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「原來<span style="color: #fef08a;">看到兩件事一起發生，不代表其中一件一定造成另一件的原因！</span>研究真的像在辦案。」</span>`;'

    assert old_q1_title in text, "old_q1_title not found"
    assert old_q2_title in text, "old_q2_title not found"
    assert old_step0 in text, "old_step0 not found"
    assert old_step3 in text, "old_step3 not found"

    text = text.replace(old_q1_title, new_q1_title)
    text = text.replace(old_q2_title, new_q2_title)
    text = text.replace(old_step0, new_step0)
    text = text.replace(old_step3, new_step3)

    with open('web/js/app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully updated web/js/app.js!")

if __name__ == '__main__':
    run()
