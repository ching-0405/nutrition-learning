using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.IO;

namespace NutritionQRHub.Database
{
    public class TeachingModule
    {
        public int Id { get; set; }
        public string UnitId { get; set; } // e.g. "unit_must", "unit_ncp"
        public string UnitTitle { get; set; } // e.g. "【單元一】MUST 臨床快篩評估實戰"
        public string UnitRoute { get; set; } // e.g. "/index.html?unit=must"
        public string ModuleCode { get; set; }
        public string Title { get; set; }
        public string CourseName { get; set; }
        public string PptFile { get; set; }
        public int PptSlide { get; set; }
        public string LocalRoute { get; set; }
        public string Description { get; set; }

        public override string ToString()
        {
            if (string.IsNullOrEmpty(Title))
            {
                return UnitTitle ?? UnitId ?? "單元";
            }
            return string.Format("{0} - [P.{1}] {2}", UnitTitle, PptSlide, Title);
        }
    }

    public class DatabaseManager
    {
        private const string RemovedCourseName = "營養勇者學院";
        private readonly string _connectionString;
        private readonly string _dbPath;

        public DatabaseManager(string dbPath = "nutrition_hub.db")
        {
            _dbPath = dbPath;
            _connectionString = string.Format("Data Source={0};Version=3;", dbPath);
            InitializeDatabase();
        }

