import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('nutrition_hub.db')
cur = conn.cursor()

# Delete existing curriculum_07 questions and re-insert 1 to 6 to keep it cleanly in order
cur.execute("DELETE FROM QRCodes WHERE UnitId = 'unit_curriculum_07'")

qs = [
    {
        'stage': 1,
        'mod': 'CURRICULUM_07_STAGE_1',
        'title': '第 1 題：下列何者不是測量腎臟功能的常用參考指標？',
        'desc': '選項 A：尿液白蛋白排泄率（urinary albumin excretion rate）\r\n選項 B：血漿白蛋白濃度（plasma albumin concentration） (正確答案)\r\n選項 C：血漿菊糖清除率（clearance of inulin）\r\n選項 D：血漿肌酸酐清除率（clearance of creatinine）'
    },
    {
        'stage': 2,
        'mod': 'CURRICULUM_07_STAGE_2',
        'title': '第 2 題：王小姐畢業後出國工作一直沒有追蹤腎功能，十年後返臺進行全身健康檢查發現 glomerular filtration rate 為 42 mL/min/1.73m2 、三個月後再追蹤仍為 40 mL/min/1.73m2，王小姐目前為 chronic kidney disease 的第幾期？',
        'desc': '選項 A：G2\r\n選項 B：G3a\r\n選項 C：G3b (正確答案)\r\n選項 D：G4a'
    },
    {
        'stage': 3,
        'mod': 'CURRICULUM_07_STAGE_3',
        'title': '第 3 題：王小姐身高 162 公分、體重 60 公斤，平日有健身重訓，在此階段，下列何飲食處方最不適合王小姐？',
        'desc': '選項 A：熱量 2,100 大卡、蛋白質 45 公克\r\n選項 B：熱量 2,100 大卡、蛋白質 36 公克\r\n選項 C：熱量 2,100 大卡、蛋白質 90 公克 (正確答案)\r\n選項 D：熱量 1,680 大卡、蛋白質 36 公克'
    },
    {
        'stage': 4,
        'mod': 'CURRICULUM_07_STAGE_4',
        'title': '第 4 題：慢性腎臟病 Stage 4 的病人不需要限制下列何種營養素的攝取？',
        'desc': '選項 A：鈣 (正確答案)\r\n選項 B：磷\r\n選項 C：鈉\r\n選項 D：鉀'
    },
    {
        'stage': 5,
        'mod': 'CURRICULUM_07_STAGE_5',
        'title': '第 5 題：末期腎臟病（ESRD），與下列何種疾病最不相關？',
        'desc': '選項 A：糖尿病\r\n選項 B：高血壓\r\n選項 C：腎絲球腎炎\r\n選項 D：克隆氏症 (正確答案)'
    },
    {
        'stage': 6,
        'mod': 'CURRICULUM_07_STAGE_6',
        'title': '第 6 題：有關醫師評估透析病人乾體重（dry weight）的目的，下列何者錯誤？',
        'desc': '選項 A：維持體內最佳體液容積\r\n選項 B：維持正常血壓\r\n選項 C：減少蛋白尿 (正確答案)\r\n選項 D：降低死亡率'
    }
]

for q in qs:
    cur.execute("""
        INSERT INTO QRCodes 
        (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description, CreatedAt)
        VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (
        'unit_curriculum_07',
        '【單元七】腎臟疾病之營養治療',
        '/index.html?unit=curriculum_07',
        q['mod'],
        q['title'],
        '膳食療養學',
        '',
        q['stage'],
        '/index.html?unit=curriculum_07&stage=' + str(q['stage']),
        q['desc']
    ))

conn.commit()
print('Successfully synced curriculum_07 database with 6 stages!')

cur.execute("SELECT Id, ModuleCode, Title, LocalRoute FROM QRCodes WHERE UnitId = 'unit_curriculum_07' ORDER BY LocalRoute")
for r in cur.fetchall():
    print(r)

conn.close()
