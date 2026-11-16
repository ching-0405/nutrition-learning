# -*- coding: utf-8 -*-
"""
營養教學平台 - 雲端網頁伺服器 (server.py)
相容 Python 3.8+，支援無任何外部相依套件 (純標準庫 http.server) 運作，
可一鍵部署至 Render / Railway / Heroku / Fly.io / Zeabur 或本機執行。
"""

import os
import sys
import json
import uuid
import random
import re
import sqlite3
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_ROOT = os.path.join(BASE_DIR, "web")
DB_PATH = os.path.join(BASE_DIR, "nutrition_hub.db")
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "admin123")

TEAM_NAMES = [
    "🔥 紅隊 (熾熱先鋒)",
    "💧 藍隊 (深海智者)",
    "⚡ 黃隊 (疾風雷霆)",
    "🌿 綠隊 (翡翠守護)",
    "🔮 紫隊 (星界秘術)",
    "🌸 粉隊 (櫻花奇蹟)"
]

# 全域遊戲狀態
state_lock = threading.Lock()
SESSION_ID = str(uuid.uuid4()).replace("-", "")
CURRENT_UNIT = "must"
CURRENT_UNIT_TITLE = "【單元一 營養照顧流程】"
CURRENT_STAGE = 1
IS_GAME_STARTED = False
IS_REVEALED = False
IS_LOCKED = False
GAME_MODE = "individual"
TEAM_COUNT = 3

STUDENTS = {}      # clientId -> dict
VOTES_BY_STAGE = {}# stage -> { option: count }
CLIENT_VOTES = {}  # f"{clientId}_{unit}_{stage}" -> option


# ==========================================
# 資料庫輔助函式
# ==========================================
def get_db_connection():
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    return None

def get_correct_option_from_description(desc):
    if not desc:
        return ""
    lines = [l.strip() for l in desc.splitlines() if l.strip()]
    idx = 1
    for line in lines:
        key = str(idx)
        m = re.match(r'^(?:選項\s*|Option\s*)?([0-9A-Za-z]+)[\.、：:\s]', line)
        if m:
            key = m.group(1)
        if any(tok in line for tok in ["(正確答案)", "（正確答案）", "(正確)", "（正確）", "[正確答案]"]):
            return key
        idx += 1
    return ""

def get_module_by_unit_and_stage(unit_id, stage=1):
    conn = get_db_connection()
    if not conn:
        return None
    try:
        clean_unit = (unit_id or "").lower().replace("unit_", "")
        sql = "SELECT * FROM QRCodes WHERE (LOWER(UnitId) = ? OR LOWER(UnitId) = ? OR LOWER(LocalRoute) LIKE ?) ORDER BY Id ASC"
        cur = conn.cursor()
        cur.execute(sql, (clean_unit, f"unit_{clean_unit}", f"%unit={clean_unit}%"))
        rows = cur.fetchall()
        if not rows:
            return None
        
        # 依 stage 挑選
        for r in rows:
            lr = r["LocalRoute"] or ""
            m = re.search(r'stage=(\d+)', lr)
            if m and int(m.group(1)) == stage:
                return dict(r)
        
        idx = stage - 1
        if 0 <= idx < len(rows):
            return dict(rows[idx])
        return dict(rows[0])
    except Exception as e:
        print(f"[DB Error] {e}")
        return None
    finally:
        conn.close()

def get_stage_count_for_unit(unit_id):
    conn = get_db_connection()
    if not conn:
        return 0
    try:
        clean_unit = (unit_id or "").lower().replace("unit_", "")
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM QRCodes WHERE (LOWER(UnitId) = ? OR LOWER(UnitId) = ? OR LOWER(LocalRoute) LIKE ?)",
                    (clean_unit, f"unit_{clean_unit}", f"%unit={clean_unit}%"))
        count = cur.fetchone()[0]
        return count
    except Exception:
        return 0
    finally:
        conn.close()