        private void InitializeDatabase()
        {
            if (!File.Exists(_dbPath))
            {
                SQLiteConnection.CreateFile(_dbPath);
            }

            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = @"
                CREATE TABLE IF NOT EXISTS QRCodes (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UnitId TEXT DEFAULT 'unit_must',
                    UnitTitle TEXT DEFAULT '【單元一】MUST 臨床快篩評估實戰',
                    UnitRoute TEXT DEFAULT '/index.html?unit=must',
                    ModuleCode TEXT UNIQUE NOT NULL,
                    Title TEXT NOT NULL,
                    CourseName TEXT NOT NULL,
                    PptFile TEXT,
                    PptSlide INTEGER,
                    LocalRoute TEXT NOT NULL,
                    Description TEXT,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS StudentAttempts (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    CaseCode TEXT,
                    StudentName TEXT,
                    StudentId TEXT,
                    SubmittedTotalScore INTEGER,
                    SubmittedRiskLevel TEXT,
                    IsCorrect INTEGER,
                    DurationSeconds INTEGER,
                    AttemptedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS Courses (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    CourseName TEXT UNIQUE NOT NULL
                );
                INSERT OR IGNORE INTO Courses (CourseName) VALUES ('膳食療養學');

                CREATE TABLE IF NOT EXISTS Units (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UnitId TEXT NOT NULL,
                    UnitTitle TEXT NOT NULL,
                    UnitRoute TEXT NOT NULL,
                    CourseName TEXT NOT NULL,
                    UNIQUE(UnitId, CourseName)
                );
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT DISTINCT UnitId, UnitTitle, UnitRoute, CourseName FROM QRCodes WHERE UnitId IS NOT NULL AND UnitId != '';";

                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                // Ensure columns UnitId, UnitTitle, UnitRoute exist (migration)
                EnsureColumnExists(conn, "QRCodes", "UnitId", "TEXT DEFAULT 'unit_must'");
                EnsureColumnExists(conn, "QRCodes", "UnitTitle", "TEXT DEFAULT '【單元一】MUST 臨床快篩評估實戰'");
                EnsureColumnExists(conn, "QRCodes", "UnitRoute", "TEXT DEFAULT '/index.html?unit=must'");

                // Normalize only the legacy course name; preserve distinct subject names.
                string updateCourseSql = "UPDATE QRCodes SET CourseName = '膳食療養學' WHERE CourseName IS NULL OR CourseName = '';";
                using (var ucCmd = new SQLiteCommand(updateCourseSql, conn))
                {
                    ucCmd.ExecuteNonQuery();
                }

                using (var renameCourseCmd = new SQLiteCommand(@"
                    INSERT OR IGNORE INTO Courses (CourseName)
                    SELECT '膳食療養學' WHERE EXISTS (SELECT 1 FROM Courses WHERE CourseName = '膳食療養學(一)');
                    INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                    SELECT UnitId, UnitTitle, UnitRoute, '膳食療養學' FROM Units WHERE CourseName = '膳食療養學(一)';
                    UPDATE QRCodes SET CourseName = '膳食療養學' WHERE CourseName = '膳食療養學(一)';
                    DELETE FROM Units WHERE CourseName = '膳食療養學(一)';
                    DELETE FROM Courses WHERE CourseName = '膳食療養學(一)';", conn))
                {
                    renameCourseCmd.ExecuteNonQuery();
                }

                using (var removeCourse2Cmd = new SQLiteCommand(@"
                    UPDATE QRCodes SET CourseName = '膳食療養學' WHERE CourseName LIKE '%膳食療養學(二)%' OR CourseName LIKE '%膳食療養學（二）%';
                    DELETE FROM Units WHERE CourseName LIKE '%膳食療養學(二)%' OR CourseName LIKE '%膳食療養學（二）%';
                    DELETE FROM Courses WHERE CourseName LIKE '%膳食療養學(二)%' OR CourseName LIKE '%膳食療養學（二）%';", conn))
                {
                    removeCourse2Cmd.ExecuteNonQuery();
                }

                // Ensure the curriculum is available for all registered courses.
                string seedUnitsSql = @"
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT 'unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', CourseName FROM Courses;
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT 'unit_support', '【單元二】營養支持', '/index.html?unit=support', CourseName FROM Courses;
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT 'unit_dm', '【單元六】糖尿病之營養治療', '/index.html?unit=dm', CourseName FROM Courses;
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT 'unit_life', '【單元十五】人生好難題', '/index.html?unit=life', CourseName FROM Courses;
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT 'unit_bfbbb5', '【單元十六】健檢報告判讀', '/index.html?unit=unit_bfbbb5', CourseName FROM Courses;
                INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                SELECT DISTINCT UnitId, UnitTitle, UnitRoute, CourseName FROM QRCodes WHERE UnitId IS NOT NULL AND UnitId != ''; ";
                using (var suCmd = new SQLiteCommand(seedUnitsSql, conn))
                {
                    suCmd.ExecuteNonQuery();
                }
                EnsureCurriculumUnits(conn);

                // Check if database is brand new (only seed on initial empty setup)
                string checkSql = "SELECT COUNT(*) FROM QRCodes;";
                using (var checkCmd = new SQLiteCommand(checkSql, conn))
                {
                    long totalCount = (long)checkCmd.ExecuteScalar();
                    if (totalCount == 0)
                    {
                        InsertSeedData(conn);
                    }
                }

                // Ensure DM_STAGE_2 and DM_STAGE_3 exist
                string checkDm2Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_2';";
                using (var checkDm2Cmd = new SQLiteCommand(checkDm2Sql, conn))
                {
                    long dm2Count = (long)checkDm2Cmd.ExecuteScalar();
                    if (dm2Count == 0)
                    {
                        string insertDm2Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_2', '第 2 題：糖尿病四大診斷標準檢定 (HbA1c上舉與三大數值判定)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 8, '/index.html?unit=dm&stage=2', '選項 1：FPG ≥ 126 mg/dL、75g OGTT 2小時 ≥ 200 mg/dL、隨機血糖 ≥ 200 mg/dL 伴隨典型症狀 (正確答案)
選項 2：FPG ≥ 140 mg/dL、75g OGTT 2小時 ≥ 180 mg/dL、隨機血糖 ≥ 180 mg/dL
選項 3：FPG ≥ 110 mg/dL、75g OGTT 2小時 ≥ 200 mg/dL、隨機血糖 ≥ 160 mg/dL
選項 4：FPG ≥ 126 mg/dL、75g OGTT 2小時 ≥ 140 mg/dL、隨機血糖 ≥ 140 mg/dL');";
                        using (var inDm2Cmd = new SQLiteCommand(insertDm2Sql, conn))
                        {
                            inDm2Cmd.ExecuteNonQuery();
                        }
                    }
                }

                string checkDm3Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_3';";
                using (var checkDm3Cmd = new SQLiteCommand(checkDm3Sql, conn))
                {
                    long dm3Count = (long)checkDm3Cmd.ExecuteScalar();
                    if (dm3Count == 0)
                    {
                        string insertDm3Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_3', '第 3 題：【個案判讀】竹科陳先生 48歲 糖尿病與代謝異常判定', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 12, '/index.html?unit=dm&stage=3', '選項 1：確診第 2 型糖尿病，並合併高三酸甘油酯血症 (正確答案)
選項 2：僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準
選項 3：屬於第 1 型糖尿病，必須立即終生注射胰島素
選項 4：各項血糖數值皆在正常安全範圍，無代謝異常問題');";
                        using (var inDm3Cmd = new SQLiteCommand(insertDm3Sql, conn))
                        {
                            inDm3Cmd.ExecuteNonQuery();
                        }
                    }
                }

                // Ensure LIFE_STAGE_1 question exists
                string checkLifeSql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'LIFE_STAGE_1';";
                using (var checkLifeCmd = new SQLiteCommand(checkLifeSql, conn))
                {
                    long lifeCount = (long)checkLifeCmd.ExecuteScalar();
                    if (lifeCount == 0)
                    {
                        string insertLifeSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_life', '【單元四】人生好難題 ‧ 校園生活特別篇', '/index.html?unit=life', 'LIFE_STAGE_1', '第 1 題：【人生好難題】在南台灣艷陽下騎車趕早八，抵達教室的瞬間？', '膳食療養學(一)', '校園生活篇.pptx', 1, '/index.html?unit=life&stage=1', '選項 1：衝進教室，已經熱到像剛洗完澡般滿身大汗
選項 2：發現教授還沒來，慶幸不用記曠課好震撼
選項 3：回想熬夜寫完的兩萬字報告，意志力無比強悍
選項 4：結果發現今天是國定假日，留下一個大大的遺憾 (正確答案)');";
                        using (var inLifeCmd = new SQLiteCommand(insertLifeSql, conn))
                        {
                            inLifeCmd.ExecuteNonQuery();
                        }
                    }
                }

                // Ensure DM_STAGE_8 question exists
                string checkDm8Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_8';";
                using (var checkDm8Cmd = new SQLiteCommand(checkDm8Sql, conn))
                {
                    long dm8Count = (long)checkDm8Cmd.ExecuteScalar();
                    if (dm8Count == 0)
                    {
                        string insertDm8Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_8', '第 8 題：第 2 型糖尿病致病機轉與胰島素阻抗相關特徵', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 16, '/index.html?unit=dm&stage=8', '選項 1：飯後高血糖
選項 2：血液中胰島素濃度增加
選項 3：產生酮酸中毒 (正確答案)
選項 4：血液中游離脂肪酸濃度增加');";
                        using (var inDm8Cmd = new SQLiteCommand(insertDm8Sql, conn))
                        {
                            inDm8Cmd.ExecuteNonQuery();
                        }
                    }
                }

                // Ensure DM_STAGE_9 question exists (eAG calculation)
                string checkDm9Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_9';";
                using (var checkDm9Cmd = new SQLiteCommand(checkDm9Sql, conn))
                {
                    long dm9Count = (long)checkDm9Cmd.ExecuteScalar();
                    if (dm9Count == 0)
                    {
                        string insertDm9Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_9', '第 9 題：【魔導能量儀・核心共鳴】估計平均血糖值（eAG）換算', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 18, '/index.html?unit=dm&stage=9', '選項 1：139 mg/dL
選項 2：183 mg/dL
選項 3：212 mg/dL (正確答案)
選項 4：251 mg/dL');";
                        using (var inDm9Cmd = new SQLiteCommand(insertDm9Sql, conn))
                        {
                            inDm9Cmd.ExecuteNonQuery();
                        }
                    }

                    string checkDm10Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_10';";
                    using (var checkDm10Cmd = new SQLiteCommand(checkDm10Sql, conn))
                    {
                        long dm10Count = (long)checkDm10Cmd.ExecuteScalar();
                        if (dm10Count == 0)
                        {
                            string insertDm10Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_10', '第 10 題：第 2 型糖尿病常規定期監測項目', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 20, '/index.html?unit=dm&stage=10', '選項 1：肝、腎功能
選項 2：精神狀態
選項 3：肌肉量及肌力
選項 4：血脂肪、血壓 (正確答案)');";
                            using (var inDm10Cmd = new SQLiteCommand(insertDm10Sql, conn))
                            {
                                inDm10Cmd.ExecuteNonQuery();
                            }
                        }
                    }

                    string checkDm11Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_11';";
                    using (var checkDm11Cmd = new SQLiteCommand(checkDm11Sql, conn))
                    {
                        long dm11Count = (long)checkDm11Cmd.ExecuteScalar();
                        if (dm11Count == 0)
                        {
                            string insertDm11Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_11', '第 10 題：成年人糖尿病篩檢建議風險因子判定', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 22, '/index.html?unit=dm&stage=10', '選項 1：①②③
選項 2：①②⑤ (正確答案)
選項 3：②③④
選項 4：③④⑤');";
                            using (var inDm11Cmd = new SQLiteCommand(insertDm11Sql, conn))
                            {
                                inDm11Cmd.ExecuteNonQuery();
                            }
                        }
                    }

                    string checkDm12Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'DM_STAGE_12';";
                    using (var checkDm12Cmd = new SQLiteCommand(checkDm12Sql, conn))
                    {
                        long dm12Count = (long)checkDm12Cmd.ExecuteScalar();
                        if (dm12Count == 0)
                        {
                            string insertDm12Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_12', '第 11 題：升糖指數 (GI) 與食物血糖反應判定 (衛教餐桌)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 24, '/index.html?unit=dm&stage=11', '選項 1：早餐玉米片
選項 2：裸麥麵包 (正確答案)
選項 3：白米粥
選項 4：葡萄汁');";
                            using (var inDm12Cmd = new SQLiteCommand(insertDm12Sql, conn))
                            {
                                inDm12Cmd.ExecuteNonQuery();
                            }
                        }
                    }
                }

                // Ensure SUPPORT_STAGE_1 question exists (NG tube complications) under unit_support
                // Also remove any erroneous MUST_CASE_5
                using (var cleanMust5Cmd = new SQLiteCommand("DELETE FROM QRCodes WHERE ModuleCode = 'MUST_CASE_5';", conn))
                {
                    cleanMust5Cmd.ExecuteNonQuery();
                }

                string checkSupport1Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_1';";
                using (var checkSupport1Cmd = new SQLiteCommand(checkSupport1Sql, conn))
                {
                    long support1Count = (long)checkSupport1Cmd.ExecuteScalar();
                    if (support1Count == 0)
                    {
                        string insertSupport1Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_1', '第 1 題：生化管線異常排查 ‧ 鼻胃管常見合併症辨識 (NG-01)', '膳食療養學(一)', '2 營養支持.pptx', 10, '/index.html?unit=support&stage=1', '選項 1：(A) 胃食道逆流引發吸入性肺炎
選項 2：(B) 鼻黏膜損傷及出血
選項 3：(C) 胃潰瘍
選項 4：(D) 導管插入部位出現滲漏 (正確答案)');";
                        using (var inSupport1Cmd = new SQLiteCommand(insertSupport1Sql, conn))
                        {
                            inSupport1Cmd.ExecuteNonQuery();
                        }
                    }
                }

                string checkSupport2Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_2';";
                using (var checkSupport2Cmd = new SQLiteCommand(checkSupport2Sql, conn))
                {
                    long support2Count = (long)checkSupport2Cmd.ExecuteScalar();
                    if (support2Count == 0)
                    {
                        string insertSupport2Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_2', '第 2 題：重症吸入性肺炎防護處置 ‧ 降低 aspiration 風險 (NG灌食)', '膳食療養學(一)', '2 營養支持.pptx', 15, '/index.html?unit=support&stage=2', '選項 1：(A) 口腔清潔
選項 2：(B) 抬高頭部
選項 3：(C) 持續會厭下抽痰
選項 4：(D) 檢查胃殘餘量');";
                        using (var inSupport2Cmd = new SQLiteCommand(insertSupport2Sql, conn))
                        {
                            inSupport2Cmd.ExecuteNonQuery();
                        }
                    }
                }

                string checkSupport3Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_3';";
                using (var checkSupport3Cmd = new SQLiteCommand(checkSupport3Sql, conn))
                {
                    long support3Count = (long)checkSupport3Cmd.ExecuteScalar();
                    if (support3Count == 0)
                    {
                        string insertSupport3Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_3', '第 3 題：腸道營養支持路徑選擇之取決條件判定 (管灌路徑)', '膳食療養學(一)', '2 營養支持.pptx', 20, '/index.html?unit=support&stage=3', '選項 A：病人是否臥床
選項 B：是否計劃未來進行手術
選項 C：需要腸道營養支持的時間長度
選項 D：吸入性肺炎或餵食管移位的風險程度');";
                        using (var inSupport3Cmd = new SQLiteCommand(insertSupport3Sql, conn))
                        {
                            inSupport3Cmd.ExecuteNonQuery();
                        }
                    }
                }

                string checkSupport4Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_4';";
                using (var checkSupport4Cmd = new SQLiteCommand(checkSupport4Sql, conn))
                {
                    long count = (long)checkSupport4Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_4', '第 4 題：中風鼻胃管灌食熱量與配方評估', '膳食療養學(一)', '2 營養支持.pptx', 22, '/index.html?unit=support&stage=4', '選項 A：使用 continuous feeding 時，可用全濃度灌食不需要稀釋配方
選項 B：使用標準均衡配方（1 kcal/mL）時，每日需要提供 1,800 mL 才能達到熱量需要量
選項 C：灌食配方需有 2%至 4%的熱量來自 MCT（medium-chain triglycerides）oil 才能避免必需脂肪酸缺乏
選項 D：林先生水分的需要量每日約需 1,800~2,100 mL');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkSupport5Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_5';";
                using (var checkSupport5Cmd = new SQLiteCommand(checkSupport5Sql, conn))
                {
                    long count = (long)checkSupport5Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_5', '第 5 題：元素配方 (Elemental Formula) 組成分判定', '膳食療養學(一)', '2 營養支持.pptx', 25, '/index.html?unit=support&stage=5', '選項 A：casein 酪蛋白
選項 B：dipeptides 雙生肽
選項 C：MCT oil
選項 D：maltodextrin 麥芽糊精');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkSupport6Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_6';";
                using (var checkSupport6Cmd = new SQLiteCommand(checkSupport6Sql, conn))
                {
                    long count = (long)checkSupport6Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_6', '第 6 題：全靜脈營養 (TPN) 高濃糖中斷併發症評估', '膳食療養學(一)', '2 營養支持.pptx', 28, '/index.html?unit=support&stage=6', '選項 A：避免發生低血脂
選項 B：避免發生低血壓
選項 C：避免發生低血糖
選項 D：避免發生低血鈣');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkSupport7Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_7';";
                using (var checkSupport7Cmd = new SQLiteCommand(checkSupport7Sql, conn))
                {
                    long count = (long)checkSupport7Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_7', '第 7 題：放射性腸炎與吸收不良癌症灌食配方選擇', '膳食療養學(一)', '2 營養支持.pptx', 30, '/index.html?unit=support&stage=7', '選項 A：元素或預解配方
選項 B：低纖維聚合配方
選項 C：高水溶性纖維配方
選項 D：高蛋白濃縮配方');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkSupport8Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_8';";
                using (var checkSupport8Cmd = new SQLiteCommand(checkSupport8Sql, conn))
                {
                    long count = (long)checkSupport8Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_8', '第 8 題：再餵食症候群高風險辨識', '膳食療養學(一)', '2 營養支持.pptx', 33, '/index.html?unit=support&stage=8', '選項 1：原先營養狀態正常的嚴重外傷病人因病情及手術導致過去兩週幾無營養攝入，在開始灌食時也屬高風險族群 (正確答案)
選項 2：特別容易出現在接受高脂肪高熱量飲食的病人
選項 3：典型的表現為「三低一高」，包括低血磷、低血鉀、低血糖及高血鎂
選項 4：若發生再餵食症候群時，建議加快腸道或靜脈營養的給予速度，以矯正營養素的缺乏');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkSupport9Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_9';";
                using (var checkSupport9Cmd = new SQLiteCommand(checkSupport9Sql, conn))
                {
                    long count = (long)checkSupport9Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_9', '第 9 題：均衡管灌食配方辨識 (Polymeric Formula)', '膳食療養學(一)', '2 營養支持.pptx', 34, '/index.html?unit=support&stage=9', '選項 A：polymeric formula (正確答案)
選項 B：monomeric formula
選項 C：modular formula
選項 D：predigested formula');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string updateSupport9Sql = @"UPDATE QRCodes SET
                    UnitId = 'unit_support',
                    UnitTitle = '【單元二】營養支持',
                    UnitRoute = '/index.html?unit=support',
                    Title = '第 9 題：均衡管灌食配方辨識 (Polymeric Formula)',
                    CourseName = '膳食療養學(一)',
                    PptFile = '2 營養支持.pptx',
                    PptSlide = 34,
                    LocalRoute = '/index.html?unit=support&stage=9',
                    Description = '選項 A：polymeric formula (正確答案)
選項 B：monomeric formula
選項 C：modular formula
選項 D：predigested formula'
                    WHERE ModuleCode = 'SUPPORT_STAGE_9';";
                using (var updateSupport9Cmd = new SQLiteCommand(updateSupport9Sql, conn))
                {
                    updateSupport9Cmd.ExecuteNonQuery();
                }

                string checkSupport10Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_10';";
                using (var checkSupport10Cmd = new SQLiteCommand(checkSupport10Sql, conn))
                {
                    long count = (long)checkSupport10Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_10', '第 10 題：管灌腸道營養維持黏膜屏障與降低細菌轉位', '膳食療養學(一)', '2 營養支持.pptx', 35, '/index.html?unit=support&stage=10', '選項 1：口腔
選項 2：食道
選項 3：胃部
選項 4：腸子 (正確答案)');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkSupport11Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'SUPPORT_STAGE_11';";
                using (var checkSupport11Cmd = new SQLiteCommand(checkSupport11Sql, conn))
                {
                    long count = (long)checkSupport11Cmd.ExecuteScalar();
                    if (count == 0)
                    {
                        string insertSql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_11', '第 11 題：腸道營養與靜脈營養臨床效益評估', '膳食療養學(一)', '2 營養支持.pptx', 36, '/index.html?unit=support&stage=11', '選項 1：腸道營養較有助於保留小腸黏膜障蔽
選項 2：腸道營養較容易發生感染性併發症 (正確答案)
選項 3：腸道營養較能減少異化作用
選項 4：腸道營養較能節省醫療費用');";
                        using (var inCmd = new SQLiteCommand(insertSql, conn)) inCmd.ExecuteNonQuery();
                    }
                }

                string checkMust7Sql = "SELECT COUNT(*) FROM QRCodes WHERE ModuleCode = 'MUST_STAGE_7';";
                using (var checkMust7Cmd = new SQLiteCommand(checkMust7Sql, conn))
                {
                    long must7Count = (long)checkMust7Cmd.ExecuteScalar();
                    if (must7Count == 0)
                    {
                        string insertMust7Sql = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
                        ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'MUST_STAGE_7', '第 7 題：周代宮廷 ‧ 食醫的考驗（營養篩檢項目判定）', '膳食療養學(一)', '1 營養照顧流程.pptx', 15, '/index.html?unit=must&stage=7', '選項 1：體重改變
選項 2：BMI
選項 3：進食量
選項 4：藥物 (正確答案)');";
                        using (var inMust7Cmd = new SQLiteCommand(insertMust7Sql, conn))
                        {
                            inMust7Cmd.ExecuteNonQuery();
                        }
                    }
                }

                using (var normalizeCourseCmd = new SQLiteCommand(@"
                    INSERT OR IGNORE INTO Courses (CourseName) VALUES ('膳食療養學');
                    INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                    SELECT UnitId, UnitTitle, UnitRoute, '膳食療養學' FROM Units WHERE CourseName = '膳食療養學(一)';
                    UPDATE QRCodes SET CourseName = '膳食療養學' WHERE CourseName = '膳食療養學(一)';
                    DELETE FROM Units WHERE CourseName = '膳食療養學(一)';
                    DELETE FROM Courses WHERE CourseName = '膳食療養學(一)';", conn))
                {
                    normalizeCourseCmd.ExecuteNonQuery();
                }
                EnsureOptionsFormatted(conn);
                EnsureCurriculumUnits(conn);
                EnsureUnitThreeQuestions(conn);
                EnsureUnitSevenQuestions(conn);
            }
        }

        private static void EnsureCurriculumUnits(SQLiteConnection conn)
        {
            string[] unitTitles =
            {
                "【單元一 營養照顧流程】",
                "【單元二】營養支持",
                "【單元三】體重控制與管理",
                "【單元四】高血壓、高血脂症及心臟疾病之營養治療",
                "【單元五】消化道及肝、膽、胰臟疾病之營養治療",
                "【單元六】糖尿病之營養治療",
                "【單元七】腎臟疾病之營養治療",
                "【單元八】腫瘤與癌症之營養治療",
                "【單元九】生理壓力：手術、創傷、燒傷及敗血症之營養治療",
                "【單元十】肺部疾病之營養治療",
                "【單元十一】貧血之營養治療",
                "【單元十二】內分泌與新陳代謝疾病之營養治療",
                "【單元十三】小兒科之營養照護",
                "【單元十四】飲食、營養與藥物的交互作用",
                "【單元十五】人生好難題",
                "【單元十六】健檢報告判讀"
            };
            string[] unitIds =
            {
                "unit_must", "unit_support",
                "unit_curriculum_03", "unit_curriculum_04", "unit_curriculum_05", "unit_dm",
                "unit_curriculum_07", "unit_curriculum_08", "unit_curriculum_09", "unit_curriculum_10",
                "unit_curriculum_11", "unit_curriculum_12", "unit_curriculum_13", "unit_curriculum_14",
                "unit_life", "unit_bfbbb5"
            };
            string[] unitKeys =
            {
                "must", "support",
                "curriculum_03", "curriculum_04", "curriculum_05", "dm",
                "curriculum_07", "curriculum_08", "curriculum_09", "curriculum_10",
                "curriculum_11", "curriculum_12", "curriculum_13", "curriculum_14",
                "life", "unit_bfbbb5"
            };
            string[] legacyTitles =
            {
                null, null, null, null, null, "【單元三】糖尿病醫學營養治療",
                null, null, null, null, null, null, null, null,
                "【單元四】人生好難題 ‧ 校園生活特別篇", "【單元五】健檢報告判讀"
            };

            var courses = new List<string>();
            using (var cmd = new SQLiteCommand(@"
                SELECT CourseName FROM Courses
                UNION
                SELECT DISTINCT CourseName FROM QRCodes WHERE CourseName IS NOT NULL AND CourseName != '';", conn))
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    string course = reader["CourseName"].ToString();
                    if (!string.IsNullOrWhiteSpace(course) &&
                        !course.StartsWith(RemovedCourseName, StringComparison.OrdinalIgnoreCase) &&
                        !courses.Contains(course))
                        courses.Add(course);
                }
            }

            for (int courseIndex = 0; courseIndex < courses.Count; courseIndex++)
            {
                string course = courses[courseIndex];
                for (int i = 0; i < unitIds.Length; i++)
                {
                    string route = "/index.html?unit=" + unitKeys[i];
                    using (var upsertCourse = new SQLiteCommand("INSERT OR IGNORE INTO Courses (CourseName) VALUES (@CourseName);", conn))
                    {
                        upsertCourse.Parameters.AddWithValue("@CourseName", course);
                        upsertCourse.ExecuteNonQuery();
                    }
                    using (var upsertUnit = new SQLiteCommand(@"
                        INSERT OR IGNORE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                        VALUES (@UnitId, @UnitTitle, @UnitRoute, @CourseName);", conn))
                    {
                        upsertUnit.Parameters.AddWithValue("@UnitId", unitIds[i]);
                        upsertUnit.Parameters.AddWithValue("@UnitTitle", unitTitles[i]);
                        upsertUnit.Parameters.AddWithValue("@UnitRoute", route);
                        upsertUnit.Parameters.AddWithValue("@CourseName", course);
                        upsertUnit.ExecuteNonQuery();
                    }
                    if (!string.IsNullOrEmpty(legacyTitles[i]))
                    {
                        using (var migrateUnitTitle = new SQLiteCommand(@"
                            UPDATE Units SET UnitTitle = @UnitTitle, UnitRoute = @UnitRoute
                            WHERE UnitId = @UnitId AND CourseName = @CourseName AND UnitTitle = @LegacyTitle;
                            UPDATE QRCodes SET UnitTitle = @UnitTitle, UnitRoute = @UnitRoute
                            WHERE UnitId = @UnitId AND CourseName = @CourseName AND UnitTitle = @LegacyTitle;", conn))
                        {
                            migrateUnitTitle.Parameters.AddWithValue("@UnitId", unitIds[i]);
                            migrateUnitTitle.Parameters.AddWithValue("@UnitTitle", unitTitles[i]);
                            migrateUnitTitle.Parameters.AddWithValue("@UnitRoute", route);
                            migrateUnitTitle.Parameters.AddWithValue("@CourseName", course);
                            migrateUnitTitle.Parameters.AddWithValue("@LegacyTitle", legacyTitles[i]);
                            migrateUnitTitle.ExecuteNonQuery();
                        }
                    }
                }

                using (var syncUnitMetadata = new SQLiteCommand(@"
                    UPDATE QRCodes
                    SET UnitTitle = (
                            SELECT UnitTitle FROM Units
                            WHERE Units.UnitId = QRCodes.UnitId AND Units.CourseName = QRCodes.CourseName
                        ),
                        UnitRoute = (
                            SELECT UnitRoute FROM Units
                            WHERE Units.UnitId = QRCodes.UnitId AND Units.CourseName = QRCodes.CourseName
                        )
                    WHERE EXISTS (
                        SELECT 1 FROM Units
                        WHERE Units.UnitId = QRCodes.UnitId AND Units.CourseName = QRCodes.CourseName
                    );", conn))
                {
                    syncUnitMetadata.ExecuteNonQuery();
                }
            }
        }

        private static void EnsureUnitThreeQuestions(SQLiteConnection conn)
        {
            using (var delCmd = new SQLiteCommand("DELETE FROM QRCodes WHERE LOWER(UnitId) = 'unit_curriculum_03' AND ModuleCode NOT IN ('CURRICULUM_03_STAGE_1', 'CURRICULUM_03_STAGE_2', 'CURRICULUM_03_STAGE_3', 'CURRICULUM_03_STAGE_4', 'CURRICULUM_03_STAGE_5', 'CURRICULUM_03_STAGE_6');", conn))
            {
                delCmd.ExecuteNonQuery();
            }

            string[] titles =
            {
                "第 1 題：下列有關身體組成的敘述，何者錯誤？",
                "第 2 題：有關白色脂肪組織的敘述，下列何者錯誤？",
                "第 3 題：有關神經性厭食症（anorexia nervosa）病人的營養素需求，下列何者正確？",
                "第 4 題：有關暴食症（Bulimia）的診斷標準之敘述，下列何者正確？",
                "第 5 題：體重過輕仍然非常害怕變胖為下列何種飲食障礙的診斷依據之一？",
                "第 6 題：營養不良時，造成體液失衡及引起水腫是因為血中何種蛋白質下降？"
            };
            string[] descriptions =
            {
                "選項 A：體脂肪（fat mass）存在於腦、骨骼肌及脂肪組織\r\n選項 B：男性的瘦體組織（lean body mass）較女性多\r\n選項 C：一般而言，同年齡同性別之正常健康人，體組成中非體脂肪（fat free mass）之比例相似\r\n選項 D：非體脂肪（fat free mass）即是瘦體組織（lean body mass） (正確答案)",
                "選項 A：因含有 Carotene 顏色為淡黃色\r\n選項 B：可保護體內臟器避免碰撞傷害\r\n選項 C：提供新生兒產熱 (正確答案)\r\n選項 D：儲存三酸甘油酯",
                "選項 A：低體重病人常有維生素 B1 缺乏，再餵食（refeeding）階段需額外補充 (正確答案)\r\n選項 B：低體重病人血清 25-hydroxy vitamin D 濃度通常過高\r\n選項 C：因高胡蘿蔔素血症（hypercarotenemia），需限制病人類胡蘿蔔素的攝取\r\n選項 D：限鈉飲食（2 公克／天）對病人的水分滯留沒有幫助",
                "選項 A：個案重複發生暴食現象，在一段獨立時間內（如 2 小時）吃下很大量食物 (正確答案)\r\n選項 B：體重顯著下降，且對自己身材的纖瘦沒有感覺\r\n選項 C：個案常催吐、不當使用瀉劑或利尿劑，易造成貧血\r\n選項 D：個案常發生皮膚乾燥、營養不良等問題，應即時補充熱量與蛋白質等",
                "選項 A：bulimia nervosa\r\n選項 B：anorexia nervosa (正確答案)\r\n選項 C：binge-eating disorder\r\n選項 D：night eating syndrome",
                "選項 A：白蛋白 (正確答案)\r\n選項 B：角蛋白\r\n選項 C：鐵蛋白\r\n選項 D：球蛋白"
            };
            const string unitRoute = "/index.html?unit=curriculum_03";

            for (int i = 0; i < titles.Length; i++)
            {
                using (var cmd = new SQLiteCommand(@"
                    INSERT OR IGNORE INTO QRCodes
                        (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description)
                    VALUES
                        (@UnitId, @UnitTitle, @UnitRoute, @ModuleCode, @Title, @CourseName, '', @PptSlide, @LocalRoute, @Description);
                    UPDATE QRCodes
                    SET Title = @Title,
                        LocalRoute = @LocalRoute,
                        PptSlide = @PptSlide,
                        Description = @Description,
                        UnitId = @UnitId,
                        UnitTitle = @UnitTitle,
                        UnitRoute = @UnitRoute
                    WHERE ModuleCode = @ModuleCode;", conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", "unit_curriculum_03");
                    cmd.Parameters.AddWithValue("@UnitTitle", "【單元三】體重控制與管理");
                    cmd.Parameters.AddWithValue("@UnitRoute", unitRoute);
                    cmd.Parameters.AddWithValue("@ModuleCode", "CURRICULUM_03_STAGE_" + (i + 1));
                    cmd.Parameters.AddWithValue("@Title", titles[i]);
                    cmd.Parameters.AddWithValue("@CourseName", "膳食療養學");
                    cmd.Parameters.AddWithValue("@PptSlide", i + 1);
                    cmd.Parameters.AddWithValue("@LocalRoute", unitRoute + "&stage=" + (i + 1));
                    cmd.Parameters.AddWithValue("@Description", descriptions[i]);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        private static void EnsureUnitSevenQuestions(SQLiteConnection conn)
        {
            using (var delCmd = new SQLiteCommand("DELETE FROM QRCodes WHERE LOWER(UnitId) = 'unit_curriculum_07' AND ModuleCode NOT IN ('CURRICULUM_07_STAGE_1', 'CURRICULUM_07_STAGE_2', 'CURRICULUM_07_STAGE_3', 'CURRICULUM_07_STAGE_4', 'CURRICULUM_07_STAGE_5', 'CURRICULUM_07_STAGE_6');", conn))
            {
                delCmd.ExecuteNonQuery();
            }

            string[] titles =
            {
                "第 1 題：下列何者不是測量腎臟功能的常用參考指標？",
                "第 2 題：王小姐畢業後出國工作一直沒有追蹤腎功能，十年後返臺進行全身健康檢查發現 glomerular filtration rate 為 42 mL/min/1.73m2 、三個月後再追蹤仍為 40 mL/min/1.73m2，王小姐目前為 chronic kidney disease 的第幾期？",
                "第 3 題：王小姐身高 162 公分、體重 60 公斤，平日有健身重訓，在此階段，下列何飲食處方最不適合王小姐？",
                "第 4 題：慢性腎臟病 Stage 4 的病人不需要限制下列何種營養素的攝取？",
                "第 5 題：末期腎臟病（ESRD），與下列何種疾病最不相關？",
                "第 6 題：有關醫師評估透析病人乾體重（dry weight）的目的，下列何者錯誤？"
            };
            string[] descriptions =
            {
                "選項 A：尿液白蛋白排泄率（urinary albumin excretion rate）\r\n選項 B：血漿白蛋白濃度（plasma albumin concentration） (正確答案)\r\n選項 C：血漿菊糖清除率（clearance of inulin）\r\n選項 D：血漿肌酸酐清除率（clearance of creatinine）",
                "選項 A：G2\r\n選項 B：G3a\r\n選項 C：G3b (正確答案)\r\n選項 D：G4a",
                "選項 A：熱量 2,100 大卡、蛋白質 45 公克\r\n選項 B：熱量 2,100 大卡、蛋白質 36 公克\r\n選項 C：熱量 2,100 大卡、蛋白質 90 公克 (正確答案)\r\n選項 D：熱量 1,680 大卡、蛋白質 36 公克",
                "選項 A：鈣 (正確答案)\r\n選項 B：磷\r\n選項 C：鈉\r\n選項 D：鉀",
                "選項 A：糖尿病\r\n選項 B：高血壓\r\n選項 C：腎絲球腎炎\r\n選項 D：克隆氏症 (正確答案)",
                "選項 A：維持體內最佳體液容積\r\n選項 B：維持正常血壓\r\n選項 C：減少蛋白尿 (正確答案)\r\n選項 D：降低死亡率"
            };
            const string unitRoute = "/index.html?unit=curriculum_07";

            for (int i = 0; i < titles.Length; i++)
            {
                using (var cmd = new SQLiteCommand(@"
                    INSERT OR IGNORE INTO QRCodes
                        (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description)
                    VALUES
                        (@UnitId, @UnitTitle, @UnitRoute, @ModuleCode, @Title, @CourseName, '', @PptSlide, @LocalRoute, @Description);
                    UPDATE QRCodes
                    SET Title = @Title,
                        LocalRoute = @LocalRoute,
                        PptSlide = @PptSlide,
                        Description = @Description,
                        UnitId = @UnitId,
                        UnitTitle = @UnitTitle,
                        UnitRoute = @UnitRoute,
                        CourseName = @CourseName
                    WHERE ModuleCode = @ModuleCode;", conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", "unit_curriculum_07");
                    cmd.Parameters.AddWithValue("@UnitTitle", "【單元七】腎臟疾病之營養治療");
                    cmd.Parameters.AddWithValue("@UnitRoute", unitRoute);
                    cmd.Parameters.AddWithValue("@ModuleCode", "CURRICULUM_07_STAGE_" + (i + 1));
                    cmd.Parameters.AddWithValue("@Title", titles[i]);
                    cmd.Parameters.AddWithValue("@CourseName", "膳食療養學");
                    cmd.Parameters.AddWithValue("@PptSlide", i + 1);
                    cmd.Parameters.AddWithValue("@LocalRoute", unitRoute + "&stage=" + (i + 1));
                    cmd.Parameters.AddWithValue("@Description", descriptions[i]);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        private void EnsureOptionsFormatted(SQLiteConnection conn)
        {
            string sqlLife = @"UPDATE QRCodes SET Description = 
'選項 1：衝進教室，已經熱到像剛洗完澡般滿身大汗
選項 2：發現教授還沒來，慶幸不用記曠課好震撼
選項 3：回想熬夜寫完的兩萬字報告，意志力無比強悍
選項 4：結果發現今天是國定假日，留下一個大大的遺憾 (正確答案)'
WHERE ModuleCode = 'LIFE_STAGE_1' AND (Description NOT LIKE '%選項 1%' OR Description IS NULL);";
            using (var cmd = new SQLiteCommand(sqlLife, conn)) cmd.ExecuteNonQuery();

            string sqlMust1 = @"UPDATE QRCodes SET Description = 
'選項 1：BMI > 20 (計 0 分)
選項 2：BMI 介於 18.5 ~ 20 (計 1 分) (正確答案)
選項 3：BMI < 18.5 (計 2 分)'
WHERE ModuleCode = 'MUST_CASE_1';";
            using (var cmd = new SQLiteCommand(sqlMust1, conn)) cmd.ExecuteNonQuery();

            string sqlMust2 = @"UPDATE QRCodes SET Description = 
'選項 1：流失百分比 < 5% (計 0 分)
選項 2：流失百分比 5% ~ 10% (計 1 分)
選項 3：流失百分比 > 10% (計 2 分) (正確答案)'
WHERE ModuleCode = 'MUST_CASE_2';";
            using (var cmd = new SQLiteCommand(sqlMust2, conn)) cmd.ExecuteNonQuery();

            string sqlMust3 = @"UPDATE QRCodes SET Description = 
'選項 1：加0分
選項 2：加1分
選項 3：加2分 (正確答案)'
WHERE ModuleCode = 'MUST_CASE_3';";
            using (var cmd = new SQLiteCommand(sqlMust3, conn)) cmd.ExecuteNonQuery();

            string sqlMust4 = @"UPDATE QRCodes SET Description = 
'選項 1：0 分 低度風險 (Low Risk)
選項 2：1 分 中度風險 (Medium Risk)
選項 3：≧ 2 分 高度風險 (High Risk) (正確答案)'
WHERE ModuleCode = 'MUST_CASE_4';";
            using (var cmd = new SQLiteCommand(sqlMust4, conn)) cmd.ExecuteNonQuery();

            string sqlSupport1 = @"UPDATE QRCodes SET 
UnitId = 'unit_support',
UnitTitle = '【單元二】營養支持',
UnitRoute = '/index.html?unit=support',
LocalRoute = '/index.html?unit=support&stage=1',
Title = '第 1 題：生化管線異常排查 ‧ 鼻胃管常見合併症辨識 (NG-01)',
Description = 
'選項 1：胃食道逆流引發吸入性肺炎
選項 2：鼻黏膜損傷及出血
選項 3：胃潰瘍
選項 4：導管插入部位出現滲漏 (正確答案)'
WHERE ModuleCode = 'SUPPORT_STAGE_1';";
            using (var cmd = new SQLiteCommand(sqlSupport1, conn)) cmd.ExecuteNonQuery();

            string sqlSupport2 = @"UPDATE QRCodes SET 
UnitId = 'unit_support',
UnitTitle = '【單元二】營養支持',
UnitRoute = '/index.html?unit=support',
LocalRoute = '/index.html?unit=support&stage=2',
Title = '第 2 題：重症吸入性肺炎防護處置 ‧ 趙仁傑 主治醫師 (降低 aspiration 風險)',
Description = 
'選項 1：口腔清潔
選項 2：抬高頭部
選項 3：持續會厭下抽痰
選項 4：檢查胃殘餘量 (正確答案)'
WHERE ModuleCode = 'SUPPORT_STAGE_2';";
            using (var cmd = new SQLiteCommand(sqlSupport2, conn)) cmd.ExecuteNonQuery();

            string sqlNcp1 = @"UPDATE QRCodes SET Description = 
'選項 1：①②③⑤ (正確答案)
選項 2：①②④⑤
選項 3：①③④⑤
選項 4：②③④⑤'
WHERE ModuleCode = 'NCP_STAGE_1' AND (Description NOT LIKE '%選項 1%' OR Description IS NULL);";
            using (var cmd = new SQLiteCommand(sqlNcp1, conn)) cmd.ExecuteNonQuery();

            string sqlNcp2 = @"UPDATE QRCodes SET Description = 
'選項 1：以系統性蒐集、驗證、解釋數據釐清營養相關問題的是營養診斷（Nutrition Diagnosis） (正確答案)
選項 2：營養評估（Nutrition Assessment）的目的是決定個案有一個或多個營養相關的問題
選項 3：營養照護步驟的第二步驟為包含 PES 的營養診斷
選項 4：食物相關的歷史、營養相關的歷史、體位測量都是營養評估的資料蒐集類別'
WHERE ModuleCode = 'NCP_STAGE_2' AND (Description NOT LIKE '%選項 1%' OR Description IS NULL);";
            using (var cmd = new SQLiteCommand(sqlNcp2, conn)) cmd.ExecuteNonQuery();

            string sqlDm1 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=1',
PptSlide = 5,
Title = '第 1 題：第 1 型糖尿病主要病因機轉判定 (T1DM)',
Description = 
'選項 1：飲食不當與久坐
選項 2：胰島素分泌上升
選項 3：胰島素抗性
選項 4：自體抗體攻擊胰島細胞 (正確答案)'
WHERE ModuleCode = 'DM_STAGE_1';";
            using (var cmd = new SQLiteCommand(sqlDm1, conn)) cmd.ExecuteNonQuery();

            string sqlDm2 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=2',
PptSlide = 8,
Title = '第 2 題：""糖尿病""的糖化血色素 (HbA1c) 診斷標準切點 (黑炎魔龍討伐戰)',
Description = 
'選項 1：HbA1c ≥ 6.5% (正確答案)
選項 2：HbA1c ≥ 6.0%
選項 3：HbA1c ≥ 7.0%
選項 4：HbA1c ≥ 5.7%'
WHERE ModuleCode = 'DM_STAGE_2';";
            using (var cmd = new SQLiteCommand(sqlDm2, conn)) cmd.ExecuteNonQuery();

            string sqlMust7 = @"UPDATE QRCodes SET 
UnitId = 'unit_must',
UnitTitle = '【單元一 營養照顧流程】',
UnitRoute = '/index.html?unit=must',
LocalRoute = '/index.html?unit=must&stage=7',
PptSlide = 15,
Title = '第 7 題：周代宮廷 ‧ 食醫的考驗（營養篩檢項目判定）',
Description = 
'選項 1：體重改變
選項 2：BMI
選項 3：進食量
選項 4：藥物 (正確答案)'
WHERE ModuleCode = 'MUST_STAGE_7';";
            using (var cmd = new SQLiteCommand(sqlMust7, conn)) cmd.ExecuteNonQuery();

            string sqlSupport3 = @"UPDATE QRCodes SET 
UnitId = 'unit_support',
UnitTitle = '【單元二】營養支持',
UnitRoute = '/index.html?unit=support',
LocalRoute = '/index.html?unit=support&stage=3',
PptSlide = 20,
Title = '第 3 題：腸道營養支持路徑選擇之取決條件判定 (管灌路徑)',
Description = 
'選項 1：病人是否臥床 (正確答案)
選項 2：是否計劃未來進行手術
選項 3：需要腸道營養支持的時間長度
選項 4：吸入性肺炎或餵食管移位的風險程度'
WHERE ModuleCode = 'SUPPORT_STAGE_3';";
            using (var cmd = new SQLiteCommand(sqlSupport3, conn)) cmd.ExecuteNonQuery();

            string sqlSupport6 = @"UPDATE QRCodes SET 
UnitId = 'unit_support',
UnitTitle = '【單元二】營養支持',
UnitRoute = '/index.html?unit=support',
LocalRoute = '/index.html?unit=support&stage=6',
PptSlide = 28,
Title = '第 6 題：全靜脈營養 (TPN) 高濃糖中斷併發症評估',
Description = 
'選項 A：避免發生低血鈣
選項 B：避免發生低血脂
選項 C：避免發生低血壓
選項 D：避免發生低血糖 (正確答案)'
WHERE ModuleCode = 'SUPPORT_STAGE_6';";
            using (var cmd = new SQLiteCommand(sqlSupport6, conn)) cmd.ExecuteNonQuery();

            string sqlDm3 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=3',
PptSlide = 12,
Title = '第 3 題：空腹血漿血糖 (FPG) 臨床診斷標準 (晨曦冰壁 冰晶巨神兵)',
Description = 
'選項 1：FPG ≥ 100 mg/dL
選項 2：FPG ≥ 110 mg/dL
選項 3：FPG ≥ 126 mg/dL (正確答案)
選項 4：FPG ≥ 140 mg/dL'
WHERE ModuleCode = 'DM_STAGE_3';";
            using (var cmd = new SQLiteCommand(sqlDm3, conn)) cmd.ExecuteNonQuery();

            string sqlDm4 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=4',
PptSlide = 15,
Title = '第 4 題：口服葡萄糖耐受試驗 (75g OGTT) 2小時診斷標準 (深淵糖沼 晶化毒蠍魔君)',
Description = 
'選項 1：OGTT 2小時 ≥ 140 mg/dL
選項 2：OGTT 2小時 ≥ 160 mg/dL
選項 3：OGTT 2小時 ≥ 180 mg/dL
選項 4：OGTT 2小時 ≥ 200 mg/dL (正確答案)'
WHERE ModuleCode = 'DM_STAGE_4';";
            using (var cmd = new SQLiteCommand(sqlDm4, conn)) cmd.ExecuteNonQuery();

            string sqlDm5 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=5',
PptSlide = 11,
Title = '第 5 題：隨機血漿血糖與高血糖典型診斷標準 (雷霆荒野 狂暴雷狼魔)',
Description = 
'選項 1：隨機血糖 ≥ 140 mg/dL
選項 2：隨機血糖 ≥ 160 mg/dL
選項 3：隨機血糖 ≥ 180 mg/dL
選項 4：隨機血糖 ≥ 200 mg/dL 伴隨典型高血糖症狀 (正確答案)'
WHERE ModuleCode = 'DM_STAGE_5';";
            using (var cmd = new SQLiteCommand(sqlDm5, conn)) cmd.ExecuteNonQuery();

            string sqlDm7 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=6',
PptSlide = 15,
Title = '第 6 題：糖尿病個人血糖控制之長期指標判定',
Description = 
'選項 1：HbA1c (正確答案)
選項 2：空腹血糖
選項 3：飯後血糖
選項 4：OGTT'
WHERE ModuleCode = 'DM_STAGE_7';";
            using (var cmd = new SQLiteCommand(sqlDm7, conn)) cmd.ExecuteNonQuery();

            string sqlDm8 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=7',
PptSlide = 16,
Title = '第 7 題：第 2 型糖尿病致病機轉與胰島素阻抗相關特徵',
Description = 
'選項 1：飯後高血糖
選項 2：血液中胰島素濃度增加
選項 3：產生酮酸中毒 (正確答案)
選項 4：血液中游離脂肪酸濃度增加'
WHERE ModuleCode = 'DM_STAGE_8';";
            using (var cmd = new SQLiteCommand(sqlDm8, conn)) cmd.ExecuteNonQuery();

            string sqlDm9 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=8',
PptSlide = 18,
Title = '第 8 題：【魔導能量儀・核心共鳴】估計平均血糖值（eAG）換算',
Description = 
'選項 1：139 mg/dL
選項 2：183 mg/dL
選項 3：212 mg/dL (正確答案)
選項 4：251 mg/dL'
WHERE ModuleCode = 'DM_STAGE_9';";
            using (var cmd = new SQLiteCommand(sqlDm9, conn)) cmd.ExecuteNonQuery();

            string sqlDm10 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=9',
PptSlide = 20,
Title = '第 9 題：第 2 型糖尿病常規定期監測項目',
Description = 
'選項 1：肝、腎功能
選項 2：精神狀態
選項 3：肌肉量及肌力
選項 4：血脂肪、血壓 (正確答案)'
WHERE ModuleCode = 'DM_STAGE_10';";
            using (var cmd = new SQLiteCommand(sqlDm10, conn)) cmd.ExecuteNonQuery();

            string sqlDm11 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=10',
PptSlide = 22,
Title = '第 10 題：成年人糖尿病篩檢建議風險因子判定',
Description = 
'選項 1：①②③
選項 2：①②⑤ (正確答案)
選項 3：②③④
選項 4：③④⑤'
WHERE ModuleCode = 'DM_STAGE_11';";
            using (var cmd = new SQLiteCommand(sqlDm11, conn)) cmd.ExecuteNonQuery();

            string sqlDm12 = @"UPDATE QRCodes SET 
UnitId = 'unit_dm',
UnitTitle = '【單元三】糖尿病醫學營養治療',
UnitRoute = '/index.html?unit=dm',
LocalRoute = '/index.html?unit=dm&stage=11',
PptSlide = 24,
Title = '第 11 題：升糖指數 (GI) 與食物血糖反應判定 (衛教餐桌)',
Description = 
'選項 1：早餐玉米片
選項 2：白米粥
選項 3：裸麥麵包 (正確答案)
選項 4：葡萄汁'
WHERE ModuleCode = 'DM_STAGE_12';";
            using (var cmd = new SQLiteCommand(sqlDm12, conn)) cmd.ExecuteNonQuery();

            string sqlDm6 = @"UPDATE QRCodes SET 
UnitId = 'unit_bfbbb5',
UnitTitle = '【單元五】健檢報告判讀',
UnitRoute = '/index.html?unit=unit_bfbbb5',
LocalRoute = '/index.html?unit=unit_bfbbb5&stage=1',
PptSlide = 12,
Title = '第 1 題：【個案判讀】健檢報告判讀：陳先生 (48歲) 代謝異常',
Description = 
'選項 1：確診第 2 型糖尿病，並合併高三酸甘油酯血症 (正確答案)
選項 2：僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準
選項 3：屬於第 1 型糖尿病，必須立即終生注射胰島素
選項 4：各項血糖數值皆在正常安全範圍，無代謝異常問題'
WHERE ModuleCode = 'DM_STAGE_6';";
            using (var cmd = new SQLiteCommand(sqlDm6, conn)) cmd.ExecuteNonQuery();
        }

        private void EnsureColumnExists(SQLiteConnection conn, string table, string column, string colDef)
        {
            try
            {
                using (var cmd = new SQLiteCommand(string.Format("ALTER TABLE {0} ADD COLUMN {1} {2};", table, column, colDef), conn))
                {
                    cmd.ExecuteNonQuery();
                }
            }
            catch
            {
                // Column already exists
            }
        }

        private void InsertSeedData(SQLiteConnection conn)
        {
            string insertSql = @"
            INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) VALUES
            -- 【單元一】營養照顧流程
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'MUST_CASE_1', '第 1 題：【臨床個案快篩實戰】302床 林奶奶 MUST 臨床營養評估 (全 4 關)', '膳食療養學(一)', '1 營養照顧流程.pptx', 5, '/index.html?unit=must&stage=1', '選項 1：BMI > 20 (計 0 分)
選項 2：BMI 介於 18.5 ~ 20 (計 1 分) (正確答案)
選項 3：BMI < 18.5 (計 2 分)'),
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'MUST_CASE_2', '第 2 題 ‧ 非計畫性體重流失評估', '膳食療養學(一)', '1 營養照顧流程.pptx', 6, '/index.html?unit=must&stage=2', '選項 1：流失百分比 < 5% (計 0 分)
選項 2：流失百分比 5% ~ 10% (計 1 分)
選項 3：流失百分比 > 10% (計 2 分) (正確答案)'),
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'MUST_CASE_3', '第 3 題 ‧ 急性疾病禁食影響評估', '膳食療養學(一)', '1 營養照顧流程.pptx', 7, '/index.html?unit=must&stage=3', '選項 1：常規照護無特殊營養耗損 (加 0 分)
選項 2：重大手術且禁食 > 5天 (給予加分) (加 2 分) (正確答案)
選項 3：輕微禁食 1-2 天 (加 1 分)'),
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'MUST_CASE_4', '第 4 題 ‧ MUST 總分與風險等級判定', '膳食療養學(一)', '1 營養照顧流程.pptx', 8, '/index.html?unit=must&stage=4', '選項 1：0 分 低度風險 (Low Risk)
選項 2：1 分 中度風險 (Medium Risk)
選項 3：≧ 2 分 高度風險 (High Risk) (正確答案)'),
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'NCP_STAGE_1', '第 5 題：照護流程 (NCP) 四大核心步驟判定 (單元二)', '膳食療養學(一)', '1 營養照顧流程.pptx', 8, '/index.html?unit=must&stage=5', '選項 1：①②③⑤ (正確答案)
選項 2：①②④⑤
選項 3：①③④⑤
選項 4：②③④⑤'),
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'NCP_STAGE_2', '第 6 題：照護步驟 (NCP) 觀念檢核與挑錯 (核心定義)', '膳食療養學(一)', '1 營養照顧流程.pptx', 12, '/index.html?unit=must&stage=6', '選項 1：以系統性蒐集、驗證、解釋數據釐清營養相關問題的是營養診斷（Nutrition Diagnosis） (正確答案)
選項 2：營養評估（Nutrition Assessment）的目的是決定個案有一個或多個營養相關的問題
選項 3：營養照護步驟的第二步驟為包含 PES 的營養診斷
選項 4：食物相關的歷史、營養相關的歷史、體位測量都是營養評估的資料蒐集類別'),
            ('unit_must', '【單元一 營養照顧流程】', '/index.html?unit=must', 'MUST_STAGE_7', '第 7 題：周代宮廷 ‧ 食醫的考驗（營養篩檢項目判定）', '膳食療養學(一)', '1 營養照顧流程.pptx', 15, '/index.html?unit=must&stage=7', '選項 1：體重改變
選項 2：BMI
選項 3：進食量
選項 4：藥物 (正確答案)'),

            -- 【單元二】營養支持
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_1', '第 1 題：生化管線異常排查 ‧ 鼻胃管常見合併症辨識 (NG-01)', '膳食療養學(一)', '2 營養支持.pptx', 10, '/index.html?unit=support&stage=1', '選項 1：胃食道逆流引發吸入性肺炎
選項 2：鼻黏膜損傷及出血
選項 3：胃潰瘍
選項 4：導管插入部位出現滲漏 (正確答案)'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_2', '第 2 題：重症吸入性肺炎防護處置 ‧ 降低 aspiration 風險 (NG灌食)', '膳食療養學(一)', '2 營養支持.pptx', 15, '/index.html?unit=support&stage=2', '選項 1：口腔清潔
選項 2：抬高頭部
選項 3：持續會厭下抽痰
選項 4：檢查胃殘餘量'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_3', '第 3 題：腸道營養支持路徑選擇之取決條件判定 (管灌路徑)', '膳食療養學(一)', '2 營養支持.pptx', 20, '/index.html?unit=support&stage=3', '選項 A：病人是否臥床
選項 B：是否計劃未來進行手術
選項 C：需要腸道營養支持的時間長度
選項 D：吸入性肺炎或餵食管移位的風險程度'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_4', '第 4 題：中風鼻胃管灌食熱量與配方評估', '膳食療養學(一)', '2 營養支持.pptx', 22, '/index.html?unit=support&stage=4', '選項 A：使用 continuous feeding 時，可用全濃度灌食不需要稀釋配方
選項 B：使用標準均衡配方（1 kcal/mL）時，每日需要提供 1,800 mL 才能達到熱量需要量
選項 C：灌食配方需有 2%至 4%的熱量來自 MCT（medium-chain triglycerides）oil 才能避免必需脂肪酸缺乏
選項 D：林先生水分的需要量每日約需 1,800~2,100 mL'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_5', '第 5 題：元素配方 (Elemental Formula) 組成分判定', '膳食療養學(一)', '2 營養支持.pptx', 25, '/index.html?unit=support&stage=5', '選項 A：casein 酪蛋白
選項 B：dipeptides 雙生肽
選項 C：MCT oil
選項 D：maltodextrin 麥芽糊精'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_6', '第 6 題：全靜脈營養 (TPN) 高濃糖中斷併發症評估', '膳食療養學(一)', '2 營養支持.pptx', 28, '/index.html?unit=support&stage=6', '選項 A：避免發生低血脂
選項 B：避免發生低血壓
選項 C：避免發生低血糖
選項 D：避免發生低血鈣'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_7', '第 7 題：放射性腸炎與吸收不良癌症灌食配方選擇', '膳食療養學(一)', '2 營養支持.pptx', 30, '/index.html?unit=support&stage=7', '選項 A：元素或預解配方
選項 B：低纖維聚合配方
選項 C：高水溶性纖維配方
選項 D：高蛋白濃縮配方'),
            ('unit_support', '【單元二】營養支持', '/index.html?unit=support', 'SUPPORT_STAGE_8', '第 8 題：再餵食症候群高風險辨識', '膳食療養學(一)', '2 營養支持.pptx', 33, '/index.html?unit=support&stage=8', '選項 1：原先營養狀態正常的嚴重外傷病人因病情及手術導致過去兩週幾無營養攝入，在開始灌食時也屬高風險族群 (正確答案)
選項 2：特別容易出現在接受高脂肪高熱量飲食的病人
選項 3：典型的表現為「三低一高」，包括低血磷、低血鉀、低血糖及高血鎂
選項 4：若發生再餵食症候群時，建議加快腸道或靜脈營養的給予速度，以矯正營養素的缺乏'),

            -- 【單元三】糖尿病醫學營養治療
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_1', '第 1 題：第 1 型糖尿病主要病因機轉判定 (T1DM)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 5, '/index.html?unit=dm&stage=1', '選項 1：飲食不當與久坐
選項 2：胰島素分泌上升
選項 3：胰島素抗性
選項 4：自體抗體攻擊胰島細胞 (正確答案)'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_2', '第 2 題：""糖尿病""的糖化血色素 (HbA1c) 診斷標準切點 (黑炎魔龍討伐戰)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 8, '/index.html?unit=dm&stage=2', '選項 1：HbA1c ≥ 6.5% (正確答案)
選項 2：HbA1c ≥ 6.0%
選項 3：HbA1c ≥ 7.0%
選項 4：HbA1c ≥ 5.7%'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_3', '第 3 題：空腹血漿血糖 (FPG) 臨床診斷標準 (晨曦冰壁 冰晶巨神兵)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 12, '/index.html?unit=dm&stage=3', '選項 1：FPG ≥ 100 mg/dL
選項 2：FPG ≥ 110 mg/dL
選項 3：FPG ≥ 126 mg/dL (正確答案)
選項 4：FPG ≥ 140 mg/dL'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_4', '第 4 題：口服葡萄糖耐受試驗 (75g OGTT) 2小時診斷標準 (深淵糖沼 晶化毒蠍魔君)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 15, '/index.html?unit=dm&stage=4', '選項 1：OGTT 2小時 ≥ 140 mg/dL
選項 2：OGTT 2小時 ≥ 160 mg/dL
選項 3：OGTT 2小時 ≥ 180 mg/dL
選項 4：OGTT 2小時 ≥ 200 mg/dL (正確答案)'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_5', '第 5 題：隨機血漿血糖與高血糖典型診斷標準 (雷霆荒野 狂暴雷狼魔)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 11, '/index.html?unit=dm&stage=5', '選項 1：隨機血糖 ≥ 140 mg/dL
選項 2：隨機血糖 ≥ 160 mg/dL
選項 3：隨機血糖 ≥ 180 mg/dL
選項 4：隨機血糖 ≥ 200 mg/dL 伴隨典型高血糖症狀 (正確答案)'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_7', '第 6 題：糖尿病個人血糖控制之長期指標判定', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 15, '/index.html?unit=dm&stage=6', '選項 1：HbA1c (正確答案)
選項 2：空腹血糖
選項 3：飯後血糖
選項 4：OGTT'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_8', '第 7 題：第 2 型糖尿病致病機轉與胰島素阻抗相關特徵', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 16, '/index.html?unit=dm&stage=7', '選項 1：飯後高血糖
選項 2：血液中胰島素濃度增加
選項 3：產生酮酸中毒 (正確答案)
選項 4：血液中游離脂肪酸濃度增加'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_9', '第 8 題：【魔導能量儀・核心共鳴】估計平均血糖值（eAG）換算', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 18, '/index.html?unit=dm&stage=8', '選項 1：139 mg/dL
選項 2：183 mg/dL
選項 3：212 mg/dL (正確答案)
選項 4：251 mg/dL'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_10', '第 9 題：第 2 型糖尿病常規定期監測項目', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 20, '/index.html?unit=dm&stage=9', '選項 1：肝、腎功能
選項 2：精神狀態
選項 3：肌肉量及肌力
選項 4：血脂肪、血壓 (正確答案)'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_11', '第 10 題：成年人糖尿病篩檢建議風險因子判定', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 22, '/index.html?unit=dm&stage=10', '選項 1：①②③
選項 2：①②⑤ (正確答案)
選項 3：②③④
選項 4：③④⑤'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_12', '第 11 題：升糖指數 (GI) 與食物血糖反應判定 (衛教餐桌)', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 24, '/index.html?unit=dm&stage=11', '選項 1：早餐玉米片
選項 2：裸麥麵包 (正確答案)
選項 3：白米粥
選項 4：葡萄汁'),
            ('unit_dm', '【單元三】糖尿病醫學營養治療', '/index.html?unit=dm', 'DM_STAGE_13', '第 12 題：夜間血糖偵探 × 醫療冒險', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 26, '/index.html?unit=dm&stage=12', '選項 1：梭莫基效應（Somogyi effect）：夜間低血糖誘發昇糖素與皮質醇反彈升高 (正確答案)
選項 2：黎明現象（Dawn phenomenon）：清晨生長激素分泌導致生理性胰島素抗性
選項 3：夜間暴食反應（Night binge eating）：半夜夢遊攝取高碳水化合物
選項 4：胰島素耗竭（Insulin exhaustion）：凌晨胰島細胞永久功能停止'),

            -- 【單元四】人生好難題
            ('unit_life', '【單元四】人生好難題 ‧ 校園生活特別篇', '/index.html?unit=life', 'LIFE_STAGE_1', '第 1 題：【人生好難題】在南台灣艷陽下騎車趕早八，抵達教室的瞬間？', '膳食療養學(一)', '校園生活篇.pptx', 1, '/index.html?unit=life&stage=1', '選項 1：衝進教室，已經熱到像剛洗完澡般滿身大汗
選項 2：發現教授還沒來，慶幸不用記曠課好震撼
選項 3：回想熬夜寫完的兩萬字報告，意志力無比強悍
選項 4：結果發現今天是國定假日，留下一個大大的遺憾 (正確答案)'),

            -- 【單元五】健檢報告判讀 (陳先生)
            ('unit_bfbbb5', '【單元五】健檢報告判讀', '/index.html?unit=unit_bfbbb5', 'DM_STAGE_6', '第 1 題：【個案判讀】健檢報告判讀：陳先生 (48歲) 代謝異常', '膳食療養學(一)', '2 糖尿病醫學營養治療.pptx', 12, '/index.html?unit=unit_bfbbb5&stage=1', '選項 1：確診第 2 型糖尿病，並合併高三酸甘油酯血症 (正確答案)
選項 2：僅為糖尿病前期（耐糖不良），尚未達糖尿病診斷標準
選項 3：屬於第 1 型糖尿病，必須立即終生注射胰島素
選項 4：各項血糖數值皆在正常安全範圍，無代謝異常問題');";

            using (var cmd = new SQLiteCommand(insertSql, conn))
            {
                cmd.ExecuteNonQuery();
            }
        }

        public static int GetUnitOrder(string unitTitle, string unitId)
        {
            if (string.IsNullOrEmpty(unitTitle)) unitTitle = "";
            if (string.IsNullOrEmpty(unitId)) unitId = "";

            var m = System.Text.RegularExpressions.Regex.Match(unitTitle, @"(?:單元|Unit)\s*([0-9]+|[一二三四五六七八九十]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (m.Success)
            {
                int n;
                if (int.TryParse(m.Groups[1].Value, out n)) return n;
                string[] chineseNumbers = { "", "一", "二", "三", "四", "五", "六", "七", "八", "九" };
                string chinese = m.Groups[1].Value;
                if (chinese == "十") return 10;
                if (chinese.StartsWith("十") && chinese.Length == 2)
                {
                    int ones = Array.IndexOf(chineseNumbers, chinese.Substring(1));
                    if (ones > 0) return 10 + ones;
                }
                if (chinese.EndsWith("十") && chinese.Length == 2)
                {
                    int tens = Array.IndexOf(chineseNumbers, chinese.Substring(0, 1));
                    if (tens > 0) return tens * 10;
                }
                int single = Array.IndexOf(chineseNumbers, chinese);
                if (single > 0) return single;
            }

            if (unitId.IndexOf("must", StringComparison.OrdinalIgnoreCase) >= 0) return 1;
            if (unitId.IndexOf("support", StringComparison.OrdinalIgnoreCase) >= 0 ||
                unitId.IndexOf("ncp", StringComparison.OrdinalIgnoreCase) >= 0) return 2;
            if (unitId.IndexOf("dm", StringComparison.OrdinalIgnoreCase) >= 0) return 6;
            if (unitId.IndexOf("life", StringComparison.OrdinalIgnoreCase) >= 0) return 15;
            if (unitId.IndexOf("bfbbb5", StringComparison.OrdinalIgnoreCase) >= 0) return 16;
            return 999;
        }

        public static int GetStageFromRouteOrTitle(string route, string title)
        {
            if (!string.IsNullOrEmpty(title))
            {
                var m = System.Text.RegularExpressions.Regex.Match(title, @"(?:第\s*(\d+)\s*題|第\s*(\d+)\s*關)");
                if (m.Success)
                {
                    string numStr = !string.IsNullOrEmpty(m.Groups[1].Value) ? m.Groups[1].Value : m.Groups[2].Value;
                    int s;
                    if (int.TryParse(numStr, out s)) return s;
                }
            }
            if (!string.IsNullOrEmpty(route))
            {
                var m = System.Text.RegularExpressions.Regex.Match(route, @"stage=(\d+)");
                if (m.Success)
                {
                    int s;
                    if (int.TryParse(m.Groups[1].Value, out s)) return s;
                }
            }
            return 999;
        }

        private static void ApplyCurriculum03DisplayOrder(List<TeachingModule> modules)
        {
            // Unit 3 stages 1-5 (身體組成、白色脂肪組織、神經性厭食症、暴食症、飲食障礙) are already sequentially sorted
        }

        public List<TeachingModule> GetAllModules(string courseFilter = null)
        {
            var list = new List<TeachingModule>();
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = string.IsNullOrEmpty(courseFilter) || courseFilter == "🌟 所有科目" || courseFilter == "所有科目"
                    ? "SELECT * FROM QRCodes;"
                    : "SELECT * FROM QRCodes WHERE CourseName = @CourseName;";

                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    if (!string.IsNullOrEmpty(courseFilter) && courseFilter != "🌟 所有科目" && courseFilter != "所有科目")
                    {
                        cmd.Parameters.AddWithValue("@CourseName", courseFilter);
                    }
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(new TeachingModule
                            {
                                Id = Convert.ToInt32(reader["Id"]),
                                UnitId = reader["UnitId"] != DBNull.Value ? reader["UnitId"].ToString() : "unit_must",
                                UnitTitle = reader["UnitTitle"] != DBNull.Value ? reader["UnitTitle"].ToString() : "單元",
                                UnitRoute = reader["UnitRoute"] != DBNull.Value ? reader["UnitRoute"].ToString() : "/index.html?unit=must",
                                ModuleCode = reader["ModuleCode"].ToString(),
                                Title = reader["Title"].ToString(),
                                CourseName = reader["CourseName"].ToString(),
                                PptFile = reader["PptFile"] != DBNull.Value ? reader["PptFile"].ToString() : "",
                                PptSlide = reader["PptSlide"] != DBNull.Value ? Convert.ToInt32(reader["PptSlide"]) : 1,
                                LocalRoute = reader["LocalRoute"].ToString(),
                                Description = reader["Description"] != DBNull.Value ? reader["Description"].ToString() : ""
                            });
                        }
                    }
                }
            }

            ApplyCurriculum03DisplayOrder(list);
            list.Sort(delegate(TeachingModule a, TeachingModule b)
            {
                int ordA = GetUnitOrder(a.UnitTitle, a.UnitId);
                int ordB = GetUnitOrder(b.UnitTitle, b.UnitId);
                if (ordA != ordB) return ordA.CompareTo(ordB);

                int stA = GetStageFromRouteOrTitle(a.LocalRoute, a.Title);
                int stB = GetStageFromRouteOrTitle(b.LocalRoute, b.Title);
                if (stA != stB) return stA.CompareTo(stB);

                if (a.PptSlide != b.PptSlide) return a.PptSlide.CompareTo(b.PptSlide);
                return a.Id.CompareTo(b.Id);
            });

            return list;
        }

        public void ReorderModuleInUnit(int moduleId, int newStage)
        {
            if (newStage < 1) newStage = 1;
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string unitId = "";
                using (var getUnitCmd = new SQLiteCommand("SELECT UnitId FROM QRCodes WHERE Id = @Id;", conn))
                {
                    getUnitCmd.Parameters.AddWithValue("@Id", moduleId);
                    var u = getUnitCmd.ExecuteScalar();
                    if (u != null) unitId = u.ToString();
                }
                if (string.IsNullOrEmpty(unitId)) return;

                var modulesInUnit = new List<TeachingModule>();
                using (var getListCmd = new SQLiteCommand("SELECT * FROM QRCodes WHERE UnitId = @UnitId ORDER BY Id ASC;", conn))
                {
                    getListCmd.Parameters.AddWithValue("@UnitId", unitId);
                    using (var reader = getListCmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            modulesInUnit.Add(new TeachingModule
                            {
                                Id = Convert.ToInt32(reader["Id"]),
                                UnitId = reader["UnitId"].ToString(),
                                UnitTitle = reader["UnitTitle"].ToString(),
                                UnitRoute = reader["UnitRoute"].ToString(),
                                ModuleCode = reader["ModuleCode"].ToString(),
                                Title = reader["Title"].ToString(),
                                CourseName = reader["CourseName"].ToString(),
                                PptFile = reader["PptFile"] != DBNull.Value ? reader["PptFile"].ToString() : "",
                                PptSlide = reader["PptSlide"] != DBNull.Value ? Convert.ToInt32(reader["PptSlide"]) : 1,
                                LocalRoute = reader["LocalRoute"].ToString(),
                                Description = reader["Description"] != DBNull.Value ? reader["Description"].ToString() : ""
                            });
                        }
                    }
                }

                if (modulesInUnit.Count <= 1) return;

                modulesInUnit.Sort((a, b) => GetStageFromRouteOrTitle(a.LocalRoute, a.Title).CompareTo(GetStageFromRouteOrTitle(b.LocalRoute, b.Title)));

                var targetMod = modulesInUnit.Find(m => m.Id == moduleId);
                if (targetMod == null) return;

                modulesInUnit.Remove(targetMod);
                int insertIdx = Math.Max(0, Math.Min(modulesInUnit.Count, newStage - 1));
                modulesInUnit.Insert(insertIdx, targetMod);

                for (int i = 0; i < modulesInUnit.Count; i++)
                {
                    var m = modulesInUnit[i];
                    int st = i + 1;
                    string route = m.LocalRoute;
                    if (System.Text.RegularExpressions.Regex.IsMatch(route, @"stage=\d+"))
                    {
                        route = System.Text.RegularExpressions.Regex.Replace(route, @"stage=\d+", "stage=" + st);
                    }
                    else
                    {
                        string sep = route.Contains("?") ? "&" : "?";
                        route = route + sep + "stage=" + st;
                    }

                    string title = m.Title;
                    if (System.Text.RegularExpressions.Regex.IsMatch(title, @"^第\s*\d+\s*題[：:]\s*(.*)$"))
                    {
                        title = System.Text.RegularExpressions.Regex.Replace(title, @"^第\s*\d+\s*題[：:]\s*", "第 " + st + " 題：");
                    }

                    using (var upCmd = new SQLiteCommand("UPDATE QRCodes SET LocalRoute = @Route, Title = @Title WHERE Id = @Id;", conn))
                    {
                        upCmd.Parameters.AddWithValue("@Route", route);
                        upCmd.Parameters.AddWithValue("@Title", title);
                        upCmd.Parameters.AddWithValue("@Id", m.Id);
                        upCmd.ExecuteNonQuery();
                    }
                }
            }
        }

        public void AddUnitOnly(string unitId, string unitTitle, string unitRoute, string courseName)
        {
            if (string.IsNullOrEmpty(unitId) || string.IsNullOrEmpty(unitTitle)) return;
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = @"INSERT OR REPLACE INTO Units (UnitId, UnitTitle, UnitRoute, CourseName)
                               VALUES (@UnitId, @UnitTitle, @UnitRoute, @CourseName);";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", unitId);
                    cmd.Parameters.AddWithValue("@UnitTitle", unitTitle);
                    cmd.Parameters.AddWithValue("@UnitRoute", unitRoute ?? string.Format("/index.html?unit={0}", unitId.Replace("unit_", "")));
                    cmd.Parameters.AddWithValue("@CourseName", string.IsNullOrEmpty(courseName) ? "膳食療養學" : courseName.Trim());
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void UpdateUnitOnly(string unitId, string courseName, string unitTitle)
        {
            if (string.IsNullOrWhiteSpace(unitId) || string.IsNullOrWhiteSpace(courseName) || string.IsNullOrWhiteSpace(unitTitle))
                throw new ArgumentException("單元代碼、科目與名稱皆不可為空。");

            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                using (var transaction = conn.BeginTransaction())
                {
                    using (var updateUnit = new SQLiteCommand(
                        "UPDATE Units SET UnitTitle = @UnitTitle WHERE UnitId = @UnitId AND CourseName = @CourseName;", conn, transaction))
                    {
                        updateUnit.Parameters.AddWithValue("@UnitTitle", unitTitle.Trim());
                        updateUnit.Parameters.AddWithValue("@UnitId", unitId);
                        updateUnit.Parameters.AddWithValue("@CourseName", courseName);
                        updateUnit.ExecuteNonQuery();
                    }
                    using (var updateModules = new SQLiteCommand(
                        "UPDATE QRCodes SET UnitTitle = @UnitTitle WHERE UnitId = @UnitId AND CourseName = @CourseName;", conn, transaction))
                    {
                        updateModules.Parameters.AddWithValue("@UnitTitle", unitTitle.Trim());
                        updateModules.Parameters.AddWithValue("@UnitId", unitId);
                        updateModules.Parameters.AddWithValue("@CourseName", courseName);
                        updateModules.ExecuteNonQuery();
                    }
                    transaction.Commit();
                }
            }
        }

        public void DeleteModule(int moduleId)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                using (var cmd = new SQLiteCommand("DELETE FROM QRCodes WHERE Id = @Id;", conn))
                {
                    cmd.Parameters.AddWithValue("@Id", moduleId);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void AddModule(TeachingModule mod)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = @"INSERT INTO QRCodes 
                    (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description) 
                    VALUES (@UnitId, @UnitTitle, @UnitRoute, @ModuleCode, @Title, @CourseName, @PptFile, @PptSlide, @LocalRoute, @Description);";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", mod.UnitId ?? "unit_custom");
                    cmd.Parameters.AddWithValue("@UnitTitle", mod.UnitTitle ?? "自訂單元");
                    cmd.Parameters.AddWithValue("@UnitRoute", mod.UnitRoute ?? "/index.html");
                    cmd.Parameters.AddWithValue("@ModuleCode", mod.ModuleCode ?? ("MOD_" + Guid.NewGuid().ToString("N").Substring(0, 8)));
                    cmd.Parameters.AddWithValue("@Title", mod.Title ?? "新題目");
                    cmd.Parameters.AddWithValue("@CourseName", mod.CourseName ?? "膳食療養學");
                    cmd.Parameters.AddWithValue("@PptFile", mod.PptFile ?? "1 營養照顧流程.pptx");
                    cmd.Parameters.AddWithValue("@PptSlide", mod.PptSlide);
                    cmd.Parameters.AddWithValue("@LocalRoute", mod.LocalRoute ?? "/index.html");
                    cmd.Parameters.AddWithValue("@Description", mod.Description ?? "");
                    cmd.ExecuteNonQuery();
                }
            }
            if (!string.IsNullOrEmpty(mod.UnitId) && !string.IsNullOrEmpty(mod.UnitTitle))
            {
                AddUnitOnly(mod.UnitId, mod.UnitTitle, mod.UnitRoute, mod.CourseName);
            }
        }

        public void MoveModuleToUnit(int moduleId, string targetUnitId, string targetUnitTitle, string targetUnitRoute, string targetCourseName = null)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();

                // 尋找目標單元目前已使用的 stage 號碼，避免重複衝突
                int nextStage = 1;
                if (string.IsNullOrEmpty(targetCourseName))
                {
                    using (var getCmdCourse = new SQLiteCommand("SELECT CourseName FROM Units WHERE UnitId = @targetUnitId UNION SELECT CourseName FROM QRCodes WHERE UnitId = @targetUnitId LIMIT 1;", conn))
                    {
                        getCmdCourse.Parameters.AddWithValue("@targetUnitId", targetUnitId);
                        var cRes = getCmdCourse.ExecuteScalar();
                        if (cRes != null && cRes != DBNull.Value) targetCourseName = cRes.ToString();
                    }
                }
                string sqlStages = string.IsNullOrEmpty(targetCourseName)
                    ? "SELECT LocalRoute FROM QRCodes WHERE UnitId = @targetUnitId AND Id != @moduleId;"
                    : "SELECT LocalRoute FROM QRCodes WHERE UnitId = @targetUnitId AND CourseName = @targetCourseName AND Id != @moduleId;";
                using (var getStagesCmd = new SQLiteCommand(sqlStages, conn))
                {
                    getStagesCmd.Parameters.AddWithValue("@targetUnitId", targetUnitId);
                    getStagesCmd.Parameters.AddWithValue("@moduleId", moduleId);
                    if (!string.IsNullOrEmpty(targetCourseName)) getStagesCmd.Parameters.AddWithValue("@targetCourseName", targetCourseName);
                    using (var reader = getStagesCmd.ExecuteReader())
                    {
                        var usedStages = new HashSet<int>();
                        while (reader.Read())
                        {
                            string route = reader["LocalRoute"] != DBNull.Value ? reader["LocalRoute"].ToString() : "";
                            var m = System.Text.RegularExpressions.Regex.Match(route, @"stage=(\d+)");
                            if (m.Success)
                            {
                                int st;
                                if (int.TryParse(m.Groups[1].Value, out st)) usedStages.Add(st);
                            }
                        }
                        while (usedStages.Contains(nextStage)) nextStage++;
                    }
                }

                string newLocalRoute = targetUnitRoute;
                string sep = newLocalRoute.Contains("?") ? "&" : "?";
                newLocalRoute = string.Format("{0}{1}stage={2}", newLocalRoute, sep, nextStage);

                // 同步將題目標題開頭的題號調整為該單元的新題號
                string curTitle = "";
                string curCourse = "";
                using (var getTitleCmd = new SQLiteCommand("SELECT Title, CourseName FROM QRCodes WHERE Id = @Id;", conn))
                {
                    getTitleCmd.Parameters.AddWithValue("@Id", moduleId);
                    using (var r = getTitleCmd.ExecuteReader())
                    {
                        if (r.Read())
                        {
                            curTitle = r["Title"] != DBNull.Value ? r["Title"].ToString() : "";
                            curCourse = r["CourseName"] != DBNull.Value ? r["CourseName"].ToString() : "";
                        }
                    }

                }

                string newTitle = curTitle;
                if (!string.IsNullOrEmpty(curTitle))
                {
                    var mNum = System.Text.RegularExpressions.Regex.Match(curTitle, @"^第\s*\d+\s*題[：:]\s*(.*)$");
                    if (mNum.Success)
                    {
                        newTitle = string.Format("第 {0} 題：{1}", nextStage, mNum.Groups[1].Value);
                    }
                }

                string sql = @"UPDATE QRCodes 
                    SET UnitId = @UnitId, 
                        UnitTitle = @UnitTitle, 
                        UnitRoute = @UnitRoute, 
                        LocalRoute = @LocalRoute,
                        Title = @Title,
                        CourseName = @CourseName 
                    WHERE Id = @Id;";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", targetUnitId);
                    cmd.Parameters.AddWithValue("@UnitTitle", targetUnitTitle);
                    cmd.Parameters.AddWithValue("@UnitRoute", targetUnitRoute);
                    cmd.Parameters.AddWithValue("@LocalRoute", newLocalRoute);
                    cmd.Parameters.AddWithValue("@Title", newTitle);
                    cmd.Parameters.AddWithValue("@CourseName", !string.IsNullOrEmpty(targetCourseName) ? targetCourseName : curCourse);
                    cmd.Parameters.AddWithValue("@Id", moduleId);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public int CopyModuleToUnit(int moduleId, string targetUnitId, string targetUnitTitle, string targetUnitRoute, string targetCourseName = null)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();

                // 尋找目標單元目前已使用的 stage 號碼
                int nextStage = 1;
                if (string.IsNullOrEmpty(targetCourseName))
                {
                    using (var getCmdCourse = new SQLiteCommand("SELECT CourseName FROM Units WHERE UnitId = @targetUnitId UNION SELECT CourseName FROM QRCodes WHERE UnitId = @targetUnitId LIMIT 1;", conn))
                    {
                        getCmdCourse.Parameters.AddWithValue("@targetUnitId", targetUnitId);
                        var cRes = getCmdCourse.ExecuteScalar();
                        if (cRes != null && cRes != DBNull.Value) targetCourseName = cRes.ToString();
                    }
                }
                string sqlStages = string.IsNullOrEmpty(targetCourseName)
                    ? "SELECT LocalRoute FROM QRCodes WHERE UnitId = @targetUnitId;"
                    : "SELECT LocalRoute FROM QRCodes WHERE UnitId = @targetUnitId AND CourseName = @targetCourseName;";
                using (var getStagesCmd = new SQLiteCommand(sqlStages, conn))
                {
                    getStagesCmd.Parameters.AddWithValue("@targetUnitId", targetUnitId);
                    if (!string.IsNullOrEmpty(targetCourseName)) getStagesCmd.Parameters.AddWithValue("@targetCourseName", targetCourseName);
                    using (var reader = getStagesCmd.ExecuteReader())
                    {
                        var usedStages = new HashSet<int>();
                        while (reader.Read())
                        {
                            string route = reader["LocalRoute"] != DBNull.Value ? reader["LocalRoute"].ToString() : "";
                            var m = System.Text.RegularExpressions.Regex.Match(route, @"stage=(\d+)");
                            if (m.Success)
                            {
                                int st;
                                if (int.TryParse(m.Groups[1].Value, out st)) usedStages.Add(st);
                            }
                        }
                        while (usedStages.Contains(nextStage)) nextStage++;
                    }
                }

                string newLocalRoute = targetUnitRoute;
                string sep = newLocalRoute.Contains("?") ? "&" : "?";
                newLocalRoute = string.Format("{0}{1}stage={2}", newLocalRoute, sep, nextStage);

                // 取得原題目資料
                string curTitle = "", curModuleCode = "", curCourseName = "", curPptFile = "", curDesc = "";
                int curPptSlide = 1;
                bool sourceFound = false;
                using (var getCmd = new SQLiteCommand("SELECT * FROM QRCodes WHERE Id = @Id;", conn))
                {
                    getCmd.Parameters.AddWithValue("@Id", moduleId);
                    using (var reader = getCmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            sourceFound = true;
                            curTitle = reader["Title"] != DBNull.Value ? reader["Title"].ToString() : "";
                            curModuleCode = reader["ModuleCode"] != DBNull.Value ? reader["ModuleCode"].ToString() : "";
                            curCourseName = reader["CourseName"] != DBNull.Value ? reader["CourseName"].ToString() : "";
                            curPptFile = reader["PptFile"] != DBNull.Value ? reader["PptFile"].ToString() : "";
                            curPptSlide = reader["PptSlide"] != DBNull.Value ? Convert.ToInt32(reader["PptSlide"]) : 1;
                            curDesc = reader["Description"] != DBNull.Value ? reader["Description"].ToString() : "";
                        }
                    }
                }
                if (!sourceFound)
                {
                    throw new InvalidOperationException("找不到要複製的題目，請重新整理題目清單後再試。");
                }

                string newTitle = curTitle;
                if (!string.IsNullOrEmpty(curTitle))
                {
                    var mNum = System.Text.RegularExpressions.Regex.Match(curTitle, @"^第\s*\d+\s*題[：:]\s*(.*)$");
                    if (mNum.Success)
                    {
                        newTitle = string.Format("第 {0} 題：{1}", nextStage, mNum.Groups[1].Value);
                    }
                }

                string newModuleCode = string.Format("{0}_COPY_{1}", curModuleCode, Guid.NewGuid().ToString().Substring(0, 6).ToUpper());

                string sqlInsert = @"INSERT INTO QRCodes (UnitId, UnitTitle, UnitRoute, ModuleCode, Title, CourseName, PptFile, PptSlide, LocalRoute, Description)
                    VALUES (@UnitId, @UnitTitle, @UnitRoute, @ModuleCode, @Title, @CourseName, @PptFile, @PptSlide, @LocalRoute, @Description);";
                using (var cmd = new SQLiteCommand(sqlInsert, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", targetUnitId);
                    cmd.Parameters.AddWithValue("@UnitTitle", targetUnitTitle);
                    cmd.Parameters.AddWithValue("@UnitRoute", targetUnitRoute);
                    cmd.Parameters.AddWithValue("@ModuleCode", newModuleCode);
                    cmd.Parameters.AddWithValue("@Title", newTitle);
                    cmd.Parameters.AddWithValue("@CourseName", !string.IsNullOrEmpty(targetCourseName) ? targetCourseName : curCourseName);
                    cmd.Parameters.AddWithValue("@PptFile", curPptFile);
                    cmd.Parameters.AddWithValue("@PptSlide", curPptSlide);
                    cmd.Parameters.AddWithValue("@LocalRoute", newLocalRoute);
                    cmd.Parameters.AddWithValue("@Description", curDesc);
                    if (cmd.ExecuteNonQuery() != 1)
                    {
                        throw new InvalidOperationException("題目未能寫入目標單元。");
                    }
                }
                using (var cmd = new SQLiteCommand("SELECT last_insert_rowid();", conn))
                {
                    return Convert.ToInt32(cmd.ExecuteScalar());
                }
            }
        }

        public List<string> GetAllCourses()
        {
            var list = new List<string>();
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = "SELECT CourseName FROM Courses ORDER BY Id ASC;";
                using (var cmd = new SQLiteCommand(sql, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        string courseName = reader["CourseName"].ToString();
                        if (!courseName.StartsWith(RemovedCourseName, StringComparison.OrdinalIgnoreCase)) list.Add(courseName);
                    }
                }
                string sqlQr = "SELECT DISTINCT CourseName FROM QRCodes WHERE CourseName IS NOT NULL AND CourseName != '';";
                using (var cmdQr = new SQLiteCommand(sqlQr, conn))
                using (var readerQr = cmdQr.ExecuteReader())
                {
                    while (readerQr.Read())
                    {
                        string cName = readerQr["CourseName"].ToString();
                        if (!cName.StartsWith(RemovedCourseName, StringComparison.OrdinalIgnoreCase) && !list.Contains(cName)) list.Add(cName);
                    }
                }
            }
            if (list.Count == 0) list.Add("膳食療養學");
            return list;
        }

        public void AddCourse(string courseName)
        {
            if (string.IsNullOrEmpty(courseName)) return;
            string normalizedCourseName = courseName.Trim();
            if (normalizedCourseName == "膳食療養學(一)") normalizedCourseName = "膳食療養學";
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = "INSERT OR IGNORE INTO Courses (CourseName) VALUES (@CourseName);";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@CourseName", normalizedCourseName);
                    cmd.ExecuteNonQuery();
                }
            }
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                EnsureCurriculumUnits(conn);
            }
        }

        public void UpdateModuleAndUnit(int moduleId, string newTitle, string newUnitTitle, int pptSlide, string description)
        {
            UpdateModuleAndUnit(moduleId, newTitle, newUnitTitle, null, pptSlide, description);
        }

        public void UpdateModuleAndUnit(int moduleId, string newTitle, string newUnitTitle, string newCourseName, int pptSlide, string description)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string unitId = "";
                using (var getCmd = new SQLiteCommand("SELECT UnitId FROM QRCodes WHERE Id = @Id;", conn))
                {
                    getCmd.Parameters.AddWithValue("@Id", moduleId);
                    var res = getCmd.ExecuteScalar();
                    if (res != null) unitId = res.ToString();
                }

                if (!string.IsNullOrEmpty(newCourseName))
                {
                    AddCourse(newCourseName);
                }

                string sqlMod = string.IsNullOrEmpty(newCourseName) 
                    ? @"UPDATE QRCodes SET Title = @Title, UnitTitle = @UnitTitle, PptSlide = @PptSlide, Description = @Description WHERE Id = @Id;"
                    : @"UPDATE QRCodes SET Title = @Title, UnitTitle = @UnitTitle, CourseName = @CourseName, PptSlide = @PptSlide, Description = @Description WHERE Id = @Id;";

                using (var cmd = new SQLiteCommand(sqlMod, conn))
                {
                    cmd.Parameters.AddWithValue("@Title", newTitle);
                    cmd.Parameters.AddWithValue("@UnitTitle", newUnitTitle);
                    if (!string.IsNullOrEmpty(newCourseName)) cmd.Parameters.AddWithValue("@CourseName", newCourseName.Trim());
                    cmd.Parameters.AddWithValue("@PptSlide", pptSlide);
                    cmd.Parameters.AddWithValue("@Description", description);
                    cmd.Parameters.AddWithValue("@Id", moduleId);
                    cmd.ExecuteNonQuery();
                }

                if (!string.IsNullOrEmpty(unitId) && !string.IsNullOrEmpty(newUnitTitle))
                {
                    string sqlUnit = "UPDATE QRCodes SET UnitTitle = @UnitTitle WHERE UnitId = @UnitId;";
                    using (var cmdUnit = new SQLiteCommand(sqlUnit, conn))
                    {
                        cmdUnit.Parameters.AddWithValue("@UnitTitle", newUnitTitle);
                        cmdUnit.Parameters.AddWithValue("@UnitId", unitId);
                        cmdUnit.ExecuteNonQuery();
                    }

                    string sqlUnitsTable = "UPDATE Units SET UnitTitle = @UnitTitle WHERE UnitId = @UnitId;";
                    using (var cmdUt = new SQLiteCommand(sqlUnitsTable, conn))
                    {
                        cmdUt.Parameters.AddWithValue("@UnitTitle", newUnitTitle);
                        cmdUt.Parameters.AddWithValue("@UnitId", unitId);
                        cmdUt.ExecuteNonQuery();
                    }
                }
            }
        }

        public List<TeachingModule> GetDistinctUnits(string courseFilter = null)
        {
            var list = new List<TeachingModule>();
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                bool filterByCourse = !string.IsNullOrEmpty(courseFilter) && courseFilter != "🌟 所有科目" && courseFilter != "所有科目";
                string sql = filterByCourse
                    ? @"SELECT DISTINCT UnitId, UnitTitle, UnitRoute, CourseName FROM (
                            SELECT UnitId, UnitTitle, UnitRoute, CourseName FROM Units
                            UNION
                            SELECT UnitId, UnitTitle, UnitRoute, CourseName FROM QRCodes
                        ) WHERE CourseName = @CourseName;"
                    : @"SELECT DISTINCT UnitId, UnitTitle, UnitRoute, CourseName FROM (
                            SELECT UnitId, UnitTitle, UnitRoute, CourseName FROM Units
                            UNION
                            SELECT UnitId, UnitTitle, UnitRoute, CourseName FROM QRCodes
                        );";

                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    if (filterByCourse)
                    {
                        cmd.Parameters.AddWithValue("@CourseName", courseFilter);
                    }
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            string courseName = reader["CourseName"] != DBNull.Value ? reader["CourseName"].ToString() : "";
                            if (courseName.StartsWith(RemovedCourseName, StringComparison.OrdinalIgnoreCase)) continue;
                            list.Add(new TeachingModule
                            {
                                UnitId = reader["UnitId"].ToString(),
                                UnitTitle = reader["UnitTitle"].ToString(),
                                UnitRoute = reader["UnitRoute"].ToString(),
                                CourseName = courseName
                            });
                        }
                    }
                }
            }

            list.Sort(delegate(TeachingModule a, TeachingModule b)
            {
                int cComp = string.Compare(a.CourseName ?? "", b.CourseName ?? "", StringComparison.Ordinal);
                if (cComp != 0) return cComp;
                int ordA = GetUnitOrder(a.UnitTitle, a.UnitId);
                int ordB = GetUnitOrder(b.UnitTitle, b.UnitId);
                if (ordA != ordB) return ordA.CompareTo(ordB);
                return string.Compare(a.UnitTitle, b.UnitTitle, StringComparison.Ordinal);
            });

            return list;
        }

        public string GetUnitTitle(string unitId)
        {
            if (string.IsNullOrEmpty(unitId)) return "";
            string rawId = unitId.StartsWith("unit_") ? unitId : ("unit_" + unitId);
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = "SELECT UnitTitle FROM QRCodes WHERE UnitId = @UnitId OR UnitId = @RawId LIMIT 1;";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", unitId);
                    cmd.Parameters.AddWithValue("@RawId", rawId);
                    var res = cmd.ExecuteScalar();
                    if (res != null && res != DBNull.Value) return res.ToString();
                }
            }
            if (unitId == "life" || rawId == "unit_life") return "【單元十五】人生好難題";
            if (unitId == "dm" || rawId == "unit_dm") return "【單元六】糖尿病之營養治療";
            if (unitId == "unit_bfbbb5" || rawId == "unit_bfbbb5") return "【單元十六】健檢報告判讀";
            if (unitId == "ncp" || rawId == "unit_ncp") return "【單元二】營養照護程序 (NCP) 核心觀念檢定";
            return "【單元一 營養照顧流程】";
        }

        public void SaveAttempt(string caseCode, string studentName, string studentId, int totalScore, string riskLevel, int isCorrect, int duration)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = @"INSERT INTO StudentAttempts 
                    (CaseCode, StudentName, StudentId, SubmittedTotalScore, SubmittedRiskLevel, IsCorrect, DurationSeconds) 
                    VALUES (@CaseCode, @StudentName, @StudentId, @SubmittedTotalScore, @SubmittedRiskLevel, @IsCorrect, @DurationSeconds);";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@CaseCode", caseCode);
                    cmd.Parameters.AddWithValue("@StudentName", studentName);
                    cmd.Parameters.AddWithValue("@StudentId", studentId);
                    cmd.Parameters.AddWithValue("@SubmittedTotalScore", totalScore);
                    cmd.Parameters.AddWithValue("@SubmittedRiskLevel", riskLevel);
                    cmd.Parameters.AddWithValue("@IsCorrect", isCorrect);
                    cmd.Parameters.AddWithValue("@DurationSeconds", duration);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public int GetAttemptCount()
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                using (var cmd = new SQLiteCommand("SELECT COUNT(*) FROM StudentAttempts;", conn))
                {
                    return Convert.ToInt32(cmd.ExecuteScalar());
                }
            }
        }

        public TeachingModule GetModuleByUnitAndStage(string unitId, int stage = 1)
        {
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string cleanUnit = (unitId ?? "").ToLower().Replace("unit_", "");
                string sql = "SELECT * FROM QRCodes WHERE (LOWER(UnitId) = @UnitId OR LOWER(UnitId) = @UnitPrefixed OR LOWER(LocalRoute) LIKE @RouteMatch) ORDER BY Id ASC;";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", cleanUnit);
                    cmd.Parameters.AddWithValue("@UnitPrefixed", "unit_" + cleanUnit);
                    cmd.Parameters.AddWithValue("@RouteMatch", "%unit=" + cleanUnit + "%");
                    using (var reader = cmd.ExecuteReader())
                    {
                        var list = new List<TeachingModule>();
                        while (reader.Read())
                        {
                            list.Add(new TeachingModule
                            {
                                Id = Convert.ToInt32(reader["Id"]),
                                UnitId = reader["UnitId"] != DBNull.Value ? reader["UnitId"].ToString() : "",
                                UnitTitle = reader["UnitTitle"] != DBNull.Value ? reader["UnitTitle"].ToString() : "",
                                UnitRoute = reader["UnitRoute"] != DBNull.Value ? reader["UnitRoute"].ToString() : "",
                                ModuleCode = reader["ModuleCode"].ToString(),
                                Title = reader["Title"].ToString(),
                                CourseName = reader["CourseName"].ToString(),
                                PptFile = reader["PptFile"] != DBNull.Value ? reader["PptFile"].ToString() : "",
                                PptSlide = reader["PptSlide"] != DBNull.Value ? Convert.ToInt32(reader["PptSlide"]) : 1,
                                LocalRoute = reader["LocalRoute"].ToString(),
                                Description = reader["Description"] != DBNull.Value ? reader["Description"].ToString() : ""
                            });
                        }
                        if (list.Count == 0) return null;

                        ApplyCurriculum03DisplayOrder(list);

                        foreach (var m in list)
                        {
                            var match = System.Text.RegularExpressions.Regex.Match(m.LocalRoute, @"stage=(\d+)");
                            if (match.Success)
                            {
                                int st;
                                if (int.TryParse(match.Groups[1].Value, out st) && st == stage)
                                {
                                    return m;
                                }
                            }
                        }
                        int targetIdx = stage - 1;
                        if (targetIdx >= 0 && targetIdx < list.Count)
                        {
                            return list[targetIdx];
                        }
                        return list[0];
                    }
                }
            }
        }

