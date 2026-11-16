// 輔英科技大學 保健營養系 - 營養教學平台 臨床互動與檢定系統
// 支援單元架構 (MUST臨床評估 vs NCP獨立檢定)、連續計分、手機端嚴格禁止跳過對話、阿嬤畫面返回上一關
(function() {
    'use strict';

    // ==============================================
    // 狀態與設定 (單元路由檢測)
    // ==============================================
    const urlParams = new URLSearchParams(window.location.search);
    const tView = urlParams.get('test_view') || urlParams.get('tview');
    const isDirectStageView = Boolean(
        urlParams.get('skip') === '1' ||
        urlParams.get('preview') ||
        ['ward', '1', 'dragon', 'stage', 'nurse', 'exam'].includes(tView)
    );
    const isFileProtocol = (window.location.protocol === 'file:');
    const isStaticSite = isFileProtocol || /\.github\.io$/i.test(window.location.hostname);
    let activeUnit = (urlParams.get('unit') || 'must').toLowerCase().replace(/^unit_/, '');
    const isTeacher = (
        urlParams.get('role') === 'teacher' ||
        urlParams.get('teacher') === '1' ||
        (!['new_student_trial', 'trial', 'f47185', 'health_continent'].includes(activeUnit) && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && urlParams.get('role') !== 'student')
    );

    // 當前單元：must、ncp、dm 或自訂單元 (預設 new_student_trial)
    window.isCompletedMedicalCity = false;
    window.isCompletedSportsStage = false;
    window.isCompletedPortStage = false;
    window.isCompletedForestStage = false;
    window.isCompletedCommunityStage = false;
    window.isCompletedResearchStage = false;
    try {
        sessionStorage.removeItem('completed_stage_medical');
        localStorage.removeItem('completed_stage_medical');
        sessionStorage.removeItem('completed_stage_sports');
        localStorage.removeItem('completed_stage_sports');
        sessionStorage.removeItem('completed_stage_port');
        localStorage.removeItem('completed_stage_port');
        sessionStorage.removeItem('completed_stage_forest');
        localStorage.removeItem('completed_stage_forest');
    } catch(e) {}
    let selectedGender = localStorage.getItem('FYU_STUDENT_GENDER') || 'female';
    if (isTeacher) {
        selectedGender = 'female';
    }

    let currentStage = parseInt(urlParams.get('stage')) || 1;
    let isGameStarted = false;
    let isInPrologue = false;
    let prologueIndex = 0;
    let selectedAvatar = '🍎';
    let myNickname = '';
    let myTeamName = '';
    let currentGameMode = 'individual';

    function getNutritionInternDisplayName() {
        const nickname = String(myNickname || '').trim();
        return nickname ? `${nickname} 營養實習生` : '營養實習生';
    }
    let myScore = 0;
    let studentSelectedOption = null;
    let soundEnabled = true;
    let bgmPlaying = false;
    let bgmBaseVolume = 0.5;
    let bgmUsesHospitalTrack = false;
    let bgmWaitingForQuestionVoice = false;
    let totalSeconds = 180;
    let timerInterval = null;
    let statusPollingInterval = null;
    let lobbyPollingInterval = null;
    let victorySoundPlayed = false;
    let currentSessionId = null;
    let consecutivePollErrors = 0;
    let pendingAnswerResult = null;
    let isShowingResultModal = false;
    let alreadyRevealedThisStage = false;
    let fatalOverlayClosedByUser = false;
    let fatalAspirationTriggered = false;
    let grandmaThankTriggered = false;
    let grandmaThankDismissed = false;
    let supportStage11QuestionReady = false;
    let supportStage11QuestionVoiceStarted = false;
    let isStageLocked = false;
    let teacherStagePhase = 0; // 0: 作答中 1: 已鎖定 2: 已公布答案
    let mustStage7Step = 0;
    let newStudentTrialStep = 0;
    let activeContinentRegionKey = null;
    let stageLoadVersion = 0;
    let unit3Stage3VideoRun = 0;
    let unit3Stage3NarrationActive = false;
    let unit3RevealVideoPending = false;
    let unit3RevealVideoCompleted = false;
    let cancelUnit3RevealVideo = null;
    let kidneyStage2IntroPending = false;
    let kidneyStage2IntroCompleted = false;
    let cancelKidneyStage2Intro = null;
    let kidneyStage3IntroPending = false;
    let cancelKidneyStage3Intro = null;
    let kidneyStage4IntroPending = false;
    let cancelKidneyStage4Intro = null;
    let kidneyStage2AudioContext = null;
    let kidneyStage2AudioGain = null;
    let kidneyStage2AudioSource = null;
    let currentModuleCode = '';
    let renderedStage = 0;
    let renderedUnit = '';
    const unitStageCounts = Object.create(null);
    const unitStageCountRequests = Object.create(null);
    const pendingStageByUnit = Object.create(null);
    let lastStageNavigationAt = 0;
    let kingDismissalTriggered = false;
    let supportStage2Step = 0;
    let supportStage4Step = 0;
    let supportStage6Step = 0;
    let supportStage8Step = 0;
    let detectiveStage12Step = 0;
    let dmStage6Phase = 0;
    let currentInternVoiceAudio = null;
    let sportsSurpriseAudio = null;
    let dmStage6Attempts = 0;
    let dmStage8VideoShown = false;
    let dmStage8VideoBgmWasPlaying = false;
    let medicalCityVideoBgmWasPlaying = false;
    let sportsIntroVideoBgmWasPlaying = false;
    let shiyiAnimTimer = null;
    let formulaFeedingAnimationPlayed = false;
    let formulaFeedingAnimationTimer = null;

    // 唯一用戶 ID
    let clientId = localStorage.getItem('FYU_STUDENT_CLIENT_ID');
    if (!clientId) {
        clientId = 'stu_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString().slice(-4);
        localStorage.setItem('FYU_STUDENT_CLIENT_ID', clientId);
    }

    // 關閉視窗或伺服器重啟時，自動退出所有學生連線並返回登入畫面
    function forceExitSession(reason) {
        if (isTeacher || isStaticSite || tView) return;
        if (statusPollingInterval) clearInterval(statusPollingInterval);
        if (lobbyPollingInterval) clearInterval(lobbyPollingInterval);
        if (timerInterval) clearInterval(timerInterval);

        isGameStarted = false;
        currentStage = 1;
        myScore = 0;
        studentSelectedOption = null;
        currentSessionId = null;
        consecutivePollErrors = 0;

        localStorage.removeItem('FYU_STUDENT_CLIENT_ID');
        clientId = 'stu_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString().slice(-4);
        localStorage.setItem('FYU_STUDENT_CLIENT_ID', clientId);

        sceneLobby.classList.add('hidden');
        rpgMainStage.classList.add('hidden');
        rpgVictoryModal.classList.add('hidden');
        grandmaThankModal.classList.add('hidden');
        sceneLogin.classList.remove('hidden');
        if (inputNickname) {
            inputNickname.disabled = false;
            inputNickname.readOnly = false;
        }

        const loginDesc = document.querySelector('.login-desc');
        if (loginDesc) {
            loginDesc.innerHTML = `<span style="color:#f87171;font-weight:bold;">⚠️ ${reason}</span><br>課堂已重啟，請重新輸入暱稱加入：`;
        }
    }

    // ==============================================
    // 單元架構定義 (MUST 臨床快篩 vs NCP 核心檢定)
    // ==============================================
    const unitDefinitions = {
        must: {
            id: "must",
            name: "【單元一 營養照顧流程】",
            loginTitle: "【入院 48 小時快篩挑戰】",
            loginDesc: "歡迎進入 302 床林奶奶臨床病房！請輸入您的參賽暱稱以加入本堂課堂競賽：",
            badge: "302 床",
            bannerInfo: `
                <span class="p-name"><strong>林奶奶 (76歲)</strong> ‧ 胃癌全胃切除術後 Day 2</span>
                <span class="p-metrics">身高 <strong>155cm</strong> ｜ 現重 <strong>46.0kg</strong> ｜ 6個月前體重 <strong>58.0kg</strong></span>
                <span class="p-order">⚠️ 醫囑狀態：<strong>禁食 NPO 預期 > 5天</strong></span>
            `,
            maxStages: 7,
            pointsPerQuestion: 250,
            hasGrandmaThank: true,
            leaderboardTitle: "【全班 MUST 臨床營養快篩評估 TOP 5 英雄榜】",
            certTitle: "【入院 48 小時快篩挑戰 ‧ 臨床成就證書】",
            certDesc: "於《膳食療養學》臨床個案快篩實戰中，精準判讀 MUST 關鍵指標與臨床營養不良風險，展現專業照護能力！",
            certBadgeText: "榮獲「及時介入臨床營養達人」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "BMI評估", num: "1" },
                { st: 2, txt: "體重流失", num: "2" },
                { st: 3, txt: "疾病禁食", num: "3" },
                { st: 4, txt: "風險等級", num: "4" },
                { st: 5, txt: "NCP核心", num: "5" },
                { st: 6, txt: "步驟挑錯", num: "6" },
                { st: 7, txt: "篩檢項目", num: "7" },
                { st: 8, txt: "英雄榜", num: "🏆" }
            ],
            prologue: [
                {
                    speaker: "護理師 林語柔",
                    text: "呼... 實習營養師，妳終於來了！歡迎來到輔英科技大學附設醫院病房！",
                    target: "nurse"
                },
                {
                    speaker: "實習營養師",
                    text: "林護理師您好！聽說剛剛 302 床新收治了一位急需評估的術後長輩？",
                    target: "student"
                },
                {
                    speaker: "護理師 林語柔",
                    text: "沒錯！床號 302 新收治一位術後的林奶奶，剛動完胃癌全胃切除大手術，醫囑狀態：禁食 NPO 預期 > 5天...",
                    target: "nurse"
                },
                {
                    speaker: "護理師 林語柔",
                    text: "依據評鑑標準與臨床照護黃金準則，我們必須在【入院 48 小時內】完成 MUST 營養不良快篩評估！",
                    target: "nurse"
                },
                {
                    speaker: "護理師 林語柔",
                    text: "時間緊迫，責任重大！現在讓我們開始【第 1 關】挑戰：請依據營養不良篩選工具 (MUST) 進行評估！",
                    target: "nurse"
                }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ BMI 區間判定",
                    speaker: "護理師 林語柔",
                    speakerRole: "nurse",
                    voicePath: "assets/voice/must_stage1.mp3",
                    speech: "奶奶身高 155 cm，目前體重 46.0 kg。<br>請依據<strong>營養不良篩選工具 (MUST)</strong> 進行評估，計算 BMI 區間並選擇正確得分：",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "0 分", text: "BMI > 20" },
                        { key: "2", score: "1 分", text: "BMI = 18.5 ~ 20" },
                        { key: "3", score: "2 分", text: "BMI < 18.5" }
                    ],
                    revealExplanation: "BMI = 46 / (1.55 × 1.55) ≈ 19.15 kg/m²，介於 18.5 ~ 20 之間，依據 MUST 臨床指標判定得分為【1 分】（選項 2）！"
                },
                2: {
                    title: "第 2 題 ‧ 非計畫性體重流失評估",
                    speaker: "護理師 林語柔",
                    speakerRole: "nurse",
                    voicePath: "assets/voice/must_stage2.mp3",
                    speech: "林奶奶常態體重 58.0 kg，入院降至 46.0 kg。<br><span style=\"display:inline-block;white-space:nowrap;\">請計算近 3-6 個月非計畫性體重流失百分比並判定 MUST 得分：</span>",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "0 分", text: "流失百分比 < 5%" },
                        { key: "2", score: "1 分", text: "流失百分比 5% ~ 10%" },
                        { key: "3", score: "2 分", text: "流失百分比 > 10%" }
                    ],
                    revealExplanation: "體重流失率 = (58 - 46) / 58 = 12 / 58 ≈ 20.69% (>10%)，依據 MUST 臨床指標判定得分為【2 分】（選項 3）！"
                },
                3: {
                    title: "第 3 題 ‧ 急性疾病禁食影響評估",
                    speaker: "護理師 林語柔",
                    speakerRole: "nurse",
                    voicePath: "assets/voice/must_stage3.mp3",
                    speech: '<span style="letter-spacing:-0.25px;">林奶奶剛完成胃癌全胃切除重大手術，醫囑明訂禁食 NPO 預期超過 5 天。</span><br>依據 MUST 臨床指引，<strong>急性疾病導致禁食 ≧ 5天</strong>時應加計幾分？',
                    correctKey: "3",
                    options: [
                        { key: "1", score: "加0分", text: "加0分" },
                        { key: "2", score: "加1分", text: "加1分" },
                        { key: "3", score: "加2分", text: "加2分" }
                    ],
                    revealExplanation: "重大手術合併禁食 NPO 預期 > 5 天，符合 MUST 第 3 步急性疾病加分指引，應加計【2 分】（選項 3）！"
                },
                4: {
                    title: "第 4 題 ‧ MUST 總分與風險等級判定",
                    speaker: "護理師 林語柔",
                    speakerRole: "nurse",
                    voicePath: "assets/voice/must_stage4.mp3",
                    speech: "請依據前述三項指標得分累計，判定林奶奶之<strong>營養不良風險等級</strong>：",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "0 分", text: "低度風險 (Low Risk)" },
                        { key: "2", score: "1 分", text: "中度風險 (Medium Risk)" },
                        { key: "3", score: "≧ 2 分", text: "高度風險 (High Risk)" }
                    ],
                    revealExplanation: "林奶奶 MUST 三項得分合計：BMI(1) + 體重流失(2) + 疾病禁食(2) = 5 分 ≧ 2 分，判定為【高度風險 (High Risk)】！正確答案為選項【3】！"
                },
                5: {
                    title: "第 5 題 ‧ 營養照護程序 (NCP) 核心項目",
                    speaker: "【臨床營養總監 陸馳野】",
                    speakerRole: "lu",
                    nurseImg: "assets/director_lu_bust.png",
                    nurseTag: "臨床營養總監 陸馳野",
                    backdrop: "assets/rpg_bg_seminar.jpg",
                    voicePath: "assets/voice/ncp_stage1.mp3",
                    speech: "<div style=\"font-size:15px;line-height:1.55;\"><span style=\"display:block;white-space:normal;overflow-wrap:anywhere;\">標準化營養照護程序（NCP）包含四大核心項目，下列何者正確？</span><span style=\"display:block;color:#fef08a;font-size:14px;white-space:normal;overflow-wrap:anywhere;\">①營養評估 ②營養監測與評值 ③營養介入 ④營養教育 ⑤營養診斷 ⑥營養諮商</span></div>",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "選項 1", text: "① ② ⑤ ⑥" },
                        { key: "2", score: "選項 2", text: "① ② ③ ⑤" },
                        { key: "3", score: "選項 3", text: "① ② ③ ④" },
                        { key: "4", score: "選項 4", text: "① ② ④ ⑥" }
                    ],
                    revealExplanation: "NCP 四大核心步驟為：①營養評估 (Assessment) ➔ ⑤營養診斷 (Diagnosis) ➔ ③營養介入 (Intervention) ➔ ②營養監測與評值 (Monitoring and Evaluation)，故正確答案為選項【2】①②③⑤！"
                },
                6: {
                    title: "第 6 題 ‧ 營養照護步驟 (NCP) 觀念檢核與挑錯",
                    speaker: "【臨床營養總監 陸馳野】",
                    speakerRole: "lu",
                    nurseImg: "assets/director_lu_bust.png",
                    nurseTag: "臨床營養總監 陸馳野",
                    backdrop: "assets/rpg_bg_seminar.jpg",
                    voicePath: "assets/voice/ncp_stage2.mp3",
                    speech: "下列有關<strong>營養照護步驟（Nutrition Care Process, NCP）</strong>的說明何者<strong>錯誤</strong>？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 1", text: "以系統性蒐集、驗證、解釋數據釐清營養相關問題的是營養診斷（Nutrition Diagnosis）" },
                        { key: "2", score: "選項 2", text: "營養評估（Nutrition Assessment）的目的是決定個案有一個或多個營養相關的問題" },
                        { key: "3", score: "選項 3", text: "營養照護步驟的第二步驟為包含 PES 的營養診斷" },
                        { key: "4", score: "選項 4", text: "食物相關的歷史、營養相關的歷史、體位測量都是營養評估的資料蒐集類別" }
                    ],
                    revealExplanation: "「以系統性蒐集、驗證、解釋數據釐清營養相關問題」是【營養評估 (Nutrition Assessment)】之核心定義，而非營養診斷！故選項【1】敘述錯誤（符合題目挑錯所選）！"
                },
                7: {
                    title: "第 7 題 ‧ 周代宮廷 ‧ 食醫的考驗（營養篩檢項目判定）",
                    speaker: "【食醫的考驗】",
                    speakerRole: "shiyi",
                    nurseImg: "assets/zhou_shiyi_bust_hd.png",
                    nurseTag: "宮廷食醫",
                    backdrop: "assets/rpg_bg_zhou_court.jpg",
                    voicePath: "assets/voice/must_stage7_zhou_question.mp3",
                    speech: "<div style=\"font-size:16px; line-height:1.6;\"><span style=\"color:#ffffff; font-weight:bold;\">下列何者不是</span><strong style=\"color:#fef08a;\">營養篩檢</strong><span style=\"color:#ffffff; font-weight:bold;\">（nutrition screening）的項目？</span><br><span style=\"color:#94a3b8; font-size:13.5px; font-weight:normal;\">（請於下方點選非初步營養篩檢的常規項目）</span></div>",
                    correctKey: "4",
                    isZhouCourtStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "體重改變" },
                        { key: "2", score: "選項 2", text: "BMI" },
                        { key: "3", score: "選項 3", text: "進食量" },
                        { key: "4", score: "選項 4", text: "藥物" }
                    ],
                    revealExplanation: "依據臨床照護指引：營養篩檢（Nutrition Screening）主要由幾項基本資料快速進行，常見指標為：體重改變、BMI、進食量；而「藥物」屬於後續深入的營養評估（Nutrition Assessment）範疇，非初步快速篩檢之常規項目！故正確答案為選項【4：藥物】！"
                }
            }
        },
        support: {
            id: "support",
            name: "【單元二】營養支持",
            bodyClass: "unit-support",
            themeClass: "scifi-theme",
            teacherImg: "assets/scifi_officer_bust.png",
            teacherName: "系統監控中樞 ‧ 艦載終端",
            loginTitle: "【臨床重症 ‧ 營養支持實戰】",
            loginDesc: "歡迎進入生化管線監控終端！請輸入您的參賽暱稱以加入本單元排查任務：",
            badge: "艦載醫療艙",
            bannerInfo: `
                <span class="p-metrics">管線類型：<strong>NG-01 鼻胃管</strong> ｜ 狀態：<strong>觸發防禦協議 ‧ 故障排查中</strong></span>
                <span class="p-order" style="color:#ef4444;background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);">⚠️ 排除幽靈錯誤</span>
            `,
            maxStages: 11,
            pointsPerQuestion: 250,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 營養支持管線排查 TOP 5 英雄榜】",
            certTitle: "【臨床重症營養支持 ‧ 管線排查專案認證】",
            certDesc: "於《膳食療養學》臨床營養支持實戰中，精準辨識鼻胃管 (NG-01) 與外科造瘻併發症關鍵差異，排除系統故障！",
            certBadgeText: "榮獲「管線排查首席技師」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "管線排查", num: "1" },
                { st: 2, txt: "防護處置", num: "2" },
                { st: 3, txt: "路徑選擇", num: "3" },
                { st: 4, txt: "灌食評估", num: "4" },
                { st: 5, txt: "元素配方", num: "5" },
                { st: 6, txt: "靜脈輸液", num: "6" },
                { st: 7, txt: "腸炎處置", num: "7" },
                { st: 8, txt: "再餵食症候群", num: "8" },
                { st: 9, txt: "均衡管灌配方", num: "9" },
                { st: 10, txt: "黏膜屏障", num: "10" },
                { st: 11, txt: "營養路徑比較", num: "11" },
                { st: 12, txt: "英雄榜", num: "🏆" }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 艦載生化管線異常排查 (NG-01 鼻胃管)",
                    speaker: "【系統監控中樞 ‧ 艦載終端】",
                    speakerRole: "scifi",
                    nurseImg: "assets/scifi_officer_bust.png",
                    nurseTag: "系統監控中樞 ‧ 艦載終端",
                    voicePath: "assets/voice/support_stage1_v2.mp3",
                    speech: "⚠️ 系統告警：醫療艙「休眠探員」的鼻胃管回報故障，請立即將監控中樞回報的故障清單內容：<br><strong>下列何者不是病人裝置鼻胃管常見的合併症？</strong>",
                    correctKey: "4",
                    isNgHudStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "胃食道逆流引發吸入性肺炎" },
                        { key: "2", score: "選項 2", text: "鼻黏膜損傷及出血" },
                        { key: "3", score: "選項 3", text: "胃潰瘍" },
                        { key: "4", score: "選項 4", text: "導管插入部位出現滲漏" }
                    ],
                    revealExplanation: "鼻胃管（NG-01）是經由鼻腔天然孔道置入胃部，體表並無外科手術造瘻創口！「導管插入部位出現滲漏」屬於胃造瘻（PEG）或空腸造瘻等外科造瘻口的常見合併症，物理結構上不可能發生於鼻胃管！修復技師成功排除幽靈故障！獲得 250 分！"
                },
                2: {
                    title: "第 2 題 ‧ 重症吸入性肺炎防護處置 (Aspiration Risk)",
                    speaker: "【加護醫學部 趙仁傑 主治醫師】",
                    speakerRole: "doctor",
                    nurseImg: "assets/doctor_senior_bust.png",
                    nurseTag: "加護醫學部 趙仁傑 主治醫師",
                    backdrop: "assets/rpg_bg_icu_aspiration.jpg",
                    voicePath: "assets/voice/support_stage2.mp3",
                    speech: "<span style=\"color:#ffffff;\">鼻胃管灌食的重症病人，下列何者不是</span><strong style=\"color:#fef08a;\">降低 aspiration 風險</strong><span style=\"color:#ffffff;\">的最佳處置？</span>",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 1", text: "口腔清潔" },
                        { key: "2", score: "選項 2", text: "抬高頭部" },
                        { key: "3", score: "選項 3", text: "持續會厭下抽痰" },
                        { key: "4", score: "選項 4", text: "檢查胃殘餘量" }
                    ],
                    revealExplanation: "依據 ASPEN/SCCM 重症營養指引，常規監測「胃殘餘量 (GRV)」並不能顯著降低吸入性肺炎風險，反而常導致灌食中斷與營養不足，故已不再列為首選最佳防護處置！抬高床頭 30~45°、落實口腔清潔與持續會厭下抽痰才是有效防範措施！判定正確！獲得 250 分！"
                },
                3: {
                    title: "第 3 題 ‧ 腸道營養支持路徑選擇之取決條件判定",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_icu_aspiration.jpg",
                    voicePath: "assets/voice/support_stage3.mp3",
                    speech: "有關腸道<strong style=\"color:#fef08a;\">營養支持路徑</strong>的選擇取決條件，下列何者<strong style=\"color:#fef08a;\">錯誤</strong>？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "病人是否臥床" },
                        { key: "2", score: "選項 B", text: "是否計劃未來進行手術" },
                        { key: "3", score: "選項 C", text: "需要腸道營養支持的時間長度" },
                        { key: "4", score: "選項 D", text: "吸入性肺炎或餵食管移位的風險程度" }
                    ],
                    revealExplanation: "腸道營養支持（Enteral Nutrition, EN）管灌路徑的選擇取決條件包括：預期管灌時間長度（如短期 < 4~6週採經鼻置管，長期 > 4~6週採造瘻術）、胃腸道功能與解剖結構（是否計畫進行胃腸道手術）、以及吸入性肺炎逆流與管路移位的風險評估等；「病人是否臥床」並非決定胃管、空腸管或造瘻路徑的取決條件！故選項【A 病人是否臥床】敘述錯誤（符合題目挑錯所選）！"
                },
                4: {
                    title: "第 4 題 ‧ 中風鼻胃管灌食熱量與配方評估",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_support_stage4.png",
                    speech: "林先生 40 歲，體重 60 公斤，因中風使用鼻胃管灌食，除高血壓外無其他疾病，評估每日熱量需要 30 kcal/kg，下列有關灌食敘述何者錯誤？",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "選項 A", text: "使用 continuous feeding 時，可用全濃度灌食不需要稀釋配方" },
                        { key: "2", score: "選項 B", text: "使用標準均衡配方（1 kcal/mL）時，每日需要提供 1,800 mL 才能達到熱量需要量" },
                        { key: "3", score: "選項 C", text: "灌食配方需有 2%至 4%的熱量來自 MCT（medium-chain triglycerides）oil 才能避免必需脂肪酸缺乏" },
                        { key: "4", score: "選項 D", text: "林先生水分的需要量每日約需 1,800~2,100 mL" }
                    ],
                    revealExplanation: "必需脂肪酸（EFA，如亞麻油酸 LA 與 α-次亞麻油酸 ALA）必須由長鏈脂肪酸（LCT）提供，中鏈三酸甘油酯（MCT oil）無法提供必需脂肪酸！故選項【C 灌食配方需有 2%至 4%熱量來自 MCT oil 才能避免必需脂肪酸缺乏】敘述錯誤（符合題目挑錯所選）！"
                },
                5: {
                    title: "第 5 題 ‧ 元素配方 (Elemental Formula) 組成分判定",
                    speaker: "【臨床營養總監 陸馳野】",
                    speakerRole: "lu",
                    nurseImg: "assets/director_lu_bust.png",
                    nurseTag: "臨床營養總監 陸馳野",
                    backdrop: "assets/rpg_bg_support_formula.png",
                    voicePath: "assets/voice/support_stage5.mp3",
                    speech: "下列何種營養素不是 elemental formula（元素配方）的組成分？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "casein 酪蛋白" },
                        { key: "2", score: "選項 B", text: "dipeptides 雙生肽" },
                        { key: "3", score: "選項 C", text: "MCT oil" },
                        { key: "4", score: "選項 D", text: "maltodextrin 麥芽糊精" }
                    ],
                    revealExplanation: "元素配方（Elemental Formula / Monomeric Formula）中蛋白質來源為自由胺基酸（Free Amino Acids）或極小胜肽（Dipeptides / Tripeptides），不需要消化酶分解即可吸收；而酪蛋白（casein）為完整蛋白質（Intact Protein），屬於聚合配方（Polymeric Formula）之成分，非元素配方之組成分！故正確答案為選項【A casein 酪蛋白】！"
                },
                6: {
                    title: "第 6 題 ‧ 全靜脈營養 (TPN) 高濃糖中斷併發症評估",
                    speaker: "【加護醫學部 趙仁傑 主治醫師】",
                    speakerRole: "doctor",
                    nurseImg: "assets/doctor_senior_bust.png",
                    nurseTag: "加護醫學部 趙仁傑 主治醫師",
                    backdrop: "assets/rpg_bg_icu_tpn.jpg",
                    speech: "使用高濃度葡萄糖輸液的全靜脈營養病人，要避免突然中斷該輸液的原因為何？",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 A", text: "避免發生低血鈣" },
                        { key: "2", score: "選項 B", text: "避免發生低血脂" },
                        { key: "3", score: "選項 C", text: "避免發生低血壓" },
                        { key: "4", score: "選項 D", text: "避免發生低血糖" }
                    ],
                    revealExplanation: "全靜脈營養（TPN）持續輸注高濃度葡萄糖輸液時，會刺激胰臟 β 細胞持續高額分泌胰島素；若突然中斷輸液，體內的高濃度高血糖來源消失，但血中高濃度胰島素尚未代謝降解，將導致急性【反彈性低血糖（Rebound Hypoglycemia）】！故要避免突然中斷輸液，正確答案為選項【D 避免發生低血糖】！"
                },
                7: {
                    title: "第 7 題 ‧ 放射性腸炎與吸收不良癌症灌食配方選擇",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_icu_aspiration.jpg",
                    speech: "對於因治療產生放射性腸炎、吸收不良而導致腹瀉的癌症灌食患者，可使用下列何種類型配方？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "元素或預解配方" },
                        { key: "2", score: "選項 B", text: "低纖維聚合配方" },
                        { key: "3", score: "選項 C", text: "高水溶性纖維配方" },
                        { key: "4", score: "選項 D", text: "高蛋白濃縮配方" }
                    ],
                    revealExplanation: "放射性腸炎造成腸道黏膜受損與吸收不良，應選用預先水解之【元素或預解配方】（含游離胺基酸與雙生肽），無需消化酵素即可直接由受損腸道吸收，大幅改善腹瀉！故正確答案為選項【A 元素或預解配方】。"
                },
                8: {
                    title: "第 8 題 ‧ 再餵食症候群高風險辨識",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_icu_aspiration.jpg",
                    voicePath: "assets/voice/support_stage8.mp3",
                    speech: "有關<span style=\"color:#fef08a;font-weight:bold;\">再餵食症候群（refeeding syndrome）</span>的敘述，下列何者正確？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "原先營養狀態正常的嚴重外傷病人因病情及手術導致過去兩週幾無營養攝入，在開始灌食時也屬高風險族群" },
                        { key: "2", score: "選項 B", text: "特別容易出現在接受高脂肪高熱量飲食的病人" },
                        { key: "3", score: "選項 C", text: "典型的表現為「三低一高」，包括低血磷、低血鉀、低血糖及高血鎂" },
                        { key: "4", score: "選項 D", text: "若發生再餵食症候群時，建議加快腸道或靜脈營養的給予速度，以矯正營養素的缺乏" }
                    ],
                    revealExplanation: "再餵食症候群可發生於原先營養狀態正常、但因嚴重外傷或手術而連續約兩週幾乎沒有營養攝入的病人；重新開始灌食後，胰島素上升會使磷、鉀、鎂快速進入細胞，造成低血磷、低血鉀與低血鎂，並可能伴隨高血糖。高脂肪高熱量本身不是典型風險條件；發生時應暫緩或降低營養速度、補充硫胺素並密切矯正電解質，不能加快給予。故正確答案為選項【A】。"
                },
                9: {
                    title: "第 9 題 ‧ 均衡管灌食配方辨識",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_support_formula.png",
                    voicePath: "assets/voice/support_stage9.mp3",
                    speech: "下列何類管灌食配方可提供均衡的營養，其蛋白質來源由酪蛋白、乳清蛋白或黃豆分離蛋白組成？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "polymeric formula" },
                        { key: "2", score: "選項 B", text: "monomeric formula" },
                        { key: "3", score: "選項 C", text: "modular formula" },
                        { key: "4", score: "選項 D", text: "predigested formula" }
                    ],
                    revealExplanation: "Polymeric formula（聚合配方）提供完整且均衡的營養，蛋白質通常來自完整蛋白質，如酪蛋白、乳清蛋白或黃豆分離蛋白。故正確答案為選項【A polymeric formula】。"
                },
                10: {
                    title: "第 10 題 ‧ 腸道黏膜屏障功能與細菌轉位防護",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/support_stage10_anatomy.jpg",
                    voicePath: "assets/voice/support_stage10.mp3",
                    speech: "相較於 parenteral nutrition，用 tube feeding 較有助於促進下列何者的 mucosal barrier function，降低細菌轉移（translocation）？",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 1", text: "口腔" },
                        { key: "2", score: "選項 2", text: "食道" },
                        { key: "3", score: "選項 3", text: "胃部" },
                        { key: "4", score: "選項 4", text: "腸子" }
                    ],
                    revealExplanation: "腸道管灌營養（Tube Feeding / Enteral Nutrition）能直接提供腸道黏膜細胞營養，維持腸道黏膜屏障完整性（Mucosal Barrier Function）與免疫機能，防止腸道內細菌及其毒素穿透腸黏膜造成細菌轉位（Bacterial Translocation）；相較之下，全靜脈營養（PN）缺乏腸道腔內養分刺激，容易導致腸黏膜萎縮。故正確答案為選項【4 腸子】！"
                },
                11: {
                    title: "第 11 題 ‧ 腸道營養與靜脈營養臨床效益評估",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_icu_aspiration.jpg",
                    voicePath: "assets/voice/support_stage11.mp3",
                    speech: "腸道營養與靜脈營養相較，下列敘述何者錯誤？",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "選項 1", text: "腸道營養較有助於保留小腸黏膜障蔽" },
                        { key: "2", score: "選項 2", text: "腸道營養較容易發生感染性併發症" },
                        { key: "3", score: "選項 3", text: "腸道營養較能減少異化作用" },
                        { key: "4", score: "選項 4", text: "腸道營養較能節省醫療費用" }
                    ],
                    revealExplanation: "腸道營養（Enteral Nutrition, EN）相較於靜脈營養（Parenteral Nutrition, PN），能維持腸道黏膜結構與功能完整，其感染性併發症（如導管感染與敗血症）的發生率顯著「較低」，而非容易發生；同時腸道營養還具備促進免疫、減緩異化作用及大幅節省醫療花費等臨床優勢！故選項【2 腸道營養較容易發生感染性併發症】敘述錯誤（符合題目挑錯所選）！"
                }
            }
        },
        ncp: {
            id: "ncp",
            name: "【單元二】營養照護程序 (NCP) 核心觀念檢定 (獨立題目)",
            loginTitle: "【NCP 標準化營養照護程序 ‧ 核心檢定】",
            loginDesc: "歡迎進入臨床營養專題研討室！請輸入您的參賽暱稱以加入本單元 NCP 檢定競賽：",
            badge: "NCP 核心檢定",
            bannerInfo: `
                <span class="p-name"><strong>臨床營養專題研討室</strong> ‧ 標準化營養照護程序 (NCP) 專業檢定</span>
                <span class="p-metrics">主考導師：<strong>陸馳野 臨床營養總監 ‧ 專科考照名師</strong> ｜ 考核項目：<strong>核心步驟與流程定義</strong></span>
            `,
            maxStages: 2,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 NCP 核心程序檢定 TOP 5 榮譽榜】",
            certTitle: "【營養照護程序 (NCP) 專業核心學能檢定合格證書】",
            certDesc: "於《膳食療養學》臨床營養照護程序檢定中，精準掌握 NCP 四大核心架構與定義步驟，展現卓越臨床思維！",
            certBadgeText: "榮獲「NCP 臨床營養流程大師」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "四大核心", num: "1" },
                { st: 2, txt: "步驟挑錯", num: "2" },
                { st: 3, txt: "NCP榜", num: "🏆" }
            ],
            prologue: [
                {
                    speaker: "【臨床營養總監 陸馳野】",
                    text: "聽說你們想挑戰標準化營養照護程序 (NCP)？很好，我的研討室從不收平庸之輩。",
                    target: "nurse"
                },
                {
                    speaker: "【實習營養師】",
                    text: "陸總監好！我們已經準備好迎接最嚴格的臨床思維考驗！",
                    target: "student"
                },
                {
                    speaker: "【臨床營養總監 陸馳野】",
                    text: "口氣倒是不小。NCP 是臨床營養師拯救生命的作業準則，四大核心邏輯必須深入骨髓！",
                    target: "nurse"
                },
                {
                    speaker: "【臨床營養總監 陸馳野】",
                    text: "現在，收起你們的僥倖心理——給我拿出真本事，證明你們有資格留在這裡！",
                    target: "nurse"
                }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 營養照護程序 (NCP) 核心項目",
                    speaker: "【霸道總裁 陸馳野】",
                    speakerRole: "lu",
                    voicePath: "assets/voice/ncp_stage1.mp3",
                    speech: "「既然進了我的課堂，四大核心步驟現在就證明給我看——別讓我失望。」<br>營養照護程序（nutrition care process, NCP）是一個標準化的、有計畫性的營養照護過程，其包括四個項目，下列何者正確？<br><span style=\"color:#fef08a;\">①營養評估 ②營養監測與評值 ③營養介入 ④營養教育 ⑤營養診斷 ⑥營養諮商</span>",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "選項 1", text: "① ② ⑤ ⑥" },
                        { key: "2", score: "選項 2", text: "① ② ③ ⑤" },
                        { key: "3", score: "選項 3", text: "① ② ③ ④" },
                        { key: "4", score: "選項 4", text: "① ② ④ ⑥" }
                    ],
                    revealExplanation: "NCP 四大核心步驟為：①營養評估 (Assessment) ➔ ⑤營養診斷 (Diagnosis) ➔ ③營養介入 (Intervention) ➔ ②營養監測與評值 (Monitoring and Evaluation)，故正確答案為選項【2】①②③⑤！"
                },
                2: {
                    title: "第 2 題 ‧ 營養照護步驟 (NCP) 觀念檢核與挑錯",
                    speaker: "【霸道總裁 陸馳野】",
                    speakerRole: "lu",
                    voicePath: "assets/voice/ncp_stage2.mp3",
                    speech: "「這題是挑出致命錯誤。看清楚每個字的定義，我的標準容不下一絲疏忽。」 下列有關<strong>營養照護步驟（Nutrition Care Process, NCP）</strong>的說明何者<strong>錯誤</strong>？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 1", text: "以系統性蒐集、驗證、解釋數據釐清營養相關問題的是營養診斷（Nutrition Diagnosis）" },
                        { key: "2", score: "選項 2", text: "營養評估（Nutrition Assessment）的目的是決定個案有一個或多個營養相關的問題" },
                        { key: "3", score: "選項 3", text: "營養照護步驟的第二步驟為包含 PES 的營養診斷" },
                        { key: "4", score: "選項 4", text: "食物相關的歷史、營養相關的歷史、體位測量都是營養評估的資料蒐集類別" }
                    ],
                    revealExplanation: "「以系統性蒐集、驗證、解釋數據釐清營養相關問題」是【營養評估 (Nutrition Assessment)】之核心定義，而非營養診斷！故選項【1】敘述錯誤（符合題目挑錯所選）！"
                }
            }
        },
        dm: {
            id: "dm",
            name: "【單元六】糖尿病之營養治療",
            loginTitle: "【糖尿病醫學營養治療 ‧ 臨床代謝評估】",
            loginDesc: "歡迎進入內分泌新陳代謝科門診！請輸入您的參賽暱稱以加入本單元競賽：",
            badge: "新陳代謝門診",
            themeClass: "dm-theme",
            bodyClass: "unit-dm",
            teacherImg: "assets/doctor_bust.png",
            teacherName: "內分泌新陳代謝科 沈懷瑾 主任醫師",
            bannerInfo: `
                <span class="p-name"><strong>內分泌新陳代謝科門診</strong> ‧ 糖尿病醫學營養治療 (MNT) 臨床實戰</span>
                <span class="p-metrics">主治導師：<strong>沈懷瑾 主任醫師 ‧ 代謝專科權威</strong> ｜ 考核項目：<strong>T1DM 機轉 ‧ 四大診斷標準 ‧ 長期控制與篩檢</strong></span>
                <span class="p-order" style="color:#38bdf8;background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.4);">🩸 內分泌專科精選</span>
            `,
            maxStages: 12,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 糖尿病 MNT 代謝檢定 TOP 5 榮譽榜】",
            certTitle: "【糖尿病醫學營養治療 (MNT) 專業臨床學能合格證書】",
            certDesc: "於《膳食療養學》糖尿病醫學營養治療實戰中，精準掌握致病機轉、四大診斷標準、長期血糖控制成效與高風險篩檢指標，展現卓越臨床思維！",
            certBadgeText: "榮獲「糖尿病臨床代謝先鋒」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "T1DM病因", num: "1" },
                { st: 2, txt: "HbA1c魔龍", num: "2" },
                { st: 3, txt: "空腹FPG", num: "3" },
                { st: 4, txt: "OGTT 2H", num: "4" },
                { st: 5, txt: "隨機血糖", num: "5" },
                { st: 6, txt: "長期指標", num: "6" },
                { st: 7, txt: "T2DM阻抗", num: "7" },
                { st: 8, txt: "eAG換算", num: "8" },
                { st: 9, txt: "定期監測", num: "9" },
                { st: 10, txt: "篩檢風險", num: "10" },
                { st: 11, txt: "升糖指數", num: "11" },
                { st: 12, txt: "夜間偵探", num: "12" },
                { st: 13, txt: "代謝榜", num: "🏆" }
            ],
            prologue: [
                {
                    speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
                    text: "各位實習同學，歡迎來到內分泌新陳代謝科門診。在臨床上，糖尿病的精準營養治療必須建立在清晰的病因機轉之上。",
                    target: "nurse"
                },
                {
                    speaker: "【實習營養師】",
                    text: "沈主任好！我們已經準備好接受門診案例的臨床代謝考驗！",
                    target: "student"
                },
                {
                    speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
                    text: "很好！本單元包含 T1DM 致病機轉、糖尿病四大診斷標準、長期血糖指標與成人高風險篩檢指引！",
                    target: "nurse"
                },
                {
                    speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
                    text: "請仔細審視臨床考點與抽血數值，展現最專業的營養診斷能力！",
                    target: "nurse"
                }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 第 1 型糖尿病核心病因機轉",
                    speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
                    speakerRole: "doctor",
                    voicePath: "assets/voice/dm_stage1.mp3",
                    speech: "<strong style=\"color:#ffffff;\"><span style=\"color:#fef08a;\">第 1 型糖尿病</span>（Type 1 Diabetes Mellitus）主要的<span style=\"color:#fef08a;\">病因機轉</span>為何？</strong>",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 1", text: "飲食不當與久坐" },
                        { key: "2", score: "選項 2", text: "胰島素分泌上升" },
                        { key: "3", score: "選項 3", text: "胰島素抗性" },
                        { key: "4", score: "選項 4", text: "自體抗體攻擊胰島細胞" }
                    ],
                    revealExplanation: "第 1 型糖尿病 (T1DM) 主要是因自體免疫失調，體內產生自體抗體（如抗胰島細胞抗體 ICA、抗 GAD 抗體）攻擊破壞胰臟蘭氏小島 β 細胞，導致胰島素絕對分泌不足！「胰島素抗性」與「飲食久坐」則主要為第 2 型糖尿病之特徵。故正確答案為選項【4】自體抗體攻擊胰島細胞！"
                },
                2: {
                    title: "第 2 題 ‧ \"糖尿病\"的糖化血色素 (HbA1C) 診斷標準切點 (黑炎魔龍討伐戰)",
                    speaker: "【⚔️ 糖化檢定勇者】",
                    speakerRole: "warrior",
                    voicePath: "assets/voice/dm_stage2.mp3",
                    speech: "「🔥 黑炎魔龍狂暴來襲！請拖曳拉拉條設定<strong>\"糖尿病\"的糖化血色素 (HbA1C) 診斷標準切點</strong>，點選蓄力出擊討伐黑炎魔龍！」",
                    correctKey: "1",
                    hasSliderBattle: true,
                    sliderType: "a1c",
                    correctVal: 6.5,
                    options: [
                        { key: "1", score: "選項 1", text: "HbA1c ≥ 6.5%" },
                        { key: "2", score: "選項 2", text: "HbA1c ≥ 6.0%" },
                        { key: "3", score: "選項 3", text: "HbA1c ≥ 7.0%" },
                        { key: "4", score: "選項 4", text: "HbA1c ≥ 5.7%" }
                    ],
                    revealExplanation: "依據最新糖尿病臨床指引，糖化血色素（HbA1c）≥ 6.5% 即達到糖尿病診斷標準！故正確答案為【HbA1c ≥ 6.5%】！"
                },
                3: {
                    title: "第 3 題 ‧ 空腹血漿血糖 (FPG) 臨床診斷標準 (晨曦冰壁 冰晶巨神兵)",
                    speaker: "【⚔️ 晨曦破曉勇者】",
                    speakerRole: "warrior",
                    voicePath: "assets/voice/dm_stage3.mp3",
                    speech: "「黎明拂曉，未進食滿 8 小時的身體處於基準狀態。晨曦之門的巨神兵築起一道血糖防線！若要鎖定臨床上判定為『糖尿病』的空腹血漿葡萄糖（FPG）標準切點，能量儀應設定在多少 mg/dL 以上才能擊碎超標結界？」",
                    correctKey: "3",
                    hasSliderBattle: true,
                    sliderType: "fpg",
                    correctVal: 126,
                    options: [
                        { key: "1", score: "選項 1", text: "FPG ≥ 100 mg/dL" },
                        { key: "2", score: "選項 2", text: "FPG ≥ 110 mg/dL" },
                        { key: "3", score: "選項 3", text: "FPG ≥ 126 mg/dL" },
                        { key: "4", score: "選項 4", text: "FPG ≥ 140 mg/dL" }
                    ],
                    revealExplanation: "依據臨床指引，空腹（禁食至少 8 小時）血漿血糖 FPG ≥ 126 mg/dL 符合糖尿病診斷標準！（100 ~ 125 mg/dL 屬於空腹血糖偏高/糖尿病前期）。故正確答案為【FPG ≥ 126 mg/dL】！"
                },
                4: {
                    title: "第 4 題 ‧ 口服葡萄糖耐受試驗 (OGTT) 診斷標準 (深淵糖沼 晶化毒蠍魔君)",
                    speaker: "【⚔️ 糖耐審判勇者】",
                    speakerRole: "warrior",
                    nurseImg: "assets/warrior_hero.png",
                    nurseTag: "⚔️ 糖耐審判男戰士",
                    backdrop: "assets/rpg_bg_ogtt_swamp.jpg",
                    isDragonBossStage: true,
                    hasSliderBattle: true,
                    sliderType: "ogtt",
                    correctVal: 200,
                    voicePath: "assets/voice/dm_stage4.mp3",
                    speech: "「深淵噬糖巨獸『晶化毒蠍魔君』盤踞在沼澤深處！依據臨床診療指引，進行口服葡萄糖耐受試驗（75g OGTT）時，『<strong>第 2 小時血漿血糖</strong>』之糖尿病診斷切點為何？」",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 1", text: "OGTT 2小時 ≥ 140 mg/dL" },
                        { key: "2", score: "選項 2", text: "OGTT 2小時 ≥ 160 mg/dL" },
                        { key: "3", score: "選項 3", text: "OGTT 2小時 ≥ 180 mg/dL" },
                        { key: "4", score: "選項 4", text: "OGTT 2小時 ≥ 200 mg/dL" }
                    ],
                    revealExplanation: "75g 口服葡萄糖耐受試驗（OGTT）第 2 小時血漿血糖 ≥ 200 mg/dL 符合糖尿病診斷標準！（140 ~ 199 mg/dL 為耐糖異常/糖尿病前期）。故正確答案為選項【4】OGTT 2小時 ≥ 200 mg/dL！"
                },
                5: {
                    title: "第 5 題 ‧ 隨機血漿血糖與高血糖典型症狀診斷 (雷霆荒野 狂暴雷狼魔)",
                    speaker: "【⚔️ 疾風破煞勇者】",
                    speakerRole: "warrior",
                    nurseImg: "assets/warrior_hero.png",
                    nurseTag: "⚔️ 疾風破煞男戰士",
                    backdrop: "assets/rpg_bg_thunder_wolf.jpg",
                    isDragonBossStage: true,
                    hasSliderBattle: true,
                    sliderType: "random_glucose",
                    correctVal: 200,
                    voicePath: "assets/voice/dm_stage5.mp3",
                    speech: "「雷霆荒野的『狂暴雷狼魔』突襲撕裂防線！依據臨床診療指引，當個案出現高血糖典型症狀（多吃、多喝、多尿與體重減輕）時，『<strong>隨機血漿血糖（Random Glucose）</strong>』之糖尿病診斷切點為何？」",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 1", text: "隨機血糖 ≥ 140 mg/dL" },
                        { key: "2", score: "選項 2", text: "隨機血糖 ≥ 160 mg/dL" },
                        { key: "3", score: "選項 3", text: "隨機血糖 ≥ 180 mg/dL" },
                        { key: "4", score: "選項 4", text: "隨機血糖 ≥ 200 mg/dL 伴隨典型高血糖症狀" }
                    ],
                    revealExplanation: "個案出現典型高血糖「三多一少」（多吃、多喝、多尿、體重減輕）症狀，且隨機血漿血糖 ≥ 200 mg/dL 時，即可直接診斷為糖尿病！故正確答案為選項【4】隨機血糖 ≥ 200 mg/dL 伴隨典型高血糖症狀！"
                },
                6: {
                    title: "第 6 題 ‧ 血糖控制長期成效指標判定",
                    speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
                    speakerRole: "doctor",
                    voicePath: "assets/voice/dm_stage7.mp3",
                    speech: "下列何者是糖尿病人血糖控制的長期成效指標？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 1", text: "HbA1c" },
                        { key: "2", score: "選項 2", text: "空腹血糖" },
                        { key: "3", score: "選項 3", text: "飯後血糖" },
                        { key: "4", score: "選項 4", text: "OGTT" }
                    ],
                    revealExplanation: "糖化血色素（HbA1c）能反映過去 2 ~ 3 個月的平均血糖控制狀態，不受單次飲食、運動或抽血前作息短期波動影響，是臨床評估糖尿病人血糖控制成效最關鍵之【長期指標】（正確答案為選項 1：HbA1c）！"
                },
                7: {
                    title: "第 7 題 ‧ 第 2 型糖尿病致病機轉與胰島素阻抗相關特徵",
                    speaker: "【新陳代謝科 高健宇 主治醫師】",
                    speakerRole: "muscle_doctor",
                    nurseImg: "assets/handsome_muscle_doctor_bust.png",
                    nurseTag: "新陳代謝科 高健宇 主治醫師",
                    voicePath: "assets/voice/dm_stage8.mp3",
                    speech: "下列何者與<strong style=\"color:#fef08a;\">第 2 型糖尿病人</strong>的<strong style=\"color:#fef08a;\">胰島素阻抗無關</strong>？",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "選項 1", text: "飯後高血糖" },
                        { key: "2", score: "選項 2", text: "血液中胰島素濃度增加" },
                        { key: "3", score: "選項 3", text: "產生酮酸中毒" },
                        { key: "4", score: "選項 4", text: "血液中游離脂肪酸濃度增加" }
                    ],
                    revealExplanation: "第 2 型糖尿病患者體內仍保有部分內生性胰島素分泌能力，足以抑制脂肪大量分解產生過量酮體，因此極罕見產生糖尿病酮酸中毒（DKA，DKA 多見於胰島素絕對缺乏之第 1 型糖尿病）！胰島素阻抗會導致代償性高胰島素血症、游離脂肪酸 (FFA) 上升以及骨骼肌對葡萄糖利用下降而引發飯後高血糖。故正確答案為選項【3】產生酮酸中毒！"
                },
                8: {
                    title: "第 8 題 ‧【魔導能量儀・核心共鳴】估計平均血糖值（eAG）換算",
                    speaker: "【魔導能量儀・核心共鳴】",
                    speakerRole: "arcane",
                    backdrop: "assets/rpg_bg_arcane_sanctuary.jpg",
                    nurseImg: "assets/arcane_dial_seal.png",
                    nurseTag: "魔導能量儀",
                    voicePath: "assets/voice/dm_stage9_arcane.mp3",
                    speech: "【魔導能量儀・核心共鳴】聖域防護石碑上浮現了深紅色的糖化印記：「A1C: 9%」。<br>守護者必須計算出過去 3 個月能量流動的「估計平均血糖值（eAG）」以解除印記超載，請問儀表應校準至多少數值？",
                    correctKey: "3",
                    isArcaneEagStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "139 mg/dL" },
                        { key: "2", score: "選項 2", text: "183 mg/dL" },
                        { key: "3", score: "選項 3", text: "212 mg/dL" },
                        { key: "4", score: "選項 4", text: "251 mg/dL" }
                    ],
                    revealExplanation: "依據 ADA 與臨床指引換算公式：eAG (mg/dL) = 28.7 × A1C - 46.7。當 A1C 為 9% 時，eAG = 28.7 × 9 - 46.7 = 211.6 ≈ 212 mg/dL！故正確答案為【212 mg/dL】！"
                },
                9: {
                    title: "第 9 題 ‧ 第 2 型糖尿病定期監測項目",
                    speaker: "【初診個案 王先生 (45歲)】",
                    speakerRole: "wang",
                    nurseImg: "assets/wang_bust.png",
                    nurseTag: "初診個案 王先生 (45歲)",
                    backdrop: "assets/rpg_bg_dm_consultation.jpg",
                    voicePath: "assets/voice/dm_stage10.mp3",
                    speech: "王先生，45 歲，新診斷出為<strong style=\"color:#fef08a;\">第 2 型糖尿病</strong>。除了應定期追蹤血糖值外，下列何者通常也建議<strong style=\"color:#fef08a;\">定期監測</strong>？",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 1", text: "肝、腎功能" },
                        { key: "2", score: "選項 2", text: "精神狀態" },
                        { key: "3", score: "選項 3", text: "肌肉量及肌力" },
                        { key: "4", score: "選項 4", text: "血脂肪、血壓" }
                    ],
                    revealExplanation: "第 2 型糖尿病常合併高血壓與血脂異常，大幅增加心血管疾病之風險。因此臨床治療指引強烈建議，除定期監測血糖（FPG、HbA1c）外，亦應定期監測【血脂肪（TC、TG、HDL-C、LDL-C）及血壓】！故正確答案為選項【4】血脂肪、血壓！"
                },
                10: {
                    title: "第 10 題 ‧ 成年人糖尿病篩檢建議風險因子判定",
                    speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
                    speakerRole: "doctor",
                    voicePath: "assets/voice/dm_stage11.mp3",
                    speech: "具有下列那些<strong style=\"color:#fef08a;\">風險因子</strong>的成年人，建議考慮執行<strong style=\"color:#fef08a;\">糖尿病篩檢</strong>？<br>①一等親有糖尿病 ②高血壓且已在服用降血壓藥物 ③三酸甘油酯超過 150 mg/dL ④低密度脂蛋白-膽固醇超過 130 mg/dL ⑤曾經被診斷為 GDM",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "選項 1", text: "①②③" },
                        { key: "2", score: "選項 2", text: "①②⑤" },
                        { key: "3", score: "選項 3", text: "②③④" },
                        { key: "4", score: "選項 4", text: "③④⑤" }
                    ],
                    revealExplanation: "依據糖尿病臨床指引，建議篩檢之風險因子包括：①一等親有糖尿病、②高血壓（≥140/90 mmHg 或正接受降血壓治療）、⑤曾被診斷為妊娠糖尿病（GDM）。另血脂切點為三酸甘油酯（TG）> 250 mg/dL 或 HDL-C < 35 mg/dL（非 LDL-C > 130 或 TG > 150）。故符合建議篩檢之組合為【①②⑤】（正確答案為選項 2：①②⑤）！"
                },
                11: {
                    title: "第 11 題 ‧ 升糖指數（GI）與血糖反應",
                    speaker: "【營養衛教室 ‧ 衛教餐桌】",
                    speakerRole: "nurse",
                    nurseImg: "",
                    nurseTag: "衛教餐桌",
                    backdrop: "assets/rpg_bg_dining_table.jpg",
                    voicePath: "assets/voice/dm_stage11_dining.mp3",
                    speech: "<strong style=\"color:#fef08a;\">下列何種食物中，等量碳水化合物引起的血糖反應最小？</strong><br><span style=\"color:#a7f3d0;font-size:15px;\">💡 請直接點擊餐桌上的食物作答</span>",
                    correctKey: "3",
                    isDiningTableStage: true,
                    options: [
                        { key: "1", score: "選項 A", text: "白米粥" },
                        { key: "2", score: "選項 B", text: "葡萄汁" },
                        { key: "3", score: "選項 C", text: "裸麥麵包" },
                        { key: "4", score: "選項 D", text: "早餐玉米片" }
                    ],
                    revealExplanation: "升糖指數（Glycemic Index, GI）衡量食物引起血糖上升的速度與幅度。裸麥麵包（Rye Bread）富含高纖維與緩消化澱粉，GI 值約 41，是四項食物中等量碳水化合物引起血糖反應最小者！玉米片（GI≈81）與白米粥（GI≈78）屬高 GI 食物，葡萄汁（GI≈52）為中 GI 食物。故正確答案為選項【C 裸麥麵包】！"
                },
                12: {
                    title: "第 12 題 ‧ 夜間血糖偵探 × 醫療冒險",
                    speaker: "【血糖偵查小隊 隊長】",
                    speakerRole: "detective_leader",
                    nurseImg: "assets/student_female_bust.png",
                    nurseTag: "血糖偵查小隊 隊長",
                    backdrop: "assets/rpg_bg_midnight_ward.jpg",
                    voicePath: "assets/voice/dm_stage12_detective.mp3",
                    isDetectiveStage: true,
                    isTeamBattle: true,
                    speech: "🌙 <strong>深夜 2:00，病人進入睡眠……</strong><br>⚠️ <strong>凌晨出現神秘的「低血糖警報」！</strong><br>🌅 <strong>隔天早晨，血糖卻突然升高！</strong><br><span style=\"color:#38bdf8;\">🕵️‍♀️ 到底發生了什麼事？各組化身「血糖偵查小隊」，破解案件找出造成清晨高血糖的真正原因！</span>",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 1", text: "梭莫基效應（Somogyi effect）：夜間低血糖誘發昇糖素與皮質醇反彈升高" },
                        { key: "2", score: "選項 2", text: "黎明現象（Dawn phenomenon）：清晨生長激素分泌導致生理性胰島素抗性" },
                        { key: "3", score: "選項 3", text: "夜間暴食反應（Night binge eating）：半夜夢遊攝取高碳水化合物" },
                        { key: "4", score: "選項 4", text: "胰島素耗竭（Insulin exhaustion）：凌晨胰島細胞永久功能停止" }
                    ],
                    revealExplanation: "【夜間血糖偵探 案件破解】：夜間凌晨 2-3 點發生低血糖，引發體內升糖素、腎上腺素與皮質醇大量分泌，導致清晨反彈性高血糖，此生理機轉為典型【梭莫基效應（Somogyi effect）】！臨床處置應降低睡前胰島素劑量或補充睡前點心。若凌晨血糖正常或偏高而早晨偏高，則為黎明現象。故正確答案為選項【1】！"
                }
            }
        },
        life: {
            id: "life",
            name: "【單元十五】人生好難題",
            loginTitle: "【輔英科技大學 ‧ 校園生活特別篇】",
            loginDesc: "歡迎進入輔英科技大學保健營養系！請輸入您的參賽暱稱以加入本單元人生大考驗：",
            badge: "校園生活特別篇",
            themeClass: "classroom-theme",
            bodyClass: "unit-life",
            teacherImg: "assets/professor_bust.png",
            teacherName: "保健營養系 吳教授",
            bannerInfo: `                <span class="p-name"><strong>輔英科技大學 保健營養系</strong> ‧ 校園生活特別篇 <span class="p-order campus-life-badge" style="color:#f59e0b;background:rgba(245,158,11,0.15);border-color:rgba(245,158,11,0.4);margin-left:8px;white-space:nowrap;display:inline-block;">🎓 輔英科大校園篇</span></span>
                <span class="p-metrics campus-life-metrics">授課教授：<strong>吳教授</strong> ｜ 考核項目：<strong>南台灣艷陽下趕早八抵達教室的瞬間判定</strong></span>
            `,
            maxStages: 1,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            isLifeQuiz: true,
            leaderboardTitle: "【全班 人生好難題 榮譽榜】",
            certTitle: "【校園人生好難題 ‧ 堅韌意志合格證書】",
            certDesc: "於《膳食療養學》校園生活人生好難題中，頂著南台灣豔陽騎車趕早八，展現無與倫比的幽默與強大心理韌性！",
            certBadgeText: "榮獲「南台灣艷陽早八不敗戰神」榮譽勳章 ☀️",
            steps: [
                { st: 1, txt: "人生好難", num: "1" },
                { st: 2, txt: "英雄榜", num: "🏆" }
            ],
            prologue: [
                {
                    speaker: "【保健營養系 吳教授】",
                    text: "各位同學好！歡迎來到輔英科技大學保健營養系。大學生活除了豐富的專業知識，更有許多猝不及防的人生大考驗...",
                    target: "nurse"
                },
                {
                    speaker: "【大學生】",
                    text: "吳教授好！今天南台灣艷陽高照 36 度，我剛一路狂飆騎車趕早八，現在滿身大汗！",
                    target: "student"
                },
                {
                    speaker: "【保健營養系 吳教授】",
                    text: "很好，保持這份青春與熱血！現在請告訴大家，當你氣喘吁吁衝進教室的瞬間，最殘酷的真相是什麼？若是選錯了，可是會遭到火箭隊魔性大嘲笑的！",
                    target: "nurse"
                }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 人生好難題 ‧ 早八的震撼",
                    speaker: "【保健營養系 吳教授】",
                    speakerRole: "wu",
                    voicePath: "assets/voice/life_stage1.mp3",
                    speech: "<strong style=\"color:#fef08a;\">【人生好難題】在南台灣艷陽下騎車趕早八，抵達教室的瞬間？</strong>",
                    correctKey: "4",
                    isLifeQuiz: true,
                    options: [
                        { key: "1", score: "選項 1", text: "衝進教室，已經熱到像剛洗完澡般滿身大汗" },
                        { key: "2", score: "選項 2", text: "發現教授還沒來，慶幸不用記曠課好震撼" },
                        { key: "3", score: "選項 3", text: "回想熬夜寫完的兩萬字報告，意志力無比強悍" },
                        { key: "4", score: "選項 4", text: "結果發現今天是國定假日，留下一個大大的遺憾" }
                    ],
                    revealExplanation: "南台灣烈日狂飆、滿身大汗、衝進教室卻發現全校空無一人——因為今天是「國定假日」！人生最遙遠的距離不是生與死，而是我飆到學校才發現放假！故正確答案為選項【4】！"
                }
            }
        },
        unit_bfbbb5: {
            id: "unit_bfbbb5",
            name: "【單元十六】健檢報告判讀",
            loginTitle: "【職場健康促進 ‧ 健檢生化判讀】",
            loginDesc: "歡迎進入新竹科學園區跨國科技企業總部！請輸入您的參賽暱稱以加入本單元個案研討：",
            badge: "科技企業健檢",
            themeClass: "tech-company-theme",
            bodyClass: "unit-bfbbb5",
            teacherImg: "assets/chen_bust.png",
            teacherName: "竹科高階主管 陳先生 (48歲)",
            bannerInfo: `
                <span class="p-name"><strong>陳先生 (48歲) ‧ 竹科高階主管</strong> ｜ 每週工時 60h ‧ 常態外食久坐</span>
                <span class="p-metrics">臨床考核：<strong>生化檢驗報告判讀 ‧ 勾選所有異常生化指標 (FPG 138, HbA1c 7.4%, TG 225)</strong></span>
                <span class="p-order" style="color:#38bdf8;background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.4);">📊 個案生化分析</span>
            `,
            maxStages: 1,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 職場健檢報告判讀 TOP 5 榮譽榜】",
            certTitle: "【職場個案生化報告判讀 ‧ 臨床成就證書】",
            certDesc: "於《膳食療養學》職場健康促進臨床個案實戰中，精準判讀高階主管抽血報告之血糖與血脂代謝異常，展現精湛生化判讀能力！",
            certBadgeText: "榮獲「職場生化判讀大師」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "陳先生判讀", num: "1" },
                { st: 2, txt: "榮譽榜", num: "🏆" }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 竹科高階主管陳先生 NCP 生化數據異常判定",
                    speaker: "【竹科高階主管 陳先生 (48歲)】",
                    speakerRole: "chen",
                    voicePath: "assets/voice/dm_stage6.mp3",
                    speech: `「實習營養師您好！我是科技公司的研發主管<br>每週工時長達６０小時，常態外食久坐、沒時間運動<br>這是我公司年度健檢的抽血報告，有哪一些是數值異常的呢？」`,
                    correctKey: "1",
                    isLabMultiStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "確診第 2 型糖尿病，並合併高三酸甘油酯血症" },
                        { key: "2", score: "選項 2", text: "僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準" },
                        { key: "3", score: "選項 3", text: "屬於第 1 型糖尿病，必須立即終生注射胰島素" },
                        { key: "4", score: "選項 4", text: "各項血糖數值皆在正常安全範圍，無代謝異常問題" }
                    ],
                    revealExplanation: "陳先生空腹血糖 FPG 138 mg/dL (≥ 126)、HbA1c 7.4% (≥ 6.5%) 達到糖尿病診斷標準，確診為第 2 型糖尿病；並合併三酸甘油酯 TG 225 mg/dL 偏高（> 150 mg/dL）。其餘 75g OGTT 2小時 (132 mg/dL)、HDL-C (45 mg/dL) 與 LDL-C (115 mg/dL) 皆在正常範圍。故正確答案為選項【1】確診第 2 型糖尿病，並合併高三酸甘油酯血症！"
                },
                2: {
                    title: "第 1 題 ‧ 竹科高階主管陳先生 NCP 生化數據異常判定",
                    speaker: "【竹科高階主管 陳先生 (48歲)】",
                    speakerRole: "chen",
                    voicePath: "assets/voice/dm_stage6.mp3",
                    speech: `「實習營養師您好！我是科技公司的研發主管<br>每週工時長達６０小時，常態外食久坐、沒時間運動<br>這是我公司年度健檢的抽血報告，有哪一些是數值異常的呢？」`,
                    correctKey: "1",
                    isLabMultiStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "確診第 2 型糖尿病，並合併高三酸甘油酯血症" },
                        { key: "2", score: "選項 2", text: "僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準" },
                        { key: "3", score: "選項 3", text: "屬於第 1 型糖尿病，必須立即終生注射胰島素" },
                        { key: "4", score: "選項 4", text: "各項血糖數值皆在正常安全範圍，無代謝異常問題" }
                    ],
                    revealExplanation: "陳先生空腹血糖 FPG 138 mg/dL (≥ 126)、HbA1c 7.4% (≥ 6.5%) 達到糖尿病診斷標準，確診為第 2 型糖尿病；並合併三酸甘油酯 TG 225 mg/dL 偏高（> 150 mg/dL）。其餘 75g OGTT 2小時 (132 mg/dL)、HDL-C (45 mg/dL) 與 LDL-C (115 mg/dL) 皆在正常範圍。故正確答案為選項【1】確診第 2 型糖尿病，並合併高三酸甘油酯血症！"
                }
            }
        },
        bfbbb5: {
            id: "unit_bfbbb5",
            name: "【單元十六】健檢報告判讀",
            loginTitle: "【職場健康促進 ‧ 健檢生化判讀】",
            loginDesc: "歡迎進入新竹科學園區跨國科技企業總部！請輸入您的參賽暱稱以加入本單元個案研討：",
            badge: "科技企業健檢",
            themeClass: "tech-company-theme",
            bodyClass: "unit-bfbbb5",
            teacherImg: "assets/chen_bust.png",
            teacherName: "竹科高階主管 陳先生 (48歲)",
            bannerInfo: `
                <span class="p-name"><strong>陳先生 (48歲) ‧ 竹科高階主管</strong> ｜ 每週工時 60h ‧ 常態外食久坐</span>
                <span class="p-metrics">臨床考核：<strong>生化檢驗報告判讀 ‧ 勾選所有異常生化指標 (FPG 138, HbA1c 7.4%, TG 225)</strong></span>
                <span class="p-order" style="color:#38bdf8;background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.4);">📊 個案生化分析</span>
            `,
            maxStages: 1,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 職場健檢報告判讀 TOP 5 榮譽榜】",
            certTitle: "【職場個案生化報告判讀 ‧ 臨床成就證書】",
            certDesc: "於《膳食療養學》職場健康促進臨床個案實戰中，精準判讀高階主管抽血報告之血糖與血脂代謝異常，展現精湛生化判讀能力！",
            certBadgeText: "榮獲「職場生化判讀大師」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "陳先生判讀", num: "1" },
                { st: 2, txt: "榮譽榜", num: "🏆" }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 竹科高階主管陳先生 NCP 生化數據異常判定",
                    speaker: "【竹科高階主管 陳先生 (48歲)】",
                    speakerRole: "chen",
                    voicePath: "assets/voice/dm_stage6.mp3",
                    speech: `「實習營養師您好！我是科技公司的研發主管<br>每週工時長達６０小時，常態外食久坐、沒時間運動<br>這是我公司年度健檢的抽血報告，有哪一些是數值異常的呢？」`,
                    correctKey: "1",
                    isLabMultiStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "確診第 2 型糖尿病，並合併高三酸甘油酯血症" },
                        { key: "2", score: "選項 2", text: "僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準" },
                        { key: "3", score: "選項 3", text: "屬於第 1 型糖尿病，必須立即終生注射胰島素" },
                        { key: "4", score: "選項 4", text: "各項血糖數值皆在正常安全範圍，無代謝異常問題" }
                    ],
                    revealExplanation: "陳先生空腹血糖 FPG 138 mg/dL (≥ 126)、HbA1c 7.4% (≥ 6.5%) 達到糖尿病診斷標準，確診為第 2 型糖尿病；並合併三酸甘油酯 TG 225 mg/dL 偏高（> 150 mg/dL）。其餘 75g OGTT 2小時 (132 mg/dL)、HDL-C (45 mg/dL) 與 LDL-C (115 mg/dL) 皆在正常範圍。故正確答案為選項【1】確診第 2 型糖尿病，並合併高三酸甘油酯血症！"
                },
                2: {
                    title: "第 1 題 ‧ 竹科高階主管陳先生 NCP 生化數據異常判定",
                    speaker: "【竹科高階主管 陳先生 (48歲)】",
                    speakerRole: "chen",
                    voicePath: "assets/voice/dm_stage6.mp3",
                    speech: `「實習營養師您好！我是科技公司的研發主管<br>每週工時長達６０小時，常態外食久坐、沒時間運動<br>這是我公司年度健檢的抽血報告，有哪一些是數值異常的呢？」`,
                    correctKey: "1",
                    isLabMultiStage: true,
                    options: [
                        { key: "1", score: "選項 1", text: "確診第 2 型糖尿病，並合併高三酸甘油酯血症" },
                        { key: "2", score: "選項 2", text: "僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準" },
                        { key: "3", score: "選項 3", text: "屬於第 1 型糖尿病，必須立即終生注射胰島素" },
                        { key: "4", score: "選項 4", text: "各項血糖數值皆在正常安全範圍，無代謝異常問題" }
                    ],
                    revealExplanation: "陳先生空腹血糖 FPG 138 mg/dL (≥ 126)、HbA1c 7.4% (≥ 6.5%) 達到糖尿病診斷標準，確診為第 2 型糖尿病；並合併三酸甘油酯 TG 225 mg/dL 偏高（> 150 mg/dL）。其餘 75g OGTT 2小時 (132 mg/dL)、HDL-C (45 mg/dL) 與 LDL-C (115 mg/dL) 皆在正常範圍。故正確答案為選項【1】確診第 2 型糖尿病，並合併高三酸甘油酯血症！"
                }
            }
        },
        curriculum_03: {
            id: "unit_curriculum_03",
            name: "【單元三】體重控制與管理",
            loginTitle: "【體重控制與管理 ‧ 臨床營養學能檢定】",
            loginDesc: "歡迎進入臨床營養專題研討室！請輸入您的參賽暱稱以加入本單元競賽：",
            badge: "體重控制門診",
            themeClass: "ward-theme",
            bodyClass: "unit-curriculum-03",
            teacherImg: "assets/icu_dietitian_bust.png",
            teacherName: "臨床營養名師 紀晨希 營養師",
            bannerInfo: `
                <span class="p-name"><strong>臨床營養專題研討室</strong> ‧ 體重控制與飲食障礙臨床檢定</span>
                <span class="p-metrics">主責導師：<strong>紀晨希 營養師</strong> ｜ 考核重點：<strong>體液失衡水腫 ‧ 飲食障礙診斷與營養素需求</strong></span>
            `,
            maxStages: 6,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 體重控制與管理檢定 TOP 5 榮譽榜】",
            certTitle: "【體重控制與管理 ‧ 臨床專業學能合格證書】",
            certDesc: "於《膳食療養學》體重控制與飲食障礙臨床專題中，精準掌握身體組成、白色脂肪生理、厭食症、暴食症、飲食障礙與體液失衡水腫蛋白質之臨床營養學能，展現卓越專業實力！",
            certBadgeText: "榮獲「體重管理臨床先鋒」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "身體組成", num: "1" },
                { st: 2, txt: "白色脂肪", num: "2" },
                { st: 3, txt: "神經厭食", num: "3" },
                { st: 4, txt: "暴食症", num: "4" },
                { st: 5, txt: "飲食障礙", num: "5" },
                { st: 6, txt: "體液失衡", num: "6" },
                { st: 7, txt: "榮譽榜", num: "🏆" }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 身體組成",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_ward.jpg",
                    voicePath: "assets/voice/curriculum_03_stage6.mp3",
                    speech: "下列有關身體組成的敘述，何者錯誤？",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 A", text: "體脂肪（fat mass）存在於腦、骨骼肌及脂肪組織" },
                        { key: "2", score: "選項 B", text: "男性的瘦體組織（lean body mass）較女性多" },
                        { key: "3", score: "選項 C", text: "一般而言，同年齡同性別之正常健康人，體組成中非體脂肪（fat free mass）之比例相似" },
                        { key: "4", score: "選項 D", text: "非體脂肪（fat free mass）即是瘦體組織（lean body mass）" }
                    ],
                    revealExplanation: "非體脂肪（Fat-Free Mass, FFM）與瘦體組織（Lean Body Mass, LBM）定義不同！FFM 是完全扣除體內所有脂質（含儲存脂肪與必需脂肪）後的組織重量（包含骨骼、肌肉、水分與無機鹽等）；而 LBM 則包含了維持生命運作不可或缺的「必需脂肪（Essential Fat，約佔 3~5%）」，兩者並不相等！故錯誤（應選）答案為選項【D 非體脂肪（fat free mass）即是瘦體組織（lean body mass）】！"
                },
                2: {
                    title: "第 2 題 ‧ 白色脂肪組織",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_unit3_stage5_adipose.png",
                    voicePath: "assets/voice/curriculum_03_stage5.mp3",
                    speech: "有關白色脂肪組織的敘述，下列何者錯誤？",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "選項 A", text: "因含有 Carotene 顏色為淡黃色" },
                        { key: "2", score: "選項 B", text: "可保護體內臟器避免碰撞傷害" },
                        { key: "3", score: "選項 C", text: "提供新生兒產熱" },
                        { key: "4", score: "選項 D", text: "儲存三酸甘油酯" }
                    ],
                    revealExplanation: "白色脂肪組織（White Adipose Tissue, WAT）主要功能為儲存三酸甘油酯能量、維持體溫隔熱及保護內臟避免碰撞傷害，且因溶解胡蘿蔔素（Carotene）而呈現淡黃色。而【提供新生兒產熱】是『棕色脂肪組織（Brown Adipose Tissue, BAT）』的核心功能（富含解偶聯蛋白 UCP-1），非白色脂肪組織之功能！故錯誤（應選）答案為選項【C 提供新生兒產熱】！"
                },
                3: {
                    title: "第 3 題 ‧ 神經性厭食症病人的營養素需求",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_anorexia_counseling_v2.jpg",
                    voicePath: "assets/voice/curriculum_03_stage2.mp3",
                    speech: "有關神經性厭食症（anorexia nervosa）病人的營養素需求，下列何者正確？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "低體重病人常有維生素 B1 缺乏，再餵食（refeeding）階段需額外補充" },
                        { key: "2", score: "選項 B", text: "低體重病人血清 25-hydroxy vitamin D 濃度通常過高" },
                        { key: "3", score: "選項 C", text: "因高胡蘿蔔素血症（hypercarotenemia），需限制病人類胡蘿蔔素的攝取" },
                        { key: "4", score: "選項 D", text: "限鈉飲食（2 公克／天）對病人的水分滯留沒有幫助" }
                    ],
                    revealExplanation: "神經性厭食症（Anorexia Nervosa）長期嚴重飢餓、低體重病人常合併維生素 B1（Thiamine）缺乏；在重新開始給予營養（Refeeding）時，碳水化合物代謝會大量消耗維生素 B1，若未預先補充極易引發魏尼凱腦病變（Wernicke encephalopathy）或再餵食症候群，因此需額外補充！故正確答案為選項【A】！"
                },
                4: {
                    title: "第 4 題 ‧ 暴食症（Bulimia）的診斷標準",
                    speaker: "【題目說明】",
                    speakerRole: "",
                    nurseImg: "",
                    nurseTag: "",
                    backdrop: "assets/rpg_bg_bulimia_binge_eating.jpg",
                    voicePath: "assets/voice/curriculum_03_stage3_question.mp3",
                    speech: "有關暴食症（Bulimia）的診斷標準之敘述，下列何者正確？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "個案重複發生暴食現象，在一段獨立時間內（如 2 小時）吃下很大量食物" },
                        { key: "2", score: "選項 B", text: "體重顯著下降，且對自己身材的纖瘦沒有感覺" },
                        { key: "3", score: "選項 C", text: "個案常催吐、不當使用瀉劑或利尿劑，易造成貧血" },
                        { key: "4", score: "選項 D", text: "個案常發生皮膚乾燥、營養不良等問題，應即時補充熱量與蛋白質等" }
                    ],
                    revealExplanation: "依據 DSM 診斷標準，暴食症（Bulimia Nervosa）之核心特徵為重複發生暴食（Binge eating）事件，即在一段明確獨立的時間內（如 2 小時內）攝取遠大於一般人在此情境下所能吃下的極大量食物，且伴隨無法控制進食的感覺！故正確答案為選項【A】！"
                },
                5: {
                    title: "第 5 題 ‧ 飲食障礙與體重過輕診斷依據",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_unit3_stage4_anorexia.png",
                    voicePath: "assets/voice/curriculum_03_stage4.mp3",
                    speech: "體重過輕仍然非常害怕變胖為下列何種飲食障礙的診斷依據之一？",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "選項 A", text: "bulimia nervosa" },
                        { key: "2", score: "選項 B", text: "anorexia nervosa" },
                        { key: "3", score: "選項 C", text: "binge-eating disorder" },
                        { key: "4", score: "選項 D", text: "night eating syndrome" }
                    ],
                    revealExplanation: "神經性厭食症（Anorexia Nervosa）的典型診斷特徵為限制能量攝取導致顯著體重過輕，即使體重已經嚴重過輕，個案仍對體重增加或變胖感到強烈的恐懼（Intense fear of gaining weight or becoming fat），並存在體型與體重知覺扭曲！故正確答案為選項【B anorexia nervosa】！"
                },
                6: {
                    title: "第 6 題 ‧ 營養不良與體液失衡水腫蛋白質",
                    speaker: "【紀晨希 營養師】",
                    speakerRole: "nurse",
                    nurseImg: "assets/icu_dietitian_bust.png",
                    nurseTag: "紀晨希 營養師",
                    backdrop: "assets/rpg_bg_unit3_stage1_proteins.jpg?v=20261010_ext",
                    voicePath: "assets/voice/curriculum_03_stage1.mp3",
                    speech: "營養不良時，造成體液失衡及引起水腫是因為血中何種蛋白質下降？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "白蛋白" },
                        { key: "2", score: "選項 B", text: "角蛋白" },
                        { key: "3", score: "選項 C", text: "鐵蛋白" },
                        { key: "4", score: "選項 D", text: "球蛋白" }
                    ],
                    revealExplanation: "白蛋白（Albumin）是維持血漿膠體滲透壓（Colloid Osmotic Pressure）最重要的蛋白質。營養不良或蛋白質攝取不足時，血中白蛋白濃度下降，導致血管內膠體滲透壓降低，水分外滲至組織間隙引起水腫（Edema）與體液失衡！故正確答案為選項【A 白蛋白】！"
                }
            }
        },
        new_student_trial: {
            id: "new_student_trial",
            name: "解鎖專業營養師勳章",
            loginTitle: "解鎖專業營養師勳章",
            loginDesc: "歡迎來到營養勇者訓練所！請輸入您的勇者暱稱以加入試煉：",
            badge: "營養勇者傳",
            bannerInfo: `
                <span class="p-name"><strong>營養勇者傳</strong> ‧ 解鎖專業營養師徽章</span>
                <span class="p-metrics">當前進度：<strong>第 1 關 醫療之城</strong> ｜ 任務：<strong>王伯伯臨床營養評估</strong></span>
                <span class="p-order">🏥 醫療之城試煉</span>
            `,
            teacherName: "輔英科大保健營養系 伊麗克絲 營養師",
            teacherImg: "assets/mentor_guide.png",
            themeClass: "new-student-trial-theme",
            bodyClass: "unit-new_student_trial",
            maxStages: 1,
            pointsPerQuestion: 250,
            hasGrandmaThank: false,
            leaderboardTitle: "【營養勇者傳 TOP 5 英雄榜】",
            certTitle: "【營養勇者傳 ‧ 專業營養師榮譽證書】",
            certDesc: "通過營養勇者試煉，成功解鎖【第 1 關：醫療之城】核心臨床營養評估技能與專業營養師徽章！",
            certBadgeText: "榮獲「專業營養師徽章」🏅",
            steps: [
                { st: 1, txt: "醫療之城", num: "1" },
                { st: 2, txt: "英雄榜", num: "🏆" }
            ],
            stages: {
                1: {
                    title: "第 1 關 ‧ 營養勇者傳：解鎖專業營養師徽章",
                    speaker: "輔英科大保健營養系 伊麗克絲 營養師",
                    speakerRole: "mentor",
                    nurseImg: "assets/mentor_guide.png",
                    nurseTag: "輔英科大保健營養系 伊麗克絲 營養師",
                    backdrop: "assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v3",
                    speech: "",
                    correctKey: "1",
                    options: [],
                    revealExplanation: "勇者成功進入【醫療之城】，開啟專業臨床營養治療與照護試煉，解鎖專業營養師徽章！"
                }
            }
        },
        curriculum_07: {
            id: "unit_curriculum_07",
            name: "【單元七】腎臟疾病之營養治療",
            loginTitle: "【腎臟疾病之營養治療 ‧ 臨床營養學能檢定】",
            loginDesc: "歡迎進入腎臟專科研討室！請輸入您的參賽暱稱以加入本單元競賽：",
            badge: "腎臟專科門診",
            themeClass: "dm-theme",
            bodyClass: "unit-curriculum-07",
            teacherImg: "assets/doctor_bust.png",
            teacherName: "江柏叡 腎臟專科主任醫師",
            bannerInfo: `
                <span class="p-name"><strong>腎臟專科臨床研討室</strong> ‧ 腎臟疾病與透析營養治療檢定</span>
                <span class="p-metrics">主責醫師：<strong>江柏叡 主任醫師</strong> ｜ 考核重點：<strong>腎功能指標 ‧ CKD分期 ‧ 透析乾體重與病因評估</strong></span>
            `,
            maxStages: 6,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: "【全班 腎臟疾病營養治療檢定 TOP 5 榮譽榜】",
            certTitle: "【腎臟疾病之營養治療 ‧ 臨床專業學能合格證書】",
            certDesc: "於《膳食療養學》腎臟疾病專題中，精準掌握腎功能指標、CKD分期判定、低蛋白飲食處方原則、ESRD致病機轉與透析乾體重管理之核心臨床營養學能，表現優異！",
            certBadgeText: "榮獲「腎臟營養專科先鋒」榮譽勳章 🏅",
            steps: [
                { st: 1, txt: "腎功能指標", num: "1" },
                { st: 2, txt: "CKD分期", num: "2" },
                { st: 3, txt: "低蛋白處方", num: "3" },
                { st: 4, txt: "營養素限制", num: "4" },
                { st: 5, txt: "末期腎病ESRD", num: "5" },
                { st: 6, txt: "透析乾體重", num: "6" },
                { st: 7, txt: "榮譽榜", num: "🏆" }
            ],
            stages: {
                1: {
                    title: "第 1 題 ‧ 測量腎臟功能常用參考指標",
                    speaker: "【江柏叡 主任醫師】",
                    speakerRole: "doctor",
                    nurseImg: "assets/doctor_bust.png",
                    nurseTag: "江柏叡 主任醫師",
                    backdrop: "assets/rpg_bg_moba_battlefield_hd.jpg?v=20261010_v3",
                    isKidneyRpgStage: true,
                    voicePath: "assets/voice/curriculum_07_stage1.mp3",
                    speech: "下列何者不是測量腎臟功能的常用參考指標？",
                    correctKey: "2",
                    options: [
                        { key: "1", score: "選項 A", text: "尿液白蛋白排泄率（urinary albumin excretion rate）" },
                        { key: "2", score: "選項 B", text: "血漿白蛋白濃度（plasma albumin concentration）" },
                        { key: "3", score: "選項 C", text: "血漿菊糖清除率（clearance of inulin）" },
                        { key: "4", score: "選項 D", text: "血漿肌酸酐清除率（clearance of creatinine）" }
                    ],
                    revealExplanation: "血漿白蛋白濃度（Plasma albumin concentration）主要反映肝臟合成功能、營養狀態或發炎反應（負急性期蛋白），而非評估腎臟功能（濾過率或排泄能力）的指標；相較之下，尿液白蛋白排泄率（評估腎絲球濾過屏障）、血漿菊糖清除率（GFR 黃金標準）及血漿肌酸酐清除率（臨床常用 GFR 評估法）皆為評估腎功能的指標！故非測量腎功能常用指標之答案為選項【B 血漿白蛋白濃度】！"
                },
                2: {
                    title: "第 2 題 ‧ 慢性腎臟病（CKD）分期判定",
                    speaker: "【江柏叡 主任醫師】",
                    speakerRole: "doctor",
                    nurseImg: "assets/doctor_bust.png",
                    nurseTag: "江柏叡 主任醫師",
                    backdrop: "assets/rpg_bg_clinic.jpg",
                    voicePath: "assets/voice/curriculum_07_stage2.mp3",
                    speech: "王小姐畢業後出國工作一直沒有追蹤腎功能，十年後返臺進行全身健康檢查發現 glomerular filtration rate 為 42 mL/min/1.73m2 、三個月後再追蹤仍為 40 mL/min/1.73m2，王小姐目前為 chronic kidney disease 的第幾期？",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "選項 A", text: "G2" },
                        { key: "2", score: "選項 B", text: "G3a" },
                        { key: "3", score: "選項 C", text: "G3b" },
                        { key: "4", score: "選項 D", text: "G4a" }
                    ],
                    revealExplanation: "依據 KDIGO 慢性腎臟病（CKD）分期標準：G1: GFR ≥ 90、G2: 60~89、G3a: 45~59、G3b: 30~44、G4: 15~29、G5: < 15 mL/min/1.73m²。王小姐 GFR 連續三個月追蹤為 40~42 mL/min/1.73m²，落在 30~44 區間，故確診為【G3b】期！正確答案為選項【C G3b】！"
                },
                3: {
                    title: "第 3 題 ‧ 慢性腎臟病 G3b 期飲食處方評估",
                    speaker: "【江柏叡 主任醫師】",
                    speakerRole: "doctor",
                    nurseImg: "assets/doctor_bust.png",
                    nurseTag: "江柏叡 主任醫師",
                    backdrop: "assets/kidney_stage3_question_custom.png",
                    voicePath: "assets/voice/curriculum_07_stage3_custom.mp3",
                    speech: "王小姐身高 162 公分、體重 60 公斤，平日有健身重訓，在此階段，下列何飲食處方最不適合王小姐？",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "選項 A", text: "熱量 2,100 大卡、蛋白質 45 公克" },
                        { key: "2", score: "選項 B", text: "熱量 2,100 大卡、蛋白質 36 公克" },
                        { key: "3", score: "選項 C", text: "熱量 2,100 大卡、蛋白質 90 公克" },
                        { key: "4", score: "選項 D", text: "熱量 1,680 大卡、蛋白質 36 公克" }
                    ],
                    revealExplanation: "王小姐經確診為慢性腎臟病 G3b 期（未透析），臨床飲食治療原則應採「低蛋白飲食」（LPD，每日約 0.6~0.8 g/kg，以 60 公斤計算約為 36~48 公克/天，並維持熱量充足 30~35 kcal/kg 約 1,800~2,100 大卡），以減輕含氮廢物堆積並延緩腎功能衰退。選項【C】蛋白質給予高達 90 公克（1.5 g/kg，屬高蛋白飲食），會大幅增加腎絲球過濾負擔與尿毒素累積，最不適合王小姐！故最不適合之答案為選項【C 熱量 2,100 大卡、蛋白質 90 公克】！"
                },
                4: {
                    title: "第 4 題 ‧ 慢性腎臟病 Stage 4 營養素限制評估",
                    speaker: "【臨床營養師】",
                    speakerRole: "nurse",
                    nurseImg: "",
                    nurseTag: "",
                    backdrop: "assets/kidney_stage4_nutrient_bg.jpg",
                    voicePath: "assets/voice/curriculum_07_stage4_nutrient.mp3",
                    speech: "慢性腎臟病 Stage 4 的病人不需要限制下列何種營養素的攝取？",
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 A", text: "鈣" },
                        { key: "2", score: "選項 B", text: "磷" },
                        { key: "3", score: "選項 C", text: "鈉" },
                        { key: "4", score: "選項 D", text: "鉀" }
                    ],
                    revealExplanation: "慢性腎臟病（CKD）Stage 4 病人腎功能顯著減退，排泄磷、鈉、鉀的能力明顯受損，易導致高血磷、高血壓水腫與致命性高血鉀，臨床飲食治療指引強烈建議嚴格限制「磷、鈉、鉀」之攝取；相反地，此階段活化維生素 D3 之功能降低且常伴隨低血鈣，一般不需限制鈣攝取（甚至常需適量補充鈣或服用碳酸鈣等磷結合劑），故不需要限制攝取之營養素為選項【A 鈣】！"
                },
                5: {
                    title: "第 5 題 ‧ 末期腎臟病（ESRD）致病危險因子",
                    speaker: "【江柏叡 主任醫師】",
                    speakerRole: "doctor",
                    nurseImg: "assets/doctor_bust.png",
                    nurseTag: "江柏叡 主任醫師",
                    backdrop: "assets/kidney_stage3_video_final_frame.png",
                    voicePath: "assets/voice/curriculum_07_stage3.mp3",
                    speech: "末期腎臟病（ESRD），與下列何種疾病最不相關？",
                    correctKey: "4",
                    options: [
                        { key: "1", score: "選項 A", text: "高血壓" },
                        { key: "2", score: "選項 B", text: "糖尿病" },
                        { key: "3", score: "選項 C", text: "腎絲球腎炎" },
                        { key: "4", score: "選項 D", text: "克隆氏症" }
                    ],
                    revealExplanation: "導致末期腎臟病（ESRD）的三大主要原發/繼發病因為糖尿病腎病變、高血壓性腎病變及慢性腎絲球腎炎。克隆氏症（Crohn's disease）為慢性發炎性腸道疾病（IBD），主要侵犯腸道，與末期腎臟病無直接致病關聯！故最不相關之答案為選項【D 克隆氏症】！"
                },
                6: {
                    title: "第 6 題 ‧ 透析病人乾體重（Dry Weight）評估目的",
                    speaker: "【高健宇 主治醫師】",
                    speakerRole: "muscle_doctor",
                    nurseImg: "assets/handsome_muscle_doctor_bust.png",
                    nurseTag: "高健宇 主治醫師",
                    backdrop: "assets/kidney_stage4_question_bg.png",
                    voicePath: "assets/voice/curriculum_07_stage4.mp3",
                    speech: "有關醫師評估透析病人乾體重（dry weight）的目的，下列何者錯誤？",
                    correctKey: "3",
                    options: [
                        { key: "1", score: "選項 A", text: "維持體內最佳體液容積" },
                        { key: "2", score: "選項 B", text: "維持正常血壓" },
                        { key: "3", score: "選項 C", text: "減少蛋白尿" },
                        { key: "4", score: "選項 D", text: "降低死亡率" }
                    ],
                    revealExplanation: "透析病人的「乾體重（Dry Weight）」是指透析後無水腫、血壓正常的理想最低體重，其目的在於維持體內最佳體液容積、維持正常血壓並降低心血管死亡率。透析病人腎功能多已完全衰竭（尿量極少或無尿），評估乾體重之目的並非「減少蛋白尿」！故錯誤（應選）答案為選項【C 減少蛋白尿】！"
                }
            }
        },
        unit_curriculum_03: null,
        unit_curriculum_07: null
    };
    unitDefinitions.unit_curriculum_03 = unitDefinitions.curriculum_03;
    unitDefinitions.unit_curriculum_07 = unitDefinitions.curriculum_07;
    unitDefinitions.unit_new_student_trial = unitDefinitions.new_student_trial;
    const curriculum03BaseStages = JSON.parse(JSON.stringify(unitDefinitions.curriculum_03.stages));
    const curriculum07BaseStages = JSON.parse(JSON.stringify(unitDefinitions.curriculum_07.stages));

    function isNewStudentTrialUnit(uKey) {
        const k = String(uKey || (typeof activeUnit !== 'undefined' ? activeUnit : '')).toLowerCase().replace(/^unit_/, '');
        if (!k) return false;
        // Standard courses must NEVER be treated as trial units
        if (k === 'must' || k === 'support' || k === 'dm' || k === 'ncp' || k === 'life' || k.startsWith('curriculum_')) {
            return false;
        }
        if (k === 'new_student_trial' || k === 'f47185' || k.includes('hero') || k.includes('trial')) return true;
        if (typeof currentUnitConf !== 'undefined' && currentUnitConf) {
            const confId = String(currentUnitConf.id || '').toLowerCase().replace(/^unit_/, '');
            if (confId === 'must' || confId === 'support' || confId === 'dm' || confId === 'ncp' || confId === 'life' || confId.startsWith('curriculum_')) {
                return false;
            }
            if (confId === 'new_student_trial' || confId === 'f47185') return true;
            if (currentUnitConf.themeClass === 'new-student-trial-theme') return true;
            const n = (currentUnitConf.name || '') + ' ' + (currentUnitConf.loginTitle || '');
            if (n.includes('勇者') || n.includes('新生')) return true;
        }
        return false;
    }

    // 動態單元情境解析器 (支援後續新增任意自訂單元與題目生成專屬情境)
    function resolveUnitConfig(unitKey, customTitle) {
        if (unitDefinitions[unitKey]) {
            return unitDefinitions[unitKey];
        }
        const isBlankPreparationUnit = false;
        const title = customTitle || urlParams.get('unit_title') || (unitKey === 'new_student_trial' ? '營養勇者傳：解鎖專業營養師徽章' : '【自訂單元】臨床營養專業實戰');
        if (title.includes('人生') || title.includes('早八') || title.includes('校園') || unitKey.includes('life')) {
            return unitDefinitions.life;
        }
        let badge = "專題檢定";
        let bannerIcon = "📘";
        let guideTeacher = "臨床營養科 專任指導師";
        let bgTheme = "ncp-theme";
        let teacherSprite = "assets/director_male_bust.png";

        if (title.includes('勇者') || title.includes('新生') || unitKey === 'f47185' || unitKey === 'new_student_trial') {
            badge = "營養勇者傳";
            bannerIcon = "⚔️";
            guideTeacher = "輔英科大保健營養系 伊麗克絲 營養師";
            bgTheme = "new-student-trial-theme";
            teacherSprite = "assets/mentor_guide.png";
        } else if (title.includes('腎')) {
            badge = "腎臟營養門診";
            bannerIcon = "🩺";
            guideTeacher = "腎臟專科 臨床營養名師";
            bgTheme = "dm-theme";
            teacherSprite = "assets/doctor_bust.png";
        } else if (title.includes('重症') || title.includes('腸道')) {
            badge = "加護重症照護";
            bannerIcon = "🚨";
            guideTeacher = "重症醫學 重症營養專家";
            bgTheme = "ward-theme";
            teacherSprite = "assets/director_male_bust.png";
        } else if (title.includes('心')) {
            badge = "心血管專科門診";
            bannerIcon = "❤️";
            guideTeacher = "心臟內科 專任營養指導師";
            bgTheme = "dm-theme";
            teacherSprite = "assets/doctor_bust.png";
        }

        return {
            id: unitKey,
            name: title,
            loginTitle: `【${title} ‧ 臨床檢定】`,
            loginDesc: `歡迎進入${badge}！請輸入您的參賽暱稱以加入本單元競賽：`,
            badge: badge,
            themeClass: bgTheme,
            teacherImg: teacherSprite,
            teacherName: guideTeacher,
            bannerInfo: `
                <span class="p-name"><strong>${title}</strong> ‧ 臨床實戰檢定</span>
                <span class="p-metrics">指導導師：<strong>${guideTeacher}</strong> ｜ 考核項目：<strong>專業臨床思維檢定</strong></span>
                <span class="p-order" style="color:#38bdf8;background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.4);">${bannerIcon} 專科精選</span>
            `,
            maxStages: unitStageCounts[unitKey] || 1,
            pointsPerQuestion: 500,
            hasGrandmaThank: false,
            leaderboardTitle: `【全班 ${title} TOP 5 榮譽榜】`,
            certTitle: `【${title} 專業臨床學能合格證書】`,
            certDesc: `於《膳食療養學》${title}檢定中，展現卓越臨床專業知能，順利通過考核！`,
            certBadgeText: "榮獲「臨床營養實戰先鋒」榮譽勳章 🏅",
            isBlankPreparationUnit: isBlankPreparationUnit,
            steps: [
                { st: 1, txt: "核心題", num: "1" },
                { st: 2, txt: "榮譽榜", num: "🏆" }
            ],
            prologue: isBlankPreparationUnit ? [] : [
                {
                    speaker: `【${guideTeacher}】`,
                    text: `各位同學好！歡迎來到${badge}，本單元將考驗各位在《${title}》的專業臨床判斷！`,
                    target: "nurse"
                },
                {
                    speaker: "【實習營養師】",
                    text: "老師好！我們已經準備好迎接挑戰！",
                    target: "student"
                }
            ],
            stages: isBlankPreparationUnit ? {} : {
                1: {
                    title: `STAGE 1 ‧ ${title}`,
                    speaker: `【${guideTeacher}】`,
                    speech: `請依據本題臨床情境進行專業判讀與選擇：`,
                    correctKey: "1",
                    options: [
                        { key: "1", score: "選項 1", text: "標準臨床指引建議項目" },
                        { key: "2", score: "選項 2", text: "次要參考指標" },
                        { key: "3", score: "選項 3", text: "待評估項目" },
                        { key: "4", score: "選項 4", text: "臨床禁忌或非首選" }
                    ],
                    revealExplanation: `本題依據臨床最新實證指引進行評估與判讀！`
                }
            }
        };
    }

    let currentUnitConf = resolveUnitConfig(activeUnit);
    let activeUnitTitle = urlParams.get('unit_title') || currentUnitConf.name;

    // ==============================================
    // DOM 元素快取
    // ==============================================
    const rpgBgmAudio = document.getElementById('rpgBgmAudio');
    function updateSupportStageHeader(stageNum) {
        if (activeUnit !== 'support') return;
        const isShipIntro = Number(stageNum) === 1;
        const isStage10Anatomy = Number(stageNum) === 10;
        const title = document.querySelector('.fyu-title');
        const subtitle = document.querySelector('.fyu-sub');
        const timerLabel = document.querySelector('.t-lbl');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        const patientBanner = document.getElementById('patientBanner');

        if (fyuIcon) {
            fyuIcon.textContent = isShipIntro ? '🚀' : '✚';
            fyuIcon.style.background = '';
            fyuIcon.style.boxShadow = '';
        }
        if (title) {
            title.textContent = isShipIntro
                ? '艦載醫療艙'
                : (isStage10Anatomy ? '輔英科技大學附設醫院 消化系醫學中心' : '輔英科技大學附設醫院 加護醫學部');
        }
        if (subtitle) {
            subtitle.textContent = isShipIntro
                ? '生化生命維持監控中樞 ‧ 鼻胃管故障排查'
                : (isStage10Anatomy ? '人體消化道屏障功能 ‧ 腸道與靜脈營養機轉分析' : '保健營養系 ‧ 重症營養支持與路徑決策評估');
        }
        if (timerLabel) {
            timerLabel.textContent = isShipIntro ? '管線排查' : '重症評估';
        }
        if (patientBanner) {
            if (isStage10Anatomy) {
                patientBanner.classList.add('hidden');
            } else if (isShipIntro) {
                patientBanner.classList.remove('hidden');
                patientBanner.innerHTML = `
                    <div class="banner-badge">艦載醫療艙</div>
                    <div class="banner-info">
                        <span class="p-metrics">管線類型：<strong>NG-01 鼻胃管</strong> ｜ 狀態：<strong>觸發防禦協議 ‧ 故障排查中</strong></span>
                        <span class="p-order" style="color:#ef4444;background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);">⚠️ 排除幽靈錯誤</span>
                    </div>
                `;
            } else {
                patientBanner.classList.remove('hidden');
                patientBanner.innerHTML = `
                    <div class="banner-badge" style="background:#0284c7;color:#fff;">ICU 加護病房</div>
                    <div class="banner-info">
                        <span class="p-name"><strong>加護病房 (ICU) 重症個案</strong> ‧ 臨床營養支持評估</span>
                        <span class="p-metrics">主治團隊：<strong>加護醫學部 趙仁傑 主治醫師 ‧ 紀晨希 營養師</strong> ｜ 處置焦點：<strong>腸道與靜脈營養路徑決策</strong></span>
                    </div>
                `;
            }
        }
    }

    function configureBgmForStage(unit, stageNum) {
        if (!rpgBgmAudio) return;
        const isMustUnit = unit === 'must';
        const isSilentStage = isMustUnit;
        if (bgmToggleBtn) bgmToggleBtn.classList.toggle('hidden', isSilentStage);
        if (isMustUnit) {
            pauseBgm();
            rpgBgmAudio.currentTime = 0;
            bgmWaitingForQuestionVoice = false;
            return;
        }
        if (!isTeacher && activeUnit !== 'new_student_trial' && !isNewStudentTrialUnit(activeUnit)) {
            rpgBgmAudio.pause();
            rpgBgmAudio.currentTime = 0;
            bgmPlaying = false;
            bgmWaitingForQuestionVoice = false;
            return;
        }
        const isSupportStage5_9_11 = (unit === 'support' && (stageNum === 5 || stageNum === 9 || stageNum === 11));
        const isHospitalTrack = (unit === 'support' && stageNum >= 2 && stageNum <= 11 && stageNum !== 5 && stageNum !== 9 && stageNum !== 11);
        bgmWaitingForQuestionVoice = isSupportStage5_9_11;

        let nextSrc = 'assets/new_student_trial_bgm.mp3';
        if (isMedicalCityActive || activeContinentStageKey === 'medical') {
            nextSrc = 'assets/medical_city_bgm.mp3';
        } else if (activeContinentStageKey === 'sports') {
            nextSrc = 'assets/sportive_days_bgm.mp3';
        } else if (activeContinentStageKey === 'port') {
            nextSrc = 'assets/eat_and_enjoy_bgm.mp3';
        } else if (activeContinentStageKey === 'forest') {
            nextSrc = 'assets/forest_back_to_school_bgm.mp3?v=20261025-forest-bgm-v2';
        } else if (unit === 'new_student_trial' || isNewStudentTrialUnit(unit)) {
            nextSrc = 'assets/new_student_trial_bgm.mp3';
        } else if (isSupportStage5_9_11) {
            nextSrc = 'assets/support_stage5_9_bgm.mp3';
        } else if (isHospitalTrack) {
            nextSrc = 'assets/hospital_heart_bgm_55s_to_2m37s.mp3';
        }

        const currentSrc = rpgBgmAudio.getAttribute('src') || '';
        const sourceChanged = !currentSrc.endsWith(nextSrc);

        bgmUsesHospitalTrack = isHospitalTrack || isSupportStage5_9_11;
        bgmBaseVolume = (isHospitalTrack || isSupportStage5_9_11) ? 0.25 : 0.5;
        rpgBgmAudio.loop = true;
        if (sourceChanged) {
            rpgBgmAudio.pause();
            bgmPlaying = false;
            rpgBgmAudio.setAttribute('src', nextSrc);
            rpgBgmAudio.load();
            if (bgmToggleBtn) {
                bgmToggleBtn.classList.remove('active');
                bgmToggleBtn.textContent = '🎵 BGM [關]';
            }
        }

        if (unit === 'must' && stageNum === 1) {
            pauseBgm();
            rpgBgmAudio.currentTime = 0;
        } else if (isSupportStage5_9_11) {
            pauseBgm();
            rpgBgmAudio.currentTime = 0;
        } else if (unit === 'new_student_trial' || isNewStudentTrialUnit(unit) || isMedicalCityActive || activeContinentStageKey) {
            playBgm();
            document.addEventListener('pointerdown', () => {
                if ((activeUnit === unit || isMedicalCityActive || activeContinentStageKey) && currentStage === stageNum && !bgmPlaying) playBgm();
            }, { once: true, capture: true });
        } else if (isHospitalTrack && !bgmPlaying) {
            // 切換至單元二關卡時，預設嘗試啟動背景音樂。
            playBgm();
            // 若瀏覽器阻擋自動播放，在使用者第一次操作課堂畫面時再啟動。
            document.addEventListener('pointerdown', () => {
                if (bgmUsesHospitalTrack && !bgmWaitingForQuestionVoice && !bgmPlaying) playBgm();
            }, { once: true, capture: true });
        }
    }

    function startDeferredBgmAfterQuestionVoice(unit, stageNum) {
        if (!bgmWaitingForQuestionVoice || activeUnit !== unit || currentStage !== stageNum) return;
        bgmWaitingForQuestionVoice = false;
        playBgm();
    }

    function configureSupportStage11VideoBackdrop(stageNum, restart) {
        const backdrop = document.getElementById('stageBackdrop');
        const overlay = document.getElementById('supportStage11VideoOverlay');
        const video = document.getElementById('supportStage11Video');
        const unmuteBtn = document.getElementById('supportStage11UnmuteBtn');
        if (!backdrop) return;
        if (overlay && overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }

        const showUnmutePrompt = () => {
            if (unmuteBtn) unmuteBtn.classList.remove('hidden');
        };
        const hideUnmutePrompt = () => {
            if (unmuteBtn) unmuteBtn.classList.add('hidden');
        };

        const tryUnmute = () => {
            if (video && !video.paused) {
                video.muted = false;
                video.volume = 1.0;
                hideUnmutePrompt();
            }
        };

        if (unmuteBtn && unmuteBtn.dataset.bound !== 'true') {
            unmuteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                tryUnmute();
            });
            unmuteBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                tryUnmute();
            }, { passive: true });
            unmuteBtn.dataset.bound = 'true';
        }

        if (overlay && overlay.dataset.unmuteBound !== 'true') {
            overlay.addEventListener('click', () => {
                if (video && video.muted) tryUnmute();
            });
            overlay.addEventListener('touchstart', () => {
                if (video && video.muted) tryUnmute();
            }, { passive: true });
            overlay.dataset.unmuteBound = 'true';
        }

        const isVideoStage = (activeUnit === 'support' && stageNum === 11);
        if (!isVideoStage) {
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
            hideUnmutePrompt();
            if (overlay) overlay.classList.add('hidden');
            return;
        }

        if (!video || !overlay) return;
        if (activeUnit === 'support') {
            backdrop.style.backgroundImage = "url('assets/rpg_bg_support_formula.png')";
        }
        const showStillBackground = () => {
            if (!isVideoStage) return;
            hideUnmutePrompt();
            video.pause();
            overlay.classList.add('hidden');
            video.dataset.finished = 'true';
            if (activeUnit === 'support') {
                backdrop.classList.remove('icu-aspiration-theme', 'icu-tpn-theme', 'support-stage4-theme', 'support-stage2-expanded');
                backdrop.classList.add('support-formula-theme');
                if (supportStage11QuestionReady && !supportStage11QuestionVoiceStarted) {
                    supportStage11QuestionVoiceStarted = true;
                    playQuestionVoice('support', 11);
                }
            } else if (activeUnit === 'dm') {
                backdrop.classList.remove('icu-aspiration-theme', 'icu-tpn-theme', 'support-stage4-theme', 'support-stage2-expanded', 'support-formula-theme');
                backdrop.classList.add('dm-theme');
                try { playQuestionVoice('dm', 1); } catch(e) {}
            }
        };
        if (!restart && video.dataset.finished === 'true') {
            showStillBackground();
            return;
        }
        if (!restart && !overlay.classList.contains('hidden')) return;

        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');
        video.volume = 1.0;
        video.onended = showStillBackground;
        video.onerror = showStillBackground;
        video.dataset.finished = 'false';
        overlay.classList.remove('hidden');
        backdrop.classList.remove('support-formula-theme');
        if (restart) video.currentTime = 0;

        hideUnmutePrompt();
        // Try playing unmuted first; if rejected by mobile autoplay policy, fallback to muted autoplay and show unmute prompt
        video.muted = false;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.then(() => {
                if (video.muted) showUnmutePrompt();
                else hideUnmutePrompt();
            }).catch(() => {
                video.muted = true;
                showUnmutePrompt();
                const retryPromise = video.play();
                if (retryPromise && typeof retryPromise.catch === 'function') {
                    retryPromise.catch(showStillBackground);
                }
            });
        }
    }

    // 單元六第 8 題：選項 3 票數最高時，師生端播放答對動畫；學生端靜音。
    function playDmStage8StudentVideo(optionsMap, highestVoteCount) {
        const unitKey = String(activeUnit || '').toLowerCase().replace(/^unit_/, '');
        if (unitKey !== 'dm' || Number(currentStage) !== 8 || dmStage8VideoShown) return;
        const option3Votes = Number(optionsMap && optionsMap['3']) || 0;
        const isStrictlyHighest = option3Votes > 0 && Object.entries(optionsMap || {}).every(([key, count]) => {
            return String(key) === '3' || option3Votes > (Number(count) || 0);
        });
        if (option3Votes <= 0 || option3Votes !== highestVoteCount || !isStrictlyHighest) return;

        const overlay = document.getElementById('dmStage8VideoOverlay');
        const video = document.getElementById('dmStage8Video');
        if (!overlay || !video) return;
        if (overlay.parentElement !== document.body) document.body.appendChild(overlay);

        dmStage8VideoShown = true;
        dmStage8VideoBgmWasPlaying = !!(bgmPlaying && rpgBgmAudio && !rpgBgmAudio.paused);
        if (rpgBgmAudio) {
            try { rpgBgmAudio.pause(); } catch (e) {}
        }

        const finish = () => {
            try { video.pause(); } catch (e) {}
            video.currentTime = 0;
            video.muted = true;
            overlay.classList.add('hidden');
            if (document.fullscreenElement === overlay && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            if (dmStage8VideoBgmWasPlaying && soundEnabled) playBgm();
            dmStage8VideoBgmWasPlaying = false;
        };

        video.onended = finish;
        video.onerror = finish;
        const muteVideo = !isTeacher;
        video.muted = muteVideo;
        video.volume = muteVideo ? 0 : 1.0;
        video.currentTime = 0;
        overlay.classList.remove('hidden');

        // 瀏覽器若允許，提升為真正全螢幕；否則維持 fixed 全視窗覆蓋層。
        if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
        let playbackStarted = false;
        const startPlayback = () => {
            if (playbackStarted) return;
            playbackStarted = true;
            const playPromise = video.play();
            if (playPromise && playPromise.catch) {
                playPromise.catch(() => {
                    // 教師端若被瀏覽器自動播放政策阻擋，退回靜音播放；學生端始終維持靜音。
                    video.muted = true;
                    video.volume = 0;
                    const retryPromise = video.play();
                    if (retryPromise && retryPromise.catch) retryPromise.catch(finish);
                });
            }
        };
        video.onloadeddata = startPlayback;
        video.oncanplay = startPlayback;
        video.load();
        startPlayback();
    }

    function stopDmStage8StudentVideo() {
        const overlay = document.getElementById('dmStage8VideoOverlay');
        const video = document.getElementById('dmStage8Video');
        if (!overlay || !video) return;
        try { video.pause(); } catch (e) {}
        video.currentTime = 0;
        video.muted = true;
        overlay.classList.add('hidden');
        if (document.fullscreenElement === overlay && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        if (dmStage8VideoBgmWasPlaying && soundEnabled) playBgm();
        dmStage8VideoBgmWasPlaying = false;
    }

    const grandmaVoiceAudio = document.getElementById('grandmaVoiceAudio');
    const npcQuestionVoiceAudio = document.getElementById('npcQuestionVoiceAudio');
    const btnReplayQuestionVoice = document.getElementById('btnReplayQuestionVoice');
    if (btnReplayQuestionVoice) {
        btnReplayQuestionVoice.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            sfxClick();
            toggleQuestionVoice(activeUnit, currentStage);
        });
        btnReplayQuestionVoice.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
    }

    function openTrialLoginFromStart() {
        window.openTrialLoginFromStart = openTrialLoginFromStart;
        window.__fyuTrialLoginOpened = true;
        sfxClick();
        document.documentElement.classList.remove('trial-route');
        document.body.classList.remove('trial-step-0');
        // 此函式由「開始遊戲」的使用者手勢直接觸發，明確解除瀏覽器
        // 首次自動播放失敗時留下的靜音狀態，確保登入畫面開始播放 BGM。
        if (rpgBgmAudio) {
            rpgBgmAudio.autoplay = true;
            rpgBgmAudio.muted = false;
            rpgBgmAudio.volume = bgmBaseVolume;
            const playback = rpgBgmAudio.play();
            if (playback && typeof playback.then === 'function') {
                playback.then(() => {
                    bgmPlaying = true;
                    if (bgmToggleBtn) {
                        bgmToggleBtn.classList.add('active');
                        bgmToggleBtn.textContent = '🎵 BGM [開]';
                    }
                }).catch(() => {
                    playBgm();
                });
            } else {
                bgmPlaying = true;
            }
        } else {
            playBgm();
        }
        // 隱藏其他主場景，開啟登入畫面並啟動 BGM
        if (rpgMainStage) rpgMainStage.classList.add('hidden');
        if (sceneLobby) sceneLobby.classList.add('hidden');
        if (sceneLogin) {
            sceneLogin.classList.remove('hidden');
            const nickInput = document.getElementById('inputNickname');
            if (nickInput) {
                setTimeout(() => nickInput.focus(), 150);
            }
        }
    }

    const btnTrialStartDirectInit = document.getElementById('btnTrialStartDirect');
    if (btnTrialStartDirectInit) {
        btnTrialStartDirectInit.addEventListener('click', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            openTrialLoginFromStart();
        });
    }
    const lobbyHeaderBadge = document.getElementById('lobbyHeaderBadge');
    const lobbyUnitTitleSub = document.getElementById('lobbyUnitTitleSub');
    const lobbyWaitingUnitName = document.getElementById('lobbyWaitingUnitName');
    const genderOptions = document.getElementById('genderOptions');
    const sceneLogin = document.getElementById('sceneLogin');
    const sceneLobby = document.getElementById('sceneLobby');
    const rpgMainStage = document.getElementById('rpgMainStage');

    const inputNickname = document.getElementById('inputNickname');
    const avatarOptions = document.getElementById('avatarOptions');
    const btnChooseAvatarPhoto = document.getElementById('btnChooseAvatarPhoto');
    const avatarPhotoInput = document.getElementById('avatarPhotoInput');
    const avatarPhotoPreview = document.getElementById('avatarPhotoPreview');
    const btnJoinLobby = document.getElementById('btnJoinLobby');

    function updateJoinLobbyButtonState() {
        if (!btnJoinLobby) return;
        const hasNickname = Boolean(inputNickname && inputNickname.value.trim());
        btnJoinLobby.disabled = !hasNickname;
        btnJoinLobby.setAttribute('aria-disabled', String(!hasNickname));
    }

    if (inputNickname) {
        inputNickname.addEventListener('input', updateJoinLobbyButtonState);
        inputNickname.addEventListener('change', updateJoinLobbyButtonState);
    }
    updateJoinLobbyButtonState();

    const lobbyStudentGreeting = document.getElementById('lobbyStudentGreeting');
    const lobbyModeText = document.getElementById('lobbyModeText');
    const lobbyStudentCount = document.getElementById('lobbyStudentCount');
    const studentsBubblesList = document.getElementById('studentsBubblesList');

    const patientBanner = document.getElementById('patientBanner');
    const stageIndicatorBar = document.getElementById('stageIndicatorBar');
    const stageBackdrop = document.getElementById('stageBackdrop');
    if (stageBackdrop) {
        stageBackdrop.addEventListener('click', (e) => {
            if (isMedicalCityActive) {
                if (document.body.classList.contains('medical-food-step') ||
                    e.target.closest('button, #medicalCityIntroVideoOverlay, .medical-city-food-table-area, .table-food-card, #btnSubmitMedicalFood, .continent-stage-hotspot, .p-order')) {
                    return;
                }
                advanceMedicalCityDialogue(e);
                return;
            }
            if (e.target.closest('button, .continent-stage-hotspot, .support-stage10-hotspot, .st-step, #btnReplayQuestionVoice, .medical-city-food-table-area, .table-food-card, #btnSubmitMedicalFood, #sportsIntroVideoOverlay')) {
                return;
            }
            if (activeContinentStageKey === 'sports') {
                if (document.body.classList.contains('sports-quiz-step')) {
                    return;
                }
                if (typeof window.advanceSportsDialogue === 'function') {
                    window.advanceSportsDialogue(e);
                }
                return;
            }
            if (activeContinentStageKey === 'port') {
                if (typeof advancePortDialogue === 'function' && typeof portDialogueStep !== 'undefined' && portDialogueStep < 3) {
                    advancePortDialogue();
                }
                return;
            }
            if (activeContinentStageKey === 'research') {
                return;
            }
            if (isNewStudentTrialUnit(activeUnit) && Number(currentStage) === 1 && !activeContinentStageKey) {
                // 首頁 Step 0 必須點擊「開始遊戲」按鈕，禁止點擊背景空白處跳過登入進入對話
                if (newStudentTrialStep > 0 && newStudentTrialStep < 4) {
                    advanceNewStudentTrialStep();
                }
            }
        });
    }
    const rpgChoicesArea = document.getElementById('rpgChoicesArea');

    const dialogBox = document.getElementById('dialogBox');
    const speakerBadge = document.getElementById('speakerBadge');
    const dialogContent = document.getElementById('dialogContent');
    const dialogIndicator = document.getElementById('dialogIndicator');
    const charNurse = document.getElementById('charNurse');
    const charStudent = document.getElementById('charStudent');
    const charStudentImg = document.getElementById('charStudentImg');
    const charStudentName = document.getElementById('charStudentName');

    // iOS Safari occasionally does not synthesize a click for the transformed dialogue panel.
    // Handle the touch directly and keep the inline click fallback as a second path.
    if (dialogBox) {
        dialogBox.addEventListener('touchend', (event) => {
            if (!document.body.classList.contains('trial-dialog-step')) return;
            if (event.target.closest('button, input, textarea, select, a')) return;
            event.preventDefault();
            event.stopPropagation();
            if (typeof window.__fyuAdvanceTrialDialog === 'function') {
                window.__fyuAdvanceTrialDialog(event);
            }
        }, { passive: false });
        dialogBox.addEventListener('keydown', (event) => {
            if ((event.key === 'Enter' || event.key === ' ') &&
                document.body.classList.contains('trial-dialog-step')) {
                event.preventDefault();
                if (typeof window.__fyuAdvanceTrialDialog === 'function') {
                    window.__fyuAdvanceTrialDialog(event);
                }
            }
        });
    }

    if (speakerBadge) {
        const applyElixColor = () => {
            const text = speakerBadge.textContent || "";
            if ((text.includes("輔英科大保健營養系") || text.includes("輔英科技大學保健營養系") || text.includes("輔英科技大學 保健營養系") || text.includes("伊麗克絲")) && !speakerBadge.querySelector(".speaker-dept-highlight-yellow")) {
                let html = text;
                const deptMatch = text.includes("輔英科技大學 保健營養系") ? "輔英科技大學 保健營養系" : (text.includes("輔英科技大學保健營養系") ? "輔英科技大學保健營養系" : (text.includes("輔英科大保健營養系") ? "輔英科大保健營養系" : null));
                if (deptMatch) {
                    html = html.replace(deptMatch, `<span class="speaker-dept-highlight-yellow">${deptMatch}</span>`);
                }
                if (text.includes("伊麗克絲")) {
                    html = html.replace("伊麗克絲", `<span class="speaker-name-highlight-white">伊麗克絲</span>`);
                if (html.includes("專業營養師")) {
                    html = html.replace("專業營養師", `<span class="speaker-dept-highlight-yellow">專業營養師</span>`);
                }
                }
                speakerBadge.innerHTML = html;
            }
        };
        new MutationObserver(applyElixColor).observe(speakerBadge, { childList: true, characterData: true, subtree: true });
        applyElixColor();
    }

    const questionFeedbackBanner = document.getElementById('questionFeedbackBanner');
    const currentModeTag = document.getElementById('currentModeTag');
    const liveVotesSummary = document.getElementById('liveVotesSummary');
    const liveStatPill = document.getElementById('liveStatPill');
    const optionsGrid = document.getElementById('optionsGrid');
    const optionsGridEl = optionsGrid;

    const grandmaThankModal = document.getElementById('grandmaThankModal');
    const btnReplayGrandmaVoice = document.getElementById('btnReplayGrandmaVoice');
    const btnGrandmaBack = document.getElementById('btnGrandmaBack');
    const btnGrandmaContinue = document.getElementById('btnGrandmaContinue');

    const teacherToggleBtn = document.getElementById('teacherToggleBtn');
    const teacherControlBar = document.getElementById('teacherControlBar');
    const btnCloseTeacherBar = document.getElementById('btnCloseTeacherBar');
    const tcBtnStartGame = document.getElementById('tcBtnStartGame');
    const tcStageText = document.getElementById('tcStageText');
    const tcVotesText = document.getElementById('tcVotesText');
    const tcBtnNext = document.getElementById('tcBtnNext');
    const tcBtnPrev = document.getElementById('tcBtnPrev');
    const tcBtnReveal = document.getElementById('tcBtnReveal');
    const tcBtnShowLeaderboard = document.getElementById('tcBtnShowLeaderboard');
    const tcBtnReset = document.getElementById('tcBtnReset');
    const lobbyTeacherStartBtn = document.getElementById('lobbyTeacherStartBtn');

    const bgmToggleBtn = document.getElementById('bgmToggleBtn');
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const timerVal = document.getElementById('timerVal');

    // ==============================================
    // 字體縮放控制器 (A⁺ / A⁻ 放大與縮小)
    // ==============================================
    const btnZoomInFont = document.getElementById('btnZoomInFont');
    const btnZoomOutFont = document.getElementById('btnZoomOutFont');
    let currentFontScale = parseFloat(urlParams.get('font_scale')) || parseFloat(localStorage.getItem('fyu_font_scale')) || 1.0;

    function applyFontScale(scale) {
        currentFontScale = Math.min(2.2, Math.max(0.7, Math.round(scale * 100) / 100));
        document.documentElement.style.setProperty('--font-scale', currentFontScale);
        if (document.body) document.body.style.setProperty('--font-scale', currentFontScale);
        localStorage.setItem('fyu_font_scale', currentFontScale.toString());

        if (dialogContent) {
            dialogContent.style.setProperty('font-size', `calc(17px * ${currentFontScale})`, 'important');
        }

        // 全面即時套用至所有現存之選項按鈕、文字、徽章、表格 (支援單元一第1~4題、單元三第6題及後續所有題目)
        document.querySelectorAll('#dialogContent, .dialog-text-body').forEach(el => {
            el.style.setProperty('font-size', `calc(17px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.choice-text').forEach(el => {
            el.style.setProperty('font-size', `calc(16.5px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.choice-score-badge').forEach(el => {
            el.style.setProperty('font-size', `calc(13.5px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.choice-key-badge').forEach(el => {
            el.style.setProperty('font-size', `calc(13px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.choice-pct-pill, .choice-votes-cnt').forEach(el => {
            if (el.closest('.protein-option-votes')) return;
            el.style.setProperty('font-size', `calc(13.5px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.scifi-opt-btn, .scifi-opt-btn .opt-label, .scifi-opt-btn .opt-prefix').forEach(el => {
            el.style.setProperty('font-size', `calc(16px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.arcane-opt-btn, .arcane-opt-btn .rune-label').forEach(el => {
            el.style.setProperty('font-size', `calc(16px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.clean-lab-table th').forEach(el => {
            el.style.setProperty('font-size', `calc(14.5px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.clean-lab-table td, .lab-val').forEach(el => {
            el.style.setProperty('font-size', `calc(15px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.check-text').forEach(el => {
            el.style.setProperty('font-size', `calc(13px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.btn-submit-lab-multi, .btn-a1c-attack').forEach(el => {
            el.style.setProperty('font-size', `calc(16px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('.tablet-question-text').forEach(el => {
            el.style.setProperty('font-size', `calc(15.5px * ${currentFontScale})`, 'important');
        });
        document.querySelectorAll('#choiceHeaderPrompt, .live-title').forEach(el => {
            el.style.setProperty('font-size', `calc(14.5px * ${currentFontScale})`, 'important');
        });
    }
    applyFontScale(currentFontScale);

    if (btnZoomInFont) {
        btnZoomInFont.addEventListener('click', (e) => {
            e.stopPropagation();
            sfxClick();
            applyFontScale(currentFontScale + 0.15);
        });
    }
    if (btnZoomOutFont) {
        btnZoomOutFont.addEventListener('click', (e) => {
            e.stopPropagation();
            sfxClick();
            applyFontScale(currentFontScale - 0.15);
        });
    }


    const rpgVictoryModal = document.getElementById('rpgVictoryModal');
    const top5ListContainer = document.getElementById('top5ListContainer');
    const teamVictoryBanner = document.getElementById('teamVictoryBanner');
    const winningTeamName = document.getElementById('winningTeamName');
    const winningTeamScore = document.getElementById('winningTeamScore');
    const certName = document.getElementById('certName');
    const certId = document.getElementById('certId');
    const btnDownloadCert = document.getElementById('btnDownloadCert');
    const btnCloseLeaderboard = document.getElementById('btnCloseLeaderboard');
    const btnReturnLobby = document.getElementById('btnReturnLobby');
    const btnProceedNextStage = document.getElementById('btnProceedNextStage');
    const btnProceedNextTxt = document.getElementById('btnProceedNextTxt');
    const stageProceedRow = document.getElementById('stageProceedRow');
    let teacherStageRevealed = false;
    let leaderboardDismissed = false;
    let leaderboardReturnStage = 0;
    let confettiAnimationFrameId = null;
    let confettiFadeTimer = null;

    // ==============================================
    // 實習生性別切換與視覺呈現
    // ==============================================
    function updateStudentVisuals() {
        if (charStudentImg) {
            if (isNewStudentTrialUnit(activeUnit)) {
                charStudentImg.src = selectedGender === 'male'
                    ? 'assets/hero_player_male_intern.png?v=20261021-intern-m'
                    : 'assets/hero_player_female_hd.png?v=20261017-intern-clean-v3';
                charStudentImg.alt = selectedGender === 'male' ? '實習營養師 (男)' : '實習營養師 (女)';
            } else if (activeUnit === 'life') {
                charStudentImg.src = selectedGender === 'male' ? 'assets/college_student_male_bust.png' : 'assets/college_student_female_bust.png';
                charStudentImg.alt = selectedGender === 'male' ? '大學生 (男)' : '大學生 (女)';
            } else {
                charStudentImg.src = selectedGender === 'male' ? 'assets/student_male_bust.png' : 'assets/student_female_bust.png';
                charStudentImg.alt = selectedGender === 'male' ? '實習營養師 (男)' : '實習營養師 (女)';
            }
        }
        if (charStudentName) {
            if (isNewStudentTrialUnit(activeUnit)) {
                charStudentName.textContent = getNutritionInternDisplayName();
            } else if (activeUnit === 'life') {
                charStudentName.textContent = myNickname ? `大學生 ${myNickname}` : (selectedGender === 'male' ? '男同學' : '女同學');
            } else {
                const supportStage6TeacherIntern = isTeacher && activeUnit === 'support' && Number(currentStage) === 6;
                charStudentName.textContent = myNickname ? `${myNickname} 實習營養師` : '實習營養師';
            }
        }
        const warriorSprite = document.getElementById('warriorHeroSprite');
        const warriorTag = document.querySelector('.warrior-tag');
        if (warriorSprite) {
            warriorSprite.src = 'assets/warrior_hero.png';
            warriorSprite.alt = '糖化檢定男戰士';
        }
        if (warriorTag) {
            warriorTag.textContent = '⚔️ 糖化檢定男戰士';
        }
        const kidneySprite = document.getElementById('kidneyHeroSprite');
        if (kidneySprite) {
            if (isTeacher) {
                kidneySprite.src = 'assets/hero_player_male_hd.png';
                kidneySprite.alt = 'RPG 授課教師 (男)';
            } else {
                const isFem = (selectedGender === 'female' || localStorage.getItem('FYU_STUDENT_GENDER') === 'female');
                kidneySprite.src = isFem ? 'assets/hero_player_female_original_sage.png' : 'assets/hero_player_male_hd.png';
                kidneySprite.alt = isFem ? 'RPG 實習營養師 (女)' : 'RPG 實習營養師 (男)';
            }
        }
        const kidneyHeroName = document.getElementById('kidneyHeroName');
        if (kidneyHeroName) {
            if (isTeacher) {
                kidneyHeroName.textContent = '授課教師';
            } else if (myNickname) {
                kidneyHeroName.textContent = myNickname;
            }
        }
    }

    if (genderOptions) {
        genderOptions.querySelectorAll('.gender-opt').forEach(btn => {
            if (btn.dataset.gender === selectedGender) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
            btn.addEventListener('click', () => {
                sfxClick();
                genderOptions.querySelectorAll('.gender-opt').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedGender = btn.dataset.gender;
                localStorage.setItem('FYU_STUDENT_GENDER', selectedGender);
                updateStudentVisuals();
            });
        });
    }

    // ==============================================
    // 關卡進度導航條渲染 (動態支援 1..N 關 + 🏆 英雄榜)
    // ==============================================
    function renderStageIndicator(maxStages, activeSt) {
        const bar = document.getElementById('stageIndicatorBar');
        if (!bar) return;
        const isSupportStage10 = activeUnit === 'support' && (Number(activeSt) === 10 || Number(currentStage) === 10);
        if ((activeUnit === 'must' && (activeSt === 7 || currentStage === 7) && mustStage7Step === 1) ||
            isSupportStage10 ||
            isNewStudentTrialUnit(activeUnit)) {
            bar.classList.add('hidden');
            bar.style.setProperty('display', 'none', 'important');
            return;
        } else {
            bar.classList.remove('hidden');
            bar.style.removeProperty('display');
        }
        const total = Math.max(1, maxStages || (currentUnitConf ? currentUnitConf.maxStages : 4) || 4);
        let html = '';
        const customSteps = (currentUnitConf && currentUnitConf.steps) ? currentUnitConf.steps : null;
        for (let i = 1; i <= total; i++) {
            let label = `第 ${i} 題`;
            let numStr = `${i}`;
            if (customSteps && customSteps[i - 1]) {
                label = customSteps[i - 1].txt || label;
                numStr = customSteps[i - 1].num || numStr;
            } else if (currentUnitConf && currentUnitConf.stages && currentUnitConf.stages[i]) {
                const stTitle = currentUnitConf.stages[i].title || '';
                label = stTitle.replace(/^第\s*\d+\s*[題關][\s‧:：]*/, '').slice(0, 5) || `第 ${i} 題`;
            }
            const isActive = (i === activeSt) ? 'active' : (i < activeSt ? 'cleared' : '');
            if (i > 1) {
                html += '<div class="st-arrow">›</div>';
            }
            html += `<div class="st-step ${isActive}" data-st="${i}" title="點擊切換第 ${i} 題"><span class="st-num">${numStr}</span><span class="st-txt">${label}</span></div>`;
        }
        html += '<div class="st-arrow">›</div>';
        const isChampActive = (activeSt > total) ? 'active' : '';
        html += `<div class="st-step ${isChampActive}" data-st="${total + 1}" title="點擊切換英雄榜"><span class="st-num">🏆</span><span class="st-txt">英雄榜</span></div>`;
        bar.innerHTML = html;

        const activeEl = bar.querySelector('.st-step.active');
        if (activeEl) {
            setTimeout(() => {
                try {
                    const scrollPos = activeEl.offsetLeft - (bar.clientWidth / 2) + (activeEl.clientWidth / 2);
                    bar.scrollTo({ left: scrollPos, behavior: 'smooth' });
                } catch(e){}
            }, 60);
        }

        if (isTeacher) {
            bar.querySelectorAll('.st-step').forEach(btn => {
                btn.style.cursor = 'pointer';
                btn.addEventListener('click', () => {
                    const st = parseInt(btn.dataset.st);
                    if (st > total) {
                        triggerVictory();
                    } else {
                        loadStage(st);
                    }
                });
            });
        }
    }

    function updateStageIndicator(stageNum) {
        const bar = document.getElementById('stageIndicatorBar');
        const maxSt = (currentUnitConf && currentUnitConf.maxStages) ? currentUnitConf.maxStages : 4;
        if (!bar) return;
        renderStageIndicator(maxSt, stageNum);
    }

    // ==============================================
    // 單元環境初始化 (動態渲染情境看板與導航條)
    // ==============================================
    function initUnitEnvironment() {
        const stageBackdrop = document.getElementById('stageBackdrop');
        const teacherImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
        const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        const fyuTitle = document.querySelector('.fyu-title');
        const fyuSub = document.querySelector('.fyu-sub');
        const tLbl = document.querySelector('.t-lbl');
        const lobbyFooter = document.getElementById('lobbyFooterNote');

        document.documentElement.classList.remove('trial-route');
        document.body.classList.remove(
            'unit-ncp', 'unit-dm', 'unit-life', 'unit-support',
            'unit-new_student_trial', 'unit-f47185', 'unit-trial',
            'trial-step-0', 'trial-dialog-step', 'health-continent-active',
            'medical-city-active', 'continent-guide-dismissed', 'gameover-grayscale-active',
            'sports-stage-active', 'sports-quiz-step'
        );
        if (activeUnit === 'must') {
            document.body.classList.add('unit-must');
        }
        if (stageBackdrop) {
            stageBackdrop.classList.remove(
                'ncp-theme', 'dm-theme', 'classroom-theme', 'scifi-theme',
                'arcane-theme', 'dragon-battle-theme', 'dm-ice-theme',
                'tech-company-theme', 'ward-theme', 'zhou-court-theme',
                'anorexia-counseling-theme', 'bulimia-binge-theme',
                'unit3-stage4-anorexia-theme', 'new-student-trial-theme',
                'medical-city-ward-theme', 'health-continent-theme',
                'sports-gym-theme'
            );
            stageBackdrop.style.removeProperty('aspect-ratio');
            stageBackdrop.style.removeProperty('background-image');
            stageBackdrop.style.removeProperty('background-size');
            stageBackdrop.style.removeProperty('background-position');
            stageBackdrop.style.removeProperty('background-repeat');
            stageBackdrop.style.removeProperty('background-color');
        }
        const sportsQuizAreaInit = document.getElementById('sportsQuizArea');
        if (sportsQuizAreaInit) {
            sportsQuizAreaInit.classList.add('hidden');
            sportsQuizAreaInit.style.setProperty('display', 'none', 'important');
        }
        const mentorWrapperInit = document.getElementById('charNurse');
        if (mentorWrapperInit) {
            mentorWrapperInit.classList.remove('trial-mentor-dialog-position', 'azhe-surprised-shaking');
            mentorWrapperInit.style.removeProperty('display');
        }
        const trialStartAreaInit = document.getElementById('trialBgStartArea');
        if (trialStartAreaInit) {
            trialStartAreaInit.classList.add('hidden');
            trialStartAreaInit.style.setProperty('display', 'none', 'important');
        }
        const dragonArenaInit = document.getElementById('dragonBossArena');
        if (dragonArenaInit && activeUnit !== 'dm') {
            dragonArenaInit.classList.add('hidden');
            dragonArenaInit.style.setProperty('display', 'none', 'important');
        }
        const a1cWidgetInit = document.getElementById('a1cLiftingWidget');
        if (a1cWidgetInit && activeUnit !== 'dm') {
            a1cWidgetInit.classList.add('hidden');
            a1cWidgetInit.style.setProperty('display', 'none', 'important');
        }
        const continentMapElInit = document.getElementById('healthContinentMap');
        if (continentMapElInit) continentMapElInit.classList.add('hidden');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
        }
        const indicatorBarInit = document.getElementById('stageIndicatorBar');
        if (indicatorBarInit) {
            indicatorBarInit.classList.remove('hidden');
            indicatorBarInit.style.removeProperty('display');
        }

        if (activeUnit === 'support') {
            document.body.classList.add('unit-support');
            if (stageBackdrop) {
                stageBackdrop.classList.add('scifi-theme');
                stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_scifi_medical.jpg')";
            }
            if (fyuIcon) fyuIcon.textContent = '🚀';
            updateSupportStageHeader(currentStage);
            if (teacherImg) {
                teacherImg.src = 'assets/scifi_officer_bust.png';
                teacherImg.alt = '系統監控中樞 ‧ 艦載終端';
            }
            if (nurseTag) nurseTag.textContent = '系統監控中樞 ‧ 艦載終端';
            if (speakerBadge) speakerBadge.textContent = '【系統監控中樞 ‧ 艦載終端】';
            if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將同步進入生化生命維持醫療艙排查管線！';
        } else if (activeUnit === 'life') {
            document.body.classList.add('unit-life');
            if (stageBackdrop) {
                stageBackdrop.classList.add('classroom-theme');
                stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_classroom.jpg')";
            }
            if (fyuIcon) {
                fyuIcon.textContent = '🎓';
                fyuIcon.style.background = '#0284c7';
                fyuIcon.style.boxShadow = '0 0 8px rgba(2, 132, 199, 0.6)';
            }
            if (fyuTitle) fyuTitle.textContent = '輔英科技大學';
            if (fyuSub) fyuSub.textContent = '保健營養系 ‧ 校園生活特別篇';
            if (tLbl) tLbl.textContent = '校園生活';
            if (teacherImg) {
                teacherImg.src = 'assets/professor_bust.png';
                teacherImg.alt = '保健營養系 吳教授';
            }
            if (nurseTag) nurseTag.textContent = '保健營養系 吳教授';
            if (speakerBadge) speakerBadge.textContent = '【保健營養系 吳教授】';
            if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將同步進入陽光大學教室進行挑戰！';
        } else if (activeUnit === 'dm') {
            document.body.classList.add('unit-dm');
            if (stageBackdrop) {
                stageBackdrop.classList.add('dm-theme');
                stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_clinic.jpg')";
            }
            if (fyuIcon) {
                fyuIcon.textContent = '✚';
                fyuIcon.style.background = '';
                fyuIcon.style.boxShadow = '';
            }
            if (fyuTitle) fyuTitle.textContent = '糖尿病醫學營養治療 (DM)';
            if (fyuSub) fyuSub.textContent = '保健營養系 ‧ 臨床診斷與治療指引檢定';
            if (tLbl) tLbl.textContent = '代謝檢定';
            if (teacherImg) {
                teacherImg.src = 'assets/doctor_bust.png';
                teacherImg.alt = '內分泌新陳代謝科 沈懷瑾 主任醫師';
            }
            if (nurseTag) nurseTag.textContent = '內分泌新陳代謝科 沈懷瑾 主任醫師';
            if (speakerBadge) speakerBadge.textContent = '【內分泌新陳代謝科 沈懷瑾 主任醫師】';
            if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將同步進入內分泌代謝門診進行檢定！';
        } else if (activeUnit === 'ncp') {
            document.body.classList.add('unit-ncp');
            if (stageBackdrop) {
                stageBackdrop.classList.add('ncp-theme');
                stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_seminar.jpg')";
            }
            if (fyuIcon) fyuIcon.textContent = '✚';
            if (fyuTitle) fyuTitle.textContent = '輔英科技大學附設醫院 臨床營養研討室';
            if (fyuSub) fyuSub.textContent = '保健營養系 ‧ NCP 核心觀念檢定';
            if (tLbl) tLbl.textContent = '檢定限時';
            if (teacherImg) {
                teacherImg.src = 'assets/director_male_bust.png';
                teacherImg.alt = '臨床營養總監 陸馳野';
            }
            if (nurseTag) nurseTag.textContent = '臨床營養總監 陸馳野';
            if (speakerBadge) speakerBadge.textContent = '【臨床營養總監 陸馳野】';
            if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將同步進入臨床研討室進行檢定！';
        } else if (activeUnit === 'must') {
            document.body.classList.add('unit-must');
            if (stageBackdrop) {
                stageBackdrop.classList.remove('ncp-theme', 'dm-theme', 'classroom-theme', 'tech-company-theme', 'arcane-theme', 'scifi-theme', 'icu-aspiration-theme', 'new-student-trial-theme', 'medical-city-ward-theme', 'health-continent-theme');
                stageBackdrop.style.removeProperty('aspect-ratio');
                stageBackdrop.style.removeProperty('background-size');
                stageBackdrop.style.removeProperty('background-position');
                stageBackdrop.style.removeProperty('background-repeat');
                stageBackdrop.style.removeProperty('background-color');
                if (currentStage === 7) {
                    stageBackdrop.classList.add('zhou-court-theme');
                    stageBackdrop.style.setProperty('background-image', "url('assets/rpg_bg_zhou_court.jpg')", 'important');
                } else {
                    stageBackdrop.classList.add('ward-theme');
                    stageBackdrop.style.setProperty('background-image', "url('assets/rpg_bg_ward.jpg')", 'important');
                }
            }
            if (currentStage === 7) {
                if (fyuIcon) {
                    fyuIcon.textContent = '📜';
                    fyuIcon.style.background = '#ca8a04';
                    fyuIcon.style.boxShadow = '0 0 8px rgba(202, 138, 4, 0.6)';
                }
                if (fyuTitle) fyuTitle.textContent = '周代宮廷御膳房';
                if (fyuSub) fyuSub.textContent = '《周禮》食醫職責 ‧ 營養篩檢快速辨識檢定';
                if (tLbl) tLbl.textContent = '宮廷試煉';
                if (teacherImg) {
                    teacherImg.src = 'assets/zhou_emperor_full.png';
                    teacherImg.alt = '周天子';
                }
                if (nurseTag) nurseTag.textContent = '周天子';
                if (speakerBadge) speakerBadge.textContent = '【周天子】';
                if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將同步進入周代宮廷御膳房進行考驗！';
            } else {
                if (fyuIcon) {
                    fyuIcon.textContent = '✚';
                    fyuIcon.style.background = '';
                    fyuIcon.style.boxShadow = '';
                }
                if (fyuTitle) fyuTitle.textContent = '輔英科技大學附設醫院病房';
                if (fyuSub) fyuSub.textContent = '保健營養系 ‧ MUST 臨床營養評估';
                if (tLbl) tLbl.textContent = '黃金 48H';
                if (teacherImg) {
                    teacherImg.src = 'assets/nurse_bust.png';
                    teacherImg.alt = '護理師 林語柔';
                }
                if (nurseTag) nurseTag.textContent = '護理師 林語柔';
                if (speakerBadge) speakerBadge.textContent = '護理師 林語柔';
                if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將隨機分組並同步進入 302 病房！';
            }
        } else {
            const cfg = currentUnitConf;
            if (stageBackdrop) {
                if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
                    stageBackdrop.className = 'stage-backdrop new-student-trial-theme';
                    stageBackdrop.style.backgroundImage = "url('assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v3')";
                    stageBackdrop.style.backgroundPosition = 'center center';
                } else {
                    stageBackdrop.classList.add(cfg.themeClass || 'ncp-theme');
                    stageBackdrop.style.backgroundImage = (cfg.themeClass === 'dm-theme') ? "url('assets/rpg_bg_clinic.jpg')" : ((cfg.themeClass === 'ward-theme') ? "url('assets/rpg_bg_ward.jpg')" : ((cfg.themeClass === 'classroom-theme') ? "url('assets/rpg_bg_classroom.jpg')" : "url('assets/rpg_bg_seminar.jpg')"));
                }
            }
            if (fyuIcon) fyuIcon.textContent = '🎓';
            if (fyuTitle) fyuTitle.textContent = '輔英科技大學';
            if (fyuSub) fyuSub.textContent = activeUnitTitle || '保健營養系 ‧ 營養教學平台';
            if (tLbl) tLbl.textContent = '專業考核';
            if (teacherImg) {
                teacherImg.src = cfg.teacherImg || 'assets/professor_bust.png';
                teacherImg.alt = cfg.teacherName || '授課教授';
            }
            if (nurseTag) nurseTag.textContent = cfg.teacherName || '授課教授';
            if (speakerBadge) speakerBadge.textContent = `【${cfg.teacherName || '授課教授'}】`;
            if (lobbyFooter) lobbyFooter.textContent = '老師在講台點擊「🚀 遊戲開始」後，全班將同步進入專屬情境進行考核！';
        }

        if (bgmToggleBtn) bgmToggleBtn.classList.toggle('hidden', activeUnit === 'must');
        const loginHint = sceneLogin ? sceneLogin.querySelector('.login-hint') : null;
        if (loginHint) loginHint.classList.toggle('hidden', activeUnit === 'must');

        updateStudentVisuals();

        // 設定登入卡片文字
        const loginH2 = sceneLogin ? sceneLogin.querySelector('h2') : null;
        const loginP = sceneLogin ? sceneLogin.querySelector('.login-desc') : null;
        if (loginH2) {
            if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
                loginH2.textContent = '解鎖專業營養師勳章';
            } else {
                loginH2.textContent = `【${activeUnitTitle}】`;
            }
        }
        if (loginP) {
            if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
                loginP.textContent = `歡迎來到健康大陸！請輸入勇者暱稱，準備展開營養試煉：`;
            } else if (currentUnitConf && currentUnitConf.loginDesc) {
                loginP.textContent = currentUnitConf.loginDesc.replace('以加入本堂課堂競賽：', '：').replace('以加入本堂課堂競賽', '');
            } else {
                loginP.textContent = `歡迎進入 ${activeUnitTitle}！請輸入您的參賽暱稱：`;
            }
        }

        // 設定頂部個案資訊列
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            if (activeUnit === 'must' && currentStage === 7) {
                patientBanner.innerHTML = `
                    <div class="banner-badge" style="background:#ca8a04;color:#fff;">📜 宮廷食醫</div>
                    <div class="banner-info">
                        <span class="p-name"><strong>周代宮廷 ‧ 膳房</strong> ｜ 《周禮》食醫考驗</span>
                        <span class="p-metrics zhou-trial-metrics">主考官：<strong>宮廷食醫</strong> ｜ 考驗項目：<strong>營養篩檢 (Nutrition Screening) 快速辨識檢定</strong></span>
                        <span class="p-order zhou-trial-badge" style="color:#fef08a;background:rgba(234,179,8,0.2);border-color:#eab308;padding:2px 8px;font-size:12px;">📜 宮廷任職試煉</span>
                    </div>
                `;
            } else if (activeUnit === 'must' && (currentStage === 5 || currentStage === 6)) {
                patientBanner.innerHTML = `
                    <div class="banner-badge" style="background:#0284c7;color:#fff;">NCP 核心檢定</div>
                    <div class="banner-info">
                        <span class="p-name"><strong>臨床營養專題研討室</strong> ‧ 標準化營養照護程序 (NCP) 專業檢定</span>
                        <span class="p-metrics">主考導師：<strong>陸馳野 臨床營養總監 ‧ 專科考照名師</strong> ｜ 考核項目：<strong>核心步驟與流程定義</strong></span>
                    </div>
                `;
            } else if (activeUnit === 'must') {
                patientBanner.innerHTML = `
                    <div class="banner-badge">302 床</div>
                    <div class="banner-info">
                        <span class="p-name"><strong>林奶奶 (76歲)</strong> ‧ 胃癌全胃切除術後 Day 2</span>
                        <span class="p-metrics">身高 <strong>155cm</strong> ｜ 現重 <strong>46.0kg</strong> ｜ 6個月前體重 <strong>58.0kg</strong></span>
                        <span class="p-order">⚠️ 醫囑狀態：<strong>禁食 NPO 預期 > 5天</strong></span>
                    </div>
                `;
            } else if (activeUnit === 'support') {
                updateSupportStageHeader(currentStage || 1);
            } else if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
                patientBanner.classList.add('hidden');
            } else {
                patientBanner.innerHTML = `
                    <div class="banner-badge">${currentUnitConf.badge}</div>
                    <div class="banner-info">
                        ${currentUnitConf.bannerInfo}
                    </div>
                `;
            }
        }

        // 動態生成關卡導航條 (1 ~ maxStages + 英雄榜)
        renderStageIndicator(currentUnitConf.maxStages, currentStage || 1);
    }

    if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
        document.body.classList.add('unit-new_student_trial');
    }
    initUnitEnvironment();

    // 新生勇者試煉先顯示全螢幕「開始遊戲」封面，再進入暱稱登入。
    if (!isTeacher && !isDirectStageView && sceneLogin) {
        if (isNewStudentTrialUnit(activeUnit)) {
            sceneLogin.classList.add('hidden');
            if (sceneLobby) sceneLobby.classList.add('hidden');
            if (rpgMainStage) rpgMainStage.classList.remove('hidden');
            isGameStarted = true;
            showNewStudentTrialStep(0);
        } else {
            sceneLogin.classList.remove('hidden');
            if (sceneLobby) sceneLobby.classList.add('hidden');
            if (rpgMainStage) rpgMainStage.classList.add('hidden');
        }
    }
    document.documentElement.classList.remove('app-initializing');

    // 權限與裝置介面隔離 (學生端不顯示遙控器或背景音樂控制)
    // 桌面應用程式內嵌預覽 (isInApp) 亦隱藏網頁遙控器 (桌面軟體已有原生主控台)
    const isInApp = Boolean(urlParams.get('in_app') === '1' || urlParams.get('previewRevision') || (window.chrome && window.chrome.webview));
    if (isInApp) {
        document.documentElement.classList.add('is-in-app');
        document.body.classList.add('is-in-app');
        if (teacherControlBar) teacherControlBar.remove();
        if (teacherToggleBtn) teacherToggleBtn.remove();
    } else if (!isTeacher) {
        if (teacherControlBar) teacherControlBar.remove();
        if (teacherToggleBtn) teacherToggleBtn.remove();
    }
    if (!isTeacher) {
        if (lobbyTeacherStartBtn) lobbyTeacherStartBtn.remove();
        if (stageProceedRow) stageProceedRow.style.display = 'none';
    } else {
        document.body.classList.add('is-teacher');
        if (sceneLogin) sceneLogin.classList.add('hidden');
        if (lobbyTeacherStartBtn) {
            lobbyTeacherStartBtn.classList.remove('hidden');
            lobbyTeacherStartBtn.addEventListener('click', () => {
                sfxClick();
                const reqStage = parseInt(urlParams.get('stage')) || currentStage || 1;
                fetch(`/api/admin/start_game?unit=${encodeURIComponent(activeUnit)}&stage=${reqStage}`)
                    .then(res => res.json())
                    .then(data => {
                        isGameStarted = true;
                        sceneLobby.classList.add('hidden');
                        rpgMainStage.classList.remove('hidden');
                        const targetStage = Number(data && data.currentStage) || reqStage;
                        if (activeUnit === 'must' && targetStage === 1 && currentUnitConf.prologue && currentUnitConf.prologue.length > 0) {
                            startPrologueDialogue();
                        } else {
                            loadStage(targetStage);
                        }
                        startPolling();
                    })
                    .catch(() => {
                        isGameStarted = true;
                        sceneLobby.classList.add('hidden');
                        rpgMainStage.classList.remove('hidden');
                        if (activeUnit === 'must' && reqStage === 1 && currentUnitConf.prologue && currentUnitConf.prologue.length > 0) {
                            startPrologueDialogue();
                        } else {
                            loadStage(reqStage);
                        }
                        startPolling();
                    });
            });
        }
        // 直接指定題目預覽或教師端時不要啟動等候室，直接進入題目畫面
        if (!isDirectStageView && !isTeacher && activeUnit !== 'new_student_trial' && !isNewStudentTrialUnit(activeUnit)) enterLobby({ studentCount: 0, students: [] });
    }

    // ==============================================
    // 音訊控制器
    // ==============================================
    function playBgm() {
        if (!rpgBgmAudio) return;
        if (activeUnit === 'must') return;
        if ((activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) && !isMedicalCityActive && !activeContinentStageKey) {
            const curSrc = rpgBgmAudio.getAttribute('src') || '';
            if (!curSrc.includes('new_student_trial_bgm.mp3')) {
                rpgBgmAudio.setAttribute('src', 'assets/new_student_trial_bgm.mp3');
                rpgBgmAudio.load();
            }
        }
        rpgBgmAudio.muted = false;
        rpgBgmAudio.volume = bgmBaseVolume;
        const startPlayback = () => {
            const p = rpgBgmAudio.play();
            if (p !== undefined) {
                p.then(() => {
                    bgmPlaying = true;
                    if (bgmToggleBtn) {
                        bgmToggleBtn.classList.add('active');
                        bgmToggleBtn.textContent = '🎵 BGM [開]';
                    }
                }).catch(() => {
                    bgmPlaying = false;
                    if (bgmToggleBtn) {
                        bgmToggleBtn.classList.remove('active');
                        bgmToggleBtn.textContent = '🎵 BGM [點擊播放]';
                    }
                });
            }
        };

        startPlayback();
    }

    function pauseBgm() {
        if (!rpgBgmAudio) return;
        rpgBgmAudio.pause();
        bgmPlaying = false;
        if (bgmToggleBtn) {
            bgmToggleBtn.classList.remove('active');
            bgmToggleBtn.textContent = '🎵 BGM [關]';
        }
    }

    if (bgmToggleBtn) {
        bgmToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sfxClick();
            if (bgmPlaying) pauseBgm();
            else playBgm();
        });
    }
    window.addEventListener('fyu-bgm-started', () => {
        bgmPlaying = true;
        if (bgmToggleBtn) {
            bgmToggleBtn.classList.add('active');
            bgmToggleBtn.textContent = '🎵 BGM [開]';
        }
    });
    let audioCtx = null;
    function playTone(freq, type, dur, gain = 0.15) {
        if (!soundEnabled) return;
        try {
            if (!audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) audioCtx = new AC();
            }
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            g.gain.setValueAtTime(gain, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            osc.connect(g);
            g.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + dur);
        } catch (e) {}
    }

    function sfxClick() { playTone(600, 'sine', 0.05); }
    function sfxVote() {
        playTone(523.25, 'triangle', 0.08);
        setTimeout(() => playTone(659.25, 'triangle', 0.12), 60);
    }
    function sfxCorrect() {
        playTone(523.25, 'triangle', 0.08);
        setTimeout(() => playTone(659.25, 'triangle', 0.08), 80);
        setTimeout(() => playTone(783.99, 'triangle', 0.12), 160);
        setTimeout(() => playTone(1046.5, 'sine', 0.22), 240);
    }
    function sfxWrong() {
        playTone(330, 'sawtooth', 0.12, 0.1);
        setTimeout(() => playTone(260, 'sawtooth', 0.18, 0.1), 100);
    }
    function sfxFanfare() {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((freq, idx) => {
            setTimeout(() => playTone(freq, 'triangle', 0.25, 0.2), idx * 100);
        });
    }

    function sfxDragonRoar() {
        if (!soundEnabled) return;
        playTone(180, 'sawtooth', 0.4, 0.25);
        setTimeout(() => playTone(120, 'sawtooth', 0.6, 0.3), 150);
        setTimeout(() => playTone(80, 'sawtooth', 0.8, 0.3), 350);
    }

    function sfxAttackHit() {
        if (!soundEnabled) return;
        playTone(450, 'triangle', 0.08, 0.25);
        setTimeout(() => playTone(720, 'sine', 0.1, 0.2), 40);
    }

    // 全域關閉所有彈窗與結算狀態 (用於上一關同步與關卡重置)
    function closeAllModals() {
        const stageResultModal = document.getElementById('stageResultModal');
        if (stageResultModal) stageResultModal.classList.add('hidden');
        isShowingResultModal = false;
        pendingAnswerResult = null;
        if (window.stageResultCountdownTimer) {
            clearInterval(window.stageResultCountdownTimer);
            window.stageResultCountdownTimer = null;
        }

        if (rpgVictoryModal) rpgVictoryModal.classList.add('hidden');
        if (grandmaThankModal) grandmaThankModal.classList.add('hidden');

        const rocketModal = document.getElementById('rocketLaughModal');
        const rocketVideo = document.getElementById('rocketLaughVideo');
        if (rocketModal) rocketModal.classList.add('hidden');
        if (rocketVideo) {
            try { rocketVideo.pause(); } catch(e){}
        }

        const dragonGameOverModal = document.getElementById('dragonGameOverModal');
        if (dragonGameOverModal) dragonGameOverModal.classList.add('hidden');
        const kingModal = document.getElementById('kingDismissModal');
        if (kingModal) kingModal.classList.add('hidden');
        document.body.classList.remove('gameover-grayscale-active');

        const flame = document.getElementById('dragonFlameBurst');
        if (flame) flame.classList.add('hidden');

        if (rpgMainStage) {
            rpgMainStage.classList.remove('hidden');
            rpgMainStage.style.filter = '';
        }
    }

    // 魔龍與勇者戰鬥狀態重置
    function resetDragonBossState() {
        const dragonSprite = document.getElementById('dragonBossSprite');
        const dragonHpFill = document.getElementById('dragonHpFill');
        const dragonHpVal = document.getElementById('dragonHpVal');
        const flame = document.getElementById('dragonFlameBurst');
        const hitFlash = document.getElementById('dragonHitFlash');
        const dmgText = document.getElementById('dragonDamageText');
        const beam = document.getElementById('playerAttackBeam');
        const gameOverModal = document.getElementById('dragonGameOverModal');
        const warriorSprite = document.getElementById('warriorHeroSprite');
        const warriorAura = document.getElementById('warriorAuraGlow');
        const slashWave = document.getElementById('warriorSlashWave');
        const flameWave = document.getElementById('dragonFlameWave');
        const chargeFloat = document.getElementById('warriorChargeFloat');

        if (dragonSprite) {
            dragonSprite.className = 'dragon-sprite';
        }
        if (warriorSprite) {
            warriorSprite.className = 'warrior-hero-sprite';
        }
        if (dragonHpFill) {
            dragonHpFill.style.width = '100%';
        }
        if (dragonHpVal) {
            dragonHpVal.textContent = 'HP 100%';
        }
        if (flame) flame.classList.add('hidden');
        if (hitFlash) hitFlash.classList.add('hidden');
        if (dmgText) dmgText.classList.add('hidden');
        if (beam) beam.classList.add('hidden');
        if (gameOverModal) gameOverModal.classList.add('hidden');
        if (warriorAura) warriorAura.classList.add('hidden');
        if (slashWave) slashWave.classList.add('hidden');
        if (flameWave) flameWave.classList.add('hidden');
        if (chargeFloat) chargeFloat.classList.add('hidden');

        document.body.classList.remove('gameover-grayscale-active');
        if (rpgMainStage) rpgMainStage.style.filter = '';
        const slider = document.getElementById('a1cRangeSlider');
        const btnAttack = document.getElementById('btnA1cAttack');
        if (slider) slider.disabled = false;
        if (btnAttack) btnAttack.disabled = false;
    }

    // 玩家上舉攻擊魔龍動畫與血條扣減
    function doAttackDragon(currentVal) {
        const dragonSprite = document.getElementById('dragonBossSprite');
        const dragonHpFill = document.getElementById('dragonHpFill');
        const dragonHpVal = document.getElementById('dragonHpVal');
        const beam = document.getElementById('playerAttackBeam');
        const dmgText = document.getElementById('dragonDamageText');

        if (!dragonSprite) return;

        sfxAttackHit();

        // 玩家光波發射動畫
        if (beam) {
            beam.classList.remove('hidden');
            setTimeout(() => { if (beam) beam.classList.add('hidden'); }, 350);
        }

        // 魔龍受擊晃動與閃爍
        setTimeout(() => {
            if (dragonSprite) {
                dragonSprite.classList.add('hit-shake');
                setTimeout(() => { if (dragonSprite) dragonSprite.classList.remove('hit-shake'); }, 350);
            }

            // 漂浮受擊傷害字樣
            if (dmgText) {
                dmgText.textContent = `💥 HIT! +0.5% (蓄力 ${currentVal}%)`;
                dmgText.classList.remove('hidden');
                setTimeout(() => { if (dmgText) dmgText.classList.add('hidden'); }, 600);
            }

            // 魔龍 HP 條扣減 (13次上舉為達標目標，每次扣約 7.7% HP)
            if (dragonHpFill && dragonHpVal) {
                const remainingHp = Math.max(0, Math.round(100 - (a1cCurrentLifts / 13) * 100));
                dragonHpFill.style.width = `${remainingHp}%`;
                dragonHpVal.textContent = `HP ${remainingHp}%`;
            }
        }, 120);
    }

    soundToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEnabled = !soundEnabled;
        soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    });

    // ==============================================
    // 學生登入與進入等候室
    // ==============================================
    const isCustomAvatar = (value) => typeof value === 'string' && value.indexOf('data:image/') === 0;
    const safeAvatarSrc = (value) => isCustomAvatar(value) ? value : '';

    function prepareAvatarForJoin(value) {
        if (!isCustomAvatar(value)) return Promise.resolve(value || '🍎');
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const side = Math.min(image.naturalWidth, image.naturalHeight);
                const sx = (image.naturalWidth - side) / 2;
                const sy = (image.naturalHeight - side) / 2;
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) {
                    reject(new Error('無法建立頭像影像畫布'));
                    return;
                }

                for (const size of [96, 80, 64, 48]) {
                    canvas.width = size;
                    canvas.height = size;
                    context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
                    for (const quality of [0.6, 0.45, 0.3]) {
                        const compressed = canvas.toDataURL('image/jpeg', quality);
                        if (encodeURIComponent(compressed).length <= 4800) {
                            resolve(compressed);
                            return;
                        }
                    }
                }
                reject(new Error('自選頭像壓縮後仍超過課堂連線限制'));
            };
            image.onerror = () => reject(new Error('自選頭像無法讀取，請重新選擇照片'));
            image.src = value;
        });
    }

    function registerStudent(nickname, avatar) {
        const encodedFields = `clientId=${encodeURIComponent(clientId)}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}&gender=${encodeURIComponent(selectedGender)}`;
        return fetch(`/api/join?${encodedFields}&unit=${encodeURIComponent(activeUnit)}`)
        .then(response => {
            if (!response.ok) throw new Error(`加入課堂失敗 (HTTP ${response.status})`);
            return response.json();
        })
        .then(data => {
            if (isCustomAvatar(avatar) && data.avatar !== avatar) {
                throw new Error('伺服器未能完整保存自選照片，請重新選擇照片後再加入。');
            }
            return data;
        });
    }

    function avatarMarkup(value, fallback = '🍎') {
        const src = safeAvatarSrc(value);
        return src
            ? `<img class="custom-avatar-img" src="${src}" alt="自選照片">`
            : (value || fallback);
    }

    function updateAvatarPhotoPreview() {
        if (!avatarPhotoPreview || !btnChooseAvatarPhoto) return;
        const src = safeAvatarSrc(selectedAvatar);
        if (src) {
            avatarPhotoPreview.innerHTML = `<img src="${src}" alt="自選照片"><span>已選擇照片（已自動裁切為正方形）</span>`;
            avatarPhotoPreview.classList.remove('hidden');
            btnChooseAvatarPhoto.classList.add('selected');
            btnChooseAvatarPhoto.textContent = '📷 更換照片';
        } else {
            avatarPhotoPreview.innerHTML = '';
            avatarPhotoPreview.classList.add('hidden');
            btnChooseAvatarPhoto.classList.remove('selected');
            btnChooseAvatarPhoto.textContent = '📷 自選照片';
        }
    }

    function selectAvatar(value, selectedButton = null) {
        selectedAvatar = value || '🍎';
        avatarOptions.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
        if (selectedButton) selectedButton.classList.add('selected');
        else if (isCustomAvatar(selectedAvatar)) btnChooseAvatarPhoto.classList.add('selected');
        updateAvatarPhotoPreview();
    }

    function cropAvatarImage(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const side = Math.min(image.naturalWidth, image.naturalHeight);
                const sx = (image.naturalWidth - side) / 2;
                const sy = (image.naturalHeight - side) / 2;
                const canvas = document.createElement('canvas');
                // 以 128×128 JPEG 保存，足夠顯示頭像，也避免手機將大圖送入課堂連線網址。
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(image, sx, sy, side, side, 0, 0, 64, 64);
                const cropped = canvas.toDataURL('image/jpeg', 0.5);
                selectAvatar(cropped);
                try { localStorage.setItem('FYU_STUDENT_AVATAR', cropped); } catch (e) {}
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    avatarOptions.querySelectorAll('.avatar-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            sfxClick();
            if (btn === btnChooseAvatarPhoto) {
                if (avatarPhotoInput) avatarPhotoInput.click();
                return;
            }
            selectAvatar(btn.dataset.av, btn);
        });
    });

    if (avatarPhotoInput) {
        avatarPhotoInput.addEventListener('change', () => {
            const file = avatarPhotoInput.files && avatarPhotoInput.files[0];
            cropAvatarImage(file);
            avatarPhotoInput.value = '';
        });
    }

    btnJoinLobby.addEventListener('click', () => {
        myNickname = inputNickname ? inputNickname.value.trim() : '';
        if (!myNickname) {
            updateJoinLobbyButtonState();
            if (inputNickname) inputNickname.focus();
            return;
        }
        sfxClick();
        playBgm();

        certName.value = myNickname;
        try {
            inputNickname.blur();
            localStorage.setItem('FYU_STUDENT_NICKNAME', myNickname);
            localStorage.setItem('FYU_STUDENT_AVATAR', selectedAvatar);
            localStorage.setItem('FYU_STUDENT_GENDER', selectedGender);
        } catch(e) {}
        updateStudentVisuals();

        // 試煉模式跳過連線大廳直接開始
        if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
            isGameStarted = true;
            if (sceneLogin) sceneLogin.classList.add('hidden');
            if (sceneLobby) sceneLobby.classList.add('hidden');
            if (rpgMainStage) rpgMainStage.classList.remove('hidden');
            showNewStudentTrialStep(1);
            return;
        }

        prepareAvatarForJoin(selectedAvatar)
            .then(avatar => {
                selectedAvatar = avatar;
                try { localStorage.setItem('FYU_STUDENT_AVATAR', selectedAvatar); } catch(e) {}
                updateAvatarPhotoPreview();
                return registerStudent(myNickname, selectedAvatar);
            })
            .then(data => {
                if (data.sessionId) currentSessionId = data.sessionId;
                myTeamName = data.teamName || "";
                enterLobby(data);
            })
            .catch(error => {
                console.error('無法以自選頭像加入課堂', error);
                if (isCustomAvatar(selectedAvatar)) {
                    alert(error.message || '自選頭像無法加入課堂，請重新選擇較小的照片。');
                    return;
                }
                enterLobby({ studentCount: 1, students: [] });
            });
    });

    function enterLobby(data) {
        if (data && data.sessionId) currentSessionId = data.sessionId;
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
            statusPollingInterval = null;
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        window.isCompletedMedicalCity = false;
        window.isCompletedSportsStage = false;
        window.isCompletedPortStage = false;
        window.isCompletedForestStage = false;
        window.isCompletedCommunityStage = false;
        window.isCompletedResearchStage = false;
        window.lastCompletedStageName = null;
        completedContinentStages.clear();
        try {
            sessionStorage.removeItem('completed_stage_medical');
            localStorage.removeItem('completed_stage_medical');
            sessionStorage.removeItem('completed_stage_sports');
            localStorage.removeItem('completed_stage_sports');
            sessionStorage.removeItem('completed_stage_port');
            localStorage.removeItem('completed_stage_port');
            sessionStorage.removeItem('completed_stage_forest');
            localStorage.removeItem('completed_stage_forest');
        } catch(e) {}
        sceneLogin.classList.add('hidden');
        sceneLobby.classList.remove('hidden');
        rpgMainStage.classList.add('hidden');
        rpgVictoryModal.classList.add('hidden');
        grandmaThankModal.classList.add('hidden');

        if (lobbyHeaderBadge) lobbyHeaderBadge.textContent = `⏳ 臨床挑戰等候室`;
        if (lobbyUnitTitleSub) lobbyUnitTitleSub.textContent = activeUnitTitle;
        if (lobbyWaitingUnitName) lobbyWaitingUnitName.textContent = activeUnitTitle;

        if (isTeacher) {
            lobbyStudentGreeting.textContent = `👨‍🏫 授課教師課堂大螢幕`;
            currentModeTag.textContent = '👨‍🏫 教師大螢幕';
            const lobbyWaitingText = document.getElementById('lobbyWaitingText');
            if (lobbyWaitingText) {
                lobbyWaitingText.textContent = `👨‍🏫 連線就緒！請學員掃碼進場。`;
            }
            const lobbyFooterNote = document.getElementById('lobbyFooterNote');
            if (lobbyFooterNote) {
                lobbyFooterNote.textContent = '學生掃描講台 QR Code 即可加入，全員到齊後請點擊下方按鈕開始！(即使無人加入亦可直接點擊開始進入示範)';
            }
            if (lobbyTeacherStartBtn) lobbyTeacherStartBtn.classList.remove('hidden');
        } else {
            lobbyStudentGreeting.innerHTML = `${avatarMarkup(selectedAvatar)} 嗨，${myNickname}！`;
            currentModeTag.textContent = `⏳ 等候室`;
            const lobbyWaitingText = document.getElementById('lobbyWaitingText');
            if (lobbyWaitingText) {
                lobbyWaitingText.textContent = `連線成功！正在等待授課教師點擊「開始遊戲」...`;
            }
        }

        renderLobbyStudents(data.students || []);

        if (lobbyPollingInterval) clearInterval(lobbyPollingInterval);
        if (!isStaticSite) lobbyPollingInterval = setInterval(fetchLobbyStatus, 1000);
    }

    function syncUnitFromServer(data) {
        if (!data || tView || isTeacher) return false;
        let unitEnvironmentChanged = false;
        const serverUnit = data.currentUnit
            ? data.currentUnit.toLowerCase().replace(/^unit_/, '')
            : activeUnit;
        if (serverUnit !== activeUnit) {
            activeUnit = serverUnit;
            currentUnitConf = unitDefinitions[activeUnit] || resolveUnitConfig(activeUnit, data.currentUnitTitle);
            activeUnitTitle = data.currentUnitTitle || currentUnitConf.name;
            unitEnvironmentChanged = true;
        } else if (!unitDefinitions[activeUnit] && data.currentUnitTitle &&
            data.currentUnitTitle !== activeUnitTitle) {
            currentUnitConf = resolveUnitConfig(activeUnit, data.currentUnitTitle);
            activeUnitTitle = data.currentUnitTitle;
            unitEnvironmentChanged = true;
        }
        if (unitEnvironmentChanged) {
            newStudentTrialStep = 0;
            initUnitEnvironment();
        }
        return unitEnvironmentChanged;
    }

    function fetchLobbyStatus() {
        fetch(`/api/lobby_status?unit=${activeUnit}`)
            .then(res => {
                consecutivePollErrors = 0;
                return res.json();
            })
            .then(data => {
                if (!data) return;

                syncUnitFromServer(data);

                if (data.sessionId) {
                    if (!isTeacher && currentSessionId && currentSessionId !== data.sessionId) {
                        forceExitSession("授課教師已重啟課堂，請重新加入！");
                        return;
                    }
                    currentSessionId = data.sessionId;
                }

                if (data.currentUnitTitle && data.currentUnitTitle !== activeUnitTitle) {
                    activeUnitTitle = data.currentUnitTitle;
                    if (lobbyUnitTitleSub) lobbyUnitTitleSub.textContent = activeUnitTitle;
                    if (lobbyWaitingUnitName) lobbyWaitingUnitName.textContent = activeUnitTitle;
                }

                if (data.gameMode) {
                    currentGameMode = data.gameMode;
                    if (currentGameMode === 'individual') {
                        lobbyModeText.textContent = `🏆 個人競賽模式`;
                    } else {
                        lobbyModeText.textContent = `⚔️ 隨機分組對抗 (開始時依人數自動分配組數)`;
                    }
                }
                lobbyStudentCount.textContent = data.studentCount || 0;
                renderLobbyStudents(data.students || []);

                if (data.isGameStarted === true && !isGameStarted) {
                    clearInterval(lobbyPollingInterval);
                    isGameStarted = true;

                    if (data.students) {
                        const me = data.students.find(s => s.clientId === clientId);
                        if (me && me.teamName) myTeamName = me.teamName;
                    }

                    if (currentGameMode === 'individual') {
                        currentModeTag.textContent = `🏆 個人競賽`;
                    } else {
                        currentModeTag.textContent = myTeamName ? `⚔️ ${myTeamName}` : `⚔️ 分組對抗`;
                    }

                    sceneLobby.classList.add('hidden');
                    rpgMainStage.classList.remove('hidden');
                    const targetStage = Number(data.currentStage) || parseInt(urlParams.get('stage')) || currentStage || 1;
                    loadStage(targetStage);
                    startPolling();
                    startTimer();
                }
            })
            .catch(() => {
                if (!isTeacher) {
                    consecutivePollErrors++;
                    if (consecutivePollErrors >= 3) {
                        forceExitSession("授課教師已關閉課堂。請於重新開課後再次連線！");
                    }
                }
            });
    }

    function renderLobbyStudents(students) {
        if (!studentsBubblesList) return;
        studentsBubblesList.innerHTML = '';
        students.forEach(s => {
            const bubble = document.createElement('div');
            bubble.className = 'student-bubble';
            const teamBadge = (currentGameMode === 'team' && s.teamName) ? `<span style="color:#fef08a;font-size:11px;">[${s.teamName}]</span>` : '';
            bubble.innerHTML = `<span>${avatarMarkup(s.avatar)}</span> <span>${s.nickname}</span> ${teamBadge}`;
            studentsBubblesList.appendChild(bubble);
        });
    }

    // ==============================================
    // 前導對話播放 (手機端絕對禁止跳過對話)
    // ==============================================
    function startPrologueDialogue() {
        if (!currentUnitConf.prologue || currentUnitConf.prologue.length === 0) {
            isInPrologue = false;
            loadStage(currentStage || 1);
            return;
        }
        isInPrologue = true;
        prologueIndex = 0;
        document.body.classList.remove(
            'unit-new_student_trial', 'unit-f47185', 'unit-trial',
            'trial-step-0', 'trial-dialog-step', 'health-continent-active',
            'medical-city-active', 'continent-guide-dismissed'
        );
        if (activeUnit === 'must') {
            document.body.classList.add('unit-must');
        }
        initUnitEnvironment();
        updateStudentVisuals();
        charStudent.classList.remove('hidden');
        optionsGrid.innerHTML = '';
        questionFeedbackBanner.classList.add('hidden');
        showPrologueStep(0);
    }

    function showPrologueStep(idx) {
        const dialogList = currentUnitConf.prologue || [];
        if (idx >= dialogList.length) {
            isInPrologue = false;
            charStudent.classList.add('hidden');
            charNurse.classList.remove('inactive');
            charNurse.classList.add('speaking');
            loadStage(currentStage || 1);
            startPolling();
            startTimer();
            return;
        }

        const d = dialogList[idx];
        if (d.target === 'student') {
            if (speakerBadge) {
                speakerBadge.textContent = isNewStudentTrialUnit(activeUnit)
                    ? getNutritionInternDisplayName()
                    : (myNickname ? `實習營養師 ${myNickname}` : '實習營養師');
            }
            charStudent.classList.remove('inactive');
            charStudent.classList.add('speaking');
            charNurse.classList.remove('speaking');
            charNurse.classList.add('inactive');
        } else {
            if (speakerBadge) speakerBadge.textContent = d.speaker ? d.speaker.replace(/[【】]/g, '') : (activeUnit === 'must' ? '護理師 林語柔' : '授課教授');
            charNurse.classList.remove('inactive');
            charNurse.classList.add('speaking');
            charStudent.classList.remove('speaking');
            charStudent.classList.add('inactive');
            const nurseImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
            const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
            if (activeUnit === 'must') {
                if (nurseImg) { nurseImg.src = 'assets/nurse_bust.png'; nurseImg.alt = '護理師 林語柔'; }
                if (nurseTag) nurseTag.textContent = '護理師 林語柔';
            } else if (activeUnit === 'ncp') {
                if (nurseImg) { nurseImg.src = 'assets/director_male_bust.png'; nurseImg.alt = '臨床營養總監 陸馳野'; }
                if (nurseTag) nurseTag.textContent = '臨床營養總監 陸馳野';
            } else if (currentUnitConf && currentUnitConf.teacherImg) {
                if (nurseImg) { nurseImg.src = currentUnitConf.teacherImg; nurseImg.alt = currentUnitConf.teacherName || '授課教授'; }
                if (nurseTag) nurseTag.textContent = currentUnitConf.teacherName || '授課教授';
            }
        }
        if (patientBanner && activeUnit === 'must') {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
        }
        const stageIndicatorBarEl = document.getElementById('stageIndicatorBar');
        if (stageIndicatorBarEl && activeUnit === 'must' && currentStage !== 7) {
            stageIndicatorBarEl.classList.remove('hidden');
            stageIndicatorBarEl.style.removeProperty('display');
        }
        dialogContent.innerHTML = d.text;

        if (optionsGrid) {
            optionsGrid.innerHTML = '';
        }

        dialogIndicator.innerHTML = `點擊對話框推進對話 (${idx + 1}/${dialogList.length}) 💬 ➔`;
    }

    function showSupportStage4Dialogue(stageData) {
        const internName = myNickname ? `${myNickname} 實習營養師` : '實習營養師';
        const messages = [
            {
                speaker: 'dietitian',
                text: `「${internName}，我們剛確認完林先生的管路位置，現在要來核對他的管灌處方了。」`
            },
            { speaker: 'student', text: '「好的，周學姐！我先確認一下基本資料」' },
            {
                speaker: 'dietitian',
                text: '「很好。在擬定具體的灌食計畫時，必須同時通盤考量灌食方式、配方濃度、總熱量、水分需求，還有脂肪酸的完整性。」'
            }
        ];
        const optionsGridEl = document.getElementById('optionsGrid');
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');

        if (supportStage4Step < messages.length) {
            const message = messages[supportStage4Step];
            const isStudentSpeaking = message.speaker === 'student';
            speakerBadge.textContent = isStudentSpeaking
                ? (myNickname ? `【實習營養師 ${myNickname}】` : '【實習營養師】')
                : '【紀晨希 營養師】';
            dialogContent.innerHTML = message.text;
            dialogIndicator.textContent = `點擊對話框繼續對話 (${supportStage4Step + 1}/${messages.length}) 💬 ➔`;
            charNurse.classList.toggle('speaking', !isStudentSpeaking);
            charNurse.classList.toggle('inactive', isStudentSpeaking);
            charStudent.classList.toggle('speaking', isStudentSpeaking);
            charStudent.classList.toggle('inactive', !isStudentSpeaking);
            charStudent.classList.remove('hidden');
            if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
            return;
        }

        speakerBadge.textContent = stageData.speaker;
        dialogContent.innerHTML = stageData.speech;
        dialogIndicator.textContent = '💡 請依據灌食處方與營養需求評估於下方選出錯誤敘述 ➔';
        charNurse.classList.remove('inactive', 'hidden');
        charNurse.classList.add('speaking');
        charStudent.classList.add('hidden');
        charStudent.classList.remove('speaking', 'inactive');
        if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.remove('hidden');
        if (optionsGridEl) optionsGridEl.classList.remove('hidden');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
        playQuestionVoice('support', 4);
    }

    function showSupportStage6Dialogue(stageData) {
        const internName = myNickname ? `${myNickname} 實習營養師` : '實習營養師';
        const messages = [
            {
                speaker: 'student',
                text: `趙醫師您好，我是${internName}，今天協助確認這位病人的全靜脈營養輸液。`
            },
            {
                speaker: 'dietitian',
                text: '很好，這位病人使用的是高濃度葡萄糖輸液，請先從輸液中斷後的代謝反應思考可能風險。'
            },
            {
                speaker: 'student',
                text: '了解，我會依據葡萄糖輸注與胰島素作用的臨床機轉，判斷為何不能突然中斷。'
            }
        ];
        const optionsGridEl = document.getElementById('optionsGrid');
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');

        if (supportStage6Step < messages.length) {
            const message = messages[supportStage6Step];
            const isStudentSpeaking = message.speaker === 'student';
            speakerBadge.textContent = isStudentSpeaking
                ? `【${internName}】`
                : '【加護醫學部 趙仁傑 主治醫師】';
            dialogContent.innerHTML = message.text;
            dialogIndicator.textContent = `點擊對話框繼續對話 (${supportStage6Step + 1}/${messages.length}) 💬 ➔`;
            charNurse.classList.toggle('speaking', !isStudentSpeaking);
            charNurse.classList.toggle('inactive', isStudentSpeaking);
            charStudent.classList.toggle('speaking', isStudentSpeaking);
            charStudent.classList.toggle('inactive', !isStudentSpeaking);
            charNurse.classList.remove('hidden');
            charStudent.classList.remove('hidden');
            if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.remove('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
            return;
        }

        speakerBadge.textContent = stageData.speaker;
        dialogContent.innerHTML = stageData.speech;
        dialogIndicator.textContent = '💡 請依據全靜脈營養（TPN）輸液中斷機轉於下方點選正確答案 ➔';
        charNurse.classList.remove('inactive', 'hidden');
        charNurse.classList.add('speaking');
        charStudent.classList.add('hidden');
        charStudent.classList.remove('speaking', 'inactive');
        if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.remove('hidden');
        if (optionsGridEl) optionsGridEl.classList.remove('hidden');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
        playQuestionVoice('support', 6);
    }

    function showSupportStage8Dialogue(stageData) {
        const internName = myNickname ? ('實習營養師 ' + myNickname) : '實習營養師';
        const messages = [
            {
                speaker: 'student',
                text: '「晨希學姐，這位病人已經快<span style="color:#fef08a;font-weight:bold;">兩週沒進食</span>了，今天醫療團隊打算開始啟動灌食」'
            },
            {
                speaker: 'dietitian',
                text: '「好，但一定要小心。像他這種病人，容易引發致命的<span style="color:#fef08a;font-weight:bold;">再餵食症候群（Refeeding Syndrome）</span>」'
            }
        ];
        const optionsGridEl = document.getElementById('optionsGrid');
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');

        if (supportStage8Step < messages.length) {
            const message = messages[supportStage8Step];
            const isStudentSpeaking = message.speaker === 'student';
            speakerBadge.textContent = isStudentSpeaking
                ? `【${internName}】`
                : '【紀晨希 營養師】';
            dialogContent.innerHTML = message.text;
            dialogIndicator.textContent = `點擊對話框繼續對話 (${supportStage8Step + 1}/${messages.length}) 💬 ➔`;
            charNurse.classList.toggle('speaking', !isStudentSpeaking);
            charNurse.classList.toggle('inactive', isStudentSpeaking);
            charStudent.classList.toggle('speaking', isStudentSpeaking);
            charStudent.classList.toggle('inactive', !isStudentSpeaking);
            charStudent.classList.remove('hidden');
            if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
            return;
        }

        speakerBadge.textContent = stageData.speaker;
        dialogContent.innerHTML = stageData.speech;
        dialogIndicator.textContent = '💡 請依據再餵食症候群臨床風險機轉於下方點選正確答案 ➔';
        charNurse.classList.remove('inactive', 'hidden');
        charNurse.classList.add('speaking');
        charStudent.classList.add('hidden');
        charStudent.classList.remove('speaking', 'inactive');
        if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.remove('hidden');
        if (optionsGridEl) optionsGridEl.classList.remove('hidden');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
        playQuestionVoice('support', 8);
    }


    dialogBox.addEventListener('click', (e) => {
        if (e && e.target && (e.target.closest('#btnReplayQuestionVoice') || e.target.id === 'btnReplayQuestionVoice')) {
            return;
        }
        // 對話框位於 stageBackdrop 內，避免同一次點擊再被背景層的推進事件處理。
        e.stopImmediatePropagation();
        sfxClick();

        // 活力運動場：優先處理阿哲與勇者多輪對話推進
        if (activeContinentStageKey === 'sports') {
            if (document.body.classList.contains('sports-quiz-step')) {
                return;
            }
            if (typeof sportsDialogueStep !== 'undefined' && sportsDialogueStep < 4) {
                renderSportsDialogueStep(sportsDialogueStep + 1);
            } else if (typeof playSportsIntroVideo === 'function') {
                playSportsIntroVideo();
            }
            return;
        }

        // 團膳之港：處理營養師與勇者 4 句對話推進
        if (activeContinentStageKey === 'port') {
            if (typeof portDialogueStep !== 'undefined' && portDialogueStep < 3) {
                advancePortDialogue();
            }
            return;
        }

        if (activeContinentStageKey === 'research') {
            return;
        }

        if (isInPrologue) {
            prologueIndex++;
            showPrologueStep(prologueIndex);
            return;
        }

        // 醫療之城：優先處理對話推進
        if (isMedicalCityActive) {
            advanceMedicalCityDialogue(e);
            return;
        }

        // 新生勇者試煉 第1題 前導 RPG 對話流程 (或帶有 trial-dialog-step 樣式)
        if ((isNewStudentTrialUnit(activeUnit) || document.body.classList.contains('unit-new_student_trial') || document.body.classList.contains('trial-dialog-step')) && (Number(currentStage) === 1 || !currentStage)) {
            // 保底登入流程可能先於主程式初始化完成，避免第一次點擊仍停留在步驟 0。
            if (newStudentTrialStep < 1) newStudentTrialStep = 1;
            if (newStudentTrialStep < 4) {
                advanceNewStudentTrialStep();
            } else if (newStudentTrialStep >= 4 && !activeContinentRegionKey) {
                if (typeof dismissContinentGuide === 'function') {
                    dismissContinentGuide();
                }
            }
            return;
        }

        if (activeUnit === 'support' && currentStage === 4 && supportStage4Step < 3) {
            supportStage4Step++;
            showSupportStage4Dialogue(currentUnitConf.stages[currentStage]);
            return;
        }

        if (activeUnit === 'support' && currentStage === 6 && supportStage6Step < 3) {
            supportStage6Step++;
            showSupportStage6Dialogue(currentUnitConf.stages[currentStage]);
            return;
        }

        if (activeUnit === 'support' && currentStage === 8 && supportStage8Step < 2) {
            supportStage8Step++;
            showSupportStage8Dialogue(currentUnitConf.stages[currentStage]);
            return;
        }

        const isSupportStage7 = (activeUnit === 'support' && currentStage === 7);
        if (isSupportStage7) {
            try {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                if (npcQuestionVoiceAudio) { npcQuestionVoiceAudio.pause(); npcQuestionVoiceAudio.currentTime = 0; }
                if (btnReplayQuestionVoice) {
                    btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                    btnReplayQuestionVoice.classList.remove('playing');
                }
            } catch(e) {}
            activateSupportStage7Feeding();
            return;
        }

        const isSupportStage2 = (activeUnit === 'support' && currentStage === 2) || (currentUnitConf && currentUnitConf.stages && currentUnitConf.stages[currentStage] && currentUnitConf.stages[currentStage].title && currentUnitConf.stages[currentStage].title.includes('吸入性肺炎'));
        if (isSupportStage2) {
            const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
            if (supportStage2Step === 0) {
                supportStage2Step = 1;
                if (speakerBadge) speakerBadge.textContent = myNickname ? `【實習營養師 ${myNickname}】` : '【實習營養師】';
                if (dialogContent) {
                    dialogContent.innerHTML = '「錯一步，病人可能會出事....只要微量逆流進肺部，隨時可能會引發死亡。」';
                }
                if (dialogIndicator) dialogIndicator.textContent = '點擊對話框查看題目 🩺 ➔';
                if (charNurse) { charNurse.classList.remove('speaking'); charNurse.classList.add('inactive'); }
                if (charStudent) { charStudent.classList.remove('hidden', 'inactive'); charStudent.classList.add('speaking'); }
                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
                
                // 播放實習營養師範例語音 (僅教師端播放，學生端不朗讀)
                if (isTeacher) {
                    try {
                        if (window.speechSynthesis) window.speechSynthesis.cancel();
                        if (npcQuestionVoiceAudio) { npcQuestionVoiceAudio.pause(); npcQuestionVoiceAudio.currentTime = 0; }
                        if (currentInternVoiceAudio) { currentInternVoiceAudio.pause(); currentInternVoiceAudio.currentTime = 0; }
                        const internAudioSrc = (selectedGender === 'male') ? 'assets/voice/support_stage2_intern_male.mp3' : 'assets/voice/support_stage2_intern_female.mp3';
                        currentInternVoiceAudio = new Audio(internAudioSrc);
                        currentInternVoiceAudio.play().catch(() => {});
                    } catch(e) {}
                }
            } else if (supportStage2Step === 1) {
                supportStage2Step = 2;
                // 進入題目時，徹底停止實習生語音與 TTS (使用者需求 5)
                try {
                    if (currentInternVoiceAudio) {
                        currentInternVoiceAudio.pause();
                        currentInternVoiceAudio.currentTime = 0;
                        currentInternVoiceAudio = null;
                    }
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                } catch(e) {}
                if (speakerBadge) speakerBadge.textContent = '【加護醫學部 趙仁傑 主治醫師】';
                if (dialogContent) {
                    dialogContent.innerHTML = '<span style="color:#ffffff;">鼻胃管灌食的重症病人，下列何者不是</span><strong style="color:#fef08a;">降低 aspiration 風險</strong><span style="color:#ffffff;">的最佳處置？</span>';
                }
                if (dialogIndicator) dialogIndicator.textContent = '💡 請依據重症臨床指引於下方點選最佳處置 ➔';
                if (charNurse) { charNurse.classList.remove('inactive'); charNurse.classList.add('speaking'); }
                if (charStudent) { charStudent.classList.remove('speaking'); charStudent.classList.add('hidden'); }
                if (optionsGridEl) optionsGridEl.classList.remove('hidden');
                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
                
                // 播放趙仁傑主治醫師範例男聲音檔 (assets/voice/support_stage2.mp3) (僅教師端播放)
                if (isTeacher) {
                    playQuestionVoice('support', 2);
                }
            } else {
                if (isTeacher) {
                    playQuestionVoice('support', 2);
                }
            }
            return;
        }

        const isMustStage7 = (activeUnit === 'must' && currentStage === 7) || (currentUnitConf && currentUnitConf.stages && currentUnitConf.stages[currentStage] && (currentUnitConf.stages[currentStage].isZhouCourtStage || currentUnitConf.stages[currentStage].isKingStage));
        if (isMustStage7) {
            const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
            const teacherImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
            const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
            const studentImg = document.getElementById('charStudentImg') || document.querySelector('#charStudent img');
            const studentTag = document.getElementById('charStudentName') || document.querySelector('#charStudent .char-nametag');

            if (shiyiAnimTimer) {
                clearTimeout(shiyiAnimTimer);
                shiyiAnimTimer = null;
            }

            const fyuIcon = document.getElementById('fyuHeaderIcon');
            const fyuTitle = document.getElementById('fyuHeaderTitle');
            const fyuSub = document.getElementById('fyuHeaderSub');
            if (fyuIcon) {
                fyuIcon.textContent = '📜';
                fyuIcon.style.background = '#ca8a04';
                fyuIcon.style.boxShadow = '0 0 8px rgba(202, 138, 4, 0.6)';
            }
            if (fyuTitle) fyuTitle.textContent = '周代宮廷御膳房';
            if (fyuSub) fyuSub.textContent = '《周禮》食醫職責 ‧ 營養篩檢快速辨識檢定';

            if (mustStage7Step === 0) {
                // 第 0 步 ➔ 第 1 步：周禮 ‧ 醫官制度（整個背景為四醫官全屏圖，文字說明框精簡清晰無框中圖）
                mustStage7Step = 1;
                if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.add('hidden');
                const bar = document.getElementById('stageIndicatorBar');
                if (bar) { bar.classList.add('hidden'); bar.style.display = 'none'; }
                if (stageBackdrop) {
                    stageBackdrop.className = 'stage-backdrop zhou-four-doctors-theme';
                    stageBackdrop.style.backgroundImage = "url('assets/zhou_four_doctors.jpg')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center top";
                    stageBackdrop.style.backgroundColor = "transparent";
                }
                if (speakerBadge) speakerBadge.textContent = '【周禮 ‧ 醫官制度】';
                if (dialogContent) {
                    dialogContent.innerHTML = `
                        <div style="line-height:1.75; font-size:16px; color:#f8fafc; text-align:left; padding:4px 6px;">
                            <strong style="color:#fef08a; font-size:17.5px;">周代宮廷設有不同職責的醫官，依《周禮》記載，包括：</strong><br>
                            • <strong style="color:#fde047;">食醫</strong> ｜ 負責飲食與養生<br>
                            • <strong style="color:#86efac;">疾醫</strong> ｜ 負責疾病診治<br>
                            • <strong style="color:#93c5fd;">瘍醫</strong> ｜ 負責瘡瘍及相關外科處置<br>
                            • <strong style="color:#fed7aa;">獸醫</strong> ｜ 負責牲畜疾病<br>
                            在宮廷之中，食醫掌管飲食調養，是維護王室健康的重要角色。<br>
                            <span style="color:#fde047; font-weight:bold;">【食醫的考驗】</span>即將展開！
                        </div>
                    `;
                }
                if (dialogIndicator) dialogIndicator.textContent = '💡 點擊召喚食醫入殿受命 ➔';
                if (charNurse) { charNurse.classList.remove('emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('hidden'); }
                if (charStudent) { charStudent.classList.add('hidden'); charStudent.classList.remove('shiyi-slide-in-left'); }
                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
            } else if (mustStage7Step === 1) {
                // 第 1 步 ➔ 第 2 步：食醫登場「臣在。入宮為食醫，首要之務並非治病...」
                mustStage7Step = 2;
                if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.add('hidden');
                const bar = document.getElementById('stageIndicatorBar');
                if (bar) { bar.classList.remove('hidden'); bar.style.display = ''; }
                if (stageBackdrop) {
                    stageBackdrop.className = 'stage-backdrop zhou-court-theme';
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_zhou_court.jpg')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center";
                    stageBackdrop.style.backgroundColor = "";
                }
                if (speakerBadge) speakerBadge.textContent = '【食醫】';
                if (teacherImg) { teacherImg.src = 'assets/zhou_shiyi_bust_hd.png'; teacherImg.alt = '宮廷食醫'; teacherImg.style.setProperty('max-height', '235px', 'important'); }
                if (charNurse) charNurse.style.setProperty('transform', 'scale(1)', 'important');
                if (nurseTag) nurseTag.textContent = '宮廷食醫';
                if (dialogContent) {
                    dialogContent.innerHTML = '「臣在。」<br>「入宮為食醫，首要之務並非治病。」<br><strong style="color:#fef08a;">「而是從飲食與身體狀況中，及早發現可能存在的營養問題。」</strong>';
                }
                if (dialogIndicator) dialogIndicator.textContent = '💡 點擊開啟食醫考驗 🩺 ➔';
                if (charNurse) { charNurse.classList.remove('inactive', 'hidden', 'emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('speaking'); }
                if (charStudent) { charStudent.classList.add('hidden'); charStudent.classList.remove('shiyi-slide-in-left'); }
                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');

                // 播放食醫開示語音 (must_stage7_zhou_shiyi.mp3)
                try {
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                    if (npcQuestionVoiceAudio) { npcQuestionVoiceAudio.pause(); npcQuestionVoiceAudio.currentTime = 0; }
                    if (currentInternVoiceAudio) { currentInternVoiceAudio.pause(); currentInternVoiceAudio.currentTime = 0; }
                    currentInternVoiceAudio = new Audio('assets/voice/must_stage7_zhou_shiyi.mp3');
                    currentInternVoiceAudio.play().catch(() => {});
                } catch(e) {}
            } else if (mustStage7Step === 2) {
                // 第 2 步 ➔ 第 3 步：出現題目與 (A)~(D) 4 個選項
                mustStage7Step = 3;
                if (btnReplayQuestionVoice) btnReplayQuestionVoice.classList.remove('hidden');
                try {
                    if (currentInternVoiceAudio) {
                        currentInternVoiceAudio.pause();
                        currentInternVoiceAudio.currentTime = 0;
                        currentInternVoiceAudio = null;
                    }
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                } catch(e) {}
                if (stageBackdrop) {
                    stageBackdrop.className = 'stage-backdrop zhou-court-theme';
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_zhou_court.jpg')";
                }
                if (speakerBadge) speakerBadge.textContent = '【食醫的考驗】';
                if (teacherImg) { teacherImg.src = 'assets/zhou_shiyi_bust_hd.png'; teacherImg.alt = '宮廷食醫'; teacherImg.style.setProperty('max-height', '235px', 'important'); }
                if (charNurse) charNurse.style.setProperty('transform', 'scale(1)', 'important');
                if (nurseTag) nurseTag.textContent = '宮廷食醫';
                if (dialogContent) {
                    dialogContent.innerHTML = '<div style="font-size:16px; line-height:1.6;"><span style="color:#ffffff; font-weight:bold;">下列何者不是</span><strong style="color:#fef08a;">營養篩檢</strong><span style="color:#ffffff; font-weight:bold;">（nutrition screening）的項目？</span><br><span style="color:#94a3b8; font-size:13.5px; font-weight:normal;">（請於下方點選非初步營養篩檢的常規項目）</span></div>';
                }
                if (dialogIndicator) dialogIndicator.textContent = '💡 請依據營養篩檢快速辨識檢定於下方點選答案 ➔';
                if (charNurse) { charNurse.classList.remove('inactive', 'hidden', 'emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('speaking'); }
                if (charStudent) { charStudent.classList.add('hidden'); charStudent.classList.remove('shiyi-slide-in-left'); }
                
                // 渲染選項並解除隱藏
                const curStageData = currentUnitConf.stages[7] || (MODULE_TEMPLATES['MUST_STAGE_7'] || {});
                if (curStageData && curStageData.options) {
                    renderOptionsGrid(curStageData.options);
                }
                if (optionsGridEl) optionsGridEl.classList.remove('hidden');
                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');

                // 播放食醫題目語音 (assets/voice/must_stage7_zhou_question.mp3 題幹朗讀)
                playQuestionVoice('must', 7);
            } else {
                playQuestionVoice('must', 7);
            }
            return;
        }

        const isDmStage12 = (activeUnit === 'dm' && currentStage === 12) || (currentUnitConf && currentUnitConf.stages && currentUnitConf.stages[currentStage] && currentUnitConf.stages[currentStage].isDetectiveStage);
        if (isDmStage12) {
            const detectiveArea = document.getElementById('detectiveTeamArea');
            const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
            if (detectiveStage12Step === 0) {
                detectiveStage12Step = 1;
                if (speakerBadge) speakerBadge.textContent = '【血糖偵查小隊 隊長】';
                if (dialogContent) {
                    dialogContent.innerHTML = '🕵️ <strong>「偵查小隊各就各位！請檢視夜間低血糖誘發的反向調節荷爾蒙反應，破解早晨反彈高血糖的真正元兇！」</strong><br><span style="color:#fef08a;">下列何者為造成此案例清晨高血糖的機轉？</span>';
                }
                if (dialogIndicator) dialogIndicator.textContent = '💡 請小隊成員共同討論機轉 ➔';
                if (detectiveArea) detectiveArea.classList.remove('hidden');
                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
            } else {
                playQuestionVoice('dm', 12);
            }
            return;
        }

        const isChenCurrentStage = (activeUnit.includes('bfbbb5') && (currentStage === 1 || currentStage === 2)) || (currentUnitConf && currentUnitConf.stages && currentUnitConf.stages[currentStage] && (currentUnitConf.stages[currentStage].isLabMultiStage || currentUnitConf.stages[currentStage].speakerRole === 'chen'));

        // 【陳先生抽血個案判讀】：評估失敗後點擊：陳先生息怒，實習營養師把握第 2 次機會重試
        if (isChenCurrentStage && dmStage6Phase === 'fail') {
            dmStage6Phase = 'lab';
            if (teacherImg) {
                teacherImg.classList.remove('angry-shake', 'angry-fire-shake');
            }
            if (charNurse) {
                charNurse.classList.remove('angry-shake', 'angry-fire-shake', 'speaking');
                charNurse.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.classList.remove('inactive', 'zoom-eval');
                charStudent.classList.add('speaking');
            }
            if (speakerBadge) speakerBadge.textContent = myNickname ? `【實習營養師 ${myNickname}】` : '【實習營養師】';
            if (dialogContent) {
                dialogContent.innerHTML = '「陳先生請息怒！我立即重新審視生化檢驗各項數值，把握最後一次機會！」';
            }
            if (dialogIndicator) dialogIndicator.textContent = '請在下方重新勾選所有異常指標 🩺 ➔';
            try {
                if (currentInternVoiceAudio) {
                    currentInternVoiceAudio.pause();
                    currentInternVoiceAudio.currentTime = 0;
                }
                const retryAudioPath = (selectedGender === 'male') ? 'assets/voice/dm_stage6_retry_male.mp3' : 'assets/voice/dm_stage6_retry.mp3';
                currentInternVoiceAudio = new Audio(retryAudioPath);
                currentInternVoiceAudio.play().catch(() => {});
            } catch(e) {}
            const labWidget = document.getElementById('dmStage6LabWidget');
            if (labWidget) {
                labWidget.querySelectorAll('.lab-check').forEach(c => c.disabled = false);
                const btnSub = document.getElementById('btnSubmitLabMulti');
                if (btnSub) {
                    btnSub.disabled = false;
                    btnSub.textContent = '🩺 完成生化數據判斷';
                }
                labWidget.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        // 【陳先生抽血個案判讀】：從陳先生對話切換至整頁抽血數據報告
        if (isChenCurrentStage && dmStage6Phase === 'dialog') {
            dmStage6Phase = 'lab';
            const labWidget = document.getElementById('dmStage6LabWidget');
            if (labWidget) labWidget.classList.remove('hidden');

            // 停止陳先生目前可能正在播放的 13 秒語音，陳先生不再說話
            if (npcQuestionVoiceAudio) {
                try {
                    npcQuestionVoiceAudio.pause();
                    npcQuestionVoiceAudio.currentTime = 0;
                } catch(e) {}
            }

            if (speakerBadge) speakerBadge.textContent = myNickname ? `【實習營養師 ${myNickname}】` : '【實習營養師】';
            if (dialogContent) {
                dialogContent.innerHTML = '「陳先生您好！沒問題，這就來幫您看生化檢驗數據。畫面中已經為您列出抽血報告，請大家仔細比對各項標準值，把所有『異常數值』勾選出來！」';
            }
            if (dialogIndicator) dialogIndicator.textContent = '請在下方報告單勾選所有異常指標 🩺 ➔';

            if (charStudent) {
                charStudent.classList.remove('hidden', 'zoom-eval', 'inactive');
                charStudent.classList.add('speaking');
            }
            if (charNurse) {
                charNurse.classList.add('inactive');
                charNurse.classList.remove('speaking');
            }

            // 播放實習營養師專屬語音 (男生使用專屬上傳原聲，女生使用標準女聲)
            try {
                if (currentInternVoiceAudio) {
                    currentInternVoiceAudio.pause();
                    currentInternVoiceAudio.currentTime = 0;
                }
                const internAudioSrc = (selectedGender === 'male') ? 'assets/voice/dm_stage6_intern_male.mp3' : 'assets/voice/dm_stage6_intern.mp3';
                currentInternVoiceAudio = new Audio(internAudioSrc);
                currentInternVoiceAudio.play().catch(() => {});
            } catch(e) {}
            return;
        }

        // 題目常態狀態：點擊對話框可隨時切換/播放題目朗讀語音
        toggleQuestionVoice(activeUnit, currentStage);
    });

    function parseCustomOptions(descText) {
        if (!descText) return null;
        let lines = descText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length <= 1) {
            const splitByOpt = descText.split(/(?=(?:選項|Option)\s*[0-9A-Za-z]+)/i).map(l => l.trim()).filter(l => l.length > 0);
            if (splitByOpt.length >= 2) {
                lines = splitByOpt;
            }
        }
        if (lines.length === 0) return null;
        if (lines.some(l => /^(?:選項|Option)\s*[0-9A-Za-z]+/i.test(l))) {
            lines = lines.filter(l => /^(?:選項|Option)\s*[0-9A-Za-z]+/i.test(l));
        }

        const options = [];
        let detectedCorrect = null;

        lines.forEach((rawLine, idx) => {
            let line = rawLine.trim();
            if (!line) return;

            let key = (idx + 1).toString();
            let scoreText = `選項 ${key}`;
            let text = line;

            const m = line.match(/^(?:選項\s*|Option\s*)?([0-9A-Za-z]+)[\.、：:\s]*(.*)$/i);
            if (m) {
                key = m[1];
                scoreText = `選項 ${key}`;
                text = m[2];
            }

            const isCorrect = /[\(（]正確(?:答案)?[\)）]|\[正確(?:答案)?\]/.test(line);
            if (isCorrect) {
                detectedCorrect = key;
                text = text.replace(/[\(（]正確(?:答案)?[\)）]|\[正確(?:答案)?\]/g, '').trim();
            }

            // 支援 (加 0 分), (加 2 分), (計 1 分), (2 分), (0 分) 等格式
            const scoreMatch = text.match(/[\(（](加\s*[0-9]+|計\s*[0-9]+|[≧><=~0-9\.\-\s]+)\s*分[\)）]/);
            if (scoreMatch) {
                let sVal = scoreMatch[1].trim();
                if (sVal.startsWith('計')) sVal = sVal.replace(/^計\s*/, '').trim();
                scoreText = `${sVal} 分`;
                text = text.replace(/[\(（](?:加|計)?[≧><=~0-9\.\-\s]+分[\)）]/g, '').trim();
            } else {
                // 檢查是否開頭就是分數，例如 "0 分 低度風險" 或 "≧ 2 分 高度風險" 或 "加 2 分 重大手術"
                const startScoreMatch = text.match(/^((?:加\s*)?[≧><=~0-9\.\-\s]+分)[\s‧:：]*(.*)$/);
                if (startScoreMatch) {
                    scoreText = startScoreMatch[1].trim();
                    text = startScoreMatch[2].trim();
                }
            }

            options.push({
                key: key,
                score: scoreText,
                text: text
            });
        });

        if (options.length >= 2) {
            return { options, correctKey: detectedCorrect };
        }
        return null;
    }

    function normalizeCorrectOptionKey(correctOption, options) {
        const rawKey = String(correctOption == null ? '' : correctOption).trim();
        if (!rawKey || !Array.isArray(options) || options.length === 0) return rawKey;

        const normalizedKey = rawKey.toUpperCase();
        const exactOption = options.find(option => String(option.key).trim().toUpperCase() === normalizedKey);
        if (exactOption) return String(exactOption.key);

        const labelledOption = options.find(option => {
            const score = String(option.score || '');
            const labelMatch = score.match(/(?:選項|Option)\s*([0-9A-Za-z]+)/i);
            return labelMatch && labelMatch[1].toUpperCase() === normalizedKey;
        });
        if (labelledOption) return String(labelledOption.key);

        if (/^[A-Z]$/.test(normalizedKey)) {
            const letterIndex = normalizedKey.charCodeAt(0) - 65;
            if (options[letterIndex]) return String(options[letterIndex].key);
        }

        if (/^[1-9][0-9]*$/.test(normalizedKey)) {
            const index = Number(normalizedKey) - 1;
            if (options[index]) return String(options[index].key);
        }

        return rawKey;
    }

    function getCorrectOptionLabel(stageData) {
        if (!stageData) return '';
        const correctKey = String(stageData.correctKey == null ? '' : stageData.correctKey);
        const correctOption = Array.isArray(stageData.options)
            ? stageData.options.find(option => String(option.key) === correctKey)
            : null;
        return correctOption && correctOption.score
            ? correctOption.score
            : correctKey;
    }

    function showNewStudentTrialStep(step) {
        newStudentTrialStep = step;
        window.__fyuTrialDialogStep = step;
        if (step > 0) {
            document.documentElement.classList.remove('trial-route');
        }

        const optionsGridEl = document.getElementById('optionsGrid');
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
        const trialBgStartArea = document.getElementById('trialBgStartArea');
        if (trialBgStartArea && step !== 0) {
            trialBgStartArea.classList.add('hidden');
            trialBgStartArea.style.setProperty('display', 'none', 'important');
            trialBgStartArea.style.setProperty('visibility', 'hidden', 'important');
            trialBgStartArea.style.setProperty('pointer-events', 'none', 'important');
        }
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const stageBackdropEl = document.getElementById('stageBackdrop');
        const continentMapEl = document.getElementById('healthContinentMap');
        const characterStage = document.getElementById('characterStage');
        const mentorWrapper = document.getElementById('charNurse');

        if (step === 0) {
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
        } else if (step === 1) {
            document.body.classList.remove('trial-step-0', 'health-continent-active');
            document.body.classList.add('trial-dialog-step', 'unit-new_student_trial');
            if (stageBackdropEl) {
                stageBackdropEl.className = 'stage-backdrop new-student-trial-theme';
                stageBackdropEl.style.setProperty('background-image', "url('assets/new_student_trial_dialog_bg.jpg')", 'important');
                stageBackdropEl.style.setProperty('background-size', 'cover', 'important');
                stageBackdropEl.style.setProperty('background-position', 'center center', 'important');
            }
            if (characterStage) {
                characterStage.classList.remove('hidden');
                characterStage.style.removeProperty('display');
            }
            if (continentMapEl) {
                continentMapEl.classList.add('hidden');
                continentMapEl.style.setProperty('display', 'none', 'important');
            }
            if (mentorWrapper) mentorWrapper.classList.add('trial-mentor-dialog-position');
            if (bottomPanel) {
                bottomPanel.style.removeProperty('display');
                bottomPanel.classList.remove('hidden');
            }
            if (trialBgStartArea) trialBgStartArea.classList.add('hidden');
            if (dialogBox) {
                dialogBox.classList.remove('hidden');
                dialogBox.style.removeProperty('display');
            }
            if (!bgmPlaying) playBgm();
            if (speakerBadge) {
                speakerBadge.innerHTML = '輔英科大保健營養系 <span class="speaker-name-highlight-white">伊麗克絲</span> 營養師';
            }
            if (dialogContent) {
                dialogContent.innerHTML = '歡迎來到營養師訓練所！從現在起，你將踏上<span class="dialogue-highlight">營養師</span>的冒險之路。別小看<span class="dialogue-highlight">營養師</span>！我們不只懂營養，更能用<span class="dialogue-highlight">專業守護每一個人的健康</span>。';
            }
            if (dialogIndicator) dialogIndicator.textContent = '💡 點擊對話框繼續 💬 ➔';
            if (charNurse) {
                charNurse.style.removeProperty('display');
                charNurse.classList.remove('inactive', 'hidden');
                charNurse.classList.add('speaking');
                const nurseImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
                const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
                if (nurseImg) { nurseImg.src = 'assets/mentor_guide.png'; nurseImg.alt = '輔英科大保健營養系 伊麗克絲 營養師'; }
                if (nurseTag) nurseTag.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking', 'inactive');
            }
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.classList.add('hidden');
                btnReplayQuestionVoice.style.setProperty('display', 'none', 'important');
            }
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        } else if (step === 2) {
            document.body.classList.remove('trial-step-0', 'health-continent-active');
            document.body.classList.add('trial-dialog-step', 'unit-new_student_trial');
            if (stageBackdropEl) {
                stageBackdropEl.className = 'stage-backdrop new-student-trial-theme';
                stageBackdropEl.style.setProperty('background-image', "url('assets/new_student_trial_dialog_bg.jpg')", 'important');
                stageBackdropEl.style.setProperty('background-size', 'cover', 'important');
                stageBackdropEl.style.setProperty('background-position', 'center center', 'important');
            }
            if (characterStage) {
                characterStage.classList.remove('hidden');
                characterStage.style.removeProperty('display');
            }
            if (continentMapEl) {
                continentMapEl.classList.add('hidden');
                continentMapEl.style.setProperty('display', 'none', 'important');
            }
            if (bottomPanel) {
                bottomPanel.style.removeProperty('display');
                bottomPanel.classList.remove('hidden');
            }
            if (trialBgStartArea) trialBgStartArea.classList.add('hidden');
            if (dialogBox) {
                dialogBox.classList.remove('hidden');
                dialogBox.style.removeProperty('display');
            }
            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = '<span style="font-size:1.08em; color:#f8fafc; font-weight:bold;">「所以……我今天要成為營養實習生？」</span>';
            }
            if (dialogIndicator) dialogIndicator.textContent = '💡 點擊對話框繼續 💬 ➔';
            if (charNurse) {
                charNurse.style.removeProperty('display');
                charNurse.classList.remove('speaking', 'hidden');
                charNurse.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.style.removeProperty('display');
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                const studentImg = document.getElementById('charStudentImg') || document.querySelector('#charStudent img');
                const studentTag = document.getElementById('charStudentName') || document.querySelector('#charStudent .char-nametag');
                if (studentImg) {
                    studentImg.src = selectedGender === 'male'
                        ? 'assets/hero_player_male_intern.png?v=20261021-intern-m'
                        : 'assets/hero_player_female_hd.png?v=20261017-intern-clean-v3';
                    studentImg.alt = selectedGender === 'male' ? '營養實習生 (男)' : '營養實習生 (女)';
                }
                if (studentTag) studentTag.textContent = getNutritionInternDisplayName();
            }
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.classList.add('hidden');
                btnReplayQuestionVoice.style.setProperty('display', 'none', 'important');
            }
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        } else if (step === 3) {
            document.body.classList.remove('trial-step-0', 'health-continent-active');
            document.body.classList.add('trial-dialog-step', 'unit-new_student_trial');
            if (stageBackdropEl) {
                stageBackdropEl.className = 'stage-backdrop new-student-trial-theme';
                stageBackdropEl.style.setProperty('background-image', "url('assets/new_student_trial_dialog_bg.jpg')", 'important');
                stageBackdropEl.style.setProperty('background-size', 'cover', 'important');
                stageBackdropEl.style.setProperty('background-position', 'center center', 'important');
            }
            if (characterStage) {
                characterStage.classList.remove('hidden');
                characterStage.style.removeProperty('display');
            }
            if (continentMapEl) {
                continentMapEl.classList.add('hidden');
                continentMapEl.style.setProperty('display', 'none', 'important');
            }
            if (bottomPanel) {
                bottomPanel.style.removeProperty('display');
                bottomPanel.classList.remove('hidden');
            }
            if (trialBgStartArea) trialBgStartArea.classList.add('hidden');
            if (dialogBox) {
                dialogBox.classList.remove('hidden');
                dialogBox.style.removeProperty('display');
            }
            if (speakerBadge) {
                speakerBadge.innerHTML = '輔英科大保健營養系 <span class="speaker-name-highlight-white">伊麗克絲</span> 營養師';
            }
            if (dialogContent) {
                dialogContent.innerHTML = '沒錯！你必須通過不同領域的試煉，解鎖屬於你的<span class="dialogue-highlight">營養師</span>技能！';
            }
            if (dialogIndicator) dialogIndicator.textContent = '💡 點擊開啟勇者試煉 ⚔️ ➔';
            if (charNurse) {
                charNurse.style.removeProperty('display');
                charNurse.classList.remove('inactive', 'hidden');
                charNurse.classList.add('speaking');
                const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
                if (nurseTag) nurseTag.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.style.removeProperty('display');
                charStudent.classList.remove('speaking', 'hidden');
                charStudent.classList.add('inactive');
            }
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.classList.add('hidden');
                btnReplayQuestionVoice.style.setProperty('display', 'none', 'important');
            }
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        } else if (step >= 4) {
            showNewStudentHealthContinent();
        }
    }
    window.showNewStudentTrialStep = showNewStudentTrialStep;

    function advanceNewStudentTrialStep() {
        try { sfxClick(); } catch(e) {}
        console.log('[TrialDialog] advanceNewStudentTrialStep called, current step:', newStudentTrialStep, 'isMedicalCityActive:', isMedicalCityActive);
        if (isMedicalCityActive) {
            advanceMedicalCityDialogue();
            return;
        }
        if (newStudentTrialStep < 1) {
            showNewStudentTrialStep(1);
        } else if (newStudentTrialStep === 1) {
            showNewStudentTrialStep(2);
        } else if (newStudentTrialStep === 2) {
            showNewStudentTrialStep(3);
        } else {
            showNewStudentHealthContinent();
        }
    }
    window.advanceNewStudentTrialStep = advanceNewStudentTrialStep;
    window.__fyuAdvanceTrialDialogImpl = advanceNewStudentTrialStep;
    window.__fyuStartTrialDialog = () => showNewStudentTrialStep(1);

    const CONTINENT_REGIONS = {
        'sports': {
            id: 'sports',
            title: '活力運動場',
            sub: '🏃 運動營養專科 ‧ 增肌減脂與體能極限試煉',
            desc: '每一次力竭，都是體態進化的起點。營養師精準掌控增肌與黃金修復，助你突破極限、強勢回歸！',
            originX: 28.24,
            originY: 64.11,
            scale: 2.6
        },
        'community': {
            id: 'community',
            title: '社區廣場',
            sub: '🍎 公共衛生營養 ‧ 全人照護與預防醫學試煉',
            desc: '充滿歡笑與溫暖的社區廣場，是推動全民預防醫學的起點。營養師在此推動在地飲食教育、銀髮肌少症防範與慢病關懷，守護每個家庭的健康！',
            background: 'assets/rpg_bg_continent_community.png',
            originX: 53.67,
            originY: 56.13,
            scale: 2.6
        },
        'port': {
            id: 'port',
            title: '團膳之港',
            sub: '🍱 團體膳食營運 ‧ 食品安全與大規模供餐試煉',
            desc: '商船絡繹不絕的團膳之港，掌管萬人營養供應的動脈。營養師精算大宗食材採購、菜單設計與嚴格落實HACCP食安管制，讓每份餐點兼具美味與安心！',
            background: 'assets/rpg_bg_continent_port.png?stage-bg-sync-v1',
            originX: 52.84,
            originY: 82.63,
            scale: 2.6
        },
        'research': {
            id: 'research',
            title: '研究之都',
            sub: '🔬 尖端營養科學 ‧ 代謝生化與精準醫療試煉',
            desc: '匯聚未來科技的研究之都，探尋人體微觀世界的營養密碼。營養師透過尖端實證醫學、基因營養學與臨床試驗，開拓營養科學的嶄新航道！',
            background: 'assets/rpg_bg_continent_research.png?stage-bg-sync-v1',
            originX: 78.16,
            originY: 68.22,
            scale: 2.6
        },
        'forest': {
            id: 'forest',
            title: '蔬食之森',
            sub: '🥗 植物性營養 ‧ 植化素與腸道菌群平衡試煉',
            desc: '生機盎然的蔬食之森，蘊含大自然最純粹的抗氧化力量。營養師運用彩虹植化素、膳食纖維與超級食物，為人們築起強大的天然免疫防線！',
            background: 'assets/rpg_bg_forest_classroom.jpg?stage-bg-sync-v1',
            originX: 74.70,
            originY: 38.61,
            scale: 2.6
        },
        'medical': {
            id: 'medical',
            title: '醫療之城',
            sub: '🏥 營養勇者傳 ‧ 解鎖專業營養師徽章',
            desc: '巍峨矗立的醫療之城，是捍衛重症生命的最強堡壘。營養師在此解析病患生化數值、制定精準照護，通過試煉以解鎖專業營養師徽章！',
            background: 'assets/rpg_bg_medical_city_ward.jpg',
            originX: 42.57,
            originY: 31.53,
            scale: 2.6
        }
    };

    let isMedicalCityActive = false;

    function playStageZoomInSfx() {
        if (!soundEnabled) return;
        try {
            playTone(392.00, 'triangle', 0.1, 0.18); // G4
            setTimeout(() => playTone(523.25, 'triangle', 0.12, 0.22), 80); // C5
            setTimeout(() => playTone(659.25, 'triangle', 0.15, 0.24), 160); // E5
            setTimeout(() => playTone(783.99, 'sine', 0.25, 0.28), 240); // G5
        } catch(e) {}
    }

    function dismissContinentGuide() {
        document.body.classList.add('continent-guide-dismissed');
        const bottomPanelEl = document.getElementById('rpgBottomPanel');
        if (bottomPanelEl) {
            bottomPanelEl.style.setProperty('display', 'none', 'important');
        }
    }

    function showContinentBottomPanel() {
        document.body.classList.remove('continent-guide-dismissed');
        const bottomPanelEl = document.getElementById('rpgBottomPanel');
        if (bottomPanelEl) {
            bottomPanelEl.style.removeProperty('display');
            bottomPanelEl.classList.remove('hidden');
        }
        const dialogBoxEl = document.getElementById('dialogBox');
        if (dialogBoxEl) {
            dialogBoxEl.style.removeProperty('display');
            dialogBoxEl.classList.remove('hidden');
        }
        // 確保健康大陸大地圖與關卡介紹彈窗絕不外洩題目即時投票面板與選項網格
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        const optionsGridEl = document.getElementById('optionsGrid');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');
    }

    function zoomIntoContinentRegion(stageKey) {
        const region = CONTINENT_REGIONS[stageKey];
        if (!region) return;

        activeContinentRegionKey = stageKey;
        playStageZoomInSfx();

        const worldEl = document.getElementById('healthContinentWorld');
        const focusRing = document.getElementById('continentFocusRing');

        const originX = region.originX;
        const originY = region.originY;
        const scale = region.scale || 2.6;

        // 平移將目標關卡置於正中央焦點
        const dx = 50 - originX;
        const dy = 50 - originY;

        if (worldEl) {
            worldEl.classList.add('zoomed');
            worldEl.style.transformOrigin = `${originX}% ${originY}%`;
            worldEl.style.transform = `translate(${dx}%, ${dy}%) scale(${scale})`;
        }

        if (focusRing) {
            focusRing.style.left = `${originX}%`;
            focusRing.style.top = `${originY}%`;
            focusRing.classList.remove('hidden');
        }

        document.querySelectorAll('.continent-stage-hotspot').forEach(h => {
            const isTarget = (h.getAttribute('data-stage') === stageKey);
            h.classList.toggle('active-selected', isTarget);
            h.classList.toggle('other-dimmed', !isTarget);
        });

        // 顯示下方對話框以呈現該關卡試煉詳情
        showContinentBottomPanel();

        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');

        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        const optionsGridEl = document.getElementById('optionsGrid');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');

        if (speakerBadge) speakerBadge.textContent = `【${region.title} ‧ 關卡試煉】`;
        if (dialogContent) {
            dialogContent.innerHTML = `
                <div class="continent-dialog-info">
                    <div class="continent-dialog-sub">${region.sub}</div>
                    <div class="continent-dialog-desc">${region.desc}</div>
                    <div class="continent-dialog-actions">
                        <button type="button" class="btn-continent-dialog-enter" onclick="event.stopPropagation(); window.enterContinentStage('${stageKey}')">
                            <span class="btn-icon">⚔️</span><span class="btn-text">進入關卡 ‧ 開始試煉</span>
                        </button>
                        <button type="button" class="btn-continent-dialog-zoomout" onclick="event.stopPropagation(); window.zoomOutContinentMap(true, true)">
                            <span class="btn-icon">🔍</span><span class="btn-text">返回全圖</span>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    function zoomOutContinentMap(playClickSound = true, hideGuide = true) {
        activeContinentRegionKey = null;
        if (playClickSound) sfxClick();

        const worldEl = document.getElementById('healthContinentWorld');
        const focusRing = document.getElementById('continentFocusRing');

        if (worldEl) {
            worldEl.classList.remove('zoomed');
            worldEl.style.transformOrigin = 'center center';
            worldEl.style.transform = 'translate(0, 0) scale(1)';
        }

        if (focusRing) focusRing.classList.add('hidden');

        document.querySelectorAll('.continent-stage-hotspot').forEach(h => {
            h.classList.remove('active-selected', 'other-dimmed');
        });

        const shouldHideGuide = Boolean(hideGuide || window.isCompletedMedicalCity || window.isCompletedSportsStage || window.isCompletedPortStage || window.isCompletedForestStage);

        if (shouldHideGuide) {
            dismissContinentGuide();
        } else {
            // 下方對話框呈現歡迎與點選指引
            showContinentBottomPanel();
            const speakerBadge = document.getElementById('speakerBadge');
            const dialogContent = document.getElementById('dialogContent');

            if (speakerBadge) speakerBadge.textContent = '【健康大陸 ‧ 冒險指南】';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div class="continent-dialog-prompt">
                        🗺️ 歡迎來到健康大陸！請點選地圖上的<strong>六大區域方框</strong>（醫療之城、蔬食之森、社區廣場、活力運動場、研究之都、團膳之港），即可放大推進並開啟專屬職業試煉！
                    </div>
                `;
            }
        }
    }

    function advanceMedicalCityDialogue(e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (document.body.classList.contains('medical-food-step')) return;
        try { sfxClick(); } catch(err) {}
        if (medicalCityStep < 1) {
            showMedicalCityDialogueStep(1);
        } else if (medicalCityStep === 1) {
            showMedicalCityDialogueStep(2);
        } else {
            playMedicalCityIntroVideo();
        }
    }
    window.advanceMedicalCityDialogue = advanceMedicalCityDialogue;

    function startMedicalCityStage1() {
        isMedicalCityActive = true;
        activeContinentStageKey = 'medical';
        document.body.classList.remove('health-continent-active', 'trial-step-0', 'trial-dialog-step', 'continent-guide-dismissed');
        document.body.classList.add('medical-city-active');

        const fyuTitle = document.querySelector('.fyu-title') || document.getElementById('fyuHeaderTitle');
        const fyuSub = document.querySelector('.fyu-sub') || document.getElementById('fyuHeaderSub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = '營養勇者傳：醫療之城';
        if (fyuSub) fyuSub.textContent = '第 1 關：醫療之城 ‧ 王伯伯臨床營養評估';
        if (fyuIcon) fyuIcon.textContent = '⚔️';

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) {
            continentMapEl.classList.add('hidden');
            continentMapEl.style.setProperty('display', 'none', 'important');
            continentMapEl.style.setProperty('visibility', 'hidden', 'important');
            continentMapEl.style.setProperty('pointer-events', 'none', 'important');
        }

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop medical-city-ward-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_medical_city_ward.jpg')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const characterStage = document.getElementById('characterStage');
        if (characterStage) {
            characterStage.classList.remove('hidden');
            characterStage.style.removeProperty('display');
            characterStage.style.removeProperty('visibility');
            characterStage.style.removeProperty('opacity');
            characterStage.style.removeProperty('pointer-events');
        }

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0284c7;color:#fff;">🏥 醫療之城</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>營養勇者傳</strong> ‧ 解鎖專業營養師徽章</span>
                    <span class="p-metrics">當前關卡：<strong>第 1 關 醫療之城</strong> ｜ 任務：<strong>王伯伯臨床營養評估</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#38bdf8;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);border-radius:6px;padding:1px 7px;" onclick="window.playMedicalCityIntroVideo()">🎬 播放試煉影片</span>
                </div>
            `;
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }

        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        if (choicesAreaEl) choicesAreaEl.classList.remove('hidden');

        const optionsGridEl = document.getElementById('optionsGrid');
        if (optionsGridEl) optionsGridEl.classList.remove('hidden');

        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.style.cursor = 'pointer';
            dialogBox.onclick = advanceMedicalCityDialogue;
        }
        const dialogContent = document.getElementById('dialogContent');
        if (dialogContent) {
            dialogContent.style.cursor = 'pointer';
            dialogContent.onclick = advanceMedicalCityDialogue;
        }
        const dialogIndicator = document.getElementById('dialogIndicator');
        if (dialogIndicator) {
            dialogIndicator.style.cursor = 'pointer';
            dialogIndicator.onclick = advanceMedicalCityDialogue;
        }

        const mentorWrapper = document.getElementById('charNurse');
        if (mentorWrapper) {
            mentorWrapper.classList.remove('hidden', 'inactive');
            mentorWrapper.classList.add('speaking');
            mentorWrapper.style.removeProperty('display');
            const nurseImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
            const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
            if (nurseImg) { nurseImg.src = 'assets/mentor_guide.png'; nurseImg.alt = '輔英科大保健營養系 伊麗克絲 營養師'; }
            if (nurseTag) nurseTag.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
        }

        const charStudent = document.getElementById('charStudent');
        if (charStudent) {
            charStudent.style.removeProperty('display');
            charStudent.style.removeProperty('visibility');
            charStudent.style.removeProperty('opacity');
            charStudent.style.removeProperty('pointer-events');
            charStudent.classList.add('hidden');
        }

        currentStage = 1;
        configureBgmForStage(activeUnit, 1);
        showMedicalCityDialogueStep(0);
    }

    let medicalCityStep = 0;
    window.selectedMedicalCityFoodKey = null;

    function showMedicalCityDialogueStep(step) {
        medicalCityStep = step;
        const dialogBox = document.getElementById('dialogBox');
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const charStudentImg = document.getElementById('charStudentImg');
        const charStudentName = document.getElementById('charStudentName');
        const tableArea = document.getElementById('medicalCityFoodTableArea');

        if (dialogBox) dialogBox.classList.remove('hidden');

        if (step === 0) {
            // 第 1 步：專業營養師說話
            if (speakerBadge) {
                speakerBadge.innerHTML = '輔英科大保健營養系 <span class="speaker-name-highlight-white">伊麗克絲</span> 營養師';
            }
            if (dialogContent) {
                dialogContent.innerHTML = '歡迎抵達【醫療之城】！目標：協助病房的王伯伯完成營養評估與照護。準備好接受挑戰，邁向專業營養師了嗎？';
            }
            if (dialogIndicator) dialogIndicator.textContent = '💡 點擊對話框繼續 💬 ➔';
            if (charNurse) {
                charNurse.classList.remove('hidden', 'inactive');
                charNurse.classList.add('speaking');
                charNurse.style.removeProperty('display');
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
            if (tableArea) tableArea.classList.add('hidden');
        } else if (step === 1) {
            // 第 2 步：營養實習生登場並對話
            const heroTitle = (typeof myNickname !== 'undefined' && myNickname) ? `${myNickname} 營養實習生` : '營養實習生';
            if (speakerBadge) speakerBadge.textContent = heroTitle;
            if (dialogContent) {
                dialogContent.innerHTML = '「收到！請學姐放心，我一定會運用學到的營養知識，為王伯伯挑選最適合的健康照護餐點！」';
            }
            if (dialogIndicator) dialogIndicator.textContent = '💡 點擊對話框觀看導引並挑選食物 💬 ➔';
            if (charNurse) {
                charNurse.classList.remove('speaking');
                charNurse.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                charStudent.style.removeProperty('opacity');
                charStudent.style.removeProperty('pointer-events');
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                if (charStudentImg) {
                    charStudentImg.src = selectedGender === 'male'
                        ? 'assets/hero_player_male_intern.png?v=20261021-intern-m'
                        : 'assets/hero_player_female_hd.png?v=20261017-intern-clean-v3';
                    charStudentImg.alt = selectedGender === 'male' ? '營養實習生 (男)' : '營養實習生 (女)';
                }
                if (charStudentName) charStudentName.textContent = heroTitle;
            }
            if (tableArea) tableArea.classList.add('hidden');
        } else if (step >= 2) {
            // 第 3 步：對話結束，挑選食物前播放前導導引影片
            playMedicalCityIntroVideo();
        }
    }

    function showMedicalCityFoodTable() {
        document.body.classList.add('medical-food-step');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const dialogBox = document.getElementById('dialogBox');
        const tableArea = document.getElementById('medicalCityFoodTableArea');
        if (charNurse) {
            charNurse.classList.add('hidden');
            charNurse.classList.remove('speaking');
            charNurse.style.setProperty('display', 'none', 'important');
        }
        if (charStudent) {
            charStudent.classList.add('hidden');
            charStudent.classList.remove('speaking');
            charStudent.style.setProperty('display', 'none', 'important');
        }
        if (bottomPanel) {
            bottomPanel.classList.add('hidden');
            bottomPanel.style.setProperty('display', 'none', 'important');
        }
        if (dialogBox) {
            dialogBox.classList.add('hidden');
            dialogBox.style.setProperty('display', 'none', 'important');
        }
        if (tableArea) {
            tableArea.classList.remove('hidden');
            tableArea.style.removeProperty('display');
        }
    }

    window.selectedMedicalCityFoods = new Set();
    const CORRECT_MEDICAL_FOODS = ['egg', 'veggie', 'rice', 'fish', 'milk'];
    const MEDICAL_FOOD_NAMES = {
        'egg': '蛋',
        'veggie': '青菜',
        'rice': '飯',
        'fish': '魚',
        'milk': '牛奶',
        'boba': '珍珠奶茶',
        'cake': '蛋糕'
    };

    window.selectMedicalCityFood = function(foodKey, foodName) {
        if (!window.selectedMedicalCityFoods) window.selectedMedicalCityFoods = new Set();
        
        // Toggle selection
        if (window.selectedMedicalCityFoods.has(foodKey)) {
            window.selectedMedicalCityFoods.delete(foodKey);
        } else {
            window.selectedMedicalCityFoods.add(foodKey);
        }

        sfxClick();

        // Update card appearance & checkmarks
        const cards = document.querySelectorAll('.table-food-card');
        cards.forEach(c => {
            const k = c.getAttribute('data-food');
            const check = c.querySelector('.food-check-mark');
            if (window.selectedMedicalCityFoods.has(k)) {
                c.classList.add('selected');
                if (check) check.classList.remove('hidden');
            } else {
                c.classList.remove('selected');
                if (check) check.classList.add('hidden');
            }
        });

        // Update count badge
        const badge = document.getElementById('medicalFoodSelectedCount');
        if (badge) {
            badge.textContent = `已選 ${window.selectedMedicalCityFoods.size} 項`;
        }

        // 清除先前的回饋提示以利重新挑選
        const feedbackEl = document.getElementById('medicalCityFoodFeedback');
        if (feedbackEl) {
            feedbackEl.className = 'medical-city-food-feedback hidden';
            feedbackEl.innerHTML = '';
        }
    };

    window.submitMedicalCityFoodSelection = function() {
        const selected = Array.from(window.selectedMedicalCityFoods || []);
        const feedbackEl = document.getElementById('medicalCityFoodFeedback');

        if (selected.length === 0) {
            if (feedbackEl) {
                feedbackEl.className = 'medical-city-food-feedback warn';
                feedbackEl.innerHTML = '⚠️ 還沒有挑選任何食物喔！請先挑選要給王伯伯的健康餐點。';
                feedbackEl.classList.remove('hidden');
            }
            return;
        }

        // Check if selected matches exactly: egg, veggie, rice, fish, milk
        const isMatch = selected.length === CORRECT_MEDICAL_FOODS.length &&
            CORRECT_MEDICAL_FOODS.every(k => selected.includes(k));

        if (isMatch) {
            // 標記本輪完成狀態（僅在當次遊戲進程有效，重開遊戲即自動重設）
            isMedicalCityActive = true;
            window.isCompletedMedicalCity = true;
            window.lastCompletedStageName = '醫療之城';
            markContinentStageCompleted('medical');

            // 回答正確：顯示恭喜過關與勝利特效！
            sfxCorrect();

            // 確保彈窗即時切換為【醫療之城】專屬成就書與返回健康大陸按鈕
            const victoryModal = document.getElementById('rpgVictoryModal');
            if (victoryModal) {
                const vHeader = victoryModal.querySelector('.victory-header h2');
                if (vHeader) vHeader.textContent = '🏆 獲得【醫療之城】成就書';
                const vSub = victoryModal.querySelector('.victory-header .victory-sub');
                if (vSub) vSub.textContent = '🎉 恭喜勇者完成王伯伯臨床營養照護試煉，獲得專屬成就書！';
                const certTitleEl = victoryModal.querySelector('.cert-box-title');
                if (certTitleEl) certTitleEl.textContent = '🎓 獲得「醫療之城」榮譽成就證書';
                const btnDownload = victoryModal.querySelector('#btnDownloadCert');
                if (btnDownload) btnDownload.textContent = '📷 下載「醫療之城」成就書圖檔 (PNG)';
                const btnClose = victoryModal.querySelector('#btnCloseLeaderboard');
                if (btnClose) {
                    btnClose.textContent = '🗺️ 領取成就，返回健康大陸 ➔';
                    btnClose.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    btnClose.style.color = '#ffffff';
                    btnClose.style.fontWeight = 'bold';
                    btnClose.style.fontSize = '16px';
                    btnClose.style.padding = '12px 24px';
                    btnClose.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
                }
                const btnReturn = victoryModal.querySelector('#btnReturnLobby');
                if (btnReturn) {
                    btnReturn.classList.add('hidden');
                    btnReturn.style.setProperty('display', 'none', 'important');
                }
                const pendingNotice = victoryModal.querySelector('#pendingNextQuestionNotice');
                if (pendingNotice) {
                    pendingNotice.classList.add('hidden');
                    pendingNotice.style.setProperty('display', 'none', 'important');
                }
            }

            triggerVictory();

            if (feedbackEl) {
                feedbackEl.className = 'medical-city-food-feedback success';
                feedbackEl.innerHTML = `
                    <div style="font-size:1.15em;font-weight:900;color:#fef08a;margin-bottom:4px;">🎉 恭喜過關！完成王伯伯營養照護試煉！</div>
                    <div>精準挑選了【<strong>蛋、青菜、飯、魚、牛奶</strong>】等原型均衡營養，成功獲得【醫療之城】榮譽成就證書！</div>
                `;
                feedbackEl.classList.remove('hidden');
            }

            // 更新按鈕文字為過關狀態
            const submitBtn = document.getElementById('btnSubmitMedicalFood');
            if (submitBtn) {
                submitBtn.innerHTML = '🏆 獲得【醫療之城】成就證書 ‧ 完美通關！';
                submitBtn.style.background = 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)';
                submitBtn.disabled = true;
            }
        } else {
            // 回答未完全正確：溫馨提示
            sfxWrong();
            const wrongItems = selected.filter(k => !CORRECT_MEDICAL_FOODS.includes(k)).map(k => MEDICAL_FOOD_NAMES[k]);
            const missingCount = CORRECT_MEDICAL_FOODS.filter(k => !selected.includes(k)).length;
            
            let hint = '';
            if (wrongItems.length > 0) {
                hint = `提醒：【${wrongItems.join('、')}】糖分或精緻糖過高，對王伯伯目前的病況照護不太適合喔！`;
            } else if (missingCount > 0) {
                hint = `目前選擇的都是健康食物，但還缺少其他核心食物喔！請再想想「全穀、豆魚蛋肉、蔬菜、乳品」的均衡搭配！`;
            }

            if (feedbackEl) {
                feedbackEl.className = 'medical-city-food-feedback warn';
                feedbackEl.innerHTML = `
                    <div style="font-weight:800;color:#fecaca;margin-bottom:3px;">⚠️ 還差一點點！</div>
                    <div>${hint}</div>
                `;
                feedbackEl.classList.remove('hidden');
            }
        }
    };

    let activeContinentStageKey = null;

    const PORT_STAGE_DATA = {
        title: '團膳營養師試煉 ‧ 學校午餐菜單設計',
        speaker: '輔英科大保健營養系 伊麗克絲 專業營養師',
        speech: '實習營養師，歡迎來到團膳營養部！今天你將負責 100 位學生的午餐規劃，準備好接受挑戰了嗎？100 人的午餐？只要把1個人的食譜放大 100 倍，應該就能完成了吧！沒那麼簡單喔！還要考慮每人預算、食材份量、營養均衡和食品安全呢！而且學校規定每人餐費不能超過 60 元，請你在預算內設計出最合適的午餐。題目：以下哪一份菜單最適合在每人 60 元的預算內，供應 100 位學生？',
        options: [
            {
                key: 'A',
                score: '選項 A',
                text: '特級和牛排、焗烤明蝦、松露燉飯、國產鮮乳',
                hint: '❌ 成本嚴重超標！和牛排與焗烤明蝦單人採購成本即破百元，遠超過每人 60 元預算限制。'
            },
            {
                key: 'B',
                score: '選項 B',
                text: '原味白吐司、脆皮炸薯條、珍珠奶茶、草莓蛋糕',
                hint: '❌ 營養不均衡！高糖、高精緻澱粉且缺乏優質蛋白質與深色蔬菜，違反學校午餐營養基準。'
            },
            {
                key: 'C',
                score: '選項 C',
                text: '香Q胚芽米飯、照燒雞腿、番茄炒蛋、時令有機炒時蔬、玉米豆腐湯、國產鮮乳',
                hint: '🎉 答對了！兼顧全穀雜糧、優質蛋白、蔬菜與乳品六大類均衡，大宗採購成本完全落在 60 元預算內，且全熟烹調符合食安規範！'
            },
            {
                key: 'D',
                score: '選項 D',
                text: '生牛肉蔬果沙拉、半熟溏心蛋、未滅菌生乳、現切生菜',
                hint: '❌ 違反食品安全！生食與半熟蛋具有沙門氏菌與大腸桿菌中毒高風險，學校午餐嚴格禁止供應生食。'
            }
        ],
        correctKey: 'C'
    };

    let portStageSelectedKey = null;
    let portStageAnswerRevealed = false;
    let portDialogueStep = 0;
    let portDialogueVideoShown = false;
    let portDialogueVideoBgmWasPlaying = false;

    function finishPortDialogueVideo() {
        const overlay = document.getElementById('portDialogueVideoOverlay');
        const video = document.getElementById('portDialogueVideo');
        const status = document.getElementById('portDialogueVideoStatus');
        const retryButton = document.getElementById('portDialogueVideoRetry');
        if (video) {
            try { video.pause(); } catch (e) {}
            video.onended = null;
            video.onerror = null;
        }
        if (overlay) overlay.classList.add('hidden');
        if (status) status.textContent = '';
        if (retryButton) retryButton.classList.add('hidden');
        if (portDialogueVideoBgmWasPlaying && soundEnabled) playBgm();
        portDialogueVideoBgmWasPlaying = false;

        // 影片播放完畢後：進入田字格四象限菜單作答舞台 (ABCD)
        startPortQuizStage();
    }

    // 團膳之港 ‧ 田字格四象限菜單作答舞台
    window.selectedPortOption = null;

    function clearSportsStageArtifacts() {
        const sportsIntroVideoOverlay = document.getElementById('sportsIntroVideoOverlay');
        if (sportsIntroVideoOverlay) sportsIntroVideoOverlay.classList.add('hidden');

        const sportsIntroVideo = document.getElementById('sportsIntroVideo');
        if (sportsIntroVideo) {
            try {
                sportsIntroVideo.pause();
            } catch (error) {
                console.warn('Unable to stop sports intro video before entering the port stage.', error);
            }
            sportsIntroVideo.onended = null;
            sportsIntroVideo.onerror = null;
        }

        const sportsQuizArea = document.getElementById('sportsQuizArea');
        if (sportsQuizArea) {
            sportsQuizArea.classList.add('hidden');
            sportsQuizArea.style.setProperty('display', 'none', 'important');
        }

        const azheWrapper = document.getElementById('sportsAzheCharacter');
        if (azheWrapper) {
            azheWrapper.classList.add('hidden');
            azheWrapper.classList.remove('speaking', 'inactive', 'azhe-surprised-shaking');
            azheWrapper.style.setProperty('display', 'none', 'important');
            azheWrapper.style.setProperty('visibility', 'hidden', 'important');
        }
    }

    function startPortQuizStage() {
        activeContinentStageKey = 'port';
        isMedicalCityActive = false;
        document.body.classList.remove('health-continent-active', 'trial-step-0', 'trial-dialog-step', 'continent-guide-dismissed', 'medical-city-active', 'sports-stage-active', 'sports-quiz-step');
        document.body.classList.add('port-stage-active', 'port-quiz-step');
        hideHealthContinentMapForStage();
        clearSportsStageArtifacts();

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) continentMapEl.classList.add('hidden');

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop continent-scenery-theme port-stage-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_continent_port.png?stage-bg-sync-v1')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'left center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        // 隱藏立繪人物
        const charStage = document.getElementById('characterStage');
        if (charStage) {
            charStage.classList.add('hidden');
            charStage.style.setProperty('display', 'none', 'important');
        }

        // 隱藏其他關卡的覆蓋舞台
        ['communityStage1QuizArea', 'communityStage2QuizArea', 'communityStage3QuizArea', 'forestQuizArea', 'sportsQuizArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add('hidden');
                el.style.setProperty('display', 'none', 'important');
            }
        });
        document.body.classList.remove('forest-quiz-step');

        // 顯示頂部快捷個案橫幅

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0f766e;color:#fff;font-weight:900;">🍱 團膳之港</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>團膳勇者試驗</strong> ‧ 學校午餐菜單設計</span>
                    <span class="p-metrics">任務：<strong>100位學生每人60元預算平衡與營養規劃</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#bbf7d0;background:rgba(20,184,166,0.15);border:1px solid rgba(45,212,191,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        // 顯示 ABCD 田字格四象限菜單作答舞台
        const quizArea = document.getElementById('portQuizArea');
        if (quizArea) {
            quizArea.classList.remove('hidden');
            quizArea.style.removeProperty('display');
            quizArea.style.setProperty('display', 'block', 'important');
        }

        // 保持下方經典對話框 `#rpgBottomPanel` 呈現題目說明
        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
            bottomPanel.onclick = null;
            bottomPanel.style.cursor = 'default';
        }
        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.onclick = null;
            dialogBox.style.cursor = 'default';
        }
        const speakerBadge = document.getElementById('speakerBadge');
        if (speakerBadge) {
            speakerBadge.textContent = '【題目說明】';
        }
        const dialogContent = document.getElementById('dialogContent');
        if (dialogContent) {
            dialogContent.onclick = null;
            dialogContent.style.cursor = 'default';
            dialogContent.innerHTML = `
                <span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">以下哪一份菜單最適合在每人 <span style="color:#fef08a;">60 元</span> 的預算內，供應 <span style="color:#fef08a;">100 位學生</span>？</span>
                <div style="color:#94a3b8;font-size:13px;margin-top:6px;">🎬 說明影片播放完畢，請點選上方田字格菜單 (A、B、C、D) 進行作答。</div>
            `;
        }
        const dialogIndicator = document.getElementById('dialogIndicator');
        if (dialogIndicator) {
            dialogIndicator.onclick = null;
            dialogIndicator.style.cursor = 'default';
            dialogIndicator.innerHTML = '💡 點選上方 ABCD 四象限菜單進行作答';
        }

        // 重設選項狀態
        window.selectedPortOption = null;
        document.querySelectorAll('.port-quadrant-btn, .port-quad-badge').forEach(btn => {
            btn.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
        });
    }
    window.startPortQuizStage = startPortQuizStage;

    window.selectPortOption = function(optKey, event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        window.selectedPortOption = optKey;
        sfxClick();

        const btns = document.querySelectorAll('.port-quadrant-btn, .port-quad-badge');
        btns.forEach(btn => {
            const k = btn.getAttribute('data-opt');
            btn.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
            if (k === optKey) {
                btn.classList.add('selected');
            }
        });

        // 答案驗證：正確答案為 C
        const isCorrect = (optKey === 'C');
        const dialogIndicator = document.getElementById('dialogIndicator');

        if (isCorrect) {
            sfxCorrect();
            window.isCompletedPortStage = true;
            window.lastCompletedStageName = '團膳之港';
            markContinentStageCompleted('port');

            // 正確答案亮綠光
            btns.forEach(btn => {
                const k = btn.getAttribute('data-opt');
                if (k === 'C') {
                    btn.classList.add('is-correct-answer');
                }
            });

            if (dialogIndicator) {
                dialogIndicator.innerHTML = '🎉 <span style="color:#4ade80;font-weight:bold;">答對了！</span>菜單符合 60 元預算且六大類營養均衡！ <span style="color:#fde047;cursor:pointer;text-decoration:underline;margin-left:8px;" onclick="window.triggerVictory();">🏆 領取成就書 ➔</span>';
            }

            if (window.showToast) {
                window.showToast('🎉 答對了！選項 C 兼顧每人 60 元預算與六大類營養均衡！', 'success');
            }

            // 延遲1.2秒後彈出成就書與證書
            setTimeout(() => {
                const victoryModal = document.getElementById('rpgVictoryModal');
                if (victoryModal) {
                    const vHeader = victoryModal.querySelector('.victory-header h2');
                    if (vHeader) vHeader.textContent = '🏆 獲得【團膳之港】成就書';
                    const vSub = victoryModal.querySelector('.victory-header .victory-sub');
                    if (vSub) vSub.textContent = '🎉 恭喜完成 100 位學生學校午餐菜單規劃，成功兼顧成本預算與營養均衡！';
                    const certTitleEl = victoryModal.querySelector('.cert-box-title');
                    if (certTitleEl) certTitleEl.textContent = '🎓 獲得「團膳之港」榮譽成就證書';
                    const btnDownload = victoryModal.querySelector('#btnDownloadCert');
                    if (btnDownload) btnDownload.textContent = '📷 下載「團膳之港」成就書圖檔 (PNG)';
                    const btnClose = victoryModal.querySelector('#btnCloseLeaderboard');
                    if (btnClose) {
                        btnClose.textContent = '🗺️ 領取成就，返回健康大陸 ➔';
                        btnClose.style.background = 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)';
                        btnClose.style.color = '#ffffff';
                        btnClose.style.fontWeight = 'bold';
                        btnClose.style.fontSize = '16px';
                        btnClose.style.padding = '12px 24px';
                        btnClose.style.boxShadow = '0 4px 15px rgba(20, 184, 166, 0.4)';
                    }
                }
                triggerVictory();
            }, 1200);

        } else {
            sfxWrong();
            // 答錯亮紅光，並提示
            btns.forEach(btn => {
                const k = btn.getAttribute('data-opt');
                if (k === optKey) {
                    btn.classList.add('is-wrong-answer');
                }
            });

            const optHints = {
                'A': '選項 A 包含高價牛排或炸物，成本嚴重超標！',
                'B': '選項 B 營養不均衡或成本超出每人 60 元限制！',
                'D': '選項 D 缺乏優質蛋白或蔬菜，不符合學校午餐標準！'
            };
            const hintText = optHints[optKey] || `選項 ${optKey} 不符合預算或營養標準！`;

            if (dialogIndicator) {
                dialogIndicator.innerHTML = `❌ <span style="color:#f87171;font-weight:bold;">${hintText}</span> 請點選其他菜單重新嘗試！`;
            }

            if (window.showToast) {
                window.showToast(`❌ ${hintText} 請再試試！`, 'warn');
            }
        }
    };

    function playPortDialogueVideo() {
        if (activeContinentStageKey !== 'port' || portDialogueVideoShown) return;
        const overlay = document.getElementById('portDialogueVideoOverlay');
        const video = document.getElementById('portDialogueVideo');
        const status = document.getElementById('portDialogueVideoStatus');
        const retryButton = document.getElementById('portDialogueVideoRetry');
        if (!overlay || !video || !status || !retryButton) return;

        portDialogueVideoShown = true;
        portDialogueVideoBgmWasPlaying = !!(bgmPlaying && rpgBgmAudio && !rpgBgmAudio.paused);
        if (portDialogueVideoBgmWasPlaying) pauseBgm();

        overlay.classList.remove('hidden');
        status.textContent = '';
        retryButton.classList.add('hidden');
        video.onended = finishPortDialogueVideo;
        video.onerror = () => {
            status.textContent = '影片載入失敗，請重試或返回團膳之港。';
            retryButton.classList.remove('hidden');
        };

        const startPlayback = () => {
            video.currentTime = 0;
            const playback = video.play();
            if (playback && typeof playback.then === 'function') {
                playback.then(() => {
                    status.textContent = '';
                    retryButton.classList.add('hidden');
                }).catch(() => {
                    status.textContent = '若影片未自動播放，請點擊下方按鈕開始。';
                    retryButton.classList.remove('hidden');
                });
            }
        };
        retryButton.onclick = startPlayback;
        startPlayback();
    }

    function renderPortDialogueStep(step) {
        portDialogueStep = step;
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const charStudentImg = document.getElementById('charStudentImg');
        const charStudentName = document.getElementById('charStudentName');

        const charStage = document.getElementById('characterStage');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const dialogBox = document.getElementById('dialogBox');

        // 確保非運動場角色（阿哲）在團膳之港完全隱藏
        const azheCharacter = document.getElementById('sportsAzheCharacter');
        if (azheCharacter) {
            azheCharacter.classList.add('hidden');
            azheCharacter.classList.remove('speaking', 'inactive', 'azhe-surprised-shaking');
            azheCharacter.style.setProperty('display', 'none', 'important');
            azheCharacter.style.setProperty('visibility', 'hidden', 'important');
        }

        // 非作答步驟時，隱藏題目 1 與題目 2 的覆蓋卡片層

        // 切換試煉時清除其他關卡留下的圖片選項層與版面狀態。
        [
            'forestQuizArea',
            'forestStage2QuizArea',
            'communityStage1QuizArea',
            'communityStage2QuizArea',
            'communityStage3QuizArea',
            'researchStage1QuizArea',
            'researchStage2QuizArea'
        ].forEach(id => {
            const overlay = document.getElementById(id);
            if (!overlay) return;
            overlay.classList.add('hidden');
            overlay.style.setProperty('display', 'none', 'important');
        });
        document.body.classList.remove(
            'forest-quiz-step',
            'community-stage-active',
            'forest-stage-active',
            'research-stage-active'
        );

        if (charStage) {
            charStage.classList.remove('hidden');
            charStage.style.removeProperty('display');
            charStage.style.removeProperty('visibility');
        }
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.style.removeProperty('display');
        }

        function applySpeakerVisual(el, isSpeaking) {
            if (!el) return;
            if (isSpeaking) {
                el.classList.remove('inactive', 'hidden');
                el.classList.add('speaking');
                el.style.setProperty('opacity', '1', 'important');
                el.style.setProperty('transform', 'scale(1.08) translateY(-4px)', 'important');
                el.style.setProperty('filter', 'drop-shadow(0 0 16px rgba(254, 240, 138, 0.95)) drop-shadow(0 8px 24px rgba(0, 0, 0, 0.85))', 'important');
                el.style.setProperty('z-index', '95', 'important');
                const sprite = el.querySelector('.char-sprite');
                if (sprite) {
                    sprite.style.setProperty('filter', 'drop-shadow(0 0 14px rgba(254, 240, 138, 0.85))', 'important');
                    sprite.style.setProperty('opacity', '1', 'important');
                }
            } else {
                el.classList.remove('speaking');
                el.classList.add('inactive');
                el.style.setProperty('opacity', '0.68', 'important');
                el.style.setProperty('transform', 'scale(0.82) translateY(4px)', 'important');
                el.style.setProperty('filter', 'grayscale(100%) brightness(0.78)', 'important');
                el.style.setProperty('z-index', '85', 'important');
                const sprite = el.querySelector('.char-sprite');
                if (sprite) {
                    sprite.style.setProperty('filter', 'none', 'important');
                    sprite.style.setProperty('opacity', '1', 'important');
                }
            }
        }

        if (step === 0) {
            // 第 1 句：營養師
            if (speakerBadge) speakerBadge.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「實習營養師，歡迎來到團膳營養部！今天你將負責 <span style="color: #fef08a;">100 位學生</span>的午餐規劃，準備好接受挑戰了嗎？」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊對話繼續 ➔';
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (mentorWrapper) {
                applySpeakerVisual(mentorWrapper, true);
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const nutritionistImg = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const nutritionistTag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (nutritionistImg) {
                    nutritionistImg.src = 'assets/mentor_guide.png';
                    nutritionistImg.alt = '輔英科大保健營養系 伊麗克絲 營養師';
                    nutritionistImg.style.removeProperty('display');
                }
                if (nutritionistTag) nutritionistTag.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
                charStudent.style.setProperty('display', 'none', 'important');
            }
        } else if (step === 1) {
            // 第 2 句：實習營養師
            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「<span style="color: #fef08a;">100 人</span>的午餐？只要把1個人的食譜放大 100 倍，應該就能完成了吧！」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊對話繼續 ➔';
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (mentorWrapper) {
                applySpeakerVisual(mentorWrapper, false);
            }
            if (charStudent) {
                applySpeakerVisual(charStudent, true);
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                if (charStudentImg) {
                    charStudentImg.src = selectedGender === 'male'
                        ? 'assets/hero_player_male_intern.png?v=20261021-intern-m'
                        : 'assets/hero_player_female_hd.png?v=20261017-intern-clean-v3';
                    charStudentImg.alt = selectedGender === 'male' ? '營養實習生 (男)' : '營養實習生 (女)';
                    charStudentImg.style.removeProperty('display');
                }
                if (charStudentName) charStudentName.textContent = getNutritionInternDisplayName();
            }
        } else if (step === 2) {
            // 第 3 句：營養師
            if (speakerBadge) speakerBadge.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「沒那麼簡單喔！還要考慮每人<span style="color:#fef08a;">預算</span>、<span style="color:#fef08a;">食材份量</span>、<span style="color:#fef08a;">營養均衡</span>和<span style="color:#fef08a;">食品安全</span>呢！」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊對話繼續 ➔';
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (mentorWrapper) {
                applySpeakerVisual(mentorWrapper, true);
                mentorWrapper.style.removeProperty('display');
            }
            if (charStudent) {
                applySpeakerVisual(charStudent, false);
            }
        } else if (step >= 3) {
            // 第 4 句：營養師呈現任務內容；團膳之港不顯示下方選項
            if (mentorWrapper) {
                applySpeakerVisual(mentorWrapper, true);
                mentorWrapper.style.removeProperty('display');
            }
            if (charStudent) {
                applySpeakerVisual(charStudent, false);
            }
            if (speakerBadge) speakerBadge.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6; margin-bottom: 6px;">
                        「而且學校規定每人餐費不能超過 <span style="color:#fef08a;">60 元</span>，請你在預算內設計出最合適的午餐。」
                    </div>
                    <div style="color: #cbd5e1; font-size: 14px;">
                        💡 任務：以下哪一份菜單最適合在每人 <span style="color:#fef08a;">60 元</span> 的預算內，供應 <span style="color:#fef08a;">100 位學生</span>？
                    </div>
                `;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '🎬 對話結束後，點擊繼續播放影片 ➔';
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
            }
            if (charStudent) {
                charStudent.classList.remove('speaking');
                charStudent.classList.add('inactive');
            }

        }

        const handlePortAdvance = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (portDialogueStep < 3) {
                renderPortDialogueStep(portDialogueStep + 1);
            } else {
                playPortDialogueVideo();
            }
        };

        window.advancePortDialogue = handlePortAdvance;

        if (dialogBox) {
            dialogBox.style.cursor = 'pointer';
            dialogBox.onclick = handlePortAdvance;
        }
        if (dialogContent) {
            dialogContent.style.cursor = 'pointer';
            dialogContent.onclick = handlePortAdvance;
        }
        if (dialogIndicator) {
            dialogIndicator.style.cursor = 'pointer';
            dialogIndicator.onclick = handlePortAdvance;
        }
        if (bottomPanel) {
            bottomPanel.style.cursor = 'pointer';
            bottomPanel.onclick = (e) => {
                if (e.target.closest('#optionsGrid, .rpg-choice-btn, button')) return;
                handlePortAdvance(e);
            };
        }
        const mainStage = document.getElementById('rpgMainStage');
        if (mainStage) {
            mainStage.onclick = (e) => {
                if (activeContinentStageKey === 'port') {
                    if (e.target.closest('#optionsGrid, .rpg-choice-btn, button, .continent-stage-hotspot, .p-order')) {
                        return;
                    }
                    handlePortAdvance(e);
                }
            };
        }
    }

    function advancePortDialogue() {
        if (activeContinentStageKey !== 'port') return;
        if (portDialogueStep < 3) {
            renderPortDialogueStep(portDialogueStep + 1);
        } else {
            playPortDialogueVideo();
        }
    }

    function renderPortStageOptions() {
        const optionsGridEl = document.getElementById('optionsGrid');
        if (!optionsGridEl) return;
        optionsGridEl.innerHTML = '';

        PORT_STAGE_DATA.options.forEach((opt) => {
            const btn = document.createElement('div');
            btn.className = 'rpg-choice-btn';
            btn.dataset.key = opt.key;

            if (portStageSelectedKey === opt.key) {
                btn.classList.add('selected');
            }

            if (portStageAnswerRevealed) {
                if (opt.key === PORT_STAGE_DATA.correctKey) {
                    btn.classList.add('is-correct-answer');
                } else if (portStageSelectedKey === opt.key) {
                    btn.classList.add('is-wrong-answer');
                }
            }

            btn.innerHTML = `
                <div class="choice-left" style="display:flex;align-items:center;gap:10px;">
                    <span class="choice-score-badge" style="background:${portStageAnswerRevealed && opt.key === PORT_STAGE_DATA.correctKey ? '#059669' : '#2563eb'};color:#ffffff;font-weight:900;padding:4px 10px;border-radius:6px;">${opt.score}</span>
                    <span class="choice-text" style="font-size:15px;line-height:1.4;">${opt.text}</span>
                </div>
                <div class="choice-right">
                    ${portStageAnswerRevealed && opt.key === PORT_STAGE_DATA.correctKey ? '<span style="color:#34d399;font-weight:bold;font-size:14px;">✅ 正確菜單</span>' : ''}
                </div>
            `;

            btn.onclick = () => {
                selectPortStageOption(opt.key);
            };

            optionsGridEl.appendChild(btn);
        });
    }

    function selectPortStageOption(key) {
        portStageSelectedKey = key;
        portStageAnswerRevealed = true;
        sfxClick();

        const opt = PORT_STAGE_DATA.options.find(o => o.key === key);
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');

        if (key === PORT_STAGE_DATA.correctKey) {
            sfxCorrect();
            triggerVictory();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#4ade80;font-weight:bold;font-size:1.1em;margin-bottom:6px;">🏆 試煉完美通過！獲得伊麗克絲營養師高度讚許！</div>
                    <div style="color:#ffffff;line-height:1.5;">${opt.hint}</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '🎉 完美通關 ‧ 點擊全圖或上方返回健康大陸 ➔';
            }
        } else {
            sfxWrong();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#f87171;font-weight:bold;font-size:1.1em;margin-bottom:6px;">⚠️ 伊麗克絲營養師皺起眉頭：「這份菜單不太符合要求喔！」</div>
                    <div style="color:#fef08a;line-height:1.5;">${opt.hint}</div>
                    <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">💡 提示：請重新點選其他選項再次挑戰！</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '💡 請重新選擇最佳預算與均衡營養菜單 ➔';
            }
        }

        renderPortStageOptions();
    }

    function startPortStage() {
        activeContinentStageKey = 'port';
        isMedicalCityActive = false;
        configureBgmForStage(activeUnit, currentStage || 1);
        portStageSelectedKey = null;
        portStageAnswerRevealed = false;
        portDialogueStep = 0;
        portDialogueVideoShown = false;

        document.body.classList.remove(
            'health-continent-active',
            'trial-step-0',
            'trial-dialog-step',
            'continent-guide-dismissed',
            'medical-city-active',
            'sports-stage-active',
            'sports-quiz-step',
            'port-quiz-step',
            'continent-scenery-stage-active'
        );
        document.body.classList.add('port-stage-active');
        hideHealthContinentMapForStage();
        clearSportsStageArtifacts();

        const portQuizArea = document.getElementById('portQuizArea');
        if (portQuizArea) {
            portQuizArea.classList.add('hidden');
            portQuizArea.style.setProperty('display', 'none', 'important');
        }

        const fyuTitle = document.querySelector('.fyu-title') || document.getElementById('fyuHeaderTitle');
        const fyuSub = document.querySelector('.fyu-sub') || document.getElementById('fyuHeaderSub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = '營養勇者傳：團膳之港';
        if (fyuSub) fyuSub.textContent = '團體膳食營運 ‧ 食品安全與大規模供餐試煉';
        if (fyuIcon) fyuIcon.textContent = '⚔️';

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) continentMapEl.classList.add('hidden');

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop continent-scenery-theme port-stage-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_continent_port.png?stage-bg-sync-v1')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'left center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }

        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.remove('hidden');

        // 隱藏非團膳之港立繪（如活力運動場阿哲）
        const sportsAzheCharacter = document.getElementById('sportsAzheCharacter');
        if (sportsAzheCharacter) {
            sportsAzheCharacter.classList.add('hidden');
            sportsAzheCharacter.classList.remove('speaking', 'inactive', 'azhe-surprised-shaking');
            sportsAzheCharacter.style.setProperty('display', 'none', 'important');
            sportsAzheCharacter.style.setProperty('visibility', 'hidden', 'important');
        }

        // 顯示輔英科大保健營養系 伊麗克絲 營養師立繪
        const mentorWrapper = document.getElementById('charNurse');
        if (mentorWrapper) {
            mentorWrapper.classList.remove('hidden', 'inactive');
            mentorWrapper.classList.add('speaking');
            mentorWrapper.style.removeProperty('display');
            const nutritionistImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
            const nutritionistTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
            if (nutritionistImg) {
                nutritionistImg.src = 'assets/mentor_guide.png';
                nutritionistImg.alt = '輔英科大保健營養系 伊麗克絲 營養師';
            }
            if (nutritionistTag) nutritionistTag.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
        }
        const charStudent = document.getElementById('charStudent');
        if (charStudent) charStudent.classList.add('hidden');

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0f766e;color:#fff;font-weight:900;">🍱 團膳之港</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>團膳勇者試驗</strong> ‧ 學校午餐菜單設計</span>
                    <span class="p-metrics">任務：<strong>100人份每人60元預算平衡與營養規劃</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#bbf7d0;background:rgba(20,184,166,0.15);border:1px solid rgba(45,212,191,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        // 開始第 0 步對話
        renderPortDialogueStep(0);

        // 啟動朗讀題目（使用女生語音）
        if (isTeacher) {
            speakQuestionText(activeUnit, currentStage);
        }
    }

    let sportsDialogueStep = 0;

    function renderSportsDialogueStep(step) {
        sportsDialogueStep = step;
        if (sportsSurpriseAudio && step !== 4) {
            sportsSurpriseAudio.pause();
            sportsSurpriseAudio.currentTime = 0;
            sportsSurpriseAudio = null;
        }
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const dialogBox = document.getElementById('dialogBox');
        const charStage = document.getElementById('characterStage');
        const azheWrapper = document.getElementById('sportsAzheCharacter');
        const azheImg = document.getElementById('sportsAzheImg');
        const mentorWrapper = document.getElementById('charNurse');
        const teacherImg = document.getElementById('charTeacherImg');
        const charStudent = document.getElementById('charStudent');
        const studentImg = document.getElementById('charStudentImg');

        if (charStage) {
            charStage.classList.remove('hidden');
            charStage.style.removeProperty('display');
            charStage.style.removeProperty('visibility');
        }

        // 活力運動場依玩家性別顯示營養師與對應的實習營養師立繪。
        if (teacherImg) {
            teacherImg.src = 'assets/mentor_guide.png';
            teacherImg.alt = '輔英科大保健營養系 伊麗克絲 營養師';
            teacherImg.style.removeProperty('display');
        }
        if (studentImg) {
            studentImg.src = selectedGender === 'male'
                ? 'assets/hero_player_male_intern.png?v=20261021-intern-m'
                : 'assets/hero_player_female_hd.png?v=20261017-intern-clean-v3';
            studentImg.alt = selectedGender === 'male' ? '營養實習生 (男)' : '營養實習生 (女)';
            studentImg.style.removeProperty('display');
        }
        if (azheImg) {
            azheImg.src = step === 4
                ? 'assets/char_sports_azhe_surprised_half.png?v=20261016-defringe-v2'
                : 'assets/char_sports_azhe_half.png?v=20261016-defringe-v2';
            azheImg.alt = step === 4 ? '阿哲（驚訝）' : '阿哲';
            azheImg.style.removeProperty('display');
        }

        const teacherName = document.getElementById('charTeacherName');
        const studentName = document.getElementById('charStudentName');
        if (teacherName) teacherName.textContent = '伊麗克絲 營養師';
        if (studentName) studentName.textContent = selectedGender === 'male' ? '男生營養實習生' : '女生營養實習生';

        if (mentorWrapper) {
            mentorWrapper.classList.remove('hidden', 'azhe-surprised-shaking', 'trial-mentor-dialog-position');
            mentorWrapper.style.removeProperty('display');
            mentorWrapper.style.removeProperty('visibility');
        }
        if (azheWrapper) {
            azheWrapper.classList.remove('hidden');
            azheWrapper.style.removeProperty('display');
            azheWrapper.style.removeProperty('visibility');
        }
        if (charStudent) {
            charStudent.classList.remove('hidden');
            charStudent.style.removeProperty('display');
            charStudent.style.removeProperty('visibility');
        }

        // 對話清單定義
        // Step 0: 阿哲引言
        // Step 1: 專業營養師問吃什麼
        // Step 2: 阿哲說常不吃早餐午餐喝乳清
        // Step 3: 專業營養師指出問題總熱量與碳水
        // Step 4: 阿哲提出疑問並引導觀看影片
        if (step === 0) {
            // 阿哲在健身房場景中說話。
            if (speakerBadge) speakerBadge.innerHTML = '輔英科技大學保健營養系 <span class="speaker-name-highlight-white">阿哲</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「您好！我是阿哲，今年 18 歲，<span style="color: #fef08a;">每週重訓 3 次</span> 💪，想練出更壯的肌肉，因此<span style="color: #fef08a;">每天喝乳清蛋白</span>，但為什麼肌肉還是長不大呢？伊麗克絲 營養師，快幫我找出問題！」</span>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '點擊對話繼續 ➔';
                dialogIndicator.style.cursor = 'pointer';
            }
        } else if (step === 1) {
            // 專業營養師：「阿哲，先別怪基因！你一整天都吃些什麼？」
            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科大保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「阿哲，先別怪基因！你一整天都吃些什麼？」</span>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '點擊對話繼續 ➔';
                dialogIndicator.style.cursor = 'pointer';
            }
        } else if (step === 2) {
            // 阿哲：「我想增肌又怕變胖，所以常不吃早餐，午餐也只吃一點點。但我每天都有喝一大杯乳清蛋白，這樣蛋白質夠了吧？」
            if (speakerBadge) speakerBadge.innerHTML = '輔英科技大學保健營養系 <span class="speaker-name-highlight-white">阿哲</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「我想增肌又怕變胖，所以常<span style="color: #fef08a;">不吃早餐</span>，午餐也只吃一點點。但我每天都有喝一大杯<span style="color: #fef08a;">乳清蛋白</span>，這樣蛋白質夠了吧？」</span>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '點擊對話繼續 ➔';
                dialogIndicator.style.cursor = 'pointer';
            }
        } else if (step === 3) {
            // 專業營養師：「這就是問題！不吃早餐、午餐又吃太少，總熱量與碳水化合物都吃不夠！」
            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科大保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「這就是問題！不吃早餐、午餐又吃太少，<span style="color: #fef08a;">總熱量</span>與<span style="color: #fef08a;">碳水化合物</span>都吃不夠！」</span>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '點擊對話繼續 ➔';
                dialogIndicator.style.cursor = 'pointer';
            }
        } else if (step === 4) {
            // 阿哲驚訝提問：「咦？長肌肉不是只要蛋白質嗎？難道熱量和碳水化合物也有關係？」
            // 嚴格依指示："難道" "和" "也有關係?" 為白色，"熱量" "碳水化合物" 為黃色
            try {
                if (sportsSurpriseAudio) {
                    sportsSurpriseAudio.pause();
                    sportsSurpriseAudio.currentTime = 0;
                }
                sportsSurpriseAudio = new Audio('assets/sports_azhe_surprise.mp3?v=20261018-azhe-surprise');
                sportsSurpriseAudio.volume = 0.9;
                sportsSurpriseAudio.play().catch(() => {});
            } catch (error) {
                console.warn('Unable to play Azhe surprise sound effect.', error);
            }
            if (speakerBadge) speakerBadge.innerHTML = '輔英科技大學保健營養系 <span class="speaker-name-highlight-white">阿哲</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「咦？長肌肉不是只要蛋白質嗎？難道<span style="color: #fef08a;">熱量</span>和<span style="color: #fef08a;">碳水化合物</span>也有關係？」</span>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '🎬 點擊觀看【運動營養教學影片】找出解答 ➔';
                dialogIndicator.style.cursor = 'pointer';
            }
        }

        const azheIsSpeaking = step === 0 || step === 2 || step === 4;
        const dietitianIsSpeaking = step === 1 || step === 3;
        if (azheWrapper) {
            azheWrapper.classList.toggle('speaking', azheIsSpeaking);
            azheWrapper.classList.toggle('inactive', !azheIsSpeaking);
            azheWrapper.classList.toggle('azhe-surprised-shaking', step === 4);
        }
        if (mentorWrapper) {
            mentorWrapper.classList.toggle('speaking', dietitianIsSpeaking);
            mentorWrapper.classList.toggle('inactive', !dietitianIsSpeaking);
        }
        if (charStudent) {
            charStudent.classList.toggle('speaking', dietitianIsSpeaking);
            charStudent.classList.toggle('inactive', !dietitianIsSpeaking);
        }

        const handleAdvance = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (document.body.classList.contains('sports-quiz-step')) return;
            if (sportsDialogueStep < 4) {
                renderSportsDialogueStep(sportsDialogueStep + 1);
            } else {
                playSportsIntroVideo();
            }
        };

        window.advanceSportsDialogue = handleAdvance;

        if (dialogBox) {
            dialogBox.style.cursor = 'pointer';
            dialogBox.onclick = handleAdvance;
        }
        if (dialogContent) {
            dialogContent.style.cursor = 'pointer';
            dialogContent.onclick = handleAdvance;
        }
        if (dialogIndicator) {
            dialogIndicator.style.cursor = 'pointer';
            dialogIndicator.onclick = handleAdvance;
        }
        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.style.cursor = 'pointer';
            bottomPanel.onclick = handleAdvance;
        }
        const mainStage = document.getElementById('rpgMainStage');
        if (mainStage) {
            mainStage.onclick = (e) => {
                if (activeContinentStageKey === 'sports') {
                    // 若正在 4 宮格答題舞台或點擊答題卡片/按鈕/彈窗，絕對不觸發對話或重播影片
                    if (document.body.classList.contains('sports-quiz-step') ||
                        e.target.closest('#sportsQuizArea, .sports-option-hotspot, button, #sportsIntroVideoOverlay, .continent-stage-hotspot, .p-order')) {
                        return;
                    }
                    handleAdvance(e);
                }
            };
        }
    }

    function hideHealthContinentMapForStage() {
        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) {
            continentMapEl.classList.add('hidden');
            continentMapEl.style.setProperty('display', 'none', 'important');
            continentMapEl.style.setProperty('pointer-events', 'none', 'important');
        }

        const worldEl = document.getElementById('healthContinentWorld');
        if (worldEl) {
            worldEl.classList.remove('zoomed');
            worldEl.style.transformOrigin = 'center center';
            worldEl.style.transform = 'translate(0, 0) scale(1)';
        }

        const focusRing = document.getElementById('continentFocusRing');
        if (focusRing) focusRing.classList.add('hidden');
    }

    function startSportsStage() {
        activeContinentStageKey = 'sports';
        isMedicalCityActive = false;
        configureBgmForStage(activeUnit, currentStage || 1);
        document.body.classList.remove('health-continent-active', 'trial-step-0', 'trial-dialog-step', 'continent-guide-dismissed', 'medical-city-active');
        document.body.classList.add('sports-stage-active');

        const fyuTitle = document.querySelector('.fyu-title') || document.getElementById('fyuHeaderTitle');
        const fyuSub = document.querySelector('.fyu-sub') || document.getElementById('fyuHeaderSub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = '營養勇者傳：活力運動場';
        if (fyuSub) fyuSub.textContent = '運動營養專科 ‧ 增肌減脂與體能極限試煉';
        if (fyuIcon) fyuIcon.textContent = '⚔️';

        hideHealthContinentMapForStage();

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop sports-gym-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_sports_gym.jpg?sports-stage-fix-v4')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }

        const charStage = document.getElementById('characterStage');
        if (charStage) {
            charStage.classList.remove('hidden');
            charStage.style.removeProperty('display');
            charStage.style.removeProperty('visibility');
        }

        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        if (choicesAreaEl) choicesAreaEl.classList.add('hidden');

        const optionsGridEl = document.getElementById('optionsGrid');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');

        const quizArea = document.getElementById('sportsQuizArea');
        if (quizArea) {
            quizArea.classList.add('hidden');
            quizArea.style.setProperty('display', 'none', 'important');
        }

        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.remove('hidden');

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0284c7;color:#fff;font-weight:900;">運動營養門診</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>活力運動場</strong> ‧ 運動營養師覺醒試煉</span>
                    <span class="p-metrics">諮詢對象：<strong>阿哲（18歲 ‧ 重訓健身者）</strong> ｜ 考核重點：<strong>阻力訓練、熱量與蛋白質需求</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#facc15;background:rgba(250,204,21,0.15);border:1px solid rgba(250,204,21,0.4);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        // 初始化渲染第 0 步對話
        renderSportsDialogueStep(0);
    }

    function finishSportsIntroVideo(proceedToStage) {
        const overlay = document.getElementById('sportsIntroVideoOverlay');
        const video = document.getElementById('sportsIntroVideo');
        const status = document.getElementById('sportsIntroVideoStatus');
        const retryButton = document.getElementById('sportsIntroVideoRetry');
        if (video) {
            try { video.pause(); } catch(e) {}
            video.onended = null;
            video.onerror = null;
        }
        if (overlay) overlay.classList.add('hidden');
        if (status) status.textContent = '';
        if (retryButton) retryButton.classList.add('hidden');

        if (sportsIntroVideoBgmWasPlaying && soundEnabled) playBgm();
        sportsIntroVideoBgmWasPlaying = false;

        // 依指示：當影片播放完畢後（或點擊關閉/跳過），進入 ABCD 四列滿版作答舞台！
        startSportsQuizStage();
    }

    // 活力運動廣場 ‧ ABCD 四列滿版全圖作答舞台 (完全對齊單元三暴食症題目模式)
    window.selectedSportsOption = null;

    function startSportsQuizStage() {
        activeContinentStageKey = 'sports';
        isMedicalCityActive = false;
        document.body.classList.remove('health-continent-active', 'trial-step-0', 'trial-dialog-step', 'continent-guide-dismissed', 'medical-city-active');
        document.body.classList.add('sports-stage-active', 'sports-quiz-step');

        const fyuTitle = document.querySelector('.fyu-title') || document.getElementById('fyuHeaderTitle');
        const fyuSub = document.querySelector('.fyu-sub') || document.getElementById('fyuHeaderSub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = '營養勇者傳：活力運動場';
        if (fyuSub) fyuSub.textContent = '運動營養專科 ‧ 增肌減脂與體能極限試煉';
        if (fyuIcon) fyuIcon.textContent = '⚔️';

        hideHealthContinentMapForStage();

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop sports-gym-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_sports_gym.jpg?sports-stage-fix-v4')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        // 隱藏立繪人物
        const charStage = document.getElementById('characterStage');
        if (charStage) {
            charStage.classList.add('hidden');
            charStage.style.setProperty('display', 'none', 'important');
        }

        // 顯示頂部快捷個案橫幅
        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0284c7;color:#fff;font-weight:900;">運動營養門診</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>活力運動場</strong> ‧ 運動營養師覺醒試煉</span>
                    <span class="p-metrics">諮詢對象：<strong>阿哲（18歲 ‧ 重訓健身者）</strong> ｜ 考核重點：<strong>阻力訓練、熱量與蛋白質需求</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#facc15;background:rgba(250,204,21,0.15);border:1px solid rgba(250,204,21,0.4);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        // 顯示 ABCD 四列直條全圖背景覆蓋舞台
        const quizArea = document.getElementById('sportsQuizArea');
        if (quizArea) {
            quizArea.classList.remove('hidden');
            quizArea.style.removeProperty('display');
            quizArea.style.setProperty('display', 'flex', 'important');
        }

        // 保持下方經典對話框 `#rpgBottomPanel` 呈現題目說明 (完全對齊暴食症作答介面)
        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
            bottomPanel.onclick = null; // 作答階段不觸發前進對話
            bottomPanel.style.cursor = 'default';
        }
        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.onclick = null;
            dialogBox.style.cursor = 'default';
        }
        const speakerBadge = document.getElementById('speakerBadge');
        if (speakerBadge) {
            speakerBadge.textContent = '【題目說明】';
        }
        const dialogContent = document.getElementById('dialogContent');
        if (dialogContent) {
            dialogContent.onclick = null;
            dialogContent.style.cursor = 'default';
            dialogContent.innerHTML = `
                <span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">阿哲想有效增肌，下列何者才是最正確的飲食策略？</span>
                <div style="color:#94a3b8;font-size:13px;margin-top:6px;">🎬 請點選上方 ABCD 選項進行回答。</div>
            `;
        }
        const dialogIndicator = document.getElementById('dialogIndicator');
        if (dialogIndicator) {
            dialogIndicator.onclick = null;
            dialogIndicator.style.cursor = 'default';
            dialogIndicator.innerHTML = '💡 點選上方 ABCD 卡片選擇最佳增肌策略';
        }

        // 重設選項狀態
        window.selectedSportsOption = null;
        document.querySelectorAll('.sports-option-hotspot').forEach(hotspot => {
            hotspot.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
        });
    }
    window.startSportsQuizStage = startSportsQuizStage;

    window.selectSportsOption = function(optKey, event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        window.selectedSportsOption = optKey;
        sfxClick();

        const hotspots = document.querySelectorAll('.sports-option-hotspot');
        hotspots.forEach(btn => {
            const k = btn.getAttribute('data-opt');
            btn.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
            if (k === optKey) {
                btn.classList.add('selected');
            }
        });

        // 答案驗證：正確答案為 C
        const isCorrect = (optKey === 'C');
        const dialogIndicator = document.getElementById('dialogIndicator');

        if (isCorrect) {
            sfxCorrect();
            window.isCompletedSportsStage = true;
            window.lastCompletedStageName = '活力運動場';
            markContinentStageCompleted('sports');

            // 正確答案亮綠光
            hotspots.forEach(btn => {
                const k = btn.getAttribute('data-opt');
                if (k === 'C') {
                    btn.classList.add('is-correct-answer');
                }
            });

            if (dialogIndicator) {
                dialogIndicator.innerHTML = '🎉 <span style="color:#4ade80;font-weight:bold;">答對了！</span>配合阻力訓練，攝取足夠總熱量與蛋白質，並充分休息！ <span style="color:#fde047;cursor:pointer;text-decoration:underline;margin-left:8px;" onclick="window.triggerVictory();">🏆 領取成就書 ➔</span>';
            }

            if (window.showToast) {
                window.showToast('🎉 答對了！配合阻力訓練，攝取足夠總熱量與蛋白質，並充分休息！', 'success');
            }

            // 延遲1.2秒後彈出成就書與證書
            setTimeout(() => {
                const victoryModal = document.getElementById('rpgVictoryModal');
                if (victoryModal) {
                    const vHeader = victoryModal.querySelector('.victory-header h2');
                    if (vHeader) vHeader.textContent = '🏆 獲得【活力運動場】成就書';
                    const vSub = victoryModal.querySelector('.victory-header .victory-sub');
                    if (vSub) vSub.textContent = '🎉 恭喜完成阿哲運動增肌營養試煉，解開阻力訓練與總熱量之謎！';
                    const certTitleEl = victoryModal.querySelector('.cert-box-title');
                    if (certTitleEl) certTitleEl.textContent = '🎓 獲得「活力運動場」榮譽成就證書';
                    const btnDownload = victoryModal.querySelector('#btnDownloadCert');
                    if (btnDownload) btnDownload.textContent = '📷 下載「活力運動場」成就書圖檔 (PNG)';
                    const btnClose = victoryModal.querySelector('#btnCloseLeaderboard');
                    if (btnClose) {
                        btnClose.textContent = '🗺️ 領取成就，返回健康大陸 ➔';
                        btnClose.style.background = 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)';
                        btnClose.style.color = '#1e1b4b';
                        btnClose.style.fontWeight = 'bold';
                        btnClose.style.fontSize = '16px';
                        btnClose.style.padding = '12px 24px';
                        btnClose.style.boxShadow = '0 4px 15px rgba(234, 179, 8, 0.4)';
                    }
                }
                triggerVictory();
            }, 1200);

        } else {
            sfxWrong();
            // 答錯亮紅光，並提示
            hotspots.forEach(btn => {
                const k = btn.getAttribute('data-opt');
                if (k === optKey) {
                    btn.classList.add('is-wrong-answer');
                }
            });

            if (dialogIndicator) {
                dialogIndicator.innerHTML = `❌ <span style="color:#f87171;font-weight:bold;">選項 ${optKey} 不是最佳策略！</span>請重新思考並點選其他策略！`;
            }

            if (window.showToast) {
                window.showToast(`❌ 選項 ${optKey} 不是最佳策略！增肌需要阻力訓練搭配足夠總熱量與蛋白質，請再試試！`, 'warn');
            }
        }
    };

    function playSportsIntroVideo() {
        if (document.body.classList.contains('sports-quiz-step')) {
            return;
        }
        const overlay = document.getElementById('sportsIntroVideoOverlay');
        const video = document.getElementById('sportsIntroVideo');
        const status = document.getElementById('sportsIntroVideoStatus');
        const retryButton = document.getElementById('sportsIntroVideoRetry');
        if (!overlay || !video || !status || !retryButton) {
            startSportsQuizStage();
            return;
        }

        sportsIntroVideoBgmWasPlaying = !!(bgmPlaying && rpgBgmAudio && !rpgBgmAudio.paused);
        if (sportsIntroVideoBgmWasPlaying) pauseBgm();
        overlay.classList.remove('hidden');
        status.textContent = '';
        retryButton.classList.add('hidden');
        video.onended = () => finishSportsIntroVideo(true);
        video.onerror = () => {
            status.textContent = '影片載入失敗，請重試或返回健康大陸。';
            retryButton.classList.remove('hidden');
        };

        const startPlayback = () => {
            video.currentTime = 0;
            const playback = video.play();
            if (playback && typeof playback.catch === 'function') {
                playback.then(() => {
                    status.textContent = '';
                    retryButton.classList.add('hidden');
                }).catch(() => {
                    status.textContent = '若影片未自動播放，請點擊下方按鈕開始。';
                    retryButton.classList.remove('hidden');
                });
            }
        };
        retryButton.onclick = startPlayback;
        startPlayback();
    }

    // 健康大陸的四個職業場景先以專屬 RPG 場景大廳呈現；
    // 這讓地圖上的地名和實際進入後的畫面保持一致，也保留日後接入各自題目的空間。
    function startContinentSceneryStage(stageKey) {
        const region = CONTINENT_REGIONS[stageKey];
        if (!region || !region.background) return false;

        activeContinentStageKey = stageKey;
        activeContinentRegionKey = null;
        isMedicalCityActive = false;
        document.body.classList.remove(
            'health-continent-active', 'trial-step-0', 'trial-dialog-step',
            'continent-guide-dismissed', 'medical-city-active', 'sports-stage-active'
        );
        document.body.classList.add('continent-scenery-stage-active');

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) continentMapEl.classList.add('hidden');

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop continent-scenery-theme';
            backdropEl.style.setProperty('background-image', `url('${region.background}')`, 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.remove('hidden');

        // 圖片本身已包含場景人物與教學情境，避免原本的角色立繪遮住關鍵畫面。
        ['charNurse', 'charStudent'].forEach(id => {
            const character = document.getElementById(id);
            if (character) character.classList.add('hidden');
        });
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
        const optionsGridEl = document.getElementById('optionsGrid');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');

        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        if (speakerBadge) speakerBadge.textContent = `【${region.title} ‧ 冒險場景】`;
        if (dialogContent) {
            dialogContent.innerHTML = `
                <div class="continent-dialog-info">
                    <div class="continent-dialog-sub">${region.sub}</div>
                    <div class="continent-dialog-desc">${region.desc}</div>
                </div>
            `;
        }
        if (dialogIndicator) dialogIndicator.textContent = '🗺️ 請使用上方資訊列返回健康大陸';

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0f766e;color:#fff;font-weight:900;">${region.title}</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>${region.title}</strong> ‧ ${region.sub.replace(/^\S+\s*/, '')}</span>
                    <span class="p-metrics">目前已進入專屬 RPG 場景</span>
                    <span class="p-order" style="cursor:pointer;color:#bbf7d0;background:rgba(20,184,166,0.15);border:1px solid rgba(45,212,191,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        const fyuTitle = document.querySelector('.fyu-title');
        const fyuSub = document.querySelector('.fyu-sub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = `營養勇者傳：${region.title}`;
        if (fyuSub) fyuSub.textContent = region.sub.replace(/^\S+\s*/, '');
        if (fyuIcon) fyuIcon.textContent = '⚔️';
        return true;
    }

    // =========================================================
    // 蔬食之森 ‧ 劇情對話舞台與試煉題目
    // =========================================================
    let forestDialogueStep = 0;
    let forestStage1SelectedKey = null;
    let forestStage1AnswerRevealed = false;
    let forestStage2SelectedKey = null;
    let forestStage2AnswerRevealed = false;
    let lastForestAdvanceTime = 0;

    const FOREST_STAGE1_DATA = {
        title: '如果你是營養師，想讓學生了解<span style="color: #fef08a;">均衡飲食</span>，以下哪一種教學方式最適合？',
        correctKey: 'B',
        options: [
            { key: 'A', score: '選項 A', label: '選項 A', image: 'assets/forest_stage1_opt_a.jpg?v=20261023-forest-opt-a', desc: '投影片單向講授：抄寫課本與投影片筆記', hint: '⚠️ 單向播放投影片與講述缺乏互動與動手體驗，學生容易打瞌睡且難以落實於生活！' },
            { key: 'B', score: '選項 B', label: '選項 B', image: 'assets/forest_stage1_opt_b.jpg?v=20261023-forest-opt-b', desc: '我的餐盤實作互動：利用食物模型動手搭配均衡餐盤', hint: '🎉 完全正確！運用食物模型動手實作「我的餐盤」，具備高度雙向互動與實作感，能真正將六大類食物落實於生活！' }
        ]
    };

    const FOREST_STAGE2_DATA = {
        title: '想讓學生真正認識食物來源，以下哪一種活動最符合食農教育的精神？',
        correctKey: 'A',
        options: [
            { key: 'A', score: '選項 A', label: '選項 A', image: 'assets/forest_stage2_opt_a.jpg?v=20261023-opt-a', desc: '親自種植蔬菜，觀察生長過程並認識農田', hint: '🎉 太棒了！親自種植蔬菜、觀察農作生長並認識農田，體會農夫辛勞與產地連結，正是食農教育最核心的實踐精神！' },
            { key: 'B', score: '選項 B', label: '選項 B', image: 'assets/forest_stage2_opt_b.jpg?v=20261023-opt-b', desc: '教導蔬菜的營養成分及零售價格', hint: '⚠️ 單純講授營養成分與超市價格仍偏向課本記憶，並未真正連結產地與親身農事體驗。' }
        ]
    };

    function renderForestDialogueStep(step) {
        forestDialogueStep = step;
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const charStudentImg = document.getElementById('charStudentImg');
        const charStudentName = document.getElementById('charStudentName');

        const charStage = document.getElementById('characterStage');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const dialogBox = document.getElementById('dialogBox');

        if (charStage) {
            charStage.classList.remove('hidden');
            charStage.style.removeProperty('display');
            charStage.style.removeProperty('visibility');
        }
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.style.removeProperty('display');
        }

        const isFem = (selectedGender === 'female' || localStorage.getItem('FYU_STUDENT_GENDER') === 'female');
        const internHeroImg = isFem ? 'assets/hero_player_female_hd.png' : 'assets/hero_player_male_intern.png?v=20261021-intern-m';

        const forestQuizArea = document.getElementById('forestQuizArea');
        const forestStage2QuizArea = document.getElementById('forestStage2QuizArea');
        if (step !== 3) {
            if (forestQuizArea) {
                forestQuizArea.classList.add('hidden');
                forestQuizArea.style.setProperty('display', 'none', 'important');
            }
        }
        if (step !== 6) {
            if (forestStage2QuizArea) {
                forestStage2QuizArea.classList.add('hidden');
                forestStage2QuizArea.style.setProperty('display', 'none', 'important');
            }
        }
        if (step !== 3 && step !== 6) {
            document.body.classList.remove('forest-quiz-step');
        }

        // 動態切換 RPG 背景圖片：第一關 (step 0~3) 為打瞌睡教室；第二關開始 (step 4~6) 為食農教育菜園
        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            if (step >= 4) {
                backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_forest_garden.jpg?stage-bg-sync-v1')", 'important');
            } else {
                backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_forest_classroom.jpg?stage-bg-sync-v1')", 'important');
            }
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
        }

        if (step === 0) {
            // 第 1 關 對話 1：專業營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「你受邀到高中職進行營養教育，但學生一聽到『<span style="color: #fef08a;">六大類食物、營養素、每日建議攝取量</span>』就開始分心。你必須設計一個讓大家願意參與的活動。」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊對話繼續 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const nutritionistImg = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const nutritionistTag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (nutritionistImg) {
                    nutritionistImg.src = 'assets/mentor_guide.png';
                    nutritionistImg.alt = '輔英科大保健營養系 伊麗克絲 營養師';
                    nutritionistImg.style.removeProperty('display');
                }
                if (nutritionistTag) nutritionistTag.textContent = '輔英科大保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 1) {
            // 第 1 關 對話 2：營養師實習生 (圖一指示更正立繪與稱號)
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「實習營養師，<span style="color: #fef08a;">知識再專業，如果大家聽不懂、記不住，就很難真正改變行為！</span>」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊對話繼續 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('speaking');
                mentorWrapper.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                if (charStudentImg) {
                    charStudentImg.src = internHeroImg;
                    charStudentImg.alt = getNutritionInternDisplayName();
                    charStudentImg.style.removeProperty('display');
                }
                if (charStudentName) charStudentName.textContent = getNutritionInternDisplayName();
            }
        } else if (step === 2) {
            // 第 1 關 對話 3：學生
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = '學生';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「老師，營養學名詞好多喔！<span style="color: #fef08a;">可以不要只叫我們背課本，讓我們自己動手試試看嗎？</span>」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊進入活動設計作答 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('speaking');
                mentorWrapper.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                if (charStudentImg) {
                    charStudentImg.src = 'assets/forest_student_transparent.png?v=20261019-forest-student-cutout';
                    charStudentImg.alt = '學生';
                    charStudentImg.style.removeProperty('display');
                }
                if (charStudentName) charStudentName.textContent = '學生';
            }
        } else if (step === 3) {
            // 第 1 關 題目 1：如果你是營養師，想讓學生了解均衡飲食，以下哪一種教學方式最適合？
            renderForestStage1Quiz();
        } else if (step === 4) {
            // 第二關｜食物從哪裡來？ 對話 1：專業營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            const patientBanner = document.getElementById('patientBanner');
            if (patientBanner) {
                patientBanner.classList.remove('hidden');
                patientBanner.style.removeProperty('display');
                patientBanner.innerHTML = `
                    <div class="banner-badge" style="background:#16a34a;color:#fff;font-weight:900;">🥗 第二關｜食物從哪裡來？</div>
                    <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                        <span class="p-name"><strong>蔬食之森</strong> ‧ 第二關：食物從哪裡來？</span>
                        <span class="p-metrics">任務：<strong>認識食農教育精神與食物產地</strong></span>
                        <span class="p-order" style="cursor:pointer;color:#bbf7d0;background:rgba(22,163,74,0.15);border:1px solid rgba(74,222,128,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                    </div>
                `;
            }

            if (speakerBadge) speakerBadge.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「實習營養師，當我們吃下一口青菜時，你有想過<span style="color: #fef08a;">它是怎麼來到餐桌上的嗎？</span>」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊對話繼續 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const nutritionistImg = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const nutritionistTag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (nutritionistImg) {
                    nutritionistImg.src = 'assets/mentor_guide.png';
                    nutritionistImg.alt = '輔英科技大學保健營養系 伊麗克絲 營養師';
                    nutritionistImg.style.removeProperty('display');
                }
                if (nutritionistTag) nutritionistTag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 5) {
            // 第二關｜食物從哪裡來？ 對話 2：實習營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「超市買來的啊！<span style="color: #fef08a;">難道還有其他祕密？</span>」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊進入食農教育題目 2 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('speaking');
                mentorWrapper.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                if (charStudentImg) {
                    charStudentImg.src = internHeroImg;
                    charStudentImg.alt = getNutritionInternDisplayName();
                    charStudentImg.style.removeProperty('display');
                }
                if (charStudentName) charStudentName.textContent = getNutritionInternDisplayName();
            }
        } else if (step === 6) {
            // 第二關 題目 2：想讓學生真正認識食物來源，以下哪一種活動最符合食農教育的精神？
            renderForestStage2Quiz();
        }

        const handleForestAdvance = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (Date.now() - lastForestAdvanceTime < 350) return;
            lastForestAdvanceTime = Date.now();
            if (forestDialogueStep === 0 || forestDialogueStep === 1) {
                renderForestDialogueStep(forestDialogueStep + 1);
            } else if (forestDialogueStep === 2) {
                renderForestDialogueStep(3);
            } else if (forestDialogueStep === 4) {
                renderForestDialogueStep(5);
            } else if (forestDialogueStep === 5) {
                renderForestDialogueStep(6);
            }
        };

        window.advanceForestDialogue = handleForestAdvance;

        if (dialogBox) {
            dialogBox.style.cursor = (forestDialogueStep === 3 || forestDialogueStep === 6) ? 'default' : 'pointer';
            dialogBox.onclick = (forestDialogueStep === 3 || forestDialogueStep === 6) ? null : handleForestAdvance;
        }
        if (dialogContent) {
            dialogContent.style.cursor = (forestDialogueStep === 3 || forestDialogueStep === 6) ? 'default' : 'pointer';
            dialogContent.onclick = (forestDialogueStep === 3 || forestDialogueStep === 6) ? null : handleForestAdvance;
        }
        if (dialogIndicator) {
            dialogIndicator.style.cursor = (forestDialogueStep === 3 || forestDialogueStep === 6) ? 'default' : 'pointer';
            dialogIndicator.onclick = (forestDialogueStep === 3 || forestDialogueStep === 6) ? null : handleForestAdvance;
        }
        if (bottomPanel) {
            bottomPanel.style.cursor = 'default';
            bottomPanel.onclick = (e) => {
                if (e.target.closest('#optionsGrid, .rpg-choice-btn, button')) return;
                if (forestDialogueStep !== 3 && forestDialogueStep !== 6) {
                    handleForestAdvance(e);
                }
            };
        }
        const mainStage = document.getElementById('rpgMainStage');
        if (mainStage) {
            mainStage.onclick = (e) => {
                if (activeContinentStageKey === 'forest') {
                    if (e.target.closest('#optionsGrid, .rpg-choice-btn, button, .continent-stage-hotspot, .p-order, #forestQuizArea, #forestStage2QuizArea')) {
                        return;
                    }
                    if (forestDialogueStep !== 3 && forestDialogueStep !== 6) {
                        handleForestAdvance(e);
                    }
                }
            };
        }
    }

    function renderForestStage1Quiz() {
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const forestQuizArea = document.getElementById('forestQuizArea');

        // 隱藏立繪人物
        if (mentorWrapper) {
            mentorWrapper.classList.add('hidden');
            mentorWrapper.classList.remove('speaking');
        }
        if (charStudent) {
            charStudent.classList.add('hidden');
            charStudent.classList.remove('speaking');
        }

        // 下方不顯示四個文字選項或圖片卡片（徹底隱藏 optionsGrid 與 rpgChoicesArea）
        if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
        if (optionsGridEl) {
            optionsGridEl.classList.add('hidden');
            optionsGridEl.innerHTML = '';
        }

        // 在 RPG 背景前面顯示直向 9:16 選項A/選項B 覆蓋舞台
        document.body.classList.add('forest-stage-active', 'forest-quiz-step');
        if (forestQuizArea) {
            forestQuizArea.classList.remove('hidden');
            forestQuizArea.style.removeProperty('display');
            forestQuizArea.style.setProperty('display', 'flex', 'important');
        }

        // 下方對話框維持題目說明
        if (speakerBadge) speakerBadge.textContent = '【第一關 ‧ 活動設計】';
        if (dialogContent) {
            dialogContent.innerHTML = `
                <span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">${FOREST_STAGE1_DATA.title}</span>
            `;
        }
        if (dialogIndicator) {
            if (!forestStage1AnswerRevealed) {
                dialogIndicator.innerHTML = '💡 請點選上方 RPG 背景前之【選項 A】或【選項 B】卡片進行作答';
            }
        }

        // 更新 9:16 卡片上的狀態 class
        document.querySelectorAll('.forest-overlay-card').forEach(card => {
            const k = card.getAttribute('data-opt');
            card.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
            if (forestStage1SelectedKey === k) {
                card.classList.add('selected');
            }
            if (forestStage1AnswerRevealed) {
                if (k === FOREST_STAGE1_DATA.correctKey) {
                    card.classList.add('is-correct-answer');
                } else if (forestStage1SelectedKey === k) {
                    card.classList.add('is-wrong-answer');
                }
            }
        });
    }

    function selectForestStage1Option(key, event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        forestStage1SelectedKey = key;
        forestStage1AnswerRevealed = true;
        sfxClick();

        const opt = FOREST_STAGE1_DATA.options.find(o => o.key === key);
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');

        renderForestStage1Quiz();

        if (key === FOREST_STAGE1_DATA.correctKey) {
            sfxCorrect();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="display:block;max-width:100%;color:#4ade80;font-weight:bold;font-size:0.86em;line-height:1.35;white-space:normal;overflow-wrap:anywhere;word-break:break-word;letter-spacing:-0.25px;margin-bottom:6px;">🎯 第一關挑戰成功！學生們迫不及待開始動手搭配均衡餐盤！</div>
                    <div style="color:#ffffff;line-height:1.5;">${opt.hint}</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '<button type="button" style="display:block;width:fit-content;max-width:100%;margin:18px auto 0;background:#16a34a;color:#ffffff;border:1px solid #4ade80;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;line-height:1.35;white-space:normal;overflow-wrap:anywhere;word-break:break-word;box-sizing:border-box;box-shadow:0 2px 8px rgba(0,0,0,0.3);letter-spacing:0.5px;" onclick="event.stopPropagation(); window.startForestStage2(event);">🌱 前往 第二關｜食物從哪裡來？ ➔</button>';
            }
        } else {
            sfxWrong();
            playForestStage1FailureVideo();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#f87171;font-weight:bold;font-size:1.1em;margin-bottom:6px;">⚠️ 學生在台下打起瞌睡：「老師，這個方式好無聊喔...」</div>
                    <div style="color:#fef08a;line-height:1.5;">${opt.hint}</div>
                    <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">💡 提示：請重新點選其他選項，設計具備互動體驗的教學方式！</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '💡 請重新選擇最具互動效果的教學方案 ➔';
            }
        }

        function playForestStage1FailureVideo() {
            const overlay = document.getElementById('forestStage1FailVideoOverlay');
            const video = document.getElementById('forestStage1FailVideo');
            const status = document.getElementById('forestStage1FailStatus');
            const failPanel = document.getElementById('forestStage1FailPanel');
            const restartButton = document.getElementById('forestStage1RestartButton');
            if (!overlay || !video || !failPanel || !restartButton) {
                console.error('蔬食之森第一關失敗影片介面未完整載入');
                return;
            }

            if (rpgBgmAudio && bgmPlaying) pauseBgm();
            overlay.classList.remove('hidden');
            overlay.style.setProperty('display', 'flex', 'important');
            failPanel.classList.add('hidden');
            video.classList.remove('hidden');
            video.style.removeProperty('display');
            video.controls = true;
            video.muted = false;
            video.currentTime = 0;
            video.src = 'assets/forest_stage1_fail.mp4?v=20261023-forest-stage1-fail';
            if (status) status.textContent = '影片播放完畢後顯示挑戰結果。';

            const showFailure = () => {
                video.pause();
                video.onended = null;
                video.onerror = null;
                video.classList.add('hidden');
                failPanel.classList.remove('hidden');
                if (status) status.textContent = '';
            };
            video.onended = showFailure;
            video.onerror = () => {
                if (status) status.textContent = '影片無法播放，請重新通關。';
                showFailure();
            };
            restartButton.onclick = () => {
                video.pause();
                video.onended = null;
                video.onerror = null;
                overlay.classList.add('hidden');
                overlay.style.removeProperty('display');
                failPanel.classList.add('hidden');
                video.classList.remove('hidden');
                video.removeAttribute('src');
                video.load();
                startForestStage();
            };
            video.load();
            const playback = video.play();
            if (playback && typeof playback.catch === 'function') {
                playback.catch(() => {
                    if (status) status.textContent = '若影片未自動播放，請使用影片控制列播放。';
                });
            }
        }
        window.playForestStage1FailureVideo = playForestStage1FailureVideo;
    }

    function startForestStage2(e) {
        if (e) {
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
        }
        lastForestAdvanceTime = Date.now();
        forestDialogueStep = 4;
        forestStage2SelectedKey = null;
        forestStage2AnswerRevealed = false;
        renderForestDialogueStep(4);
    }
    window.startForestStage2 = startForestStage2;

    function renderForestStage2Quiz() {
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const forestQuizArea = document.getElementById('forestQuizArea');
        const forestStage2QuizArea = document.getElementById('forestStage2QuizArea');

        // 隱藏立繪人物
        if (mentorWrapper) {
            mentorWrapper.classList.add('hidden');
            mentorWrapper.classList.remove('speaking');
        }
        if (charStudent) {
            charStudent.classList.add('hidden');
            charStudent.classList.remove('speaking');
        }

        // 下方不顯示四個文字選項（徹底隱藏 optionsGrid 與 rpgChoicesArea）
        if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
        if (optionsGridEl) {
            optionsGridEl.classList.add('hidden');
            optionsGridEl.innerHTML = '';
        }
        if (forestQuizArea) {
            forestQuizArea.classList.add('hidden');
            forestQuizArea.style.setProperty('display', 'none', 'important');
        }

        // 在 RPG 背景前面顯示第二關直向 9:16 選項A/選項B 覆蓋舞台
        document.body.classList.add('forest-stage-active', 'forest-quiz-step');
        if (forestStage2QuizArea) {
            forestStage2QuizArea.classList.remove('hidden');
            forestStage2QuizArea.style.removeProperty('display');
            forestStage2QuizArea.style.setProperty('display', 'flex', 'important');
        }

        // 下方對話框維持題目說明
        if (speakerBadge) speakerBadge.textContent = '【第二關 ‧ 食物從哪裡來？】';
        if (dialogContent) {
            dialogContent.innerHTML = `
                <span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">題目 2： ${FOREST_STAGE2_DATA.title}</span>
            `;
        }
        if (dialogIndicator) {
            if (!forestStage2AnswerRevealed) {
                dialogIndicator.innerHTML = '💡 請點選上方 RPG 背景前之【選項 A】或【選項 B】卡片進行作答';
            }
        }

        // 更新 9:16 卡片上的狀態 class
        if (forestStage2QuizArea) {
            forestStage2QuizArea.querySelectorAll('.forest-overlay-card').forEach(card => {
                const k = card.getAttribute('data-opt');
                card.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
                if (forestStage2SelectedKey === k) {
                    card.classList.add('selected');
                }
                if (forestStage2AnswerRevealed) {
                    if (k === FOREST_STAGE2_DATA.correctKey) {
                        card.classList.add('is-correct-answer');
                    } else if (forestStage2SelectedKey === k) {
                        card.classList.add('is-wrong-answer');
                    }
                }
            });
        }
    }

    function selectForestStage2Option(key, event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        forestStage2SelectedKey = key;
        forestStage2AnswerRevealed = true;
        sfxClick();

        const opt = FOREST_STAGE2_DATA.options.find(o => o.key === key);
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');

        renderForestStage2Quiz();

        if (key === FOREST_STAGE2_DATA.correctKey) {
            sfxCorrect();
            window.isCompletedForestStage = true;
            window.lastCompletedStageName = '蔬食之森';
            markContinentStageCompleted('forest');

            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#4ade80;font-weight:bold;font-size:1.1em;margin-bottom:6px;">🏆 蔬食之森雙關卡圓滿通關！榮獲蔬食之森專屬成就榮譽！</div>
                    <div style="color:#ffffff;line-height:1.5;">${opt.hint}</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '🎉 完美通關 ‧ <button type="button" style="background:#059669;color:#ffffff;border:1px solid #34d399;padding:5px 14px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);margin-right:8px;" onclick="event.stopPropagation(); window.triggerVictory();">🏆 領取成就書</button> 或 <button type="button" style="background:#0284c7;color:#ffffff;border:1px solid #38bdf8;padding:5px 14px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.returnToHealthContinent();">🗺️ 返回健康大陸 ➔</button>';
            }

            if (window.showToast) {
                window.showToast('🎉 恭喜通過蔬食之森兩大試煉！榮獲【蔬食之森】成就證書！', 'success');
            }

            setTimeout(() => {
                triggerVictory();
            }, 1500);
        } else {
            sfxWrong();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#f87171;font-weight:bold;font-size:1.1em;margin-bottom:6px;">⚠️ 專業營養師溫和提醒：「這項活動尚未觸及食農教育的核心理念喔！」</div>
                    <div style="color:#fef08a;line-height:1.5;">${opt.hint}</div>
                    <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">💡 提示：請重新點選能夠連結產地、觀察生命與親身體驗的【選項 A】！</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '💡 請點選最符合食農教育精神的【選項 A】卡片 ➔';
            }
        }
    }
    window.selectForestStage1Option = selectForestStage1Option;
    window.selectForestStage2Option = selectForestStage2Option;
    window.renderForestStage1Quiz = renderForestStage1Quiz;
    window.renderForestStage2Quiz = renderForestStage2Quiz;

    // =========================================================
    // 社區廣場 ‧ 劇情對話舞台與長者照護試煉 (公共衛生營養 ‧ 全人照護與預防醫學)
    // =========================================================
    let communityDialogueStep = 0;
    let lastCommunityAdvanceTime = 0;

    let communityQ1SelectedKey = null;
    let communityQ1AnswerRevealed = false;
    let communityQ2SelectedKey = null;
    let communityQ2AnswerRevealed = false;
    let communityQ3SelectedKey = null;
    let communityQ3AnswerRevealed = false;

    const COMMUNITY_STAGE_QUESTIONS = [
        {
            stage: 1,
            characterName: '陳福來 阿公',
            characterSpeech: '「唉唷，我的牙齒不好，肉咬不動啦！每天吃稀飯配醬瓜，方便又省事，但最近3 個月體重從 60 公斤下降至 55 公斤」',
            characterImg: 'assets/community_grandpa_fulai.png',
            questionTitle: '阿公最近經常只吃稀飯配醬瓜，而且體重持續下降。下列哪一項是最需要優先關注的問題？',
            correctKey: 'A',
            options: [
                { key: 'A', text: '飲食種類單一，可能有熱量及蛋白質攝取不足的風險', hint: '🎉 完全正確！稀飯配醬瓜熱量極低且缺乏優質蛋白質，容易導致熱量與蛋白質負平衡，造成體重急速減輕與肌力流失！' },
                { key: 'B', text: '長者年紀大了，體重下降是正常現象', hint: '⚠️ 體重快速下降（3個月減輕超過5%）屬於非預期體重減輕，可能代表肌少症或營養不良，絕非正常老化現象！' }
            ]
        },
        {
            stage: 2,
            characterName: '林秀枝 阿嬤',
            characterSpeech: '「我走去市場太累了，早餐買奶茶配麵包，晚餐煮個麵就好啦！可是醫生說我的血壓有點高。」',
            characterImg: 'assets/community_grandma_xiuzhi.png',
            questionTitle: '秀枝阿嬤行動不便，常吃麵包配含糖奶茶，且血壓偏高。哪一項建議最適合她？',
            correctKey: 'A',
            options: [
                { key: 'A', text: '附近便利商店購買茶葉蛋、烤地瓜、無糖豆漿與蔬菜', hint: '🎉 太棒了！便利商店取得方便，茶葉蛋與無糖豆漿提供優質蛋白質，烤地瓜與蔬菜富含鉀與膳食纖維，非常適合行動不便且需控制血壓的阿嬤！' },
                { key: 'B', text: '改喝無糖奶茶與醃製蔬菜，因為蔬菜有助於健康', hint: '⚠️ 醃製蔬菜鈉含量極高，會使血壓急劇上升，對高血壓長者來說具有很高的心血管風險！' }
            ]
        },
        {
            stage: 3,
            characterName: '社區營養師專業指引',
            characterSpeech: '「福來阿公與秀枝阿嬤各自面臨牙口弱化與行動採買困難，社區營養的核心在於全人評估與整合照護。」',
            characterImg: 'assets/mentor_guide.png',
            questionTitle: '福來阿公體重持續下降，秀枝阿嬤則因行動不便而飲食不均衡。身為社區營養師，哪一項策略最能同時回應兩位長者的需求？',
            correctKey: 'B',
            options: [
                { key: 'A', text: '兩位長者都發放相同的均衡飲食宣傳單', hint: '⚠️ 單向發放相同的單張無法解決牙齒咬不動、無法出門採買等個別生活阻礙，成效十分有限。' },
                { key: 'B', text: '依個別營養風險與生活困難提供飲食建議，並連結適當的社區或醫療資源', hint: '🎉 滿分解答！針對個別問題提供質地調整或就近飲食指引，並轉介社區送餐、牙科或關懷據點，正是社區公共衛生營養最核心的整合照護策略！' }
            ]
        }
    ];

    function renderCommunityDialogueStep(step) {
        communityDialogueStep = step;
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const charStudentImg = document.getElementById('charStudentImg');
        const charStudentName = document.getElementById('charStudentName');

        const charStage = document.getElementById('characterStage');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const dialogBox = document.getElementById('dialogBox');

        if (charStage) {
            charStage.classList.remove('hidden');
            charStage.style.removeProperty('display');
            charStage.style.removeProperty('visibility');
        }
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.style.removeProperty('display');
        }

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#0284c7;color:#fff;font-weight:900;">🍎 社區廣場</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>社區廣場</strong> ‧ 公共衛生營養 ‧ 全人照護與預防醫學</span>
                    <span class="p-metrics">對象：<strong>陳福來阿公、林秀枝阿嬤</strong> ｜ 任務：<strong>長者個別化營養策略</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#bbf7d0;background:rgba(2,132,199,0.18);border:1px solid rgba(56,189,248,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        if (step === 0) {
            // 社區廣場開場對話：專業營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科技大學保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「實習營養師，歡迎來到<span style="color: #fef08a;">社區營養推廣中心</span>！最近有好幾位<span style="color: #fef08a;">長輩體重一直下降</span>，今天就要靠你們找出健康危機的真相！」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊繼續對話 ➔';
            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) { img.src = 'assets/mentor_guide.png'; img.alt = '輔英科技大學保健營養系 伊麗克絲 營養師'; }
                if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 1) {
            // 社區廣場開場對話：實習營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">什麼！長輩怎麼會越吃越少？難道是食物不夠好吃嗎？我來調查！</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊繼續對話 ➔';
            if (mentorWrapper) {
                mentorWrapper.classList.add('hidden');
                mentorWrapper.classList.remove('speaking');
            }
            if (charStudent) {
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                const img = document.getElementById('charStudentImg');
                const tag = document.getElementById('charStudentName');
                if (img) {
                    img.src = selectedGender === 'male'
                        ? 'assets/hero_player_male_intern.png?v=20261021-intern-m'
                        : 'assets/hero_player_female_hd.png?v=20261017-intern-clean-v3';
                    img.alt = getNutritionInternDisplayName();
                    img.style.removeProperty('display');
                    img.style.removeProperty('visibility');
                }
                if (tag) tag.textContent = getNutritionInternDisplayName();
            }
        } else if (step === 2) {
            // 社區廣場開場對話：專業營養師補充說明
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科技大學保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「先別急！可能跟牙口不好、食慾下降，或是沒辦法自己買菜有關，我們要先了解長輩真正的困難。」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊查看陳阿公的情況 ➔';
            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) { img.src = 'assets/mentor_guide.png'; img.alt = '輔英科技大學保健營養系 伊麗克絲 營養師'; }
                if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 3) {
            // 第 1 題前導對話：陳福來阿公
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = '陳福來 阿公';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「唉唷，我的牙齒不好，肉咬不動啦！<span style="color: #fef08a;">每天吃稀飯配醬瓜</span>，方便又省事，但最近3 個月體重從 <span style="color: #fef08a;">60 公斤下降至 55 公斤</span>」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊進入阿公營養評估題目 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) {
                    img.src = 'assets/community_grandpa_fulai.png';
                    img.alt = '陳福來 阿公';
                    img.style.removeProperty('display');
                }
                if (tag) tag.textContent = '陳福來 阿公';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 4) {
            // 第 1 題作答
            renderCommunityQuiz(1);
        } else if (step === 5) {
            // 第 2 題前導對話：林秀枝阿嬤
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = '林秀枝 阿嬤';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「我走去市場太累了，<span style="color: #fef08a;">早餐買奶茶配麵包</span>，晚餐煮個麵就好啦！可是醫生說我的<span style="color: #fef08a;">血壓有點高</span>。」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊進入阿嬤飲食建議題目 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) {
                    img.src = 'assets/community_grandma_xiuzhi.png';
                    img.alt = '林秀枝 阿嬤';
                    img.style.removeProperty('display');
                }
                if (tag) tag.textContent = '林秀枝 阿嬤';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 6) {
            // 第 2 題作答
            renderCommunityQuiz(2);
        } else if (step === 7) {
            // 第 3 題前導對話：專業營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科技大學保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「長者們常面臨不同的生活與生理限制。身為社區營養師，我們該如何<span style="color: #fef08a;">同時回應兩位長者的多元需求</span>？」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊進入社區整合照護策略題目 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) {
                    img.src = 'assets/mentor_guide.png';
                    img.alt = '輔英科技大學保健營養系 伊麗克絲 營養師';
                    img.style.removeProperty('display');
                }
                if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 8) {
            // 第 3 題作答
            renderCommunityQuiz(3);
        }

        const handleCommunityAdvance = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (Date.now() - lastCommunityAdvanceTime < 350) return;
            lastCommunityAdvanceTime = Date.now();
            if (communityDialogueStep === 0) {
                renderCommunityDialogueStep(1);
            } else if (communityDialogueStep === 1) {
                renderCommunityDialogueStep(2);
            } else if (communityDialogueStep === 2) {
                renderCommunityDialogueStep(3);
            } else if (communityDialogueStep === 3) {
                renderCommunityDialogueStep(4);
            } else if (communityDialogueStep === 5) {
                renderCommunityDialogueStep(6);
            } else if (communityDialogueStep === 7) {
                renderCommunityDialogueStep(8);
            }
        };

        window.advanceCommunityDialogue = handleCommunityAdvance;

        const isQuizStep = (communityDialogueStep === 4 || communityDialogueStep === 6 || communityDialogueStep === 8);

        if (dialogBox) {
            dialogBox.style.cursor = isQuizStep ? 'default' : 'pointer';
            dialogBox.onclick = isQuizStep ? null : handleCommunityAdvance;
        }
        if (dialogContent) {
            dialogContent.style.cursor = isQuizStep ? 'default' : 'pointer';
            dialogContent.onclick = isQuizStep ? null : handleCommunityAdvance;
        }
        if (dialogIndicator) {
            dialogIndicator.style.cursor = isQuizStep ? 'default' : 'pointer';
            dialogIndicator.onclick = isQuizStep ? null : handleCommunityAdvance;
        }
        if (bottomPanel) {
            bottomPanel.style.cursor = 'default';
            bottomPanel.onclick = (e) => {
                if (e.target.closest('#optionsGrid, .rpg-choice-btn, button')) return;
                if (!isQuizStep) {
                    handleCommunityAdvance(e);
                }
            };
        }
        const mainStage = document.getElementById('rpgMainStage');
        if (mainStage) {
            mainStage.onclick = (e) => {
                if (activeContinentStageKey === 'community') {
                    if (e.target.closest('#optionsGrid, .rpg-choice-btn, button, .continent-stage-hotspot, .p-order')) {
                        return;
                    }
                    if (!isQuizStep) {
                        handleCommunityAdvance(e);
                    }
                }
            };
        }
    }

    function renderCommunityQuiz(qNum) {
        const qData = COMMUNITY_STAGE_QUESTIONS[qNum - 1];
        if (!qData) return;

        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');

        if (mentorWrapper) {
            mentorWrapper.classList.remove('hidden', 'speaking');
            mentorWrapper.classList.add('inactive');
            const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
            const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
            if (img) img.src = qData.characterImg;
            if (tag) tag.textContent = qData.characterName;
        }
        if (charStudent) {
            charStudent.classList.add('hidden');
        }

        if (choicesAreaEl) choicesAreaEl.classList.remove('hidden');
        if (optionsGridEl) {
            optionsGridEl.classList.remove('hidden');
            optionsGridEl.innerHTML = '';
        }

        const selectedKey = qNum === 1 ? communityQ1SelectedKey : (qNum === 2 ? communityQ2SelectedKey : communityQ3SelectedKey);
        const isRevealed = qNum === 1 ? communityQ1AnswerRevealed : (qNum === 2 ? communityQ2AnswerRevealed : communityQ3AnswerRevealed);

        if (speakerBadge) speakerBadge.textContent = `【社區廣場 ‧ 第 ${qNum} 題】`;
        if (dialogContent) {
            const selectedOption = qData.options.find(option => option.key === selectedKey);
            if (!isRevealed || !selectedOption) {
                dialogContent.innerHTML = `<span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">題目： ${qData.questionTitle}</span>`;
            } else if (selectedKey === qData.correctKey) {
                dialogContent.innerHTML = `
                    <div style="color:#4ade80;font-weight:bold;font-size:1.1em;margin-bottom:6px;">🎯 第 ${qNum} 題解答正確！</div>
                    <div style="color:#ffffff;line-height:1.5;">${selectedOption.hint}</div>
                `;
            } else {
                dialogContent.innerHTML = `
                    <div style="color:#f87171;font-weight:bold;font-size:1.1em;margin-bottom:6px;">⚠️ 營養師提醒：「這項建議可能無法解決長輩的實際困境喔！」</div>
                    <div style="color:#fef08a;line-height:1.5;">${selectedOption.hint}</div>
                    <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">💡 提示：請重新點選最具個別化或能有效改善營養風險的選項！</div>
                `;
            }
        }
        if (dialogIndicator) {
            if (!isRevealed) {
                dialogIndicator.innerHTML = '💡 請點選下方最合適的營養照護策略進行作答';
            }
        }

        qData.options.forEach((opt) => {
            const btn = document.createElement('div');
            btn.className = 'rpg-choice-btn';
            btn.dataset.key = opt.key;

            if (selectedKey === opt.key) {
                btn.classList.add('selected');
            }

            if (isRevealed) {
                if (opt.key === qData.correctKey) {
                    btn.classList.add('is-correct-answer');
                } else if (selectedKey === opt.key) {
                    btn.classList.add('is-wrong-answer');
                }
            }

            btn.innerHTML = `
                <div class="choice-left" style="display:flex;align-items:center;gap:10px;">
                    <span class="choice-score-badge" style="background:${isRevealed && opt.key === qData.correctKey ? '#059669' : '#0284c7'};color:#ffffff;font-weight:900;padding:4px 10px;border-radius:6px;">選項 ${opt.key}</span>
                    <span class="choice-text" style="font-size:15px;line-height:1.4;">${opt.text}</span>
                </div>
                <div class="choice-right">
                    ${isRevealed && opt.key === qData.correctKey ? '<span style="color:#34d399;font-weight:bold;font-size:14px;">✅ 正確策略</span>' : ''}
                </div>
            `;

            btn.onclick = (e) => {
                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                selectCommunityQuizOption(qNum, opt.key);
            };

            if (optionsGridEl) optionsGridEl.appendChild(btn);
        });
    }

    function selectCommunityQuizOption(qNum, key) {
        if (qNum === 1) { communityQ1SelectedKey = key; communityQ1AnswerRevealed = true; }
        else if (qNum === 2) { communityQ2SelectedKey = key; communityQ2AnswerRevealed = true; }
        else if (qNum === 3) { communityQ3SelectedKey = key; communityQ3AnswerRevealed = true; }

        sfxClick();

        const qData = COMMUNITY_STAGE_QUESTIONS[qNum - 1];
        const opt = qData.options.find(o => o.key === key);
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');

        if (key === qData.correctKey) {
            sfxCorrect();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#4ade80;font-weight:bold;font-size:1.1em;margin-bottom:6px;">🎯 第 ${qNum} 題解答正確！</div>
                    <div style="color:#ffffff;line-height:1.5;">${opt.hint}</div>
                `;
            }
            if (dialogIndicator) {
                if (qNum === 1) {
                    dialogIndicator.innerHTML = '<button type="button" style="background:#0284c7;color:#ffffff;border:1px solid #38bdf8;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.advanceToCommunityStep(5);">👵 探訪第二位長者 ‧ 林秀枝阿嬤 ➔</button>';
                } else if (qNum === 2) {
                    dialogIndicator.innerHTML = '<button type="button" style="background:#0284c7;color:#ffffff;border:1px solid #38bdf8;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.advanceToCommunityStep(7);">📋 前往第三關 ‧ 社區整合照護策略 ➔</button>';
                } else if (qNum === 3) {
                    window.isCompletedCommunityStage = true;
                    window.lastCompletedStageName = '社區廣場';
                    markContinentStageCompleted('community');
                    dialogIndicator.innerHTML = '🎉 完美通關 ‧ <button type="button" style="background:#059669;color:#ffffff;border:1px solid #34d399;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);margin-right:8px;" onclick="event.stopPropagation(); window.triggerVictory();">🏆 領取成就書</button> 或 <button type="button" style="background:#0284c7;color:#ffffff;border:1px solid #38bdf8;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.returnToHealthContinent();">🗺️ 返回健康大陸 ➔</button>';
                    if (window.showToast) {
                        window.showToast('🎉 恭喜通過社區廣場三大試煉！榮獲【社區廣場】成就證書！', 'success');
                    }
                    setTimeout(() => { triggerVictory(); }, 1500);
                }
            }
        } else {
            sfxWrong();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#f87171;font-weight:bold;font-size:1.1em;margin-bottom:6px;">⚠️ 營養師提醒：「這項建議可能無法解決長輩的實際困境喔！」</div>
                    <div style="color:#fef08a;line-height:1.5;">${opt.hint}</div>
                    <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">💡 提示：請重新點選最具個別化或能有效改善營養風險的選項！</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '💡 請重新選擇最適合長者的營養照護選項 ➔';
            }
        }

        renderCommunityQuiz(qNum);
    }

    function advanceToCommunityStep(step) {
        communityDialogueStep = step;
        renderCommunityDialogueStep(step);
    }
    window.advanceToCommunityStep = advanceToCommunityStep;
    window.selectCommunityQuizOption = selectCommunityQuizOption;

    function startCommunityStage() {
        activeContinentStageKey = 'community';
        isMedicalCityActive = false;
        communityDialogueStep = 0;
        communityQ1SelectedKey = null;
        communityQ1AnswerRevealed = false;
        communityQ2SelectedKey = null;
        communityQ2AnswerRevealed = false;
        communityQ3SelectedKey = null;
        communityQ3AnswerRevealed = false;

        document.body.classList.remove(
            'health-continent-active', 'trial-step-0', 'trial-dialog-step',
            'continent-guide-dismissed', 'medical-city-active', 'sports-stage-active',
            'port-stage-active', 'forest-stage-active', 'continent-scenery-stage-active'
        );
        document.body.classList.add('community-stage-active');

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) continentMapEl.classList.add('hidden');

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop continent-scenery-theme community-stage-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_continent_community.png?community-stage-sync-v1')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.remove('hidden');

        renderCommunityDialogueStep(0);
    }
    window.startCommunityStage = startCommunityStage;

    let researchDialogueStep = 0;
    let lastResearchAdvanceTime = 0;

    let researchQ1SelectedKey = null;
    let researchQ1AnswerRevealed = false;
    let researchQ2SelectedKey = null;
    let researchQ2AnswerRevealed = false;

    const RESEARCH_STAGE_DATA = {
        title: '研究之都 ‧ 實證營養與科學探究試煉',
        q1: {
            questionTitle: '調查結果發現，常喝<span style="color:#fef08a;">含糖飲料</span>的學生，<span style="color:#fef08a;">體重過重</span>及<span style="color:#fef08a;">肥胖</span>的比例比較高。以下哪個結論最合理？',
            correctKey: 'B',
            options: [
                { key: 'A', text: '喝含糖飲料是造成肥胖的原因', hint: '⚠️ 在橫斷面調查中，「相關不等於因果」！可能常喝含糖飲料的學生同時缺乏運動或吃較多油炸物，單憑現有調查不能直接斷言為唯一因果！' },
                { key: 'B', text: '喝飲料與肥胖相關，但不具因果關係', hint: '🎉 完全正確！科學研究必須嚴謹區分「相關性（Correlation）」與「因果性（Causation）」，不能在缺乏因果證據下妄下定論！' }
            ]
        },
        q2: {
            questionTitle: '如果想了解某種<span style="color:#fef08a;">飲食習慣</span>與<span style="color:#fef08a;">健康</span>的關係，哪一種做法比較合理？',
            correctKey: 'A',
            options: [
                { key: 'A', text: '依據研究問題，蒐集資料與分析', hint: '🎉 太棒了！提出研究問題、設計嚴謹實驗或調查、蒐集真實數據並進行客觀統計分析，正是科學研究尋找真相的核心基石！' },
                { key: 'B', text: '看網路熱門文章或詢問ChatGPT', hint: '⚠️ 網路文章和AI生成內容可能夾雜未經同儕審查的偽科學或幻覺，不能直接作為營養醫學的正式實證依據！' }
            ]
        }
    };

    function renderResearchDialogueStep(step) {
        researchDialogueStep = step;
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const charStudentImg = document.getElementById('charStudentImg');
        const charStudentName = document.getElementById('charStudentName');

        const charStage = document.getElementById('characterStage');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const dialogBox = document.getElementById('dialogBox');

        // 研究之都使用自己的對話流程，不能再觸發 HTML 預設的新生試煉推進器。
        if (dialogBox) {
            dialogBox.removeAttribute('onclick');
        }

        // 非作答步驟時，隱藏題目 1 與題目 2 的覆蓋卡片層，避免遮擋對話與立繪
        if (step !== 2 && step !== 4) {
            const resQ1Overlay = document.getElementById('researchStage1QuizArea');
            if (resQ1Overlay) {
                resQ1Overlay.classList.add('hidden');
                resQ1Overlay.style.setProperty('display', 'none', 'important');
            }
            const resQ2Overlay = document.getElementById('researchStage2QuizArea');
            if (resQ2Overlay) {
                resQ2Overlay.classList.add('hidden');
                resQ2Overlay.style.setProperty('display', 'none', 'important');
            }
            document.body.classList.remove('forest-quiz-step');
        }

        if (charStage) {
            charStage.classList.remove('hidden');
            charStage.style.removeProperty('display');
            charStage.style.removeProperty('visibility');
        }
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
            dialogBox.style.removeProperty('display');
        }

        const isFem = (selectedGender === 'female' || localStorage.getItem('FYU_STUDENT_GENDER') === 'female');
        const internHeroImg = isFem ? 'assets/hero_player_female_hd.png' : 'assets/hero_player_male_intern.png?v=20261021-intern-m';

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#7c3aed;color:#fff;font-weight:900;">🔬 研究之都</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>研究之都</strong> ‧ 尖端營養科學 ‧ 實證醫學試煉</span>
                    <span class="p-metrics">任務：<strong>觀察科學證據 ‧ 破解健康謎題</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#e9d5ff;background:rgba(124,58,237,0.18);border:1px solid rgba(168,85,247,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        if (step === 0) {
            // 前導對話 1：專業營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科技大學保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「研究之都最近出現一項健康調查：研究人員發現，常喝<span style="color: #fef08a;">含糖飲料</span>的學生，<span style="color: #fef08a;">體重過重</span>及<span style="color: #fef08a;">肥胖</span>的比例似乎比較高。研究團隊想知道，這是否代表喝<span style="color: #fef08a;">含糖飲料</span>一定會造成<span style="color: #fef08a;">肥胖</span>。」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊繼續對話 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) {
                    img.src = 'assets/mentor_guide.png';
                    img.alt = '輔英科技大學保健營養系 伊麗克絲 營養師';
                    img.style.removeProperty('display');
                }
                if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
        } else if (step === 1) {
            // 前導對話 2：實習營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「勇者，研究數據不會直接告訴你所有答案！<span style="color: #fef08a;">你必須學會觀察證據、提出問題，才能破解健康謎題。</span>」</span>`;
            }
            if (dialogIndicator) dialogIndicator.innerHTML = '點擊進入題目 1 作答 ➔';

            if (mentorWrapper) {
                mentorWrapper.classList.remove('speaking');
                mentorWrapper.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                if (charStudentImg) {
                    charStudentImg.src = internHeroImg;
                    charStudentImg.alt = getNutritionInternDisplayName();
                    charStudentImg.style.removeProperty('display');
                }
                if (charStudentName) charStudentName.textContent = getNutritionInternDisplayName();
            }
        } else if (step === 2) {
            // 題目 1 作答
            renderResearchQuiz(1);
        } else if (step === 3) {
            // 題目 1 後對話：實習營養師
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.textContent = getNutritionInternDisplayName();
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「原來<span style="color: #fef08a;">看到兩件事一起發生，不代表其中一件一定造成另一件的原因！</span>研究真的像在辦案。」</span>`;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '<button type="button" style="margin-top:12px;display:inline-block;background:#7c3aed;color:#ffffff;border:1px solid #a855f7;padding:7px 18px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.advanceToResearchStep(4);">🔬 開始題目 2 作答 ➔</button>';
            }

            if (mentorWrapper) {
                mentorWrapper.classList.remove('speaking');
                mentorWrapper.classList.add('inactive');
            }
            if (charStudent) {
                charStudent.classList.remove('hidden', 'inactive');
                charStudent.classList.add('speaking');
                charStudent.style.removeProperty('display');
                charStudent.style.removeProperty('visibility');
                if (charStudentImg) {
                    charStudentImg.src = internHeroImg;
                    charStudentImg.alt = getNutritionInternDisplayName();
                    charStudentImg.style.removeProperty('display');
                }
                if (charStudentName) charStudentName.textContent = getNutritionInternDisplayName();
            }
        } else if (step === 4) {
            // 題目 2 作答
            renderResearchQuiz(2);
        } else if (step === 5) {
            // 對話 3：專業營養師結尾
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');

            if (speakerBadge) speakerBadge.innerHTML = '<span class="speaker-name-highlight-white">輔英科技大學保健營養系 伊麗克絲 營養師</span>';
            if (dialogContent) {
                dialogContent.innerHTML = `<span style="color: #ffffff; font-weight: bold; font-size: 1.08em; line-height: 1.6;">「<span style="color: #4ade80;">恭喜你破解營養研究謎題！</span>營養研究人員運用科學方法尋找證據，讓健康建議不只是憑感覺，而是<span style="color: #fef08a;">有資料支持</span>。」</span>`;
            }
            window.lastCompletedStageName = '研究之都';
            window.isCompletedResearchStage = true;
            markContinentStageCompleted('research');
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '🎉 完美通關 ‧ <button type="button" style="background:#7c3aed;color:#ffffff;border:1px solid #a855f7;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);margin-right:8px;" onclick="event.stopPropagation(); window.triggerVictory();">🏆 領取成就書</button> 或 <button type="button" style="background:#0284c7;color:#ffffff;border:1px solid #38bdf8;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.returnToHealthContinent();">🗺️ 返回健康大陸 ➔</button>';
            }

            if (mentorWrapper) {
                mentorWrapper.classList.remove('hidden', 'inactive');
                mentorWrapper.classList.add('speaking');
                mentorWrapper.style.removeProperty('display');
                mentorWrapper.style.removeProperty('visibility');
                const img = document.getElementById('charTeacherImg') || mentorWrapper.querySelector('img');
                const tag = document.getElementById('charTeacherName') || mentorWrapper.querySelector('.char-nametag');
                if (img) img.src = 'assets/mentor_guide.png';
                if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }

            if (window.showToast) {
                window.showToast('🎉 恭喜通過研究之都實證試煉！榮獲【研究之都】成就證書！', 'success');
            }
            setTimeout(() => { triggerVictory(); }, 1600);
        }

        const handleResearchAdvance = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (Date.now() - lastResearchAdvanceTime < 350) return;
            lastResearchAdvanceTime = Date.now();
            if (researchDialogueStep === 0) {
                renderResearchDialogueStep(1);
            } else if (researchDialogueStep === 1) {
                renderResearchDialogueStep(2);
            } else if (researchDialogueStep === 3) {
                renderResearchDialogueStep(4);
            }
        };

        window.advanceResearchDialogue = handleResearchAdvance;

        const isQuizStep = (researchDialogueStep === 2 || researchDialogueStep === 4);

        if (dialogBox) {
            dialogBox.style.cursor = isQuizStep ? 'default' : 'pointer';
            dialogBox.onclick = isQuizStep ? null : handleResearchAdvance;
        }
        if (dialogContent) {
            dialogContent.style.cursor = isQuizStep ? 'default' : 'pointer';
            dialogContent.onclick = isQuizStep ? null : handleResearchAdvance;
        }
        if (dialogIndicator) {
            dialogIndicator.style.cursor = isQuizStep ? 'default' : 'pointer';
            dialogIndicator.onclick = isQuizStep ? null : handleResearchAdvance;
        }
        if (bottomPanel) {
            bottomPanel.style.cursor = 'default';
            bottomPanel.onclick = (e) => {
                if (e.target.closest('#optionsGrid, .rpg-choice-btn, button')) return;
                if (!isQuizStep) {
                    handleResearchAdvance(e);
                }
            };
        }
        const mainStage = document.getElementById('rpgMainStage');
        if (mainStage) {
            mainStage.onclick = (e) => {
                if (activeContinentStageKey === 'research') {
                    if (e.target.closest('#optionsGrid, .rpg-choice-btn, button, .continent-stage-hotspot, .p-order')) {
                        return;
                    }
                    if (!isQuizStep) {
                        handleResearchAdvance(e);
                    }
                }
            };
        }
    }

    function selectResearchStage1Option(key, event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        selectResearchQuizOption(1, key);
    }
    window.selectResearchStage1Option = selectResearchStage1Option;

    function selectResearchStage2Option(key, event) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        selectResearchQuizOption(2, key);
    }
    window.selectResearchStage2Option = selectResearchStage2Option;

    function renderResearchQuiz(qNum) {
        const qData = qNum === 1 ? RESEARCH_STAGE_DATA.q1 : RESEARCH_STAGE_DATA.q2;
        if (!qData) return;

        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');
        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const mentorWrapper = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const researchStage1QuizArea = document.getElementById('researchStage1QuizArea');
        const researchStage2QuizArea = document.getElementById('researchStage2QuizArea');

        // 第 1 題：使用雙選項大型直向圖文方框卡片 (含糖飲料與肥胖因果探究)
        if (qNum === 1) {
            if (mentorWrapper) {
                mentorWrapper.classList.add('hidden');
                mentorWrapper.classList.remove('speaking');
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) {
                optionsGridEl.classList.add('hidden');
                optionsGridEl.innerHTML = '';
            }

            document.body.classList.add('research-stage-active', 'forest-quiz-step');
            if (researchStage2QuizArea) {
                researchStage2QuizArea.classList.add('hidden');
                researchStage2QuizArea.style.setProperty('display', 'none', 'important');
            }
            if (researchStage1QuizArea) {
                researchStage1QuizArea.classList.remove('hidden');
                researchStage1QuizArea.style.removeProperty('display');
                researchStage1QuizArea.style.setProperty('display', 'flex', 'important');
            }

            if (speakerBadge) speakerBadge.textContent = '【研究之都 ‧ 題目 1】';
            if (dialogContent) {
                dialogContent.innerHTML = '<span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">題目 1： ' + qData.questionTitle + '</span>';
            }
            if (dialogIndicator) {
                if (!researchQ1AnswerRevealed) {
                    dialogIndicator.innerHTML = '💡 請點選上方 RPG 背景前之【選項 A】或【選項 B】卡片進行作答';
                }
            }

            if (researchStage1QuizArea) {
                researchStage1QuizArea.querySelectorAll('.forest-overlay-card').forEach(card => {
                    const k = card.getAttribute('data-opt');
                    card.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
                    if (researchQ1SelectedKey === k) {
                        card.classList.add('selected');
                    }
                    if (researchQ1AnswerRevealed) {
                        if (k === qData.correctKey) {
                            card.classList.add('is-correct-answer');
                        }
                    } else if (researchQ1SelectedKey === k && k !== qData.correctKey) {
                        card.classList.add('is-wrong-answer');
                    }
                });
            }
            return;
        }

        // 第 2 題：使用雙選項大型直向圖文方框卡片 (科學研究方法)
        if (qNum === 2) {
            if (mentorWrapper) {
                mentorWrapper.classList.add('hidden');
                mentorWrapper.classList.remove('speaking');
            }
            if (charStudent) {
                charStudent.classList.add('hidden');
                charStudent.classList.remove('speaking');
            }
            if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
            if (optionsGridEl) {
                optionsGridEl.classList.add('hidden');
                optionsGridEl.innerHTML = '';
            }
            if (researchStage1QuizArea) {
                researchStage1QuizArea.classList.add('hidden');
                researchStage1QuizArea.style.setProperty('display', 'none', 'important');
            }

            document.body.classList.add('research-stage-active', 'forest-quiz-step');
            if (researchStage2QuizArea) {
                researchStage2QuizArea.classList.remove('hidden');
                researchStage2QuizArea.style.removeProperty('display');
                researchStage2QuizArea.style.setProperty('display', 'flex', 'important');
            }

            if (speakerBadge) speakerBadge.textContent = '【研究之都 ‧ 題目 2】';
            if (dialogContent) {
                dialogContent.innerHTML = '<span style="color:#ffffff;font-weight:bold;font-size:1.1em;line-height:1.5;">題目 2： ' + qData.questionTitle + '</span>';
            }
            if (dialogIndicator) {
                if (!researchQ2AnswerRevealed) {
                    dialogIndicator.innerHTML = '💡 請點選上方 RPG 背景前之【選項 A】或【選項 B】卡片進行作答';
                }
            }

            if (researchStage2QuizArea) {
                researchStage2QuizArea.querySelectorAll('.forest-overlay-card').forEach(card => {
                    const k = card.getAttribute('data-opt');
                    card.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer');
                    if (researchQ2SelectedKey === k) {
                        card.classList.add('selected');
                    }
                    if (researchQ2AnswerRevealed) {
                        if (k === qData.correctKey) {
                            card.classList.add('is-correct-answer');
                        }
                    } else if (researchQ2SelectedKey === k && k !== qData.correctKey) {
                        card.classList.add('is-wrong-answer');
                    }
                });
            }
            return;
        }
    }

    function selectResearchQuizOption(qNum, key) {
        const qData = qNum === 1 ? RESEARCH_STAGE_DATA.q1 : RESEARCH_STAGE_DATA.q2;
        const isCorrect = (qData && key === qData.correctKey);

        if (qNum === 1) {
            researchQ1SelectedKey = key;
            if (isCorrect) researchQ1AnswerRevealed = true;
        } else if (qNum === 2) {
            researchQ2SelectedKey = key;
            if (isCorrect) researchQ2AnswerRevealed = true;
        }

        sfxClick();
        const opt = qData.options.find(o => o.key === key);
        const dialogContent = document.getElementById('dialogContent');
        const dialogIndicator = document.getElementById('dialogIndicator');

        // 先重繪選項狀態，再寫入答題回饋，避免重繪覆蓋正確提示與通關按鈕。
        renderResearchQuiz(qNum);

        if (key === qData.correctKey) {
            sfxCorrect();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#4ade80;font-weight:bold;font-size:1.1em;margin-bottom:6px;">🎯 題目 ${qNum} 判斷正確！</div>
                    <div style="color:#ffffff;line-height:1.5;">${opt.hint}</div>
                `;
            }
            if (dialogIndicator) {
                if (qNum === 1) {
                    dialogIndicator.innerHTML = '<button type="button" style="margin-top:16px;display:inline-block;background:#7c3aed;color:#ffffff;border:1px solid #a855f7;padding:7px 18px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.advanceToResearchStep(3);">💬 實習營養師心得討論 ➔</button>';
                } else if (qNum === 2) {
                    dialogIndicator.innerHTML = '<button type="button" style="margin-top:16px;display:inline-block;background:#059669;color:#ffffff;border:1px solid #34d399;padding:7px 18px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); window.advanceToResearchStep(5);">🏆 聽取導師總結並領取成就 ➔</button>';
                }
            }
        } else {
            sfxWrong();
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div style="color:#f87171;font-weight:bold;font-size:1.1em;margin-bottom:6px;">⚠️ 營養研究員提醒：「推論過於武斷或缺乏嚴謹科學方法喔！」</div>
                    <div style="color:#fef08a;line-height:1.5;">${opt.hint}</div>
                    <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">💡 提示：請重新選擇具備實證精神且不輕易斷定因果的選項！</div>
                `;
            }
            if (dialogIndicator) {
                dialogIndicator.innerHTML = '💡 請重新選擇最符合科學研究精神的選項 ➔';
            }
        }
    }

    function advanceToResearchStep(step) {
        researchDialogueStep = step;
        renderResearchDialogueStep(step);
    }
    window.advanceToResearchStep = advanceToResearchStep;
    window.selectResearchQuizOption = selectResearchQuizOption;

    function startResearchStage() {
        activeContinentStageKey = 'research';
        isMedicalCityActive = false;
        researchDialogueStep = 0;
        researchQ1SelectedKey = null;
        researchQ1AnswerRevealed = false;
        researchQ2SelectedKey = null;
        researchQ2AnswerRevealed = false;
        const researchStage1QuizArea = document.getElementById('researchStage1QuizArea');
        if (researchStage1QuizArea) {
            researchStage1QuizArea.classList.add('hidden');
            researchStage1QuizArea.style.setProperty('display', 'none', 'important');
        }
        const researchStage2QuizArea = document.getElementById('researchStage2QuizArea');
        if (researchStage2QuizArea) {
            researchStage2QuizArea.classList.add('hidden');
            researchStage2QuizArea.style.setProperty('display', 'none', 'important');
        }

        document.body.classList.remove(
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
        }

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) continentMapEl.classList.add('hidden');

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop continent-scenery-theme research-stage-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_continent_research.png?stage-bg-sync-v1')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }
        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.remove('hidden');

        renderResearchDialogueStep(0);
    }
    window.startResearchStage = startResearchStage;

    function startForestStage() {
        activeContinentStageKey = 'forest';
        isMedicalCityActive = false;
        forestDialogueStep = 0;
        configureBgmForStage(activeUnit, currentStage || 1);

        document.body.classList.remove(
            'health-continent-active', 'trial-step-0', 'trial-dialog-step',
            'continent-guide-dismissed', 'medical-city-active', 'sports-stage-active',
            'port-stage-active', 'continent-scenery-stage-active'
        );
        document.body.classList.add('forest-stage-active');

        const fyuTitle = document.querySelector('.fyu-title') || document.getElementById('fyuHeaderTitle');
        const fyuSub = document.querySelector('.fyu-sub') || document.getElementById('fyuHeaderSub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = '營養勇者傳：蔬食之森';
        if (fyuSub) fyuSub.textContent = '植物性營養 ‧ 植化素與腸道菌群平衡試煉';
        if (fyuIcon) fyuIcon.textContent = '⚔️';

        const continentMapEl = document.getElementById('healthContinentMap');
        if (continentMapEl) continentMapEl.classList.add('hidden');

        const backdropEl = document.getElementById('stageBackdrop');
        if (backdropEl) {
            backdropEl.className = 'stage-backdrop continent-scenery-theme forest-stage-theme';
            backdropEl.style.setProperty('background-image', "url('assets/rpg_bg_forest_classroom.jpg?stage-bg-sync-v1')", 'important');
            backdropEl.style.setProperty('background-size', 'cover', 'important');
            backdropEl.style.setProperty('background-position', 'center center', 'important');
            backdropEl.style.setProperty('background-repeat', 'no-repeat', 'important');
            backdropEl.style.removeProperty('aspect-ratio');
        }

        const bottomPanel = document.getElementById('rpgBottomPanel');
        if (bottomPanel) {
            bottomPanel.classList.remove('hidden');
            bottomPanel.style.removeProperty('display');
        }

        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.remove('hidden');

        const patientBanner = document.getElementById('patientBanner');
        if (patientBanner) {
            patientBanner.classList.remove('hidden');
            patientBanner.style.removeProperty('display');
            patientBanner.innerHTML = `
                <div class="banner-badge" style="background:#16a34a;color:#fff;font-weight:900;">🥗 蔬食之森</div>
                <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                    <span class="p-name"><strong>蔬食之森</strong> ‧ 營養教育活動設計試煉</span>
                    <span class="p-metrics">對象：<strong>高中職學生</strong> ｜ 任務：<strong>設計參與式營養體驗活動</strong></span>
                    <span class="p-order" style="cursor:pointer;color:#bbf7d0;background:rgba(22,163,74,0.15);border:1px solid rgba(74,222,128,0.48);border-radius:6px;padding:1px 7px;" onclick="window.returnToHealthContinent()">🗺️ 返回健康大陸</span>
                </div>
            `;
        }

        renderForestDialogueStep(0);
    }
    window.startForestStage = startForestStage;

    function returnToHealthContinent() {
        isMedicalCityActive = false;
        activeContinentStageKey = null;
        document.body.classList.remove(
            'medical-city-active',
            'medical-food-step',
            'sports-stage-active',
            'sports-quiz-step',
            'port-stage-active',
            'port-quiz-step',
            'forest-stage-active',
            'community-stage-active',
            'continent-scenery-stage-active'
        );

        // 徹底隱藏食物桌面與重設面板
        const tableArea = document.getElementById('medicalCityFoodTableArea');
        if (tableArea) {
            tableArea.classList.add('hidden');
            tableArea.style.setProperty('display', 'none', 'important');
        }

        const sportsQuizArea = document.getElementById('sportsQuizArea');
        if (sportsQuizArea) {
            sportsQuizArea.classList.add('hidden');
            sportsQuizArea.style.setProperty('display', 'none', 'important');
        }

        const sportsAzheReturnEl = document.getElementById('sportsAzheCharacter');
        if (sportsAzheReturnEl) {
            sportsAzheReturnEl.classList.add('hidden');
            sportsAzheReturnEl.classList.remove('speaking', 'inactive', 'azhe-surprised-shaking');
            sportsAzheReturnEl.style.setProperty('display', 'none', 'important');
            sportsAzheReturnEl.style.setProperty('visibility', 'hidden', 'important');
        }

        const portQuizArea = document.getElementById('portQuizArea');
        if (portQuizArea) {
            portQuizArea.classList.add('hidden');
            portQuizArea.style.setProperty('display', 'none', 'important');
        }

        const forestQuizArea = document.getElementById('forestQuizArea');
        if (forestQuizArea) {
            forestQuizArea.classList.add('hidden');
            forestQuizArea.style.setProperty('display', 'none', 'important');
        }

        const forestStage2QuizArea = document.getElementById('forestStage2QuizArea');
        if (forestStage2QuizArea) {
            forestStage2QuizArea.classList.add('hidden');
            forestStage2QuizArea.style.setProperty('display', 'none', 'important');
        }

        const forestStage1FailVideoOverlay = document.getElementById('forestStage1FailVideoOverlay');
        if (forestStage1FailVideoOverlay) {
            forestStage1FailVideoOverlay.classList.add('hidden');
            forestStage1FailVideoOverlay.style.setProperty('display', 'none', 'important');
            const failVideo = document.getElementById('forestStage1FailVideo');
            if (failVideo) {
                try { failVideo.pause(); } catch(e) {}
            }
        }

        // 關閉任何開啟的結算彈窗與前導影片
        if (rpgVictoryModal) {
            rpgVictoryModal.classList.add('hidden');
            rpgVictoryModal.style.setProperty('display', 'none', 'important');
        }
        ['researchStage1QuizArea', 'researchStage2QuizArea'].forEach(id => {
            const researchOverlay = document.getElementById(id);
            if (!researchOverlay) return;
            researchOverlay.classList.add('hidden');
            researchOverlay.style.setProperty('display', 'none', 'important');
        });
        document.body.classList.remove('research-stage-active');

        const overlay = document.getElementById('medicalCityIntroVideoOverlay');
        if (overlay) overlay.classList.add('hidden');

        configureBgmForStage(activeUnit, 1);
        showNewStudentHealthContinent(true);

        const fyuTitle = document.querySelector('.fyu-title') || document.getElementById('fyuHeaderTitle');
        const fyuSub = document.querySelector('.fyu-sub') || document.getElementById('fyuHeaderSub');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        if (fyuTitle) fyuTitle.textContent = '營養勇者傳：健康大陸';
        if (fyuSub) fyuSub.textContent = '營養師職業覺醒任務 ‧ 探索六大區域';
        if (fyuIcon) fyuIcon.textContent = '⚔️';
        if (typeof updateContinentHotspotsStatus === 'function') {
            updateContinentHotspotsStatus();
        }

        // 地圖重繪可能重設面板狀態；最後再次收起，避免冒險指南出現在返回畫面。
        dismissContinentGuide();

        if (window.showToast) {
            const certName = window.lastCompletedStageName || '醫療之城';
            window.showToast(`🗺️ 榮獲【${certName}】成就書！歡迎返回健康大陸！`, 'success');
        }
    }

    function finishMedicalCityIntroVideo(proceedToStage) {
        const overlay = document.getElementById('medicalCityIntroVideoOverlay');
        const video = document.getElementById('medicalCityIntroVideo');
        const status = document.getElementById('medicalCityIntroVideoStatus');
        const retryButton = document.getElementById('medicalCityIntroVideoRetry');
        if (video) {
            try { video.pause(); } catch(e) {}
            video.onended = null;
            video.onerror = null;
        }
        if (overlay) overlay.classList.add('hidden');
        if (status) status.textContent = '';
        if (retryButton) retryButton.classList.add('hidden');

        // 無論是播放完畢進入餐桌，還是點擊返回，只要原先有播放 BGM 且音效開啟，即刻恢復 BGM 播放
        if (medicalCityVideoBgmWasPlaying && soundEnabled) playBgm();
        medicalCityVideoBgmWasPlaying = false;

        if (proceedToStage) {
            // 播放完畢或點擊「跳過影片」：直接進入挑選食物餐桌！
            showMedicalCityFoodTable();
        } else {
            // 點擊「返回健康大陸」
            returnToHealthContinent();
        }
    }

    function playMedicalCityIntroVideo() {
        const overlay = document.getElementById('medicalCityIntroVideoOverlay');
        const video = document.getElementById('medicalCityIntroVideo');
        const status = document.getElementById('medicalCityIntroVideoStatus');
        const retryButton = document.getElementById('medicalCityIntroVideoRetry');
        if (!overlay || !video || !status || !retryButton) {
            showMedicalCityFoodTable();
            return;
        }

        medicalCityVideoBgmWasPlaying = !!(bgmPlaying && rpgBgmAudio && !rpgBgmAudio.paused);
        if (medicalCityVideoBgmWasPlaying) pauseBgm();
        overlay.classList.remove('hidden');
        status.textContent = '';
        retryButton.classList.add('hidden');

        video.onended = () => finishMedicalCityIntroVideo(true);
        video.onerror = () => {
            status.textContent = '影片載入中或發生異常，可點擊上方「跳過影片」直接進入題目。';
            retryButton.classList.remove('hidden');
        };

        const startPlayback = () => {
            video.currentTime = 0;
            const playback = video.play();
            if (playback && typeof playback.catch === 'function') {
                playback.then(() => {
                    status.textContent = '';
                    retryButton.classList.add('hidden');
                }).catch(() => {
                    status.textContent = '若影片未自動播放，請點擊下方按鈕開始，或點選上方「跳過影片」直接進入題目。';
                    retryButton.classList.remove('hidden');
                });
            }
        };
        retryButton.onclick = startPlayback;
        startPlayback();
    }

    function enterContinentStage(stageKey) {
        const regionKey = stageKey || activeContinentRegionKey || 'sports';
        const region = CONTINENT_REGIONS[regionKey] || { title: '勇者試煉地區' };
        if (regionKey !== 'sports') {
            const mentorWrapper = document.getElementById('charNurse');
            if (mentorWrapper) mentorWrapper.classList.remove('azhe-surprised-shaking');
        }

        const flashEl = document.getElementById('continentTransitionFlash');
        if (flashEl) {
            flashEl.classList.remove('hidden');
            flashEl.style.opacity = '0.9';
            setTimeout(() => {
                flashEl.style.opacity = '0';
                setTimeout(() => flashEl.classList.add('hidden'), 400);
            }, 300);
        }

        sfxFanfare();
        if (window.showToast) {
            window.showToast(`⚔️ 前往【${region.title}】！接受營養師覺醒試煉！`, 'success');
        }

        // 地圖由顯示流程以 inline !important 控制，單靠加上 hidden class 無法蓋掉它。
        // 進入任何關卡前都必須先關閉地圖圖層，讓實際 RPG 背景可以顯示。
        hideHealthContinentMapForStage();

        if (regionKey === 'medical' && isNewStudentTrialUnit(activeUnit)) {
            // 先進入醫療之城病房對話，對話結束後再播放影片與挑選食物
            startMedicalCityStage1();
            return;
        }

        if (regionKey === 'sports') {
            startSportsStage();
            return;
        }

        if (regionKey === 'port') {
            startPortStage();
            return;
        }

        if (regionKey === 'forest') {
            startForestStage();
            return;
        }

        if (regionKey === 'community') {
            startCommunityStage();
            return;
        }

        if (regionKey === 'research') {
            startResearchStage();
            return;
        }

        if (startContinentSceneryStage(regionKey)) {
            return;
        }

        showContinentBottomPanel();
        const speakerBadge = document.getElementById('speakerBadge');
        const dialogContent = document.getElementById('dialogContent');
        if (speakerBadge) speakerBadge.textContent = `【${region.title} ‧ 試煉啟動】`;
        if (dialogContent) {
            dialogContent.innerHTML = `
                <div class="continent-dialog-info">
                    <div class="continent-dialog-sub" style="color: #4ade80;">✅ 已成功接受【${region.title}】試煉！</div>
                    <div class="continent-dialog-desc">勇者已確認目標，即將進入專業營養師挑戰...</div>
                </div>
            `;
        }

        // 登錄勇者選擇並執行作答
        selectOption('1');
    }

    const completedContinentStages = new Set();

    function isMedicalCityCompleted() {
        return Boolean(window.isCompletedMedicalCity || completedContinentStages.has('medical'));
    }

    function isSportsStageCompleted() {
        return Boolean(window.isCompletedSportsStage || completedContinentStages.has('sports'));
    }

    function isPortStageCompleted() {
        return Boolean(window.isCompletedPortStage || completedContinentStages.has('port'));
    }

    function isForestStageCompleted() {
        return Boolean(window.isCompletedForestStage || completedContinentStages.has('forest'));
    }

    function isCommunityStageCompleted() {
        return Boolean(window.isCompletedCommunityStage || completedContinentStages.has('community'));
    }

    function isResearchStageCompleted() {
        return Boolean(window.isCompletedResearchStage || completedContinentStages.has('research'));
    }

    function markContinentStageCompleted(stageKey) {
        completedContinentStages.add(stageKey);
        updateContinentHotspotsStatus();
    }

    function updateContinentHotspotsStatus() {
        const isMedicalCleared = isMedicalCityCompleted();
        const medicalHotspot = document.querySelector('.hotspot-medical');
        if (medicalHotspot) {
            if (isMedicalCleared) {
                medicalHotspot.classList.add('stage-cleared');
                medicalHotspot.setAttribute('title', '醫療之城（已通關，不可再次挑戰）');
                medicalHotspot.setAttribute('aria-disabled', 'true');
            } else {
                medicalHotspot.classList.remove('stage-cleared');
                medicalHotspot.removeAttribute('aria-disabled');
            }
        }

        const isSportsCleared = isSportsStageCompleted();
        const sportsHotspot = document.querySelector('.hotspot-sports');
        if (sportsHotspot) {
            if (isSportsCleared) {
                sportsHotspot.classList.add('stage-cleared');
                sportsHotspot.setAttribute('title', '活力運動場（已通關，不可再次挑戰）');
                sportsHotspot.setAttribute('aria-disabled', 'true');
            } else {
                sportsHotspot.classList.remove('stage-cleared');
                sportsHotspot.removeAttribute('aria-disabled');
            }
        }

        const isPortCleared = isPortStageCompleted();
        const portHotspot = document.querySelector('.hotspot-port');
        if (portHotspot) {
            if (isPortCleared) {
                portHotspot.classList.add('stage-cleared');
                portHotspot.setAttribute('title', '團膳之港（已通關，不可再次挑戰）');
                portHotspot.setAttribute('aria-disabled', 'true');
            } else {
                portHotspot.classList.remove('stage-cleared');
                portHotspot.removeAttribute('aria-disabled');
            }
        }

        const isForestCleared = isForestStageCompleted();
        const forestHotspot = document.querySelector('.hotspot-forest');
        if (forestHotspot) {
            if (isForestCleared) {
                forestHotspot.classList.add('stage-cleared');
                forestHotspot.setAttribute('title', '蔬食之森（已通關，不可再次挑戰）');
                forestHotspot.setAttribute('aria-disabled', 'true');
            } else {
                forestHotspot.classList.remove('stage-cleared');
                forestHotspot.removeAttribute('aria-disabled');
            }
        }

        const communityHotspot = document.querySelector('.hotspot-community');
        if (communityHotspot) {
            if (isCommunityStageCompleted()) {
                communityHotspot.classList.add('stage-cleared');
                communityHotspot.setAttribute('title', '社區廣場（已通關，不可再次挑戰）');
                communityHotspot.setAttribute('aria-disabled', 'true');
            } else {
                communityHotspot.classList.remove('stage-cleared');
                communityHotspot.removeAttribute('aria-disabled');
            }
        }

        const researchHotspot = document.querySelector('.hotspot-research');
        if (researchHotspot) {
            if (isResearchStageCompleted()) {
                researchHotspot.classList.add('stage-cleared');
                researchHotspot.setAttribute('title', '研究之都（已通關，不可再次挑戰）');
                researchHotspot.setAttribute('aria-disabled', 'true');
            } else {
                researchHotspot.classList.remove('stage-cleared');
                researchHotspot.removeAttribute('aria-disabled');
            }
        }
    }
    window.updateContinentHotspotsStatus = updateContinentHotspotsStatus;

    function showNewStudentHealthContinent(hideGuide = false) {
        newStudentTrialStep = 4;
        window.__fyuTrialDialogStep = 4;
        const backdropEl = document.getElementById('stageBackdrop');
        const choicesAreaEl = document.getElementById('rpgChoicesArea');
        const optionsGridEl = document.getElementById('optionsGrid');
        const continentMapEl = document.getElementById('healthContinentMap');
        const characterStage = document.getElementById('characterStage');

        document.documentElement.classList.remove('trial-route');
        document.body.classList.remove('trial-step-0', 'trial-dialog-step', 'continent-guide-dismissed');
        document.body.classList.add('health-continent-active', 'unit-new_student_trial');

        if (characterStage) {
            characterStage.classList.add('hidden');
            characterStage.style.setProperty('display', 'none', 'important');
            characterStage.style.setProperty('pointer-events', 'none', 'important');
        }
        ['charNurse', 'charStudent', 'sportsAzheCharacter'].forEach(id => {
            const character = document.getElementById(id);
            if (character) {
                character.classList.add('hidden');
                character.classList.remove('speaking', 'inactive', 'azhe-surprised-shaking');
                character.style.setProperty('display', 'none', 'important');
                character.style.setProperty('visibility', 'hidden', 'important');
            }
        });

        if (backdropEl) {
            backdropEl.className = 'stage-backdrop health-continent-theme';
            backdropEl.style.setProperty('background-image', 'none', 'important');
            backdropEl.style.setProperty('background-color', '#070e1e', 'important');
        }

        if (continentMapEl) {
            continentMapEl.classList.remove('hidden');
            continentMapEl.style.removeProperty('visibility');
            continentMapEl.style.removeProperty('pointer-events');
            continentMapEl.style.removeProperty('display');
            continentMapEl.style.setProperty('display', 'flex', 'important');
            continentMapEl.style.setProperty('visibility', 'visible', 'important');
            continentMapEl.style.setProperty('pointer-events', 'auto', 'important');
            continentMapEl.style.setProperty('opacity', '1', 'important');
            continentMapEl.style.setProperty('z-index', '50', 'important');
        }

        const startAreaEl = document.getElementById('trialBgStartArea');
        if (startAreaEl) startAreaEl.classList.add('hidden');
        if (choicesAreaEl) choicesAreaEl.classList.add('hidden');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');

        const tableArea = document.getElementById('medicalCityFoodTableArea');
        if (tableArea) {
            tableArea.classList.add('hidden');
            tableArea.style.setProperty('display', 'none', 'important');
        }

        // 更新各區域狀態（將已通關之區域標記為灰色且不可點選）
        updateContinentHotspotsStatus();

        // 依指示：當完成醫療之城、活力運動廣場、團膳之港或蔬食之森等關卡後，返回健康大陸後，下方不要出現冒險指南對話框
        const shouldHideGuide = Boolean(hideGuide || isMedicalCityCompleted() || isSportsStageCompleted() || isPortStageCompleted() || isForestStageCompleted() || isCommunityStageCompleted());
        if (shouldHideGuide) {
            dismissContinentGuide();
        } else {
            showContinentBottomPanel();
            const speakerBadge = document.getElementById('speakerBadge');
            const dialogContent = document.getElementById('dialogContent');
            const dialogIndicator = document.getElementById('dialogIndicator');

            if (speakerBadge) speakerBadge.textContent = '【健康大陸 ‧ 冒險指南】';
            if (dialogContent) {
                dialogContent.innerHTML = `
                    <div class="continent-dialog-prompt">
                        🗺️ 歡迎來到健康大陸！請點選地圖上的<strong>六大區域方框</strong>（醫療之城、蔬食之森、社區廣場、活力運動場、研究之都、團膳之港），即可放大推進並開啟專屬職業試煉！
                    </div>
                `;
            }
            if (dialogIndicator) dialogIndicator.textContent = '🗺️ 點選地圖區域開啟試煉 ➔';
        }

        // 重設縮放至全域地圖初始狀態
        zoomOutContinentMap(false, shouldHideGuide);

        // 各關卡地標熱區點擊事件
        document.querySelectorAll('.continent-stage-hotspot').forEach(hotspot => {
            hotspot.onclick = (e) => {
                e.stopPropagation();
                const stageKey = hotspot.getAttribute('data-stage') || 'sports';

                // 依指示：若該關卡已通關，改為灰色並禁止再點選
                const isClearedStage = hotspot.classList.contains('stage-cleared') ||
                    (stageKey === 'medical' && isMedicalCityCompleted()) ||
                    (stageKey === 'sports' && isSportsStageCompleted()) ||
                    (stageKey === 'port' && isPortStageCompleted()) ||
                    (stageKey === 'forest' && isForestStageCompleted()) ||
                    (stageKey === 'community' && isCommunityStageCompleted()) ||
                    (stageKey === 'research' && isResearchStageCompleted());

                if (isClearedStage) {
                    if (window.showToast) {
                        const stageTitle = CONTINENT_REGIONS[stageKey] ? CONTINENT_REGIONS[stageKey].title : '此區域';
                        window.showToast(`🔒【${stageTitle}】試煉已圓滿通關，榮獲專屬成就書！請前往其他區域挑戰。`, 'info');
                    }
                    return;
                }

                // 已配置專屬 RPG 場景的地點，第一次點選就直接進入對應背景。
                // 其餘地點維持原本「先放大地圖、再確認進入」的互動方式。
                if (CONTINENT_REGIONS[stageKey] && CONTINENT_REGIONS[stageKey].background) {
                    enterContinentStage(stageKey);
                    return;
                }
                // 若已經在此關卡放大特寫，再次點擊熱區直接進入試煉
                if (activeContinentRegionKey === stageKey) {
                    enterContinentStage(stageKey);
                } else {
                    zoomIntoContinentRegion(stageKey);
                }
            };
        });

        // 點擊地圖畫面或空白處：若有放大關卡則返回全圖並隱藏指南；若在全圖則自動隱藏冒險指南並向下延伸放大背景圖片
        const mapEl = document.getElementById('healthContinentMap');
        if (mapEl) {
            mapEl.onclick = (e) => {
                if (e.target.closest('.continent-stage-hotspot')) return;
                if (activeContinentRegionKey) {
                    zoomOutContinentMap(true, true);
                } else {
                    dismissContinentGuide();
                }
            };
        }

        const stageMainStage = document.getElementById('rpgMainStage');
        if (stageMainStage) {
            stageMainStage.onclick = (e) => {
                if (isMedicalCityActive) return;
                if (newStudentTrialStep >= 4) {
                    if (
                        e.target.closest('.continent-stage-hotspot') ||
                        e.target.closest('.continent-dialog-actions') ||
                        e.target.closest('.medical-city-food-table-area, .table-food-card, #btnSubmitMedicalFood')
                    ) return;
                    if (activeContinentRegionKey) {
                        zoomOutContinentMap(true, true);
                    } else {
                        dismissContinentGuide();
                    }
                }
            };
        }

        // 暴露全域函數供對話框按鈕與外部使用
        window.dismissContinentGuide = dismissContinentGuide;
        window.showNewStudentHealthContinent = showNewStudentHealthContinent;
        window.zoomIntoContinentRegion = zoomIntoContinentRegion;
        window.zoomOutContinentMap = zoomOutContinentMap;
        window.enterContinentStage = enterContinentStage;
        const medicalVideoCloseButton = document.getElementById('medicalCityIntroVideoClose');
        if (medicalVideoCloseButton) {
            medicalVideoCloseButton.onclick = () => finishMedicalCityIntroVideo(false);
        }
        const sportsVideoCloseButton = document.getElementById('sportsIntroVideoClose');
        if (sportsVideoCloseButton) {
            sportsVideoCloseButton.onclick = () => finishSportsIntroVideo(false);
        }
        const sportsVideoSkipButton = document.getElementById('sportsIntroVideoSkip');
        if (sportsVideoSkipButton) {
            sportsVideoSkipButton.onclick = () => finishSportsIntroVideo(true);
        }
        const medicalVideoSkipButton = document.getElementById('medicalCityIntroVideoSkip');
        if (medicalVideoSkipButton) {
            medicalVideoSkipButton.onclick = () => finishMedicalCityIntroVideo(true);
        }
        const portVideoCloseButton = document.getElementById('portDialogueVideoClose');
        if (portVideoCloseButton) {
            portVideoCloseButton.onclick = finishPortDialogueVideo;
        }
        const portVideoSkipButton = document.getElementById('portDialogueVideoSkip');
        if (portVideoSkipButton) {
            portVideoSkipButton.onclick = finishPortDialogueVideo;
        }
        window.showMedicalCityFoodTable = showMedicalCityFoodTable;
        window.playMedicalCityIntroVideo = playMedicalCityIntroVideo;
        window.startMedicalCityStage1 = startMedicalCityStage1;
        window.startSportsStage = startSportsStage;
        window.startPortStage = startPortStage;
        window.startForestStage = startForestStage;
        window.returnToHealthContinent = returnToHealthContinent;
        window.finishMedicalCityIntroVideo = finishMedicalCityIntroVideo;
        window.playSportsIntroVideo = playSportsIntroVideo;
        window.finishSportsIntroVideo = finishSportsIntroVideo;
        window.playPortDialogueVideo = playPortDialogueVideo;
        window.finishPortDialogueVideo = finishPortDialogueVideo;
    }

    function renderOptionsGrid(options) {
        if (!optionsGrid) return;
        optionsGrid.innerHTML = '';
        const stageData = currentUnitConf && currentUnitConf.stages
            ? currentUnitConf.stages[currentStage]
            : null;
        const isCurriculum03 = activeUnit.includes('curriculum_03') || activeUnit === 'curriculum_03' || activeUnit === 'unit_curriculum_03';
        const currentModNum = isCurriculum03
            ? (getCurriculum03DisplayModuleNumber(activeUnit, currentStage) || currentStage)
            : 0;

        const isProteinQuestion = isCurriculum03 && (currentModNum === 6);
        const isBulimiaQuestion = isCurriculum03 && (currentModNum === 4);
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
        const choiceHeaderPromptEl = document.getElementById('choiceHeaderPrompt');
        const dialogIndicatorEl = document.getElementById('dialogIndicator');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const proteinOverlay = stageBackdrop && stageBackdrop.querySelector('.protein-options-overlay');
        if (proteinOverlay) proteinOverlay.remove();
        const bulimiaOverlay = stageBackdrop && stageBackdrop.querySelector('.bulimia-options-overlay');
        if (bulimiaOverlay) bulimiaOverlay.remove();
        if (stageBackdrop) stageBackdrop.classList.remove('protein-question-theme', 'protein-answer-revealed', 'bulimia-question-theme');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.toggle('hidden', !!(isProteinQuestion || isBulimiaQuestion));
        if (isKidneyStage3IntroTarget()) {
            const isIntroPending = kidneyStage3IntroPending;
            optionsGrid.classList.toggle('hidden', isIntroPending);
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.toggle('hidden', isIntroPending);
            if (bottomPanel) bottomPanel.classList.toggle('hidden', isIntroPending);
        }
        if (isKidneyStage4IntroTarget()) {
            const isIntroPending = kidneyStage4IntroPending;
            optionsGrid.classList.toggle('hidden', isIntroPending);
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.toggle('hidden', isIntroPending);
            if (bottomPanel) bottomPanel.classList.toggle('hidden', isIntroPending);
        }
        if (choiceHeaderPromptEl) {
            if (isProteinQuestion) {
                choiceHeaderPromptEl.textContent = '🎯 請點選上方蛋白質圖案作答';
            } else if (isBulimiaQuestion) {
                choiceHeaderPromptEl.textContent = '🎯 請點選上方四個圖片 ABCD 作答';
            } else {
                choiceHeaderPromptEl.textContent = '🎯 請點選您的答案 (手機即時投票)：';
            }
        }
        if (isProteinQuestion && dialogIndicatorEl) {
            dialogIndicatorEl.textContent = '💡 點選上方四種蛋白質圖案進行即時投票';
        } else if (isBulimiaQuestion && dialogIndicatorEl) {
            dialogIndicatorEl.textContent = '💡 點選上方背景 ABCD 四格截圖進行即時投票';
        }
        if (isProteinQuestion && stageBackdrop) {
            stageBackdrop.classList.add('protein-question-theme');
            const overlay = document.createElement('div');
            overlay.className = 'protein-options-overlay';
            overlay.setAttribute('aria-label', '蛋白質圖片選項');
            const proteinInfo = {
                '1': { img: 'assets/protein_albumin.png', name: '白蛋白 Albumin', cls: 'protein-option-albumin' },
                '2': { img: 'assets/protein_keratin.png', name: '角蛋白 Keratin', cls: 'protein-option-keratin' },
                '3': { img: 'assets/protein_ferritin.png', name: '鐵蛋白 Ferritin', cls: 'protein-option-ferritin' },
                '4': { img: 'assets/protein_globulin.png', name: '球蛋白 Globulin', cls: 'protein-option-globulin' }
            };
            const isAnswerLocked = !isTeacher && (teacherStageRevealed || isStageLocked);
            options.forEach((opt) => {
                const info = proteinInfo[String(opt.key)] || { img: 'assets/protein_albumin.png', name: opt.text, cls: '' };
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `protein-option-hotspot ${info.cls}`;
                button.dataset.key = opt.key;
                button.setAttribute('aria-label', `${opt.text}，${opt.score}`);
                button.innerHTML = `
                    <div class="protein-card-inner">
                        <img src="${info.img}" class="protein-card-img" alt="${info.name}" draggable="false" />
                    </div>
                    <span class="protein-option-votes">
                        <span class="choice-pct-pill">0.0%</span>
                        <span class="choice-votes-cnt">0人</span>
                    </span>
                    <span class="protein-answer-state" aria-hidden="true"></span>
                `;
                if (String(opt.key) === String(studentSelectedOption)) {
                    button.classList.add('selected');
                }
                if (isAnswerLocked) {
                    button.disabled = true;
                    button.classList.add('disabled-lock');
                }
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    selectOption(opt.key);
                });
                overlay.appendChild(button);
            });
            stageBackdrop.appendChild(overlay);
            // 公布答案後若因輪詢而重新建立圖卡，需立即恢復正確／錯誤顏色。
            applyAnswerRevealStyles(stageData, teacherStageRevealed || isStageLocked);
            return;
        }
        if (isBulimiaQuestion && stageBackdrop) {
            stageBackdrop.classList.add('bulimia-binge-theme', 'bulimia-question-theme');
            const overlay = document.createElement('div');
            overlay.className = 'bulimia-options-overlay';
            overlay.setAttribute('aria-label', '暴食症 ABCD 四格選項');
            const bulimiaLabels = {
                '1': { label: '選項 A', text: '重複暴食 (大量進食)', cls: 'bulimia-opt-a' },
                '2': { label: '選項 B', text: '體重顯著下降', cls: 'bulimia-opt-b' },
                '3': { label: '選項 C', text: '催吐／瀉劑／貧血', cls: 'bulimia-opt-c' },
                '4': { label: '選項 D', text: '皮膚乾燥／營養補充', cls: 'bulimia-opt-d' }
            };
            const isAnswerLocked = !isTeacher && (teacherStageRevealed || isStageLocked);
            options.forEach((opt) => {
                const info = bulimiaLabels[String(opt.key)] || { label: opt.score || ('選項 ' + opt.key), text: opt.text, cls: '' };
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'bulimia-option-hotspot ' + info.cls;
                button.dataset.key = opt.key;
                button.setAttribute('aria-label', info.label + '：' + opt.text);
                button.innerHTML = `
                    <div class="bulimia-hotspot-top">
                        <span class="bulimia-hotspot-badge">${info.label}</span>
                    </div>
                    <div class="bulimia-hotspot-bottom">
                        <span class="bulimia-option-votes">
                            <span class="choice-pct-pill">0.0%</span>
                            <span class="choice-votes-cnt">0人</span>
                        </span>
                    </div>
                    <span class="bulimia-answer-state" aria-hidden="true"></span>
                `;
                if (String(opt.key) === String(studentSelectedOption)) {
                    button.classList.add('selected');
                }
                if (isAnswerLocked) {
                    button.disabled = true;
                    button.classList.add('disabled-lock');
                }
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    selectOption(opt.key);
                });
                overlay.appendChild(button);
            });
            stageBackdrop.appendChild(overlay);
            applyAnswerRevealStyles(stageData, teacherStageRevealed || isStageLocked);
            return;
        }
        const isStage5Enlarged = (activeUnit === 'must' || activeUnit === 'intro') && currentStage === 5;
        const isAnswerLocked = !isTeacher && (teacherStageRevealed || isStageLocked);
        options.forEach((opt) => {
            const btn = document.createElement('div');
            btn.className = isStage5Enlarged ? 'rpg-choice-btn stage-large-options' : 'rpg-choice-btn';
            btn.dataset.key = opt.key;

            const hasDistinctText = opt.text && opt.text.trim() && opt.text.trim() !== opt.score.trim();
            const badgeHtml = hasDistinctText ? `<span class="choice-score-badge">${opt.score}</span>` : '';
            const textHtml = `<span class="choice-text">${hasDistinctText ? opt.text : (opt.text || opt.score)}</span>`;

            btn.innerHTML = `
                <div class="vote-bar-fill" id="fill_${opt.key}"></div>
                <div class="choice-left">
                    ${badgeHtml}
                    ${textHtml}
                </div>
                <div class="choice-right">
                    <span class="highest-crown hidden" id="crown_${opt.key}">👑</span>
                    <span class="choice-pct-pill" id="pct_${opt.key}">0%</span>
                    <span class="choice-votes-cnt" id="cnt_${opt.key}">(0票)</span>
                </div>
            `;

            if (isAnswerLocked) {
                btn.classList.add('disabled-lock');
                btn.style.pointerEvents = 'none';
            }
            if (String(opt.key) === String(studentSelectedOption)) {
                btn.classList.add('selected');
            }
            btn.addEventListener('click', () => {
                selectOption(opt.key);
            });

            optionsGrid.appendChild(btn);
        });
        applyFontScale(currentFontScale);
        applyAnswerRevealStyles(stageData, teacherStageRevealed || isStageLocked);
    }

    // 將公布答案後的正確／錯誤視覺狀態集中處理，避免重新 render 選項時遺失。
    function applyAnswerRevealStyles(stageData, answerRevealed) {
        if (!answerRevealed || !stageData || stageData.correctKey === undefined || stageData.correctKey === null) {
            return;
        }

        if (stageBackdrop && stageBackdrop.classList.contains('protein-question-theme')) {
            stageBackdrop.classList.add('protein-answer-revealed');
        }

        const correctKey = String(stageData.correctKey);
        const setAnswerState = (element) => {
            const isCorrect = String(element.dataset.key) === correctKey;
            element.classList.toggle('is-correct-answer', isCorrect);
            element.classList.toggle('is-wrong-answer', !isCorrect);
            element.setAttribute('data-answer-state', isCorrect ? 'correct' : 'wrong');
        };

        document.querySelectorAll(
            '.rpg-choice-btn[data-key], .protein-option-hotspot[data-key], .bulimia-option-hotspot[data-key], ' +
            '.scifi-opt-btn[data-key], .arcane-opt-btn[data-key], .table-food-item[data-key], .kidney-portal-zone[data-key]'
        ).forEach(setAnswerState);

        if (typeof applyKidneyMobaAnswerReveal === 'function') {
            applyKidneyMobaAnswerReveal(correctKey, answerRevealed);
        }

        document.querySelectorAll('.scifi-opt-btn[data-key]').forEach(button => {
            const isCorrect = String(button.dataset.key) === correctKey;
            button.classList.toggle('scifi-correct', isCorrect);
        });
        document.querySelectorAll('.arcane-opt-btn[data-key]').forEach(button => {
            const isCorrect = String(button.dataset.key) === correctKey;
            button.classList.toggle('rune-correct', isCorrect);
        });
        document.querySelectorAll('.table-food-item[data-key]').forEach(item => {
            const isCorrect = String(item.dataset.key) === correctKey;
            item.classList.toggle('correct-food-pulse', isCorrect);
            item.classList.toggle('wrong-food-shake', !isCorrect);
        });
    }

    function setSupportStage10AnatomyVisible(visible) {
        const map = document.getElementById('supportStage10Anatomy');
        const backdrop = document.getElementById('stageBackdrop');
        if (!map) return;

        map.classList.toggle('hidden', !visible);
        if (!visible) {
            map.classList.remove('answer-revealed');
        }
        map.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (backdrop) {
            const wasStage10Backdrop = backdrop.classList.contains('support-stage10-theme');
            backdrop.classList.toggle('support-stage10-theme', visible);
            if (visible) {
                backdrop.classList.remove('icu-aspiration-theme');
                backdrop.style.removeProperty('background-image');
                backdrop.style.removeProperty('background-size');
                backdrop.style.removeProperty('background-position');
                backdrop.style.removeProperty('background-repeat');
            } else if (wasStage10Backdrop) {
                backdrop.style.removeProperty('background-image');
                backdrop.style.removeProperty('background-size');
                backdrop.style.removeProperty('background-position');
                backdrop.style.removeProperty('background-repeat');
            }
        }
        const legacyNgHud = document.getElementById('sciFiNgHudWidget');
        if (legacyNgHud) {
            legacyNgHud.classList.toggle('hidden',
                visible || activeUnit !== 'support' || Number(currentStage) !== 1);
        }
        const patientBannerEl = document.getElementById('patientBanner');
        if (patientBannerEl && activeUnit === 'support') {
            patientBannerEl.classList.toggle('hidden', visible);
        }
        map.querySelectorAll('.support-stage10-hotspot').forEach(button => {
            if (button.dataset.bound !== 'true') {
                button.addEventListener('click', () => selectOption(button.dataset.key));
                button.dataset.bound = 'true';
            }
            if (!visible) {
                button.disabled = false;
                button.classList.remove('selected', 'is-correct-answer', 'is-wrong-answer', 'is-dimmed', 'highest-voted');
                button.setAttribute('aria-pressed', 'false');
            }
        });
        const status = document.getElementById('supportStage10AnatomyStatus');
        if (!visible && status) status.textContent = '點選圖片中的部位作答';
        if (visible && optionsGrid) optionsGrid.classList.add('hidden');
    }

    function updateSupportStage10AnatomySelection(selectedKey, correctKey, answerRevealed) {
        const map = document.getElementById('supportStage10Anatomy');
        if (!map) return;
        map.classList.toggle('answer-revealed', answerRevealed);

        const resolvedCorrectKey = correctKey === null || correctKey === undefined || correctKey === ''
            ? MODULE_TEMPLATES.SUPPORT_STAGE_10.correctKey
            : String(correctKey);
        let selectedName = '';
        let correctName = '';
        map.querySelectorAll('.support-stage10-hotspot').forEach(button => {
            const key = String(button.dataset.key);
            const selected = selectedKey !== null && selectedKey !== undefined && key === String(selectedKey);
            const correct = answerRevealed && key === resolvedCorrectKey;
            const wrong = answerRevealed && key !== resolvedCorrectKey;
            button.classList.toggle('selected', selected);
            button.classList.toggle('is-correct-answer', correct);
            button.classList.toggle('is-wrong-answer', wrong);
            button.classList.toggle('is-dimmed', answerRevealed && !correct);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
            button.disabled = !isTeacher && answerRevealed;
            if (selected) selectedName = button.querySelector('span').textContent;
            if (correct) correctName = button.querySelector('span').textContent;
        });

        const status = document.getElementById('supportStage10AnatomyStatus');
        if (!status) return;
        if (selectedName) {
            status.textContent = answerRevealed
                ? (String(selectedKey) === resolvedCorrectKey
                    ? `已選擇：${selectedName}（正確）`
                    : `已選擇：${selectedName}；正確答案：${correctName}`)
                : `已選擇：${selectedName}`;
        } else {
            status.textContent = answerRevealed && correctName
                ? `正確答案：${correctName}`
                : '點選圖片中的部位作答';
        }
    }

    let supportStage7FeedingActive = false;

    function resetFormulaFeedingAnimation() {
        formulaFeedingAnimationPlayed = false;
        if (formulaFeedingAnimationTimer) {
            clearTimeout(formulaFeedingAnimationTimer);
            formulaFeedingAnimationTimer = null;
        }
        document.querySelectorAll('.formula-drag-ghost').forEach(g => g.remove());
        const animation = document.getElementById('formulaFeedingAnimation');
        if (animation) {
            animation.classList.add('hidden');
            animation.removeAttribute('src');
        }
    }

    function playFormulaFeedingAnimation() {
        if (activeUnit !== 'support' || currentStage !== 7 || formulaFeedingAnimationPlayed) return;
        const animation = document.getElementById('formulaFeedingAnimation');
        if (!animation) return;

        formulaFeedingAnimationPlayed = true;
        if (formulaFeedingAnimationTimer) clearTimeout(formulaFeedingAnimationTimer);

        const animationSrc = isTeacher || selectedGender === 'male'
            ? 'assets/patient_ng_feeding_male.gif'
            : 'assets/patient_ng_feeding_female.gif';
        const hideAfterOnePlay = () => {
            animation.classList.add('hidden');
            formulaFeedingAnimationTimer = null;
        };
        animation.onload = () => {
            animation.classList.remove('hidden');
            formulaFeedingAnimationTimer = setTimeout(hideAfterOnePlay, 6100);
        };
        animation.src = animationSrc;
        animation.classList.remove('hidden');
        // 已快取的 GIF 可能不再觸發 onload，仍以一個完整動畫週期後隱藏。
        if (animation.complete) {
            formulaFeedingAnimationTimer = setTimeout(hideAfterOnePlay, 6100);
        }
    }

    function activateSupportStage7Feeding(stageData) {
        if (activeUnit !== 'support' || currentStage !== 7) return;
        supportStage7FeedingActive = true;
        const tray = document.getElementById('formulaBottleChoices');
        const dropZone = document.getElementById('formulaPatientDropZone');
        const charNurseEl = document.getElementById('charNurse');
        const dialogBoxEl = document.getElementById('dialogBox');
        const optionsGridEl = document.getElementById('optionsGrid');
        const rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
        const backdrop = document.getElementById('stageBackdrop');
        
        if (charNurseEl) charNurseEl.classList.add('hidden');
        if (dialogBoxEl) dialogBoxEl.classList.add('hidden');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');
        if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        
        if (backdrop) {
            backdrop.classList.add('formula-feeding-stage');
        }
        if (tray) tray.classList.remove('hidden');
        if (dropZone) dropZone.classList.remove('hidden');
    }

    function hideSupportStage7FeedingTarget() {
        const dropZone = document.getElementById('formulaPatientDropZone');
        const backdrop = document.getElementById('stageBackdrop');
        if (dropZone) dropZone.classList.add('hidden');
        if (backdrop) backdrop.classList.add('formula-answer-revealed');
    }

    function renderFormulaFeedingChallenge(stageData) {
        const isFormulaStage = activeUnit === 'support' && currentStage === 7;
        const tray = document.getElementById('formulaBottleChoices');
        const dropZone = document.getElementById('formulaPatientDropZone');
        const grid = document.getElementById('optionsGrid');
        const backdrop = document.getElementById('stageBackdrop');
        if (!tray || !dropZone || !grid || !backdrop) return;
        
        if (!isFormulaStage) {
            supportStage7FeedingActive = false;
            tray.classList.add('hidden');
            dropZone.classList.add('hidden');
            backdrop.classList.remove('formula-wrong-outcome', 'formula-feeding-stage', 'formula-answer-revealed');
            ['position', 'z-index', 'top', 'bottom', 'left', 'width', 'display', 'grid-template-columns', 'gap', 'padding', 'pointer-events'].forEach((name) => tray.style.removeProperty(name));
            ['left', 'top', 'width', 'height', 'z-index', 'pointer-events'].forEach((name) => dropZone.style.removeProperty(name));
            return;
        }

        // 題目朗讀中：初始隱藏配方瓶與拖曳區，顯示營養師與對話框；待朗讀結束或點擊後才啟動灌食操作
        supportStage7FeedingActive = false;
        tray.classList.add('hidden');
        dropZone.classList.add('hidden');
        backdrop.classList.add('formula-feeding-stage');
        if (charNurse) {
            charNurse.classList.remove('hidden', 'inactive');
            charNurse.classList.add('speaking');
        }
        if (dialogBox) {
            dialogBox.classList.remove('hidden');
        }
        if (dialogIndicator) {
            dialogIndicator.textContent = '🔊 正在朗讀題目...（點擊對話框可立即進入配方灌食 ➔）';
        }

        grid.classList.add('hidden');
        tray.innerHTML = '';
        const bottles = [
            { key: '1', name: '元素或預解配方', image: 'assets/formula_elemental.png?v=20260926-stage7-cutout-1' },
            { key: '2', name: '低纖維聚合配方', image: 'assets/formula_low_fiber.png?v=20260926-stage7-cutout-1' },
            { key: '3', name: '高水溶性纖維配方', image: 'assets/formula_soluble_fiber.png?v=20260926-stage7-cutout-1' },
            { key: '4', name: '高蛋白濃縮配方', image: 'assets/formula_high_protein.png?v=20260927-repaired-1' }
        ];

        const chooseBottle = (key) => {
            if (isStageLocked || teacherStageRevealed || alreadyRevealedThisStage) {
                return;
            }
            // 清除任何殘留的拖曳 ghost
            document.querySelectorAll('.formula-drag-ghost').forEach(g => g.remove());

            tray.querySelectorAll('.formula-bottle-card').forEach(card => {
                card.classList.toggle('selected', card.dataset.key === key);
                // 學生完成作答後即鎖定無法再拖曳或點選
                if (!isTeacher) {
                    card.classList.add('disabled-lock');
                    card.style.pointerEvents = 'none';
                }
            });
            selectOption(key);

            // 灌食目標視覺回饋 (點選/拖曳成功標記)
            dropZone.classList.add('feeding-success');
            window.setTimeout(() => dropZone.classList.remove('feeding-success'), 800);

            // 僅在教師已公布答案狀態下，才立即播放灌食動畫並反映病況；公布前僅記錄作答等待教師公布
            if (teacherStageRevealed || alreadyRevealedThisStage || isStageLocked) {
                playFormulaFeedingAnimation();
                if (key !== String(stageData.correctKey || '1')) {
                    backdrop.classList.add('formula-wrong-outcome');
                    backdrop.style.setProperty('background-image', "url('assets/rpg_bg_tube_feeding_diarrhea.png')", 'important');
                    backdrop.style.setProperty('background-size', 'cover', 'important');
                    backdrop.style.setProperty('background-position', 'center center', 'important');
                    if (charNurse) charNurse.classList.add('hidden');
                    if (charStudent) charStudent.classList.add('hidden');
                    if (dialogBox) dialogBox.classList.remove('hidden');
                    if (speakerBadge) speakerBadge.textContent = '【病情惡化警示】';
                    if (dialogContent) dialogContent.innerHTML = '<strong style="color:#f87171; font-size:15.5px;">⚠️ 錯誤配方引發嚴重腹瀉，病人營養流失加劇！</strong><div style="margin-top:6px; color:#fef08a; font-size:14.5px; line-height:1.5;">💡 <strong>臨床解析：</strong>放射性腸炎造成腸道黏膜受損，應選用預先水解之<strong>【元素/預解配方】</strong>（含雙生肽與游離胺基酸），無需酵素分解即可直接吸收！</div>';
                    if (dialogIndicator) dialogIndicator.textContent = '💡 臨床解析：請選用小分子元素配方 ➔';
                } else {
                    backdrop.classList.remove('formula-wrong-outcome');
                    backdrop.style.setProperty('background-image', "url('assets/rpg_bg_support_stage7_correct.jpg')", 'important');
                    backdrop.style.setProperty('background-size', 'cover', 'important');
                    backdrop.style.setProperty('background-position', 'center center', 'important');
                    if (dialogBox) dialogBox.classList.remove('hidden');
                    if (speakerBadge) speakerBadge.textContent = '【臨床處置成功】';
                    if (dialogContent) dialogContent.innerHTML = '<strong style="color:#86efac; font-size:15.5px;">✅ 決策正確！元素或預解配方已送達病人。</strong><div style="margin-top:6px; color:#f8fafc; font-size:14.5px; line-height:1.5;">💡 <strong>臨床重點：</strong>雙生肽與游離胺基酸可直接被受損小腸吸收，有效改善放射性腸炎之腹瀉與吸收不良！</div>';
                    if (dialogIndicator) dialogIndicator.textContent = '🎉 決策正確！等待教師推進至下一題 ➔';
                }
            } else {
                // 教師尚未公布答案：保持原病房場景，不切換惡化或康復畫面
                backdrop.classList.remove('formula-wrong-outcome');
                backdrop.style.removeProperty('background-image');
                backdrop.style.removeProperty('background-size');
                backdrop.style.removeProperty('background-position');
            }
        };

        bottles.forEach((bottle) => {
            const card = document.createElement('div');
            card.className = 'formula-bottle-card';
            card.dataset.key = bottle.key;
            card.draggable = false;
            card.innerHTML = `<img src="${bottle.image}" alt="${bottle.name}"><span class="formula-vote-stat" data-vote-key="${bottle.key}">0.0% (0票)</span><span>${bottle.name}</span>`;
            
            // 若學生已經作答過或已鎖定，初始即設定為鎖定不可拖曳
            if (!isTeacher && studentSelectedOption !== null && studentSelectedOption !== undefined) {
                card.classList.add('disabled-lock');
                card.style.pointerEvents = 'none';
            }

            // 點選配方瓶即可直接灌食
            card.addEventListener('click', (e) => {
                if (isStageLocked || teacherStageRevealed || alreadyRevealedThisStage || (!isTeacher && studentSelectedOption !== null && studentSelectedOption !== undefined)) {
                    return;
                }
                chooseBottle(bottle.key);
            });

            // 拖曳配方瓶至右上角病人區
            card.addEventListener('pointerdown', (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                // 若已作答、已鎖定或已公布答案時，嚴禁啟動拖曳
                if (isStageLocked || teacherStageRevealed || alreadyRevealedThisStage || (!isTeacher && studentSelectedOption !== null && studentSelectedOption !== undefined)) {
                    event.preventDefault();
                    return;
                }
                const pointerId = event.pointerId;
                const startX = event.clientX, startY = event.clientY;
                let ghost = null;
                let moved = false;
                try { card.setPointerCapture(pointerId); } catch (e) {}

                const onMove = (moveEvent) => {
                    if (moveEvent.pointerId !== pointerId) return;
                    if (isStageLocked || teacherStageRevealed || alreadyRevealedThisStage || (!isTeacher && studentSelectedOption !== null && studentSelectedOption !== undefined)) {
                        cleanup();
                        return;
                    }
                    if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 8) {
                        moved = true;
                        document.querySelectorAll('.formula-drag-ghost').forEach(g => g.remove());
                        ghost = card.querySelector('img').cloneNode();
                        ghost.className = 'formula-drag-ghost';
                        document.body.appendChild(ghost);
                    }
                    if (ghost) {
                        ghost.style.left = `${moveEvent.clientX - 45}px`;
                        ghost.style.top = `${moveEvent.clientY - 60}px`;
                        const rect = dropZone.getBoundingClientRect();
                        dropZone.classList.toggle('drag-over', moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right && moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom);
                    }
                };

                const cleanup = () => {
                    window.removeEventListener('pointermove', onMove, true);
                    window.removeEventListener('pointerup', onUp, true);
                    window.removeEventListener('pointercancel', onCancel, true);
                    dropZone.classList.remove('drag-over');
                    if (ghost) {
                        ghost.remove();
                        ghost = null;
                    }
                    document.querySelectorAll('.formula-drag-ghost').forEach(g => g.remove());
                };

                const onUp = (upEvent) => {
                    if (upEvent.pointerId !== pointerId) return;
                    if (moved && ghost) {
                        const rect = dropZone.getBoundingClientRect();
                        const didDrop = upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom;
                        if (!didDrop) {
                            cleanup();
                            return;
                        }
                        ghost.style.transition = 'left .35s ease, top .35s ease, transform .35s ease, opacity .35s ease';
                        ghost.style.left = `${rect.left + rect.width / 2 - 45}px`;
                        ghost.style.top = `${rect.top + rect.height / 2 - 60}px`;
                        ghost.style.transform = 'scale(.38) rotate(12deg)';
                        ghost.style.opacity = '.25';
                        dropZone.classList.add('feeding-success');
                        window.setTimeout(() => {
                            cleanup();
                            chooseBottle(bottle.key);
                        }, 360);
                    } else {
                        cleanup();
                    }
                };

                const onCancel = (cancelEvent) => {
                    if (cancelEvent.pointerId !== pointerId) return;
                    cleanup();
                };

                window.addEventListener('pointermove', onMove, true);
                window.addEventListener('pointerup', onUp, true);
                window.addEventListener('pointercancel', onCancel, true);
            });

            tray.appendChild(card);
        });
    }

    // ==============================================
    // 關卡題目渲染與選擇 (依單元動態載入)
    // ==============================================
    
    // ==============================================
    // 全域模組題型樣板庫 (支援任意題目跨單元移動時 100% 動態連動)
    // ==============================================
    const MODULE_TEMPLATES = {
        'MUST_CASE_1': {
            speaker: "護理師 林語柔",
            speakerRole: "nurse",
            nurseImg: "assets/nurse_bust.png",
            nurseTag: "護理師 林語柔",
            backdrop: "assets/rpg_bg_ward.jpg",
            voicePath: "assets/voice/must_stage1.mp3",
            speech: "奶奶身高 155 cm，目前體重 46.0 kg。<br>請依據<strong>營養不良篩選工具 (MUST)</strong> 進行評估，計算 BMI 區間並選擇正確得分：",
            correctKey: "2",
            options: [
                { key: "1", score: "0 分", text: "BMI > 20" },
                { key: "2", score: "1 分", text: "BMI = 18.5 ~ 20" },
                { key: "3", score: "2 分", text: "BMI < 18.5" }
            ],
            revealExplanation: "BMI = 46 / (1.55 × 1.55) ≈ 19.15 kg/m²，介於 18.5 ~ 20 之間，依據 MUST 臨床指標判定得分為【1 分】（選項 2）！"
        },
        'MUST_CASE_2': {
            speaker: "護理師 林語柔",
            speakerRole: "nurse",
            nurseImg: "assets/nurse_bust.png",
            nurseTag: "護理師 林語柔",
            backdrop: "assets/rpg_bg_ward.jpg",
            voicePath: "assets/voice/must_stage2.mp3",
            speech: "林奶奶常態體重 58.0 kg，入院降至 46.0 kg。<br><span style=\"display:inline-block;white-space:nowrap;\">請計算近 3-6 個月非計畫性體重流失百分比並判定 MUST 得分：</span>",
            correctKey: "3",
            options: [
                { key: "1", score: "0 分", text: "流失百分比 < 5%" },
                { key: "2", score: "1 分", text: "流失百分比 5% ~ 10%" },
                { key: "3", score: "2 分", text: "流失百分比 > 10%" }
            ],
            revealExplanation: "體重流失率 = (58 - 46) / 58 = 12 / 58 ≈ 20.69% (>10%)，依據 MUST 臨床指標判定得分為【2 分】（選項 3）！"
        },
        'MUST_CASE_3': {
            speaker: "護理師 林語柔",
            speakerRole: "nurse",
            nurseImg: "assets/nurse_bust.png",
            nurseTag: "護理師 林語柔",
            backdrop: "assets/rpg_bg_ward.jpg",
            voicePath: "assets/voice/must_stage3.mp3",
            speech: '<span style="letter-spacing:-0.25px;">林奶奶剛完成胃癌全胃切除重大手術，醫囑明訂禁食 NPO 預期超過 5 天。</span><br>依據 MUST 臨床指引，<strong>急性疾病導致禁食 ≧ 5天</strong>時應加計幾分？',
            correctKey: "3",
            options: [
                { key: "1", score: "加0分", text: "加0分" },
                { key: "2", score: "加1分", text: "加1分" },
                { key: "3", score: "加2分", text: "加2分" }
            ],
            revealExplanation: "重大手術合併禁食 NPO 預期 > 5 天，符合 MUST 第 3 步急性疾病加分指引，應加計【2 分】（選項 3）！"
        },
        'MUST_CASE_4': {
            speaker: "護理師 林語柔",
            speakerRole: "nurse",
            nurseImg: "assets/nurse_bust.png",
            nurseTag: "護理師 林語柔",
            backdrop: "assets/rpg_bg_ward.jpg",
            voicePath: "assets/voice/must_stage4.mp3",
            speech: "請依據前述三項指標得分累計，判定林奶奶之<strong>營養不良風險等級</strong>：",
            correctKey: "3",
            options: [
                { key: "1", score: "0 分", text: "低度風險 (Low Risk)" },
                { key: "2", score: "1 分", text: "中度風險 (Medium Risk)" },
                { key: "3", score: "≧ 2 分", text: "高度風險 (High Risk)" }
            ],
            revealExplanation: "林奶奶 MUST 三項得分合計：BMI(1) + 體重流失(2) + 疾病禁食(2) = 5 分 ≧ 2 分，判定為【高度風險 (High Risk)】！正確答案為選項【3】！"
        },
        'SUPPORT_STAGE_1': {
            speaker: "【系統監控中樞 ‧ 艦載終端】",
            speakerRole: "scifi",
            nurseImg: "assets/scifi_officer_bust.png",
            nurseTag: "系統監控中樞 ‧ 艦載終端",
            voicePath: "assets/voice/support_stage1_v2.mp3",
            speech: "⚠️ 系統告警：醫療艙「休眠探員」的鼻胃管回報故障，請立即將監控中樞回報的故障清單內容：<br><strong>下列何者不是病人裝置鼻胃管常見的合併症？</strong>",
            correctKey: "4",
            isNgHudStage: true,
            options: [
                { key: "1", score: "選項 1", text: "胃食道逆流引發吸入性肺炎" },
                { key: "2", score: "選項 2", text: "鼻黏膜損傷及出血" },
                { key: "3", score: "選項 3", text: "胃潰瘍" },
                { key: "4", score: "選項 4", text: "導管插入部位出現滲漏" }
            ],
            revealExplanation: "鼻胃管（NG-01）是經由鼻腔天然孔道置入胃部，體表並無外科手術造瘻創口！「導管插入部位出現滲漏」屬於胃造瘻（PEG）或空腸造瘻等外科造瘻口的常見合併症，物理結構上不可能發生於鼻胃管！修復技師成功排除幽靈故障！獲得 250 分！"
        },
        'SUPPORT_STAGE_2': {
            speaker: "【加護醫學部 趙仁傑 主治醫師】",
            speakerRole: "doctor",
            nurseImg: "assets/doctor_senior_bust.png",
            nurseTag: "加護醫學部 趙仁傑 主治醫師",
            backdrop: "assets/rpg_bg_icu_aspiration.jpg",
            voicePath: "assets/voice/support_stage2.mp3",
            speech: "<span style=\"color:#ffffff;\">鼻胃管灌食的重症病人，下列何者不是</span><strong style=\"color:#fef08a;\">降低 aspiration 風險</strong><span style=\"color:#ffffff;\">的最佳處置？</span>",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 1", text: "口腔清潔" },
                { key: "2", score: "選項 2", text: "抬高頭部" },
                { key: "3", score: "選項 3", text: "持續會厭下抽痰" },
                { key: "4", score: "選項 4", text: "檢查胃殘餘量" }
            ],
            revealExplanation: "依據 ASPEN/SCCM 重症營養指引，常規監測「胃殘餘量 (GRV)」並不能顯著降低吸入性肺炎風險，反而常導致灌食中斷與營養不足，故已不再列為首選最佳防護處置！抬高床頭 30~45°、落實口腔清潔與持續會厭下抽痰才是有效防範措施！判定正確！獲得 250 分！"
        },
        'SUPPORT_STAGE_3': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_icu_aspiration.jpg",
            voicePath: "assets/voice/support_stage3.mp3",
            speech: "有關腸道<strong style=\"color:#fef08a;\">營養支持路徑</strong>的選擇取決條件，下列何者<strong style=\"color:#fef08a;\">錯誤</strong>？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "病人是否臥床" },
                { key: "2", score: "選項 B", text: "是否計劃未來進行手術" },
                { key: "3", score: "選項 C", text: "需要腸道營養支持的時間長度" },
                { key: "4", score: "選項 D", text: "吸入性肺炎或餵食管移位的風險程度" }
            ],
            revealExplanation: "腸道營養支持（Enteral Nutrition, EN）管灌路徑的選擇取決條件包括：預期管灌時間長度（如短期 < 4~6週採經鼻置管，長期 > 4~6週採造瘻術）、胃腸道功能與解剖結構（是否計畫進行胃腸道手術）、以及吸入性肺炎逆流與管路移位的風險評估等；「病人是否臥床」並非決定胃管、空腸管或造瘻路徑的取決條件！故選項【A 病人是否臥床】敘述錯誤（符合題目挑錯所選）！"
        },
        'SUPPORT_STAGE_4': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_support_stage4.png",
            voicePath: "assets/voice/support_stage4.mp3",
            speech: "林先生 40 歲，體重 60 公斤，因中風使用鼻胃管灌食，除高血壓外無其他疾病，評估每日熱量需要 30 kcal/kg，下列有關灌食敘述何者錯誤？",
            correctKey: "3",
            options: [
                { key: "1", score: "選項 A", text: "使用 continuous feeding 時，可用全濃度灌食不需要稀釋配方" },
                { key: "2", score: "選項 B", text: "使用標準均衡配方（1 kcal/mL）時，每日需要提供 1,800 mL 才能達到熱量需要量" },
                { key: "3", score: "選項 C", text: "灌食配方需有 2%至 4%的熱量來自 MCT（medium-chain triglycerides）oil 才能避免必需脂肪酸缺乏" },
                { key: "4", score: "選項 D", text: "林先生水分的需要量每日約需 1,800~2,100 mL" }
            ],
            revealExplanation: "必需脂肪酸（EFA，如亞麻油酸 LA 與 α-次亞麻油酸 ALA）必須由長鏈脂肪酸（LCT）提供，中鏈三酸甘油酯（MCT oil）無法提供必需脂肪酸！故選項【C 灌食配方需有 2%至 4%熱量來自 MCT oil 才能避免必需脂肪酸缺乏】敘述錯誤（符合題目挑錯所選）！"
        },
        'SUPPORT_STAGE_5': {
            speaker: "【臨床營養總監 陸馳野】",
            speakerRole: "lu",
            nurseImg: "assets/director_lu_bust.png",
            nurseTag: "臨床營養總監 陸馳野",
            backdrop: "assets/rpg_bg_support_formula.png",
            voicePath: "assets/voice/support_stage5.mp3",
            speech: "下列何種營養素不是 elemental formula（元素配方）的組成分？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "casein 酪蛋白" },
                { key: "2", score: "選項 B", text: "dipeptides 雙生肽" },
                { key: "3", score: "選項 C", text: "MCT oil" },
                { key: "4", score: "選項 D", text: "maltodextrin 麥芽糊精" }
            ],
            revealExplanation: "元素配方（Elemental Formula / Monomeric Formula）中蛋白質來源為自由胺基酸（Free Amino Acids）或極小胜肽（Dipeptides / Tripeptides），不需要消化酶分解即可吸收；而酪蛋白（casein）為完整蛋白質（Intact Protein），屬於聚合配方（Polymeric Formula）之成分，非元素配方之組成分！故正確答案為選項【A casein 酪蛋白】！"
        },
        'SUPPORT_STAGE_6': {
            speaker: "【加護醫學部 趙仁傑 主治醫師】",
            speakerRole: "doctor",
            nurseImg: "assets/doctor_senior_bust.png",
            nurseTag: "加護醫學部 趙仁傑 主治醫師",
            backdrop: "assets/rpg_bg_icu_tpn.jpg",
            voicePath: "assets/voice/support_stage6.mp3",
            speech: "使用高濃度葡萄糖輸液的全靜脈營養病人，要避免突然中斷該輸液的原因為何？",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 A", text: "避免發生低血鈣" },
                { key: "2", score: "選項 B", text: "避免發生低血脂" },
                { key: "3", score: "選項 C", text: "避免發生低血壓" },
                { key: "4", score: "選項 D", text: "避免發生低血糖" }
            ],
            revealExplanation: "全靜脈營養（TPN）持續輸注高濃度葡萄糖輸液時，會刺激胰臟 β 細胞持續高額分泌胰島素；若突然中斷輸液，體內的高濃度高血糖來源消失，但血中高濃度胰島素尚未代謝降解，將導致急性【反彈性低血糖（Rebound Hypoglycemia）】！故要避免突然中斷輸液，正確答案為選項【D 避免發生低血糖】！"
        },
        'SUPPORT_STAGE_7': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_icu_aspiration.jpg",
            voicePath: "assets/voice/support_stage7.mp3",
            speech: "對於因治療產生放射性腸炎、吸收不良而導致腹瀉的癌症灌食患者，可使用下列何種類型配方？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "元素或預解配方" },
                { key: "2", score: "選項 B", text: "低纖維聚合配方" },
                { key: "3", score: "選項 C", text: "高水溶性纖維配方" },
                { key: "4", score: "選項 D", text: "高蛋白濃縮配方" }
            ],
            revealExplanation: "放射線治療引發之放射性腸炎（Radiation Enteritis）會造成腸道黏膜萎縮與消化吸收功能嚴重受損，此時給予【元素或預解配方（Elemental or Semi-elemental / Hydrolyzed Formula）】因其營養素已被預先水解為小胜肽、胺基酸與極低脂肪/MCT，不需大量消化酶即可直接由受損腸道吸收，可大幅降低腹瀉與營養不良！故正確答案為選項【A 元素或預解配方】！"
        },
        'SUPPORT_STAGE_8': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_icu_aspiration.jpg",
            voicePath: "assets/voice/support_stage8.mp3",
            speech: "有關<span style=\"color:#fef08a;font-weight:bold;\">再餵食症候群（refeeding syndrome）</span>的敘述，下列何者正確？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "原先營養狀態正常的嚴重外傷病人因病情及手術導致過去兩週幾無營養攝入，在開始灌食時也屬高風險族群" },
                { key: "2", score: "選項 B", text: "特別容易出現在接受高脂肪高熱量飲食的病人" },
                { key: "3", score: "選項 C", text: "典型的表現為「三低一高」，包括低血磷、低血鉀、低血糖及高血鎂" },
                { key: "4", score: "選項 D", text: "若發生再餵食症候群時，建議加快腸道或靜脈營養的給予速度，以矯正營養素的缺乏" }
            ],
            revealExplanation: "再餵食症候群可發生於原先營養狀態正常、但因嚴重外傷或手術而連續約兩週幾乎沒有營養攝入的病人；重新開始灌食後，胰島素上升會使磷、鉀、鎂快速進入細胞，造成低血磷、低血鉀與低血鎂，並可能伴隨高血糖。高脂肪高熱量本身不是典型風險條件；發生時應暫緩或降低營養速度、補充硫胺素並密切矯正電解質，不能加快給予。故正確答案為選項【A】。"
        },
        'SUPPORT_STAGE_9': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_support_formula.png",
            voicePath: "assets/voice/support_stage9.mp3",
            speech: "下列何類管灌食配方可提供均衡的營養，其蛋白質來源由酪蛋白、乳清蛋白或黃豆分離蛋白組成？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "polymeric formula" },
                { key: "2", score: "選項 B", text: "monomeric formula" },
                { key: "3", score: "選項 C", text: "modular formula" },
                { key: "4", score: "選項 D", text: "predigested formula" }
            ],
            revealExplanation: "Polymeric formula（聚合配方）提供完整且均衡的營養，蛋白質通常來自完整蛋白質，如酪蛋白、乳清蛋白或黃豆分離蛋白。故正確答案為選項【A polymeric formula】。"
        },
        'SUPPORT_STAGE_10': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/support_stage10_anatomy.jpg",
            voicePath: "assets/voice/support_stage10.mp3",
            speech: "相較於 parenteral nutrition，用 tube feeding 較有助於促進下列何者的 mucosal barrier function，降低細菌轉移（translocation）？",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 1", text: "口腔" },
                { key: "2", score: "選項 2", text: "食道" },
                { key: "3", score: "選項 3", text: "胃部" },
                { key: "4", score: "選項 4", text: "腸子" }
            ],
            revealExplanation: "腸道管灌營養（Tube Feeding / Enteral Nutrition）能直接提供腸道黏膜細胞營養，維持腸道黏膜屏障完整性（Mucosal Barrier Function）與免疫機能，防止腸道內細菌及其毒素穿透腸黏膜造成細菌轉位（Bacterial Translocation）；相較之下，全靜脈營養（PN）缺乏腸道腔內養分刺激，容易導致腸黏膜萎縮。故正確答案為選項【4 腸子】！"
        },
        'SUPPORT_STAGE_11': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_icu_aspiration.jpg",
            voicePath: "assets/voice/support_stage11.mp3",
            speech: "腸道營養與靜脈營養相較，下列敘述何者錯誤？",
            correctKey: "2",
            options: [
                { key: "1", score: "選項 1", text: "腸道營養較有助於保留小腸黏膜障蔽" },
                { key: "2", score: "選項 2", text: "腸道營養較容易發生感染性併發症" },
                { key: "3", score: "選項 3", text: "腸道營養較能減少異化作用" },
                { key: "4", score: "選項 4", text: "腸道營養較能節省醫療費用" }
            ],
            revealExplanation: "腸道營養（Enteral Nutrition, EN）相較於靜脈營養（Parenteral Nutrition, PN），能維持腸道黏膜結構與功能完整，其感染性併發症（如導管感染與敗血症）的發生率顯著「較低」，而非容易發生；同時腸道營養還具備促進免疫、減緩異化作用及大幅節省醫療花費等臨床優勢！故選項【2 腸道營養較容易發生感染性併發症】敘述錯誤（符合題目挑錯所選）！"
        },
        'NCP_STAGE_1': {
            speaker: "【臨床營養總監 陸馳野】",
            speakerRole: "lu",
            nurseImg: "assets/director_lu_bust.png",
            nurseTag: "臨床營養總監 陸馳野",
            backdrop: "assets/rpg_bg_seminar.jpg",
            voicePath: "assets/voice/ncp_stage1.mp3",
            speech: "<div style=\"font-size:15px;line-height:1.55;\"><span style=\"display:block;white-space:normal;overflow-wrap:anywhere;\">標準化營養照護程序（NCP）包含四大核心項目，下列何者正確？</span><span style=\"display:block;color:#fef08a;font-size:14px;white-space:normal;overflow-wrap:anywhere;\">①營養評估 ②營養監測與評值 ③營養介入 ④營養教育 ⑤營養診斷 ⑥營養諮商</span></div>",
            correctKey: "2",
            options: [
                { key: "1", score: "選項 1", text: "① ② ⑤ ⑥" },
                { key: "2", score: "選項 2", text: "① ② ③ ⑤" },
                { key: "3", score: "選項 3", text: "① ② ③ ④" },
                { key: "4", score: "選項 4", text: "① ② ④ ⑥" }
            ],
            revealExplanation: "NCP 四大核心步驟為：①營養評估 (Assessment) ➔ ⑤營養診斷 (Diagnosis) ➔ ③營養介入 (Intervention) ➔ ②營養監測與評值 (Monitoring and Evaluation)，故正確答案為選項【2】①②③⑤！"
        },
        'NCP_STAGE_2': {
            speaker: "【臨床營養總監 陸馳野】",
            speakerRole: "lu",
            nurseImg: "assets/director_lu_bust.png",
            nurseTag: "臨床營養總監 陸馳野",
            backdrop: "assets/rpg_bg_seminar.jpg",
            voicePath: "assets/voice/ncp_stage2.mp3",
            speech: "下列有關<strong>營養照護步驟（Nutrition Care Process, NCP）</strong>的說明何者<strong>錯誤</strong>？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 1", text: "以系統性蒐集、驗證、解釋數據釐清營養相關問題的是營養診斷（Nutrition Diagnosis）" },
                { key: "2", score: "選項 2", text: "營養評估（Nutrition Assessment）的目的是決定個案有一個或多個營養相關的問題" },
                { key: "3", score: "選項 3", text: "營養照護步驟的第二步驟為包含 PES 的營養診斷" },
                { key: "4", score: "選項 4", text: "食物相關的歷史、營養相關的歷史、體位測量都是營養評估的資料蒐集類別" }
            ],
            revealExplanation: "「以系統性蒐集、驗證、解釋數據釐清營養相關問題」是【營養評估 (Nutrition Assessment)】之核心定義，而非營養診斷！故選項【1】敘述錯誤（符合題目挑錯所選）！"
        },
        'DM_STAGE_1': {
            speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
            speakerRole: "doctor",
            voicePath: "assets/voice/dm_stage1.mp3",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "內分泌新陳代謝科 沈懷瑾 主任醫師",
            backdrop: "assets/rpg_bg_clinic.jpg",
            speech: "<strong style=\"color:#ffffff;\"><span style=\"color:#fef08a;\">第 1 型糖尿病</span>（Type 1 Diabetes Mellitus）主要<span style=\"color:#fef08a;\">病因機轉</span>為何？</strong>",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 1", text: "飲食不當與久坐" },
                { key: "2", score: "選項 2", text: "胰島素分泌上升" },
                { key: "3", score: "選項 3", text: "胰島素抗性" },
                { key: "4", score: "選項 4", text: "自體抗體攻擊胰島細胞" }
            ],
            revealExplanation: "第 1 型糖尿病 (T1DM) 核心機轉為自體免疫失調，體內產生自體抗體破壞胰臟胰島 β 細胞，導致胰島素絕對分泌不足！故正確答案為選項【4】自體抗體攻擊胰島細胞！"
        },
        'DM_STAGE_2': {
            speaker: "【⚔️ 糖化檢定勇者】",
            speakerRole: "warrior",
            nurseImg: "assets/warrior_hero.png",
            nurseTag: "⚔️ 糖化檢定男戰士",
            voicePath: "assets/voice/dm_stage2.mp3",
            backdrop: "assets/rpg_bg_dragon_battle.jpg",
            speech: "「🔥 黑炎魔龍狂暴來襲！請拖曳拉拉條設定糖尿病糖化血色素 (HbA1c) 診斷標準切點，點選蓄力出擊討伐黑炎魔龍！」",
            correctKey: "1",
            hasSliderBattle: true,
            sliderType: "a1c",
            correctVal: 6.5,
            isDragonBossStage: true,
            options: [
                { key: "1", score: "選項 1", text: "HbA1c ≥ 6.5%" },
                { key: "2", score: "選項 2", text: "HbA1c ≥ 6.0%" },
                { key: "3", score: "選項 3", text: "HbA1c ≥ 7.0%" },
                { key: "4", score: "選項 4", text: "HbA1c ≥ 5.7%" }
            ],
            revealExplanation: "依據最新糖尿病臨床指引，糖化血色素（HbA1c）≥ 6.5% 即達到糖尿病診斷標準！故正確答案為【HbA1c ≥ 6.5%】！"
        },
        'DM_STAGE_3': {
            speaker: "【⚔️ 晨曦破曉勇者】",
            speakerRole: "warrior",
            nurseImg: "assets/warrior_hero.png",
            nurseTag: "⚔️ 晨曦破曉男戰士",
            voicePath: "assets/voice/dm_stage3.mp3",
            backdrop: "assets/rpg_bg_ice_golem.jpg",
            speech: "「黎明拂曉，未進食的身體正處於最純粹的基準狀態。守護晨曦之門的冰晶巨神兵築起了高聳的血糖冰壁！請調校能量儀設定『空腹血漿葡萄糖（FPG）』的診斷標準切點，擊碎超標的冰晶結界！」",
            correctKey: "3",
            hasSliderBattle: true,
            sliderType: "fpg",
            correctVal: 126,
            isDragonBossStage: true,
            isIceColossusStage: true,
            options: [
                { key: "1", score: "選項 1", text: "FPG ≥ 100 mg/dL" },
                { key: "2", score: "選項 2", text: "FPG ≥ 110 mg/dL" },
                { key: "3", score: "選項 3", text: "FPG ≥ 126 mg/dL" },
                { key: "4", score: "選項 4", text: "FPG ≥ 140 mg/dL" }
            ],
            revealExplanation: "依據臨床指引，空腹（禁食至少 8 小時）血漿血糖 FPG ≥ 126 mg/dL 符合糖尿病診斷標準！（100 ~ 125 mg/dL 屬於空腹血糖偏高/糖尿病前期）。故正確答案為【FPG ≥ 126 mg/dL】！"
        },
        'DM_STAGE_4': {
            speaker: "【⚔️ 糖耐審判勇者】",
            speakerRole: "warrior",
            nurseImg: "assets/warrior_hero.png",
            nurseTag: "⚔️ 糖耐審判男戰士",
            backdrop: "assets/rpg_bg_ogtt_swamp.jpg",
            isDragonBossStage: true,
            hasSliderBattle: true,
            sliderType: "ogtt",
            correctVal: 200,
            voicePath: "assets/voice/dm_stage4.mp3",
            speech: "「深淵噬糖巨獸『晶化毒蠍魔君』盤踞在沼澤深處！依據臨床診療指引，進行口服葡萄糖耐受試驗（75g OGTT）時，『<strong>第 2 小時血漿血糖</strong>』之糖尿病診斷切點為何？」",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 1", text: "OGTT 2小時 ≥ 140 mg/dL" },
                { key: "2", score: "選項 2", text: "OGTT 2小時 ≥ 160 mg/dL" },
                { key: "3", score: "選項 3", text: "OGTT 2小時 ≥ 180 mg/dL" },
                { key: "4", score: "選項 4", text: "OGTT 2小時 ≥ 200 mg/dL" }
            ],
            revealExplanation: "75g 口服葡萄糖耐受試驗（OGTT）第 2 小時血漿血糖 ≥ 200 mg/dL 符合糖尿病診斷標準！（140 ~ 199 mg/dL 為耐糖異常/糖尿病前期）。故正確答案為選項【4】OGTT 2小時 ≥ 200 mg/dL！"
        },
        'DM_STAGE_5': {
            speaker: "【⚔️ 疾風破煞勇者】",
            speakerRole: "warrior",
            nurseImg: "assets/warrior_hero.png",
            nurseTag: "⚔️ 疾風破煞男戰士",
            backdrop: "assets/rpg_bg_thunder_wolf.jpg",
            isDragonBossStage: true,
            hasSliderBattle: true,
            sliderType: "random_glucose",
            correctVal: 200,
            voicePath: "assets/voice/dm_stage5.mp3",
            speech: "「雷霆荒野的『狂暴雷狼魔』突襲撕裂防線！依據臨床診療指引，當個案出現高血糖典型症狀（多吃、多喝、多尿與體重減輕）時，『<strong>隨機血漿血糖（Random Glucose）</strong>』之糖尿病診斷切點為何？」",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 1", text: "隨機血糖 ≥ 140 mg/dL" },
                { key: "2", score: "選項 2", text: "隨機血糖 ≥ 160 mg/dL" },
                { key: "3", score: "選項 3", text: "隨機血糖 ≥ 180 mg/dL" },
                { key: "4", score: "選項 4", text: "隨機血糖 ≥ 200 mg/dL 伴隨典型高血糖症狀" }
            ],
            revealExplanation: "個案出現典型高血糖「三多一少」（多吃、多喝、多尿、體重減輕）症狀，且隨機血漿血糖 ≥ 200 mg/dL 時，即可直接診斷為糖尿病！故正確答案為選項【4】隨機血糖 ≥ 200 mg/dL 伴隨典型高血糖症狀！"
        },
        'DM_STAGE_6': {
            speaker: "【竹科高階主管 陳先生 (48歲)】",
            speakerRole: "chen",
            voicePath: "assets/voice/dm_stage6.mp3",
            nurseImg: "assets/chen_bust.png",
            nurseTag: "竹科高階主管 陳先生 (48歲)",
            backdrop: "assets/rpg_bg_tech_company.jpg",
            speech: `「實習營養師您好！我是科技公司的研發主管<br>每週工時長達６０小時，常態外食久坐、沒時間運動<br>這是我公司年度健檢的抽血報告，有哪一些是數值異常的呢？」`,
            correctKey: "1",
            isLabMultiStage: true,
            options: [
                { key: "1", score: "選項 1", text: "確診第 2 型糖尿病，並合併高三酸甘油酯血症" },
                { key: "2", score: "選項 2", text: "僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準" },
                { key: "3", score: "選項 3", text: "屬於第 1 型糖尿病，必須立即終生注射胰島素" },
                { key: "4", score: "選項 4", text: "各項血糖數值皆在正常安全範圍，無代謝異常問題" }
            ],
            revealExplanation: "陳先生空腹血糖 FPG 138 mg/dL (≥ 126)、HbA1c 7.4% (≥ 6.5%) 達到糖尿病診斷標準，確診為第 2 型糖尿病；並合併三酸甘油酯 TG 225 mg/dL 偏高（> 150 mg/dL）。其餘 75g OGTT 2小時 (132 mg/dL)、HDL-C (45 mg/dL) 與 LDL-C (115 mg/dL) 皆在正常範圍。故正確答案為選項【1】確診第 2 型糖尿病，並合併高三酸甘油酯血症！"
        },
        'DM_STAGE_7': {
            speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
            speakerRole: "doctor",
            voicePath: "assets/voice/dm_stage7.mp3",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "內分泌新陳代謝科 沈懷瑾 主任醫師",
            backdrop: "assets/rpg_bg_clinic.jpg",
            speech: "下列何者是糖尿病人血糖控制的長期成效指標？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 1", text: "HbA1c" },
                { key: "2", score: "選項 2", text: "空腹血糖" },
                { key: "3", score: "選項 3", text: "飯後血糖" },
                { key: "4", score: "選項 4", text: "OGTT" }
            ],
            revealExplanation: "糖化血色素（HbA1c）能反映過去 2 ~ 3 個月的平均血糖控制狀態，不受單次飲食、運動或抽血前作息短期波動影響，是臨床評估糖尿病人血糖控制成效最關鍵之【長期指標】（正確答案為選項 1：HbA1c）！"
        },
        'DM_STAGE_8': {
            speaker: "【新陳代謝科 高健宇 主治醫師】",
            speakerRole: "muscle_doctor",
            voicePath: "assets/voice/dm_stage8.mp3",
            nurseImg: "assets/handsome_muscle_doctor_bust.png",
            nurseTag: "新陳代謝科 高健宇 主治醫師",
            backdrop: "assets/rpg_bg_clinic.jpg",
            speech: "下列何者與<strong style=\"color:#fef08a;\">第 2 型糖尿病人</strong>的<strong style=\"color:#fef08a;\">胰島素阻抗無關</strong>？",
            correctKey: "3",
            options: [
                { key: "1", score: "選項 1", text: "飯後高血糖" },
                { key: "2", score: "選項 2", text: "血液中胰島素濃度增加" },
                { key: "3", score: "選項 3", text: "產生酮酸中毒" },
                { key: "4", score: "選項 4", text: "血液中游離脂肪酸濃度增加" }
            ],
            revealExplanation: "第 2 型糖尿病患者體內仍保有部分內生性胰島素分泌能力，足以抑制脂肪大量分解產生過量酮體，因此極罕見產生糖尿病酮酸中毒（DKA，DKA 多見於胰島素絕對缺乏之第 1 型糖尿病）！胰島素阻抗會導致代償性高胰島素血症、游離脂肪酸 (FFA) 上升以及骨骼肌對葡萄糖利用下降而引發飯後高血糖。故正確答案為選項【3】產生酮酸中毒！"
        },
        'DM_STAGE_9': {
            speaker: "【魔導能量儀・核心共鳴】",
            speakerRole: "arcane",
            voicePath: "assets/voice/dm_stage9_arcane.mp3",
            nurseImg: "assets/arcane_dial_seal.png",
            nurseTag: "魔導能量儀",
            backdrop: "assets/rpg_bg_arcane_sanctuary.jpg",
            speech: "【魔導能量儀・核心共鳴】聖域防護石碑上浮現了深紅色的糖化印記：「A1C: 9%」。<br>守護者必須計算出過去 3 個月能量流動的「估計平均血糖值（eAG）」以解除印記超載，請問儀表應校準至多少數值？",
            correctKey: "3",
            isArcaneEagStage: true,
            options: [
                { key: "1", score: "選項 1", text: "139 mg/dL" },
                { key: "2", score: "選項 2", text: "183 mg/dL" },
                { key: "3", score: "選項 3", text: "212 mg/dL" },
                { key: "4", score: "選項 4", text: "251 mg/dL" }
            ],
            revealExplanation: "依據 ADA 與臨床指引換算公式：eAG (mg/dL) = 28.7 × A1C - 46.7。當 A1C 為 9% 時，eAG = 28.7 × 9 - 46.7 = 211.6 ≈ 212 mg/dL！故正確答案為【212 mg/dL】！"
        },
        'DM_STAGE_10': {
            speaker: "【初診個案 王先生 (45歲)】",
            speakerRole: "wang",
            voicePath: "assets/voice/dm_stage10.mp3",
            nurseImg: "assets/wang_bust.png",
            nurseTag: "初診個案 王先生 (45歲)",
            backdrop: "assets/rpg_bg_dm_consultation.jpg",
            speech: "王先生，45 歲，新診斷出為<strong style=\"color:#fef08a;\">第 2 型糖尿病</strong>。除了應定期追蹤血糖值外，下列何者通常也建議<strong style=\"color:#fef08a;\">定期監測</strong>？",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 1", text: "肝、腎功能" },
                { key: "2", score: "選項 2", text: "精神狀態" },
                { key: "3", score: "選項 3", text: "肌肉量及肌力" },
                { key: "4", score: "選項 4", text: "血脂肪、血壓" }
            ],
            revealExplanation: "第 2 型糖尿病常合併高血壓與血脂異常，大幅增加心血管疾病之風險。因此臨床治療指引強烈建議，除定期監測血糖（FPG、HbA1c）外，亦應定期監測【血脂肪（TC、TG、HDL-C、LDL-C）及血壓】！故正確答案為選項【4】血脂肪、血壓！"
        },
        'DM_STAGE_11': {
            speaker: "【內分泌新陳代謝科 沈懷瑾 主任醫師】",
            speakerRole: "doctor",
            voicePath: "assets/voice/dm_stage11.mp3",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "內分泌新陳代謝科 沈懷瑾 主任醫師",
            backdrop: "assets/rpg_bg_clinic.jpg",
            speech: "具有下列那些<strong style=\"color:#fef08a;\">風險因子</strong>的成年人，建議考慮執行<strong style=\"color:#fef08a;\">糖尿病篩檢</strong>？<br>①一等親有糖尿病 ②高血壓且已在服用降血壓藥物 ③三酸甘油酯超過 150 mg/dL ④低密度脂蛋白-膽固醇超過 130 mg/dL ⑤曾經被診斷為 GDM",
            correctKey: "2",
            options: [
                { key: "1", score: "選項 1", text: "①②③" },
                { key: "2", score: "選項 2", text: "①②⑤" },
                { key: "3", score: "選項 3", text: "②③④" },
                { key: "4", score: "選項 4", text: "③④⑤" }
            ],
            revealExplanation: "依據糖尿病臨床指引，建議篩檢之風險因子包括：①一等親有糖尿病、②高血壓（≥140/90 mmHg 或正接受降血壓治療）、⑤曾被診斷為妊娠糖尿病（GDM）。另血脂切點為三酸甘油酯（TG）> 250 mg/dL 或 HDL-C < 35 mg/dL（非 LDL-C > 130 或 TG > 150）。故符合建議篩檢之組合為【①②⑤】（正確答案為選項 2：①②⑤）！"
        },
        'DM_STAGE_12': {
            speaker: "【營養衛教室 ‧ 衛教餐桌】",
            speakerRole: "nurse",
            nurseImg: "",
            nurseTag: "衛教餐桌",
            backdrop: "assets/rpg_bg_dining_table.jpg",
            voicePath: "assets/voice/dm_stage11_dining.mp3",
            speech: "<strong style=\"color:#fef08a;\">下列何種食物中，等量碳水化合物引起的血糖反應最小？</strong><br><span style=\"color:#a7f3d0;font-size:15px;\">💡 請直接點擊餐桌上的食物作答</span>",
            correctKey: "3",
            isDiningTableStage: true,
            options: [
                { key: "1", score: "選項 A", text: "白米粥" },
                { key: "2", score: "選項 B", text: "葡萄汁" },
                { key: "3", score: "選項 C", text: "裸麥麵包" },
                { key: "4", score: "選項 D", text: "早餐玉米片" }
            ],
            revealExplanation: "升糖指數（Glycemic Index, GI）衡量食物引起血糖上升的速度與幅度。裸麥麵包（Rye Bread）富含高纖維與緩消化澱粉，GI 值約 41，是四項食物中等量碳水化合物引起血糖反應最小者！玉米片（GI≈81）與白米粥（GI≈78）屬高 GI 食物，葡萄汁（GI≈52）為中 GI 食物。故正確答案為選項【C 裸麥麵包】！"
        },
        'DM_STAGE_13': {
            speaker: "【血糖偵查小隊 隊長】",
            speakerRole: "detective_leader",
            nurseImg: "assets/student_female_bust.png",
            nurseTag: "血糖偵查小隊 隊長",
            backdrop: "assets/rpg_bg_midnight_ward.jpg",
            voicePath: "assets/voice/dm_stage12_detective.mp3",
            isDetectiveStage: true,
            isTeamBattle: true,
            speech: "🌙 <strong>深夜 2:00，病人進入睡眠……</strong><br>⚠️ <strong>凌晨出現神秘的「低血糖警報」！</strong><br>🌅 <strong>隔天早晨，血糖卻突然升高！</strong><br><span style=\"color:#38bdf8;\">🕵️‍♀️ 到底發生了什麼事？各組化身「血糖偵查小隊」，破解案件找出造成清晨高血糖的真正原因！</span>",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 1", text: "梭莫基效應（Somogyi effect）：夜間低血糖誘發昇糖素與皮質醇反彈升高" },
                { key: "2", score: "選項 2", text: "黎明現象（Dawn phenomenon）：清晨生長激素分泌導致生理性胰島素抗性" },
                { key: "3", score: "選項 3", text: "夜間暴食反應（Night binge eating）：半夜夢遊攝取高碳水化合物" },
                { key: "4", score: "選項 4", text: "胰島素耗竭（Insulin exhaustion）：凌晨胰島細胞永久功能停止" }
            ],
            revealExplanation: "【夜間血糖偵探 案件破解】：夜間凌晨 2-3 點發生低血糖，引發體內升糖素、腎上腺素與皮質醇大量分泌，導致清晨反彈性高血糖，此生理機轉為典型【梭莫基效應（Somogyi effect）】！臨床處置應降低睡前胰島素劑量或補充睡前點心。若凌晨血糖正常或偏高而早晨偏高，則為黎明現象。故正確答案為選項【1】！"
        },
        'MUST_STAGE_7': {
            speaker: "【食醫的考驗】",
            speakerRole: "shiyi",
            nurseImg: "assets/zhou_shiyi_bust_hd.png",
            nurseTag: "宮廷食醫",
            backdrop: "assets/rpg_bg_zhou_court.jpg",
            voicePath: "assets/voice/must_stage7_zhou_question.mp3",
            speech: "<div style=\"font-size:16px; line-height:1.6;\"><span style=\"color:#ffffff; font-weight:bold;\">下列何者不是</span><strong style=\"color:#fef08a;\">營養篩檢</strong><span style=\"color:#ffffff; font-weight:bold;\">（nutrition screening）的項目？</span><br><span style=\"color:#94a3b8; font-size:13.5px; font-weight:normal;\">（請於下方點選非初步營養篩檢的常規項目）</span></div>",
            correctKey: "4",
            isZhouCourtStage: true,
            options: [
                { key: "1", score: "選項 1", text: "體重改變" },
                { key: "2", score: "選項 2", text: "BMI" },
                { key: "3", score: "選項 3", text: "進食量" },
                { key: "4", score: "選項 4", text: "藥物" }
            ],
            revealExplanation: "依據臨床照護指引：營養篩檢（Nutrition Screening）主要由幾項基本資料快速進行，常見指標為：體重改變、BMI、進食量；而「藥物」屬於後續深入的營養評估（Nutrition Assessment）範疇，非初步快速篩檢之常規項目！故正確答案為選項【4：藥物】！"
        },
        'LIFE_STAGE_1': {
            speaker: "【保健營養系 吳教授】",
            speakerRole: "wu",
            voicePath: "assets/voice/life_stage1.mp3",
            nurseImg: "assets/professor_bust.png",
            nurseTag: "保健營養系 吳教授",
            backdrop: "assets/rpg_bg_classroom.jpg",
            speech: "<strong style=\"color:#fef08a;\">【人生好難題】在南台灣艷陽下騎車趕早八，抵達教室的瞬間？</strong>",
            correctKey: "4",
            isLifeQuiz: true,
            options: [
                { key: "1", score: "選項 1", text: "衝進教室，已經熱到像剛洗完澡般滿身大汗" },
                { key: "2", score: "選項 2", text: "發現教授還沒來，慶幸不用記曠課好震撼" },
                { key: "3", score: "選項 3", text: "回想熬夜寫完的兩萬字報告，意志力無比強悍" },
                { key: "4", score: "選項 4", text: "結果發現今天是國定假日，留下一個大大的遺憾" }
            ],
            revealExplanation: "南台灣烈日狂飆、滿身大汗、衝進教室卻發現全校空無一人——因為今天是「國定假日」！故正確答案為選項【4】！"
        },
        'CURRICULUM_03_STAGE_1': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_ward.jpg",
            speech: "下列有關身體組成的敘述，何者錯誤？",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 A", text: "體脂肪（fat mass）存在於腦、骨骼肌及脂肪組織" },
                { key: "2", score: "選項 B", text: "男性的瘦體組織（lean body mass）較女性多" },
                { key: "3", score: "選項 C", text: "一般而言，同年齡同性別之正常健康人，體組成中非體脂肪（fat free mass）之比例相似" },
                { key: "4", score: "選項 D", text: "非體脂肪（fat free mass）即是瘦體組織（lean body mass）" }
            ],
            revealExplanation: "非體脂肪（Fat-Free Mass, FFM）與瘦體組織（Lean Body Mass, LBM）定義不同！FFM 是完全扣除體內所有脂質（含儲存脂肪與必需脂肪）後的組織重量（包含骨骼、肌肉、水分與無機鹽等）；而 LBM 則包含了維持生命運作不可或缺的「必需脂肪（Essential Fat，約佔 3~5%）」，兩者並不相等！故錯誤（應選）答案為選項【D 非體脂肪（fat free mass）即是瘦體組織（lean body mass）】！"
        },
        'CURRICULUM_03_STAGE_2': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_unit3_stage5_adipose.png",
            speech: "有關白色脂肪組織的敘述，下列何者錯誤？",
            correctKey: "3",
            options: [
                { key: "1", score: "選項 A", text: "因含有 Carotene 顏色為淡黃色" },
                { key: "2", score: "選項 B", text: "可保護體內臟器避免碰撞傷害" },
                { key: "3", score: "選項 C", text: "提供新生兒產熱" },
                { key: "4", score: "選項 D", text: "儲存三酸甘油酯" }
            ],
            revealExplanation: "白色脂肪組織（White Adipose Tissue, WAT）主要功能為儲存三酸甘油酯能量、維持體溫隔熱及保護內臟避免碰撞傷害，且因溶解胡蘿蔔素（Carotene）而呈現淡黃色。而【提供新生兒產熱】是『棕色脂肪組織（Brown Adipose Tissue, BAT）』的核心功能（富含解偶聯蛋白 UCP-1），非白色脂肪組織之功能！故錯誤（應選）答案為選項【C 提供新生兒產熱】！"
        },
        'CURRICULUM_03_STAGE_3': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_anorexia_counseling_v2.jpg",
            speech: "有關神經性厭食症（anorexia nervosa）病人的營養素需求，下列何者正確？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "低體重病人常有維生素 B1 缺乏，再餵食（refeeding）階段需額外補充" },
                { key: "2", score: "選項 B", text: "低體重病人血清 25-hydroxy vitamin D 濃度通常過高" },
                { key: "3", score: "選項 C", text: "因高胡蘿蔔素血症（hypercarotenemia），需限制病人類胡蘿蔔素的攝取" },
                { key: "4", score: "選項 D", text: "限鈉飲食（2 公克／天）對病人的水分滯留沒有幫助" }
            ],
            revealExplanation: "神經性厭食症（Anorexia Nervosa）長期嚴重飢餓、低體重病人常合併維生素 B1（Thiamine）缺乏；在重新開始給予營養（Refeeding）時，碳水化合物代謝會大量消耗維生素 B1，若未預先補充極易引發魏尼凱腦病變（Wernicke encephalopathy）或再餵食症候群，因此需額外補充！故正確答案為選項【A】！"
        },
        'CURRICULUM_03_STAGE_4': {
            speaker: "【題目說明】",
            speakerRole: "",
            nurseImg: "",
            nurseTag: "",
            backdrop: "assets/rpg_bg_bulimia_binge_eating.jpg",
            speech: "有關暴食症（Bulimia）的診斷標準之敘述，下列何者正確？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "個案重複發生暴食現象，在一段獨立時間內（如 2 小時）吃下很大量食物" },
                { key: "2", score: "選項 B", text: "體重顯著下降，且對自己身材的纖瘦沒有感覺" },
                { key: "3", score: "選項 C", text: "個案常催吐、不當使用瀉劑或利尿劑，易造成貧血" },
                { key: "4", score: "選項 D", text: "個案常發生皮膚乾燥、營養不良等問題，應即時補充熱量與蛋白質等" }
            ],
            revealExplanation: "依據 DSM 診斷標準，暴食症（Bulimia Nervosa）之核心特徵為重複發生暴食（Binge eating）事件，即在一段明確獨立的時間內（如 2 小時內）攝取遠大於一般人在此情境下所能吃下的極大量食物，且伴隨無法控制進食的感覺！故正確答案為選項【A】！"
        },
        'CURRICULUM_03_STAGE_5': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_unit3_stage4_anorexia.png",
            speech: "體重過輕仍然非常害怕變胖為下列何種飲食障礙的診斷依據之一？",
            correctKey: "2",
            options: [
                { key: "1", score: "選項 A", text: "bulimia nervosa" },
                { key: "2", score: "選項 B", text: "anorexia nervosa" },
                { key: "3", score: "選項 C", text: "binge-eating disorder" },
                { key: "4", score: "選項 D", text: "night eating syndrome" }
            ],
            revealExplanation: "神經性厭食症（Anorexia Nervosa）的典型診斷特徵為限制能量攝取導致顯著體重過輕，即使體重已經嚴重過輕，個案仍對體重增加或變胖感到強烈的恐懼（Intense fear of gaining weight or becoming fat），並存在體型與體重知覺扭曲！故正確答案為選項【B anorexia nervosa】！"
        },
        'CURRICULUM_03_STAGE_6': {
            speaker: "【紀晨希 營養師】",
            speakerRole: "nurse",
            nurseImg: "assets/icu_dietitian_bust.png",
            nurseTag: "紀晨希 營養師",
            backdrop: "assets/rpg_bg_unit3_stage1_proteins.jpg?v=20261010_ext",
            speech: "營養不良時，造成體液失衡及引起水腫是因為血中何種蛋白質下降？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "白蛋白" },
                { key: "2", score: "選項 B", text: "角蛋白" },
                { key: "3", score: "選項 C", text: "鐵蛋白" },
                { key: "4", score: "選項 D", text: "球蛋白" }
            ],
            revealExplanation: "白蛋白（Albumin）是維持血漿膠體滲透壓（Colloid Osmotic Pressure）最重要的蛋白質。營養不良或蛋白質攝取不足時，血中白蛋白濃度下降，導致血管內膠體滲透壓降低，水分外滲至組織間隙引起水腫（Edema）與體液失衡！故正確答案為選項【A 白蛋白】！"
        },
        'CURRICULUM_07_STAGE_1': {
            speaker: "【江柏叡 主任醫師】",
            speakerRole: "doctor",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "江柏叡 主任醫師",
            backdrop: "assets/rpg_bg_moba_battlefield_hd.jpg?v=20261010_v3",
            isKidneyRpgStage: true,
            voicePath: "assets/voice/curriculum_07_stage1.mp3",
            speech: "下列何者不是測量腎臟功能的常用參考指標？",
            correctKey: "2",
            options: [
                { key: "1", score: "選項 A", text: "尿液白蛋白排泄率（urinary albumin excretion rate）" },
                { key: "2", score: "選項 B", text: "血漿白蛋白濃度（plasma albumin concentration）" },
                { key: "3", score: "選項 C", text: "血漿菊糖清除率（clearance of inulin）" },
                { key: "4", score: "選項 D", text: "血漿肌酸酐清除率（clearance of creatinine）" }
            ],
            revealExplanation: "血漿白蛋白濃度（Plasma albumin concentration）主要反映肝臟合成功能、營養狀態或發炎反應（負急性期蛋白），而非評估腎臟功能（濾過率或排泄能力）的指標；相較之下，尿液白蛋白排泄率（評估腎絲球濾過屏障）、血漿菊糖清除率（GFR 黃金標準）及血漿肌酸酐清除率（臨床常用 GFR 評估法）皆為評估腎功能的指標！故非測量腎功能常用指標之答案為選項【B 血漿白蛋白濃度】！"
        },
        'CURRICULUM_07_STAGE_2': {
            speaker: "【江柏叡 主任醫師】",
            speakerRole: "doctor",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "江柏叡 主任醫師",
            backdrop: "assets/rpg_bg_clinic.jpg",
            voicePath: "assets/voice/curriculum_07_stage2.mp3",
            speech: "王小姐畢業後出國工作一直沒有追蹤腎功能，十年後返臺進行全身健康檢查發現 glomerular filtration rate 為 42 mL/min/1.73m2 、三個月後再追蹤仍為 40 mL/min/1.73m2，王小姐目前為 chronic kidney disease 的第幾期？",
            correctKey: "3",
            options: [
                { key: "1", score: "選項 A", text: "G2" },
                { key: "2", score: "選項 B", text: "G3a" },
                { key: "3", score: "選項 C", text: "G3b" },
                { key: "4", score: "選項 D", text: "G4a" }
            ],
            revealExplanation: "依據 KDIGO 慢性腎臟病（CKD）分期標準：G1: GFR ≥ 90、G2: 60~89、G3a: 45~59、G3b: 30~44、G4: 15~29、G5: < 15 mL/min/1.73m²。王小姐 GFR 連續三個月追蹤為 40~42 mL/min/1.73m²，落在 30~44 區間，故確診為【G3b】期！正確答案為選項【C G3b】！"
        },
        'CURRICULUM_07_STAGE_3': {
            speaker: "【江柏叡 主任醫師】",
            speakerRole: "doctor",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "江柏叡 主任醫師",
            backdrop: "assets/kidney_stage3_question_custom.png",
            voicePath: "assets/voice/curriculum_07_stage3_custom.mp3",
            speech: "王小姐身高 162 公分、體重 60 公斤，平日有健身重訓，在此階段，下列何飲食處方最不適合王小姐？",
            correctKey: "3",
            options: [
                { key: "1", score: "選項 A", text: "熱量 2,100 大卡、蛋白質 45 公克" },
                { key: "2", score: "選項 B", text: "熱量 2,100 大卡、蛋白質 36 公克" },
                { key: "3", score: "選項 C", text: "熱量 2,100 大卡、蛋白質 90 公克" },
                { key: "4", score: "選項 D", text: "熱量 1,680 大卡、蛋白質 36 公克" }
            ],
            revealExplanation: "王小姐經確診為慢性腎臟病 G3b 期（未透析），臨床飲食治療原則應採「低蛋白飲食」（LPD，每日約 0.6~0.8 g/kg，以 60 公斤計算約為 36~48 公克/天，並維持熱量充足 30~35 kcal/kg 約 1,800~2,100 大卡），以減輕含氮廢物堆積並延緩腎功能衰退。選項【C】蛋白質給予高達 90 公克（1.5 g/kg，屬高蛋白飲食），會大幅增加腎絲球過濾負擔與尿毒素累積，最不適合王小姐！故最不適合之答案為選項【C 熱量 2,100 大卡、蛋白質 90 公克】！"
        },
        'CURRICULUM_07_STAGE_4': {
            speaker: "【臨床營養師】",
            speakerRole: "nurse",
            nurseImg: "",
            nurseTag: "",
            backdrop: "assets/kidney_stage4_nutrient_bg.jpg",
            voicePath: "assets/voice/curriculum_07_stage4_nutrient.mp3",
            speech: "慢性腎臟病 Stage 4 的病人不需要限制下列何種營養素的攝取？",
            correctKey: "1",
            options: [
                { key: "1", score: "選項 A", text: "鈣" },
                { key: "2", score: "選項 B", text: "磷" },
                { key: "3", score: "選項 C", text: "鈉" },
                { key: "4", score: "選項 D", text: "鉀" }
            ],
            revealExplanation: "慢性腎臟病（CKD）Stage 4 病人腎功能顯著減退，排泄磷、鈉、鉀的能力明顯受損，易導致高血磷、高血壓水腫與致命性高血鉀，臨床飲食治療指引強烈建議嚴格限制「磷、鈉、鉀」之攝取；相反地，此階段活化維生素 D3 之功能降低且常伴隨低血鈣，一般不需限制鈣攝取（甚至常需適量補充鈣或服用碳酸鈣等磷結合劑），故不需要限制攝取之營養素為選項【A 鈣】！"
        },
        'CURRICULUM_07_STAGE_5': {
            speaker: "【江柏叡 主任醫師】",
            speakerRole: "doctor",
            nurseImg: "assets/doctor_bust.png",
            nurseTag: "江柏叡 主任醫師",
            backdrop: "assets/kidney_stage3_video_final_frame.png",
            voicePath: "assets/voice/curriculum_07_stage3.mp3",
            speech: "末期腎臟病（ESRD），與下列何種疾病最不相關？",
            correctKey: "4",
            options: [
                { key: "1", score: "選項 A", text: "高血壓" },
                { key: "2", score: "選項 B", text: "糖尿病" },
                { key: "3", score: "選項 C", text: "腎絲球腎炎" },
                { key: "4", score: "選項 D", text: "克隆氏症" }
            ],
            revealExplanation: "導致末期腎臟病（ESRD）的三大主要原發/繼發病因為糖尿病腎病變、高血壓性腎病變及慢性腎絲球腎炎。克隆氏症（Crohn's disease）為慢性發炎性腸道疾病（IBD），主要侵犯腸道，與末期腎臟病無直接致病關聯！故最不相關之答案為選項【D 克隆氏症】！"
        },
        'CURRICULUM_07_STAGE_6': {
            speaker: "【高健宇 主治醫師】",
            speakerRole: "muscle_doctor",
            nurseImg: "assets/handsome_muscle_doctor_bust.png",
            nurseTag: "高健宇 主治醫師",
            backdrop: "assets/kidney_stage4_question_bg.png",
            voicePath: "assets/voice/curriculum_07_stage4.mp3",
            speech: "有關醫師評估透析病人乾體重（dry weight）的目的，下列何者錯誤？",
            correctKey: "3",
            options: [
                { key: "1", score: "選項 A", text: "維持體內最佳體液容積" },
                { key: "2", score: "選項 B", text: "維持正常血壓" },
                { key: "3", score: "選項 C", text: "減少蛋白尿" },
                { key: "4", score: "選項 D", text: "降低死亡率" }
            ],
            revealExplanation: "透析病人的「乾體重（Dry Weight）」是指透析後無水腫、血壓正常的理想最低體重，其目的在於維持體內最佳體液容積、維持正常血壓並降低心血管死亡率。透析病人腎功能多已完全衰竭（尿量極少或無尿），評估乾體重之目的並非「減少蛋白尿」！故錯誤（應選）答案為選項【C 減少蛋白尿】！"
        },
        'NEW_STUDENT_TRIAL_STAGE_1': {
            speaker: "輔英科大保健營養系 伊麗克絲 營養師",
            speakerRole: "mentor",
            nurseImg: "assets/mentor_guide.png",
            nurseTag: "輔英科大保健營養系 伊麗克絲 營養師",
            backdrop: "assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v3",
            speech: "",
            correctKey: "1",
            options: [],
            revealExplanation: "勇者成功進入【醫療之城】，開啟專業臨床營養治療與照護試煉！"
        }
    };

    function getCurriculum03ModuleNumber(unit, moduleCode) {
        const unitKey = String(unit || '').toLowerCase();
        if (!unitKey.includes('curriculum_03')) return 0;
        const match = String(moduleCode || '').match(/^CURRICULUM_03_STAGE_(\d+)$/i);
        return match ? Number(match[1]) : 0;
    }

    function getCurriculum03DisplayModuleNumber(unit, stageNumber) {
        const unitKey = String(unit || '').toLowerCase();
        if (!unitKey.includes('curriculum_03')) return 0;
        return Number(stageNumber) || 0;
    }

    function isCurriculum03Module(unit, moduleCode, moduleNumber) {
        return getCurriculum03ModuleNumber(unit, moduleCode) === moduleNumber;
    }

    function stopUnit3Stage3OptionShowcase() {
        unit3Stage3VideoRun += 1;
        if (unit3Stage3NarrationActive && rpgBgmAudio && bgmPlaying) {
            rpgBgmAudio.volume = bgmBaseVolume;
        }
        unit3Stage3NarrationActive = false;
        const overlay = document.getElementById('unit3Stage3VideoOverlay');
        const video = document.getElementById('unit3Stage3OptionVideo');
        if (video) {
            video.onended = null;
            video.onerror = null;
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        if (overlay) overlay.classList.add('hidden');
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (npcQuestionVoiceAudio) {
            try {
                npcQuestionVoiceAudio.pause();
            } catch(e) {}
        }
        isQuestionVoicePlaying = false;
        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
            btnReplayQuestionVoice.classList.remove('playing');
        }
    }

    function getUnit3RevealVideoSource(unit = activeUnit, stage = currentStage) {
        const unitKey = String(unit || '').toLowerCase();
        const stageData = currentUnitConf && currentUnitConf.stages
            ? currentUnitConf.stages[stage]
            : null;
        if (!unitKey.includes('curriculum_03')) return '';
        if (Number(stage) === 6) return 'assets/unit3_stage6_reveal.mp4';
        if (Number(stage) === 1 && stageData &&
            `${stageData.title || ''} ${stageData.speech || ''}`.includes('身體組成')) {
            return 'assets/unit3_stage1_body_composition_reveal.mp4';
        }
        return '';
    }

    function setUnit3RevealVideoOverlayVisible(visible) {
        const overlay = document.getElementById('unit3RevealVideoOverlay');
        const video = document.getElementById('unit3RevealVideo');
        if (!overlay) return;
        if (visible) {
            overlay.classList.remove('hidden');
            overlay.style.setProperty('display', 'flex', 'important');
            overlay.style.setProperty('visibility', 'visible', 'important');
            overlay.style.setProperty('opacity', '1', 'important');
            if (video) {
                video.style.setProperty('display', 'block', 'important');
                video.style.setProperty('visibility', 'visible', 'important');
                video.style.setProperty('opacity', '1', 'important');
            }
        } else {
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
            if (video) {
                video.style.removeProperty('display');
                video.style.removeProperty('visibility');
                video.style.removeProperty('opacity');
            }
        }
    }

    function playUnit3RevealVideo() {
        const videoSource = getUnit3RevealVideoSource();
        if (!isTeacher || !videoSource) return Promise.resolve('cancelled');
        if (unit3RevealVideoPending) return Promise.resolve('cancelled');

        const overlay = document.getElementById('unit3RevealVideoOverlay');
        const video = document.getElementById('unit3RevealVideo');
        const status = document.getElementById('unit3RevealVideoStatus');
        const retryButton = document.getElementById('unit3RevealVideoRetry');
        const skipButton = document.getElementById('unit3RevealVideoSkip');
        if (!overlay || !video || !status || !retryButton || !skipButton) {
            console.error('單元三答案影片介面未完整載入');
            return Promise.resolve('failed');
        }

        unit3RevealVideoPending = true;
        const unitAtStart = activeUnit;
        const stageAtStart = currentStage;
        if (dialogIndicator) dialogIndicator.textContent = '🎬 請先觀看影片，播放完畢後將公布答案與統計。';
        stopAllQuestionVoice();
        if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = 0.08;

        return new Promise(resolve => {
            let settled = false;
            const finish = result => {
                if (settled) return;
                settled = true;
                video.pause();
                video.onended = null;
                video.onerror = null;
                video.onclick = null;
                video.controls = false;
                retryButton.onclick = null;
                skipButton.onclick = null;
                setUnit3RevealVideoOverlayVisible(false);
                status.textContent = '';
                retryButton.classList.add('hidden');
                skipButton.classList.add('hidden');
                unit3RevealVideoPending = false;
                cancelUnit3RevealVideo = null;
                if (result === 'played' || result === 'skipped') {
                    unit3RevealVideoCompleted = true;
                }
                if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmBaseVolume;
                if (result === 'played' && dialogIndicator) {
                    dialogIndicator.textContent = '🎬 影片播放完畢，正在公布答案與統計。';
                }
                resolve(result);
            };
            cancelUnit3RevealVideo = () => finish('cancelled');

            const showPlaybackError = error => {
                if (error) console.error('單元三答案影片播放失敗', error);
                status.textContent = '影片無法播放，請重試，或略過影片後公布答案。';
                retryButton.classList.remove('hidden');
                skipButton.classList.remove('hidden');
            };
            const startPlayback = () => {
                status.textContent = '';
                retryButton.classList.add('hidden');
                video.load();
                video.currentTime = 0;
                // Prime playback in a policy-safe state, then immediately
                // restore audible playback once the media promise resolves.
                video.muted = true;
                video.volume = 1;
                const playResult = video.play();
                if (playResult && typeof playResult.catch === 'function') {
                    playResult.then(() => {
                        video.muted = false;
                        video.volume = 1;
                    }).catch(showPlaybackError);
                }
            };

            setUnit3RevealVideoOverlayVisible(true);
            // Unmute immediately after playback is accepted so the teacher
            // hears the supplied video while avoiding a WebView autoplay block.
            video.muted = true;
            video.volume = 1;
            video.controls = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('x5-playsinline', '');
            video.src = videoSource;
            video.onended = () => finish('played');
            video.onerror = () => showPlaybackError(video.error);
            video.onclick = () => {
                if (video.paused) {
                    video.muted = true;
                    video.volume = 1;
                    const retryPlayback = video.play();
                    if (retryPlayback && typeof retryPlayback.catch === 'function') {
                        retryPlayback.then(() => {
                            video.muted = false;
                        }).catch(showPlaybackError);
                    }
                }
            };
            retryButton.onclick = startPlayback;
            skipButton.onclick = () => finish('skipped');
            startPlayback();
        }).then(result => {
            if (result !== 'cancelled' && (activeUnit !== unitAtStart || currentStage !== stageAtStart)) {
                return 'cancelled';
            }
            return result;
        });
    }

    function runUnit3RevealVideoThen(revealAction) {
        if (!isTeacher || !getUnit3RevealVideoSource() || teacherStageRevealed) {
            revealAction();
            return;
        }
        if (unit3RevealVideoCompleted) {
            revealAction();
            return;
        }
        if (unit3RevealVideoPending) return;

        const unitAtStart = activeUnit;
        const stageAtStart = currentStage;
        playUnit3RevealVideo().then(result => {
            if ((result === 'played' || result === 'skipped') &&
                activeUnit === unitAtStart && currentStage === stageAtStart &&
                !teacherStageRevealed) {
                revealAction();
            }
        });
    }

    function isUnit3Stage6RevealTarget(unit = activeUnit, stage = currentStage) {
        const unitKey = String(unit || '').toLowerCase().replace(/^unit_/, '');
        return Number(stage) === 6 && unitKey.includes('curriculum_03');
    }

    window.revealAnswersFromNativeControl = function() {
        if (!isTeacher || !getUnit3RevealVideoSource() || teacherStageRevealed) return false;
        sfxClick();
        runUnit3RevealVideoThen(() => {
            fetch(`/api/admin/reveal?unit=${activeUnit}&stage=${currentStage}&role=teacher`)
                .then(res => res.json())
                .then(data => updateStatsUI(data));
        });
        return true;
    };

    function startUnit3Stage3OptionShowcase() {
        const moduleNumber = getCurriculum03ModuleNumber(activeUnit, currentModuleCode) ||
            getCurriculum03DisplayModuleNumber(activeUnit, currentStage);
        const isUnit3Bulimia = moduleNumber === 4;
        if (!isUnit3Bulimia) return false;

        const overlay = document.getElementById('unit3Stage3VideoOverlay');
        const video = document.getElementById('unit3Stage3OptionVideo');
        const label = document.getElementById('unit3Stage3VideoLabel');
        const narration = document.getElementById('unit3Stage3VideoNarration');
        const status = document.getElementById('unit3Stage3VideoStatus');
        const retryButton = document.getElementById('unit3Stage3VideoRetry');
        if (!overlay || !video || !label || !narration || !status || !retryButton) {
            console.error('單元三選項影片介面未完整載入');
            return false;
        }

        const optionsGridEl = document.getElementById('optionsGrid');
        const choicesArea = document.getElementById('rpgChoicesArea');
        if (optionsGridEl) optionsGridEl.classList.add('hidden');
        if (choicesArea) choicesArea.classList.add('hidden');
        if (dialogIndicator) dialogIndicator.textContent = '🎬 正在依序播放選項 A 至 D，請觀看並聆聽。';

        const clips = [
            {
                label: '選項 A',
                src: 'assets/unit3_stage3_option_a.mp4',
                voiceSrc: 'assets/voice/curriculum_03_stage3_opt_a.mp3',
                text: '個案重複發生暴食現象，在一段獨立時間內（如 2 小時）吃下很大量食物'
            },
            {
                label: '選項 B',
                src: 'assets/unit3_stage3_option_b.mp4',
                voiceSrc: 'assets/voice/curriculum_03_stage3_opt_b.mp3',
                text: '體重顯著下降，且對自己身材的纖瘦沒有感覺'
            },
            {
                label: '選項 C',
                src: 'assets/unit3_stage3_option_c.mp4',
                voiceSrc: 'assets/voice/curriculum_03_stage3_opt_c.mp3',
                text: '個案常催吐、不當使用瀉劑或利尿劑，易造成貧血'
            },
            {
                label: '選項 D',
                src: 'assets/unit3_stage3_option_d.mp4',
                voiceSrc: 'assets/voice/curriculum_03_stage3_opt_d.mp3',
                text: '個案常發生皮膚乾燥、營養不良等問題，應即時補充熱量與蛋白質等'
            }
        ];
        const runId = ++unit3Stage3VideoRun;
        let clipIndex = 0;
        unit3Stage3NarrationActive = true;
        overlay.classList.remove('hidden');
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');
        if (rpgBgmAudio && bgmPlaying) {
            rpgBgmAudio.volume = bgmUsesHospitalTrack ? 0.06 : 0.15;
        }

        stopAllQuestionVoice();
        isQuestionVoicePlaying = true;
        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '⏹ 停止朗讀';
            btnReplayQuestionVoice.classList.add('playing');
        }

        const finishShowcase = () => {
            if (runId !== unit3Stage3VideoRun) return;
            video.pause();
            video.onended = null;
            video.onerror = null;
            overlay.classList.add('hidden');
            unit3Stage3NarrationActive = false;
            if (optionsGridEl) optionsGridEl.classList.remove('hidden');
            if (choicesArea) choicesArea.classList.remove('hidden');
            if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmBaseVolume;
            if (dialogIndicator) dialogIndicator.textContent = '🎬 選項影片播放完畢，請進行作答或等候教師公布答案。';
            isQuestionVoicePlaying = false;
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                btnReplayQuestionVoice.classList.remove('playing');
            }
        };

        const playClip = () => {
            if (runId !== unit3Stage3VideoRun || clipIndex >= clips.length) {
                finishShowcase();
                return;
            }

            const clip = clips[clipIndex];
            label.textContent = clip.label;
            narration.textContent = clip.text;
            status.textContent = '';
            retryButton.classList.add('hidden');
            video.src = clip.src;
            video.load();

            let videoEnded = false;
            let audioEnded = false;

            const checkAdvance = () => {
                if (runId !== unit3Stage3VideoRun) return;

                if (clipIndex < clips.length - 1) {
                    // 選項 A、B、C 語音朗讀完畢即刻無縫切換至下一個選項（0 延遲）
                    if (!audioEnded) return;
                    clipIndex += 1;
                    playClip();
                } else {
                    // 選項 D 必須等語音完整朗讀完畢，才進入題目說明
                    if (!audioEnded) return;
                    finishShowcase();
                }
            };

            // 播放該選項專屬語音 (A, B, C, D 獨立精準音檔)
            if (npcQuestionVoiceAudio && clip.voiceSrc) {
                npcQuestionVoiceAudio.src = clip.voiceSrc + '?t=' + Date.now();
                npcQuestionVoiceAudio.currentTime = 0;
                npcQuestionVoiceAudio.onended = () => {
                    audioEnded = true;
                    checkAdvance();
                };
                npcQuestionVoiceAudio.onerror = () => {
                    audioEnded = true;
                    checkAdvance();
                };
                const p = npcQuestionVoiceAudio.play();
                if (p && p.catch) p.catch(() => {
                    audioEnded = true;
                    checkAdvance();
                });
            } else {
                audioEnded = true;
            }

            video.onended = () => {
                videoEnded = true;
                checkAdvance();
            };
            video.onerror = () => {
                if (runId !== unit3Stage3VideoRun) return;
                console.error('單元三選項影片載入失敗', video.error);
                videoEnded = true;
                audioEnded = true;
                checkAdvance();
            };

            const playVideo = () => {
                const playResult = video.play();
                if (playResult && typeof playResult.catch === 'function') {
                    playResult.then(() => {
                        if (runId === unit3Stage3VideoRun) {
                            status.textContent = '';
                            retryButton.classList.add('hidden');
                        }
                    }).catch(error => {
                        if (runId !== unit3Stage3VideoRun) return;
                        console.error('單元三選項影片自動播放失敗', error);
                        status.textContent = '影片無法自動播放，請點擊按鈕繼續。';
                        retryButton.classList.remove('hidden');
                    });
                }
            };
            retryButton.onclick = () => {
                if (runId !== unit3Stage3VideoRun) return;
                retryButton.classList.add('hidden');
                if (npcQuestionVoiceAudio && clip.voiceSrc) {
                    npcQuestionVoiceAudio.src = clip.voiceSrc + '?t=' + Date.now();
                    npcQuestionVoiceAudio.currentTime = 0;
                    npcQuestionVoiceAudio.play().catch(() => {});
                }
                playVideo();
            };
            playVideo();
        };
        playClip();
        return true;
    }

    function isKidneyStage2IntroTarget(unit = activeUnit, stage = currentStage) {
        return String(unit || '').toLowerCase().includes('curriculum_07') && Number(stage) === 2;
    }

    function isKidneyStage3IntroTarget(unit = activeUnit, stage = currentStage) {
        return String(unit || '').toLowerCase().includes('curriculum_07') && Number(stage) === 3;
    }

    function isKidneyStage4IntroTarget(unit = activeUnit, stage = currentStage) {
        return String(unit || '').toLowerCase().includes('curriculum_07') && Number(stage) === 5;
    }

    function setKidneyStage2QuestionBackground() {
        document.body.classList.add('kidney-stage2-question-active');
        const stageBackdrop = document.getElementById('stageBackdrop');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const optionsGrid = document.getElementById('optionsGrid');
        const choicesArea = document.getElementById('rpgChoicesArea');
        const dialogBox = document.getElementById('dialogBox');
        if (stageBackdrop) {
            stageBackdrop.className = 'stage-backdrop kidney-stage2-question-theme';
            stageBackdrop.style.setProperty('background-image', "url('assets/kidney_stage2_question_bg_final.png')", 'important');
            stageBackdrop.style.setProperty('background-size', 'contain', 'important');
            stageBackdrop.style.setProperty('background-position', 'center center', 'important');
            stageBackdrop.style.setProperty('background-repeat', 'no-repeat', 'important');
            stageBackdrop.style.setProperty('background-color', '#f7f0df', 'important');
        }
        if (charNurse) charNurse.classList.add('hidden');
        if (charStudent) charStudent.classList.add('hidden');
        if (optionsGrid) optionsGrid.classList.remove('hidden');
        if (choicesArea) choicesArea.classList.remove('hidden');
        if (dialogBox) dialogBox.classList.add('hidden');
    }

    function setKidneyStage3QuestionBackground() {
        const stageBackdrop = document.getElementById('stageBackdrop');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        if (stageBackdrop) {
            stageBackdrop.className = 'stage-backdrop kidney-stage3-theme';
            stageBackdrop.style.setProperty('background-image', "url('assets/kidney_stage3_question_custom.png')", 'important');
            stageBackdrop.style.setProperty('background-size', 'contain', 'important');
            stageBackdrop.style.setProperty('background-position', 'center center', 'important');
            stageBackdrop.style.setProperty('background-repeat', 'no-repeat', 'important');
            stageBackdrop.style.setProperty('background-color', '#f6e4c8', 'important');
        }
        if (charNurse) charNurse.classList.add('hidden');
        if (charStudent) charStudent.classList.add('hidden');
    }

    function setKidneyStage4QuestionBackground() {
        const stageBackdrop = document.getElementById('stageBackdrop');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        if (stageBackdrop) {
            stageBackdrop.className = 'stage-backdrop kidney-stage4-theme';
            stageBackdrop.style.setProperty('background-image', "url('assets/kidney_stage3_video_final_frame.png')", 'important');
            stageBackdrop.style.setProperty('background-size', '100% 100%', 'important');
            stageBackdrop.style.setProperty('background-position', 'center center', 'important');
            stageBackdrop.style.setProperty('background-repeat', 'no-repeat', 'important');
        }
        if (charNurse) charNurse.classList.add('hidden');
        if (charStudent) charStudent.classList.add('hidden');
    }

    function stopKidneyStage3Intro() {
        if (cancelKidneyStage3Intro) cancelKidneyStage3Intro();
        kidneyStage3IntroPending = false;
        cancelKidneyStage3Intro = null;
    }

    function stopKidneyStage4Intro() {
        if (cancelKidneyStage4Intro) cancelKidneyStage4Intro();
        kidneyStage4IntroPending = false;
        cancelKidneyStage4Intro = null;
    }

    function startKidneyStage3Intro(loadVersion) {
        if (!isKidneyStage3IntroTarget(activeUnit, currentStage)) return;
        const overlay = document.getElementById('kidneyStage3IntroOverlay');
        const video = document.getElementById('kidneyStage3IntroVideo');
        const status = document.getElementById('kidneyStage3IntroStatus');
        const retryButton = document.getElementById('kidneyStage3IntroRetry');
        const optionsGrid = document.getElementById('optionsGrid');
        const choicesArea = document.getElementById('rpgChoicesArea');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        if (!overlay || !video || !status || !retryButton) {
            console.error('單元七第 3 題影片介面未完整載入');
            return;
        }

        kidneyStage3IntroPending = true;
        if (optionsGrid) optionsGrid.classList.add('hidden');
        if (choicesArea) choicesArea.classList.add('hidden');
        if (bottomPanel) bottomPanel.classList.add('hidden');
        if (charNurse) charNurse.classList.add('hidden');
        if (charStudent) charStudent.classList.add('hidden');
        if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.style.setProperty('visibility', 'visible', 'important');
        overlay.style.setProperty('opacity', '1', 'important');
        video.controls = true;
        video.muted = false;
        video.volume = 1;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');
        video.src = 'assets/kidney_stage3_intro_custom.mp4';

        const showPlaybackError = error => {
            if (loadVersion !== stageLoadVersion) return;
            if (error) console.error('單元七第 3 題影片播放失敗', error);
            status.textContent = '影片無法自動播放，請點擊按鈕播放題目影片。';
            retryButton.classList.remove('hidden');
        };
        const finish = () => {
            if (loadVersion !== stageLoadVersion || !isKidneyStage3IntroTarget(activeUnit, currentStage)) return;
            video.pause();
            video.onended = null;
            video.onerror = null;
            retryButton.onclick = null;
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
            status.textContent = '';
            retryButton.classList.add('hidden');
            kidneyStage3IntroPending = false;
            cancelKidneyStage3Intro = null;
            setKidneyStage3QuestionBackground();
            if (optionsGrid) optionsGrid.classList.remove('hidden');
            if (choicesArea) choicesArea.classList.remove('hidden');
            if (bottomPanel) bottomPanel.classList.remove('hidden');
            playQuestionVoice(activeUnit, currentStage, currentModuleCode);
        };
        video.onended = finish;
        video.onerror = () => showPlaybackError(video.error);
        const play = () => {
            if (loadVersion !== stageLoadVersion || !isKidneyStage3IntroTarget(activeUnit, currentStage)) return;
            status.textContent = '';
            retryButton.classList.add('hidden');
            const startPlayback = () => {
                if (loadVersion !== stageLoadVersion || !isKidneyStage3IntroTarget(activeUnit, currentStage)) return;
                video.currentTime = 0;
                const playResult = video.play();
                if (playResult && typeof playResult.catch === 'function') {
                    playResult.catch(() => {
                        if (loadVersion !== stageLoadVersion || !isKidneyStage3IntroTarget(activeUnit, currentStage)) return;
                        video.muted = true;
                        const mutedPlayResult = video.play();
                        if (mutedPlayResult && typeof mutedPlayResult.catch === 'function') {
                            mutedPlayResult.catch(showPlaybackError);
                        }
                    });
                }
            };
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                startPlayback();
            } else {
                video.addEventListener('loadedmetadata', startPlayback, { once: true });
            }
        };
        retryButton.onclick = play;
        cancelKidneyStage3Intro = () => {
            video.pause();
            video.onended = null;
            video.onerror = null;
            retryButton.onclick = null;
            video.removeAttribute('src');
            video.load();
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
        };
        video.load();
        play();
    }

    function startKidneyStage4Intro(loadVersion) {
        if (!isKidneyStage4IntroTarget(activeUnit, currentStage)) return;
        const overlay = document.getElementById('kidneyStage4IntroOverlay') || document.getElementById('kidneyStage3IntroOverlay');
        const video = document.getElementById('kidneyStage4IntroVideo') || document.getElementById('kidneyStage3IntroVideo');
        const status = document.getElementById('kidneyStage4IntroStatus') || document.getElementById('kidneyStage3IntroStatus');
        const retryButton = document.getElementById('kidneyStage4IntroRetry') || document.getElementById('kidneyStage3IntroRetry');
        const optionsGrid = document.getElementById('optionsGrid');
        const choicesArea = document.getElementById('rpgChoicesArea');
        const bottomPanel = document.getElementById('rpgBottomPanel');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        if (!overlay || !video || !status || !retryButton) {
            console.error('單元七第 4 題影片介面未完整載入');
            return;
        }

        kidneyStage4IntroPending = true;
        if (optionsGrid) optionsGrid.classList.add('hidden');
        if (choicesArea) choicesArea.classList.add('hidden');
        if (bottomPanel) bottomPanel.classList.add('hidden');
        if (charNurse) charNurse.classList.add('hidden');
        if (charStudent) charStudent.classList.add('hidden');
        if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.style.setProperty('visibility', 'visible', 'important');
        overlay.style.setProperty('opacity', '1', 'important');
        video.controls = true;
        video.muted = false;
        video.volume = 1;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');
        video.src = 'assets/kidney_stage3_intro.mp4';

        const showPlaybackError = error => {
            if (loadVersion !== stageLoadVersion) return;
            if (error) console.error('單元七第 4 題影片播放失敗', error);
            status.textContent = '影片無法自動播放，請點擊按鈕播放題目影片。';
            retryButton.classList.remove('hidden');
        };
        const finish = () => {
            if (loadVersion !== stageLoadVersion || !isKidneyStage4IntroTarget(activeUnit, currentStage)) return;
            video.pause();
            video.onended = null;
            video.onerror = null;
            retryButton.onclick = null;
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
            status.textContent = '';
            retryButton.classList.add('hidden');
            kidneyStage4IntroPending = false;
            cancelKidneyStage4Intro = null;
            setKidneyStage4QuestionBackground();
            if (optionsGrid) optionsGrid.classList.remove('hidden');
            if (choicesArea) choicesArea.classList.remove('hidden');
            if (bottomPanel) bottomPanel.classList.remove('hidden');
            playQuestionVoice(activeUnit, currentStage, currentModuleCode);
        };
        video.onended = finish;
        video.onerror = () => showPlaybackError(video.error);
        const play = () => {
            if (loadVersion !== stageLoadVersion || !isKidneyStage4IntroTarget(activeUnit, currentStage)) return;
            status.textContent = '';
            retryButton.classList.add('hidden');
            const startPlayback = () => {
                if (loadVersion !== stageLoadVersion || !isKidneyStage4IntroTarget(activeUnit, currentStage)) return;
                video.currentTime = 0;
                const playResult = video.play();
                if (playResult && typeof playResult.catch === 'function') {
                    playResult.catch(() => {
                        if (loadVersion !== stageLoadVersion || !isKidneyStage4IntroTarget(activeUnit, currentStage)) return;
                        video.muted = true;
                        const mutedPlayResult = video.play();
                        if (mutedPlayResult && typeof mutedPlayResult.catch === 'function') {
                            mutedPlayResult.catch(showPlaybackError);
                        }
                    });
                }
            };
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                startPlayback();
            } else {
                video.addEventListener('loadedmetadata', startPlayback, { once: true });
            }
        };
        retryButton.onclick = play;
        cancelKidneyStage4Intro = () => {
            video.pause();
            video.onended = null;
            video.onerror = null;
            retryButton.onclick = null;
            video.removeAttribute('src');
            video.load();
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
        };
        video.load();
        play();
    }

    function syncKidneyStage2IntroPresentation(loadVersion, stageNum) {
        if (loadVersion !== stageLoadVersion || !isKidneyStage2IntroTarget(activeUnit, stageNum)) return;
        document.body.classList.add('kidney-stage2-question-active');
        const optionsGrid = document.getElementById('optionsGrid');
        const choicesArea = document.getElementById('rpgChoicesArea');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        const dialogBox = document.getElementById('dialogBox');
        if (dialogBox) dialogBox.classList.add('hidden');
        if (kidneyStage2IntroPending) {
            if (optionsGrid) optionsGrid.classList.add('hidden');
            if (choicesArea) choicesArea.classList.add('hidden');
            if (charNurse) charNurse.classList.add('hidden');
            if (charStudent) charStudent.classList.add('hidden');
        } else if (kidneyStage2IntroCompleted) {
            setKidneyStage2QuestionBackground();
        }
    }

    function stopKidneyStage2Intro() {
        if (cancelKidneyStage2Intro) cancelKidneyStage2Intro();
        kidneyStage2IntroPending = false;
        kidneyStage2IntroCompleted = false;
        cancelKidneyStage2Intro = null;
    }

    function startKidneyStage2Intro(loadVersion) {
        if (!isKidneyStage2IntroTarget(activeUnit, currentStage)) return;
        const overlay = document.getElementById('kidneyStage2IntroOverlay');
        const video = document.getElementById('kidneyStage2IntroVideo');
        const status = document.getElementById('kidneyStage2IntroStatus');
        const retryButton = document.getElementById('kidneyStage2IntroRetry');
        const optionsGrid = document.getElementById('optionsGrid');
        const choicesArea = document.getElementById('rpgChoicesArea');
        const charNurse = document.getElementById('charNurse');
        const charStudent = document.getElementById('charStudent');
        if (!overlay || !video || !status || !retryButton) {
            console.error('單元七第 2 題影片介面未完整載入');
            return;
        }

        kidneyStage2IntroPending = true;
        kidneyStage2IntroCompleted = false;
        if (optionsGrid) optionsGrid.classList.add('hidden');
        if (choicesArea) choicesArea.classList.add('hidden');
        if (charNurse) charNurse.classList.add('hidden');
        if (charStudent) charStudent.classList.add('hidden');
        if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
        overlay.classList.remove('hidden');
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.style.setProperty('visibility', 'visible', 'important');
        overlay.style.setProperty('opacity', '1', 'important');
        video.controls = true;
        video.muted = false;
        video.volume = 1;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');
        video.src = 'assets/kidney_stage2_intro.mp4';

        const showPlaybackError = error => {
            if (loadVersion !== stageLoadVersion) return;
            if (error) console.error('單元七第 2 題影片播放失敗', error);
            status.textContent = '影片無法自動播放，請點擊按鈕播放題目影片。';
            retryButton.classList.remove('hidden');
        };
        const finish = () => {
            if (loadVersion !== stageLoadVersion || !isKidneyStage2IntroTarget(activeUnit, currentStage)) return;
            video.pause();
            video.onended = null;
            video.onerror = null;
            retryButton.onclick = null;
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
            status.textContent = '';
            retryButton.classList.add('hidden');
            kidneyStage2IntroPending = false;
            kidneyStage2IntroCompleted = true;
            cancelKidneyStage2Intro = null;
            setKidneyStage2QuestionBackground();
        };
        video.onended = finish;
        video.onerror = () => showPlaybackError(video.error);
        const setAmplifiedAudio = () => {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('此瀏覽器不支援影片音訊增益，將以一般音量播放');
                video.volume = 1;
                return Promise.resolve();
            }
            try {
                if (!kidneyStage2AudioContext) {
                    kidneyStage2AudioContext = new AudioContextClass();
                    kidneyStage2AudioSource = kidneyStage2AudioContext.createMediaElementSource(video);
                    kidneyStage2AudioGain = kidneyStage2AudioContext.createGain();
                    kidneyStage2AudioSource.connect(kidneyStage2AudioGain);
                    kidneyStage2AudioGain.connect(kidneyStage2AudioContext.destination);
                }
                video.volume = 1;
                kidneyStage2AudioGain.gain.setValueAtTime(1.5, kidneyStage2AudioContext.currentTime);
                return kidneyStage2AudioContext.state === 'suspended'
                    ? kidneyStage2AudioContext.resume()
                    : Promise.resolve();
            } catch (error) {
                console.error('無法設定單元七第 2 題影片音訊增益', error);
                return Promise.reject(error);
            }
        };
        const play = () => {
            status.textContent = '';
            retryButton.classList.add('hidden');
            video.currentTime = 0;
            setAmplifiedAudio()
                .then(() => video.play())
                .catch(showPlaybackError);
        };
        retryButton.onclick = play;
        cancelKidneyStage2Intro = () => {
            video.pause();
            video.onended = null;
            video.onerror = null;
            retryButton.onclick = null;
            video.removeAttribute('src');
            video.load();
            overlay.classList.add('hidden');
            overlay.style.removeProperty('display');
            overlay.style.removeProperty('visibility');
            overlay.style.removeProperty('opacity');
        };
        video.load();
        play();
    }

    function loadStage(stageNum) {
        const unitForLoad = activeUnit;
        setSupportStage10AnatomyVisible(false);
        if (!unitDefinitions[unitForLoad] && unitStageCounts[unitForLoad]) {
            currentUnitConf.maxStages = unitStageCounts[unitForLoad];
        }
        if (!isFileProtocol && !unitDefinitions[unitForLoad] && !unitStageCounts[unitForLoad]) {
            pendingStageByUnit[unitForLoad] = stageNum;
            if (!unitStageCountRequests[unitForLoad]) {
                unitStageCountRequests[unitForLoad] = fetch(`/api/status?unit=${encodeURIComponent(unitForLoad)}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`讀取單元題數失敗：HTTP ${res.status}`);
                        return res.json();
                    })
                    .then(data => {
                        const stageCount = Number(data.maxStages);
                        if (!Number.isInteger(stageCount) || stageCount < 1) {
                            throw new Error(`單元「${unitForLoad}」未取得有效題數`);
                        }
                        unitStageCounts[unitForLoad] = stageCount;
                        if (activeUnit === unitForLoad) {
                            currentUnitConf.maxStages = stageCount;
                            loadStage(pendingStageByUnit[unitForLoad] || stageNum);
                        }
                    })
                    .catch(error => {
                        console.error(`無法載入單元「${unitForLoad}」的題數`, error);
                        if (activeUnit === unitForLoad && questionFeedbackBanner) {
                            questionFeedbackBanner.className = 'feedback-banner pending';
                            questionFeedbackBanner.textContent = '單元題數載入失敗，請重新整理後再試。';
                            questionFeedbackBanner.classList.remove('hidden');
                        }
                    })
                    .then(() => {
                        delete unitStageCountRequests[unitForLoad];
                        delete pendingStageByUnit[unitForLoad];
                    });
            }
            return;
        }

        const loadVersion = ++stageLoadVersion;
        stopKidneyStage2Intro();
        stopKidneyStage3Intro();
        stopKidneyStage4Intro();
        currentModuleCode = '';
        stopUnit3Stage3OptionShowcase();
        if (cancelUnit3RevealVideo) cancelUnit3RevealVideo();
        unit3RevealVideoCompleted = false;
        lastStageNavigationAt = Date.now();
        isInPrologue = false;
        currentStage = stageNum;
        // 清除單元一第 7 題周天子的行內縮放，避免離開題目後影響其他關卡。
        if (!(activeUnit === 'must' && Number(stageNum) === 7)) {
            if (charNurse) charNurse.style.removeProperty('transform');
            const nurseSprite = charNurse ? charNurse.querySelector('.char-sprite') : null;
            if (nurseSprite) nurseSprite.style.removeProperty('max-height');
            if (charStudent) charStudent.style.removeProperty('transform');
            const studentSprite = charStudent ? charStudent.querySelector('.char-sprite') : null;
            if (studentSprite) studentSprite.style.removeProperty('max-height');
        }
        document.body.classList.toggle(
            'kidney-stage2-question-active',
            isKidneyStage2IntroTarget(activeUnit, stageNum)
        );
        const kidneyStageBanner = document.getElementById('patientBanner');
        if (activeUnit.includes('curriculum_07') && kidneyStageBanner) {
            const kidneyUnit = resolveUnitConfig(activeUnit);
            const bannerInfo = Number(stageNum) === 6
                ? `<span class="p-name"><strong>腎臟疾病之營養治療 ‧ 透析乾體重評估</strong></span><span class="p-metrics">主責醫師：<strong>高健宇 主治醫師</strong></span>`
                : Number(stageNum) === 5
                ? `<span class="p-name"><strong>腎臟疾病之營養治療 ‧ 末期腎病致病因子評估</strong></span><span class="p-metrics">主責醫師：<strong>江柏叡 主任醫師</strong></span>`
                : Number(stageNum) === 4
                ? `<span class="p-name"><strong>腎臟疾病之營養治療 ‧ Stage 4 營養素限制評估</strong></span><span class="p-metrics">主責講師：<strong>臨床營養師</strong></span>`
                : Number(stageNum) === 3
                ? `<span class="p-name"><strong>腎臟疾病之營養治療 ‧ CKD G3b期飲食處方評估</strong></span><span class="p-metrics">主責醫師：<strong>江柏叡 主任醫師</strong></span>`
                : Number(stageNum) === 2
                ? `<span class="p-name"><strong>腎臟疾病之營養治療 ‧ CKD 分期評估</strong></span><span class="p-metrics">主責醫師：<strong>江柏叡 主任醫師</strong></span>`
                : kidneyUnit.bannerInfo;
            kidneyStageBanner.innerHTML = `
                <div class="banner-badge">${kidneyUnit.badge}</div>
                <div class="banner-info">${bannerInfo}</div>
            `;
        }
        if (dialogBox) {
            dialogBox.classList.toggle('hidden', isKidneyStage2IntroTarget(activeUnit, stageNum) || isKidneyStage3IntroTarget(activeUnit, stageNum) || isKidneyStage4IntroTarget(activeUnit, stageNum));
        }
        if (isKidneyStage2IntroTarget(activeUnit, stageNum)) {
            startKidneyStage2Intro(loadVersion);
        } else if (isKidneyStage3IntroTarget(activeUnit, stageNum)) {
            startKidneyStage3Intro(loadVersion);
        } else if (isKidneyStage4IntroTarget(activeUnit, stageNum)) {
            startKidneyStage4Intro(loadVersion);
        }
        if (isTeacher && activeUnit === 'support') {
            // 單元二第 6 題教師端的實習營養師對話，預設使用男性角色。
            selectedGender = Number(stageNum) === 6 ? 'male' : 'female';
        }
        updateSupportStageHeader(stageNum);
        if (activeUnit === 'support') {
            const progress = document.getElementById('stageIndicatorBar');
            if (progress) {
                const hideProgress = Number(stageNum) === 10;
                progress.classList.toggle('hidden', hideProgress);
                if (hideProgress) progress.style.setProperty('display', 'none', 'important');
                else progress.style.removeProperty('display');
            }
            const legacyNgHud = document.getElementById('sciFiNgHudWidget');
            if (legacyNgHud) legacyNgHud.classList.toggle('hidden', Number(stageNum) !== 1);
            const patientBannerEl = document.getElementById('patientBanner');
            if (patientBannerEl) patientBannerEl.classList.toggle('hidden', Number(stageNum) === 10);
        }
        renderedStage = stageNum;
        renderedUnit = activeUnit;
        supportStage11QuestionReady = false;
        supportStage11QuestionVoiceStarted = false;
        configureBgmForStage(activeUnit, stageNum);
        configureSupportStage11VideoBackdrop(stageNum, true);
        stopDmStage8StudentVideo();
        studentSelectedOption = null;
        resetFormulaFeedingAnimation();
        alreadyRevealedThisStage = false;
        dmStage8VideoShown = false;
        dmStage8VideoBgmWasPlaying = false;
        fatalOverlayClosedByUser = false;
        fatalAspirationTriggered = false;
        grandmaThankTriggered = false;
        grandmaThankDismissed = false;
        kingDismissalTriggered = false;
        isStageLocked = false;
        teacherStagePhase = 0;
        teacherStageRevealed = false;
        if (typeof applyKidneyMobaAnswerReveal === 'function') {
            applyKidneyMobaAnswerReveal('2', false);
        }
        pendingAnswerResult = null;
        
        supportStage2Step = (urlParams.get('step') !== null) ? parseInt(urlParams.get('step')) : 0;
        supportStage4Step = 0;
        supportStage6Step = 0;
        supportStage8Step = 0;
        mustStage7Step = (urlParams.get('step') !== null) ? parseInt(urlParams.get('step')) : 0;
        newStudentTrialStep = (urlParams.get('step') !== null) ? parseInt(urlParams.get('step')) : 0;
        detectiveStage12Step = (urlParams.get('step') !== null) ? parseInt(urlParams.get('step')) : 0;
        if (btnProceedNextTxt && isTeacher) btnProceedNextTxt.textContent = '💡 公布正確答案與臨床解析 ➔';
        questionFeedbackBanner.classList.add('hidden');
        questionFeedbackBanner.textContent = '';
        closeAllModals();

        const optionsGridEl = document.getElementById('optionsGrid');
        let rpgChoicesAreaEl = document.getElementById('rpgChoicesArea');
        const sliderStatsBoard = document.getElementById('sliderBattleStatsBoard');
        const dragonBossArena = document.getElementById('dragonBossArena');
        const a1cLiftingWidget = document.getElementById('a1cLiftingWidget');
        const choicePrompt = document.getElementById('choiceHeaderPrompt');
        const labWidget = document.getElementById('dmStage6LabWidget');
        const ngHudWidget = document.getElementById('sciFiNgHudWidget');
        const arcaneWidget = document.getElementById('arcaneEagWidget');
        if (labWidget) labWidget.classList.add('hidden');
        const trialBgStartArea = document.getElementById('trialBgStartArea');
        if (trialBgStartArea) {
            trialBgStartArea.classList.add('hidden');
            trialBgStartArea.style.setProperty('display', 'none', 'important');
        }
        const characterStageEl = document.getElementById('characterStage');
        const teacherImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
        const nurseTag = document.getElementById('charTeacherName') || document.querySelector('#charNurse .char-nametag');
        const fyuIcon = document.getElementById('fyuHeaderIcon') || document.querySelector('.cross-icon');
        const fyuTitle = document.querySelector('.fyu-title');
        const fyuSub = document.querySelector('.fyu-sub');

        const stageBackdropEl = document.getElementById('stageBackdrop');
        document.documentElement.classList.remove('trial-route');
        document.body.classList.remove('trial-step-0', 'trial-dialog-step', 'unit-new_student_trial', 'health-continent-active', 'sports-stage-active', 'sports-quiz-step');
        if (activeUnit === 'must') {
            document.body.classList.add('unit-must');
        }
        if (dragonBossArena && activeUnit !== 'dm') {
            dragonBossArena.classList.add('hidden');
            dragonBossArena.style.setProperty('display', 'none', 'important');
        }
        if (a1cLiftingWidget && activeUnit !== 'dm') {
            a1cLiftingWidget.classList.add('hidden');
            a1cLiftingWidget.style.setProperty('display', 'none', 'important');
        }
        const sportsQuizAreaEl = document.getElementById('sportsQuizArea');
        if (sportsQuizAreaEl) {
            sportsQuizAreaEl.classList.add('hidden');
            sportsQuizAreaEl.style.setProperty('display', 'none', 'important');
        }
        if (stageBackdropEl) {
            const oldKidneyStoneOptions = stageBackdropEl.querySelector('.kidney-stage3-stone-options');
            if (oldKidneyStoneOptions) oldKidneyStoneOptions.remove();
            stageBackdropEl.classList.remove('chen-angry-red-mode', 'aspiration-flatline-grayscale', 'formula-wrong-outcome', 'formula-answer-revealed', 'support-stage2-expanded', 'support-stage4-theme', 'support-formula-theme', 'support-stage10-theme', 'health-continent-theme', 'sports-gym-theme');
            stageBackdropEl.classList.remove('icu-tpn-theme', 'protein-question-theme', 'protein-answer-revealed', 'bulimia-question-theme', 'anorexia-counseling-theme', 'unit3-stage4-anorexia-theme', 'kidney-stage2-question-theme');
            const oldProteinOverlay = stageBackdropEl.querySelector('.protein-options-overlay');
            if (oldProteinOverlay) oldProteinOverlay.remove();
            const oldBulimiaOverlay = stageBackdropEl.querySelector('.bulimia-options-overlay');
            if (oldBulimiaOverlay) oldBulimiaOverlay.remove();
            stageBackdropEl.style.removeProperty('background-image');
            stageBackdropEl.style.removeProperty('background-size');
            stageBackdropEl.style.removeProperty('background-position');
            stageBackdropEl.style.removeProperty('background-color');
        }
        const isContinentView = document.body.classList.contains('health-continent-active') ||
            ((activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) && newStudentTrialStep >= 4 && !isMedicalCityActive && !activeContinentStageKey);
        if (isContinentView) {
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        } else {
            if (optionsGridEl) optionsGridEl.classList.remove('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
        }
        if (activeUnit === 'support' && Number(stageNum) === 10) {
            if (stageBackdropEl) stageBackdropEl.classList.add('support-stage10-theme');
            setSupportStage10AnatomyVisible(true);
            updateSupportStage10AnatomySelection(
                studentSelectedOption,
                MODULE_TEMPLATES.SUPPORT_STAGE_10.correctKey,
                teacherStageRevealed || isStageLocked
            );
        }
        const holoPod = document.getElementById('dialogNgHoloContainer');
        const isSupportStage1Init = (activeUnit === 'support' && Number(stageNum) === 1);
        if (holoPod) holoPod.classList.toggle('hidden', !isSupportStage1Init);
        if (ngHudWidget) ngHudWidget.classList.toggle('hidden', !isSupportStage1Init);
        if (isSupportStage1Init) {
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
            const charStudentEl = document.getElementById('charStudent');
            if (charStudentEl) charStudentEl.classList.add('hidden');
        }
        const fatalOverlay = document.getElementById('fatalAspirationOverlay');
        if (fatalOverlay) fatalOverlay.classList.add('hidden');
        document.querySelectorAll('.rpg-choice-btn, .scifi-opt-btn, .arcane-opt-btn, .table-food-item, .kidney-portal-zone').forEach(b => {
            b.classList.remove('disabled-lock', 'selected', 'opt-locked', 'rune-selected', 'rune-correct', 'is-correct-answer', 'is-wrong-answer', 'scifi-correct', 'highest-voted', 'correct-food-pulse', 'wrong-food-shake', 'hero-near');
            b.style.pointerEvents = 'auto';
        });
        document.querySelectorAll('.table-food-vote-pill, .portal-vote-pill').forEach(pill => {
            pill.textContent = '0.0% (0票)';
        });
        document.querySelectorAll('.scifi-opt-btn').forEach(b => {
            const key = b.dataset.key;
            const pct = b.querySelector('.choice-pct') || b.querySelector(`#scifi_pct_${key}`);
            const cnt = b.querySelector('.choice-cnt') || b.querySelector(`#scifi_cnt_${key}`);
            const fill = b.querySelector('.choice-fill') || b.querySelector(`#scifi_fill_${key}`);
            const crown = b.querySelector('.choice-crown') || b.querySelector(`#scifi_crown_${key}`);
            if (pct) pct.textContent = '0%';
            if (cnt) cnt.textContent = '(0票)';
            if (fill) fill.style.width = '0%';
            if (crown) crown.classList.add('hidden');
        });

        // 徹底重置與停止先前任何可能正在播放的語音 (避免回上一關或跳題時聲音重疊或變音)
        if (npcQuestionVoiceAudio) {
            npcQuestionVoiceAudio.pause();
            npcQuestionVoiceAudio.currentTime = 0;
        }
        if (grandmaVoiceAudio) {
            grandmaVoiceAudio.pause();
            grandmaVoiceAudio.currentTime = 0;
        }
        try {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch(e) {}

        if (btnReplayQuestionVoice) {
            const isSupport2Student = !isTeacher && (activeUnit === 'support' || String(activeUnit).includes('support')) && Number(stageNum) === 2;
            const isDm10Student = !isTeacher && (activeUnit === 'dm' || String(activeUnit).includes('dm')) && Number(stageNum) === 10;
            if (isSupport2Student || isDm10Student) {
                btnReplayQuestionVoice.classList.add('hidden');
            } else {
                btnReplayQuestionVoice.classList.remove('hidden');
            }
        }

        teacherStageRevealed = false;
        if (isTeacher) {
            fetch(`/api/admin/set_stage?stage=${stageNum}&unit=${activeUnit}&role=teacher`).catch(() => {});
        }

        const maxStDefined = (currentUnitConf && currentUnitConf.maxStages) ? currentUnitConf.maxStages : 4;
        if (stageNum >= 1 && stageNum <= maxStDefined) {
            leaderboardReturnStage = stageNum;
        }
        if (stageNum > maxStDefined) {
            currentStage = stageNum;
            triggerVictory();
            return;
        }

        if (!currentUnitConf.stages) {
            currentUnitConf.stages = {};
        }
        if (!currentUnitConf.stages[stageNum]) {
            currentUnitConf.stages[stageNum] = {
                title: currentUnitConf.isBlankPreparationUnit ? '' : `第 ${stageNum} 題（待編輯）`,
                speaker: currentUnitConf.isBlankPreparationUnit ? '' : (currentUnitConf.teacherName ? `【${currentUnitConf.teacherName}】` : '【授課教師】'),
                speakerRole: currentUnitConf.isBlankPreparationUnit ? '' : 'nurse',
                speech: currentUnitConf.isBlankPreparationUnit ? '' : `第 ${stageNum} 題內容尚未編輯。`,
                correctKey: '',
                options: [],
                revealExplanation: ''
            };
        }

        let stageData = currentUnitConf.stages[stageNum];
        const isNewStudentTrialStageNow = isNewStudentTrialUnit(activeUnit) && Number(stageNum) === 1;
        const isCurriculum03 = activeUnit.includes('curriculum_03') || activeUnit === 'curriculum_03' || activeUnit === 'unit_curriculum_03';
        const curriculum03DisplayModule = isCurriculum03
            ? (getCurriculum03DisplayModuleNumber(activeUnit, stageNum) || stageNum)
            : 0;
        const curriculum03Template = curriculum03DisplayModule
            ? MODULE_TEMPLATES[`CURRICULUM_03_STAGE_${curriculum03DisplayModule}`]
            : null;
        if (isCurriculum03 && curriculum03Template && curriculum03BaseStages[curriculum03DisplayModule]) {
            stageData = Object.assign(
                JSON.parse(JSON.stringify(curriculum03BaseStages[curriculum03DisplayModule])),
                JSON.parse(JSON.stringify(curriculum03Template))
            );
            currentUnitConf.stages[stageNum] = stageData;
            stageData.title = stageData.title.replace(/^第\s*\d+\s*題/, `第 ${stageNum} 題`);
        }
        const isCurriculum07 = activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07';
        if (isCurriculum07) {
            const modCode = `CURRICULUM_07_STAGE_${stageNum}`;
            const template = MODULE_TEMPLATES[modCode];
            if (template && curriculum07BaseStages && curriculum07BaseStages[stageNum]) {
                stageData = Object.assign(
                    JSON.parse(JSON.stringify(curriculum07BaseStages[stageNum])),
                    JSON.parse(JSON.stringify(template))
                );
                currentUnitConf.stages[stageNum] = stageData;
                stageData.title = stageData.title.replace(/^第\s*\d+\s*題/, `第 ${stageNum} 題`);
            }
        }
        const initialSliderBattleConfig = getSliderBattleConfig(stageData);
        if (initialSliderBattleConfig) {
            if (dragonBossArena) dragonBossArena.classList.remove('hidden');
            if (a1cLiftingWidget) a1cLiftingWidget.classList.remove('hidden');
            resetDragonBossState();
            configureSliderBattleWidget(stageData);
        }
        const isChenStage = (stageData && stageData.isLabMultiStage) || (stageData && stageData.speakerRole === 'chen') || (activeUnit.includes('bfbbb5') && (stageNum === 1 || stageNum === 2));
        if (isChenStage) {
            dmStage6Phase = 'dialog';
            if (labWidget) labWidget.classList.add('hidden');
        }
        const isArcaneStage = (stageData && stageData.isArcaneEagStage) || (stageData && stageData.speakerRole === 'arcane') || (activeUnit === 'dm' && stageNum === 8);
        const isDmStage2 = (activeUnit === 'dm' && stageNum === 2);
        const isDmStage3 = (activeUnit === 'dm' && stageNum === 3);
        const isDmStage4 = (activeUnit === 'dm' && stageNum === 4);
        const isDmStage5 = (activeUnit === 'dm' && stageNum === 5);
        const isDmStage11 = (activeUnit === 'dm' && stageNum === 11);
        const isZhouCourtStage = (activeUnit === 'must' && stageNum === 7) || (stageData && stageData.isZhouCourtStage);
        const isKingStage = (activeUnit === 'must' && stageNum === 7) || (stageData && stageData.isKingStage);
        const isDetectiveStage = (activeUnit === 'dm' && stageNum === 12) || (stageData && stageData.isDetectiveStage);
        const isNgHudStage = (activeUnit === 'support' && stageNum === 1) || (stageData && stageData.isNgHudStage);

        speakerBadge.textContent = stageData.speaker;
        dialogContent.innerHTML = stageData.speech;
        if (currentFontScale) {
            dialogContent.style.fontSize = `calc(17px * ${currentFontScale})`;
        }

        let currentSpeakerRole = stageData.speakerRole;
        if (!currentSpeakerRole && !currentUnitConf.isBlankPreparationUnit) {
            if (activeUnit === 'ncp') currentSpeakerRole = 'lu';
            else if (activeUnit === 'must') currentSpeakerRole = (stageNum === 7) ? 'shiyi' : ((stageNum >= 5) ? 'lu' : 'nurse');
            else if (activeUnit === 'support') currentSpeakerRole = (stageNum === 3) ? 'nurse' : ((stageNum === 2) ? 'doctor' : 'scifi');
            else if (activeUnit === 'dm') {
                if (stageNum === 12) currentSpeakerRole = 'detective_leader';
                else if (stageNum === 11) currentSpeakerRole = 'nurse';
                else if (stageNum === 9) currentSpeakerRole = 'wang';
                else if (stageNum === 8) currentSpeakerRole = 'arcane';
                else if (stageNum === 7) currentSpeakerRole = 'muscle_doctor';
                else if (stageNum >= 2 && stageNum <= 5) currentSpeakerRole = 'warrior';
                else currentSpeakerRole = 'doctor';
            }
            else if (activeUnit.includes('bfbbb5')) currentSpeakerRole = (stageNum === 1 || stageNum === 2) ? 'chen' : 'doctor';
            else if (activeUnit === 'life') currentSpeakerRole = 'wu';
            else currentSpeakerRole = 'nurse';
        }
        document.body.className = `${currentUnitConf.bodyClass || ('unit-' + activeUnit.replace('unit_', ''))}${isTeacher ? ' is-teacher' : ''}`;
        document.body.classList.toggle(
            'must-ward-stages-1-4',
            activeUnit === 'must' && Number(stageNum) >= 1 && Number(stageNum) <= 4
        );

        if (isChenStage || currentSpeakerRole === 'chen') {
            dialogIndicator.textContent = '💡 請依據陳先生健檢抽血報告數據給予正確診斷判定 🩺 ➔';
        } else if (currentSpeakerRole === 'lu' || activeUnit === 'ncp') {
            dialogIndicator.textContent = '💡 請依據 NCP 營養照護程序核心架構於下方點選答案';
        } else if (activeUnit === 'support') {
            if (stageNum === 1) {
                dialogIndicator.textContent = '⚠️ 請辨識 NG 模組不可能發生的幽靈錯誤 ➔';
            } else if (stageNum === 2) {
                dialogIndicator.textContent = '💡 請依據重症臨床指引於下方點選最佳處置 ➔';
            } else if (stageNum === 3) {
                dialogIndicator.textContent = '💡 請依據腸道營養路徑決策評估於下方選出錯誤敘述 ➔';
            } else if (stageNum === 4) {
                dialogIndicator.textContent = '💡 請依據重症管灌熱量與脂肪酸指引於下方選出錯誤敘述 ➔';
            } else if (stageNum === 5) {
                dialogIndicator.textContent = '💡 請依據元素配方組成分與消化特性於下方選出非組成分項目 ➔';
            } else if (stageNum === 6) {
                dialogIndicator.textContent = '💡 請依據全靜脈營養（TPN）輸液中斷機轉於下方點選正確答案 ➔';
            } else if (stageNum === 7) {
                dialogIndicator.textContent = '💡 請依據重症營養支持臨床指引於下方點選最佳處置 ➔';
            } else {
                dialogIndicator.textContent = '💡 請依據臨床重症營養支持指引於下方點選答案 ➔';
            }
        } else if (activeUnit === 'dm') {
            if (stageNum === 1) {
                dialogIndicator.textContent = '💡 請依據第 1 型糖尿病核心病因機轉於下方點選正確答案';
            } else if (stageNum === 2) {
                dialogIndicator.textContent = '💡 請拖曳拉拉條設定 HbA1c 診斷切點，點選「蓄力出擊」砍向黑炎魔龍！';
            } else if (stageNum === 3) {
                dialogIndicator.textContent = '💡 請調校能量儀設定 FPG 診斷切點，點選「擊碎冰壁」擊破超標冰晶結界！';
            } else if (stageNum === 4) {
                dialogIndicator.textContent = '💡 請拖曳拉拉條設定 75g OGTT 2小時切點，點選「蓄力出擊」消滅晶化毒蠍魔君！';
            } else if (stageNum === 5) {
                dialogIndicator.textContent = '💡 請拖曳拉拉條設定隨機血糖切點，點選「蓄力出擊」擊退狂暴雷狼魔！';
            } else if (stageNum === 6) {
                dialogIndicator.textContent = '💡 請依據臨床生化檢驗指標特性，選出評估長期血糖控制成效之黃金標準';
            } else if (stageNum === 7) {
                dialogIndicator.textContent = '💡 請依據第 2 型糖尿病致病機轉，選出與胰島素阻抗無關之特徵';
            } else if (stageNum === 8) {
                dialogIndicator.textContent = '💡 請利用公式 eAG = 28.7 × A1C - 46.7 校準能量儀 ➔';
            } else if (stageNum === 9) {
                dialogIndicator.textContent = '💡 請依據第 2 型糖尿病臨床定期追蹤指引，選出建議定期監測之項目 ➔';
            } else if (stageNum === 10) {
                dialogIndicator.textContent = '💡 請依據成人糖尿病篩檢風險因子臨床指引，選出建議篩檢之組合 ➔';
            } else if (stageNum === 11) {
                dialogIndicator.textContent = '🍽️ 請直接點擊下方餐桌上「等量碳水化合物引起血糖反應最小」的食物作答！';
            }
        } else if (activeUnit.includes('curriculum_03')) {
            dialogIndicator.textContent = '💡 請依據體重控制與飲食障礙題目內容選擇正確答案';
        } else if (activeUnit.includes('curriculum_07')) {
            if (stageNum === 1) {
                dialogIndicator.textContent = '🕹️ 操作左下角移動搖桿或 WASD 走向傳送門，或直接點選傳送門選擇答案 ➔';
            } else {
                dialogIndicator.textContent = '💡 請依據腎臟專科臨床指引與檢驗數據判定正確答案';
            }
        } else if (currentSpeakerRole === 'nurse' || activeUnit === 'must') {
            if (activeUnit === 'must' && stageNum >= 5) {
                dialogIndicator.textContent = '💡 請依據 NCP 營養照護程序核心架構於下方點選答案';
            } else {
                dialogIndicator.textContent = '💡 請依據 MUST 臨床快篩指標評估並於下方投票';
            }
        } else if (activeUnit === 'life') {
            dialogIndicator.textContent = '💡 請依據校園生活經驗與直覺判定於下方點選答案 (答錯會遭到火箭隊嘲笑！)';
        } else if (activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) {
            dialogIndicator.textContent = '💡 點擊對話框繼續 💬 ➔';
        } else {
            dialogIndicator.textContent = '💡 請依據臨床專業指引與案例數據於下方點選答案';
        }

        if (currentUnitConf.isBlankPreparationUnit) {
            speakerBadge.textContent = '';
            dialogContent.innerHTML = '';
            dialogIndicator.textContent = '';
            if (charNurse) charNurse.classList.add('hidden');
            if (charStudent) charStudent.classList.add('hidden');
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
        }

        const tLbl = document.querySelector('.t-lbl');
        if (activeUnit === 'must') {
            if (Number(stageNum) === 7) {
                if (fyuIcon) {
                    fyuIcon.textContent = '📜';
                    fyuIcon.style.background = '#ca8a04';
                    fyuIcon.style.boxShadow = '0 0 8px rgba(202, 138, 4, 0.6)';
                }
                if (fyuTitle) fyuTitle.textContent = '周代宮廷御膳房';
                if (fyuSub) fyuSub.textContent = '《周禮》食醫職責 ‧ 營養篩檢快速辨識檢定';
                if (tLbl) tLbl.textContent = '宮廷試煉';
                if (patientBanner) {
                    patientBanner.innerHTML = `
                        <div class="banner-badge" style="background:#ca8a04;color:#fff;font-size:13px;padding:3px 8px;">📜 宮廷食醫</div>
                        <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                            <span class="p-name"><strong>周代宮廷 ‧ 膳房</strong> ｜ 《周禮》食醫考驗</span>
                            <span class="p-metrics zhou-trial-metrics">主考官：<strong>宮廷食醫</strong> ｜ 項目：<strong>營養篩檢 (Nutrition Screening) 檢定</strong></span>
                            <span class="p-order zhou-trial-badge" style="color:#fef08a;background:rgba(234,179,8,0.2);border-color:#eab308;padding:1px 6px;">📜 宮廷任職試煉</span>
                        </div>
                    `;
                }
            } else if (Number(stageNum) === 5 || Number(stageNum) === 6) {
                if (fyuIcon) {
                    fyuIcon.textContent = '✚';
                    fyuIcon.style.background = '';
                    fyuIcon.style.boxShadow = '';
                }
                if (fyuTitle) fyuTitle.textContent = '輔英科技大學附設醫院 臨床營養研討室';
                if (fyuSub) fyuSub.textContent = '保健營養系 ‧ NCP 核心觀念檢定';
                if (tLbl) tLbl.textContent = 'NCP 檢定';
                if (patientBanner) {
                    patientBanner.innerHTML = `
                        <div class="banner-badge" style="background:#0284c7;color:#fff;">NCP 核心檢定</div>
                        <div class="banner-info">
                            <span class="p-name"><strong>臨床營養專題研討室</strong> ‧ 標準化營養照護程序 (NCP) 專業檢定</span>
                            <span class="p-metrics">主考導師：<strong>陸馳野 臨床營養總監 ‧ 專科考照名師</strong> ｜ 考核項目：<strong>核心步驟與流程定義</strong></span>
                        </div>
                    `;
                }
            } else {
                if (fyuIcon) {
                    fyuIcon.textContent = '✚';
                    fyuIcon.style.background = '';
                    fyuIcon.style.boxShadow = '';
                }
                if (fyuTitle) fyuTitle.textContent = '輔英科技大學附設醫院病房';
                if (fyuSub) fyuSub.textContent = '保健營養系 ‧ MUST 臨床營養評估';
                if (tLbl) tLbl.textContent = '黃金 48H';
                if (patientBanner) {
                    patientBanner.innerHTML = `
                        <div class="banner-badge">${currentUnitConf.badge || '302 床'}</div>
                        <div class="banner-info">
                            ${currentUnitConf.bannerInfo}
                        </div>
                    `;
                }
            }
        }

        if (activeUnit === 'support') {
            updateSupportStageHeader(stageNum);
        }

        const isNewStudentTrial = isNewStudentTrialUnit(activeUnit);
        if (isNewStudentTrial) {
            if (isMedicalCityActive) {
                if (patientBanner) {
                    patientBanner.classList.remove('hidden');
                    patientBanner.style.removeProperty('display');
                }
                if (stageBackdrop) {
                    stageBackdrop.className = 'stage-backdrop medical-city-ward-theme';
                    stageBackdrop.style.setProperty('background-image', "url('assets/rpg_bg_medical_city_ward.jpg')", 'important');
                    stageBackdrop.style.setProperty('background-size', 'cover', 'important');
                    stageBackdrop.style.setProperty('background-position', 'center center', 'important');
                    stageBackdrop.style.removeProperty('aspect-ratio');
                }
                const contMap = document.getElementById('healthContinentMap');
                if (contMap) contMap.classList.add('hidden');
            } else {
                if (patientBanner) patientBanner.classList.add('hidden');
                if (stageBackdrop) {
                    stageBackdrop.className = 'stage-backdrop new-student-trial-theme';
                    stageBackdrop.style.backgroundImage = "url('assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v3')";
                    stageBackdrop.style.backgroundPosition = "center center";
                }
            }
            if (fyuTitle) fyuTitle.textContent = '營養勇者傳：解鎖專業營養師徽章';
            if (fyuSub) fyuSub.textContent = isMedicalCityActive ? '第 1 關：醫療之城 ‧ 王伯伯臨床營養評估' : '營養師職業覺醒任務';
            if (fyuIcon) fyuIcon.textContent = '⚔️';
        } else {
            document.body.classList.remove('unit-new_student_trial', 'unit-f47185', 'unit-trial', 'trial-step-0', 'trial-dialog-step', 'health-continent-active');
            if (stageBackdrop) {
                stageBackdrop.classList.remove('new-student-trial-theme');
                stageBackdrop.style.removeProperty('background-image');
                stageBackdrop.style.removeProperty('background-size');
                stageBackdrop.style.removeProperty('background-position');
                stageBackdrop.style.removeProperty('background-repeat');
                stageBackdrop.style.removeProperty('background-color');
            }
            const trialStartArea = document.getElementById('trialBgStartArea');
            if (trialStartArea) trialStartArea.classList.add('hidden');
            const contMap = document.getElementById('healthContinentMap');
            if (contMap) contMap.classList.add('hidden');
            const mentorEl = document.getElementById('charNurse');
            if (mentorEl) mentorEl.classList.remove('trial-mentor-dialog-position');
            if (patientBanner) {
                patientBanner.classList.remove('hidden');
                patientBanner.style.removeProperty('display');
            }
        }

        if (isCurriculum03) {
            const modNum = curriculum03DisplayModule || stageNum;
            const isBodyCompositionQuestion = (stageData.title || '').includes('身體組成') ||
                (stageData.speech || '').includes('身體組成');
            if (stageBackdrop) {
                stageBackdrop.className = 'stage-backdrop ward-theme';
                if (isBodyCompositionQuestion) {
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage1_fitness_hq.jpg')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center center";
                } else if (modNum === 1) {
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_ward.jpg')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center center";
                } else if (modNum === 2) {
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage5_adipose.png')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center center";
                } else if (modNum === 3) {
                    stageBackdrop.classList.add('anorexia-counseling-theme');
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_anorexia_counseling_v2.jpg')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center 18%";
                } else if (modNum === 4) {
                    stageBackdrop.classList.add('bulimia-binge-theme');
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_bulimia_binge_eating.jpg')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center center";
                } else if (modNum === 5) {
                    stageBackdrop.classList.add('unit3-stage4-anorexia-theme');
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage4_anorexia.png')";
                    stageBackdrop.style.backgroundSize = "cover";
                    stageBackdrop.style.backgroundPosition = "center 28%";
                } else if (modNum === 6) {
                    stageBackdrop.classList.add('protein-question-theme');
                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage1_proteins.jpg?v=20261010_ext')";
                    stageBackdrop.style.backgroundSize = "contain";
                    stageBackdrop.style.backgroundRepeat = "no-repeat";
                    stageBackdrop.style.backgroundPosition = "center bottom";
                }
            }
            if (teacherImg) {
                if (modNum === 4) {
                    teacherImg.removeAttribute('src');
                    teacherImg.alt = '';
                    if (charNurse) charNurse.classList.add('hidden');
                } else {
                    teacherImg.src = 'assets/icu_dietitian_bust.png';
                    teacherImg.alt = '紀晨希 營養師';
                    if (nurseTag) nurseTag.textContent = '紀晨希 營養師';
                    if (charNurse) charNurse.classList.remove('hidden', 'inactive');
                }
            }
        }

        if (isCurriculum07) {
            const modNum = Number(stageNum) || 1;
            if (stageBackdrop) {
                if (modNum === 1) {
                    stageBackdrop.className = 'stage-backdrop kidney-gate-theme';
                    stageBackdrop.style.backgroundImage = 'none';
                    stageBackdrop.style.backgroundColor = '#070b14';
                } else {
                    stageBackdrop.className = modNum === 5
                        ? 'stage-backdrop kidney-stage4-theme'
                        : (modNum === 6 ? 'stage-backdrop kidney-stage5-theme' : 'stage-backdrop dm-theme');
                    if (modNum === 2) {
                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage2_question_bg_final.png')";
                    } else if (modNum === 3) {
                        stageBackdrop.className = 'stage-backdrop kidney-stage3-theme';
                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage3_question_custom.png')";
                        stageBackdrop.style.backgroundSize = "contain";
                        stageBackdrop.style.backgroundPosition = "center center";
                        stageBackdrop.style.backgroundRepeat = "no-repeat";
                        stageBackdrop.style.backgroundColor = "#f6e4c8";
                    } else if (modNum === 4) {
                        stageBackdrop.className = 'stage-backdrop kidney-stage4-nutrient-theme';
                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage4_nutrient_bg.jpg')";
                    } else if (modNum === 5) {
                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage3_video_final_frame.png')";
                    } else if (modNum === 6) {
                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage4_question_bg.png')";
                    }
                    stageBackdrop.style.backgroundPosition = "center center";
                    stageBackdrop.style.backgroundSize = "cover";
                }
            }
            if (teacherImg) {
                const isKidneyStage6Doctor = Number(stageNum) === 6;
                teacherImg.src = isKidneyStage6Doctor ? 'assets/handsome_muscle_doctor_bust.png' : 'assets/doctor_bust.png';
                teacherImg.alt = isKidneyStage6Doctor ? '高健宇 主治醫師' : '江柏叡 主任醫師';
                if (nurseTag) nurseTag.textContent = isKidneyStage6Doctor ? '高健宇 主治醫師' : '江柏叡 主任醫師';
                if (Number(stageNum) === 4) {
                    if (charNurse) charNurse.classList.add('hidden');
                } else {
                    if (charNurse) charNurse.classList.remove('hidden', 'inactive');
                }
            }
        }

        const isKidneyStage1Early = (activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07' || activeUnit.includes('curriculum_07')) && Number(stageNum) === 1;
        const isKidneyStage2Video = isKidneyStage2IntroTarget(activeUnit, stageNum);
        const isKidneyStage3Video = isKidneyStage3IntroTarget(activeUnit, stageNum);
        const isKidneyStage4Video = isKidneyStage4IntroTarget(activeUnit, stageNum);
        if (stageData && stageData.options && stageData.options.length > 0) {
            renderOptionsGrid(stageData.options);
        }
        if (isKidneyStage1Early) {
            if (optionsGridEl) optionsGridEl.classList.add('hidden');
            if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
            const kidneyAreaEl = document.getElementById('kidneyGateRpgArea');
            if (kidneyAreaEl) {
                kidneyAreaEl.classList.remove('hidden');
                updateKidneyPortalSelection(studentSelectedOption);
                initKidneyRpgMovement(studentSelectedOption);
                const pBanner = document.getElementById('patientBanner');
                if (pBanner) pBanner.classList.add('hidden');
                const stIndicator = document.getElementById('stageIndicatorBar');
                if (stIndicator) stIndicator.classList.add('hidden');
                const bPanel = document.getElementById('rpgBottomPanel');
                if (bPanel) bPanel.classList.add('hidden');
            }
            if (charNurse) charNurse.classList.add('hidden');
            if (charStudent) charStudent.classList.add('hidden');
            if (stageBackdrop) {
                stageBackdrop.className = 'stage-backdrop kidney-gate-theme';
                stageBackdrop.style.backgroundImage = 'none';
                stageBackdrop.style.backgroundColor = '#070b14';
            }
        } else {
            const kidneyAreaEl = document.getElementById('kidneyGateRpgArea');
            if (kidneyAreaEl) {
                kidneyAreaEl.classList.add('hidden');
                stopKidneyRpgMovement();
            }
        }
        const isKidneyStage3 = isCurriculum07 && Number(stageNum) === 3;
        if (isKidneyStage3) {
            renderOptionsGrid(stageData.options);
        }
        renderStageIndicator(currentUnitConf.maxStages, stageNum);
        if (isKidneyStage2Video) syncKidneyStage2IntroPresentation(loadVersion, stageNum);

        // 新生勇者試煉登入後先顯示自己的初始畫面，避免等待模組資料時閃現醫療之城前導。
        if (isNewStudentTrialStageNow && !isMedicalCityActive) {
            if (isGameStarted && newStudentTrialStep > 0) {
                showNewStudentTrialStep(newStudentTrialStep);
            }
        }

        // 動態獲取後端最新題目選項與樣板設定 (若教師在後台移動題目或更動單元，即時動態連動)
        fetch(`/api/module_details?unit=${encodeURIComponent(activeUnit)}&stage=${stageNum}`)
            .then(res => res.json())
            .then(data => {
                if (loadVersion !== stageLoadVersion || currentStage !== stageNum) return;
                if (data && data.status === 'ok') {
                    const rawModCode = data.moduleCode || '';
                    const baseCode = rawModCode.replace(/_COPY_[A-Za-z0-9_-]+$/i, '').trim();
                    const modCode = curriculum03DisplayModule
                        ? `CURRICULUM_03_STAGE_${curriculum03DisplayModule}`
                        : (MODULE_TEMPLATES[rawModCode] ? rawModCode : (MODULE_TEMPLATES[baseCode] ? baseCode : rawModCode));
                    currentModuleCode = modCode;
                    if (modCode && MODULE_TEMPLATES[modCode]) {
                        const tpl = MODULE_TEMPLATES[modCode];
                        if (charNurse) {
                            charNurse.classList.remove(
                                'inactive', 'hidden', 'emperor-dimmed-gray',
                                'shiyi-step2-enlarge', 'shiyi-step3-enlarge',
                                'angry-shake', 'angry-fire-shake', 'zoom-eval'
                            );
                            charNurse.classList.add('speaking');
                        }
                        if (charStudent) {
                            charStudent.classList.remove(
                                'speaking', 'inactive', 'shiyi-slide-in-left',
                                'emperor-dimmed-gray', 'shiyi-step2-enlarge',
                                'shiyi-step3-enlarge', 'zoom-eval'
                            );
                            charStudent.classList.add('hidden');
                        }
                        if (teacherImg) teacherImg.classList.remove('angry-shake', 'angry-fire-shake');
                        const trialBgStartAreaEl = document.getElementById('trialBgStartArea');
                        if (trialBgStartAreaEl) trialBgStartAreaEl.classList.add('hidden');
                        if (dialogBox && !isKidneyStage2IntroTarget(activeUnit, stageNum)) dialogBox.classList.remove('hidden');
                        updateStudentVisuals();
                        const matchesNativeStage = (unit, stage, code) => (
                            activeUnit === unit && stageNum === stage && (!rawModCode || modCode === code)
                        );
                        const isSupportStage2Now = matchesNativeStage('support', 2, 'SUPPORT_STAGE_2');
                        const isKingStage7Now = matchesNativeStage('must', 7, 'MUST_STAGE_7');
                        const isNewStudentTrialStage1Now = matchesNativeStage('new_student_trial', 1, 'NEW_STUDENT_TRIAL_STAGE_1') || (isNewStudentTrialUnit(activeUnit) && Number(stageNum) === 1);
                        const isDiningTableStageNow = !!tpl.isDiningTableStage || modCode === 'DM_STAGE_12';
                        const isSliderBattleStageNow = !!tpl.hasSliderBattle;
                        const isLabReportStageNow = !!tpl.isLabMultiStage;
                        const isDetectiveStageNow = !!tpl.isDetectiveStage || tpl.speakerRole === 'detective_leader';
                        const isNgHudStageNow = !!tpl.isNgHudStage || modCode === 'SUPPORT_STAGE_1';
                        const isNativeDetectiveStage = matchesNativeStage('dm', 12, 'DM_STAGE_13');
                        const isSupport10AnatomyNow = modCode === 'SUPPORT_STAGE_10' ||
                            (activeUnit === 'support' && stageNum === 10);
                        const isKidneyStage1Now = !!tpl.isKidneyRpgStage ||
                            ((activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07' || activeUnit.includes('curriculum_07')) && Number(stageNum) === 1);
                        stageData.isKidneyStage1 = isKidneyStage1Now;
                        stageData.hasSliderBattle = !!tpl.hasSliderBattle;
                        stageData.isDragonBossStage = !!tpl.hasSliderBattle;
                        stageData.sliderType = tpl.sliderType || '';
                        stageData.correctVal = tpl.correctVal;
                        stageData.isLabMultiStage = !!tpl.isLabMultiStage;
                        if (isLabReportStageNow) {
                            dmStage6Phase = 'dialog';
                            if (labWidget) labWidget.classList.add('hidden');
                        }
                        stageData.isDetectiveStage = isDetectiveStageNow;
                        stageData.isArcaneEagStage = !!tpl.isArcaneEagStage;
                        stageData.isNgHudStage = isNgHudStageNow;
                        if (ngHudWidget) ngHudWidget.classList.toggle('hidden', !isNgHudStageNow);
                        const holoPodEl = document.getElementById('dialogNgHoloContainer');
                        if (holoPodEl) holoPodEl.classList.toggle('hidden', !isNgHudStageNow);
                        if (isNgHudStageNow && charStudent) {
                            charStudent.classList.add('hidden');
                        }
                        if (activeUnit === 'support') {
                            const patientBannerEl = document.getElementById('patientBanner');
                            if (patientBannerEl) patientBannerEl.classList.toggle('hidden', isSupport10AnatomyNow);
                        }
                        if (isDetectiveStageNow || isNativeDetectiveStage) {
                            const patientBannerEl = document.getElementById('patientBanner');
                            if (patientBannerEl) {
                                patientBannerEl.classList.add('hidden');
                                patientBannerEl.style.setProperty('display', 'none', 'important');
                            }
                        }
                        if (dragonBossArena) dragonBossArena.classList.toggle('hidden', !isSliderBattleStageNow);
                        if (a1cLiftingWidget) a1cLiftingWidget.classList.toggle('hidden', !isSliderBattleStageNow);
                        if (isSliderBattleStageNow) {
                            resetDragonBossState();
                            configureSliderBattleWidget(stageData);
                        }
                        if (isSupportStage2Now) {
                            if (supportStage2Step === 0) {
                                stageData.speaker = '【加護醫學部 趙仁傑 主治醫師】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = '「實習營養師，病人目前吸入性肺炎風險很高。<br>鼻胃管剛架上去，現在每個處置都關乎他的存活。」';
                                dialogIndicator.textContent = '點擊對話框繼續 💬 ➔';
                                if (charNurse) { charNurse.classList.remove('inactive', 'hidden'); charNurse.classList.add('speaking'); }
                                if (charStudent) { charStudent.classList.add('hidden'); }
                                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
                            } else if (supportStage2Step === 1) {
                                speakerBadge.textContent = myNickname ? `【實習營養師 ${myNickname}】` : '【實習營養師】';
                                dialogContent.innerHTML = '「錯一步，病人可能會出事....只要微量逆流進肺部，隨時可能會引發死亡。」';
                                dialogIndicator.textContent = '點擊對話框查看題目 🩺 ➔';
                                if (charNurse) { charNurse.classList.remove('speaking'); charNurse.classList.add('inactive'); }
                                if (charStudent) { charStudent.classList.remove('hidden', 'inactive'); charStudent.classList.add('speaking'); }
                                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
                            } else {
                                stageData.speaker = tpl.speaker || '【加護醫學部 趙仁傑 主治醫師】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = tpl.speech || '<span style="color:#ffffff;">鼻胃管灌食的重症病人，下列何者不是</span><strong style="color:#fef08a;">降低 aspiration 風險</strong><span style="color:#ffffff;">的最佳處置？</span>';
                                dialogIndicator.textContent = '💡 請依據重症臨床指引於下方點選最佳處置 ➔';
                                if (charNurse) { charNurse.classList.remove('inactive', 'hidden'); charNurse.classList.add('speaking'); }
                                if (charStudent) { charStudent.classList.remove('speaking'); charStudent.classList.add('hidden'); }
                                if (optionsGridEl) optionsGridEl.classList.remove('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
                            }
                        } else if (isKingStage7Now) {
                            // 若教師已公布答案（入獄畫面已顯示），不重置背景與對話框
                            if (teacherStageRevealed || alreadyRevealedThisStage || isStageLocked) return;
                            if (fyuIcon) {
                                fyuIcon.textContent = '📜';
                                fyuIcon.style.background = '#ca8a04';
                                fyuIcon.style.boxShadow = '0 0 8px rgba(202, 138, 4, 0.6)';
                            }
                            if (fyuTitle) fyuTitle.textContent = '周代宮廷御膳房';
                            if (fyuSub) fyuSub.textContent = '《周禮》食醫職責 ‧ 營養篩檢快速辨識檢定';
                            if (patientBanner) {
                                patientBanner.innerHTML = `
                                    <div class="banner-badge" style="background:#ca8a04;color:#fff;font-size:13px;padding:3px 8px;">📜 宮廷食醫</div>
                                    <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                                        <span class="p-name"><strong>周代宮廷 ‧ 膳房</strong> ｜ 《周禮》食醫考驗</span>
                                        <span class="p-metrics zhou-trial-metrics">主考官：<strong>宮廷食醫</strong> ｜ 項目：<strong>營養篩檢 (Nutrition Screening) 檢定</strong></span>
                                        <span class="p-order zhou-trial-badge" style="color:#fef08a;background:rgba(234,179,8,0.2);border-color:#eab308;padding:1px 6px;">📜 宮廷任職試煉</span>
                                    </div>
                                `;
                            }
                            if (mustStage7Step === 0) {
                                stageData.speaker = '【周天子】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = '「近來王室飲食屢有異常，寡人甚為憂心。」<br>「膳食乃養身之本，如今皇室成員竟接連出現異狀，究竟是何緣故？」<br><strong style="color:#fef08a; font-size:1.05em;">「傳食醫入殿！」</strong>';
                                dialogIndicator.textContent = '💡 點擊「了解周禮醫官制度」➔';
                                if (charNurse) { charNurse.classList.remove('inactive', 'hidden', 'emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('speaking'); }
                                if (teacherImg) { teacherImg.src = 'assets/zhou_emperor_full.png'; teacherImg.alt = '周天子'; }
                                if (charNurse) charNurse.style.setProperty('transform', 'scale(1.08) translateY(-8px)', 'important');
                                if (teacherImg) teacherImg.style.setProperty('max-height', '216px', 'important');
                                if (nurseTag) nurseTag.textContent = '周天子';
                                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
                                if (stageBackdrop) {
                                    stageBackdrop.className = 'stage-backdrop zhou-court-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_zhou_court.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center";
                                }
                                if (charStudent) {
                                    charStudent.classList.add('hidden');
                                    charStudent.classList.remove('speaking', 'shiyi-slide-in-left');
                                    const studentImg = document.getElementById('charStudentImg') || document.querySelector('#charStudent img');
                                    const studentTag = document.getElementById('charStudentName') || document.querySelector('#charStudent .char-nametag');
                                    if (studentImg) { studentImg.src = 'assets/zhou_shiyi_bust_hd.png'; studentImg.alt = '宮廷食醫'; }
                                    if (studentTag) studentTag.textContent = '宮廷食醫';

                                    clearTimeout(shiyiAnimTimer);
                                    shiyiAnimTimer = setTimeout(() => {
                                        if (activeUnit === 'must' && currentStage === 7 && mustStage7Step === 0) {
                                            if (charStudent) {
                                                charStudent.classList.remove('hidden');
                                                charStudent.classList.add('shiyi-slide-in-left');
                                                charStudent.style.setProperty('transform', 'scale(1)', 'important');
                                            }
                                            if (studentImg) studentImg.style.setProperty('max-height', '235px', 'important');
                                            if (charNurse) {
                                                charNurse.classList.add('emperor-dimmed-gray');
                                                charNurse.style.setProperty('transform', 'scale(0.64)', 'important');
                                            }
                                            if (teacherImg) teacherImg.style.setProperty('max-height', '136px', 'important');
                                        }
                                    }, 1500);
                                }
                            } else if (mustStage7Step === 1) {
                                stageData.speaker = '【周禮 ‧ 醫官制度】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = `
                                    <div style="line-height:1.75; font-size:16px; color:#f8fafc; text-align:left; padding:4px 6px;">
                                        <strong style="color:#fef08a; font-size:17.5px;">周代宮廷設有不同職責的醫官，依《周禮》記載，包括：</strong><br>
                                        • <strong style="color:#fde047;">食醫</strong> ｜ 負責飲食與養生<br>
                                        • <strong style="color:#86efac;">疾醫</strong> ｜ 負責疾病診治<br>
                                        • <strong style="color:#93c5fd;">瘍醫</strong> ｜ 負責瘡瘍及相關外科處置<br>
                                        • <strong style="color:#fed7aa;">獸醫</strong> ｜ 負責牲畜疾病<br>
                                        在宮廷之中，食醫掌管飲食調養，是維護王室健康的重要角色。<br>
                                        <span style="color:#fde047; font-weight:bold;">【食醫的考驗】</span>即將展開！
                                    </div>
                                `;
                                dialogIndicator.textContent = '💡 點擊召喚食醫入殿受命 ➔';
                                const bar = document.getElementById('stageIndicatorBar');
                                if (bar) { bar.classList.add('hidden'); bar.style.display = 'none'; }
                                if (stageBackdrop) {
                                    stageBackdrop.className = 'stage-backdrop zhou-four-doctors-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/zhou_four_doctors.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center top";
                                    stageBackdrop.style.backgroundColor = "transparent";
                                }
                                if (charNurse) { charNurse.classList.remove('emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('hidden'); }
                                if (charStudent) { charStudent.classList.add('hidden'); charStudent.classList.remove('shiyi-slide-in-left'); }
                                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
                            } else if (mustStage7Step === 2) {
                                stageData.speaker = '【食醫】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = '「臣在。」<br>「入宮為食醫，首要之務並非治病。」<br><strong style="color:#fef08a;">「而是從飲食與身體狀況中，及早發現可能存在的營養問題。」</strong>';
                                dialogIndicator.textContent = '💡 點擊開啟食醫考驗 🩺 ➔';
                                if (stageBackdrop) {
                                    stageBackdrop.className = 'stage-backdrop zhou-court-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_zhou_court.jpg')";
                                }
                                if (charNurse) { charNurse.classList.remove('inactive', 'hidden', 'emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('speaking'); }
                                if (teacherImg) { teacherImg.src = 'assets/zhou_shiyi_bust_hd.png'; teacherImg.alt = '宮廷食醫'; teacherImg.style.setProperty('max-height', '235px', 'important'); }
                                if (charNurse) charNurse.style.setProperty('transform', 'scale(1)', 'important');
                                if (nurseTag) nurseTag.textContent = '宮廷食醫';
                                if (charStudent) { charStudent.classList.add('hidden'); charStudent.classList.remove('shiyi-slide-in-left'); }
                                if (optionsGridEl) optionsGridEl.classList.add('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.add('hidden');
                            } else {
                                stageData.speaker = tpl.speaker || '【食醫的考驗】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = '<div style="font-size:16px; line-height:1.6;"><span style="color:#ffffff; font-weight:bold;">下列何者不是</span><strong style="color:#fef08a;">營養篩檢</strong><span style="color:#ffffff; font-weight:bold;">（nutrition screening）的項目？</span><br><span style="color:#94a3b8; font-size:13.5px; font-weight:normal;">（請於下方點選非初步營養篩檢的常規項目）</span></div>';
                                dialogIndicator.textContent = '💡 請依據營養篩檢快速辨識檢定於下方點選答案 ➔';
                                if (stageBackdrop) {
                                    stageBackdrop.className = 'stage-backdrop zhou-court-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_zhou_court.jpg')";
                                }
                                if (charNurse) { charNurse.classList.remove('inactive', 'hidden', 'emperor-dimmed-gray', 'shiyi-step2-enlarge', 'shiyi-step3-enlarge'); charNurse.classList.add('speaking'); }
                                if (teacherImg) { teacherImg.src = 'assets/zhou_shiyi_bust_hd.png'; teacherImg.alt = '宮廷食醫'; teacherImg.style.setProperty('max-height', '235px', 'important'); }
                                if (charNurse) charNurse.style.setProperty('transform', 'scale(1)', 'important');
                                if (nurseTag) nurseTag.textContent = '宮廷食醫';
                                if (charStudent) { charStudent.classList.remove('speaking', 'shiyi-slide-in-left'); charStudent.classList.add('hidden'); }
                                if (optionsGridEl) optionsGridEl.classList.remove('hidden');
                                if (rpgChoicesAreaEl) rpgChoicesAreaEl.classList.remove('hidden');
                            }
                        } else if (isNativeDetectiveStage || isDetectiveStageNow) {
                            const detectiveArea = document.getElementById('detectiveTeamArea');
                            const pBanner = document.getElementById('patientBanner');
                            if (pBanner) {
                                pBanner.classList.add('hidden');
                                pBanner.style.setProperty('display', 'none', 'important');
                            }
                            const bar = document.getElementById('stageIndicatorBar');
                            if (bar) {
                                bar.classList.add('hidden');
                                bar.style.setProperty('display', 'none', 'important');
                            }
                            if (detectiveStage12Step === 0) {
                                stageData.speaker = '【夜間病房 ‧ 血糖警報】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = '🌙 <strong>深夜 02:00，病房突然響起刺耳的緊急告警！</strong><br>病人陷入深度睡眠，血糖急墜至 <strong>48 mg/dL（嚴重低血糖）</strong>！<br>🌅 <strong>到了早晨 08:00，抽血報告卻驚見血糖反彈飆至 240 mg/dL！</strong><br><span style="color:#38bdf8;">這離奇的血糖劇烈反轉，究竟隱藏著什麼生理機轉？</span>';
                                dialogIndicator.textContent = '💡 點擊對話框 ‧ 召集血糖偵查小隊 🕵️‍♂️ ➔';
                                if (detectiveArea) detectiveArea.classList.add('hidden');
                            } else {
                                stageData.speaker = tpl.speaker || '【血糖偵查小隊 隊長】';
                                speakerBadge.textContent = stageData.speaker;
                                dialogContent.innerHTML = tpl.speech || '🕵️ <strong>「偵查小隊各就各位！請檢視夜間低血糖誘發的反向調節荷爾蒙反應，破解早晨反彈高血糖的真正元兇！」</strong><br><span style="color:#fef08a;">下列何者為造成此案例清晨高血糖的機轉？</span>';
                                dialogIndicator.textContent = '💡 請小隊成員共同討論機轉 ➔';
                                if (detectiveArea) detectiveArea.classList.remove('hidden');
                            }
                            if (optionsGridEl) optionsGridEl.classList.add('hidden');
                        } else if (isNewStudentTrialStage1Now && !isMedicalCityActive) {
                            if (patientBanner) patientBanner.classList.add('hidden');
                            const bar = document.getElementById('stageIndicatorBar');
                            if (bar) { bar.classList.add('hidden'); bar.style.setProperty('display', 'none', 'important'); }
                            if (isGameStarted && newStudentTrialStep > 0) {
                                showNewStudentTrialStep(newStudentTrialStep);
                            }
                        } else {
                            if (isMedicalCityActive) {
                                const bar = document.getElementById('stageIndicatorBar');
                                if (bar) { bar.classList.add('hidden'); bar.style.setProperty('display', 'none', 'important'); }
                                const continentMapEl = document.getElementById('healthContinentMap');
                                if (continentMapEl) continentMapEl.classList.add('hidden');
                                const trialBgStartArea = document.getElementById('trialBgStartArea');
                                if (trialBgStartArea) trialBgStartArea.classList.add('hidden');
                                if (patientBanner) {
                                    patientBanner.classList.remove('hidden');
                                    patientBanner.style.removeProperty('display');
                                    patientBanner.innerHTML = `
                                        <div class="banner-badge" style="background:#0284c7;color:#fff;">🏥 醫療之城</div>
                                        <div class="banner-info" style="font-size:13px;gap:4px 10px;line-height:1.2;">
                                            <span class="p-name"><strong>營養勇者傳</strong> ‧ 解鎖專業營養師徽章</span>
                                            <span class="p-metrics">當前關卡：<strong>第 1 關 醫療之城</strong> ｜ 任務：<strong>王伯伯臨床營養評估</strong></span>
                                            <span class="p-order" style="cursor:pointer;color:#38bdf8;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);border-radius:6px;padding:1px 7px;" onclick="window.playMedicalCityIntroVideo()">🎬 播放試煉影片</span>
                                        </div>
                                    `;
                                }
                            }
                            stageData.speaker = tpl.speaker;
                            speakerBadge.textContent = tpl.speaker;
                            if (tpl.speech) {
                                stageData.speech = tpl.speech;
                                if (activeUnit === 'support' && stageNum === 4 && supportStage4Step < 3) {
                                    showSupportStage4Dialogue(stageData);
                                } else if (activeUnit === 'support' && stageNum === 6 && supportStage6Step < 3) {
                                    showSupportStage6Dialogue(stageData);
                                } else if (activeUnit === 'support' && stageNum === 8 && supportStage8Step < 2) {
                                    showSupportStage8Dialogue(stageData);
                                } else {
                                    dialogContent.innerHTML = tpl.speech;
                                }
                            }
                        }
                        if (typeof tpl.nurseImg === 'string' && teacherImg && !isKingStage7Now && (!isNewStudentTrialStage1Now || isMedicalCityActive)) {
                            if (tpl.nurseImg) {
                                teacherImg.src = tpl.nurseImg;
                                teacherImg.alt = tpl.nurseTag || tpl.speaker || '';
                            } else {
                                teacherImg.removeAttribute('src');
                                teacherImg.alt = '';
                            }
                        }
                        if (typeof tpl.nurseTag === 'string' && nurseTag && !isKingStage7Now && (!isNewStudentTrialStage1Now || isMedicalCityActive)) nurseTag.textContent = tpl.nurseTag;
                        if (tpl.speakerRole) stageData.speakerRole = tpl.speakerRole;
                        if (tpl.voicePath) stageData.voicePath = tpl.voicePath;
                        if (charNurse) {
                            if (isDiningTableStageNow || isDetectiveStageNow || isSliderBattleStageNow || isKidneyStage1Now || (isCurriculum07 && Number(stageNum) === 4) || (!tpl.nurseImg && (!isNewStudentTrialStage1Now || isMedicalCityActive))) {
                                charNurse.classList.add('hidden');
                            } else {
                                charNurse.classList.remove('hidden');
                            }
                        }
                        const isSupportInternDialogue = activeUnit === 'support' &&
                            ((stageNum === 4 && supportStage4Step < 3) ||
                             (stageNum === 6 && supportStage6Step < 3) ||
                             (stageNum === 8 && supportStage8Step < 2));
                        if (charStudent && (!isDiningTableStageNow && !isKidneyStage1Now) && !isNewStudentTrialStage1Now && !isSupportInternDialogue) {
                            charStudent.classList.add('hidden');
                        }
                        const diningAreaEl = document.getElementById('rpgDiningTableArea');
                        if (diningAreaEl) {
                            if (isDiningTableStageNow) {
                                diningAreaEl.classList.remove('hidden');
                                document.querySelectorAll('.table-food-item[data-key]').forEach(item => {
                                    const itemKey = String(item.dataset.key);
                                    const isSelected = itemKey === String(studentSelectedOption);
                                    item.classList.toggle('selected', isSelected);
                                    if (!teacherStageRevealed) {
                                        item.classList.remove('correct-food-pulse', 'wrong-food-shake');
                                    }
                                });
                            } else {
                                diningAreaEl.classList.add('hidden');
                            }
                        }
                        const kidneyAreaEl = document.getElementById('kidneyGateRpgArea');
                        if (kidneyAreaEl) {
                            if (isKidneyStage1Now) {
                                kidneyAreaEl.classList.remove('hidden');
                                updateKidneyPortalSelection(studentSelectedOption);
                                initKidneyRpgMovement(studentSelectedOption);
                                const pBanner = document.getElementById('patientBanner');
                                if (pBanner) pBanner.classList.add('hidden');
                                const stIndicator = document.getElementById('stageIndicatorBar');
                                if (stIndicator) stIndicator.classList.add('hidden');
                                const bPanel = document.getElementById('rpgBottomPanel');
                                if (bPanel) bPanel.classList.add('hidden');
                            } else {
                                kidneyAreaEl.classList.add('hidden');
                                stopKidneyRpgMovement();
                                const stIndicator = document.getElementById('stageIndicatorBar');
                                if (stIndicator && activeUnit !== 'trial' && activeUnit !== 'new_student_trial' && activeUnit !== 'f47185') stIndicator.classList.remove('hidden');
                                const bPanel = document.getElementById('rpgBottomPanel');
                                if (bPanel) bPanel.classList.remove('hidden');
                            }
                        }
                        if (tpl.backdrop && stageBackdrop) {
                            stageBackdrop.style.backgroundImage = `url('${tpl.backdrop}')`;
                            if (isKidneyStage1Now) {
                                stageBackdrop.className = 'stage-backdrop kidney-gate-theme';
                                stageBackdrop.style.backgroundImage = 'none';
                                stageBackdrop.style.backgroundColor = '#070b14';
                            } else if (isNewStudentTrialStage1Now) {
                                if (isMedicalCityActive) {
                                    stageBackdrop.className = 'stage-backdrop medical-city-ward-theme';
                                    stageBackdrop.style.setProperty('background-image', "url('assets/rpg_bg_medical_city_ward.jpg')", 'important');
                                    stageBackdrop.style.setProperty('background-size', 'cover', 'important');
                                    stageBackdrop.style.setProperty('background-position', 'center center', 'important');
                                    stageBackdrop.style.removeProperty('aspect-ratio');
                                } else {
                                    stageBackdrop.className = 'stage-backdrop new-student-trial-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/new_student_trial_login_bg.jpg?v=20261023-login-bg-v3')";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                }
                            } else if (isDiningTableStageNow) {
                                stageBackdrop.className = 'stage-backdrop dining-table-theme';
                            } else if (isDetectiveStageNow) {
                                stageBackdrop.className = 'stage-backdrop midnight-ward-theme';
                            } else if (modCode === 'MUST_STAGE_7') {
                                if (mustStage7Step === 1) {
                                    stageBackdrop.className = 'stage-backdrop zhou-four-doctors-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/zhou_four_doctors.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center top";
                                    stageBackdrop.style.backgroundColor = "transparent";
                                } else {
                                    stageBackdrop.className = 'stage-backdrop zhou-court-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_zhou_court.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center";
                                    stageBackdrop.style.backgroundColor = "";
                                }
                            } else if (modCode.startsWith('SUPPORT_STAGE_')) {
                                stageBackdrop.className = modCode === 'SUPPORT_STAGE_10'
                                    ? 'stage-backdrop support-stage10-theme'
                                    : (modCode === 'SUPPORT_STAGE_4'
                                    ? 'stage-backdrop support-stage4-theme'
                                    : ((modCode === 'SUPPORT_STAGE_5' || modCode === 'SUPPORT_STAGE_9')
                                        ? 'stage-backdrop support-formula-theme'
                                    : (modCode === 'SUPPORT_STAGE_6'
                                        ? 'stage-backdrop icu-tpn-theme'
                                        : (modCode === 'SUPPORT_STAGE_1' ? 'stage-backdrop scifi-theme' : 'stage-backdrop icu-aspiration-theme'))));
                                stageBackdrop.classList.toggle('support-stage2-expanded', modCode === 'SUPPORT_STAGE_2');
                                if (modCode === 'SUPPORT_STAGE_7') {
                                    stageBackdrop.classList.add('formula-feeding-stage');
                                }
                                updateSupportStageHeader(stageNum);
                            } else if (modCode === 'DM_STAGE_6') {
                                stageBackdrop.className = 'stage-backdrop tech-company-theme';
                            } else if (modCode === 'DM_STAGE_10') {
                                stageBackdrop.className = 'stage-backdrop dm-consultation-theme';
                            } else if (modCode === 'DM_STAGE_9') {
                                stageBackdrop.className = 'stage-backdrop arcane-theme';
                            } else if (modCode === 'DM_STAGE_2') {
                                stageBackdrop.className = 'stage-backdrop dragon-battle-theme';
                            } else if (modCode === 'DM_STAGE_3') {
                                stageBackdrop.className = 'stage-backdrop dm-ice-theme';
                            } else if (modCode === 'DM_STAGE_4') {
                                stageBackdrop.className = 'stage-backdrop dm-swamp-theme';
                            } else if (modCode === 'DM_STAGE_5') {
                                stageBackdrop.className = 'stage-backdrop dm-thunder-theme';
                            } else if (modCode.startsWith('NCP_')) {
                                stageBackdrop.className = 'stage-backdrop ncp-theme';
                                if (fyuTitle) fyuTitle.textContent = '輔英科技大學附設醫院 臨床營養研討室';
                                if (fyuSub) fyuSub.textContent = '保健營養系 ‧ NCP 核心觀念檢定';
                                const tLblNow = document.querySelector('.t-lbl');
                                if (tLblNow) tLblNow.textContent = 'NCP 檢定';
                                if (patientBanner) {
                                    patientBanner.innerHTML = `
                                        <div class="banner-badge" style="background:#0284c7;color:#fff;">NCP 核心檢定</div>
                                        <div class="banner-info">
                                            <span class="p-name"><strong>臨床營養專題研討室</strong> ‧ 標準化營養照護程序 (NCP) 專業檢定</span>
                                            <span class="p-metrics">主考導師：<strong>陸馳野 臨床營養總監 ‧ 專科考照名師</strong> ｜ 考核項目：<strong>核心步驟與流程定義</strong></span>
                                        </div>
                                    `;
                                }
                            } else if (modCode.startsWith('DM_')) {
                                stageBackdrop.className = 'stage-backdrop dm-theme';
                            } else if (modCode.startsWith('LIFE_')) {
                                stageBackdrop.className = 'stage-backdrop classroom-theme';
                            } else if (activeUnit.includes('curriculum_07') || modCode.startsWith('CURRICULUM_07')) {
                                const kidneyModule = Number(stageNum) || 1;
                                if (kidneyModule === 1) {
                                    stageBackdrop.className = 'stage-backdrop kidney-gate-theme';
                                    stageBackdrop.style.backgroundImage = 'none';
                                    stageBackdrop.style.backgroundColor = '#070b14';
                                } else if (kidneyModule === 5) {
                                    stageBackdrop.className = 'stage-backdrop kidney-stage4-theme';
                                    stageBackdrop.style.backgroundImage = "url('assets/kidney_stage3_video_final_frame.png')";
                                    stageBackdrop.style.backgroundSize = "100% 100%";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                } else {
                                    stageBackdrop.className = kidneyModule === 6 ? 'stage-backdrop kidney-stage5-theme' : 'stage-backdrop dm-theme';
                                    if (kidneyModule === 2) {
                                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage2_question_bg_final.png')";
                                    } else if (kidneyModule === 3) {
                                        stageBackdrop.className = 'stage-backdrop kidney-stage3-theme';
                                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage3_question_custom.png')";
                                        stageBackdrop.style.backgroundSize = "contain";
                                        stageBackdrop.style.backgroundPosition = "center center";
                                        stageBackdrop.style.backgroundRepeat = "no-repeat";
                                        stageBackdrop.style.backgroundColor = "#f6e4c8";
                                    } else if (kidneyModule === 4) {
                                        stageBackdrop.className = 'stage-backdrop kidney-stage4-nutrient-theme';
                                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage4_nutrient_bg.jpg')";
                                    } else if (kidneyModule === 6) {
                                        stageBackdrop.style.backgroundImage = "url('assets/kidney_stage4_question_bg.png')";
                                    }
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                }
                            } else if (modCode.startsWith('CURRICULUM_') || activeUnit.includes('curriculum_03')) {
                                stageBackdrop.className = 'stage-backdrop ward-theme';
                                const curriculum03Module = getCurriculum03ModuleNumber(activeUnit, modCode) || getCurriculum03DisplayModuleNumber(activeUnit, stageNum);
                                const isBodyCompositionQuestion = curriculum03Module === 6 ||
                                    (tpl.title || '').includes('身體組成') ||
                                    (tpl.speech || '').includes('身體組成');
                                if (isBodyCompositionQuestion) {
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage1_fitness_hq.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                } else if (curriculum03Module === 1) {
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_ward.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                } else if (curriculum03Module === 2) {
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage5_adipose.png')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                } else if (curriculum03Module === 3) {
                                    stageBackdrop.classList.add('anorexia-counseling-theme');
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_anorexia_counseling_v2.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center 18%";
                                } else if (curriculum03Module === 4) {
                                    stageBackdrop.classList.add('bulimia-binge-theme');
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_bulimia_binge_eating.jpg')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center center";
                                } else if (curriculum03Module === 5) {
                                    stageBackdrop.classList.add('unit3-stage4-anorexia-theme');
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage4_anorexia.png')";
                                    stageBackdrop.style.backgroundSize = "cover";
                                    stageBackdrop.style.backgroundPosition = "center 28%";
                                } else if (curriculum03Module === 6) {
                                    stageBackdrop.classList.add('protein-question-theme');
                                    stageBackdrop.style.backgroundImage = "url('assets/rpg_bg_unit3_stage1_proteins.jpg?v=20261010_ext')";
                                    stageBackdrop.style.backgroundSize = "contain";
                                    stageBackdrop.style.backgroundRepeat = "no-repeat";
                                    stageBackdrop.style.backgroundPosition = "center bottom";
                                }
                            }
                        }
                        if (tpl.correctKey) stageData.correctKey = tpl.correctKey;
                        if (tpl.revealExplanation) stageData.revealExplanation = tpl.revealExplanation;
                        if (tpl.options) {
                            stageData.options = tpl.options;
                            renderOptionsGrid(stageData.options);
                            renderFormulaFeedingChallenge(stageData);
                            if ((isSliderBattleStageNow || isDiningTableStageNow || isLabReportStageNow || isNgHudStageNow || isKidneyStage1Now || isNewStudentTrialStage1Now) && optionsGridEl) {
                                optionsGridEl.classList.add('hidden');
                            }
                            if ((isLabReportStageNow || isNgHudStageNow || isKidneyStage1Now || isNewStudentTrialStage1Now) && rpgChoicesAreaEl) {
                                rpgChoicesAreaEl.classList.add('hidden');
                            }
                        }
                    }

                    if (data.description && (!modCode || !MODULE_TEMPLATES[modCode])) {
                        const parsed = parseCustomOptions(data.description);
                        if (parsed && parsed.options.length >= 2) {
                            stageData.options = parsed.options;
                            if (parsed.correctKey) {
                                stageData.correctKey = parsed.correctKey;
                            }
                            renderOptionsGrid(stageData.options);
                        }
                    }
                    if (data.correctOption && !getCurriculum03DisplayModuleNumber(activeUnit, stageNum)) {
                        // 後端可能回傳 A/B/C/D，前端圖卡使用 1/2/3/4，先統一成圖卡 key。
                        stageData.correctKey = normalizeCorrectOptionKey(data.correctOption, stageData.options);
                        applyAnswerRevealStyles(stageData, teacherStageRevealed || isStageLocked);
                    }
                    if (data.title && (!modCode || !MODULE_TEMPLATES[modCode])) {
                        dialogContent.innerHTML = `<strong style="color:#fef08a;">${data.title}</strong>`;
                    }
                    setSupportStage10AnatomyVisible(isSupport10AnatomyNow);
                    if (isSupport10AnatomyNow) {
                        updateSupportStage10AnatomySelection(
                            studentSelectedOption,
                            currentUnitConf.stages[stageNum].correctKey,
                            teacherStageRevealed || isStageLocked
                        );
                    }
                    if (currentFontScale) {
                        dialogContent.style.fontSize = `calc(17px * ${currentFontScale})`;
                    }
                    syncKidneyStage2IntroPresentation(loadVersion, stageNum);
                    supportStage11QuestionReady = true;
                    configureSupportStage11VideoBackdrop(stageNum, false);
                    renderStageIndicator(currentUnitConf.maxStages, stageNum);
                    const isSupport2Student = !isTeacher && (activeUnit === 'support' || String(activeUnit).includes('support')) && Number(stageNum) === 2;
                    const isDm10Student = !isTeacher && (activeUnit === 'dm' || String(activeUnit).includes('dm')) && Number(stageNum) === 10;
                    const isUnit3VideoShowcase = isCurriculum03Module(activeUnit, modCode, 4) &&
                        startUnit3Stage3OptionShowcase();
                    const shouldSkipAutoVoice = (activeUnit === 'must' && stageNum === 7) ||
                        (activeUnit === 'support' && (stageNum === 4 || stageNum === 6 || stageNum === 11 || (stageNum === 8 && supportStage8Step < 2))) ||
                        (isNewStudentTrialUnit(activeUnit) && Number(stageNum) === 1) ||
                        isSupport2Student ||
                        isDm10Student ||
                        isUnit3VideoShowcase ||
                        isKidneyStage2Video ||
                        isKidneyStage3Video ||
                        isKidneyStage4Video;
                    try {
                        if (!shouldSkipAutoVoice) {
                            playQuestionVoice(activeUnit, stageNum, modCode);
                        }
                    } catch(error) {
                        console.error('題目語音播放失敗', error);
                    }
                } else {
                    const isSupport2Student = !isTeacher && (activeUnit === 'support' || String(activeUnit).includes('support')) && Number(stageNum) === 2;
                    const isDm10Student = !isTeacher && (activeUnit === 'dm' || String(activeUnit).includes('dm')) && Number(stageNum) === 10;
                    const isUnit3VideoShowcase = isCurriculum03Module(activeUnit, currentModuleCode, 4) &&
                        startUnit3Stage3OptionShowcase();
                    const shouldSkipAutoVoice = (activeUnit === 'must' && stageNum === 7) ||
                        (activeUnit === 'support' && (stageNum === 4 || stageNum === 6 || stageNum === 11 || (stageNum === 8 && supportStage8Step < 2))) ||
                        (isNewStudentTrialUnit(activeUnit) && Number(stageNum) === 1) ||
                        isSupport2Student ||
                        isDm10Student ||
                        isUnit3VideoShowcase ||
                        isKidneyStage2Video ||
                        isKidneyStage3Video ||
                        isKidneyStage4Video;
                    try {
                        if (!shouldSkipAutoVoice) {
                            playQuestionVoice(activeUnit, stageNum);
                        }
                    } catch(error) {
                        console.error('題目語音播放失敗', error);
                    }
                }
            })
            .catch(err => {
                if (loadVersion !== stageLoadVersion || currentStage !== stageNum) return;
                syncKidneyStage2IntroPresentation(loadVersion, stageNum);
                const isSupport2Student = !isTeacher && (activeUnit === 'support' || String(activeUnit).includes('support')) && Number(stageNum) === 2;
                const isDm10Student = !isTeacher && (activeUnit === 'dm' || String(activeUnit).includes('dm')) && Number(stageNum) === 10;
                const isUnit3VideoShowcase = isCurriculum03Module(activeUnit, currentModuleCode, 4) &&
                    startUnit3Stage3OptionShowcase();
                const shouldSkipAutoVoice = (activeUnit === 'must' && stageNum === 7) ||
                    (activeUnit === 'support' && (stageNum === 4 || stageNum === 6 || stageNum === 11 || (stageNum === 8 && supportStage8Step < 2))) ||
                    (isNewStudentTrialUnit(activeUnit) && Number(stageNum) === 1) ||
                    isSupport2Student ||
                    isDm10Student ||
                    isUnit3VideoShowcase ||
                    isKidneyStage2Video ||
                    isKidneyStage3Video ||
                    isKidneyStage4Video;
                try {
                    if (!shouldSkipAutoVoice) {
                        playQuestionVoice(activeUnit, stageNum);
                    }
                } catch(error) {
                    console.error('題目語音播放失敗', error);
                }
            });
    }

    // ==============================================
    // 語音播放相關
    // ==============================================
    function speakQuestionText(unit, stage) {

        if (!isTeacher) {
            stopAllQuestionVoice();
            return;
        }
        if (!window.speechSynthesis) {
            isQuestionVoicePlaying = false;
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                btnReplayQuestionVoice.classList.remove('playing');
            }
            return;
        }
        if (!isQuestionVoicePlaying) return;
        if (!isTeacher && ((unit === 'dm' || String(unit).includes('dm')) && Number(stage) === 10 || (unit === 'support' || String(unit).includes('support')) && Number(stage) === 2)) {
            isQuestionVoicePlaying = false;
            return;
        }
        // 嚴格阻斷：致命醫療事故彈窗、結算榮譽榜、阿嬤道謝視窗、Game Over 彈窗、或關卡超過單元題數時，絕對禁止 AI 複念題目！
        const dragonGameOverModal = document.getElementById('dragonGameOverModal');
        const fatalOverlay = document.getElementById('fatalAspirationOverlay');
        if ((fatalOverlay && !fatalOverlay.classList.contains('hidden')) ||
            (rpgVictoryModal && !rpgVictoryModal.classList.contains('hidden')) ||
            (grandmaThankModal && !grandmaThankModal.classList.contains('hidden')) ||
            (dragonGameOverModal && !dragonGameOverModal.classList.contains('hidden')) ||
            (currentUnitConf && currentStage > currentUnitConf.maxStages)) {
            window.speechSynthesis.cancel();
            if (typeof window.speechSynthesis.resume === 'function') {
                window.speechSynthesis.resume();
            }
            return;
        }
        window.speechSynthesis.cancel();
        if (typeof window.speechSynthesis.resume === 'function') {
            window.speechSynthesis.resume();
        }
        const speechUnit = activeUnit;
        const speechStage = currentStage;
        const stageData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
        let textToSpeak = '';
        if (activeUnit === 'must' && currentStage === 7) {
            textToSpeak = '下列何者不是營養篩檢（nutrition screening）的項目？';
        } else if ((activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07') && currentStage === 1) {
            textToSpeak = '下列何者不是測量腎臟功能的常用參考指標？';
        } else if ((activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07') && currentStage === 3) {
            textToSpeak = '王小姐身高 162 公分、體重 60 公斤，平日有健身重訓，在此階段，下列何飲食處方最不適合王小姐？';
        } else if ((activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07') && currentStage === 4) {
            textToSpeak = '慢性腎臟病 Stage 4 的病人不需要限制下列何種營養素的攝取？';
        } else if ((activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07') && currentStage === 5) {
            textToSpeak = '末期腎臟病（ESRD），與下列何種疾病最不相關？';
        } else if ((activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07') && currentStage === 6) {
            textToSpeak = '有關醫師評估透析病人乾體重的目的，下列何者錯誤？';
        } else if ((activeUnit === 'support' || String(activeUnit).includes('support')) && Number(currentStage) === 1) {
            textToSpeak = '系統告警：醫療艙「休眠探員」的鼻胃管回報故障，請立即將監控中樞回報的故障清單內容：下列何者不是病人裝置鼻胃管常見的合併症？';
        } else if (activeUnit === 'support' && currentStage === 5 && stageData && stageData.speech) {
            textToSpeak = stageData.speech.replace(/<[^>]+>/g, '').trim();
        } else if (dialogContent && dialogContent.innerText) {
            textToSpeak = dialogContent.innerText.trim();
        } else if (stageData && stageData.speech) {
            textToSpeak = stageData.speech.replace(/<[^>]+>/g, '').trim();
        }
        textToSpeak = textToSpeak.replace(/【?(?:個案數據|體重流失數據|急性疾病影響|總分與風險等級)】?/g, '').trim();
        if (!textToSpeak) {
            isQuestionVoicePlaying = false;
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                btnReplayQuestionVoice.classList.remove('playing');
            }
            return;
        }

        let role = stageData ? stageData.speakerRole : null;
        const speakerText = (speakerBadge ? speakerBadge.textContent : '') + ' ' + (stageData && stageData.speaker ? stageData.speaker : '');
        
        // 精準判斷男女聲性別：
        // 女性角色：林語柔 (MUST 1~4)、加護營養師 (Support 3)、艦載終端 (Support 1)、衛教餐桌 (DM 11)、阿嬤
        // 男性角色：陸馳野 (MUST 5~7, NCP)、沈懷瑾、趙仁傑 (Support 2)、陳先生、勇者、高健宇、王先生、吳教授、江柏叡 (Curriculum 07)
        let isFemale = false;
        if (activeUnit === 'must') {
            if (currentStage <= 4) {
                isFemale = true; // 護理師 林語柔 (女生範例聲音)
            } else {
                isFemale = false; // 臨床營養總監 陸馳野 (第 5、6、7 題 男生範例聲音)
            }
        } else if (activeUnit === 'support') {
            if (currentStage === 1) {
                isFemale = true; // 系統監控中樞 ‧ 艦載終端 (女生範例聲音)
            } else if (currentStage === 2) {
                if (supportStage2Step === 1) {
                    isFemale = (selectedGender !== 'male');
                } else {
                    isFemale = false; // 趙仁傑 主治醫師 (男生範例聲音)
                }
            } else if (currentStage === 5) {
                isFemale = false; // 單元二第 5 題使用第 2 題的男聲朗讀風格
            } else if (currentStage === 3 || currentStage === 4 || currentStage === 7 || currentStage === 8) {
                isFemale = true; // 紀晨希營養師 (女生範例聲音)
            } else if (currentStage === 6) {
                isFemale = false; // 趙仁傑 主治醫師 (男生範例聲音)
                isFemale = false; // 趙仁傑 主治醫師 (男生範例聲音)
            }
        } else if (activeUnit.includes('curriculum_03') || activeUnit === 'curriculum_03' || activeUnit === 'unit_curriculum_03') {
            isFemale = true; // 臨床營養名師 紀晨希 營養師 (女生範例聲音)
        } else if (activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'unit_curriculum_07') {
            if (Number(currentStage) === 3 || Number(currentStage) === 4) {
                isFemale = true; // 單元七 第3題（王小姐）、第4題（臨床營養師）使用女生範例聲音朗讀
            } else {
                isFemale = false; // 江柏叡 主任醫師 / 高健宇 主治醫師 (男生範例聲音)
            }
        } else if (activeUnit === 'dm' && currentStage === 11) {
            isFemale = true; // 糖尿病衛教餐桌 ‧ RPG風格 (女生範例聲音)
        } else if (activeUnit === 'dm' && currentStage <= 3) {
            isFemale = false; // 單元六第 1~3 題 (沈懷瑾主任醫師/勇者 男生範例聲音)
        } else if (activeContinentStageKey === 'port' || speakerText.includes('營養師')) {
            if (typeof portDialogueStep !== 'undefined' && portDialogueStep === 1) {
                isFemale = (selectedGender !== 'male');
                textToSpeak = '100 人的午餐？只要把1個人的食譜放大 100 倍，應該就能完成了吧！';
            } else if (typeof portDialogueStep !== 'undefined' && portDialogueStep === 2) {
                isFemale = true;
                textToSpeak = '沒那麼簡單喔！還要考慮每人預算、食材份量、營養均衡和食品安全呢！';
            } else if (typeof portDialogueStep !== 'undefined' && portDialogueStep >= 3) {
                isFemale = true;
                textToSpeak = '而且學校規定每人餐費不能超過 60 元，請你在預算內設計出最合適的午餐。題目：以下哪一份菜單最適合在每人 60 元的預算內，供應 100 位學生？';
            } else {
                isFemale = true;
                textToSpeak = '實習營養師，歡迎來到團膳營養部！今天你將負責 100 位學生的午餐規劃，準備好接受挑戰了嗎？';
            }
        } else if (activeContinentStageKey === 'sports' || speakerText.includes('阿哲')) {
            isFemale = false; // 活力運動場 ‧ 阿哲 (男生聲音)
            textToSpeak = '您好！我是阿哲，今年 18 歲，每週重訓 3 次，想練出更壯的肌肉，因此每天喝乳清蛋白，但為什麼肌肉還是長不大呢？實習營養師，快幫我找出問題！';
        } else if (speakerText.includes('專業營養師') || speakerText.includes('伊麗克絲') || speakerText.includes('神秘導師') || role === 'mentor_guide' || role === 'mentor') {
            isFemale = true; // 專業營養師 / 伊麗克絲 (女生聲音)
        } else if (speakerText.includes('營養實習生') || speakerText.includes('新手勇者') || speakerText.includes('實習營養師')) {
            isFemale = (selectedGender !== 'male');
        } else if (role === 'doctor' || role === 'wang' || role === 'lu' || role === 'chen' || role === 'warrior' || role === 'wu' || role === 'professor' || role === 'muscle_doctor' || role === 'male' || speakerText.includes('趙仁傑') || speakerText.includes('王先生') || speakerText.includes('陸馳野') || speakerText.includes('沈懷瑾') || speakerText.includes('陳先生') || speakerText.includes('勇者') || speakerText.includes('吳教授') || speakerText.includes('總監') || speakerText.includes('醫師') || speakerText.includes('教授') || speakerText.includes('高健宇')) {
            isFemale = false;
        } else if (speakerText.includes('林語柔') || speakerText.includes('護理') || speakerText.includes('阿嬤') || speakerText.includes('林奶奶') || role === 'nurse' || role === 'grandma' || role === 'female') {
            isFemale = true;
        } else {
            isFemale = false;
        }

        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.lang = 'zh-TW';

        // 智慧挑選最佳男女聲 (女聲: 護理師/林語柔；男聲: 陸總監/沈醫師/陳先生/勇者/吳教授)
        // 嚴格排除所有香港/廣東話 (zh-HK, yue-HK, Danny, Tracy) 與口音，確保 100% 台灣在地擬真發音
        try {
            let voiceList = window.speechSynthesis.getVoices() || [];
            if ((!voiceList || voiceList.length === 0) && 'onvoiceschanged' in window.speechSynthesis) {
                // 若第一次獲取時瀏覽器尚未填充語音清單，監聽 voiceschanged 更新
                window.speechSynthesis.onvoiceschanged = () => {
                    try {
                        const updatedVoices = window.speechSynthesis.getVoices() || [];
                        if (updatedVoices && updatedVoices.length > 0 && isQuestionVoicePlaying && !utter.voice) {
                            // 重新套用台灣/國語語音
                            const isBanned = (v) => {
                                const l = (v.lang || '').replace('_', '-').toLowerCase();
                                const n = (v.name || '').toLowerCase();
                                return l.includes('hk') || l.includes('mo') || l.includes('yue') ||
                                       n.includes('danny') || n.includes('tracy') || n.includes('hong kong') ||
                                       n.includes('cantonese') || n.includes('香港') || n.includes('粵語') || n.includes('廣東');
                            };
                            const isTwVoice = (v) => {
                                if (isBanned(v)) return false;
                                const l = (v.lang || '').replace('_', '-').toLowerCase();
                                const n = (v.name || '').toLowerCase();
                                return l === 'zh-tw' || l === 'cmn-hant-tw' || l === 'zh-hant-tw' ||
                                       l.includes('tw') || n.includes('taiwan') || n.includes('臺灣') || n.includes('台灣') ||
                                       n.includes('yunjhe') || n.includes('hsiaochen') || n.includes('yating') ||
                                       n.includes('hanhan') || n.includes('zhiwei');
                            };
                            const candidates = updatedVoices.filter(isTwVoice).length > 0 ? updatedVoices.filter(isTwVoice) : updatedVoices.filter(v => !isBanned(v) && ((v.lang || '').includes('zh') || (v.lang || '').includes('cmn')));
                            if (candidates.length > 0) {
                                utter.voice = candidates[0];
                            }
                        }
                    } catch(e) {}
                };
            }
            if (voiceList && voiceList.length > 0) {
                const isBannedHkOrCantonese = (v) => {
                    const l = (v.lang || '').replace('_', '-').toLowerCase();
                    const n = (v.name || '').toLowerCase();
                    return l.includes('hk') || l.includes('mo') || l.includes('yue') ||
                           n.includes('danny') || n.includes('tracy') || n.includes('hong kong') ||
                           n.includes('cantonese') || n.includes('香港') || n.includes('粵語') || n.includes('廣東');
                };

                const isTw = (v) => {
                    if (isBannedHkOrCantonese(v)) return false;
                    const l = (v.lang || '').replace('_', '-').toLowerCase();
                    const n = (v.name || '').toLowerCase();
                    return l === 'zh-tw' || l === 'cmn-hant-tw' || l === 'zh-hant-tw' ||
                           l.includes('tw') || n.includes('taiwan') || n.includes('臺灣') || n.includes('台灣') ||
                           n.includes('yunjhe') || n.includes('hsiaochen') || n.includes('yating') ||
                           n.includes('hanhan') || n.includes('zhiwei');
                };

                const safeTwVoices = voiceList.filter(isTw);
                // 若系統尚未載入 TW 特有標籤，備選無香港特徵的標準國語語音 (嚴禁香港/粵語)
                const safeMandarinVoices = voiceList.filter(v => {
                    if (isBannedHkOrCantonese(v)) return false;
                    const l = (v.lang || '').replace('_', '-').toLowerCase();
                    return l.includes('zh') || l.includes('cmn');
                });

                const candidateList = safeTwVoices.length > 0 ? safeTwVoices : safeMandarinVoices;
                const isRecognizedMaleVoice = (v) => {
                    const n = (v.name || '').toLowerCase();
                    return n.includes('yunjhe') || n.includes('zhiwei') || n.includes('yunxi') ||
                           n.includes('yunjian') || n.includes('kangkang') || n.includes('male') ||
                           n.includes('男') || n.includes('david') || n.includes('james');
                };
                const isRecognizedFemaleVoice = (v) => {
                    const n = (v.name || '').toLowerCase();
                    return n.includes('hsiaochen') || n.includes('yating') || n.includes('hsiaoyu') ||
                           n.includes('hanhan') || n.includes('mei-jia') || n.includes('female') ||
                           n.includes('女') || n.includes('xiaoxiao') || n.includes('xiaoyi') ||
                           n.includes('tingting') || n.includes('susan') || n.includes('zira');
                };
                let matchedVoice = null;
                if (isFemale) {
                    matchedVoice = candidateList.find(isRecognizedFemaleVoice) ||
                                   candidateList.find(v => !isRecognizedMaleVoice(v));
                } else {
                    matchedVoice = candidateList.find(isRecognizedMaleVoice) ||
                                   candidateList.find(v => !isRecognizedFemaleVoice(v)) ||
                                   candidateList[0];
                }
                if (matchedVoice) {
                    utter.voice = matchedVoice;
                    utter.lang = matchedVoice.lang || 'zh-TW';
                }
            }
        } catch(e) {}

        if (isFemale) {
            utter.pitch = 1.2;
            utter.rate = 1.0;
        } else {
            utter.pitch = activeUnit === 'support' && currentStage === 5 ? 0.68 : 0.8;
            utter.rate = 0.95;
        }

        utter.onend = () => {
            isQuestionVoicePlaying = false;
            startDeferredBgmAfterQuestionVoice(speechUnit, speechStage);
            if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmBaseVolume;
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                btnReplayQuestionVoice.classList.remove('playing');
            }
            if (activeUnit === 'support' && currentStage === 7) {
                activateSupportStage7Feeding();
            }
        };
        utter.onerror = (event) => {
            isQuestionVoicePlaying = false;
            if (event && event.error === 'not-allowed') {
                pendingQuestionVoice = { unit: speechUnit, stage: speechStage };
            }
            startDeferredBgmAfterQuestionVoice(speechUnit, speechStage);
            if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmBaseVolume;
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                btnReplayQuestionVoice.classList.remove('playing');
            }
        };
        if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmUsesHospitalTrack ? 0.06 : 0.15;
        window.speechSynthesis.speak(utter);
        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '⏹ 停止朗讀';
            btnReplayQuestionVoice.classList.add('playing');
        }
    }

    let isQuestionVoicePlaying = false;
    let lastVoiceToggleTime = 0;
    let pendingQuestionVoice = null;
    let questionVoiceAudioUnlocked = false;
    const questionVoiceUnlockSrc = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    function handleAudioUnlockAndPendingVoice(event) {
        if (window.speechSynthesis) {
            try {
                window.speechSynthesis.resume();
            } catch(e) {}
        }
        if (pendingQuestionVoice) {
            const pending = pendingQuestionVoice;
            pendingQuestionVoice = null;
            questionVoiceAudioUnlocked = true;
            if (pending.unit === activeUnit && pending.stage === currentStage) {
                playQuestionVoice(pending.unit, pending.stage);
                return;
            }
        }
        if (!questionVoiceAudioUnlocked && npcQuestionVoiceAudio && !isQuestionVoicePlaying) {
            try {
                npcQuestionVoiceAudio.onended = () => {
                    if (npcQuestionVoiceAudio.src && npcQuestionVoiceAudio.src.startsWith('data:audio')) {
                        npcQuestionVoiceAudio.pause();
                        npcQuestionVoiceAudio.currentTime = 0;
                    }
                };
                npcQuestionVoiceAudio.onerror = () => {};
                npcQuestionVoiceAudio.src = questionVoiceUnlockSrc;
                npcQuestionVoiceAudio.currentTime = 0;
                const unlockPromise = npcQuestionVoiceAudio.play();
                if (unlockPromise && typeof unlockPromise.then === 'function') {
                    unlockPromise.then(() => {
                        questionVoiceAudioUnlocked = true;
                    }).catch(() => {});
                } else {
                    questionVoiceAudioUnlocked = true;
                }
            } catch(e) {}
        }
    }

    ['pointerdown', 'click', 'keydown', 'touchstart'].forEach(evtName => {
        document.addEventListener(evtName, handleAudioUnlockAndPendingVoice, true);
    });

    function stopAllQuestionVoice() {
        isQuestionVoicePlaying = false;
        if (npcQuestionVoiceAudio) {
            try {
                npcQuestionVoiceAudio.onerror = null;
                npcQuestionVoiceAudio.onended = null;
                npcQuestionVoiceAudio.pause();
                npcQuestionVoiceAudio.currentTime = 0;
                npcQuestionVoiceAudio.removeAttribute('src');
                npcQuestionVoiceAudio.load();
            } catch(e) {}
        }
        if (currentInternVoiceAudio) {
            try {
                currentInternVoiceAudio.pause();
                currentInternVoiceAudio.currentTime = 0;
                currentInternVoiceAudio.removeAttribute('src');
                currentInternVoiceAudio.load();
                currentInternVoiceAudio = null;
            } catch(e) {}
        }
        if (grandmaVoiceAudio) {
            try {
                grandmaVoiceAudio.pause();
                grandmaVoiceAudio.currentTime = 0;
            } catch(e) {}
        }
        if (window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
                window.speechSynthesis.resume();
            } catch(e) {}
        }
        if (rpgBgmAudio && bgmPlaying) {
            rpgBgmAudio.volume = bgmBaseVolume;
        }
        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
            btnReplayQuestionVoice.classList.remove('playing');
        }
    }

    function toggleQuestionVoice(unit, stageNum) {
        if (!isTeacher) {
            stopAllQuestionVoice();
            return;
        }
        const now = Date.now();
        if (now - lastVoiceToggleTime < 350) {
            return;
        }
        lastVoiceToggleTime = now;

        const dragonGameOverModal = document.getElementById('dragonGameOverModal');
        const fatalOverlay = document.getElementById('fatalAspirationOverlay');
        if ((fatalOverlay && !fatalOverlay.classList.contains('hidden')) ||
            (dragonGameOverModal && !dragonGameOverModal.classList.contains('hidden'))) {
            stopAllQuestionVoice();
            return;
        }

        const isAudioPlaying = (npcQuestionVoiceAudio && !npcQuestionVoiceAudio.paused && npcQuestionVoiceAudio.currentTime > 0) ||
                               (currentInternVoiceAudio && !currentInternVoiceAudio.paused && currentInternVoiceAudio.currentTime > 0);
        const isTtsSpeaking = (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending));
        const isBtnPlaying = btnReplayQuestionVoice && (
            btnReplayQuestionVoice.classList.contains('playing') ||
            btnReplayQuestionVoice.textContent.includes('停止') ||
            btnReplayQuestionVoice.textContent.includes('⏹')
        );

        // 若正在播放（或按鈕狀態為 playing/停止朗讀/狀態旗標為播放中）-> 完全徹底停止朗讀
        if (isQuestionVoicePlaying || isAudioPlaying || isTtsSpeaking || isBtnPlaying) {
            stopAllQuestionVoice();
            if (activeUnit === 'support' && stageNum === 7) {
                activateSupportStage7Feeding();
            }
            return;
        }

        // 從頭播放
        playQuestionVoice(unit, stageNum);
    }

    function playQuestionVoice(unit, stageNum, moduleCode = currentModuleCode) {
        if (!isTeacher) {
            pendingQuestionVoice = null;
            stopAllQuestionVoice();
            return;
        }
        if (pendingQuestionVoice && pendingQuestionVoice.unit === unit && pendingQuestionVoice.stage === stageNum) {
            pendingQuestionVoice = null;
        }
        const dragonGameOverModal = document.getElementById('dragonGameOverModal');
        const fatalOverlay = document.getElementById('fatalAspirationOverlay');
        if ((fatalOverlay && !fatalOverlay.classList.contains('hidden')) ||
            (rpgVictoryModal && !rpgVictoryModal.classList.contains('hidden')) ||
            (grandmaThankModal && !grandmaThankModal.classList.contains('hidden')) ||
            (dragonGameOverModal && !dragonGameOverModal.classList.contains('hidden'))) {
            stopAllQuestionVoice();
            return;
        }
        const maxSt = (currentUnitConf && currentUnitConf.maxStages) ? currentUnitConf.maxStages : 4;
        if (stageNum > maxSt || currentStage > maxSt) {
            stopAllQuestionVoice();
            return;
        }

        const isSupport2Student = !isTeacher && (unit === 'support' || String(unit).includes('support')) && Number(stageNum) === 2;
        const isDm10Student = !isTeacher && (unit === 'dm' || String(unit).includes('dm')) && Number(stageNum) === 10;
        if (isSupport2Student || isDm10Student) {
            stopAllQuestionVoice();
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.classList.add('hidden');
            }
            return;
        }

        // 徹底停止先前正在播放的任何語音與 TTS (杜絕雙重人聲)
        stopAllQuestionVoice();
        isQuestionVoicePlaying = true;

        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '⏹ 停止朗讀';
            btnReplayQuestionVoice.classList.add('playing');
        }

        // 精準決定音檔路徑 (優先使用高品質範例人聲原音檔)
        let voicePath = null;
        const stageData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[stageNum] : null;
        let ttsFallbackStarted = false;
        const fallbackToQuestionText = () => {
            if (ttsFallbackStarted || !isQuestionVoicePlaying) return;
            ttsFallbackStarted = true;
            speakQuestionText(unit, stageNum);
        };
        const curriculum03ModuleNumber = getCurriculum03ModuleNumber(unit, moduleCode) ||
            getCurriculum03DisplayModuleNumber(unit, stageNum);
        if (curriculum03ModuleNumber > 0) {
            if (curriculum03ModuleNumber === 1) voicePath = 'assets/voice/curriculum_03_stage6.mp3';
            else if (curriculum03ModuleNumber === 2) voicePath = 'assets/voice/curriculum_03_stage5.mp3';
            else if (curriculum03ModuleNumber === 3) voicePath = 'assets/voice/curriculum_03_stage2.mp3';
            else if (curriculum03ModuleNumber === 4) voicePath = 'assets/voice/curriculum_03_stage3_question.mp3';
            else if (curriculum03ModuleNumber === 5) voicePath = 'assets/voice/curriculum_03_stage4.mp3';
            else if (curriculum03ModuleNumber === 6) voicePath = 'assets/voice/curriculum_03_stage1.mp3';
            else voicePath = `assets/voice/curriculum_03_stage${curriculum03ModuleNumber}.mp3`;
        } else if (unit === 'support') {
            if (stageNum === 1) voicePath = 'assets/voice/support_stage1_v2.mp3';
            else if (stageNum === 2) {
                if (supportStage2Step === 0) {
                    voicePath = 'assets/voice/support_stage2_intro.mp3';
                } else if (supportStage2Step === 1) {
                    voicePath = (selectedGender === 'male') ? 'assets/voice/support_stage2_intern_male.mp3' : 'assets/voice/support_stage2_intern_female.mp3';
                } else {
                    voicePath = 'assets/voice/support_stage2.mp3';
                }
            } else if (stageNum === 3) {
                voicePath = 'assets/voice/support_stage3.mp3';
            } else if (stageNum === 4) {
                voicePath = 'assets/voice/support_stage4.mp3';
            } else if (stageNum === 5) {
                voicePath = 'assets/voice/support_stage5.mp3';
            } else if (stageNum === 6) {
                voicePath = 'assets/voice/support_stage6.mp3';
            } else if (stageNum === 7) {
                voicePath = 'assets/voice/support_stage7.mp3';
            } else if (stageNum === 8) {
                // 第 8 題再餵食症候群專屬朗讀音檔
                voicePath = 'assets/voice/support_stage8.mp3';
            } else if (stageNum === 9) {
                // 第 9 題均衡管灌食配方辨識專屬朗讀音檔
                voicePath = 'assets/voice/support_stage9.mp3';
            } else if (stageNum === 10) {
                // 第 10 題黏膜屏障與細菌轉位防護專屬朗讀音檔
                voicePath = 'assets/voice/support_stage10.mp3';
            } else if (stageNum === 11) {
                // 第 11 題腸道營養與靜脈營養臨床效益評估專屬朗讀音檔
                voicePath = 'assets/voice/support_stage11.mp3';
            }
        } else if (stageData && stageData.voicePath) {
            voicePath = stageData.voicePath;
        } else if (unit === 'must' && stageNum <= 4) {
            voicePath = `assets/voice/must_stage${stageNum}.mp3`;
        } else if (unit === 'must' && stageNum === 5) {
            voicePath = `assets/voice/ncp_stage1.mp3`;
        } else if (unit === 'must' && stageNum === 6) {
            voicePath = `assets/voice/ncp_stage2.mp3`;
        } else if (unit === 'must' && stageNum === 7) {
            if (mustStage7Step === 0) {
                voicePath = 'assets/voice/must_stage7_zhou_intro.mp3';
            } else if (mustStage7Step === 1) {
                voicePath = 'assets/voice/must_stage7_zhou_shiyi.mp3';
            } else {
                voicePath = 'assets/voice/must_stage7_zhou_question.mp3';
            }
        } else if (unit === 'support' && stageNum === 1) {
            voicePath = null;
        } else if (unit === 'support' && stageNum <= 3) {
            voicePath = `assets/voice/support_stage${stageNum}.mp3`;
        } else if (unit === 'ncp' && stageNum <= 3) {
            voicePath = (stageNum === 1) ? `assets/voice/ncp_stage1.mp3` : ((stageNum === 2) ? `assets/voice/ncp_stage2.mp3` : `assets/voice/ncp_stage3.mp3`);
        } else if (unit === 'dm') {
            if (stageNum === 6) voicePath = 'assets/voice/dm_stage7.mp3';
            else if (stageNum === 7) voicePath = 'assets/voice/dm_stage8.mp3';
            else if (stageNum === 8) voicePath = 'assets/voice/dm_stage9_arcane.mp3';
            else if (stageNum === 9) voicePath = 'assets/voice/dm_stage10.mp3';
            else if (stageNum === 10) voicePath = 'assets/voice/dm_stage11.mp3';
            else if (stageNum === 11) voicePath = 'assets/voice/dm_stage11_dining.mp3'; // 與單元一第2題相同的高清範例女生語音
            else if (stageNum === 12) voicePath = 'assets/voice/dm_stage12_detective.mp3'; // 夜間血糖偵探小隊語音
            else voicePath = `assets/voice/dm_stage${stageNum}.mp3`;
        } else if (unit.includes('curriculum_03') || unit === 'curriculum_03' || unit === 'unit_curriculum_03') {
            const curriculum03DisplayModule = getCurriculum03DisplayModuleNumber(unit, stageNum) || Number(stageNum) || 0;
            if (curriculum03DisplayModule === 1) voicePath = 'assets/voice/curriculum_03_stage6.mp3';
            else if (curriculum03DisplayModule === 2) voicePath = 'assets/voice/curriculum_03_stage5.mp3';
            else if (curriculum03DisplayModule === 3) voicePath = 'assets/voice/curriculum_03_stage2.mp3';
            else if (curriculum03DisplayModule === 4) voicePath = 'assets/voice/curriculum_03_stage3_question.mp3';
            else if (curriculum03DisplayModule === 5) voicePath = 'assets/voice/curriculum_03_stage4.mp3';
            else if (curriculum03DisplayModule === 6) voicePath = 'assets/voice/curriculum_03_stage1.mp3';
            else voicePath = `assets/voice/curriculum_03_stage${curriculum03DisplayModule}.mp3`;
        } else if (unit.includes('curriculum_07') || unit === 'curriculum_07' || unit === 'unit_curriculum_07') {
            const stNum = Number(stageNum);
            if (stNum === 3) {
                voicePath = 'assets/voice/curriculum_07_stage3_custom.mp3';
            } else if (stNum === 4) {
                voicePath = 'assets/voice/curriculum_07_stage4_nutrient.mp3';
            } else if (stNum === 5) {
                voicePath = 'assets/voice/curriculum_07_stage3.mp3';
            } else if (stNum === 6) {
                voicePath = 'assets/voice/curriculum_07_stage4.mp3';
            } else {
                voicePath = `assets/voice/curriculum_07_stage${stNum}.mp3`;
            }
        } else if (unit.includes('bfbbb5') || unit === 'unit_bfbbb5') {
            voicePath = 'assets/voice/dm_stage6.mp3';
        } else if (unit === 'life' && stageNum <= 1) {
            voicePath = `assets/voice/life_stage${stageNum}.mp3`;
        }

        if (!npcQuestionVoiceAudio || !voicePath) {
            fallbackToQuestionText();
            return;
        }

        npcQuestionVoiceAudio.src = voicePath + (voicePath.includes('?') ? '&' : '?') + 't=' + Date.now();
        npcQuestionVoiceAudio.currentTime = 0;

        if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmUsesHospitalTrack ? 0.06 : 0.15;

        npcQuestionVoiceAudio.onended = () => {
            isQuestionVoicePlaying = false;
            startDeferredBgmAfterQuestionVoice(unit, stageNum);
            if (rpgBgmAudio && bgmPlaying) rpgBgmAudio.volume = bgmBaseVolume;
            if (btnReplayQuestionVoice) {
                btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
                btnReplayQuestionVoice.classList.remove('playing');
            }
            if (activeUnit === 'support' && currentStage === 7) {
                activateSupportStage7Feeding();
            }
            if (unit === 'dm' && Number(stageNum) === 12) {
                const isDmStage12 = (activeUnit === 'dm' && currentStage === 12) || (currentUnitConf && currentUnitConf.stages && currentUnitConf.stages[currentStage] && currentUnitConf.stages[currentStage].isDetectiveStage);
                if (isDmStage12 && detectiveStage12Step === 0) {
                    detectiveStage12Step = 1;
                    const detectiveArea = document.getElementById('detectiveTeamArea');
                    const speakerBadge = document.getElementById('speakerBadge');
                    const dialogContent = document.getElementById('dialogContent');
                    const dialogIndicator = document.getElementById('dialogIndicator');
                    if (speakerBadge) speakerBadge.textContent = '【血糖偵查小隊 隊長】';
                    if (dialogContent) {
                        dialogContent.innerHTML = '🕵️ <strong>「偵查小隊各就各位！請檢視夜間低血糖誘發的反向調節荷爾蒙反應，破解早晨反彈高血糖的真正元兇！」</strong><br><span style="color:#fef08a;">下列何者為造成此案例清晨高血糖的機轉？</span>';
                    }
                    if (dialogIndicator) dialogIndicator.textContent = '💡 請小隊成員共同討論機轉 ➔';
                    if (detectiveArea) detectiveArea.classList.remove('hidden');
                }
            }
        };

        npcQuestionVoiceAudio.onerror = () => {
            if (!isQuestionVoicePlaying) return;
            if ((rpgVictoryModal && !rpgVictoryModal.classList.contains('hidden')) ||
                (grandmaThankModal && !grandmaThankModal.classList.contains('hidden')) ||
                (currentUnitConf && currentStage > currentUnitConf.maxStages)) {
                return;
            }
            console.log('Voice file not found or failed, using TTS fallback');
            fallbackToQuestionText();
        };

        const playPromise = npcQuestionVoiceAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (!isQuestionVoicePlaying) {
                    try {
                        npcQuestionVoiceAudio.pause();
                        npcQuestionVoiceAudio.currentTime = 0;
                    } catch(e) {}
                    return;
                }
                if (btnReplayQuestionVoice) {
                    btnReplayQuestionVoice.textContent = '⏹ 停止朗讀';
                    btnReplayQuestionVoice.classList.add('playing');
                    btnReplayQuestionVoice.classList.remove('pulse-voice-prompt');
                }
            }).catch((err) => {
                if (!isQuestionVoicePlaying) return;
                // 切換題目造成的正常中斷不可觸發第二個語音來源。
                if (err && err.name === 'AbortError') return;
                if (err && err.name === 'NotAllowedError') {
                    // 若音檔播放因尚未互動被手機瀏覽器 Autoplay 阻擋，標記待播並提示點擊
                    isQuestionVoicePlaying = false;
                    pendingQuestionVoice = { unit, stage: stageNum };
                    if (btnReplayQuestionVoice) {
                        btnReplayQuestionVoice.textContent = '🔊 點我朗讀題目';
                        btnReplayQuestionVoice.classList.remove('playing');
                        btnReplayQuestionVoice.classList.add('pulse-voice-prompt');
                    }
                    return;
                }
                if ((rpgVictoryModal && !rpgVictoryModal.classList.contains('hidden')) ||
                    (grandmaThankModal && !grandmaThankModal.classList.contains('hidden')) ||
                    (currentUnitConf && currentStage > currentUnitConf.maxStages)) {
                    return;
                }
                // WebView may reject automatic audio playback; fall back to speech synthesis.
                fallbackToQuestionText();
            });
        }
    }

    // 教師公布答案按鈕
    const btnTeacherReveal = document.getElementById('btnTeacherRevealAnswer');
    if (btnTeacherReveal) {
        btnTeacherReveal.addEventListener('click', () => {
            sfxClick();
            teacherStageRevealed = true;
            isStageLocked = true;
            runUnit3RevealVideoThen(() => fetch(`/api/admin/reveal?unit=${encodeURIComponent(activeUnit)}&stage=${currentStage}&role=teacher`)
                .then(res => res.json())
                .then(data => {
                    data.revealed = true;
                    updateStatsUI(data);
                })
                .catch(() => {
                    const stData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
                    updateStatsUI({
                        revealed: true,
                        locked: true,
                        stage: currentStage,
                        currentStage: currentStage,
                        totalVotes: 1,
                        mostVoted: stData ? stData.correctKey : '1'
                    });
                }));
        });
    }

    // 推進下一關按鈕 (教師主控操作：第 1 次公布答案與解析，第 2 次推進至下一題)
    if (btnProceedNextStage) {
        btnProceedNextStage.addEventListener('click', () => {
            if (!isTeacher) return;
            sfxClick();
            isInPrologue = false;
            const maxSt = (currentUnitConf && currentUnitConf.maxStages) ? currentUnitConf.maxStages : 4;

            // 未公布答案狀態：第 1 次點擊立即鎖定作答並公布正確答案與臨床解析
            if (!teacherStageRevealed) {
                const revealStage = () => {
                    teacherStagePhase = 2;
                    teacherStageRevealed = true;
                    isStageLocked = true;
                    fetch(`/api/admin/reveal?unit=${activeUnit}&stage=${currentStage}&role=teacher`)
                        .then(res => res.json())
                        .then(data => {
                            updateStatsUI(data);
                        })
                        .catch(() => {
                            const stData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
                            updateStatsUI({
                                revealed: true,
                                locked: true,
                                stage: currentStage,
                                currentStage: currentStage,
                                totalVotes: studentSelectedOption ? 1 : 0,
                                options: studentSelectedOption ? { [studentSelectedOption]: 1 } : {},
                                mostVoted: studentSelectedOption || (stData ? stData.correctKey : '1')
                            });
                        });

                    if (btnProceedNextTxt) {
                        if (currentStage < maxSt) {
                            btnProceedNextTxt.textContent = `⏭️ 進入下一題 (進入第 ${currentStage + 1} 題) ➔`;
                        } else {
                            btnProceedNextTxt.textContent = '🏆 結算 ‧ 查看全班榮譽榜與證書 ➔';
                        }
                    }
                };
                runUnit3RevealVideoThen(revealStage);
                return;
            }

            // 已公布答案狀態：第 2 次點擊推進至下一題
            teacherStagePhase = 0;
            teacherStageRevealed = false;
            isStageLocked = false;
            if (activeUnit === 'must' && currentStage === 4 && maxSt > 4) {
                showGrandmaModalForStage4(true);
                return;
            }
            if (currentStage < maxSt) {
                const nextSt = currentStage + 1;
                fetch(`/api/admin/set_stage?stage=${nextSt}&unit=${activeUnit}&role=teacher`)
                    .then(res => res.json())
                    .then(data => loadStage(nextSt))
                    .catch(() => loadStage(nextSt));
            } else {
                currentStage = maxSt + 1;
                fetch(`/api/admin/set_stage?stage=${maxSt + 1}&unit=${activeUnit}&role=teacher`)
                    .then(() => triggerVictory())
                    .catch(() => triggerVictory());
            }
        });
    }



    // 火箭隊魔性嘲笑彈窗 (人生好難題 答錯專屬)
    function triggerRocketLaugh() {
        const rocketModal = document.getElementById('rocketLaughModal');
        const rocketVideo = document.getElementById('rocketLaughVideo');
        if (!rocketModal || !rocketVideo) return;

        const titleEl = document.getElementById('rocketModalTitle');
        if (titleEl) titleEl.textContent = '【人生好難題，答錯囉！】';

        if (rpgBgmAudio) rpgBgmAudio.volume = 0.1;
        rocketModal.classList.remove('hidden');
        try {
            rocketVideo.muted = false;
            rocketVideo.currentTime = 0;
            const p = rocketVideo.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) {}

        function closeRocket() {
            try { rocketVideo.pause(); } catch(e){}
            rocketModal.classList.add('hidden');
            if (rpgBgmAudio) rpgBgmAudio.volume = bgmBaseVolume;
        }

        const btnClose = document.getElementById('btnCloseRocketModal');
        if (btnClose) {
            btnClose.onclick = () => {
                sfxClick();
                closeRocket();
            };
        }
        rocketModal.onclick = (e) => {
            if (e.target === rocketModal) {
                closeRocket();
            }
        };
    }

    // 周朝宮廷 周王喝斥「押入天牢！」彈窗 (單元一 第 7 題 答錯專屬)
    function triggerKingDismissal() {
        if (kingDismissalTriggered || activeUnit !== 'must' || currentStage !== 7) return;
        kingDismissalTriggered = true;
        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch(e){}
        }
        if (npcQuestionVoiceAudio) {
            try { npcQuestionVoiceAudio.pause(); npcQuestionVoiceAudio.currentTime = 0; } catch(e){}
        }
        if (currentInternVoiceAudio) {
            try { currentInternVoiceAudio.pause(); currentInternVoiceAudio.currentTime = 0; } catch(e){}
        }
        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
            btnReplayQuestionVoice.classList.remove('playing');
        }

        const stageBd = document.getElementById('stageBackdrop');
        const charStage = document.getElementById('characterStage');
        if (charStage) charStage.classList.add('hidden');
        if (stageBd) {
            stageBd.classList.add('king-dismiss-darken');
            stageBd.style.setProperty('background-image', "url('assets/rpg_bg_zhou_jail.jpg')", 'important');
            stageBd.style.setProperty('background-size', 'cover', 'important');
            stageBd.style.setProperty('background-position', 'center center', 'important');
        }
        document.body.classList.add('gameover-grayscale-active');

        try {
            const kingAudio = new Audio('assets/voice/king_dismiss.mp3');
            kingAudio.volume = 1.0;
            kingAudio.play().catch(() => {});
        } catch(e) {}

        const kingModal = document.getElementById('kingDismissModal');
        if (kingModal) kingModal.classList.remove('hidden');

    }

    window.closeKingDismissModal = function() {
        const kingModal = document.getElementById('kingDismissModal');
        if (kingModal) kingModal.classList.add('hidden');
        document.body.classList.remove('gameover-grayscale-active');
    };

    function triggerFatalAspiration() {
        if (fatalAspirationTriggered || activeUnit !== 'support' || (currentStage !== 2 && currentStage !== 8)) return;
        fatalAspirationTriggered = true;
        if (window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch(e){}
        }
        if (npcQuestionVoiceAudio) {
            try { npcQuestionVoiceAudio.pause(); npcQuestionVoiceAudio.currentTime = 0; } catch(e){}
        }
        if (currentInternVoiceAudio) {
            try { currentInternVoiceAudio.pause(); currentInternVoiceAudio.currentTime = 0; } catch(e){}
        }
        if (btnReplayQuestionVoice) {
            btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
            btnReplayQuestionVoice.classList.remove('playing');
        }
        const fatalOverlay = document.getElementById('fatalAspirationOverlay');
        if (fatalOverlay) {
            const descEl = fatalOverlay.querySelector('.flatline-desc');
            if (descEl) {
                if (currentStage === 8) {
                    descEl.innerHTML = `
                        <strong>【急性再餵食症候群 ‧ 致死性心律不整與心臟驟停】</strong><br>
                        長期飢餓之重症病患因不當重灌處方，胰島素激增誘發電解質（磷、鉀、鎂）雪崩式驟降，引發急性致死性心律不整，搶救無效死亡！<br>
                        <span class="flatline-tip">💡 臨床黃金指引：連續約2週無營養攝入屬極高危險群！重啟餵食應以低熱量起始、補充硫胺素（Thiamin）並密切監測矯正電解質，切忌冒進加速！</span>
                    `;
                } else {
                    descEl.innerHTML = `
                        <strong>【重度吸入性肺炎 ‧ 急性呼吸衰竭致死】</strong><br>
                        重症病患因處置不當引發大量胃內容物誤吸（Aspiration），肺泡嚴重浸潤塌陷，搶救無效死亡！<br>
                        <span class="flatline-tip">💡 臨床黃金指引：常規檢查胃殘餘量 (GRV) 並未改善吸入風險，反致延誤灌食！應落實床頭抬高 30~45° 與口腔清潔！</span>
                    `;
                }
            }
            if (!fatalOverlayClosedByUser) fatalOverlay.classList.remove('hidden');
        }
        const stageBd = document.getElementById('stageBackdrop');
        if (stageBd) stageBd.classList.add('aspiration-flatline-grayscale');
        try {
            const ecgAudio = new Audio('assets/voice/ecg_flatline.wav');
            ecgAudio.play().catch(() => {});
        } catch(e) {}
    }

    function revealStudentFeedback(isCorrect, earned, stageData) {
        if (!stageData) return;
        questionFeedbackBanner.classList.remove('hidden', 'pending', 'correct', 'wrong');
        const pts = (earned !== undefined && earned !== null) ? earned : (isCorrect ? (currentUnitConf.pointsPerQuestion || 250) : 0);
        const explText = stageData.revealExplanation ? `<br><span style="font-size:13.5px;opacity:0.95;line-height:1.5;">💡 ${stageData.revealExplanation}</span>` : '';
        const correctOptionLabel = getCorrectOptionLabel(stageData);
        if (isCorrect) {
            questionFeedbackBanner.className = 'feedback-banner correct';
            questionFeedbackBanner.innerHTML = `✅ <strong>回答正確！獲得 +${pts} 分！</strong>（累計總積分：<strong>${myScore}</strong> 分）<br><span style="font-size:13.5px;opacity:0.95;line-height:1.5;">💡 正確答案為【${correctOptionLabel}】</span>${explText}`;
            sfxCorrect();
        } else {
            questionFeedbackBanner.className = 'feedback-banner wrong';
            questionFeedbackBanner.innerHTML = `❌ <strong>回答錯誤！本題未得分</strong>（累計總積分：<strong>${myScore}</strong> 分）<br><span style="font-size:13.5px;opacity:0.95;line-height:1.5;">💡 正確答案應為【${correctOptionLabel}】</span>${explText}`;
            sfxWrong();
        }

        if (!isCorrect && !isTeacher && activeUnit === 'support' && (currentStage === 2 || currentStage === 8)) {
            triggerFatalAspiration();
        }
        if (!isCorrect && !isTeacher && activeUnit === 'must' && currentStage === 7) {
            triggerKingDismissal();
        }
        if (activeUnit === 'must' && currentStage === 4 && !grandmaThankTriggered && !grandmaThankDismissed) {
            showGrandmaModalForStage4(currentUnitConf && currentUnitConf.maxStages > 4);
        }

        // 特效 2：單元三第 6 題陳先生火冒三丈畫面置頂與紅光
        if (activeUnit === 'dm' && currentStage === 6) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            const appMainEl = document.getElementById('rpg-app');
            if (appMainEl) appMainEl.scrollTop = 0;
            const stageBd = document.getElementById('stageBackdrop');
            if (stageBd) {
                stageBd.scrollIntoView({ behavior: 'smooth', block: 'start' });
                stageBd.classList.add('chen-angry-red-mode');
            }
            const teacherImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');
            if (teacherImg) teacherImg.src = 'assets/tech_director_chen_angry.png';
        }

        // 特效 3：單元二第 7 題配方灌食公布答案 (播放灌食動畫，若有任一位學生回答錯誤皆呈現嚴重腹瀉惡化畫面)
        if (activeUnit === 'support' && currentStage === 7) {
            playFormulaFeedingAnimation();
            const stageBd = document.getElementById('stageBackdrop');
            const formulaTray = document.getElementById('formulaBottleChoices');
            if (formulaTray && formulaTray.classList.contains('hidden')) {
                activateSupportStage7Feeding(stageData);
            }
            hideSupportStage7FeedingTarget();
            document.querySelectorAll('.formula-drag-ghost').forEach(g => g.remove());
            document.querySelectorAll('.formula-bottle-card').forEach(card => {
                card.classList.add('disabled-lock');
                card.style.pointerEvents = 'none';
                card.style.cursor = 'default';
                const key = card.dataset.key;
                card.classList.toggle('selected', !!studentSelectedOption && key === String(studentSelectedOption));
                if (key === String(stageData.correctKey || '1')) {
                    card.classList.add('is-correct-answer');
                    card.classList.remove('is-wrong-answer');
                } else {
                    card.classList.add('is-wrong-answer');
                    card.classList.remove('is-correct-answer');
                }
            });

            const optionsMap = (window.lastPollData && window.lastPollData.options) ? window.lastPollData.options : {};
            const correctKey = String(stageData.correctKey || '1');
            const classHasWrong = Object.keys(optionsMap).some(key => String(key) !== correctKey && Number(optionsMap[key]) > 0);
            const isAnyWrong = classHasWrong || (!isTeacher && !isCorrect) || (!isTeacher && studentSelectedOption && String(studentSelectedOption) !== correctKey);

            if (stageBd) {
                if (isAnyWrong) {
                    stageBd.classList.add('formula-wrong-outcome');
                    stageBd.style.setProperty('background-image', "url('assets/rpg_bg_tube_feeding_diarrhea.png')", 'important');
                    stageBd.style.setProperty('background-size', 'cover', 'important');
                    stageBd.style.setProperty('background-position', 'center center', 'important');
                } else {
                    stageBd.classList.remove('formula-wrong-outcome');
                    stageBd.style.setProperty('background-image', "url('assets/rpg_bg_support_stage7_correct.jpg')", 'important');
                    stageBd.style.setProperty('background-size', 'cover', 'important');
                    stageBd.style.setProperty('background-position', 'center center', 'important');
                }
            }
            if (dialogBox) dialogBox.classList.remove('hidden');
            if (isAnyWrong) {
                if (speakerBadge) speakerBadge.textContent = '【病情惡化警示】';
                if (dialogContent) dialogContent.innerHTML = '<strong style="color:#f87171; font-size:15.5px;">⚠️ 錯誤配方引發嚴重腹瀉，病人營養流失加劇！</strong><div style="margin-top:6px; color:#fef08a; font-size:14.5px; line-height:1.5;">💡 <strong>臨床解析：</strong>放射性腸炎造成腸道黏膜受損，應選用預先水解之<strong>【元素/預解配方】</strong>（含雙生肽與游離胺基酸），無需酵素分解即可直接吸收！</div>';
                if (dialogIndicator) dialogIndicator.textContent = '💡 臨床解析：請選用小分子元素配方 ➔';
            } else {
                if (speakerBadge) speakerBadge.textContent = '【臨床處置成功】';
                if (dialogContent) dialogContent.innerHTML = '<strong style="color:#86efac; font-size:15.5px;">✅ 決策正確！元素或預解配方已送達病人。</strong><div style="margin-top:6px; color:#f8fafc; font-size:14.5px; line-height:1.5;">💡 <strong>臨床重點：</strong>雙生肽與游離胺基酸可直接被受損小腸吸收，有效改善放射性腸炎之腹瀉與吸收不良！</div>';
                if (dialogIndicator) dialogIndicator.textContent = '🎉 決策正確！等待教師推進至下一題 ➔';
            }
        }
    }

function selectOption(key) {
if (!isTeacher && (teacherStageRevealed || isStageLocked)) return;
if (!isTeacher && String(studentSelectedOption) === String(key)) return;
const selectedStageData = currentUnitConf && currentUnitConf.stages
    ? currentUnitConf.stages[currentStage]
    : null;
if ((activeUnit === 'new_student_trial' || activeUnit === 'f47185' || (currentUnitConf && currentUnitConf.themeClass === 'new-student-trial-theme') || (currentUnitConf && currentUnitConf.name && (currentUnitConf.name.includes('勇者') || currentUnitConf.name.includes('新生')))) &&
    (!selectedStageData || !selectedStageData.correctKey || !selectedStageData.options || selectedStageData.options.length === 0)) return;
studentSelectedOption = key;
if (activeUnit === 'support' && currentStage === 10) {
updateSupportStage10AnatomySelection(key, null, false);
}
sfxVote();

if (grandmaVoiceAudio) {
try { grandmaVoiceAudio.load(); } catch(e){}
}

// Keep the selection visible while allowing changes until the teacher reveals the answer.
document.querySelectorAll('.rpg-choice-btn').forEach(b => {
const isSelected = b.dataset.key === key;
b.classList.toggle('selected', isSelected);
b.classList.toggle('disabled-lock', !isTeacher && (teacherStageRevealed || isStageLocked));
b.style.pointerEvents = !isTeacher && (teacherStageRevealed || isStageLocked) ? 'none' : '';
});
document.querySelectorAll('.protein-option-hotspot[data-key], .bulimia-option-hotspot[data-key]').forEach(button => {
button.classList.toggle('selected', button.dataset.key === String(key));
});
document.querySelectorAll('.table-food-item[data-key]').forEach(item => {
    const isSelected = String(item.dataset.key) === String(key);
    item.classList.toggle('selected', isSelected);
});
document.querySelectorAll('.kidney-stage3-stone[data-key]').forEach(stone => {
    const isSelected = String(stone.dataset.key) === String(key);
    stone.classList.toggle('selected', isSelected);
    stone.setAttribute('aria-pressed', String(isSelected));
});
updateKidneyPortalSelection(key);
document.querySelectorAll('.scifi-opt-btn, .arcane-opt-btn').forEach(b => {
const isSelected = b.dataset.key === key;
b.classList.toggle('selected', isSelected);
b.classList.toggle('opt-locked', isSelected && b.classList.contains('scifi-opt-btn'));
b.classList.toggle('rune-selected', isSelected && b.classList.contains('arcane-opt-btn'));
b.classList.toggle('disabled-lock', !isTeacher && (teacherStageRevealed || isStageLocked));
b.style.pointerEvents = !isTeacher && (teacherStageRevealed || isStageLocked) ? 'none' : '';
});

const curStageData = currentUnitConf.stages[currentStage];
const isLifeQuiz = (activeUnit === 'life' || currentUnitConf.isLifeQuiz || (curStageData && curStageData.isLifeQuiz));
if (isLifeQuiz && curStageData && key !== curStageData.correctKey) {
triggerRocketLaugh();
}
// 單元三 第 2 題：黑炎魔龍 Boss 戰鬥判定 (拉拉條與選項連動出擊)
if (activeUnit === 'dm' && currentStage === 2) {
let optVal = 6.5;
if (curStageData && curStageData.options) {
const opt = curStageData.options.find(o => o.key === key);
if (opt && opt.text) {
const m = opt.text.match(/(\d+\.?\d*)/);
if (m) optVal = parseFloat(m[1]);
}
}
const slider = document.getElementById('a1cRangeSlider');
const valEl = document.getElementById('a1cCurrentVal');
if (slider) slider.value = optVal.toString();
if (valEl) valEl.textContent = optVal.toFixed(1);

executeDragonBattleAttack(optVal);
}

// Confirm the vote and remind students that they can revise it before the answer is revealed.
questionFeedbackBanner.className = 'feedback-banner pending';
questionFeedbackBanner.classList.remove('hidden');
questionFeedbackBanner.innerHTML = !isTeacher
    ? `📝 <strong>已登記選項 ${key}，公布答案前可修改</strong><br><span style="font-size:13px;opacity:0.9;">⏳ 請等待教師公布答案；公布前可重新選擇。</span>`
    : `🔒 <strong>教師端選擇選項 ${key}</strong>`;

fetch(`/api/vote?unit=${activeUnit}&stage=${currentStage}&option=${encodeURIComponent(key)}&clientId=${encodeURIComponent(clientId)}`)
.then(res => res.json())
.then(data => {
updateStatsUI(data);
if (data.totalScore !== undefined) {
myScore = data.totalScore;
}
const stageData = currentUnitConf.stages[currentStage];
const isCorrect = (data.isCorrect !== undefined) ? data.isCorrect : (key === (stageData ? stageData.correctKey : ''));
const earned = (data.scoreEarned !== undefined) ? data.scoreEarned : (isCorrect ? (currentUnitConf.pointsPerQuestion || 250) : 0);

pendingAnswerResult = {
stage: currentStage,
unit: activeUnit,
selectedKey: key,
isCorrect: isCorrect,
earned: earned,
data: data
};

        // 教師公布答案後更新學生回饋
        if (data.revealed || data.isRevealed) {
            teacherStageRevealed = true;
            const stageData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
            // 單元六第 8 題：公布答案後，若選項 3（正確答案）票數最高，師生端播放全螢幕動畫。
            if (activeUnit === 'dm' && Number(currentStage) === 8) {
                playDmStage8StudentVideo(optionsMap, highestVoteCount);
            }
            if (stageData) {
                const isCorrect = String(key) === String(stageData.correctKey);
                revealStudentFeedback(isCorrect, earned, stageData);
            }
        }
    })
    .catch(() => {});
}

    function updateStatsUI(data) {
        if (!data) return;
        // Older desktop builds call ToggleReveal directly. If that build is
        // still running, hold the revealed state at the web boundary and
        // show the required video before rendering the answer.
        const isUnit3Stage6Reveal = isTeacher &&
            isUnit3Stage6RevealTarget(data.currentUnit || activeUnit, data.currentStage || currentStage);
        if (isUnit3Stage6Reveal && (data.revealed || data.isRevealed)) {
            if (!unit3RevealVideoCompleted && !unit3RevealVideoPending) {
                runUnit3RevealVideoThen(() => {
                    fetch(`/api/admin/reveal?unit=${activeUnit}&stage=${currentStage}&role=teacher`)
                        .then(res => res.json())
                        .then(revealData => updateStatsUI(revealData))
                        .catch(error => console.error('單元三答案影片完成後公布答案失敗', error));
                });
            }
            // Do not let the next polling response render the answer while
            // the reveal video is still playing.
            if (!unit3RevealVideoCompleted) return;
        }
        if (isUnit3Stage6Reveal && unit3RevealVideoPending) {
            setUnit3RevealVideoOverlayVisible(true);
            return;
        }
        syncUnitFromServer(data);
        const reportedStageCount = Number(data.maxStages);
        if (Number.isInteger(reportedStageCount) && reportedStageCount > 0 && !unitDefinitions[activeUnit]) {
            unitStageCounts[activeUnit] = reportedStageCount;
        }
        const maxSt = (Number.isInteger(reportedStageCount) && reportedStageCount > 0)
            ? (unitDefinitions[activeUnit]
                ? Math.max(reportedStageCount, currentUnitConf.maxStages || 1)
                : reportedStageCount)
            : (currentUnitConf.maxStages || 1);
        if (currentUnitConf) currentUnitConf.maxStages = maxSt;
        const serverStage = Number(data.currentStage);
        if (!isTeacher && Number.isInteger(serverStage) && serverStage > 0 &&
            (serverStage !== currentStage || renderedStage !== serverStage || renderedUnit !== activeUnit)) {
            if (serverStage <= maxSt) {
                loadStage(serverStage);
            } else {
                currentStage = serverStage;
                renderedStage = serverStage;
                renderedUnit = activeUnit;
                showLeaderboardModal();
            }
        }
        if (!isTeacher && data.currentStage) {
            currentStage = data.currentStage;
            updateStageIndicator(currentStage);
        }
        isStageLocked = !!data.locked;
        if (!isTeacher) {
            const answerLocked = !!(data.revealed || data.isRevealed || data.locked);
            teacherStageRevealed = answerLocked;
            document.querySelectorAll('.rpg-choice-btn[data-key], .scifi-opt-btn[data-key], .arcane-opt-btn[data-key]').forEach(button => {
                button.classList.toggle('disabled-lock', answerLocked);
                button.style.pointerEvents = answerLocked ? 'none' : '';
                button.classList.toggle('selected', button.dataset.key === String(studentSelectedOption));
                button.classList.toggle('opt-locked', button.classList.contains('scifi-opt-btn') &&
                    button.dataset.key === String(studentSelectedOption));
                button.classList.toggle('rune-selected', button.classList.contains('arcane-opt-btn') &&
                    button.dataset.key === String(studentSelectedOption));
            });
            document.querySelectorAll('.protein-option-hotspot[data-key], .bulimia-option-hotspot[data-key], .bulimia-option-hotspot[data-key]').forEach(button => {
                button.disabled = answerLocked;
                button.classList.toggle('disabled-lock', answerLocked);
                button.classList.toggle('selected', button.dataset.key === String(studentSelectedOption));
            });
            document.querySelectorAll('.kidney-stage3-stone[data-key]').forEach(stone => {
                stone.classList.toggle('disabled-lock', answerLocked);
                stone.style.pointerEvents = answerLocked ? 'none' : '';
                stone.classList.toggle('selected', String(stone.dataset.key) === String(studentSelectedOption));
                stone.setAttribute('aria-pressed', String(String(stone.dataset.key) === String(studentSelectedOption)));
            });
            if (activeUnit === 'support' && currentStage === 10) {
                const stageData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
                updateSupportStage10AnatomySelection(
                    studentSelectedOption,
                    answerLocked && stageData ? stageData.correctKey : null,
                    answerLocked
                );
            }
        }
        if (leaderboardDismissed && data.currentStage <= maxSt &&
            data.currentStage !== leaderboardReturnStage) {
            leaderboardDismissed = false;
        }
        const optionsMap = data.options || {};
        const percentagesMap = data.percentages || {};
        const total = Number(data.totalVotes) || Object.values(optionsMap).reduce((sum, n) => sum + (Number(n) || 0), 0);
        if (liveVotesSummary) liveVotesSummary.textContent = `👥 本關投票：${total} 人`;
        if (liveStatPill) liveStatPill.textContent = `📊 本關投票：${total} 票`;
        const highestVoteCount = Math.max(0, ...Object.values(optionsMap).map(count => Number(count) || 0));

        // 單元六第 8 題：教師端或學生端收到「已公布答案」狀態時，直接觸發全螢幕答對動畫。
        // 播放掛在共用統計更新流程，確保輪詢、教師公布答案按鈕及主控台公布答案都能觸發。
        if (data.revealed || data.isRevealed) {
            playDmStage8StudentVideo(optionsMap, highestVoteCount);
        }

        document.querySelectorAll('.rpg-choice-btn[data-key]').forEach(button => {
            const key = button.dataset.key;
            const votes = Number(optionsMap[key]) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(percentagesMap[key] ?? (votes / total * 100))))
                : 0;
            const percentageEl = button.querySelector('.choice-pct-pill');
            const votesEl = button.querySelector('.choice-votes-cnt');
            const fillEl = button.querySelector('.vote-bar-fill');
            const crownEl = button.querySelector('.highest-crown');
            if (percentageEl) percentageEl.textContent = `${percentage.toFixed(1)}%`;
            if (votesEl) votesEl.textContent = `(${votes}票)`;
            if (fillEl) fillEl.style.width = `${percentage}%`;
            const isHighestVoted = total > 0 && votes === highestVoteCount;
            button.classList.toggle('highest-voted', isHighestVoted);
            if (crownEl) crownEl.classList.toggle('hidden', !isHighestVoted);
        });
        document.querySelectorAll('.protein-option-hotspot[data-key], .bulimia-option-hotspot[data-key], .bulimia-option-hotspot[data-key]').forEach(button => {
            const key = button.dataset.key;
            const votes = Number(optionsMap[key]) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(percentagesMap[key] ?? (votes / total * 100))))
                : 0;
            const percentageEl = button.querySelector('.choice-pct-pill');
            const votesEl = button.querySelector('.choice-votes-cnt');
            if (percentageEl) percentageEl.textContent = `${percentage.toFixed(1)}%`;
            if (votesEl) votesEl.textContent = `${votes}人`;
            button.classList.toggle('highest-voted', total > 0 && votes === highestVoteCount);
        });

        // 單元二 第1題：科幻 HUD 鼻胃管按鈕即時投票更新
        document.querySelectorAll('.scifi-opt-btn[data-key]').forEach(button => {
            const key = String(button.dataset.key);
            const votes = Number(optionsMap[key]) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(percentagesMap[key] ?? (votes / total * 100))))
                : 0;
            const percentageEl = button.querySelector('.choice-pct') || button.querySelector(`#scifi_pct_${key}`);
            const votesEl = button.querySelector('.choice-cnt') || button.querySelector(`#scifi_cnt_${key}`);
            const fillEl = button.querySelector('.choice-fill') || button.querySelector(`#scifi_fill_${key}`);
            const crownEl = button.querySelector('.choice-crown') || button.querySelector(`#scifi_crown_${key}`);
            if (percentageEl) percentageEl.textContent = `${percentage.toFixed(1)}%`;
            if (votesEl) votesEl.textContent = `(${votes}票)`;
            if (fillEl) fillEl.style.width = `${percentage}%`;
            const isHighestVoted = total > 0 && votes === highestVoteCount;
            button.classList.toggle('highest-voted', isHighestVoted);
            if (crownEl) crownEl.classList.toggle('hidden', !isHighestVoted);
        });

        // 單元二 第7題：配方瓶即時投票更新
        document.querySelectorAll('.formula-bottle-card[data-key]').forEach(card => {
            const key = card.dataset.key;
            const votes = Number(optionsMap[key]) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(percentagesMap[key] ?? (votes / total * 100))))
                : 0;
            const statEl = card.querySelector('.formula-vote-stat');
            if (statEl) {
                statEl.textContent = `${percentage.toFixed(1)}% (${votes}票)`;
            }
            const isHighestVoted = total > 0 && votes === highestVoteCount;
            card.classList.toggle('highest-voted', isHighestVoted);
        });

        // 單元七 第1題：腎臟神殿 4座指定區域即時投票更新
        const isKidneyUnitStage1 = (activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'kidney') && Number(currentStage) === 1;
        document.querySelectorAll('.portal-vote-pill[data-vote-key]').forEach(pill => {
            const key = pill.dataset.voteKey;
            const letterKey = key === '1' ? 'A' : key === '2' ? 'B' : key === '3' ? 'C' : key === '4' ? 'D' : key;
            const votes = Number(optionsMap[key] ?? optionsMap[letterKey] ?? optionsMap[key.toLowerCase()] ?? optionsMap[letterKey.toLowerCase()]) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(percentagesMap[key] ?? percentagesMap[letterKey] ?? (votes / total * 100))))
                : 0;
            pill.textContent = `${percentage.toFixed(1)}% (${votes}人)`;
        });

        if (isKidneyUnitStage1) {
            document.querySelectorAll('.kidney-portal-zone[data-key]').forEach(zone => {
                const key = zone.dataset.key;
                const letterKey = key === '1' ? 'A' : key === '2' ? 'B' : key === '3' ? 'C' : key === '4' ? 'D' : key;
                const votes = Number(optionsMap[key] ?? optionsMap[letterKey] ?? optionsMap[key.toLowerCase()] ?? optionsMap[letterKey.toLowerCase()]) || 0;
                const statusBadge = zone.querySelector('.portal-status-badge');
                if (statusBadge) {
                    statusBadge.textContent = `📍 目前共 ${votes} 位同學選擇此區`;
                }
            });
            if (typeof updateKidneyMobaStudents === 'function') {
                updateKidneyMobaStudents(data.students);
            }
        }

        // 單元二 第10題：消化道器官解剖圖即時投票更新
        document.querySelectorAll('.support-stage10-hotspot[data-key]').forEach(spot => {
            const key = spot.dataset.key;
            const votes = Number(optionsMap[key]) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(percentagesMap[key] ?? (votes / total * 100))))
                : 0;
            let statEl = spot.querySelector('.support-hotspot-vote-pill');
            if (!statEl) {
                statEl = document.createElement('div');
                statEl.className = 'support-hotspot-vote-pill';
                spot.appendChild(statEl);
            }
            statEl.textContent = `${percentage.toFixed(1)}% (${votes}票)`;
            const isHighestVoted = total > 0 && votes === highestVoteCount;
            spot.classList.toggle('highest-voted', isHighestVoted);
        });
        if (activeUnit === 'support' && Number(currentStage) === 10) {
            const stageData = currentUnitConf && currentUnitConf.stages
                ? currentUnitConf.stages[currentStage]
                : null;
            const answerRevealed = !!(data.revealed || data.isRevealed || data.locked || teacherStageRevealed);
            updateSupportStage10AnatomySelection(
                studentSelectedOption,
                stageData ? stageData.correctKey : MODULE_TEMPLATES.SUPPORT_STAGE_10.correctKey,
                answerRevealed
            );
        }

        // 單元六 第11題：餐桌食物即時投票更新
        document.querySelectorAll('.table-food-item[data-key]').forEach(item => {
            const key = String(item.dataset.key);
            const letterKey = ['A', 'B', 'C', 'D'][Number(key) - 1] || key;
            const votes = Number(
                optionsMap[key] ??
                optionsMap[letterKey] ??
                optionsMap[key.toLowerCase()] ??
                optionsMap[letterKey.toLowerCase()] ??
                optionsMap[`選項 ${key}`] ??
                optionsMap[`選項 ${letterKey}`]
            ) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(
                    percentagesMap[key] ??
                    percentagesMap[letterKey] ??
                    percentagesMap[key.toLowerCase()] ??
                    percentagesMap[letterKey.toLowerCase()] ??
                    (votes / total * 100)
                )))
                : 0;
            let statEl = item.querySelector('.table-food-vote-pill') || item.querySelector(`[data-vote-key="${key}"]`);
            if (!statEl) {
                statEl = document.createElement('span');
                statEl.className = 'table-food-vote-pill';
                statEl.setAttribute('data-vote-key', key);
                item.prepend(statEl);
            }
            statEl.textContent = `${percentage.toFixed(1)}% (${votes}票)`;
            statEl.style.setProperty('display', 'block', 'important');
            const isHighestVoted = total > 0 && votes === highestVoteCount;
            item.classList.toggle('highest-voted', isHighestVoted);
            if (studentSelectedOption !== null && studentSelectedOption !== undefined && String(studentSelectedOption) === key) {
                item.classList.add('selected');
            }
        });

        // 單元七 第1題：腎臟晶石傳送門即時投票更新
        document.querySelectorAll('.kidney-portal-zone[data-key]').forEach(item => {
            const key = String(item.dataset.key);
            const letterKey = ['A', 'B', 'C', 'D'][Number(key) - 1] || key;
            const votes = Number(
                optionsMap[key] ??
                optionsMap[letterKey] ??
                optionsMap[key.toLowerCase()] ??
                optionsMap[letterKey.toLowerCase()] ??
                optionsMap[`選項 ${key}`] ??
                optionsMap[`選項 ${letterKey}`]
            ) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(
                    percentagesMap[key] ??
                    percentagesMap[letterKey] ??
                    percentagesMap[key.toLowerCase()] ??
                    percentagesMap[letterKey.toLowerCase()] ??
                    (votes / total * 100)
                )))
                : 0;
            let statEl = item.querySelector('.portal-vote-pill') || item.querySelector(`[data-vote-key="${key}"]`);
            if (!statEl) {
                statEl = document.createElement('span');
                statEl.className = 'portal-vote-pill';
                statEl.setAttribute('data-vote-key', key);
                item.appendChild(statEl);
            }
            statEl.textContent = `${percentage.toFixed(1)}% (${votes}票)`;
            statEl.style.setProperty('display', 'block', 'important');
            if (studentSelectedOption !== null && studentSelectedOption !== undefined && String(studentSelectedOption) === key) {
                item.classList.add('selected');
            }
        });

        // 單元七第 3 題：石碑上的 A～D 選項即時顯示投票比例與票數。
        document.querySelectorAll('.kidney-stage3-stone[data-key]').forEach(stone => {
            const key = String(stone.dataset.key);
            const letterKey = ['A', 'B', 'C', 'D'][Number(key) - 1] || key;
            const votes = Number(
                optionsMap[key] ?? optionsMap[letterKey] ??
                optionsMap[key.toLowerCase()] ?? optionsMap[letterKey.toLowerCase()] ??
                optionsMap[`選項 ${key}`] ?? optionsMap[`選項 ${letterKey}`]
            ) || 0;
            const percentage = total > 0
                ? Math.max(0, Math.min(100, Number(
                    percentagesMap[key] ?? percentagesMap[letterKey] ??
                    percentagesMap[key.toLowerCase()] ?? percentagesMap[letterKey.toLowerCase()] ??
                    (votes / total * 100)
                )))
                : 0;
            const voteLabel = stone.querySelector('.kidney-stage3-stone-vote');
            if (voteLabel) voteLabel.textContent = `${percentage.toFixed(1)}% (${votes}票)`;
            stone.classList.toggle('highest-voted', total > 0 && votes === highestVoteCount);
            stone.classList.toggle('selected', String(studentSelectedOption) === key);
            stone.setAttribute('aria-pressed', String(String(studentSelectedOption) === key));
        });

        if (data.currentStage && data.currentStage > maxSt) {
            if (leaderboardDismissed) {
                currentStage = leaderboardReturnStage;
                updateStageIndicator(currentStage);
            } else if (rpgVictoryModal && rpgVictoryModal.classList.contains('hidden')) {
                showLeaderboardModal();
            }
            return;
        }
        const isAnswerRevealedNow = Boolean(data.revealed || data.isRevealed || teacherStageRevealed);
        if (isAnswerRevealedNow) {
            teacherStageRevealed = true;
            let stageData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
            if (!stageData && (activeUnit.includes('curriculum_07') || activeUnit === 'curriculum_07' || activeUnit === 'kidney')) {
                const modCode = `CURRICULUM_07_STAGE_${currentStage}`;
                stageData = MODULE_TEMPLATES[modCode] || null;
            }
            const correctKey = stageData ? String(stageData.correctKey) : (isKidneyUnitStage1 ? '2' : '1');
            if (stageData) {
                applyAnswerRevealStyles(stageData, true);
                if (activeUnit === 'support' && currentStage === 10) {
                    updateSupportStage10AnatomySelection(studentSelectedOption, correctKey, true);
                }
            }
            if (isKidneyUnitStage1 && typeof applyKidneyMobaAnswerReveal === 'function') {
                applyKidneyMobaAnswerReveal(correctKey, true);
            }
            if (stageData || isKidneyUnitStage1) {

                // 1. 標準選項按鈕正確/錯誤高亮標記
                document.querySelectorAll('.rpg-choice-btn[data-key]').forEach(button => {
                    const key = String(button.dataset.key);
                    if (key === correctKey) {
                        button.classList.add('is-correct-answer');
                        button.classList.remove('is-wrong-answer');
                    } else {
                        button.classList.add('is-wrong-answer');
                        button.classList.remove('is-correct-answer');
                    }
                });
                document.querySelectorAll('.protein-option-hotspot[data-key], .bulimia-option-hotspot[data-key], .bulimia-option-hotspot[data-key]').forEach(button => {
                    const key = String(button.dataset.key);
                    button.classList.toggle('is-correct-answer', key === correctKey);
                    button.classList.toggle('is-wrong-answer', key !== correctKey);
                });

                // 單元七 第1題：腎臟神殿 4座指定區域答案揭曉高亮標記
                document.querySelectorAll('.kidney-portal-zone[data-key]').forEach(zone => {
                    const key = String(zone.dataset.key);
                    zone.classList.toggle('is-correct-answer', key === correctKey);
                    zone.classList.toggle('is-wrong-answer', key !== correctKey);
                });

                // 單元七第 3 題：公布答案後以綠色與紅色標示石碑選項。
                document.querySelectorAll('.kidney-stage3-stone[data-key]').forEach(stone => {
                    const isCorrect = String(stone.dataset.key) === correctKey;
                    stone.classList.toggle('is-correct-answer', isCorrect);
                    stone.classList.toggle('is-wrong-answer', !isCorrect);
                });

                // 2. 科幻題型按鈕正確/錯誤高亮標記
                document.querySelectorAll('.scifi-opt-btn[data-key]').forEach(button => {
                    const key = String(button.dataset.key);
                    if (key === correctKey) {
                        button.classList.add('scifi-correct', 'is-correct-answer');
                        button.classList.remove('is-wrong-answer');
                    } else {
                        button.classList.add('is-wrong-answer');
                        button.classList.remove('scifi-correct', 'is-correct-answer');
                    }
                });

                // 3. 奧術符文題型按鈕正確/錯誤高亮標記
                document.querySelectorAll('.arcane-opt-btn[data-key]').forEach(button => {
                    const key = String(button.dataset.key);
                    if (key === correctKey) {
                        button.classList.add('rune-correct', 'is-correct-answer');
                        button.classList.remove('is-wrong-answer');
                    } else {
                        button.classList.add('is-wrong-answer');
                        button.classList.remove('rune-correct', 'is-correct-answer');
                    }
                });

                // 4. 餐桌食物項目高亮標記 (單元三 第11題)
                document.querySelectorAll('.table-food-item[data-key]').forEach(item => {
                    const key = String(item.dataset.key);
                    if (key === correctKey) {
                        item.classList.add('correct-food-pulse');
                        item.classList.remove('wrong-food-shake');
                    } else {
                        item.classList.add('wrong-food-shake');
                        item.classList.remove('correct-food-pulse');
                    }
                });

                // 5. 學生端作答回饋橫幅
                if (!isTeacher) {
                    const hasAnswered = (studentSelectedOption !== null && studentSelectedOption !== undefined);
                    if (hasAnswered && !alreadyRevealedThisStage) {
                        const optMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
                        const sKey = String(studentSelectedOption).trim().toUpperCase();
                        const cKey = String(correctKey).trim().toUpperCase();
                        const sNorm = optMap[sKey] || sKey;
                        const cNorm = optMap[cKey] || cKey;
                        const isCorrect = (pendingAnswerResult && pendingAnswerResult.stage === currentStage && pendingAnswerResult.isCorrect !== undefined)
                            ? pendingAnswerResult.isCorrect
                            : (sNorm === cNorm || sKey === cKey);
                        const earned = pendingAnswerResult && pendingAnswerResult.stage === currentStage
                            ? pendingAnswerResult.earned
                            : undefined;
                        revealStudentFeedback(isCorrect, earned, stageData);
                        alreadyRevealedThisStage = true;
                    } else if (!hasAnswered && !alreadyRevealedThisStage && questionFeedbackBanner) {
                        questionFeedbackBanner.classList.remove('hidden', 'pending', 'correct');
                        questionFeedbackBanner.className = 'feedback-banner wrong';
                        const explText = stageData.revealExplanation ? `<br><span style="font-size:13.5px;opacity:0.95;line-height:1.5;">💡 ${stageData.revealExplanation}</span>` : '';
                        questionFeedbackBanner.innerHTML = `⚠️ <strong>本題未作答（未得分）</strong><br><span style="font-size:13.5px;opacity:0.95;line-height:1.5;">💡 正確答案為【${getCorrectOptionLabel(stageData)}】</span>${explText}`;
                        alreadyRevealedThisStage = true;
                    }
                } else if (questionFeedbackBanner) {
                    // 教師端公布答案提示橫幅（單一清晰橫幅，避免重複顯示）
                    questionFeedbackBanner.classList.remove('hidden', 'pending', 'wrong');
                    questionFeedbackBanner.className = 'feedback-banner correct';
                    questionFeedbackBanner.innerHTML = `📢 <strong>已公布答案：${getCorrectOptionLabel(stageData)}</strong><br><span style="font-size:13.5px;opacity:0.95;line-height:1.5;">💡 ${stageData.revealExplanation || ''}</span>`;
                }

                // 6. 頂部對話敘事框（維持原題目情境對話，不重複疊加已在橫幅呈現之解析）
                if (dialogContent && !(activeUnit === 'support' && currentStage === 7)) {
                    dialogContent.innerHTML = stageData.speech || '';
                }
                if (activeUnit === 'support' && (currentStage === 2 || currentStage === 8)) {
                    const correctKey = String(stageData.correctKey);
                    const studentAnsweredWrong = !isTeacher && studentSelectedOption &&
                        String(studentSelectedOption) !== correctKey;
                    const classHasWrongAnswer = isTeacher && Object.keys(optionsMap).some(key =>
                        String(key) !== correctKey && Number(optionsMap[key]) > 0
                    );
                    if (studentAnsweredWrong || classHasWrongAnswer) triggerFatalAspiration();
                }
                if (activeUnit === 'must' && currentStage === 7) {
                    const correctKey = String(stageData.correctKey);
                    const studentAnsweredWrong = !isTeacher && studentSelectedOption &&
                        String(studentSelectedOption) !== correctKey;
                    const classHasWrongAnswer = isTeacher && Object.keys(optionsMap).some(key =>
                        String(key) !== correctKey && Number(optionsMap[key]) > 0
                    );
                    if (studentAnsweredWrong || classHasWrongAnswer) triggerKingDismissal();
                }
                if (activeUnit === 'must' && currentStage === 4 && !grandmaThankTriggered && !grandmaThankDismissed) {
                    showGrandmaModalForStage4(currentUnitConf && currentUnitConf.maxStages > 4);
                }

                // 單元二第 7 題 (配方灌食) 公布答案時處理 (播放灌食動畫，若有任一位學生回答錯誤皆呈現嚴重腹瀉惡化畫面)
                if (activeUnit === 'support' && currentStage === 7) {
                    playFormulaFeedingAnimation();
                    const stageBackdropEl = document.getElementById('stageBackdrop');
                    const formulaTray = document.getElementById('formulaBottleChoices');
                    if (formulaTray && formulaTray.classList.contains('hidden')) {
                        activateSupportStage7Feeding(stageData);
                    }
                    hideSupportStage7FeedingTarget();
                    document.querySelectorAll('.formula-drag-ghost').forEach(g => g.remove());
                    const correctKey = String(stageData.correctKey || '1');
                    const isMyCorrect = (studentSelectedOption === correctKey);
                    const hasSelected = !!studentSelectedOption;

                    // 檢查全班是否有任一位學生回答錯誤 (選了非 1 的選項且票數 > 0)
                    const classHasWrongAnswer = Object.keys(optionsMap).some(key =>
                        String(key) !== correctKey && Number(optionsMap[key]) > 0
                    );
                    const studentAnsweredWrong = !isTeacher && hasSelected && !isMyCorrect;
                    const isAnyWrong = classHasWrongAnswer || studentAnsweredWrong;

                    document.querySelectorAll('.formula-bottle-card').forEach(card => {
                        card.classList.add('disabled-lock');
                        card.style.pointerEvents = 'none';
                        card.style.cursor = 'default';
                        const key = card.dataset.key;
                        card.classList.toggle('selected', hasSelected && key === String(studentSelectedOption));
                        if (key === correctKey) {
                            card.classList.add('is-correct-answer');
                            card.classList.remove('is-wrong-answer');
                        } else {
                            card.classList.add('is-wrong-answer');
                            card.classList.remove('is-correct-answer');
                        }
                    });

                    if (stageBackdropEl) {
                        if (isAnyWrong) {
                            stageBackdropEl.classList.add('formula-wrong-outcome');
                            stageBackdropEl.style.setProperty('background-image', "url('assets/rpg_bg_tube_feeding_diarrhea.png')", 'important');
                            stageBackdropEl.style.setProperty('background-size', 'cover', 'important');
                            stageBackdropEl.style.setProperty('background-position', 'center center', 'important');
                        } else {
                            // 全班皆答對：呈現病人康復微笑畫面
                            stageBackdropEl.classList.remove('formula-wrong-outcome');
                            stageBackdropEl.style.setProperty('background-image', "url('assets/rpg_bg_support_stage7_correct.jpg')", 'important');
                            stageBackdropEl.style.setProperty('background-size', 'cover', 'important');
                            stageBackdropEl.style.setProperty('background-position', 'center center', 'important');
                        }
                    }

                    if (dialogBox) dialogBox.classList.remove('hidden');
                    if (isAnyWrong) {
                        if (speakerBadge) speakerBadge.textContent = '【病情惡化警示】';
                        if (dialogContent) dialogContent.innerHTML = '<strong style="color:#f87171; font-size:15.5px;">⚠️ 錯誤配方引發嚴重腹瀉，病人營養流失加劇！</strong><div style="margin-top:6px; color:#fef08a; font-size:14.5px; line-height:1.5;">💡 <strong>臨床解析：</strong>放射性腸炎造成腸道黏膜受損，應選用預先水解之<strong>【元素/預解配方】</strong>（含雙生肽與游離胺基酸），無需酵素分解即可直接吸收！</div>';
                        if (dialogIndicator) dialogIndicator.textContent = '💡 臨床解析：請選用小分子元素配方 ➔';
                    } else {
                        if (speakerBadge) speakerBadge.textContent = '【臨床處置成功】';
                        if (dialogContent) dialogContent.innerHTML = '<strong style="color:#86efac; font-size:15.5px;">✅ 決策正確！元素或預解配方已送達病人。</strong><div style="margin-top:6px; color:#f8fafc; font-size:14.5px; line-height:1.5;">💡 <strong>臨床重點：</strong>雙生肽與游離胺基酸可直接被受損小腸吸收，有效改善放射性腸炎之腹瀉與吸收不良！</div>';
                        if (dialogIndicator) dialogIndicator.textContent = '🎉 決策正確！等待教師推進至下一題 ➔';
                    }
                }
            }
        }
    }
function fetchStatus() {
// 持續輪詢以接收教師指令（即便進入榮譽榜亦不中斷，確保上一關同步）
fetch(`/api/status?unit=${activeUnit}&stage=${currentStage}`)
.then(res => {
consecutivePollErrors = 0;
return res.json();
})
.then(data => {
if (isTeacher && Date.now() - lastStageNavigationAt < 3000 && data.currentStage !== currentStage) return;
if (data && data.sessionId) {
if (currentSessionId && currentSessionId !== data.sessionId) {
forceExitSession("授課教師已重啟課堂，請重新加入！");
return;
}
currentSessionId = data.sessionId;
}
updateStatsUI(data);
})
.catch(() => {
if (!isTeacher && !isFileProtocol && !tView) {
consecutivePollErrors++;
if (consecutivePollErrors >= 3) {
forceExitSession("授課教師已關閉課堂。請於重新開課後再次連線！");
}
}
});
}

function startPolling() {
if (statusPollingInterval) clearInterval(statusPollingInterval);
statusPollingInterval = setInterval(fetchStatus, 1200);
}

window.forceFetchStatus = fetchStatus;

// ==============================================
// 阿嬤台語語音播放控制器
// ==============================================
function playGrandmaVoice(force = false) {
if (npcQuestionVoiceAudio) {
npcQuestionVoiceAudio.pause();
npcQuestionVoiceAudio.currentTime = 0;
npcQuestionVoiceAudio.src = '';
}
try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
if (btnReplayQuestionVoice) {
btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
btnReplayQuestionVoice.classList.remove('playing');
}

if (!grandmaVoiceAudio) return;
if (!force && !grandmaVoiceAudio.paused && !grandmaVoiceAudio.ended && grandmaVoiceAudio.currentTime > 0) {
return;
}
if (rpgBgmAudio) rpgBgmAudio.volume = 0.15;
grandmaVoiceAudio.currentTime = 0;
grandmaVoiceAudio.volume = 1.0;
const playPromise = grandmaVoiceAudio.play();
if (playPromise !== undefined) {
playPromise.then(() => {
if (btnReplayGrandmaVoice) {
btnReplayGrandmaVoice.textContent = '🔊 語音播放中...';
btnReplayGrandmaVoice.classList.add('playing');
btnReplayGrandmaVoice.classList.remove('pulse-callout');
}
}).catch(err => {
if (btnReplayGrandmaVoice) {
btnReplayGrandmaVoice.textContent = '👵 點我聆聽阿嬤道謝 🔊';
btnReplayGrandmaVoice.classList.add('pulse-callout');
btnReplayGrandmaVoice.classList.remove('playing');
}
});
}
}

if (grandmaVoiceAudio) {
grandmaVoiceAudio.addEventListener('ended', () => {
if (btnReplayGrandmaVoice) {
btnReplayGrandmaVoice.textContent = '🔊 重播阿嬤語音';
btnReplayGrandmaVoice.classList.remove('playing');
btnReplayGrandmaVoice.classList.remove('pulse-callout');
}
if (rpgBgmAudio) rpgBgmAudio.volume = 0.5;
});
}

const grandmaSpeechBubbleEl = document.querySelector('.grandma-speech-bubble');
if (grandmaSpeechBubbleEl) {
grandmaSpeechBubbleEl.addEventListener('click', () => {
playGrandmaVoice(true);
});
}

// ==============================================
// 勝利大結算與英雄榜 (阿嬤畫面支援回到上一關)
// ==============================================
function triggerVictory() {
clearInterval(timerInterval);
// 保持 statusPollingInterval 不中斷，使教師點擊上一關時學生端能即時返回

// 進入結算/阿嬤道謝時，徹底解綁與靜音題目朗讀語音，杜絕觸發 onerror 引發 TTS 複念
if (npcQuestionVoiceAudio) {
npcQuestionVoiceAudio.onerror = null;
npcQuestionVoiceAudio.onended = null;
npcQuestionVoiceAudio.pause();
npcQuestionVoiceAudio.currentTime = 0;
}
try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
if (btnReplayQuestionVoice) {
btnReplayQuestionVoice.textContent = '🔊 朗讀題目';
btnReplayQuestionVoice.classList.remove('playing');
}

if (!victorySoundPlayed) {
sfxFanfare();
victorySoundPlayed = true;
}

// 依指示：302床林阿嬤深深一鞠躬【僅針對單元一第 4 題】才會出現！
// 若單元一第 4 題完成時，顯示阿嬤感謝並提供繼續前進或前往英雄榜按鈕
if (activeUnit === 'must' && currentUnitConf.hasGrandmaThank && currentStage === 4) {
showGrandmaModalForStage4(currentUnitConf.maxStages > 4);
} else {
showLeaderboardModal();
}
}

function showGrandmaModalForStage4(hasSubsequentQuestions) {
if (!grandmaThankModal) return;
if (grandmaThankTriggered && !grandmaThankModal.classList.contains('hidden')) return;
grandmaThankTriggered = true;
grandmaThankModal.classList.remove('hidden');
setTimeout(playGrandmaVoice, 250);

if (btnGrandmaBack) {
btnGrandmaBack.classList.remove('hidden');
btnGrandmaBack.textContent = '↩️ 回到第 4 題';
}

if (hasSubsequentQuestions) {
if (btnGrandmaContinue) {
btnGrandmaContinue.textContent = '⏭️ 繼續前進至第 5 題 (霸道總裁研討室) ➔';
btnGrandmaContinue.dataset.nextStage = '5';
}
} else {
if (btnGrandmaContinue) {
btnGrandmaContinue.textContent = '🏆 前往查看全班榮譽英雄榜 ➔';
delete btnGrandmaContinue.dataset.nextStage;
}
}
}

if (btnReplayGrandmaVoice) {
btnReplayGrandmaVoice.addEventListener('click', () => {
sfxClick();
playGrandmaVoice(true);
});
}

if (btnGrandmaBack) {
btnGrandmaBack.addEventListener('click', () => {
sfxClick();
if (grandmaVoiceAudio) {
grandmaVoiceAudio.pause();
grandmaVoiceAudio.currentTime = 0;
}
if (rpgBgmAudio) rpgBgmAudio.volume = 0.5;
grandmaThankModal.classList.add('hidden');
grandmaThankDismissed = true;
});
}

btnGrandmaContinue.addEventListener('click', () => {
if (grandmaVoiceAudio) {
grandmaVoiceAudio.pause();
grandmaVoiceAudio.currentTime = 0;
}
if (rpgBgmAudio) rpgBgmAudio.volume = 0.5;
sfxClick();
grandmaThankModal.classList.add('hidden');

if (btnGrandmaContinue.dataset.nextStage) {
const nextSt = parseInt(btnGrandmaContinue.dataset.nextStage) || 5;
delete btnGrandmaContinue.dataset.nextStage;
if (isTeacher) {
fetch(`/api/admin/set_stage?stage=${nextSt}&unit=${activeUnit}&role=teacher`)
.then(() => loadStage(nextSt))
.catch(() => loadStage(nextSt));
} else {
loadStage(nextSt);
}
} else {
showLeaderboardModal();
}
});

function showLeaderboardModal() {
    leaderboardDismissed = false;
    const maxSt = (currentUnitConf && currentUnitConf.maxStages) ? currentUnitConf.maxStages : 1;
    if (currentStage >= 1 && currentStage <= maxSt) {
        leaderboardReturnStage = currentStage;
    } else if (leaderboardReturnStage < 1 || leaderboardReturnStage > maxSt) {
        leaderboardReturnStage = 1;
    }
    if (npcQuestionVoiceAudio) {
        npcQuestionVoiceAudio.onerror = null;
        npcQuestionVoiceAudio.onended = null;
        npcQuestionVoiceAudio.pause();
        npcQuestionVoiceAudio.currentTime = 0;
    }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){}
    rpgVictoryModal.classList.remove('hidden');
    rpgVictoryModal.style.removeProperty('display');
    startConfetti();

    const certTitleEl = rpgVictoryModal.querySelector('.cert-box-title');
    const vSub = rpgVictoryModal.querySelector('.victory-header .victory-sub');
    const isTrialCity = Boolean(
        isMedicalCityActive ||
        window.isCompletedMedicalCity ||
        window.isCompletedSportsStage ||
        window.isCompletedPortStage ||
        window.isCompletedForestStage ||
        window.lastCompletedStageName === '醫療之城' ||
        window.lastCompletedStageName === '活力運動場' || window.lastCompletedStageName === '活力運動廣場' ||
        window.lastCompletedStageName === '團膳之港' ||
        window.lastCompletedStageName === '蔬食之森' ||
        document.body.classList.contains('medical-city-active') ||
        document.body.classList.contains('sports-stage-active') ||
        document.body.classList.contains('port-stage-active') ||
        document.body.classList.contains('forest-stage-active') ||
        document.body.classList.contains('medical-food-step') ||
        (document.getElementById('medicalCityFoodTableArea') && !document.getElementById('medicalCityFoodTableArea').classList.contains('hidden')) ||
        isNewStudentTrialUnit(activeUnit)
    );

    // 更新榜單標題與成就書
    const vHeader = rpgVictoryModal.querySelector('.victory-header h2');
    if (isTrialCity) {
        const stageName = (typeof activeContinentRegionKey !== 'undefined' && activeContinentRegionKey && CONTINENT_REGIONS[activeContinentRegionKey])
            ? CONTINENT_REGIONS[activeContinentRegionKey].title
            : (window.lastCompletedStageName || '醫療之城');

        if (vHeader) vHeader.textContent = `🏆 獲得【${stageName}】成就書`;
        if (vSub) vSub.textContent = `🎉 恭喜勇者完成【${stageName}】臨床營養照護試煉，獲得專屬成就書！`;
        if (certTitleEl) certTitleEl.textContent = `🎓 獲得「${stageName}」榮譽成就證書`;
        if (btnDownloadCert) btnDownloadCert.textContent = `📷 下載「${stageName}」成就書圖檔 (PNG)`;
        if (btnCloseLeaderboard) {
            btnCloseLeaderboard.textContent = '🗺️ 領取成就，返回健康大陸 ➔';
            btnCloseLeaderboard.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            btnCloseLeaderboard.style.color = '#ffffff';
            btnCloseLeaderboard.style.fontWeight = 'bold';
            btnCloseLeaderboard.style.fontSize = '16px';
            btnCloseLeaderboard.style.padding = '12px 24px';
            btnCloseLeaderboard.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
        }
        if (btnReturnLobby) {
            btnReturnLobby.classList.add('hidden');
            btnReturnLobby.style.setProperty('display', 'none', 'important');
        }
        const pendingNotice = document.getElementById('pendingNextQuestionNotice');
        if (pendingNotice) {
            pendingNotice.classList.add('hidden');
            pendingNotice.style.setProperty('display', 'none', 'important');
        }
    } else {
        if (vHeader) vHeader.textContent = currentUnitConf.leaderboardTitle;
        if (vSub) vSub.textContent = '精準判讀 ‧ 速度制霸 ‧ 守護黃金 48 小時！';
        if (certTitleEl) {
            certTitleEl.textContent = `🎓 領取「${currentUnitConf.certTitle ? currentUnitConf.certTitle.replace(/[【】]/g, '') : '輔英科技大學 保健營養系 榮譽成就證書'}」`;
        }
        if (btnDownloadCert) btnDownloadCert.textContent = '📷 下載個人榮譽證書圖檔 (PNG)';
        if (btnCloseLeaderboard) {
            btnCloseLeaderboard.textContent = '↩️ 關閉榮譽榜，返回目前關卡';
            btnCloseLeaderboard.style.removeProperty('background');
            btnCloseLeaderboard.style.removeProperty('color');
            btnCloseLeaderboard.style.removeProperty('font-weight');
            btnCloseLeaderboard.style.removeProperty('font-size');
            btnCloseLeaderboard.style.removeProperty('padding');
            btnCloseLeaderboard.style.removeProperty('box-shadow');
        }
        const hasMore = (currentStage < maxSt);
        if (btnReturnLobby) {
            if (hasMore) {
                btnReturnLobby.classList.add('hidden');
                btnReturnLobby.style.setProperty('display', 'none', 'important');
            } else {
                btnReturnLobby.classList.remove('hidden');
                btnReturnLobby.style.removeProperty('display');
            }
        }
        const pendingNotice = document.getElementById('pendingNextQuestionNotice');
        if (pendingNotice) {
            if (hasMore) {
                pendingNotice.textContent = `⏳ 本單元尚有題目進行中（目前第 ${currentStage} 關 / 共 ${maxSt} 關），請等候授課教師推進下一題...`;
                pendingNotice.classList.remove('hidden');
            } else {
                pendingNotice.classList.add('hidden');
            }
        }
    }

    fetch(`/api/leaderboard?unit=${activeUnit}`)
        .then(res => res.json())
        .then(data => renderLeaderboard(data))
        .catch(() => {});
}

if (btnCloseLeaderboard) {
    btnCloseLeaderboard.addEventListener('click', () => {
        sfxClick();

        const isTrialCity = Boolean(
            isMedicalCityActive ||
            window.isCompletedMedicalCity ||
            window.isCompletedSportsStage ||
            window.isCompletedPortStage ||
            window.isCompletedForestStage ||
            window.lastCompletedStageName === '醫療之城' ||
            window.lastCompletedStageName === '活力運動場' || window.lastCompletedStageName === '活力運動廣場' ||
            window.lastCompletedStageName === '團膳之港' ||
            window.lastCompletedStageName === '蔬食之森' ||
            document.body.classList.contains('medical-city-active') ||
            document.body.classList.contains('sports-stage-active') ||
            document.body.classList.contains('port-stage-active') ||
            document.body.classList.contains('forest-stage-active') ||
            document.body.classList.contains('medical-food-step') ||
            (document.getElementById('medicalCityFoodTableArea') && !document.getElementById('medicalCityFoodTableArea').classList.contains('hidden')) ||
            isNewStudentTrialUnit(activeUnit)
        );
        if (isTrialCity) {
            leaderboardDismissed = true;
            if (rpgVictoryModal) {
                rpgVictoryModal.classList.add('hidden');
                rpgVictoryModal.style.setProperty('display', 'none', 'important');
            }
            stopConfetti();

            if (typeof returnToHealthContinent === 'function') {
                returnToHealthContinent();
            } else if (typeof window.returnToHealthContinent === 'function') {
                window.returnToHealthContinent();
            }
            return;
        }

        const maxStage = currentUnitConf && currentUnitConf.maxStages ? currentUnitConf.maxStages : 1;
        const requestedReturnStage = parseInt(urlParams.get('returnStage'), 10);

        let targetStage = 1;
        if (currentStage >= 1 && currentStage <= maxStage) {
            targetStage = currentStage;
        } else if (leaderboardReturnStage >= 1 && leaderboardReturnStage <= maxStage) {
            targetStage = leaderboardReturnStage;
        } else if (requestedReturnStage >= 1 && requestedReturnStage <= maxStage) {
            targetStage = requestedReturnStage;
        } else {
            targetStage = 1;
        }

        const returnStage = Math.min(Math.max(targetStage, 1), maxStage);

        currentStage = returnStage;
        leaderboardDismissed = true;
        leaderboardReturnStage = returnStage;
        updateStageIndicator(returnStage);
        rpgVictoryModal.classList.add('hidden');
        stopConfetti();

        if (sceneLogin) sceneLogin.classList.add('hidden');
        if (sceneLobby) sceneLobby.classList.add('hidden');
        if (rpgMainStage) rpgMainStage.classList.remove('hidden');

        loadStage(returnStage);

        if (isTeacher) {
            fetch(`/api/admin/set_stage?stage=${returnStage}&unit=${encodeURIComponent(activeUnit)}&role=teacher`)
                .catch(error => console.error('返回目前關卡失敗', error));
        }
    });
}

function renderLeaderboard(data) {
if (!data) return;

const isTeamMode = (data.gameMode === 'team' || currentGameMode === 'team');
if (isTeamMode && data.teams && data.teams.length > 0) {
teamVictoryBanner.classList.remove('hidden');
let topTeam = data.teams[0];
data.teams.forEach(t => {
if (t.totalScore > topTeam.totalScore) topTeam = t;
});
winningTeamName.textContent = topTeam.teamName;
winningTeamScore.textContent = topTeam.totalScore;
} else {
teamVictoryBanner.classList.add('hidden');
}

top5ListContainer.innerHTML = '';
const top5 = data.top5 || [];
const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

if (top5.length === 0) {
top5ListContainer.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:12px;">尚無競賽紀錄</div>';
return;
}

top5.forEach((item, idx) => {
const row = document.createElement('div');
row.className = `top5-item rank-${idx + 1}`;
const medal = medals[idx] || '🏅';
const teamTag = (isTeamMode && item.teamName) ? `<span class="rank-team">[${item.teamName}]</span>` : '';

row.innerHTML = `
<div class="rank-info">
<span class="rank-badge">${medal}</span>
<span class="rank-avatar-slot" aria-label="學生自選照片"></span>
<span class="rank-name">${item.nickname}</span>
${teamTag}
</div>
<div class="rank-score">${item.score} 分</div>
`;
top5ListContainer.appendChild(row);
const avatarSlot = row.querySelector('.rank-avatar-slot');
if (avatarSlot) {
    const avatarSrc = safeAvatarSrc(item.avatar);
    if (avatarSrc) {
        const avatarImg = document.createElement('img');
        avatarImg.className = 'custom-avatar-img';
        avatarImg.alt = '學生自選照片';
        avatarImg.src = avatarSrc;
        avatarSlot.appendChild(avatarImg);
    } else {
        avatarSlot.textContent = item.avatar || '🍎';
    }
}});
}

function startConfetti() {
const canvas = document.getElementById('victoryConfetti');
if (!canvas) return;
stopConfetti();
const ctx = canvas.getContext('2d');
if (!ctx) return;
canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;
canvas.classList.remove('confetti-fade-out');
canvas.style.opacity = '1';

const pieces = [];
const colors = ['#d4af37', '#10b981', '#38bdf8', '#f59e0b', '#ec4899'];
for (let i = 0; i < 60; i++) {
pieces.push({
x: Math.random() * canvas.width,
y: Math.random() * canvas.height - canvas.height,
size: Math.random() * 8 + 4,
color: colors[Math.floor(Math.random() * colors.length)],
vy: Math.random() * 3 + 2,
vx: Math.random() * 2 - 1
});
}

let f = 0;
function loop() {
if (f > 150 || rpgVictoryModal.classList.contains('hidden')) {
    stopConfetti();
    return;
}
ctx.clearRect(0, 0, canvas.width, canvas.height);
pieces.forEach(p => {
p.y += p.vy;
p.x += p.vx;
ctx.fillStyle = p.color;
ctx.fillRect(p.x, p.y, p.size, p.size);
});
f++;
confettiAnimationFrameId = requestAnimationFrame(loop);
}
loop();
confettiFadeTimer = window.setTimeout(() => {
    canvas.classList.add('confetti-fade-out');
}, 2400);
}

function stopConfetti() {
if (confettiAnimationFrameId !== null) {
cancelAnimationFrame(confettiAnimationFrameId);
confettiAnimationFrameId = null;
}
if (confettiFadeTimer !== null) {
clearTimeout(confettiFadeTimer);
confettiFadeTimer = null;
}
const canvas = document.getElementById('victoryConfetti');
if (canvas) {
canvas.classList.add('confetti-fade-out');
const ctx = canvas.getContext('2d');
if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
}

btnReturnLobby.addEventListener('click', () => {
sfxClick();
rpgVictoryModal.classList.add('hidden');
enterLobby({ students: [] });
});

btnDownloadCert.addEventListener('click', () => {
sfxClick();
const sName = certName.value.trim() || myNickname;
const sId = certId.value.trim() || 'FYU-NUTRITION';

const cvs = document.createElement('canvas');
cvs.width = 1200;
cvs.height = 800;
const c = cvs.getContext('2d');

// 背景
c.fillStyle = '#0f172a';
c.fillRect(0, 0, 1200, 800);

// 外層典雅金邊 (36, 36) 至 (1164, 764)
c.strokeStyle = '#d4af37';
c.lineWidth = 6;
c.strokeRect(36, 36, 1128, 728);

// 內層細金邊 (48, 48) 至 (1152, 752)
c.strokeStyle = 'rgba(212, 175, 55, 0.45)';
c.lineWidth = 2;
c.strokeRect(48, 48, 1104, 704);

// 四角金屬方塊裝飾
const cornerPoints = [[48, 48], [1152, 48], [48, 752], [1152, 752]];
c.fillStyle = '#d4af37';
cornerPoints.forEach(([cx, cy]) => {
c.fillRect(cx - 5, cy - 5, 10, 10);
});

// 智慧文字排版換行函式：依繁體中文與符號寬度精準排版，限制在 maxWidth 內，絕不超出外框
function drawWrappedText(text, centerX, startY, maxWidth, lineHeight) {
if (!text) return startY;
const chars = Array.from(text);
const lines = [];
let currentLine = '';

for (let i = 0; i < chars.length; i++) {
const testLine = currentLine + chars[i];
const metrics = c.measureText(testLine);
if (metrics.width > maxWidth && currentLine.length > 0) {
lines.push(currentLine);
currentLine = chars[i];
} else {
currentLine = testLine;
}
}
if (currentLine.length > 0) {
lines.push(currentLine);
}

for (let i = 0; i < lines.length; i++) {
c.fillText(lines[i], centerX, startY + (i * lineHeight));
}
return startY + ((lines.length - 1) * lineHeight);
}

c.textAlign = 'center';

// 輔英科大校系標題
c.fillStyle = '#fef08a';
c.font = 'bold 36px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
c.fillText('輔英科技大學 保健營養系', 600, 120);

// 判斷是否為健康大陸各大試煉或新生勇者試煉
const isTrialCert = Boolean(
    isMedicalCityActive ||
    window.isCompletedMedicalCity ||
    window.isCompletedSportsStage ||
    window.isCompletedPortStage ||
    window.isCompletedForestStage ||
    window.lastCompletedStageName === '醫療之城' ||
    window.lastCompletedStageName === '活力運動場' || window.lastCompletedStageName === '活力運動廣場' ||
    window.lastCompletedStageName === '團膳之港' ||
    window.lastCompletedStageName === '蔬食之森' ||
    document.body.classList.contains('medical-city-active') ||
    document.body.classList.contains('sports-stage-active') ||
    document.body.classList.contains('port-stage-active') ||
    document.body.classList.contains('forest-stage-active') ||
    document.body.classList.contains('medical-food-step') ||
    (document.getElementById('medicalCityFoodTableArea') && !document.getElementById('medicalCityFoodTableArea').classList.contains('hidden')) ||
    isNewStudentTrialUnit(activeUnit)
);
const continentStageTitle = window.lastCompletedStageName || '醫療之城';
const certDisplayTitle = isTrialCert ? `【${continentStageTitle} ‧ 榮譽成就證書】` : (currentUnitConf.certTitle || '【臨床學能檢定合格證書】');
const certDisplayDesc = isTrialCert ? `通過營養勇者試煉，精準完成【${continentStageTitle}】各項專業營養技能挑戰，成功榮獲專屬榮譽成就與營養專科資格！` : (currentUnitConf.certDesc || '');
const certDisplayBadge = isTrialCert ? `榮獲「${continentStageTitle} ‧ 專科成就勳章」🏅` : (currentUnitConf.certBadgeText || '榮獲「臨床營養達人」榮譽勳章 🏅');

// 證書標題 (若文字較長以 920px 自動換行)
c.fillStyle = '#38bdf8';
c.font = 'bold 30px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
const titleEndY = drawWrappedText(certDisplayTitle, 600, 185, 920, 38);

// 學員姓名與學號
c.fillStyle = '#ffffff';
c.font = 'bold 26px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
c.fillText(`茲證明學員： ${sName}  (${sId})`, 600, Math.max(275, titleEndY + 40));

// 證書說明文案 (精準限制寬度 920px，徹底杜絕超出金框)
c.fillStyle = '#e2e8f0';
c.font = '22px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
const descStartY = Math.max(330, titleEndY + 90);
const descEndY = drawWrappedText(certDisplayDesc, 600, descStartY, 920, 36);

// 個人累計競賽積分
c.fillStyle = '#fde047';
c.font = 'bold 25px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
c.fillText(`個人累計競賽積分：${myScore} 分`, 600, Math.max(450, descEndY + 45));

// 榮譽勳章名銜
c.fillStyle = '#10b981';
c.font = 'bold 29px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
drawWrappedText(certDisplayBadge, 600, Math.max(535, descEndY + 110), 920, 36);

// 頒發日期與授課教師認證
c.fillStyle = '#94a3b8';
c.font = '19px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
c.fillText(`授課教師認證 ‧ 頒發日期：${new Date().toLocaleDateString('zh-TW')}`, 600, 665);

const a = document.createElement('a');
a.download = isTrialCert ? `醫療之城_榮譽成就證書_${sName}.png` : `臨床營養成就證書_${sName}.png`;
a.href = cvs.toDataURL('image/png');
a.click();
});

// ==============================================
// 教師主控遙控器 (支援單元題目推進)
// ==============================================
if (teacherToggleBtn && teacherControlBar) {
teacherToggleBtn.addEventListener('click', () => {
sfxClick();
teacherControlBar.classList.toggle('active');
});
}

if (btnCloseTeacherBar && teacherControlBar) {
btnCloseTeacherBar.addEventListener('click', () => {
sfxClick();
teacherControlBar.classList.remove('active');
});
}

if (teacherControlBar && (window.location.search.indexOf('teacher=1') >= 0 || window.location.search.indexOf('role=teacher') >= 0 || isTeacher)) {
teacherControlBar.classList.remove('hidden');
teacherControlBar.classList.add('active');
}

if (tcBtnStartGame) {
tcBtnStartGame.addEventListener('click', () => {
sfxClick();
const reqStage = parseInt(urlParams.get('stage')) || currentStage || 1;
fetch(`/api/admin/start_game?unit=${encodeURIComponent(activeUnit)}&stage=${reqStage}`)
.then(res => res.json())
.then(data => {
isGameStarted = true;
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
const targetStage = Number(data && data.currentStage) || reqStage;
if (activeUnit === 'must' && targetStage === 1 && currentUnitConf.prologue && currentUnitConf.prologue.length > 0) {
    startPrologueDialogue();
} else {
    loadStage(targetStage);
}
});
});
}

if (tcBtnNext) {
tcBtnNext.addEventListener('click', () => {
sfxClick();
const nextSt = currentStage + 1;
loadStage(nextSt);
});
}

if (tcBtnPrev) {
tcBtnPrev.addEventListener('click', () => {
sfxClick();
const prevSt = Math.max(1, currentStage - 1);
loadStage(prevSt);
});
}

if (tcBtnReveal) {
tcBtnReveal.addEventListener('click', () => {
sfxClick();
teacherStageRevealed = true;
isStageLocked = true;
runUnit3RevealVideoThen(() => {
fetch(`/api/admin/reveal?unit=${encodeURIComponent(activeUnit)}&stage=${currentStage}&role=teacher`)
.then(res => res.json())
.then(data => {
data.revealed = true;
updateStatsUI(data);
})
.catch(() => {
const stData = currentUnitConf && currentUnitConf.stages ? currentUnitConf.stages[currentStage] : null;
updateStatsUI({
revealed: true,
locked: true,
stage: currentStage,
currentStage: currentStage,
totalVotes: 1,
mostVoted: stData ? stData.correctKey : '1'
});
});
});
});
}

if (tcBtnShowLeaderboard) {
tcBtnShowLeaderboard.addEventListener('click', () => {
sfxClick();
const maxSt = currentUnitConf.maxStages;
fetch(`/api/admin/set_stage?stage=${maxSt + 1}&unit=${activeUnit}&role=teacher`)
.then(res => res.json())
.then(data => updateStatsUI(data));
});
}

if (tcBtnReset) {
tcBtnReset.addEventListener('click', () => {
sfxClick();
if (confirm('確定要重設比賽並讓所有學員返回等候大廳嗎？')) {
fetch(`/api/admin/reset_votes?unit=${activeUnit}`)
.then(res => res.json())
.then(data => {
isGameStarted = false;
isInPrologue = false;
victorySoundPlayed = false;
currentStage = 1;
studentSelectedOption = null;
closeAllModals();
if (statusPollingInterval) clearInterval(statusPollingInterval);
rpgMainStage.classList.add('hidden');
rpgVictoryModal.classList.add('hidden');
grandmaThankModal.classList.add('hidden');
enterLobby(data);
});
}
});
}

// ==============================================
// 臨床計算機輔助工具
// ==============================================
const calcModal = document.getElementById('calcModal');
const btnOpenCalc = document.getElementById('btnOpenCalc');
const btnCloseCalc = document.getElementById('btnCloseCalc');
if (btnOpenCalc && calcModal) {
    btnOpenCalc.addEventListener('click', () => {
        sfxClick();
        calcModal.classList.remove('hidden');
    });
}
if (btnCloseCalc && calcModal) {
    btnCloseCalc.addEventListener('click', () => {
        sfxClick();
        calcModal.classList.add('hidden');
    });
}

const btnCloseKingDismiss = document.getElementById('btnCloseKingDismissModal');
if (btnCloseKingDismiss) {
    btnCloseKingDismiss.addEventListener('click', () => {
        sfxClick();
        window.closeKingDismissModal();
    });
}
const kingDismissModalEl = document.getElementById('kingDismissModal');
if (kingDismissModalEl) {
    kingDismissModalEl.addEventListener('click', (e) => {
        if (e.target === kingDismissModalEl) {
            window.closeKingDismissModal();
        }
    });
}

document.getElementById('btnDoCalcBmi').addEventListener('click', () => {
sfxClick();
const w = parseFloat(document.getElementById('calcW').value);
const h = parseFloat(document.getElementById('calcH').value) / 100;
if (w > 0 && h > 0) {
document.getElementById('resBmi').textContent = (w / (h * h)).toFixed(2);
}
});

document.getElementById('btnDoCalcLoss').addEventListener('click', () => {
sfxClick();
const u = parseFloat(document.getElementById('calcUsual').value);
const c = parseFloat(document.getElementById('calcCurr').value);
if (u > 0 && c > 0) {
document.getElementById('resLoss').textContent = (((u - c) / u) * 100).toFixed(1) + '%';
}
});

function startTimer() {
if (timerInterval) clearInterval(timerInterval);
timerInterval = setInterval(() => {
if (totalSeconds > 0) {
totalSeconds--;
const m = Math.floor(totalSeconds / 60);
const s = totalSeconds % 60;
timerVal.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
} else {
clearInterval(timerInterval);
}
}, 1000);
}

// 測試輔助與快速跳轉
if (tView === 'teacher_lobby' && isTeacher) {
    sceneLogin.classList.add('hidden');
    sceneLobby.classList.remove('hidden');
    rpgMainStage.classList.add('hidden');
    fetch(`/api/lobby_status?unit=${encodeURIComponent(activeUnit)}`)
        .then(res => {
            if (!res.ok) throw new Error(`讀取等候大廳失敗：HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            isGameStarted = false;
            enterLobby(data);
        })
        .catch(error => {
            console.error('無法載入教師等候大廳', error);
            enterLobby({ students: [] });
            const waitingText = document.getElementById('lobbyWaitingText');
            if (waitingText) waitingText.textContent = '等候大廳狀態載入失敗，請確認平台連線後重試。';
        });
} else if (tView === 'lobby') {
myNickname = '實習小達人';
enterLobby({
gameMode: 'individual',
studentCount: 4,
students: [
{ avatar: '🍎', nickname: '王小明 (實習生)' },
{ avatar: '🥦', nickname: '李美美 (護理生)' },
{ avatar: '🥕', nickname: '張健管 (健管生)' },
{ avatar: '🫐', nickname: '陳臨床 (醫技生)' }
]
});
} else if (tView === 'ward' || urlParams.get('skip') === '1' || tView === '1' || tView === 'dragon' || tView === 'stage' || tView === 'nurse' || tView === 'exam') {
myNickname = '實習小達人';
isGameStarted = true;
sceneLogin.classList.add('hidden');
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
const reqStage = parseInt(urlParams.get('stage')) || 1;
fetch(`/api/admin/set_stage?stage=${reqStage}&unit=${activeUnit}&role=teacher`).catch(() => {});
if (activeUnit === 'must' && reqStage === 1 && urlParams.get('skip') !== '1' && currentUnitConf.prologue && currentUnitConf.prologue.length > 0) {
    startPrologueDialogue();
} else {
    loadStage(reqStage);
}
startPolling();

const action = urlParams.get('action');
if (action === 'lift13') {
setTimeout(() => {
for(let i = 0; i < 13; i++) {
const btn = document.getElementById('btnA1cLift');
if (btn) btn.dispatchEvent(new Event('pointerdown'));
}
}, 300);
} else if (action === 'slain') {
setTimeout(() => {
for(let i = 0; i < 13; i++) {
const btn = document.getElementById('btnA1cLift');
if (btn) btn.dispatchEvent(new Event('pointerdown'));
}
setTimeout(() => {
selectOption('1');
}, 400);
}, 300);
} else if (action === 'gameover') {
setTimeout(() => {
selectOption('2');
}, 400);
}
} else if (tView === 'grandma') {
myNickname = '實習小達人';
myScore = 1000;
isGameStarted = true;
sceneLogin.classList.add('hidden');
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
grandmaThankModal.classList.remove('hidden');
setTimeout(playGrandmaVoice, 300);
} else if (tView === 'victory') {
myNickname = '實習小達人';
myScore = 1000;
isGameStarted = true;
sceneLogin.classList.add('hidden');
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
const reqStage = parseInt(urlParams.get('stage')) || currentStage;
currentStage = reqStage;
const returnStage = parseInt(urlParams.get('returnStage'), 10);
if (returnStage >= 1 && returnStage <= currentUnitConf.maxStages) {
leaderboardReturnStage = returnStage;
}
showLeaderboardModal();
} else if (tView === 'rocket') {
myNickname = '實習小達人';
isGameStarted = true;
sceneLogin.classList.add('hidden');
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
loadStage(1);
triggerRocketLaugh();
} else if (tView === 'prologue') {
myNickname = urlParams.get('nick') || '王小明';
const gParam = urlParams.get('gender');
if (gParam) {
selectedGender = gParam;
localStorage.setItem('FYU_STUDENT_GENDER', selectedGender);
}
isGameStarted = true;
sceneLogin.classList.add('hidden');
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
startPrologueDialogue();
const pIdx = parseInt(urlParams.get('pindex')) || 0;
if (pIdx > 0) {
prologueIndex = pIdx;
showPrologueStep(pIdx);
}
} else if (isTeacher) {
    const openTeacherStage = stage => {
        isGameStarted = true;
        currentStage = stage;
        sceneLogin.classList.add('hidden');
        sceneLobby.classList.add('hidden');
        rpgMainStage.classList.remove('hidden');
        if (teacherControlBar) {
            teacherControlBar.classList.remove('hidden');
            teacherControlBar.classList.add('active');
        }
        if (activeUnit === 'must' && stage === 1 && currentUnitConf.prologue && currentUnitConf.prologue.length > 0) {
            startPrologueDialogue();
        } else if (!unitDefinitions[activeUnit] && !unitStageCounts[activeUnit]) {
            loadStage(stage);
        } else if (stage > currentUnitConf.maxStages) {
            showLeaderboardModal();
        } else {
            loadStage(stage);
        }
        startPolling();
    };

    if (isFileProtocol) {
        openTeacherStage(parseInt(urlParams.get('stage')) || 1);
    } else {
        fetch(`/api/lobby_status?unit=${encodeURIComponent(activeUnit)}`)
            .then(res => {
                if (!res.ok) throw new Error(`讀取教師課堂狀態失敗：HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (data.sessionId) currentSessionId = data.sessionId;
                if (data.isGameStarted === false && !urlParams.get('stage')) {
                    isGameStarted = false;
                    enterLobby(data);
                    return;
                }
                const stage = parseInt(urlParams.get('stage')) || Number(data.currentStage) || 1;
                if (data.isGameStarted === false && urlParams.get('stage')) {
                    fetch(`/api/admin/start_game?unit=${encodeURIComponent(activeUnit)}&stage=${stage}`).catch(() => {});
                }
                openTeacherStage(stage);
            })
            .catch(error => {
                console.error('無法確認教師課堂狀態', error);
                enterLobby({ students: [] });
                const waitingText = document.getElementById('lobbyWaitingText');
                if (waitingText) waitingText.textContent = '課堂狀態讀取失敗，請確認平台連線後重新整理。';
            });
    }
}

function getSliderBattleConfig(stageData) {
    const data = stageData || (currentUnitConf && currentUnitConf.stages
        ? currentUnitConf.stages[currentStage]
        : null);
    const configs = {
        a1c: {
            type: 'a1c', min: 0, max: 10, step: 0.1, correctVal: 6.5, unit: '%',
            title: '糖化血色素（HbA1c）拉拉條判定出擊',
            badge: '⚔️ 決戰魔龍 ‧ 糖化血色素',
            target: '🎯 判定切點出擊',
            monster: 'assets/dragon_boss.png',
            monsterAlt: '黑炎魔龍',
            ticks: ['0%', '2%', '4%', '6%', '8%', '10%']
        },
        fpg: {
            type: 'fpg', min: 0, max: 300, step: 1, correctVal: 126, unit: 'mg/dL',
            title: '空腹血漿血糖（FPG）拉條判定出擊',
            badge: '❄️ 晨曦冰壁 ‧ 空腹血糖',
            target: '🎯 擊碎冰壁',
            monster: 'assets/ice_golem.png',
            monsterAlt: '冰晶巨神兵',
            ticks: ['0', '60', '120', '180', '240', '300']
        },
        ogtt: {
            type: 'ogtt', min: 0, max: 300, step: 1, correctVal: 200, unit: 'mg/dL',
            title: '75g OGTT 2 小時血糖拉條判定出擊',
            badge: '🦂 深淵糖沼 ‧ 口服葡萄糖耐受試驗',
            target: '🎯 蓄力出擊',
            monster: 'assets/monster_ogtt_beast.png',
            monsterAlt: '晶化毒蠍魔君',
            ticks: ['0', '60', '120', '180', '240', '300']
        },
        random_glucose: {
            type: 'random_glucose', min: 0, max: 300, step: 1, correctVal: 200, unit: 'mg/dL',
            title: '隨機血漿血糖拉條判定出擊',
            badge: '⚡ 雷霆荒野 ‧ 隨機血糖',
            target: '🎯 蓄力出擊',
            monster: 'assets/monster_rpg_wolf.png',
            monsterAlt: '狂暴雷狼魔',
            ticks: ['0', '60', '120', '180', '240', '300']
        }
    };
    if (!data || !configs[data.sliderType]) return null;
    return data.correctVal === undefined
        ? configs[data.sliderType]
        : Object.assign({}, configs[data.sliderType], { correctVal: Number(data.correctVal) });
}

function updateSliderBattleDisplay() {
    const slider = document.getElementById('a1cRangeSlider');
    const valEl = document.getElementById('a1cCurrentVal');
    const unitEl = document.getElementById('a1cUnitVal');
    const msgEl = document.getElementById('a1cStatusMsg');
    const config = getSliderBattleConfig();
    if (!slider || !config) return;

    const value = config.type === 'a1c'
        ? parseFloat(slider.value).toFixed(1)
        : Math.round(Number(slider.value)).toString();
    if (valEl) valEl.textContent = value;
    if (unitEl) unitEl.textContent = config.unit;
    if (msgEl) {
        const instruction = config.type === 'a1c'
            ? `拖曳調整後點選「蓄力出擊」砍向${config.monsterAlt}！`
            : `調校能量儀至正確切點後點選「${config.target.replace('🎯 ', '')}」！`;
        msgEl.innerHTML = `⚔️ 當前數值：<strong>${value} ${config.unit}</strong>！${instruction}`;
    }
}

function configureSliderBattleWidget(stageData) {
    const slider = document.getElementById('a1cRangeSlider');
    const config = getSliderBattleConfig(stageData);
    if (!slider || !config) return;

    slider.min = String(config.min);
    slider.max = String(config.max);
    slider.step = String(config.step);
    slider.value = config.type === 'a1c' ? '0.0' : '0';
    slider.disabled = false;

    const title = document.getElementById('sliderWidgetTitle');
    const badge = document.getElementById('sliderBadgePill');
    const target = document.getElementById('sliderTargetTag');
    const label = document.getElementById('sliderValueLabel');
    const unit = document.getElementById('a1cUnitVal');
    const ticks = document.getElementById('sliderTicksContainer');
    const monster = document.getElementById('dragonBossSprite');
    if (title) title.textContent = config.title;
    if (badge) badge.textContent = config.badge;
    if (target) target.textContent = config.target;
    if (label) label.textContent = config.type === 'a1c' ? '設定診斷數值：' : '設定診斷切點：';
    if (unit) unit.textContent = config.unit;
    if (ticks) {
        Array.from(ticks.children).forEach((tick, index) => {
            if (config.ticks[index] !== undefined) tick.textContent = config.ticks[index];
        });
    }
    if (monster) {
        monster.src = config.monster;
        monster.alt = config.monsterAlt;
        monster.className = 'dragon-sprite';
    }
    const monsterTag = document.querySelector('.dragon-tag');
    if (monsterTag) monsterTag.textContent = `🔥 ${config.monsterAlt}`;
    updateSliderBattleDisplay();
}

// ==============================================
// 糖化血色素 (HbA1c) 拉拉條數值互動器 (蓄力攻擊魔龍)
// ==============================================
// ==============================================
// 數值拉拉條出擊互動器 (Stage 2 魔龍戰 & Stage 3 冰晶巨神兵)
// ==============================================
function executeDragonBattleAttack(val) {
const slider = document.getElementById('a1cRangeSlider');
const battleConfig = getSliderBattleConfig();
if (!battleConfig) return;
const isStage2 = battleConfig.type === 'a1c';
const isStage3 = battleConfig.type === 'fpg';
const isStage4 = battleConfig.type === 'ogtt';
const isStage5 = battleConfig.type === 'random_glucose';

const valNum = isStage2 ? parseFloat(Number(val).toFixed(1)) : Math.round(Number(val));
const correctVal = Number(battleConfig.correctVal);
const isCorrect = isStage2
    ? Math.abs(valNum - correctVal) < 0.05
    : valNum === correctVal;

const dragonSprite = document.getElementById('dragonBossSprite');
const dragonHpFill = document.getElementById('dragonHpFill');
const dragonHpVal = document.getElementById('dragonHpVal');
const flame = document.getElementById('dragonFlameBurst');
const hitFlash = document.getElementById('dragonHitFlash');
const dmgText = document.getElementById('dragonDamageText');
const beam = document.getElementById('playerAttackBeam');
const gameOverModal = document.getElementById('dragonGameOverModal');
const gameOverReason = document.getElementById('gameOverReason');
const btnRevive = document.getElementById('btnDragonRevive');
const warriorSprite = document.getElementById('warriorHeroSprite');
const slashWave = document.getElementById('warriorSlashWave');
const flameWave = document.getElementById('dragonFlameWave');

// 勇者向前突進斬擊發動！
if (warriorSprite) {
warriorSprite.classList.remove('slashing', 'warrior-dead');
void warriorSprite.offsetWidth;
warriorSprite.classList.add('slashing');
setTimeout(() => { if (warriorSprite) warriorSprite.classList.remove('slashing'); }, 600);
}
if (slashWave) {
if (isStage2) slashWave.textContent = `⚡ ${valNum}% 聖光斬擊 ➔`;
else if (isStage3) slashWave.textContent = `⚡ ${valNum} mg/dL 晨曦聖光 ➔`;
else if (isStage4) slashWave.textContent = `⚡ ${valNum} mg/dL 糖耐破滅 ➔`;
else if (isStage5) slashWave.textContent = `⚡ ${valNum} mg/dL 疾風迅雷 ➔`;
slashWave.classList.remove('hidden');
setTimeout(() => { if (slashWave) slashWave.classList.add('hidden'); }, 600);
}
if (beam) {
beam.classList.remove('hidden');
setTimeout(() => { if (beam) beam.classList.add('hidden'); }, 350);
}
sfxAttackHit();

if (isCorrect) {
// 【正確答案：魔龍死亡 / 冰晶結界碎裂 / 毒蠍消滅 / 雷狼擊潰】
setTimeout(() => {
if (hitFlash) {
hitFlash.classList.remove('hidden');
setTimeout(() => { if (hitFlash) hitFlash.classList.add('hidden'); }, 300);
}
if (dmgText) {
if (isStage2) dmgText.textContent = `💥 CRITICAL HIT! 6.5% 致命一擊！`;
else if (isStage3) dmgText.textContent = `💥 結界碎裂！126 mg/dL 成功擊破！`;
else if (isStage4) dmgText.textContent = `💥 毒蠍破防！200 mg/dL 致命一擊！`;
else if (isStage5) dmgText.textContent = `💥 雷擊狂破！200 mg/dL 致命一擊！`;
dmgText.classList.remove('hidden');
setTimeout(() => { if (dmgText) dmgText.classList.add('hidden'); }, 800);
}
if (dragonSprite) dragonSprite.classList.add('hit-shake');
if (dragonHpFill) dragonHpFill.style.width = '0%';
if (dragonHpVal) dragonHpVal.textContent = 'HP 0%';
setTimeout(() => {
if (dragonSprite) {
if (isStage3) dragonSprite.className = 'dragon-sprite ice-shatter';
else dragonSprite.className = 'dragon-sprite dragon-death';
}
}, 200);
if (isStage3) {
try {
const shatter = new Audio('assets/ice_shatter.wav');
shatter.volume = 0.8;
shatter.play().catch(() => {});
} catch(e){}
}
sfxCorrect();
}, 250);

// 答對鎖定控制項，防止重複操作
if (slider) slider.disabled = true;
const btnAttack = document.getElementById('btnA1cAttack');
if (btnAttack) btnAttack.disabled = true;

// 自動向後端記錄正確答案 (Stage 2 -> option '1', Stage 3 -> option '3', Stage 4 -> option '4', Stage 5 -> option '4')
const correctKey = isStage2 ? '1' : (isStage3 ? '3' : '4');
studentSelectedOption = correctKey;
if (!isTeacher && myNickname) {
fetch(`/api/submit_answer?unit=${activeUnit}&stage=${currentStage}&key=${encodeURIComponent(correctKey)}&nickname=${encodeURIComponent(myNickname)}`).catch(() => {});
}
fetch(`/api/vote?unit=${activeUnit}&stage=${currentStage}&option=${encodeURIComponent(correctKey)}&clientId=${encodeURIComponent(clientId)}`)
.then(res => res.json())
.then(data => updateStatsUI(data))
.catch(() => {});

questionFeedbackBanner.className = 'feedback-banner success';
questionFeedbackBanner.classList.remove('hidden');
if (isStage2) {
questionFeedbackBanner.innerHTML = `🎉 <strong>擊潰黑炎魔龍！</strong>糖化血色素 6.5% 精準命中，黑炎魔龍已消滅！<br><span style="font-size:13px;opacity:0.9;">⏳ 答題成功！成績已記錄，需等待授課教師切換至下一關開始！</span>`;
} else if (isStage3) {
questionFeedbackBanner.innerHTML = `🎉 <strong>擊碎血糖冰壁結界！</strong>空腹血糖 126 mg/dL 精準命中，守護晨曦之門的冰晶巨神兵已瓦解！<br><span style="font-size:13px;opacity:0.9;">⏳ 答題成功！成績已記錄，需等待授課教師切換至下一關開始！</span>`;
} else if (isStage4) {
questionFeedbackBanner.innerHTML = `🎉 <strong>討伐晶化毒蠍魔君！</strong>75g OGTT 2小時 200 mg/dL 精準命中，深淵噬糖巨獸已消滅！<br><span style="font-size:13px;opacity:0.9;">⏳ 答題成功！成績已記錄，需等待授課教師切換至下一關開始！</span>`;
} else if (isStage5) {
questionFeedbackBanner.innerHTML = `🎉 <strong>擊潰狂暴雷狼魔！</strong>隨機血糖 200 mg/dL 精準命中，高血糖突襲者已被擊退！<br><span style="font-size:13px;opacity:0.9;">⏳ 答題成功！成績已記錄，需等待授課教師切換至下一關開始！</span>`;
}
} else {
// 【錯誤答案：怪物反擊殺死戰士】
if (slider) slider.disabled = true;
const btnAttack = document.getElementById('btnA1cAttack');
if (btnAttack) btnAttack.disabled = true;

setTimeout(() => {
if (dmgText) {
if (isStage2) dmgText.textContent = `🛡️ 護盾抵擋！${valNum}% 未達診斷切點！`;
else if (isStage3) dmgText.textContent = `🛡️ 冰壁彈開！${valNum} mg/dL 未達切點！`;
else if (isStage4) dmgText.textContent = `🛡️ 蠍甲抵擋！${valNum} mg/dL 未達切點！`;
else if (isStage5) dmgText.textContent = `🛡️ 狂暴撕裂！${valNum} mg/dL 未達切點！`;
dmgText.classList.remove('hidden');
setTimeout(() => { if (dmgText) dmgText.classList.add('hidden'); }, 700);
}
if (isStage2) {
sfxDragonRoar();
try {
const roar = new Audio('assets/dragon_roar.wav');
roar.volume = 0.85;
roar.play().catch(() => {});
} catch(e){}
} else if (isStage3) {
try {
const frost = new Audio('assets/ice_shatter.wav');
frost.volume = 0.5;
frost.play().catch(() => {});
} catch(e){}
}
sfxWrong();
if (dragonSprite) {
dragonSprite.classList.add('fire-attack');
}
if (flameWave) {
if (isStage2) flameWave.textContent = '🔥 魔龍烈火吐息 ➔';
else if (isStage3) flameWave.textContent = '❄️ 極寒冰暴結界 ➔';
else if (isStage4) flameWave.textContent = '🦂 劇毒深淵毒刺 ➔';
else if (isStage5) flameWave.textContent = '⚡ 狂暴雷煞爪擊 ➔';
flameWave.classList.remove('hidden');
setTimeout(() => { if (flameWave) flameWave.classList.add('hidden'); }, 750);
}
if (flame && isStage2) {
flame.classList.remove('hidden');
}
}, 250);

setTimeout(() => {
if (flame) flame.classList.add('hidden');
if (warriorSprite) {
warriorSprite.classList.add('warrior-dead');
}
document.body.classList.add('gameover-grayscale-active');
const gameOverSubtitle = document.getElementById('gameOverSubtitle');
const gameOverBossImg = document.getElementById('gameOverBossImg');
const gameOverTip = document.getElementById('gameOverTip');
if (gameOverReason) {
if (isStage2) {
if (gameOverSubtitle) gameOverSubtitle.textContent = '遭到黑炎魔龍烈火吞噬！';
if (gameOverBossImg) gameOverBossImg.src = 'assets/dragon_boss.png';
if (gameOverTip) {
if (!isTeacher) {
gameOverTip.innerHTML = '⚠️ <strong>本關為正式計分題目</strong>，答題次數僅限 1 次，不提供復活重測。已為您記錄作答成績，請等待授課教師切換至下一關開始！';
} else {
gameOverTip.textContent = '💡 提示：請重新確認糖化血色素診斷數值（HbA1c ≧ 6.5%），拖曳拉拉條並點選蓄力出擊！';
}
}
gameOverReason.innerHTML = `⚠️ 討伐失敗！您設定的數值為 <strong>${valNum}%</strong>，並非糖尿病標準診斷切點 (切點為 <strong>HbA1c ≧ 6.5%</strong>)！<br>黑炎魔龍狂暴噴火將戰士殺死！`;
} else if (isStage3) {
if (gameOverSubtitle) gameOverSubtitle.textContent = '遭到冰晶巨神兵極寒風暴凍結！';
if (gameOverBossImg) gameOverBossImg.src = 'assets/ice_golem.png';
if (gameOverTip) {
if (!isTeacher) {
gameOverTip.innerHTML = '⚠️ <strong>本關為正式計分題目</strong>，答題次數僅限 1 次，不提供復活重測。已為您記錄作答成績，請等待授課教師切換至下一關開始！';
} else {
gameOverTip.textContent = '💡 提示：請重新確認空腹血漿葡萄糖診斷切點（FPG ≧ 126 mg/dL），調校拉拉條並點選擊碎冰壁！';
}
}
gameOverReason.innerHTML = `⚠️ 擊碎失敗！您設定的數值為 <strong>${valNum} mg/dL</strong>，並非糖尿病標準診斷切點 (切點為 <strong>FPG ≧ 126 mg/dL</strong>)！<br>冰晶巨神兵引發極寒暴風雪將戰士凍結！`;
} else if (isStage4) {
if (gameOverSubtitle) gameOverSubtitle.textContent = '遭到晶化毒蠍魔君深淵毒刺貫穿！';
if (gameOverBossImg) gameOverBossImg.src = 'assets/monster_ogtt_beast.png';
if (gameOverTip) {
if (!isTeacher) {
gameOverTip.innerHTML = '⚠️ <strong>本關為正式計分題目</strong>，答題次數僅限 1 次，不提供復活重測。已為您記錄作答成績，請等待授課教師切換至下一關開始！';
} else {
gameOverTip.textContent = '💡 提示：請重新確認口服葡萄糖耐受試驗切點（75g OGTT 2小時 ≧ 200 mg/dL），拖曳拉拉條並點選蓄力出擊！';
}
}
gameOverReason.innerHTML = `⚠️ 討伐失敗！您設定的數值為 <strong>${valNum} mg/dL</strong>，並非糖尿病標準診斷切點 (切點為 <strong>75g OGTT 2小時 ≧ 200 mg/dL</strong>)！<br>晶化毒蠍魔君狂暴揮動毒刺將戰士貫穿！`;
} else if (isStage5) {
if (gameOverSubtitle) gameOverSubtitle.textContent = '遭到狂暴雷狼魔撕裂防線！';
if (gameOverBossImg) gameOverBossImg.src = 'assets/monster_rpg_wolf.png';
if (gameOverTip) {
if (!isTeacher) {
gameOverTip.innerHTML = '⚠️ <strong>本關為正式計分題目</strong>，答題次數僅限 1 次，不提供復活重測。已為您記錄作答成績，請等待授課教師切換至下一關開始！';
} else {
gameOverTip.textContent = '💡 提示：請重新確認隨機血漿血糖診斷切點（隨機血糖 ≧ 200 mg/dL 伴隨典型高血糖症狀），拖曳拉拉條並點選蓄力出擊！';
}
}
gameOverReason.innerHTML = `⚠️ 討伐失敗！您設定的數值為 <strong>${valNum} mg/dL</strong>，並非糖尿病標準診斷切點 (切點為 <strong>隨機血漿血糖 ≧ 200 mg/dL 伴隨高血糖典型症狀</strong>)！<br>狂暴雷狼魔狂暴撕裂防線將戰士擊潰！`;
}
}
if (gameOverModal) {
gameOverModal.classList.remove('hidden');
}
const btnRevive = document.getElementById('btnDragonRevive');
const waitingNotice = document.getElementById('gameOverWaitingNotice');
if (!isTeacher) {
if (btnRevive) {
btnRevive.classList.add('hidden');
btnRevive.style.display = 'none';
}
if (waitingNotice) {
waitingNotice.classList.remove('hidden');
waitingNotice.style.display = 'block';
}
} else {
if (btnRevive) {
btnRevive.classList.remove('hidden');
btnRevive.style.display = 'block';
}
if (waitingNotice) {
waitingNotice.classList.add('hidden');
waitingNotice.style.display = 'none';
}
}
}, 900);

// 記錄答錯至後端 (Stage 2 -> option '4', 其餘 stage -> option '1')
const wrongKey = isStage2 ? '4' : '1';
studentSelectedOption = wrongKey;
if (!isTeacher && myNickname) {
fetch(`/api/submit_answer?unit=${activeUnit}&stage=${currentStage}&key=${encodeURIComponent(wrongKey)}&nickname=${encodeURIComponent(myNickname)}`).catch(() => {});
}
fetch(`/api/vote?unit=${activeUnit}&stage=${currentStage}&option=${encodeURIComponent(wrongKey)}&clientId=${encodeURIComponent(clientId)}`)
.then(res => res.json())
.then(data => updateStatsUI(data))
.catch(() => {});

if (btnRevive) {
btnRevive.onclick = () => {
sfxClick();
resetDragonBossState();
questionFeedbackBanner.classList.add('hidden');
studentSelectedOption = null;
const slider = document.getElementById('a1cRangeSlider');
const valEl = document.getElementById('a1cCurrentVal');
if (slider) {
slider.value = isStage2 ? '0.0' : '0';
}
if (valEl) {
valEl.textContent = isStage2 ? '0.0' : '0';
}
updateSliderBattleDisplay();
};
}

questionFeedbackBanner.className = 'feedback-banner wrong';
questionFeedbackBanner.classList.remove('hidden');
if (isStage2) {
questionFeedbackBanner.innerHTML = `☠️ <strong>討伐失敗（本題未得分）！</strong>設定數值 ${valNum}% 錯誤遭到黑炎魔龍擊殺，已記錄作答成績，需等待授課教師切換至下一關開始！`;
} else if (isStage3) {
questionFeedbackBanner.innerHTML = `☠️ <strong>擊碎失敗（本題未得分）！</strong>設定數值 ${valNum} mg/dL 錯誤遭到冰晶巨神兵凍結，已記錄作答成績，需等待授課教師切換至下一關開始！`;
} else if (isStage4) {
questionFeedbackBanner.innerHTML = `☠️ <strong>討伐失敗（本題未得分）！</strong>設定數值 ${valNum} mg/dL 錯誤遭到晶化毒蠍魔君擊殺，已記錄作答成績，需等待授課教師切換至下一關開始！`;
} else if (isStage5) {
questionFeedbackBanner.innerHTML = `☠️ <strong>討伐失敗（本題未得分）！</strong>設定數值 ${valNum} mg/dL 錯誤遭到狂暴雷狼魔擊潰，已記錄作答成績，需等待授課教師切換至下一關開始！`;
}
}
}

function initA1cSliderWidget() {
const slider = document.getElementById('a1cRangeSlider');
const btnAttack = document.getElementById('btnA1cAttack');

if (!slider) return;

slider.addEventListener('input', () => {
updateSliderBattleDisplay();
playTone(480 + parseFloat(slider.value) * 15, 'sine', 0.03, 0.12);
});

if (btnAttack) {
btnAttack.addEventListener('click', (e) => {
e.preventDefault();
sfxClick();
const val = parseFloat(slider.value);
executeDragonBattleAttack(val);
});
}

updateSliderBattleDisplay();
}

window.executeDragonBattleAttack = executeDragonBattleAttack;
window.resetDragonBossState = resetDragonBossState;

// ==============================================
// 單元三 第6題 NCP 抽血檢驗報告複選模組與實習營養師特寫判定
// ==============================================
function initDmStage6LabWidget() {
const labWidget = document.getElementById('dmStage6LabWidget');
if (!labWidget) return;

// 點擊整列可切換核取方塊
const rows = labWidget.querySelectorAll('.clean-lab-table tbody tr');
rows.forEach(tr => {
const chk = tr.querySelector('.lab-check');
if (!chk) return;

tr.addEventListener('click', (e) => {
if (chk.disabled) return;
if (e.target === chk || (e.target && e.target.classList && e.target.classList.contains('lab-checkbox-label'))) return;
chk.checked = !chk.checked;
chk.dispatchEvent(new Event('change'));
});

chk.addEventListener('change', () => {
sfxClick();
if (chk.checked) {
tr.classList.add('checked-row');
} else {
tr.classList.remove('checked-row');
}
});
});

// 送出生化數據判定
const btnSubmit = document.getElementById('btnSubmitLabMulti');
if (btnSubmit) {
btnSubmit.addEventListener('click', () => {
sfxClick();

// 立即停止實習營養師朗讀題目內容與任何題目朗讀
if (currentInternVoiceAudio) {
try {
currentInternVoiceAudio.pause();
currentInternVoiceAudio.currentTime = 0;
} catch(e) {}
}
if (npcQuestionVoiceAudio) {
try {
npcQuestionVoiceAudio.pause();
npcQuestionVoiceAudio.currentTime = 0;
} catch(e) {}
}
if (window.speechSynthesis) {
try { window.speechSynthesis.cancel(); } catch(e) {}
}

// 畫面自動移到最上方 (凸顯主管很生氣的樣子，主管後面為火冒三丈紅色)
window.scrollTo({ top: 0, behavior: 'smooth' });
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;
const appMainEl = document.getElementById('rpg-app');
if (appMainEl) appMainEl.scrollTop = 0;
const stageBackdropEl = document.getElementById('stageBackdrop');
if (stageBackdropEl) {
stageBackdropEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
stageBackdropEl.classList.add('chen-angry-red-mode');
}

const checked = Array.from(labWidget.querySelectorAll('.lab-check:checked')).map(c => c.value);
const isCorrect = (checked.length === 3 && checked.includes('fpg') && checked.includes('a1c') && checked.includes('tg'));
const teacherImg = document.getElementById('charTeacherImg') || document.querySelector('#charNurse img');

dmStage6Attempts++;

if (!isCorrect) {
if (dmStage6Attempts === 1) {
// 第一次回答錯誤：給予第二次機會修正，陳先生火冒三丈
dmStage6Phase = 'fail';

if (teacherImg) {
teacherImg.src = 'assets/tech_director_chen_angry.png';
teacherImg.classList.add('angry-shake', 'angry-fire-shake');
}
if (charNurse) {
charNurse.classList.remove('inactive', 'hidden');
charNurse.classList.add('speaking', 'angry-shake', 'angry-fire-shake');
}
if (charStudent) {
charStudent.classList.add('inactive');
charStudent.classList.remove('speaking', 'zoom-eval');
}

if (speakerBadge) speakerBadge.textContent = '【竹科高階主管 陳先生 (火冒三丈 🔥)】';
if (dialogContent) {
dialogContent.innerHTML = '<span style="color:#ef4444;font-weight:900;font-size:17px;">「喂！實習的！我一分鐘產值幾萬塊，抽空坐在這裡，聽你分析，你居然跟我說正常，把你們主任叫過來」</span>';
}
if (dialogIndicator) {
dialogIndicator.textContent = '⚠️ 判定有誤！陳先生火冒三丈！請重新審視生化檢驗各項數值 ➔';
}

// 螢幕震動與紅色怒火光暈閃爍
const appEl = document.getElementById('rpg-app');
if (appEl) {
appEl.classList.add('screen-red-flash');
setTimeout(() => appEl.classList.remove('screen-red-flash'), 1200);
}

// 播放陳先生發飆生氣原聲音檔
try {
const angryAudio = new Audio('assets/voice/dm_stage6_angry.mp3');
angryAudio.play().catch(() => {});
angryAudio.onended = () => {
if (dmStage6Phase === 'fail') {
if (teacherImg) {
teacherImg.classList.remove('angry-shake', 'angry-fire-shake');
}
if (charNurse) {
charNurse.classList.remove('angry-shake', 'angry-fire-shake', 'speaking');
charNurse.classList.add('inactive');
}
if (charStudent) {
charStudent.classList.remove('inactive', 'zoom-eval');
charStudent.classList.add('speaking');
}
if (speakerBadge) speakerBadge.textContent = myNickname ? `【實習營養師 ${myNickname}】` : '【實習營養師】';
if (dialogContent) {
dialogContent.innerHTML = '「陳先生請息怒！我立即重新審視生化檢驗各項數值，把握最後一次機會！」';
}
if (dialogIndicator) {
dialogIndicator.textContent = '請在下方重新勾選所有異常指標 🩺 ➔';
}
try {
if (currentInternVoiceAudio) {
currentInternVoiceAudio.pause();
currentInternVoiceAudio.currentTime = 0;
}
const retryAudioPath = (selectedGender === 'male') ? 'assets/voice/dm_stage6_retry_male.mp3' : 'assets/voice/dm_stage6_retry.mp3';
currentInternVoiceAudio = new Audio(retryAudioPath);
currentInternVoiceAudio.play().catch(() => {});
} catch(e) {}
}
};
} catch(e) {}

// 更新表格下方臨床反饋訊息與按鈕
const fMsg = document.getElementById('labFeedbackMsg');
if (fMsg) {
fMsg.innerHTML = '<div style="color:#ef4444;font-weight:bold;font-size:14px;background:rgba(239,68,68,0.15);border:1.5px solid #ef4444;padding:8px 12px;border-radius:8px;">❌ 判定有誤！陳先生火冒三丈！<br>還有 1 次修正機會！請重新核對各項數值切點後送出！</div>';
}
btnSubmit.disabled = false;
btnSubmit.textContent = '🩺 完成生化數據判斷';
return;
} else {
// 第二次回答錯誤：本題未拿到分數 (0分)，直接 Game over，當 Game over 後就不再念語音
dmStage6Phase = 'locked_fail';

// 立即終止所有正在播放的語音、TTS、音效
if (currentInternVoiceAudio) {
try {
currentInternVoiceAudio.pause();
currentInternVoiceAudio.currentTime = 0;
} catch(e) {}
}
if (npcQuestionVoiceAudio) {
try {
npcQuestionVoiceAudio.pause();
npcQuestionVoiceAudio.currentTime = 0;
} catch(e) {}
}
if (window.speechSynthesis) {
try { window.speechSynthesis.cancel(); } catch(e) {}
}

if (teacherImg) {
teacherImg.src = 'assets/tech_director_chen_angry.png';
teacherImg.classList.add('angry-shake', 'angry-fire-shake');
}
if (charNurse) {
charNurse.classList.remove('inactive', 'hidden');
charNurse.classList.add('speaking', 'angry-shake', 'angry-fire-shake');
}
if (charStudent) {
charStudent.classList.add('inactive');
charStudent.classList.remove('speaking', 'zoom-eval');
}

if (speakerBadge) speakerBadge.textContent = '【竹科高階主管 陳先生 (極度失望)】';
if (dialogContent) {
dialogContent.innerHTML = '<span style="color:#ef4444;font-weight:900;font-size:17px;">「兩次都看錯！我一分鐘產值幾萬塊，不是來陪你們實習生玩的！連關鍵指標都抓不出來，叫你們沈主任親自來談！」</span>';
}
if (dialogIndicator) {
dialogIndicator.textContent = '❌ 第二次判定仍錯誤，本題未獲得分數 (0分)。請等待授課教師推進下一關 ⏳';
}

// 送出後端評分 (送錯誤選項 '2' -> 0分)
selectOption('2');

const fMsg = document.getElementById('labFeedbackMsg');
if (fMsg) {
fMsg.innerHTML = '<div style="color:#ef4444;font-weight:bold;font-size:14px;background:rgba(239,68,68,0.15);border:1.5px solid #ef4444;padding:8px 12px;border-radius:8px;">❌ 本題作答完畢，未得分 (0 分)。正確異常指標為：空腹血糖 (FPG 138)、糖化血色素 (HbA1c 7.4%)、三酸甘油脂 (TG 225)！請等待教師切換下一關！</div>';
}

// 鎖定全部方塊與送出按鈕
labWidget.querySelectorAll('.lab-check').forEach(c => c.disabled = true);
btnSubmit.disabled = true;
btnSubmit.style.opacity = '0.5';
btnSubmit.textContent = '❌ 本題作答結束 (未得分 0分) ‧ 等待教師推進';

// 觸發 Game Over Modal
const gameOverModal = document.getElementById('dragonGameOverModal');
if (gameOverModal) {
const gameOverSubtitle = document.getElementById('gameOverSubtitle');
const gameOverBossImg = document.getElementById('gameOverBossImg');
const gameOverTip = document.getElementById('gameOverTip');
const gameOverReason = document.getElementById('gameOverReason');

if (gameOverSubtitle) gameOverSubtitle.textContent = '遭到竹科高階主管陳先生嚴厲斥責！';
if (gameOverBossImg) gameOverBossImg.src = 'assets/tech_director_chen_angry.png';
if (gameOverTip) {
if (!isTeacher) {
gameOverTip.innerHTML = '⚠️ <strong>本關為正式個案生化評估</strong>，修正機會已用盡。已為您記錄作答成績，請等待授課教師切換至下一關開始！';
} else {
gameOverTip.innerHTML = '💡 提示：陳先生抽血報告之異常生化指標為：空腹血糖 (FPG 138 偏高)、糖化血色素 (HbA1c 7.4% 偏高)、三酸甘油脂 (TG 225 偏高)！';
}
}
if (gameOverReason) {
gameOverReason.innerHTML = '⚠️ 判定失敗！兩次判定皆有誤！<br>「我一分鐘產值幾萬塊，不是來陪你們實習生玩的！連關鍵異常指標都找不出來，叫你們沈主任親自來談！」';
}
gameOverModal.classList.remove('hidden');

// 再次確保 Game Over 狀態下徹底靜音，不再念任何語音
if (window.speechSynthesis) {
try { window.speechSynthesis.cancel(); } catch(e) {}
}
if (npcQuestionVoiceAudio) {
try {
npcQuestionVoiceAudio.pause();
npcQuestionVoiceAudio.currentTime = 0;
} catch(e) {}
}

const btnRevive = document.getElementById('btnDragonRevive');
const waitingNotice = document.getElementById('gameOverWaitingNotice');
if (btnRevive) {
btnRevive.classList.add('hidden');
btnRevive.style.display = 'none';
}
if (waitingNotice) {
waitingNotice.classList.remove('hidden');
waitingNotice.style.display = 'block';
}
}
return;
}
}

// 答對處理流程
dmStage6Phase = 'eval';
if (stageBackdropEl) {
stageBackdropEl.classList.remove('chen-angry-red-mode');
}

if (teacherImg) {
teacherImg.src = 'assets/chen_bust.png'; // 恢復正常立繪
teacherImg.classList.remove('angry-shake', 'angry-fire-shake');
}
if (charNurse) {
charNurse.classList.remove('angry-shake', 'angry-fire-shake', 'speaking');
charNurse.classList.add('inactive');
}

// 實習營養師放大特寫動畫與視覺聚焦
if (charStudent) {
charStudent.classList.remove('hidden', 'inactive');
charStudent.classList.add('speaking', 'zoom-eval');
}

// 實習營養師發表專業臨床判讀台詞
if (speakerBadge) speakerBadge.textContent = myNickname ? `【實習營養師 ${myNickname} 臨床判定】` : '【實習營養師 臨床判定】';
if (dialogContent) {
dialogContent.innerHTML = '「報告沈主任與陳先生！經臨床生化數據判讀：陳先生空腹血糖 138、糖化血色素 7.4% 偏高，確診為第 2 型糖尿病，並合併三酸甘油酯 225 偏高。其餘口服葡萄糖耐受 (132)、高密度 (45) 與低密度脂蛋白 (115) 皆在正常範圍！」';
}
if (dialogIndicator) dialogIndicator.textContent = '生化數據判定完成 🌟 獲得 500 分！';

// 播放專業判讀配音
try {
const evalAudio = new Audio('assets/voice/dm_stage6_eval.mp3');
evalAudio.play().catch(() => {});
} catch(e) {}

// 送出後端評分 (正確送選項 '1' -> 滿分)
selectOption('1');

// 更新表格下方臨床反饋訊息
const fMsg = document.getElementById('labFeedbackMsg');
if (fMsg) {
fMsg.innerHTML = '🎉 <strong style="color:#4ade80;">【生化數值判讀完全正確！】</strong> 精準識別 3 大生化異常指標（FPG 偏高 138 mg/dL、HbA1c 偏高 7.4%、TG 偏高 225 mg/dL），其餘 OGTT(132)、HDL-C(45)、LDL-C(115) 皆在正常範圍！獲得 500 分！';
}

// 鎖定表單防重複作答
labWidget.querySelectorAll('.lab-check').forEach(c => c.disabled = true);
btnSubmit.disabled = true;
btnSubmit.style.opacity = '0.6';
btnSubmit.textContent = '✅ 已完成臨床生化判讀送出 (滿分 500分)';
});
}
}

// ==============================================
// 等候大廳 專屬課程連線網址複製功能
// ==============================================
function initLobbyUrlCopy() {
const btnCopy = document.getElementById('btnCopyLobbyUrl');
const inputUrl = document.getElementById('lobbyUrlInput');
if (!btnCopy || !inputUrl) return;

function updateLobbyUrl() {
try {
const u = new URL(window.location.href);
u.searchParams.delete('clientId');
u.searchParams.delete('nickname');
u.searchParams.delete('avatar');
u.searchParams.delete('gender');
u.searchParams.delete('stage');
u.searchParams.set('unit', activeUnit);
inputUrl.value = u.toString();
} catch(e) {
inputUrl.value = window.location.origin + window.location.pathname + '?unit=' + activeUnit;
}
}
updateLobbyUrl();

btnCopy.addEventListener('click', () => {
sfxClick();
updateLobbyUrl();
const url = inputUrl.value;
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(url).then(() => {
btnCopy.textContent = '✅ 已複製課程網址！';
setTimeout(() => { btnCopy.textContent = '📋 複製課程網址'; }, 2000);
}).catch(() => fallbackCopy());
} else {
fallbackCopy();
}

function fallbackCopy() {
inputUrl.select();
try {
document.execCommand('copy');
} catch(e) {}
btnCopy.textContent = '✅ 已複製課程網址！';
setTimeout(() => { btnCopy.textContent = '📋 複製課程網址'; }, 2000);
}
});
}

// ==============================================
// 學生連線自動維持與重設遊戲自動恢復
// ==============================================
function checkAndRestoreStudentSession() {
if (isTeacher || tView) return;
const savedNick = localStorage.getItem('FYU_STUDENT_NICKNAME');
const savedAvatar = localStorage.getItem('FYU_STUDENT_AVATAR');
const savedGender = localStorage.getItem('FYU_STUDENT_GENDER');

if (savedNick) {
myNickname = savedNick;
if (inputNickname) inputNickname.value = savedNick;
if (certName) certName.value = savedNick;
}
updateJoinLobbyButtonState();
if (savedAvatar) {
selectedAvatar = savedAvatar;
avatarOptions.querySelectorAll('.avatar-opt').forEach(b => {
b.classList.toggle('selected', b.dataset.av === savedAvatar);
});
}
if (savedGender) {
selectedGender = savedGender;
genderOptions.querySelectorAll('.gender-opt').forEach(b => {
b.classList.toggle('selected', b.dataset.gender === savedGender);
});
}

// 若已有暱稱，自動向後端連線加入，免重新掃碼或重輸暱稱
// 試煉模式跳過連線大廳直接開始
if ((activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) && !tView && !isTeacher) {
    updateStudentVisuals();
    return;
}

if (savedNick && clientId) {
prepareAvatarForJoin(selectedAvatar)
.then(avatar => {
selectedAvatar = avatar;
try { localStorage.setItem('FYU_STUDENT_AVATAR', selectedAvatar); } catch(e) {}
return registerStudent(savedNick, selectedAvatar);
})
.then(data => {
if (data.sessionId) currentSessionId = data.sessionId;
myTeamName = data.teamName || "";
updateStudentVisuals();
if (data.isGameStarted) {
isGameStarted = true;
sceneLogin.classList.add('hidden');
sceneLobby.classList.add('hidden');
rpgMainStage.classList.remove('hidden');
const targetStage = Number(data.currentStage) || parseInt(urlParams.get('stage')) || currentStage || 1;
loadStage(targetStage);
startPolling();
} else {
enterLobby(data);
}
})
.catch(error => {
console.error('無法恢復學生課堂連線', error);
});
}
}

// ==============================================
// 【科幻 HUD 互動模組】生化管線異常排查 (NG-01 鼻胃管)
// ==============================================
function initSciFiNgHudWidget() {
const widget = document.getElementById('sciFiNgHudWidget');
if (!widget) return;
const btns = widget.querySelectorAll('.scifi-opt-btn');
btns.forEach(btn => {
btn.addEventListener('click', () => {
sfxClick();
const key = btn.getAttribute('data-key');
selectOption(key);
});
});
}

// ==============================================
// 【魔導能量儀・核心共鳴】神話符文石碑 (單元三 第 9 題 eAG 換算)
// ==============================================
function initArcaneEagWidget() {
const widget = document.getElementById('arcaneEagWidget');
if (!widget) return;
const btns = widget.querySelectorAll('.arcane-opt-btn');
btns.forEach(btn => {
btn.addEventListener('click', () => {
sfxClick();
const key = btn.getAttribute('data-key');
selectOption(key);
});
});
}

const fatalOverlayEl = document.getElementById('fatalAspirationOverlay');
const btnCloseFatal = document.getElementById('btnCloseFatalOverlay');
if (btnCloseFatal) {
btnCloseFatal.addEventListener('click', (e) => {
e.stopPropagation();
if (fatalOverlayEl) fatalOverlayEl.classList.add('hidden');
});
}
if (fatalOverlayEl) {
fatalOverlayEl.addEventListener('click', () => {
fatalOverlayEl.classList.add('hidden');
});
}

const gameOverModalEl = document.getElementById('dragonGameOverModal');
const btnCloseGameOverTop = document.getElementById('btnCloseGameOverModal');
const btnCloseGameOverBottom = document.getElementById('btnCloseGameOverModalBottom');
function dismissGameOverModal(e) {
if (e) e.stopPropagation();
sfxClick();
if (gameOverModalEl) gameOverModalEl.classList.add('hidden');
}
if (btnCloseGameOverTop) btnCloseGameOverTop.addEventListener('click', dismissGameOverModal);
if (btnCloseGameOverBottom) btnCloseGameOverBottom.addEventListener('click', dismissGameOverModal);

function initDiningTableWidget() {
    const tableArea = document.getElementById('rpgDiningTableArea');
    if (!tableArea) return;
    const foodItems = tableArea.querySelectorAll('.table-food-item');
    foodItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = item.getAttribute('data-key');
            if (key) {
                selectOption(key);
            }
        });
    });
}

// ==============================================
// 【單元七 第1題 腎臟晶石傳送門 RPG 互動系統】
// - 人物自由走動探索
// - 傳說對決風格移動搖桿 (Joystick)
// - 4 座選項傳送門 (A / B / C / D)
// ==============================================
let kidneyRpgRunning = false;
let kidneyRpgAnimId = null;
let kidneyHeroPos = { x: 50, y: 72 };
let kidneyHeroTarget = null;
let kidneyHeroFacingLeft = false;
let kidneyJoystickVector = { x: 0, y: 0 };
let kidneyKeysDown = { w: false, a: false, s: false, d: false, arrowup: false, arrowleft: false, arrowdown: false, arrowright: false };
let kidneyProximityCooldown = 0;
let kidneyCameraX = 0;
let kidneyCameraY = 0;
let kidneyTargetMarkerTimer = null;

const KIDNEY_PORTALS = [
    { key: '1', letter: 'A', name: '尿液白蛋白排泄率', x: 22.0, y: 48.0 },
    { key: '2', letter: 'B', name: '血漿白蛋白濃度', x: 42.0, y: 58.0 },
    { key: '3', letter: 'C', name: '血漿菊糖清除率', x: 62.0, y: 46.0 },
    { key: '4', letter: 'D', name: '血漿肌酸酐清除率', x: 82.0, y: 56.0 }
];

function updateKidneyPortalSelection(key) {
    if (!key) return;
    const strKey = String(key);
    document.querySelectorAll('.kidney-portal-zone[data-key]').forEach(zone => {
        const isSelected = String(zone.dataset.key) === strKey;
        zone.classList.toggle('selected', isSelected);
    });
    const portal = KIDNEY_PORTALS.find(p => p.key === strKey);
    const bubble = document.getElementById('kidneyPlayerBubble');
    if (bubble && portal && !teacherStageRevealed) {
        bubble.innerHTML = `已走入【區域 ${portal.letter}】並選定！✨`;
    }
}

let kidneyMobaStudentEntities = {};
let kidneySimulatedStudents = null;

function escapeMobaText(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function isKidneyOptionCorrect(optKey, targetCorrectKey) {
    if (!optKey) return false;
    const strOpt = String(optKey).trim().toUpperCase();
    const strCorr = targetCorrectKey ? String(targetCorrectKey).trim().toUpperCase() : '2';
    if (strOpt === strCorr) return true;
    if ((strOpt === '2' || strOpt === 'B') && (strCorr === '2' || strCorr === 'B')) return true;
    if ((strOpt === '1' || strOpt === 'A') && (strCorr === '1' || strCorr === 'A')) return true;
    if ((strOpt === '3' || strOpt === 'C') && (strCorr === '3' || strCorr === 'C')) return true;
    if ((strOpt === '4' || strOpt === 'D') && (strCorr === '4' || strCorr === 'D')) return true;
    return false;
}

function applyKidneyMobaAnswerReveal(correctKey, isRevealed) {
    const worldEl = document.getElementById('kidneyMobaWorld');
    if (!worldEl) return;
    const targetKey = correctKey ? String(correctKey).trim().toUpperCase() : '2';

    // 1. 更新傳送門區域高亮狀態
    document.querySelectorAll('.kidney-portal-zone[data-key]').forEach(zone => {
        const zoneKey = String(zone.dataset.key || '').trim().toUpperCase();
        const isCorrect = (zoneKey === targetKey) || (zoneKey === '2' && targetKey === 'B') || (zoneKey === 'B' && targetKey === '2');
        if (isRevealed) {
            zone.classList.toggle('is-correct-answer', isCorrect);
            zone.classList.toggle('is-wrong-answer', !isCorrect);
        } else {
            zone.classList.remove('is-correct-answer', 'is-wrong-answer');
        }
    });

    // 2. 更新底部快捷傳送按鈕高亮
    document.querySelectorAll('.quick-nav-btn[data-target-key]').forEach(btn => {
        const btnKey = String(btn.dataset.targetKey || '').trim().toUpperCase();
        const isCorrect = (btnKey === targetKey) || (btnKey === '2' && targetKey === 'B') || (btnKey === 'B' && targetKey === '2');
        const badgeMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D' };
        const labelMap = { '1': '前往A區', '2': '前往B區', '3': '前往C區', '4': '前往D區', 'A': '前往A區', 'B': '前往B區', 'C': '前往C區', 'D': '前往D區' };
        const badgeChar = badgeMap[btnKey] || btnKey;
        const baseLabel = labelMap[btnKey] || `前往${btnKey}區`;

        if (isRevealed) {
            btn.classList.toggle('is-correct-btn', isCorrect);
            btn.classList.toggle('is-wrong-btn', !isCorrect);
            if (isCorrect) {
                btn.innerHTML = `<span class="nav-badge">👑</span> ${baseLabel}`;
            } else {
                btn.innerHTML = `<span class="nav-badge">${badgeChar}</span> ${baseLabel}`;
            }
        } else {
            btn.classList.remove('is-correct-btn', 'is-wrong-btn');
            btn.innerHTML = `<span class="nav-badge">${badgeChar}</span> ${baseLabel}`;
        }
    });

    // 3. 頂部 HUD 答案揭曉橫幅 (教師端不顯示，學生端簡短精簡無英文)
    let correctBox = document.getElementById('mobaRevealedCorrectBox');
    const topBar = document.getElementById('kidneyMobaTopBar');
    if (isRevealed) {
        if (!correctBox && topBar) {
            correctBox = document.createElement('div');
            correctBox.id = 'mobaRevealedCorrectBox';
            correctBox.className = 'moba-revealed-correct-box';
            topBar.appendChild(correctBox);
        }
        if (correctBox) {
            correctBox.innerHTML = `
                <div class="correct-title">👑 正確答案：【B. 血漿白蛋白濃度】</div>
                <div class="correct-desc">💡 解析：白蛋白由肝臟合成；腎功能常用指標為腎絲球濾過率、尿素氮與肌酸酐清除率。</div>
            `;
            if (isTeacher) {
                correctBox.classList.add('hidden');
                correctBox.style.setProperty('display', 'none', 'important');
            } else {
                correctBox.classList.remove('hidden');
                correctBox.style.setProperty('display', 'flex', 'important');
            }
        }
    } else {
        if (correctBox) {
            correctBox.classList.add('hidden');
            correctBox.style.setProperty('display', 'none', 'important');
        }
    }

    // 4. 更新本機玩家狀態 (若是學生端)
    const localPlayerEl = document.getElementById('kidneyRpgPlayer');
    const heroNameEl = document.getElementById('kidneyHeroName');
    if (isTeacher) {
        if (heroNameEl) heroNameEl.textContent = '授課教師';
    } else if (localPlayerEl) {
        const rawLocalNick = (typeof studentProfile !== 'undefined' && studentProfile && studentProfile.name)
            ? studentProfile.name
            : (localStorage.getItem('student_nickname') || myNickname || '實習營養師');
        const myVote = String(studentSelectedOption || '').trim().toUpperCase();
        const isLocalCorrect = isKidneyOptionCorrect(myVote, targetKey);
        const hpFill = localPlayerEl.querySelector('.hero-hp-fill');

        if (isRevealed) {
            if (isLocalCorrect) {
                localPlayerEl.classList.add('is-winner');
                localPlayerEl.classList.remove('is-defeated', 'is-dead');
                if (hpFill) hpFill.style.width = '100%';
                if (heroNameEl) heroNameEl.innerHTML = `👑 ${escapeMobaText(rawLocalNick)} <span style="font-size:11px;color:#fde047;">(存活)</span>`;
            } else {
                localPlayerEl.classList.add('is-defeated', 'is-dead');
                localPlayerEl.classList.remove('is-winner');
                if (hpFill) hpFill.style.width = '0%';
                if (heroNameEl) heroNameEl.innerHTML = `💀 ${escapeMobaText(rawLocalNick)} <span style="font-size:11px;color:#cbd5e1;">(陣亡)</span>`;
            }
        } else {
            localPlayerEl.classList.remove('is-defeated', 'is-dead', 'is-winner');
            if (hpFill) hpFill.style.width = '100%';
            if (heroNameEl) heroNameEl.textContent = rawLocalNick;
        }
    }

    // 5. 更新所有學生端實體狀態 (老師端視角與學生端同步視角)
    Object.keys(kidneyMobaStudentEntities).forEach(sid => {
        const ent = kidneyMobaStudentEntities[sid];
        if (!ent || !ent.el) return;
        const sVote = String(ent.vote || '').trim().toUpperCase();
        const isStudentCorrect = isKidneyOptionCorrect(sVote, targetKey);
        const nameEl = ent.el.querySelector('.hero-name-label');
        const hpFill = ent.el.querySelector('.hero-hp-fill');

        if (isRevealed) {
            if (isStudentCorrect) {
                ent.el.classList.add('is-winner');
                ent.el.classList.remove('is-defeated', 'is-dead');
                if (hpFill) hpFill.style.width = '100%';
                if (nameEl) nameEl.innerHTML = `👑 ${escapeMobaText(ent.rawNick || '同學')} <span style="font-size:11px;color:#fde047;">(存活)</span>`;
            } else {
                ent.el.classList.add('is-defeated', 'is-dead');
                ent.el.classList.remove('is-winner');
                if (hpFill) hpFill.style.width = '0%';
                if (nameEl) nameEl.innerHTML = `💀 ${escapeMobaText(ent.rawNick || '同學')} <span style="font-size:11px;color:#cbd5e1;">(陣亡)</span>`;
            }
        } else {
            ent.el.classList.remove('is-defeated', 'is-dead', 'is-winner');
            if (hpFill) hpFill.style.width = '100%';
            if (nameEl) nameEl.textContent = ent.rawNick || '同學';
        }
    });

    // 6. 鎖定移動：公布答案後學生端無法移動，但教師端仍可自由巡視各選項區域
    if (!isTeacher) {
        if (isRevealed) {
            kidneyHeroTarget = null;
            kidneyJoystickVector = { x: 0, y: 0 };
            if (typeof kidneyKeysDown !== 'undefined' && kidneyKeysDown) {
                Object.keys(kidneyKeysDown).forEach(k => kidneyKeysDown[k] = false);
            }
            const playerEl = document.getElementById('kidneyRpgPlayer');
            if (playerEl) playerEl.classList.remove('is-walking');
            const knobEl = document.getElementById('kidneyJoystickKnob');
            if (knobEl) knobEl.style.transform = 'translate(0px, 0px)';
            const targetMarker = document.getElementById('kidneyTargetMarker');
            if (targetMarker) targetMarker.classList.add('hidden');
        }

        const joystickBase = document.getElementById('kidneyJoystickBase');
        if (joystickBase) {
            joystickBase.classList.toggle('disabled-lock', isRevealed);
            joystickBase.style.pointerEvents = isRevealed ? 'none' : '';
            joystickBase.style.opacity = isRevealed ? '0.35' : '';
        }

        document.querySelectorAll('.quick-nav-btn').forEach(btn => {
            btn.classList.toggle('disabled-lock', isRevealed);
            btn.style.pointerEvents = isRevealed ? 'none' : '';
        });
    } else {
        // 教師端：保持搖桿與快捷傳送按鈕可用，方便教師穿梭於各區查看
        const joystickBase = document.getElementById('kidneyJoystickBase');
        if (joystickBase) {
            joystickBase.classList.remove('disabled-lock');
            joystickBase.style.pointerEvents = '';
            joystickBase.style.opacity = '1';
        }
        document.querySelectorAll('.quick-nav-btn').forEach(btn => {
            btn.classList.remove('disabled-lock');
            btn.style.pointerEvents = '';
        });
    }
}

function updateKidneyMobaStudents(studentsList) {
    const worldEl = document.getElementById('kidneyMobaWorld');
    const minimap = document.getElementById('kidneyMinimap');
    const localPlayerEl = document.getElementById('kidneyRpgPlayer');
    if (!worldEl) return;

    let list = (studentsList && studentsList.length > 0) ? studentsList : (kidneySimulatedStudents || []);

    if (!list || list.length === 0) {
        if (localPlayerEl) localPlayerEl.style.display = '';
        Object.keys(kidneyMobaStudentEntities).forEach(id => {
            const ent = kidneyMobaStudentEntities[id];
            if (ent.el && ent.el.parentNode) ent.el.parentNode.removeChild(ent.el);
            if (ent.dotEl && ent.dotEl.parentNode) ent.dotEl.parentNode.removeChild(ent.dotEl);
            delete kidneyMobaStudentEntities[id];
        });
        return;
    }

    const currentClient = (typeof clientId !== 'undefined') ? clientId : null;
    const activeIds = new Set();
    const isRevealed = !!(
        (typeof teacherStageRevealed !== 'undefined' && teacherStageRevealed) ||
        (typeof window.teacherStageRevealed !== 'undefined' && window.teacherStageRevealed)
    );

    if (isTeacher) {
        // 教師端保留本機主角角色作為巡視導師
        if (localPlayerEl) {
            localPlayerEl.style.display = '';
            localPlayerEl.classList.add('is-teacher-hero');
            const nameEl = document.getElementById('kidneyHeroName');
            if (nameEl) nameEl.textContent = '授課教師';
            const spriteEl = document.getElementById('kidneyHeroSprite');
            if (spriteEl) {
                spriteEl.src = 'assets/hero_player_male_hd.png';
            }
        }
    }

    list.forEach((s, idx) => {
        const sid = s.clientId || `sim_${idx}`;
        activeIds.add(sid);

        if (!isTeacher && currentClient && sid === currentClient) {
            if (localPlayerEl) {
                localPlayerEl.style.display = '';
                const nameEl = document.getElementById('kidneyHeroName');
                if (nameEl && !isRevealed) nameEl.textContent = s.nickname || '實習營養師';
                const spriteEl = document.getElementById('kidneyHeroSprite');
                if (spriteEl) {
                    const isFem = (s.gender === 'female' || selectedGender === 'female' || localStorage.getItem('FYU_STUDENT_GENDER') === 'female');
                    spriteEl.src = isFem ? 'assets/hero_player_female_original_sage.png' : 'assets/hero_player_male_hd.png';
                    spriteEl.alt = isFem ? 'RPG 營養實習生 (女)' : 'RPG 營養實習生 (男)';
                }
            }
            return;
        }

        let baseTargetX = 50.0;
        let baseTargetY = 72.0;

        const voteStr = String(s.vote || '').trim().toUpperCase();
        let voteLabel = '未選擇';
        let voteBadgeClass = 'badge-opt-none';
        if (voteStr === '1' || voteStr === 'A') {
            baseTargetX = 22.0; baseTargetY = 48.0;
            voteLabel = '選 A';
            voteBadgeClass = 'badge-opt-a';
        } else if (voteStr === '2' || voteStr === 'B') {
            baseTargetX = 42.0; baseTargetY = 58.0;
            voteLabel = '選 B';
            voteBadgeClass = 'badge-opt-b';
        } else if (voteStr === '3' || voteStr === 'C') {
            baseTargetX = 62.0; baseTargetY = 46.0;
            voteLabel = '選 C';
            voteBadgeClass = 'badge-opt-c';
        } else if (voteStr === '4' || voteStr === 'D') {
            baseTargetX = 82.0; baseTargetY = 56.0;
            voteLabel = '選 D';
            voteBadgeClass = 'badge-opt-d';
        }

        const angle = idx * 2.399963;
        const dist = 2.4 + (idx % 4) * 1.3;
        const targetX = Math.max(16.0, Math.min(86.0, baseTargetX + Math.cos(angle) * dist));
        const targetY = Math.max(34.0, Math.min(74.0, baseTargetY + Math.sin(angle) * (dist * 0.65)));

        let entity = kidneyMobaStudentEntities[sid];
        const isFemale = (s.gender === 'female');
        const spriteSrc = isFemale ? 'assets/hero_player_female_original_sage.png' : 'assets/hero_player_male_hd.png';
        const nick = s.nickname || `同學 ${idx + 1}`;

        if (!entity) {
            const el = document.createElement('div');
            el.className = 'kidney-rpg-player kidney-student-player';
            el.id = `kidneyStudent_${sid}`;
            el.innerHTML = `
                <div class="player-shadow"></div>
                <div class="player-ground-aura"></div>
                <div class="hero-overhead-hud">
                    <div class="hero-id-row">
                        <span class="hero-vote-badge ${voteBadgeClass}">${voteLabel}</span>
                        <span class="hero-name-label">${escapeMobaText(nick)}</span>
                    </div>
                    <div class="hero-hp-bar">
                        <div class="hero-hp-fill" style="width: 100%;"></div>
                    </div>
                </div>
                <img src="${spriteSrc}" alt="${escapeMobaText(nick)}" class="player-sprite">
            `;
            worldEl.appendChild(el);

            let dotEl = null;
            if (minimap) {
                dotEl = document.createElement('div');
                dotEl.className = 'minimap-student-dot';
                dotEl.title = `${nick} (${voteLabel})`;
                minimap.appendChild(dotEl);
            }

            entity = {
                id: sid,
                rawNick: nick,
                vote: s.vote,
                el,
                dotEl,
                curX: 48.0 + (Math.cos(angle) * 3),
                curY: 74.0 + (Math.sin(angle) * 2),
                targetX,
                targetY,
                facingLeft: false
            };
            kidneyMobaStudentEntities[sid] = entity;
        } else {
            entity.targetX = targetX;
            entity.targetY = targetY;
            entity.rawNick = nick;
            entity.vote = s.vote;
            const voteBadgeEl = entity.el.querySelector('.hero-vote-badge');
            if (voteBadgeEl) {
                voteBadgeEl.className = `hero-vote-badge ${voteBadgeClass}`;
                voteBadgeEl.textContent = voteLabel;
            }
            const nameEl = entity.el.querySelector('.hero-name-label');
            if (nameEl && !isRevealed) nameEl.textContent = nick;
            if (entity.dotEl) {
                entity.dotEl.title = `${nick} (${voteLabel})`;
            }
            const spriteImg = entity.el.querySelector('.player-sprite');
            if (spriteImg && spriteImg.getAttribute('src') !== spriteSrc) {
                spriteImg.src = spriteSrc;
            }
        }
    });

    Object.keys(kidneyMobaStudentEntities).forEach(id => {
        if (!activeIds.has(id)) {
            const ent = kidneyMobaStudentEntities[id];
            if (ent.el && ent.el.parentNode) ent.el.parentNode.removeChild(ent.el);
            if (ent.dotEl && ent.dotEl.parentNode) ent.dotEl.parentNode.removeChild(ent.dotEl);
            delete kidneyMobaStudentEntities[id];
        }
    });

    if (isRevealed) {
        applyKidneyMobaAnswerReveal('2', true);
    }
}

window.simulateKidneyStudents = function(count = 5) {
    const demoNames = [
        { name: '陳小明', gender: 'male', vote: '1' },
        { name: '林美美', gender: 'female', vote: '2' },
        { name: '張志豪', gender: 'male', vote: '3' },
        { name: '黃雅婷', gender: 'female', vote: '4' },
        { name: '王冠宇', gender: 'male', vote: '2' },
        { name: '李佳穎', gender: 'female', vote: '1' },
        { name: '周柏翰', gender: 'male', vote: '4' },
        { name: '許馨文', gender: 'female', vote: '3' }
    ];
    kidneySimulatedStudents = [];
    for (let i = 0; i < count; i++) {
        const item = demoNames[i % demoNames.length];
        kidneySimulatedStudents.push({
            clientId: `demo_${i + 1}`,
            nickname: item.name,
            gender: item.gender,
            vote: item.vote,
            score: 100 * (i + 1)
        });
    }
    updateKidneyMobaStudents(kidneySimulatedStudents);
};

function initKidneyRpgMovement(initialSelectedKey) {
    const area = document.getElementById('kidneyGateRpgArea');
    const worldEl = document.getElementById('kidneyMobaWorld');
    const player = document.getElementById('kidneyRpgPlayer');
    const bubble = document.getElementById('kidneyPlayerBubble');
    const base = document.getElementById('kidneyJoystickBase');
    const knob = document.getElementById('kidneyJoystickKnob');
    const minimap = document.getElementById('kidneyMinimap');
    const minimapHeroDot = document.getElementById('minimapHeroDot');
    const minimapCamBox = document.getElementById('minimapCamBox');
    const targetMarker = document.getElementById('kidneyTargetMarker');
    const heroNameEl = document.getElementById('kidneyHeroName');
    if (!area || !player || !base || !knob) return;

    // 教師標籤在場景初始化時即套用紫色識別，無須等待學生加入事件。
    player.classList.toggle('is-teacher-hero', !!isTeacher);

    if (worldEl) {
        worldEl.style.backgroundImage = "url('assets/rpg_bg_moba_battlefield_hd.jpg?v=20261010_v3')";
        worldEl.style.backgroundSize = "100% 100%";
        worldEl.style.backgroundRepeat = "no-repeat";
    }
    if (area) {
        area.style.backgroundColor = "#070b14";
    }

    if (heroNameEl) {
        if (isTeacher) {
            heroNameEl.textContent = '授課教師';
        } else {
            heroNameEl.textContent = getNutritionInternDisplayName();
        }
    }

    const spriteEl = document.getElementById('kidneyHeroSprite');
    if (spriteEl) {
        if (isTeacher) {
            spriteEl.src = 'assets/hero_player_male_hd.png';
            spriteEl.alt = 'RPG 授課教師 (男)';
        } else {
            const isFem = (selectedGender === 'female' || localStorage.getItem('FYU_STUDENT_GENDER') === 'female');
            spriteEl.src = isFem ? 'assets/hero_player_female_original_sage.png' : 'assets/hero_player_male_hd.png';
            spriteEl.alt = isFem ? 'RPG 營養實習生 (女)' : 'RPG 營養實習生 (男)';
        }
    }

    const demoBtn = document.getElementById('mobaDemoBtn');
    if (demoBtn) {
        demoBtn.style.display = isTeacher ? 'inline-flex' : 'none';
    }

    if (initialSelectedKey) {
        updateKidneyPortalSelection(initialSelectedKey);
    } else if (bubble && !teacherStageRevealed) {
        bubble.innerHTML = '走入指定區域選擇答案 🚶';
    }

    if (!kidneyHeroPos || isNaN(kidneyHeroPos.x) || kidneyHeroPos.x === 0) {
        kidneyHeroPos = { x: 52.0, y: 52.0 };
    }
    kidneyHeroTarget = null;
    kidneyJoystickVector = { x: 0, y: 0 };
    knob.style.transform = 'translate(0px, 0px)';

    const minX = 14.0, maxX = 88.0;
    const minY = 30.0, maxY = 76.0;
    const moveSpeed = 0.52;
    const joystickMoveSpeed = moveSpeed * 0.9;

    // 初始化攝影機位置：傳說對決經典視野置中主角
    const initViewW = area.clientWidth || 1000;
    const initViewH = area.clientHeight || 600;
    const initWorldW = 2800;
    const initWorldH = 1600;
    const initHeroPxX = (kidneyHeroPos.x / 100.0) * initWorldW;
    const initHeroPxY = (kidneyHeroPos.y / 100.0) * initWorldH;
    const initMaxCamX = Math.max(0, initWorldW - initViewW);
    const initMaxCamY = Math.max(0, initWorldH - initViewH);
    kidneyCameraX = Math.max(0, Math.min(initMaxCamX, initHeroPxX - (initViewW / 2.0)));
    kidneyCameraY = Math.max(0, Math.min(initMaxCamY, initHeroPxY - (initViewH / 2.0)));
    if (worldEl) {
        worldEl.style.transform = `translate3d(${-kidneyCameraX.toFixed(1)}px, ${-kidneyCameraY.toFixed(1)}px, 0)`;
    }

    function showTargetMarker(xPct, yPct) {
        if (!targetMarker) return;
        targetMarker.style.left = `${xPct.toFixed(2)}%`;
        targetMarker.style.top = `${yPct.toFixed(2)}%`;
        targetMarker.classList.remove('hidden');
        clearTimeout(kidneyTargetMarkerTimer);
        kidneyTargetMarkerTimer = setTimeout(() => {
            targetMarker.classList.add('hidden');
        }, 1400);
    }

    // 點擊地面自動導航
    if (worldEl) {
        worldEl.onclick = function(e) {
            if (!isTeacher && (teacherStageRevealed || isStageLocked)) return;
            if (e.target.closest('.kidney-portal-zone') || e.target.closest('button') || e.target.closest('.kidney-moba-hud')) return;
            const rect = worldEl.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = ((e.clientY - rect.top) / rect.height) * 100;
            kidneyHeroTarget = {
                x: Math.max(minX, Math.min(maxX, clickX)),
                y: Math.max(minY, Math.min(maxY, clickY))
            };
            showTargetMarker(kidneyHeroTarget.x, kidneyHeroTarget.y);
        };
    }

    // 點擊右上角小地圖快速尋路前往
    if (minimap) {
        minimap.onclick = function(e) {
            if (!isTeacher && (teacherStageRevealed || isStageLocked)) return;
            e.stopPropagation();
            const rect = minimap.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = ((e.clientY - rect.top) / rect.height) * 100;
            kidneyHeroTarget = {
                x: Math.max(minX, Math.min(maxX, clickX)),
                y: Math.max(minY, Math.min(maxY, clickY))
            };
            showTargetMarker(kidneyHeroTarget.x, kidneyHeroTarget.y);
        };
    }

    if (kidneyRpgRunning) return;
    kidneyRpgRunning = true;

    // 1. 傳說對決風格虛擬搖桿拖曳監聽 (Pointer Events)
    let isDraggingJoystick = false;
    let baseRect = null;
    let baseCenterX = 0;
    let baseCenterY = 0;
    const maxRadius = 40;

    function handleJoystickMove(clientX, clientY) {
        if (!baseRect) baseRect = base.getBoundingClientRect();
        const dx = clientX - baseCenterX;
        const dy = clientY - baseCenterY;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
        kidneyJoystickVector = {
            x: clampedDist > 4 ? clampedX / maxRadius : 0,
            y: clampedDist > 4 ? clampedY / maxRadius : 0
        };
        kidneyHeroTarget = null;
    }

    function onPointerDown(e) {
        if (!isTeacher && (teacherStageRevealed || isStageLocked)) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingJoystick = true;
        baseRect = base.getBoundingClientRect();
        baseCenterX = baseRect.left + baseRect.width / 2;
        baseCenterY = baseRect.top + baseRect.height / 2;
        try { base.setPointerCapture(e.pointerId); } catch (_) {}
        handleJoystickMove(e.clientX, e.clientY);
    }

    function onPointerMove(e) {
        if (!isDraggingJoystick || (!isTeacher && (teacherStageRevealed || isStageLocked))) return;
        e.preventDefault();
        e.stopPropagation();
        handleJoystickMove(e.clientX, e.clientY);
    }

    function onPointerUp(e) {
        if (!isDraggingJoystick) return;
        isDraggingJoystick = false;
        try { base.releasePointerCapture(e.pointerId); } catch (_) {}
        knob.style.transform = 'translate(0px, 0px)';
        kidneyJoystickVector = { x: 0, y: 0 };
    }

    base.onpointerdown = onPointerDown;
    base.onpointermove = onPointerMove;
    base.onpointerup = onPointerUp;
    base.onpointercancel = onPointerUp;

    // 2. 鍵盤 WASD / 方向鍵行走支援
    function onKeyDown(e) {
        if (!isTeacher && (teacherStageRevealed || isStageLocked)) return;
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
            kidneyKeysDown[k] = true;
            kidneyHeroTarget = null;
        }
    }
    function onKeyUp(e) {
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
            kidneyKeysDown[k] = false;
        }
    }
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 3. 60 FPS 物理移動、相機平滑跟隨與小地圖雷達更新
    function step() {
        if (!kidneyRpgRunning) return;

        const isRevealedLocked = !isTeacher && !!(
            (typeof teacherStageRevealed !== 'undefined' && teacherStageRevealed) ||
            (typeof window.teacherStageRevealed !== 'undefined' && window.teacherStageRevealed) ||
            (typeof isStageLocked !== 'undefined' && isStageLocked)
        );

        let vx = 0;
        let vy = 0;

        if (!isRevealedLocked) {
            // 搖桿向量
            if (kidneyJoystickVector.x !== 0 || kidneyJoystickVector.y !== 0) {
                vx = kidneyJoystickVector.x * joystickMoveSpeed;
                vy = kidneyJoystickVector.y * joystickMoveSpeed;
            }

            // 鍵盤向量
            let kx = 0, ky = 0;
            if (kidneyKeysDown['a'] || kidneyKeysDown['arrowleft']) kx -= 1;
            if (kidneyKeysDown['d'] || kidneyKeysDown['arrowright']) kx += 1;
            if (kidneyKeysDown['w'] || kidneyKeysDown['arrowup']) ky -= 1;
            if (kidneyKeysDown['s'] || kidneyKeysDown['arrowdown']) ky += 1;
            if (kx !== 0 || ky !== 0) {
                const len = Math.hypot(kx, ky);
                vx = (kx / len) * moveSpeed;
                vy = (ky / len) * moveSpeed;
                if (!isDraggingJoystick) {
                    knob.style.transform = `translate(${(kx / len) * 22}px, ${(ky / len) * 22}px)`;
                }
            } else if (!isDraggingJoystick && kidneyJoystickVector.x === 0 && kidneyJoystickVector.y === 0) {
                knob.style.transform = 'translate(0px, 0px)';
            }

            // 點擊指定區域或小地圖自動跑向目標
            if (kidneyHeroTarget && Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) {
                const tdx = kidneyHeroTarget.x - kidneyHeroPos.x;
                const tdy = (kidneyHeroTarget.y - kidneyHeroPos.y) * 1.25;
                const dist = Math.hypot(tdx, tdy);
                if (dist > 0.8) {
                    vx = (tdx / dist) * moveSpeed * 1.35;
                    vy = ((kidneyHeroTarget.y - kidneyHeroPos.y) / dist) * moveSpeed * 1.35;
                } else {
                    kidneyHeroTarget = null;
                }
            }
        } else {
            kidneyHeroTarget = null;
            kidneyJoystickVector = { x: 0, y: 0 };
            player.classList.remove('is-walking');
            if (knob) knob.style.transform = 'translate(0px, 0px)';
        }

        const isMoving = Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01;

        if (isMoving) {
            kidneyHeroPos.x = Math.max(minX, Math.min(maxX, kidneyHeroPos.x + vx));
            kidneyHeroPos.y = Math.max(minY, Math.min(maxY, kidneyHeroPos.y + vy));

            if (vx < -0.05) kidneyHeroFacingLeft = true;
            else if (vx > 0.05) kidneyHeroFacingLeft = false;

            player.classList.add('is-walking');
        } else {
            player.classList.remove('is-walking');
        }

        player.classList.toggle('facing-left', kidneyHeroFacingLeft);

        // 透視景深縮放 (遠處略小，近處略大，整體縮小約 10%)
        const depthRatio = (kidneyHeroPos.y - minY) / (maxY - minY);
        const scale = (0.86 + depthRatio * 0.24) * 0.90;

        player.style.left = `${kidneyHeroPos.x.toFixed(2)}%`;
        player.style.top = `${kidneyHeroPos.y.toFixed(2)}%`;
        player.style.transform = `translate(-50%, -88%) scale(${scale.toFixed(3)})`;

        // 4. 計算世界大小與視口大小以驅動攝影機與背景連動 (MOBA Camera Tracking)
        const viewW = area.clientWidth || 1000;
        const viewH = area.clientHeight || 600;
        const worldW = (worldEl ? worldEl.clientWidth : 0) || 2800;
        const worldH = (worldEl ? worldEl.clientHeight : 0) || 1600;

        // 主角在世界地圖中的絕對像素座標
        const heroPxX = (kidneyHeroPos.x / 100.0) * worldW;
        const heroPxY = (kidneyHeroPos.y / 100.0) * worldH;

        // 目標攝影機平移量：將主角鎖定在螢幕視窗中心 (傳說對決經典跟隨視角)
        let targetCamX = heroPxX - (viewW / 2.0);
        let targetCamY = heroPxY - (viewH / 2.0);

        // 限制相機於世界邊界內，防止邊緣露黑底
        const maxCamX = Math.max(0, worldW - viewW);
        const maxCamY = Math.max(0, worldH - viewH);
        targetCamX = Math.max(0, Math.min(maxCamX, targetCamX));
        targetCamY = Math.max(0, Math.min(maxCamY, targetCamY));

        // 平滑流暢跟隨 (Lerp 20%)
        kidneyCameraX += (targetCamX - kidneyCameraX) * 0.20;
        kidneyCameraY += (targetCamY - kidneyCameraY) * 0.20;

        // 平移世界大地圖層！(人物在螢幕中央，戰場地圖、河道、防禦塔與 4 座法陣隨人物移動流暢滾動)
        if (worldEl) {
            worldEl.style.transform = `translate3d(${-kidneyCameraX.toFixed(1)}px, ${-kidneyCameraY.toFixed(1)}px, 0)`;
        }

        // 5. 同步雷達小地圖 (Minimap)
        if (minimapHeroDot) {
            minimapHeroDot.style.left = `${kidneyHeroPos.x.toFixed(2)}%`;
            minimapHeroDot.style.top = `${kidneyHeroPos.y.toFixed(2)}%`;
        }
        if (minimapCamBox && worldW > 0 && worldH > 0) {
            const camBoxLeft = (kidneyCameraX / worldW) * 100;
            const camBoxTop = (kidneyCameraY / worldH) * 100;
            const camBoxW = Math.min(100, (viewW / worldW) * 100);
            const camBoxH = Math.min(100, (viewH / worldH) * 100);
            minimapCamBox.style.left = `${camBoxLeft.toFixed(2)}%`;
            minimapCamBox.style.top = `${camBoxTop.toFixed(2)}%`;
            minimapCamBox.style.width = `${camBoxW.toFixed(2)}%`;
            minimapCamBox.style.height = `${camBoxH.toFixed(2)}%`;
        }

        // 6. 偵測是否靠近 4 座指定選題區域
        let closestPortal = null;
        let minDist = 999;
        KIDNEY_PORTALS.forEach(portal => {
            const portalEl = document.getElementById(`kidneyPortal${portal.key}`);
            const dist = Math.hypot(kidneyHeroPos.x - portal.x, (kidneyHeroPos.y - portal.y) * 1.35);
            const isNear = dist < 7.8;
            if (portalEl) {
                portalEl.classList.toggle('hero-near', isNear);
            }
            if (dist < minDist) {
                minDist = dist;
                closestPortal = portal;
            }
        });

        if (kidneyProximityCooldown > 0) kidneyProximityCooldown--;

        // 走入指定區域地面半徑內自動確認選擇答案 (學生端走入自動選定，老師端僅為巡視不觸發個人作答)
        if (!isTeacher && !isRevealedLocked && closestPortal && minDist < 5.2 && kidneyProximityCooldown === 0) {
            if (String(studentSelectedOption) !== String(closestPortal.key)) {
                kidneyProximityCooldown = 35;
                selectOption(closestPortal.key);
                updateKidneyPortalSelection(closestPortal.key);
            }
        }

        // 7. 更新地圖上所有已加入學生的即時移動動畫、行走姿態與景深排序
        Object.keys(kidneyMobaStudentEntities).forEach(sid => {
            const ent = kidneyMobaStudentEntities[sid];
            if (!ent || !ent.el) return;

            if (isRevealedLocked) {
                ent.curX = ent.targetX;
                ent.curY = ent.targetY;
                ent.el.classList.remove('is-walking');
            } else {
                const dx = ent.targetX - ent.curX;
                const dy = ent.targetY - ent.curY;
                const dist = Math.hypot(dx, dy);

                if (dist > 0.35) {
                    ent.curX += dx * 0.08;
                    ent.curY += dy * 0.08;
                    ent.el.classList.add('is-walking');
                    if (dx < -0.05) ent.facingLeft = true;
                    else if (dx > 0.05) ent.facingLeft = false;
                } else {
                    ent.curX = ent.targetX;
                    ent.curY = ent.targetY;
                    ent.el.classList.remove('is-walking');
                }
            }

            const depthRatio = (ent.curY - minY) / (maxY - minY);
            const scale = (0.86 + depthRatio * 0.24) * 0.90;
            const zIndex = Math.min(38, Math.max(20, Math.floor(ent.curY)));

            ent.el.style.left = `${ent.curX.toFixed(2)}%`;
            ent.el.style.top = `${ent.curY.toFixed(2)}%`;
            ent.el.style.zIndex = zIndex;
            ent.el.style.transform = `translate(-50%, -88%) scale(${scale.toFixed(3)})`;
            ent.el.classList.toggle('facing-left', ent.facingLeft);

            if (ent.dotEl) {
                ent.dotEl.style.left = `${ent.curX.toFixed(2)}%`;
                ent.dotEl.style.top = `${ent.curY.toFixed(2)}%`;
            }
        });

        kidneyRpgAnimId = requestAnimationFrame(step);
    }

    if (kidneyRpgAnimId) cancelAnimationFrame(kidneyRpgAnimId);
    kidneyRpgAnimId = requestAnimationFrame(step);
}

function stopKidneyRpgMovement() {
    kidneyRpgRunning = false;
    if (kidneyRpgAnimId) {
        cancelAnimationFrame(kidneyRpgAnimId);
        kidneyRpgAnimId = null;
    }
}

window.selectKidneyPortal = function(key) {
    if (!key) return;
    if (!isTeacher && (teacherStageRevealed || isStageLocked)) return;
    const strKey = String(key);
    const portal = KIDNEY_PORTALS.find(p => p.key === strKey);
    if (portal) {
        kidneyHeroTarget = { x: portal.x, y: portal.y + 4.0 };
        const marker = document.getElementById('kidneyTargetMarker');
        if (marker) {
            marker.style.left = `${kidneyHeroTarget.x}%`;
            marker.style.top = `${kidneyHeroTarget.y}%`;
            marker.classList.remove('hidden');
            clearTimeout(kidneyTargetMarkerTimer);
            kidneyTargetMarkerTimer = setTimeout(() => marker.classList.add('hidden'), 1500);
        }
    }
    if (!isTeacher && !teacherStageRevealed && !isStageLocked) {
        selectOption(strKey);
        updateKidneyPortalSelection(strKey);
    }
};

initA1cSliderWidget();
initDmStage6LabWidget();
initSciFiNgHudWidget();
initArcaneEagWidget();
initDiningTableWidget();
initLobbyUrlCopy();
checkAndRestoreStudentSession();


// 進入試煉模式首頁
if ((activeUnit === 'new_student_trial' || isNewStudentTrialUnit(activeUnit)) && !isTeacher && !tView) {
    if (!isGameStarted) {
        if (sceneLogin) sceneLogin.classList.add('hidden');
        if (sceneLobby) sceneLobby.classList.add('hidden');
        if (rpgMainStage) rpgMainStage.classList.remove('hidden');
        isGameStarted = true;
        showNewStudentTrialStep(0);
    }

    // 預設一開始開啟 BGM 播放
    if (bgmToggleBtn) {
        bgmToggleBtn.classList.add('active');
        bgmToggleBtn.textContent = '🎵 BGM [開]';
    }
    playBgm();
}


window.selectOption = selectOption;
window.selectDiningFood = function(key) {
    if (key) {
        selectOption(key);
    }
};
window.initDiningTableWidget = initDiningTableWidget;
window.initKidneyRpgMovement = initKidneyRpgMovement;
window.stopKidneyRpgMovement = stopKidneyRpgMovement;
window.triggerVictory = triggerVictory;
window.showGrandmaModalForStage4 = showGrandmaModalForStage4;
window.loadStage = loadStage;
window.getCurrentUnitConf = () => currentUnitConf;
window.initSciFiNgHudWidget = initSciFiNgHudWidget;
window.initArcaneEagWidget = initArcaneEagWidget;
window.updateKidneyMobaStudents = updateKidneyMobaStudents;
window.simulateKidneyStudents = simulateKidneyStudents;

})();