def get_unit_title(unit_id):
    raw_id = (unit_id or "").lower()
    clean_id = raw_id.replace("unit_", "")
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT UnitTitle FROM Units WHERE LOWER(UnitId) = ? OR LOWER(UnitId) = ? LIMIT 1", (raw_id, clean_id))
            r = cur.fetchone()
            if r and r[0]:
                return r[0]
            cur.execute("SELECT UnitTitle FROM QRCodes WHERE (LOWER(UnitId) = ? OR LOWER(UnitId) = ? OR LOWER(LocalRoute) LIKE ?) AND UnitTitle != '' LIMIT 1",
                        (clean_id, f"unit_{clean_id}", f"%unit={clean_id}%"))
            r2 = cur.fetchone()
            if r2 and r2[0]:
                return r2[0]
        except Exception:
            pass
        finally:
            conn.close()
    
    if clean_id in ("must",): return "【單元一 營養照顧流程】"
    if clean_id in ("support",): return "【單元二】營養支持"
    if clean_id in ("curriculum_03",): return "【單元三】體重管理與代謝病態"
    if clean_id in ("curriculum_07",): return "【單元七】腎臟疾病營養治療"
    if clean_id in ("dm",): return "【單元六】糖尿病之營養治療"
    if clean_id in ("life",): return "【單元十五】人生好難題"
    return f"【單元】{unit_id}"

def get_max_stages_for_unit(unit):
    c = get_stage_count_for_unit(unit)
    if c > 0:
        return c
    u = (unit or "").lower().replace("unit_", "")
    if u == "life": return 1
    if u == "support": return 11
    if u == "ncp": return 2
    if u == "dm": return 12
    if u in ("curriculum_03", "curriculum_07"): return 6
    if u == "bfbbb5": return 1
    return 7


# ==========================================
# 計分與選項標準化判定 (完美相容英文字母與數字)
# ==========================================
def normalize_option_key(opt):
    if not opt:
        return ""
    opt = str(opt).strip().upper()
    opt = re.sub(r'^(?:選項|OPTION)\s*', '', opt)
    if opt in ("1", "A", "(A)", "（A）"): return "A"
    if opt in ("2", "B", "(B)", "（B）"): return "B"
    if opt in ("3", "C", "(C)", "（C）"): return "C"
    if opt in ("4", "D", "(D)", "（D）"): return "D"
    if opt in ("5", "E", "(E)", "（E）"): return "E"
    return opt

def is_correct_option(unit, stage, option, dynamic_correct=None):
    if not option:
        return False
    norm_user = normalize_option_key(option)
    
    if dynamic_correct:
        norm_dyn = normalize_option_key(dynamic_correct)
        if norm_user == norm_dyn:
            return True
        if str(option).strip().lower() == str(dynamic_correct).strip().lower():
            return True
    
    clean_unit = (unit or "").lower().replace("unit_", "")
    
    if clean_unit == "curriculum_07":
        mapping = {1: "B", 2: "C", 3: "C", 4: "A", 5: "D", 6: "C"}
        return norm_user == mapping.get(stage)
        
    if clean_unit == "curriculum_03":
        mapping = {1: "B", 2: "B", 3: "A", 4: "A", 5: "C", 6: "A"}
        return norm_user == mapping.get(stage)
        
    if clean_unit == "support":
        mapping = {1: "D", 2: "D", 3: "A", 4: "C", 5: "A", 6: "C", 7: "A", 8: "A", 9: "A", 10: "D", 11: "B"}
        return norm_user == mapping.get(stage)
        
    if clean_unit == "ncp":
        return stage in (1, 2) and norm_user == "A"
        
    if clean_unit == "dm":
        mapping = {
            1: ["D"], 2: ["A"], 3: ["C", "A"], 4: ["D", "A"], 5: ["D"],
            6: ["A"], 7: ["A"], 8: ["C"], 9: ["C"], 10: ["D"], 11: ["B", "C"], 12: ["A"]
        }
        return norm_user in mapping.get(stage, [])
        
    if clean_unit == "life":
        return stage == 1 and norm_user == "D"
        
    default_mapping = {1: ["B"], 2: ["C"], 3: ["B", "C"], 4: ["C"], 5: ["A", "B"], 6: ["A"], 7: ["D"]}
    return norm_user in default_mapping.get(stage, [])