        public int GetStageCountForUnit(string unitId)
        {
            if (string.IsNullOrEmpty(unitId)) return 0;
            string cleanUnit = unitId.ToLower().Replace("unit_", "");
            using (var conn = new SQLiteConnection(_connectionString))
            {
                conn.Open();
                string sql = "SELECT COUNT(*) FROM QRCodes WHERE (LOWER(UnitId) = @UnitId OR LOWER(UnitId) = @UnitPrefixed OR LOWER(LocalRoute) LIKE @RouteMatch);";
                using (var cmd = new SQLiteCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UnitId", cleanUnit);
                    cmd.Parameters.AddWithValue("@UnitPrefixed", "unit_" + cleanUnit);
                    cmd.Parameters.AddWithValue("@RouteMatch", "%unit=" + cleanUnit + "%");
                    var res = cmd.ExecuteScalar();
                    if (res != null && res != DBNull.Value)
                    {
                        return Convert.ToInt32(res);
                    }
                }
            }
            return 0;
        }

        public static string GetCorrectOptionFromDescription(string desc)
        {
            if (string.IsNullOrEmpty(desc)) return "";
            string[] lines = desc.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            int idx = 1;
            foreach (string rawLine in lines)
            {
                string line = rawLine.Trim();
                if (string.IsNullOrEmpty(line)) continue;

                string key = idx.ToString();
                var m = System.Text.RegularExpressions.Regex.Match(line, @"^(?:選項\s*|Option\s*)?([0-9A-Za-z]+)[\.、：:\s]");
                if (m.Success)
                {
                    key = m.Groups[1].Value;
                }

                if (line.Contains("(正確答案)") || line.Contains("（正確答案）") || line.Contains("(正確)") || line.Contains("（正確）") || line.Contains("[正確答案]"))
                {
                    return key;
                }
                idx++;
            }
            return "";
        }
    }
}
