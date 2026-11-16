import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('nutrition_hub.db')
cur = conn.cursor()

# 1. Delete all existing rows for unit_curriculum_03
cur.execute("DELETE FROM QRCodes WHERE LOWER(UnitId) = 'unit_curriculum_03' OR LOWER(LocalRoute) LIKE '%curriculum_03%'")
print("Deleted old unit_curriculum_03 rows, count:", cur.rowcount)

# 2. Insert the 5 requested questions
questions = [
    {
        "stage": 1,
        "mod": "CURRICULUM_03_STAGE_1",
        "title": "第 1 題：下列有關身體組成的敘述，何者錯誤？",
        "desc": "選項 A：體脂肪（fat mass）存在於腦、骨骼肌及脂肪組織\r\n選項 B：男性的瘦體組織（lean body mass）較女性多\r\n選項 C：一般而言，同年齡同性別之正常健康人，體組成中非體脂肪（fat free mass）之比例相似\r\n選項 D：非體脂肪（fat free mass）即是瘦體組織（lean body mass） (正確答案)"
    },
    {
        "stage": 2,
        "mod": "CURRICULUM_03_STAGE_2",
        "title": "第 2 題：有關白色脂肪組織的敘述，下列何者錯誤？",
        "desc": "選項 A：因含有 Carotene 顏色為淡黃色\r\n選項 B：可保護體內臟器避免碰撞傷害\r\n選項 C：提供新生兒產熱 (正確答案)\r\n選項 D：儲存三酸甘油酯"
    },
    {
        "stage": 3,
        "mod": "CURRICULUM_03_STAGE_3",
        "title": "第 3 題：有關神經性厭食症（anorexia nervosa）病人的營養素需求，下列何者正確？",
        "desc": "選項 A：低體重病人常有維生素 B1 缺乏，再餵食（refeeding）階段需額外補充 (正確答案)\r\n選項 B：低體重病人血清 25-hydroxy vitamin D 濃度通常過高\r\n選項 C：因高胡蘿蔔素血症（hypercarotenemia），需限制病人類胡蘿蔔素的攝取\r\n選項 D：限鈉飲食（2 公克／天）對病人的水分滯留沒有幫助"
    },
    {
        "stage": 4,
        "mod": "CURRICULUM_03_STAGE_4",
        "title": "第 4 題：有關暴食症（Bulimia）的診斷標準之敘述，下列何者正確？",
        "desc": "選項 A：個案重複發生暴食現象，在一段獨立時間內（如 2 小時）吃下很大量食物 (正確答案)\r\n選項 B：體重顯著下降，且對自己身材的纖瘦沒有感覺\r\n選項 C：個案常催吐、不當使用瀉劑或利尿劑，易造成貧血\r\n選項 D：個案常發生皮膚乾燥、營養不良等問題，應即時補充熱量與蛋白質等"
    },
    {
        "stage": 5,
        "mod": "CURRICULUM_03_STAGE_5",
        "title": "第 5 題：體重過輕仍然非常害怕變胖為下列何種飲食障礙的診斷依據之一？",
        "desc": "選項 A：bulimia nervosa\r\n選項 B：anorexia nervosa (正確答案)\r\n選項 C：binge-eating disorder\r\n選項 D：night eating syndrome"
    }
]

for q in questions:
    cur.execute("""
        INSERT INTO QRCodes 
        (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description, CreatedAt)
        VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (
        "unit_curriculum_03",
        "【單元三】體重控制與管理",
        "/index.html?unit=curriculum_03",
        q["mod"],
        q["title"],
        "膳食療養學",
        "",
        q["stage"],
        f"/index.html?unit=curriculum_03&stage={q['stage']}",
        q["desc"]
    ))

conn.commit()

# Verify
cur.execute("SELECT Id, ModuleCode, Title, LocalRoute FROM QRCodes WHERE UnitId = 'unit_curriculum_03' ORDER BY LocalRoute")
rows = cur.fetchall()
print(f"\nInserted {len(rows)} rows for unit_curriculum_03:")
for r in rows:
    print(r)

conn.close()