def calculate_auto_team_count(student_count):
    if student_count <= 6: return 2
    if student_count <= 15: return 3
    if student_count <= 28: return 4
    if student_count <= 45: return 5
    return 6

def register_student(client_id, nickname, avatar, gender="female"):
    global TEAM_COUNT
    with state_lock:
        if client_id in STUDENTS:
            STUDENTS[client_id]["nickname"] = nickname
            STUDENTS[client_id]["avatar"] = avatar
            STUDENTS[client_id]["gender"] = gender
            return STUDENTS[client_id]
        
        TEAM_COUNT = calculate_auto_team_count(len(STUDENTS) + 1)
        
        # 尋找人數最少的小隊
        team_sizes = [0] * TEAM_COUNT
        for s in STUDENTS.values():
            tid = s.get("teamId", 0)
            if 0 <= tid < TEAM_COUNT:
                team_sizes[tid] += 1
        
        min_team = 0
        min_size = sys.maxsize
        for i in range(TEAM_COUNT):
            if team_sizes[i] < min_size:
                min_size = team_sizes[i]
                min_team = i
                
        info = {
            "clientId": client_id,
            "nickname": nickname,
            "avatar": avatar,
            "gender": gender,
            "teamId": min_team if GAME_MODE == "team" else 0,
            "teamName": TEAM_NAMES[min_team % len(TEAM_NAMES)] if GAME_MODE == "team" else "",
            "score": 0,
            "correctCount": 0
        }
        STUDENTS[client_id] = info
        return info

def start_game(mode=None, start_stage=-1):
    global GAME_MODE, TEAM_COUNT, IS_GAME_STARTED, CURRENT_STAGE, IS_REVEALED, IS_LOCKED
    with state_lock:
        if mode:
            GAME_MODE = mode
        TEAM_COUNT = calculate_auto_team_count(len(STUDENTS))
        IS_GAME_STARTED = True
        if start_stage > 0:
            CURRENT_STAGE = start_stage
        elif CURRENT_STAGE <= 0:
            CURRENT_STAGE = 1
        IS_REVEALED = False
        IS_LOCKED = False
        
        if GAME_MODE == "team":
            s_list = list(STUDENTS.values())
            random.shuffle(s_list)
            for i, s in enumerate(s_list):
                tid = i % TEAM_COUNT
                s["teamId"] = tid
                s["teamName"] = TEAM_NAMES[tid % len(TEAM_NAMES)]
        else:
            for s in STUDENTS.values():
                s["teamId"] = 0
                s["teamName"] = ""

def record_vote(stage, option, client_id, unit):
    global CURRENT_UNIT
    with state_lock:
        if IS_LOCKED:
            score = STUDENTS[client_id]["score"] if client_id in STUDENTS else 0
            return False, 0, score
        
        target_unit = unit or CURRENT_UNIT
        if stage not in VOTES_BY_STAGE:
            VOTES_BY_STAGE[stage] = {}
            
        client_key = f"{client_id}_{target_unit}_{stage}"
        already_voted = client_key in CLIENT_VOTES
        prev_option = CLIENT_VOTES.get(client_key)
        
        if already_voted and prev_option in VOTES_BY_STAGE[stage]:
            if VOTES_BY_STAGE[stage][prev_option] > 0:
                VOTES_BY_STAGE[stage][prev_option] -= 1
                
        CLIENT_VOTES[client_key] = option
        VOTES_BY_STAGE[stage][option] = VOTES_BY_STAGE[stage].get(option, 0) + 1
        
        norm_unit = target_unit.lower().replace("unit_", "")
        points = 250 if norm_unit == "must" else 500
        
        dyn_correct = None
        mod = get_module_by_unit_and_stage(target_unit, stage)
        if mod and mod.get("Description"):
            dyn_correct = get_correct_option_from_description(mod["Description"])
            
        is_corr = is_correct_option(norm_unit, stage, option, dyn_correct)
        earned = 0
        total_score = 0
        
        if client_id in STUDENTS:
            s = STUDENTS[client_id]
            was_corr = already_voted and is_correct_option(norm_unit, stage, prev_option, dyn_correct)
            if is_corr and not was_corr:
                s["correctCount"] += 1
                earned = points
                s["score"] += earned
            elif not is_corr and was_corr:
                s["correctCount"] = max(0, s["correctCount"] - 1)
                earned = -points
                s["score"] = max(0, s["score"] - points)
            total_score = s["score"]
            
        return is_corr, earned, total_score

def reset_votes(clear_students=False):
    global CURRENT_STAGE, IS_GAME_STARTED, IS_REVEALED, IS_LOCKED, SESSION_ID
    with state_lock:
        CURRENT_STAGE = 1
        IS_GAME_STARTED = False
        IS_REVEALED = False
        IS_LOCKED = False
        VOTES_BY_STAGE.clear()
        CLIENT_VOTES.clear()
        if clear_students:
            STUDENTS.clear()
            SESSION_ID = str(uuid.uuid4()).replace("-", "")
        else:
            for s in STUDENTS.values():
                s["score"] = 0
                s["correctCount"] = 0

def build_lobby_json():
    with state_lock:
        s_list = list(STUDENTS.values())
        return {
            "sessionId": SESSION_ID,
            "isGameStarted": IS_GAME_STARTED,
            "gameMode": GAME_MODE,
            "teamCount": TEAM_COUNT,
            "studentCount": len(s_list),
            "currentStage": CURRENT_STAGE,
            "currentUnit": CURRENT_UNIT,
            "currentUnitTitle": CURRENT_UNIT_TITLE,
            "students": s_list
        }

def build_leaderboard_json():
    with state_lock:
        sorted_students = sorted(STUDENTS.values(), key=lambda x: x.get("score", 0), reverse=True)
        top5 = []
        for i, s in enumerate(sorted_students[:5]):
            top5.append({
                "rank": i + 1,
                "nickname": s["nickname"],
                "avatar": s["avatar"],
                "teamName": s["teamName"],
                "score": s["score"],
                "correctCount": s["correctCount"]
            })
            
        team_totals = {i: 0 for i in range(TEAM_COUNT)}
        team_counts = {i: 0 for i in range(TEAM_COUNT)}
        for s in STUDENTS.values():
            tid = s.get("teamId", 0)
            if 0 <= tid < TEAM_COUNT:
                team_totals[tid] += s.get("score", 0)
                team_counts[tid] += 1
                
        teams = []
        for i in range(TEAM_COUNT):
            teams.append({
                "teamId": i,
                "teamName": TEAM_NAMES[i % len(TEAM_NAMES)],
                "totalScore": team_totals[i],
                "memberCount": team_counts[i]
            })
            
        return {
            "gameMode": GAME_MODE,
            "totalStudents": len(STUDENTS),
            "top5": top5,
            "teams": teams
        }

def build_status_json(stage, unit=None):
    target_unit = unit or CURRENT_UNIT
    with state_lock:
        stage_votes = VOTES_BY_STAGE.get(stage, {})
        total_votes = sum(stage_votes.values())
        most_voted = ""
        highest_count = -1
        for opt, cnt in stage_votes.items():
            if cnt > highest_count:
                highest_count = cnt
                most_voted = opt
                
        options_dict = {}
        pct_dict = {}
        for opt, cnt in stage_votes.items():
            options_dict[opt] = cnt
            pct = (cnt / total_votes * 100.0) if total_votes > 0 else 0.0
            pct_dict[opt] = round(pct, 1)
            
        student_status_list = []
        for s in STUDENTS.values():
            ckey = f"{s['clientId']}_{target_unit}_{stage}"
            student_status_list.append({
                "clientId": s["clientId"],
                "nickname": s["nickname"],
                "avatar": s["avatar"],
                "gender": s["gender"],
                "teamId": s["teamId"],
                "teamName": s["teamName"],
                "score": s["score"],
                "vote": CLIENT_VOTES.get(ckey, "")
            })
            
        return {
            "sessionId": SESSION_ID,
            "stage": stage,
            "currentStage": CURRENT_STAGE,
            "isGameStarted": IS_GAME_STARTED,
            "gameMode": GAME_MODE,
            "teamCount": TEAM_COUNT,
            "studentCount": len(STUDENTS),
            "totalVotes": total_votes,
            "mostVoted": most_voted,
            "highestCount": max(0, highest_count),
            "revealed": IS_REVEALED,
            "locked": IS_LOCKED,
            "currentUnit": CURRENT_UNIT,
            "currentUnitTitle": CURRENT_UNIT_TITLE,
            "maxStages": get_max_stages_for_unit(target_unit),
            "options": options_dict,
            "percentages": pct_dict,
            "students": student_status_list
        }


# ==========================================
# HTTP Request Handler (API + 靜態檔案)
# ==========================================
class WebPlatformHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_ROOT, **kwargs)

    def end_headers(self):
        # 允許 CORS 與禁止快取
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json_response(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def parse_params(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        # flatten single value
        res = {k: v[0] for k, v in params.items()}
        
        # 讀取 POST body (若有)
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode("utf-8")
            body_params = urllib.parse.parse_qs(body)
            for k, v in body_params.items():
                res[k] = v[0]
        return parsed.path, res

    def check_admin_auth(self, params):
        role = params.get("role", "")
        key = params.get("key", "")
        # 本機連線 或 附帶 role=teacher 或 key=ADMIN_SECRET
        client_ip = self.client_address[0]
        if client_ip in ("127.0.0.1", "::1", "localhost"):
            return True
        if role.lower() == "teacher":
            return True
        if key == ADMIN_SECRET:
            return True
        return False

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def handle_request(self):
        global CURRENT_STAGE, CURRENT_UNIT, CURRENT_UNIT_TITLE, IS_REVEALED, IS_LOCKED
        url_path, params = self.parse_params()

        # -----------------
        # API 路由
        # -----------------
        if url_path == "/api/join":
            cid = params.get("clientId") or str(uuid.uuid4()).replace("-", "")
            nick = params.get("nickname") or "同學"
            avatar = params.get("avatar") or "🍎"
            gender = params.get("gender") or "female"
            s = register_student(cid, nick, avatar, gender)
            resp = {
                "status": "ok",
                "clientId": s["clientId"],
                "nickname": s["nickname"],
                "avatar": s["avatar"],
                "gender": s["gender"],
                "teamId": s["teamId"],
                "teamName": s["teamName"],
                "isGameStarted": IS_GAME_STARTED,
                "teamCount": TEAM_COUNT,
                "sessionId": SESSION_ID
            }
            self.send_json_response(resp)
            return

        if url_path == "/api/lobby_status":
            self.send_json_response(build_lobby_json())
            return

        if url_path == "/api/module_details":
            req_unit = params.get("unit") or CURRENT_UNIT
            req_stage = int(params.get("stage", CURRENT_STAGE))
            mod = get_module_by_unit_and_stage(req_unit, req_stage)
            if mod:
                correct_opt = get_correct_option_from_description(mod.get("Description", ""))
                resp = {
                    "status": "ok",
                    "id": mod.get("Id", 0),
                    "unitId": mod.get("UnitId", ""),
                    "unitTitle": mod.get("UnitTitle", ""),
                    "title": mod.get("Title", ""),
                    "courseName": mod.get("CourseName", ""),
                    "description": mod.get("Description", ""),
                    "moduleCode": mod.get("ModuleCode", ""),
                    "correctOption": correct_opt
                }
            else:
                resp = {"status": "not_found"}
            self.send_json_response(resp)
            return

        if url_path == "/api/leaderboard":
            self.send_json_response(build_leaderboard_json())
            return

        if url_path == "/api/status":
            req_stage = int(params.get("stage", CURRENT_STAGE))
            req_unit = (params.get("unit") or CURRENT_UNIT).replace("unit_", "")
            self.send_json_response(build_status_json(req_stage, req_unit))
            return

        if url_path == "/api/vote":
            req_stage = int(params.get("stage", CURRENT_STAGE))
            opt = params.get("option", "")
            cid = params.get("clientId") or f"client_{self.client_address[0]}"
            unit = params.get("unit") or CURRENT_UNIT
            is_corr = False
            earned = 0
            total_score = 0
            if opt:
                is_corr, earned, total_score = record_vote(req_stage, opt, cid, unit)
            status_data = build_status_json(req_stage, unit)
            status_data["isCorrect"] = is_corr
            status_data["scoreEarned"] = earned
            status_data["totalScore"] = total_score
            self.send_json_response(status_data)
            return

        # -----------------
        # 教師管理端點 (/api/admin/*)
        # -----------------
        if url_path.startswith("/api/admin/"):
            if not self.check_admin_auth(params):
                self.send_json_response({"status": "error", "message": "Unauthorized: 僅授課教師可控制題目"}, 403)
                return

            if url_path == "/api/admin/start_game":
                mode = params.get("mode")
                if "unit" in params:
                    CURRENT_UNIT = params["unit"]
                    CURRENT_UNIT_TITLE = get_unit_title(CURRENT_UNIT)
                start_st = int(params.get("stage", -1))
                start_game(mode, start_st)
                self.send_json_response(build_lobby_json())
                return

            if url_path == "/api/admin/set_stage":
                if "unit" in params:
                    CURRENT_UNIT = params["unit"]
                    CURRENT_UNIT_TITLE = get_unit_title(CURRENT_UNIT)
                if "stage" in params:
                    max_st = get_max_stages_for_unit(CURRENT_UNIT)
                    with state_lock:
                        CURRENT_STAGE = max(1, min(max_st + 1, int(params["stage"])))
                        IS_REVEALED = False
                        IS_LOCKED = False
                self.send_json_response(build_status_json(CURRENT_STAGE))
                return

            if url_path == "/api/admin/lock":
                with state_lock:
                    if "stage" in params:
                        max_st = get_max_stages_for_unit(CURRENT_UNIT)
                        CURRENT_STAGE = max(1, min(max_st + 1, int(params["stage"])))
                    IS_LOCKED = True
                self.send_json_response(build_status_json(CURRENT_STAGE))
                return

            if url_path == "/api/admin/unlock":
                with state_lock:
                    if "stage" in params:
                        max_st = get_max_stages_for_unit(CURRENT_UNIT)
                        CURRENT_STAGE = max(1, min(max_st + 1, int(params["stage"])))
                    IS_LOCKED = False
                self.send_json_response(build_status_json(CURRENT_STAGE))
                return

            if url_path == "/api/admin/reveal":
                with state_lock:
                    if "stage" in params:
                        max_st = get_max_stages_for_unit(CURRENT_UNIT)
                        CURRENT_STAGE = max(1, min(max_st + 1, int(params["stage"])))
                    IS_LOCKED = True
                    IS_REVEALED = True
                self.send_json_response(build_status_json(CURRENT_STAGE))
                return

            if url_path == "/api/admin/reset_votes":
                clear_stu = params.get("clear_students", "true").lower() in ("1", "true")
                reset_votes(clear_stu)
                self.send_json_response(build_lobby_json())
                return

            if url_path == "/api/admin/clear_students":
                reset_votes(True)
                self.send_json_response(build_lobby_json())
                return

        if url_path == "/api/submit_attempt":
            self.send_json_response({"status": "ok"})
            return

        # -----------------
        # 靜態檔案伺服
        # -----------------
        if url_path in ("", "/"):
            self.path = "/index.html"
        super().do_GET()


def run():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, WebPlatformHandler)
    print("=" * 60)
    print("  🍎 輔英科技大學 - 營養教學平台 (雲端伺服器)")
    print(f"  🚀 學生前台網址: http://localhost:{PORT}/index.html")
    print(f"  🕹️ 教師控制後台: http://localhost:{PORT}/admin.html")
    print(f"  🔐 教師預設密碼: {ADMIN_SECRET}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已正常停止。")

if __name__ == "__main__":
    run()
