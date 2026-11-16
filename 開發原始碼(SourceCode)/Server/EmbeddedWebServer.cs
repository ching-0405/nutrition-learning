using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using NutritionQRHub.Database;

namespace NutritionQRHub.Server
{
    public class StudentInfo
    {
        public string ClientId { get; set; }
        public string Nickname { get; set; }
        public string Avatar { get; set; }
        public string Gender { get; set; }
        public int TeamId { get; set; }
        public string TeamName { get; set; }
        public int Score { get; set; }
        public int CorrectCount { get; set; }
        public DateTime JoinedAt { get; set; }
    }

    public class EmbeddedWebServer
    {
        private TcpListener _tcpListener;
        private Thread _serverThread;
        private bool _isRunning;
        private readonly string _webRoot;
        private int _port;
        private readonly DatabaseManager _dbManager;
        private static DatabaseManager _staticDbManager;

        // Thread-safe classroom voting & master control state
        private static readonly object _stateLock = new object();
        public static string SessionId = Guid.NewGuid().ToString("N");

        public static string CurrentUnit = "must";
        public static string CurrentUnitTitle = "【單元一 營養照顧流程】";
        public static int CurrentStage = 1; // Current question, or max + 1 for the leaderboard
        public static bool IsGameStarted = false; // Controlled by Teacher
        public static string GameMode = "individual"; // Default: 🏆 個人競賽模式
        public static int TeamCount = 2; // Auto-assigned by student count
        public static bool IsRevealed = false;
        public static bool IsLocked = false;

        // Registered Students
        public static Dictionary<string, StudentInfo> Students = new Dictionary<string, StudentInfo>();
        public static readonly string[] TeamNames = new string[] {
            "🍎 活力蘋果隊",
            "🥦 健康椰菜隊",
            "🥕 元氣蘿蔔隊",
            "🫐 夢幻藍莓隊",
            "🥑 陽光酪梨隊",
            "🍓 熱情草莓隊"
        };

        // Voting dictionaries: stage -> option -> count
        public static Dictionary<int, Dictionary<string, int>> VotesByStage = new Dictionary<int, Dictionary<string, int>>();
        public static Dictionary<string, string> ClientVotes = new Dictionary<string, string>();

        public int Port { get { return _port; } }
        public string LanIp { get; private set; }

        public EmbeddedWebServer(string webRoot, int port, DatabaseManager dbManager)
        {
            _webRoot = webRoot;
            _port = port;
            _dbManager = dbManager;
            _staticDbManager = dbManager;
            LanIp = GetLocalIpAddress();

            lock (_stateLock)
            {
                ResetGameStateInternal();
            }
        }

        private static void ResetGameStateInternal()
        {
            CurrentStage = 1;
            IsGameStarted = false;
            IsRevealed = false;
            Students.Clear();
            VotesByStage.Clear();
            ClientVotes.Clear();
        }

        public void Start()
        {
            SessionId = Guid.NewGuid().ToString("N");
            lock (_stateLock)
            {
                ResetGameStateInternal();
            }

            int attempts = 0;
            int currentPort = _port;
            while (attempts < 10)
            {
                try
                {
                    _tcpListener = new TcpListener(IPAddress.Any, currentPort);
                    _tcpListener.Server.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
                    _tcpListener.Start();
                    _port = currentPort;
                    _isRunning = true;
                    _serverThread = new Thread(ListenLoop);
                    _serverThread.IsBackground = true;
                    _serverThread.Start();
                    break;
                }
                catch (Exception ex)
                {
                    attempts++;
                    try { File.AppendAllText("server_error.log", string.Format("[{0}] Port {1} bind failed: {2}\r\n", DateTime.Now, currentPort, ex.Message)); } catch {}
                    currentPort++;
                }
            }
        }

        public void Stop()
        {
            _isRunning = false;
            SessionId = "";
            lock (_stateLock)
            {
                Students.Clear();
            }
            try
            {
                if (_tcpListener != null)
                {
                    _tcpListener.Stop();
                }
            }
            catch {}
        }

        private void ListenLoop()
        {
            while (_isRunning)
            {
                try
                {
                    TcpClient client = _tcpListener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(ProcessClient, client);
                }
                catch
                {
                    if (!_isRunning) break;
                }
            }
        }

        private void ProcessClient(object state)
        {
            TcpClient client = (TcpClient)state;
            try
            {
                using (NetworkStream stream = client.GetStream())
                {
                    const int maxHeaderBytes = 65536;
                    byte[] buffer = new byte[maxHeaderBytes];
                    int bytesRead = 0;
                    int headerEnd = -1;
                    while (bytesRead < buffer.Length && headerEnd < 0)
                    {
                        int read = stream.Read(buffer, bytesRead, Math.Min(4096, buffer.Length - bytesRead));
                        if (read <= 0) return;
                        bytesRead += read;
                        headerEnd = FindHeaderEnd(buffer, bytesRead);
                    }
                    if (headerEnd < 0) return;

                    string requestHeader = Encoding.UTF8.GetString(buffer, 0, headerEnd);
                    string[] lines = requestHeader.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                    if (lines.Length == 0) return;

                    int contentLength = 0;
                    for (int i = 1; i < lines.Length; i++)
                    {
                        if (lines[i].StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                        {
                            int.TryParse(lines[i].Substring("Content-Length:".Length).Trim(), out contentLength);
                            break;
                        }
                    }
                    if (contentLength < 0 || contentLength > 32768) return;
                    byte[] requestBody = new byte[contentLength];
                    int bodyOffset = headerEnd + 4;
                    int bodyBytesRead = Math.Min(contentLength, bytesRead - bodyOffset);
                    if (bodyBytesRead > 0)
                    {
                        Buffer.BlockCopy(buffer, bodyOffset, requestBody, 0, bodyBytesRead);
                    }
                    while (bodyBytesRead < contentLength)
                    {
                        int read = stream.Read(requestBody, bodyBytesRead, contentLength - bodyBytesRead);
                        if (read <= 0) return;
                        bodyBytesRead += read;
                    }

                    string[] requestLine = lines[0].Split(' ');
                    if (requestLine.Length < 2) return;

                    string method = requestLine[0];
                    string rawUrl = requestLine[1];

                    string urlPath = rawUrl;
                    Dictionary<string, string> queryParams = new Dictionary<string, string>();
                    int qIdx = rawUrl.IndexOf('?');
                    if (qIdx >= 0)
                    {
                        urlPath = rawUrl.Substring(0, qIdx);
                        string queryString = rawUrl.Substring(qIdx + 1);
                        AddFormEncodedParameters(queryString, queryParams);
                    }
                    if (contentLength > 0)
                    {
                        AddFormEncodedParameters(Encoding.UTF8.GetString(requestBody), queryParams);
                    }

                    // CORS & Preflight
                    if (method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
                    {
                        SendResponse(stream, "200 OK", "text/plain", new byte[0]);
                        return;
                    }

                    // API: /api/join
                    if (urlPath.Equals("/api/join", StringComparison.OrdinalIgnoreCase))
                    {
                        string clientId = queryParams.ContainsKey("clientId") ? queryParams["clientId"] : Guid.NewGuid().ToString();
                        string nickname = queryParams.ContainsKey("nickname") ? queryParams["nickname"] : "同學";
                        string avatar = queryParams.ContainsKey("avatar") ? queryParams["avatar"] : "🍎";
                        string gender = queryParams.ContainsKey("gender") ? queryParams["gender"] : "female";

                        StudentInfo s = RegisterStudent(clientId, nickname, avatar, gender);
                        string json = string.Format(
                            "{{\"status\":\"ok\",\"clientId\":\"{0}\",\"nickname\":\"{1}\",\"avatar\":\"{2}\",\"gender\":\"{3}\",\"teamId\":{4},\"teamName\":\"{5}\",\"isGameStarted\":{6},\"teamCount\":{7},\"sessionId\":\"{8}\"}}",
                            EscapeJson(s.ClientId),
                            EscapeJson(s.Nickname),
                            EscapeJson(s.Avatar),
                            EscapeJson(s.Gender),
                            s.TeamId,
                            EscapeJson(s.TeamName),
                            IsGameStarted ? "true" : "false",
                            TeamCount,
                            SessionId
                        );
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/lobby_status
                    if (urlPath.Equals("/api/lobby_status", StringComparison.OrdinalIgnoreCase))
                    {
                        string json = BuildLobbyJson();
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/module_details
                    if (urlPath.Equals("/api/module_details", StringComparison.OrdinalIgnoreCase))
                    {
                        string reqUnit = queryParams.ContainsKey("unit") ? queryParams["unit"] : CurrentUnit;
                        int reqStage = CurrentStage;
                        if (queryParams.ContainsKey("stage"))
                        {
                            int parsed;
                            if (int.TryParse(queryParams["stage"], out parsed)) reqStage = parsed;
                        }

                        TeachingModule mod = _dbManager != null ? _dbManager.GetModuleByUnitAndStage(reqUnit, reqStage) : null;
                        string json;
                        if (mod != null)
                        {
                            string correctOpt = DatabaseManager.GetCorrectOptionFromDescription(mod.Description);
                            json = string.Format(
                                "{{\"status\":\"ok\",\"id\":{0},\"unitId\":\"{1}\",\"unitTitle\":\"{2}\",\"title\":\"{3}\",\"courseName\":\"{4}\",\"description\":\"{5}\",\"moduleCode\":\"{6}\",\"correctOption\":\"{7}\"}}",
                                mod.Id,
                                EscapeJson(mod.UnitId),
                                EscapeJson(mod.UnitTitle),
                                EscapeJson(mod.Title),
                                EscapeJson(mod.CourseName),
                                EscapeJson(mod.Description),
                                EscapeJson(mod.ModuleCode),
                                EscapeJson(correctOpt)
                            );
                        }
                        else
                        {
                            json = "{\"status\":\"not_found\"}";
                        }
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/admin/start_game
                    if (urlPath.Equals("/api/admin/start_game", StringComparison.OrdinalIgnoreCase))
                    {
                        string reqMode = null;
                        if (queryParams.ContainsKey("mode")) reqMode = queryParams["mode"];
                        if (queryParams.ContainsKey("unit"))
                        {
                            CurrentUnit = queryParams["unit"];
                            if (_staticDbManager != null)
                            {
                                CurrentUnitTitle = _staticDbManager.GetUnitTitle(CurrentUnit);
                            }
                            else
                            {
                                if (CurrentUnit == "life") CurrentUnitTitle = "【單元十五】人生好難題";
                                else if (CurrentUnit == "dm") CurrentUnitTitle = "【單元六】糖尿病之營養治療";
                                else if (CurrentUnit == "ncp") CurrentUnitTitle = "【單元二】營養照護程序 (NCP) 核心觀念檢定";
                                else if (CurrentUnit == "must") CurrentUnitTitle = "【單元一 營養照顧流程】";
                            }
                        }
                        int reqStage = -1;
                        if (queryParams.ContainsKey("stage"))
                        {
                            int parsedSt;
                            if (int.TryParse(queryParams["stage"], out parsedSt)) reqStage = parsedSt;
                        }
                        StartGame(reqMode, reqStage);
                        string json = BuildLobbyJson();
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/leaderboard (Top 5 students & team standings)
                    if (urlPath.Equals("/api/leaderboard", StringComparison.OrdinalIgnoreCase))
                    {
                        string json = BuildLeaderboardJson();
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/status (Get live stage and vote statistics)
                    if (urlPath.Equals("/api/status", StringComparison.OrdinalIgnoreCase))
                    {
                        int queryStage = CurrentStage;
                        if (queryParams.ContainsKey("stage"))
                        {
                            int parsed;
                            if (int.TryParse(queryParams["stage"], out parsed)) queryStage = parsed;
                        }

                        string queryUnit = CurrentUnit;
                        if (queryParams.ContainsKey("unit") && !string.IsNullOrEmpty(queryParams["unit"]))
                        {
                            queryUnit = queryParams["unit"].Replace("unit_", "");
                        }

                        string json = BuildStatusJson(queryStage, queryUnit);
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/vote (Students submit choice with score tracking)
                    if (urlPath.Equals("/api/vote", StringComparison.OrdinalIgnoreCase))
                    {
                        int stage = CurrentStage;
                        if (queryParams.ContainsKey("stage"))
                        {
                            int.TryParse(queryParams["stage"], out stage);
                        }
                        string option = queryParams.ContainsKey("option") ? queryParams["option"] : "";
                        string cId = queryParams.ContainsKey("clientId") ? queryParams["clientId"] : "client_" + client.Client.RemoteEndPoint.ToString();

                        bool isCorrect = false;
                        int earned = 0;
                        int totalScore = 0;

                        string unit = queryParams.ContainsKey("unit") ? queryParams["unit"] : CurrentUnit;
                        if (!string.IsNullOrEmpty(option))
                        {
                            isCorrect = RecordVote(stage, option, cId, unit, out earned, out totalScore);
                        }

                        string baseJson = BuildStatusJson(stage, unit);
                        // Inject vote feedback fields
                        string respJson = baseJson.Substring(0, baseJson.Length - 1) + string.Format(
                            ",\"isCorrect\":{0},\"scoreEarned\":{1},\"totalScore\":{2}}}",
                            isCorrect ? "true" : "false",
                            earned,
                            totalScore
                        );

                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(respJson));
                        return;
                    }

                    // 嚴格權限驗證：所有 /api/admin/ 控制端點僅允許本機 Localhost 或附帶 role=teacher 驗證之授課教師，杜絕學生手機誤觸跳題
                    if (urlPath.StartsWith("/api/admin/", StringComparison.OrdinalIgnoreCase))
                    {
                        bool isLocal = false;
                        try
                        {
                            var remoteEp = client.Client.RemoteEndPoint as System.Net.IPEndPoint;
                            if (remoteEp != null)
                            {
                                isLocal = System.Net.IPAddress.IsLoopback(remoteEp.Address);
                            }
                        }
                        catch { }
                        bool isTeacher = isLocal || (queryParams.ContainsKey("role") && queryParams["role"].Equals("teacher", StringComparison.OrdinalIgnoreCase));
                        if (!isTeacher)
                        {
                            string errJson = "{\"status\":\"error\",\"message\":\"Unauthorized: Only teacher can control classroom stages\"}";
                            SendResponse(stream, "403 Forbidden", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(errJson));
                            return;
                        }
                    }

                    // API: /api/admin/set_stage
                    if (urlPath.Equals("/api/admin/set_stage", StringComparison.OrdinalIgnoreCase))
                    {
                        if (queryParams.ContainsKey("unit"))
                        {
                            CurrentUnit = queryParams["unit"];
                            if (_staticDbManager != null)
                            {
                                CurrentUnitTitle = _staticDbManager.GetUnitTitle(CurrentUnit);
                            }
                            else
                            {
                                if (CurrentUnit == "life") CurrentUnitTitle = "【單元十五】人生好難題";
                                else if (CurrentUnit == "dm") CurrentUnitTitle = "【單元六】糖尿病之營養治療";
                                else if (CurrentUnit == "ncp") CurrentUnitTitle = "【單元二】營養照護程序 (NCP) 核心觀念檢定";
                                else if (CurrentUnit == "must") CurrentUnitTitle = "【單元一 營養照顧流程】";
                            }
                        }
                        if (queryParams.ContainsKey("stage"))
                        {
                            int targetStage;
                            if (int.TryParse(queryParams["stage"], out targetStage))
                            {
                                SetStage(targetStage);
                            }
                        }

                        string json = BuildStatusJson(CurrentStage);
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/admin/lock
                    if (urlPath.Equals("/api/admin/lock", StringComparison.OrdinalIgnoreCase))
                    {
                        lock (_stateLock)
                        {
                            int reqSt;
                            if (queryParams.ContainsKey("stage") && int.TryParse(queryParams["stage"], out reqSt))
                            {
                                int maxSt = GetMaxStagesForUnit(CurrentUnit);
                                CurrentStage = Math.Max(1, Math.Min(maxSt + 1, reqSt));
                            }
                            IsLocked = true;
                        }
                        string json = BuildStatusJson(CurrentStage);
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/admin/unlock
                    if (urlPath.Equals("/api/admin/unlock", StringComparison.OrdinalIgnoreCase))
                    {
                        lock (_stateLock)
                        {
                            int reqSt;
                            if (queryParams.ContainsKey("stage") && int.TryParse(queryParams["stage"], out reqSt))
                            {
                                int maxSt = GetMaxStagesForUnit(CurrentUnit);
                                CurrentStage = Math.Max(1, Math.Min(maxSt + 1, reqSt));
                            }
                            IsLocked = false;
                        }
                        string json = BuildStatusJson(CurrentStage);
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/admin/reveal
                    if (urlPath.Equals("/api/admin/reveal", StringComparison.OrdinalIgnoreCase))
                    {
                        lock (_stateLock)
                        {
                            int reqSt;
                            if (queryParams.ContainsKey("stage") && int.TryParse(queryParams["stage"], out reqSt))
                            {
                                int maxSt = GetMaxStagesForUnit(CurrentUnit);
                                CurrentStage = Math.Max(1, Math.Min(maxSt + 1, reqSt));
                            }
                            IsLocked = true;
                            IsRevealed = true;
                        }
                        string json = BuildStatusJson(CurrentStage);
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/admin/reset_votes
                    if (urlPath.Equals("/api/admin/reset_votes", StringComparison.OrdinalIgnoreCase))
                    {
                        bool clearStudents = true;
                        if (queryParams.ContainsKey("clear_students") && (queryParams["clear_students"] == "0" || queryParams["clear_students"].Equals("false", StringComparison.OrdinalIgnoreCase)))
                        {
                            clearStudents = false;
                        }
                        ResetVotes(clearStudents);
                        string json = BuildLobbyJson();
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/admin/clear_students
                    if (urlPath.Equals("/api/admin/clear_students", StringComparison.OrdinalIgnoreCase))
                    {
                        ResetVotes(true);
                        string json = BuildLobbyJson();
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                        return;
                    }

                    // API: /api/submit_attempt
                    if (urlPath.Equals("/api/submit_attempt", StringComparison.OrdinalIgnoreCase))
                    {
                        if (_dbManager != null)
                        {
                            string studentName = queryParams.ContainsKey("name") ? queryParams["name"] : "線上學員";
                            string studentId = queryParams.ContainsKey("id") ? queryParams["id"] : "";
                            _dbManager.SaveAttempt("CASE_302_GRANDMA", studentName, studentId, 4, "High", 1, 60);
                        }
                        byte[] okBytes = Encoding.UTF8.GetBytes("{\"status\":\"ok\"}");
                        SendResponse(stream, "200 OK", "application/json; charset=utf-8", okBytes);
                        return;
                    }

                    // Static File Handling
                    if (urlPath == "/" || string.IsNullOrEmpty(urlPath))
                    {
                        urlPath = "/index.html";
                    }

                    string relativePath = urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                    string filePath = Path.Combine(_webRoot, relativePath);

                    if (File.Exists(filePath))
                    {
                        byte[] fileBytes = File.ReadAllBytes(filePath);
                        string mime = GetMimeType(Path.GetExtension(filePath));
                        SendResponse(stream, "200 OK", mime, fileBytes);
                    }
                    else
                    {
                        byte[] notFound = Encoding.UTF8.GetBytes("404 Not Found");
                        SendResponse(stream, "404 Not Found", "text/plain", notFound);
                    }
                }
            }
            catch {}
            finally
            {
                try { client.Close(); } catch {}
            }
        }

        private static int FindHeaderEnd(byte[] buffer, int length)
        {
            for (int i = 3; i < length; i++)
            {
                if (buffer[i - 3] == 13 && buffer[i - 2] == 10 &&
                    buffer[i - 1] == 13 && buffer[i] == 10)
                {
                    return i - 3;
                }
            }
            return -1;
        }

        private static void AddFormEncodedParameters(string encodedValues, Dictionary<string, string> parameters)
        {
            string[] pairs = encodedValues.Split('&');
            foreach (string pair in pairs)
            {
                int equalsIndex = pair.IndexOf('=');
                string encodedKey = equalsIndex >= 0 ? pair.Substring(0, equalsIndex) : pair;
                string encodedValue = equalsIndex >= 0 ? pair.Substring(equalsIndex + 1) : "";
                string key = Uri.UnescapeDataString(encodedKey.Replace("+", " "));
                parameters[key] = Uri.UnescapeDataString(encodedValue.Replace("+", " "));
            }
        }

        public static int CalculateAutoTeamCount(int studentCount)
        {
            if (studentCount <= 6) return 2;
            if (studentCount <= 15) return 3;
            if (studentCount <= 28) return 4;
            if (studentCount <= 45) return 5;
            return 6;
        }

        public static StudentInfo RegisterStudent(string clientId, string nickname, string avatar, string gender = "female")
        {
            lock (_stateLock)
            {
                if (Students.ContainsKey(clientId))
                {
                    Students[clientId].Nickname = nickname;
                    Students[clientId].Avatar = avatar;
                    Students[clientId].Gender = gender;
                    return Students[clientId];
                }

                int autoTeams = CalculateAutoTeamCount(Students.Count + 1);
                TeamCount = autoTeams;

                // Find smallest team
                int[] teamSizes = new int[TeamCount];
                foreach (var s in Students.Values)
                {
                    if (s.TeamId >= 0 && s.TeamId < TeamCount) teamSizes[s.TeamId]++;
                }

                int minTeam = 0;
                int minSize = int.MaxValue;
                for (int i = 0; i < TeamCount; i++)
                {
                    if (teamSizes[i] < minSize)
                    {
                        minSize = teamSizes[i];
                        minTeam = i;
                    }
                }

                var info = new StudentInfo
                {
                    ClientId = clientId,
                    Nickname = nickname,
                    Avatar = avatar,
                    Gender = gender,
                    TeamId = (GameMode == "team") ? minTeam : 0,
                    TeamName = (GameMode == "team") ? TeamNames[minTeam % TeamNames.Length] : "",
                    Score = 0,
                    CorrectCount = 0,
                    JoinedAt = DateTime.Now
                };

                Students[clientId] = info;
                return info;
            }
        }

        public static void StartGame(string mode = null, int startStage = -1)
        {
            lock (_stateLock)
            {
                if (!string.IsNullOrEmpty(mode))
                {
                    GameMode = mode;
                }
                int count = Students.Count;
                TeamCount = CalculateAutoTeamCount(count);
                IsGameStarted = true;
                if (startStage > 0)
                {
                    CurrentStage = startStage;
                }
                else if (CurrentStage <= 0)
                {
                    CurrentStage = 1;
                }
                IsRevealed = false;
                IsLocked = false;

                if (GameMode == "team")
                {
                    // Shuffle and distribute evenly
                    var rand = new Random();
                    var list = new List<StudentInfo>(Students.Values);
                    for (int i = list.Count - 1; i > 0; i--)
                    {
                        int k = rand.Next(i + 1);
                        var temp = list[i];
                        list[i] = list[k];
                        list[k] = temp;
                    }

                    for (int i = 0; i < list.Count; i++)
                    {
                        int tId = i % TeamCount;
                        list[i].TeamId = tId;
                        list[i].TeamName = TeamNames[tId % TeamNames.Length];
                    }
                }
                else
                {
                    // Individual mode
                    foreach (var s in Students.Values)
                    {
                        s.TeamId = 0;
                        s.TeamName = "";
                    }
                }
            }
        }

        public static int GetMaxStagesForUnit(string unit)
        {
            if (_staticDbManager != null)
            {
                int c = _staticDbManager.GetStageCountForUnit(unit);
                if (c > 0) return c;
            }
            if (unit == "life") return 1;
            if (unit == "support") return 11;
            if (unit == "ncp") return 2;
            if (unit == "dm") return 12;
            if (unit == "curriculum_03" || unit == "unit_curriculum_03") return 6;
            if (unit == "curriculum_07" || unit == "unit_curriculum_07") return 6;
            if (unit == "bfbbb5" || unit == "unit_bfbbb5") return 1;
            return 7; // default must (4 MUST + 2 NCP + 1 King)
        }

        public static void SetStage(int stage)
        {
            lock (_stateLock)
            {
                int maxSt = GetMaxStagesForUnit(CurrentUnit);
                CurrentStage = Math.Max(1, Math.Min(maxSt + 1, stage));
                IsRevealed = false;
                IsLocked = false;
            }
        }

        public static void AdvanceStage()
        {
            lock (_stateLock)
            {
                int maxSt = GetMaxStagesForUnit(CurrentUnit);
                if (CurrentStage < maxSt + 1) CurrentStage++;
                IsRevealed = false;
                IsLocked = false;
            }
        }

        public static void PreviousStage()
        {
            lock (_stateLock)
            {
                if (CurrentStage > 1) CurrentStage--;
                IsRevealed = false;
                IsLocked = false;
            }
        }

        public static void ToggleReveal()
        {
            lock (_stateLock)
            {
                IsRevealed = !IsRevealed;
            }
        }

        public static string GetStageAnswerInfo(string unit, int stage)
        {
            if (string.IsNullOrEmpty(unit)) unit = CurrentUnit;
            if (_staticDbManager != null)
            {
                try
                {
                    var mod = _staticDbManager.GetModuleByUnitAndStage(unit, stage);
                    if (mod != null && !string.IsNullOrEmpty(mod.Description))
                    {
                        var lines = mod.Description.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                        foreach (var line in lines)
                        {
                            if (line.Contains("(正確答案)") || line.Contains("（正確答案）") || line.Contains("【正確答案】"))
                            {
                                return line.Trim();
                            }
                        }
                    }
                }
                catch { }
            }

            // Fallback for built-in units
            if (unit == "must")
            {
                if (stage == 1) return "選項 2：BMI 18.5 ~ 20 (得分 1 分)";
                if (stage == 2) return "選項 2：流失 10 ~ 15% (得分 2 分)";
                if (stage == 3) return "選項 2：有急性疾病且預期禁食 > 5 天 (得分 2 分)";
                if (stage == 4) return "選項 3：總分 5 分 ‧ 高度營養不良風險 (評估得分 2 分)";
                if (stage == 5) return "選項 1：A (Assessment) 評估 ➔ D (Diagnosis) 診斷 ➔ I (Intervention) 介入 ➔ M/E 監測與評估";
                if (stage == 6) return "選項 2：營養診斷（Diagnosis）由醫師全權決定，營養師不得自行命名 PES";
                if (stage == 7) return "選項 4：藥物";
            }
            else if (unit == "support")
            {
                if (stage == 1) return "選項 4：導管插入部位出現滲漏";
                if (stage == 2) return "選項 4：檢查胃殘餘量";
                if (stage == 3) return "選項 1：病人是否臥床";
                if (stage == 4) return "選項 3：灌食配方需有 2%至 4%的熱量來自 MCT oil 才能避免必需脂肪酸缺乏";
                if (stage == 5) return "選項 1：casein 酪蛋白";
                if (stage == 6) return "選項 3：避免發生低血糖";
                if (stage == 7) return "選項 1：元素或預解配方";
                if (stage == 8) return "選項 1：原先營養狀態正常的嚴重外傷病人因病情及手術導致過去兩週幾無營養攝入，在開始灌食時也屬高風險族群";
                if (stage == 9) return "選項 1：polymeric formula";
                if (stage == 10) return "選項 4：腸子";
                if (stage == 11) return "選項 2：腸道營養較容易發生感染性併發症";
            }
            else if (unit == "dm")
            {
                if (stage == 1) return "選項 2：自體免疫破壞胰臟 β 細胞，導致胰島素絕對缺乏";
                if (stage == 2) return "選項 1：HbA1c ≥ 6.5%";
                if (stage == 3) return "選項 3：FPG ≥ 126 mg/dL";
                if (stage == 4) return "選項 3：75g OGTT 2小時血漿血糖 ≥ 200 mg/dL";
                if (stage == 5) return "選項 4：高血糖高滲透壓或糖尿病典型症狀合併隨機血糖 ≥ 200 mg/dL";
                if (stage == 6) return "選項 1：確診第 2 型糖尿病，並合併高三酸甘油酯血症";
                if (stage == 7) return "選項 1：HbA1c";
                if (stage == 8) return "選項 4：飯前低血糖反應";
                if (stage == 9) return "選項 3：212 mg/dL (公式 eAG = 28.7 × 9 - 46.7 = 211.6)";
                if (stage == 10) return "選項 4：血脂肪、血壓";
                if (stage == 11) return "選項 2：裸麥麵包";
                if (stage == 12) return "選項 1：梭莫基效應（Somogyi effect）";
            }

            return "已公布正確答案";
        }

        public static void ResetVotes(bool clearStudents = false)
        {
            lock (_stateLock)
            {
                CurrentStage = 1;
                IsGameStarted = false;
                IsRevealed = false;
                IsLocked = false;
                VotesByStage.Clear();
                ClientVotes.Clear();
                if (clearStudents)
                {
                    Students.Clear();
                    SessionId = Guid.NewGuid().ToString("N");
                }
                else
                {
                    foreach (var s in Students.Values)
                    {
                        s.Score = 0;
                        s.CorrectCount = 0;
                    }
                }
            }
        }

        public static bool RecordVote(int stage, string option, string clientId, string unit, out int earnedScore, out int totalScore)
        {
            earnedScore = 0;
            totalScore = 0;
            bool isCorrect = false;

            lock (_stateLock)
            {
                if (IsLocked)
                {
                    if (Students.ContainsKey(clientId)) totalScore = Students[clientId].Score;
                    return false;
                }

                if (string.IsNullOrEmpty(unit)) unit = CurrentUnit;

                if (!VotesByStage.ContainsKey(stage))
                {
                    VotesByStage[stage] = new Dictionary<string, int>();
                }

                string clientKey = string.Format("{0}_{1}_{2}", clientId, unit, stage);
                bool alreadyVoted = ClientVotes.ContainsKey(clientKey);
                string previousOption = alreadyVoted ? ClientVotes[clientKey] : null;

                if (alreadyVoted)
                {
                    if (VotesByStage[stage].ContainsKey(previousOption) && VotesByStage[stage][previousOption] > 0)
                    {
                        VotesByStage[stage][previousOption]--;
                    }
                }

                ClientVotes[clientKey] = option;
                if (!VotesByStage[stage].ContainsKey(option))
                {
                    VotesByStage[stage][option] = 0;
                }
                VotesByStage[stage][option]++;

                string normalizedUnit = unit.ToLowerInvariant();
                if (normalizedUnit.StartsWith("unit_")) normalizedUnit = normalizedUnit.Substring(5);
                int questionPoints = (normalizedUnit == "must") ? 250 : 500;
                string dynamicCorrect = null;
                if (_staticDbManager != null)
                {
                    try
                    {
                        var mod = _staticDbManager.GetModuleByUnitAndStage(unit, stage);
                        if (mod != null && !string.IsNullOrEmpty(mod.Description))
                        {
                            string parsed = DatabaseManager.GetCorrectOptionFromDescription(mod.Description);
                            if (!string.IsNullOrEmpty(parsed))
                            {
                                dynamicCorrect = parsed;
                            }
                        }
                    }
                    catch {                     }
                }

                isCorrect = IsCorrectOption(normalizedUnit, stage, option, dynamicCorrect);

                if (Students.ContainsKey(clientId))
                {
                    var s = Students[clientId];
                    bool wasCorrect = alreadyVoted && IsCorrectOption(normalizedUnit, stage, previousOption, dynamicCorrect);
                    if (isCorrect && !wasCorrect)
                    {
                        s.CorrectCount++;
                        earnedScore = questionPoints;
                        s.Score += earnedScore;
                    }
                    else if (!isCorrect && wasCorrect)
                    {
                        s.CorrectCount = Math.Max(0, s.CorrectCount - 1);
                        earnedScore = -questionPoints;
                        s.Score = Math.Max(0, s.Score - questionPoints);
                    }
                    totalScore = s.Score;
                }

                return isCorrect;
            }
        }

        public static string NormalizeOptionKey(string opt)
        {
            if (string.IsNullOrEmpty(opt)) return "";
            opt = opt.Trim().ToUpperInvariant();
            if (opt.StartsWith("選項") || opt.StartsWith("OPTION"))
            {
                opt = System.Text.RegularExpressions.Regex.Replace(opt, @"^(?:選項|OPTION)\s*", "");
            }
            if (opt == "1" || opt == "A" || opt == "(A)" || opt == "（A）") return "A";
            if (opt == "2" || opt == "B" || opt == "(B)" || opt == "（B）") return "B";
            if (opt == "3" || opt == "C" || opt == "(C)" || opt == "（C）") return "C";
            if (opt == "4" || opt == "D" || opt == "(D)" || opt == "（D）") return "D";
            if (opt == "5" || opt == "E" || opt == "(E)" || opt == "（E）") return "E";
            return opt;
        }

        private static bool IsCorrectOption(string unit, int stage, string option, string dynamicCorrect)
        {
            if (string.IsNullOrEmpty(option)) return false;
            string normUser = NormalizeOptionKey(option);

            if (!string.IsNullOrEmpty(dynamicCorrect))
            {
                string normDyn = NormalizeOptionKey(dynamicCorrect);
                if (normUser == normDyn) return true;
                if (string.Equals(option.Trim(), dynamicCorrect.Trim(), StringComparison.OrdinalIgnoreCase)) return true;
            }

            if (unit == "curriculum_07" || unit == "unit_curriculum_07")
            {
                switch (stage)
                {
                    case 1: return normUser == "B";
                    case 2: return normUser == "C";
                    case 3: return normUser == "C";
                    case 4: return normUser == "A";
                    case 5: return normUser == "D";
                    case 6: return normUser == "C";
                }
            }

            if (unit == "curriculum_03" || unit == "unit_curriculum_03")
            {
                switch (stage)
                {
                    case 1: return normUser == "B";
                    case 2: return normUser == "B";
                    case 3: return normUser == "A";
                    case 4: return normUser == "A";
                    case 5: return normUser == "C";
                    case 6: return normUser == "A";
                }
            }

            if (unit == "support")
            {
                switch (stage)
                {
                    case 1: return normUser == "D";
                    case 2: return normUser == "D";
                    case 3: return normUser == "A";
                    case 4: return normUser == "C";
                    case 5: return normUser == "A";
                    case 6: return normUser == "C";
                    case 7: return normUser == "A";
                    case 8: return normUser == "A";
                    case 9: return normUser == "A";
                    case 10: return normUser == "D";
                    case 11: return normUser == "B";
                    default: return false;
                }
            }

            if (unit == "ncp")
                return (stage == 1 || stage == 2) && (normUser == "A");

            if (unit == "dm")
            {
                switch (stage)
                {
                    case 1: return normUser == "D";
                    case 2: return normUser == "A";
                    case 3: return normUser == "C" || normUser == "A";
                    case 4: return normUser == "D" || normUser == "A";
                    case 5: return normUser == "D";
                    case 6: return normUser == "A";
                    case 7: return normUser == "A";
                    case 8: return normUser == "C";
                    case 9: return normUser == "C";
                    case 10: return normUser == "D";
                    case 11: return normUser == "B" || normUser == "C";
                    case 12: return normUser == "A";
                    default: return false;
                }
            }

            if (unit == "life")
                return stage == 1 && (normUser == "D");

            switch (stage)
            {
                case 1: return normUser == "B";
                case 2: return normUser == "C";
                case 3: return normUser == "B" || normUser == "C";
                case 4: return normUser == "C";
                case 5: return normUser == "A" || normUser == "B";
                case 6: return normUser == "A";
                case 7: return normUser == "D";
                default: return false;
            }
        }

        public static bool RecordVote(int stage, string option, string clientId, out int earnedScore, out int totalScore)
        {
            return RecordVote(stage, option, clientId, CurrentUnit, out earnedScore, out totalScore);
        }

        public static string BuildLobbyJson()
        {
            lock (_stateLock)
            {
                StringBuilder sbStudents = new StringBuilder();
                bool first = true;
                foreach (var s in Students.Values)
                {
                    if (!first) sbStudents.Append(",");
                    first = false;
                    sbStudents.Append(string.Format(
                        "{{\"clientId\":\"{0}\",\"nickname\":\"{1}\",\"avatar\":\"{2}\",\"gender\":\"{3}\",\"teamId\":{4},\"teamName\":\"{5}\",\"score\":{6}}}",
                        EscapeJson(s.ClientId),
                        EscapeJson(s.Nickname),
                        EscapeJson(s.Avatar),
                        EscapeJson(s.Gender),
                        s.TeamId,
                        EscapeJson(s.TeamName),
                        s.Score
                    ));
                }

                return string.Format(
                    "{{\"sessionId\":\"{0}\",\"isGameStarted\":{1},\"gameMode\":\"{2}\",\"teamCount\":{3},\"studentCount\":{4},\"currentStage\":{5},\"currentUnit\":\"{6}\",\"currentUnitTitle\":\"{7}\",\"students\":[{8}]}}",
                    SessionId,
                    IsGameStarted ? "true" : "false",
                    GameMode,
                    TeamCount,
                    Students.Count,
                    CurrentStage,
                    CurrentUnit,
                    EscapeJson(CurrentUnitTitle),
                    sbStudents.ToString()
                );
            }
        }

        public static string BuildLeaderboardJson()
        {
            lock (_stateLock)
            {
                var list = new List<StudentInfo>(Students.Values);
                list.Sort(delegate(StudentInfo a, StudentInfo b) {
                    return b.Score.CompareTo(a.Score);
                });

                // Top 5 Students
                StringBuilder sbTop5 = new StringBuilder();
                int topCount = Math.Min(5, list.Count);
                for (int i = 0; i < topCount; i++)
                {
                    if (i > 0) sbTop5.Append(",");
                    var s = list[i];
                    sbTop5.Append(string.Format(
                        "{{\"rank\":{0},\"nickname\":\"{1}\",\"avatar\":\"{2}\",\"teamName\":\"{3}\",\"score\":{4},\"correctCount\":{5}}}",
                        i + 1,
                        EscapeJson(s.Nickname),
                        EscapeJson(s.Avatar),
                        EscapeJson(s.TeamName),
                        s.Score,
                        s.CorrectCount
                    ));
                }

                // Team Scores Aggregation
                Dictionary<int, int> teamTotals = new Dictionary<int, int>();
                Dictionary<int, int> teamMemberCount = new Dictionary<int, int>();
                for (int i = 0; i < TeamCount; i++)
                {
                    teamTotals[i] = 0;
                    teamMemberCount[i] = 0;
                }

                foreach (var s in Students.Values)
                {
                    int t = s.TeamId;
                    if (t >= 0 && t < TeamCount)
                    {
                        teamTotals[t] += s.Score;
                        teamMemberCount[t]++;
                    }
                }

                StringBuilder sbTeams = new StringBuilder();
                bool firstTeam = true;
                for (int i = 0; i < TeamCount; i++)
                {
                    if (!firstTeam) sbTeams.Append(",");
                    firstTeam = false;
                    sbTeams.Append(string.Format(
                        "{{\"teamId\":{0},\"teamName\":\"{1}\",\"totalScore\":{2},\"memberCount\":{3}}}",
                        i,
                        EscapeJson(TeamNames[i % TeamNames.Length]),
                        teamTotals[i],
                        teamMemberCount[i]
                    ));
                }

                return string.Format(
                    "{{\"gameMode\":\"{0}\",\"totalStudents\":{1},\"top5\":[{2}],\"teams\":[{3}]}}",
                    GameMode,
                    Students.Count,
                    sbTop5.ToString(),
                    sbTeams.ToString()
                );
            }
        }

        public static string BuildStatusJson(int stage, string unit = null)
        {
            string targetUnit = !string.IsNullOrEmpty(unit) ? unit : CurrentUnit;
            lock (_stateLock)
            {
                if (!VotesByStage.ContainsKey(stage))
                {
                    VotesByStage[stage] = new Dictionary<string, int>();
                }

                var stageVotes = VotesByStage[stage];
                int totalVotes = 0;
                string mostVotedOption = "";
                int highestCount = -1;

                foreach (var kvp in stageVotes)
                {
                    totalVotes += kvp.Value;
                    if (kvp.Value > highestCount)
                    {
                        highestCount = kvp.Value;
                        mostVotedOption = kvp.Key;
                    }
                }

                StringBuilder sbOptions = new StringBuilder();
                StringBuilder sbPct = new StringBuilder();
                bool first = true;

                foreach (var kvp in stageVotes)
                {
                    if (!first)
                    {
                        sbOptions.Append(",");
                        sbPct.Append(",");
                    }
                    first = false;

                    double pct = totalVotes > 0 ? ((double)kvp.Value / totalVotes * 100.0) : 0.0;
                    sbOptions.Append(string.Format("\"{0}\":{1}", EscapeJson(kvp.Key), kvp.Value));
                    sbPct.Append(string.Format("\"{0}\":{1:0.0}", EscapeJson(kvp.Key), pct));
                }

                StringBuilder sbStudents = new StringBuilder();
                bool firstStudent = true;
                foreach (var s in Students.Values)
                {
                    if (!firstStudent) sbStudents.Append(",");
                    firstStudent = false;

                    string clientKey = string.Format("{0}_{1}_{2}", s.ClientId, targetUnit, stage);
                    string vote = ClientVotes.ContainsKey(clientKey) ? ClientVotes[clientKey] : "";

                    sbStudents.Append(string.Format(
                        "{{\"clientId\":\"{0}\",\"nickname\":\"{1}\",\"avatar\":\"{2}\",\"gender\":\"{3}\",\"teamId\":{4},\"teamName\":\"{5}\",\"score\":{6},\"vote\":\"{7}\"}}",
                        EscapeJson(s.ClientId),
                        EscapeJson(s.Nickname),
                        EscapeJson(s.Avatar),
                        EscapeJson(s.Gender),
                        s.TeamId,
                        EscapeJson(s.TeamName),
                        s.Score,
                        EscapeJson(vote)
                    ));
                }

                return string.Format(
                    "{{\"sessionId\":\"{0}\",\"stage\":{1},\"currentStage\":{2},\"isGameStarted\":{3},\"gameMode\":\"{4}\",\"teamCount\":{5},\"studentCount\":{6},\"totalVotes\":{7},\"mostVoted\":\"{8}\",\"highestCount\":{9},\"revealed\":{10},\"locked\":{11},\"currentUnit\":\"{12}\",\"currentUnitTitle\":\"{13}\",\"maxStages\":{14},\"options\":{{{15}}},\"percentages\":{{{16}}},\"students\":[{17}]}}",
                    SessionId,
                    stage,
                    CurrentStage,
                    IsGameStarted ? "true" : "false",
                    GameMode,
                    TeamCount,
                    Students.Count,
                    totalVotes,
                    EscapeJson(mostVotedOption),
                    highestCount > 0 ? highestCount : 0,
                    IsRevealed ? "true" : "false",
                    IsLocked ? "true" : "false",
                    CurrentUnit,
                    EscapeJson(CurrentUnitTitle),
                    GetMaxStagesForUnit(targetUnit),
                    sbOptions.ToString(),
                    sbPct.ToString(),
                    sbStudents.ToString()
                );
            }
        }

        private static string EscapeJson(string str)
        {
            if (string.IsNullOrEmpty(str)) return "";
            return str.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n");
        }

        private void SendResponse(Stream stream, string status, string mime, byte[] data)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendFormat("HTTP/1.1 {0}\r\n", status);
            sb.AppendFormat("Content-Type: {0}\r\n", mime);
            sb.AppendFormat("Content-Length: {0}\r\n", data.Length);
            sb.Append("Access-Control-Allow-Origin: *\r\n");
            sb.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
            sb.Append("Access-Control-Allow-Headers: Content-Type\r\n");
            sb.Append("Cache-Control: no-store, no-cache, must-revalidate, max-age=0\r\n");
            sb.Append("Pragma: no-cache\r\n");
            sb.Append("Expires: 0\r\n");
            sb.Append("Connection: close\r\n");
            sb.Append("\r\n");

            byte[] header = Encoding.UTF8.GetBytes(sb.ToString());
            stream.Write(header, 0, header.Length);
            if (data.Length > 0)
            {
                stream.Write(data, 0, data.Length);
            }
            stream.Flush();
        }

        private string GetMimeType(string ext)
        {
            switch (ext.ToLower())
            {
                case ".html": case ".htm": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".wav": return "audio/wav";
                case ".mp3": return "audio/mpeg";
                case ".mp4": return "video/mp4";
                case ".webm": return "video/webm";
                default: return "application/octet-stream";
            }
        }

        private string GetLocalIpAddress()
        {
            try
            {
                var interfaces = NetworkInterface.GetAllNetworkInterfaces();
                foreach (var ni in interfaces)
                {
                    if (ni.OperationalStatus == OperationalStatus.Up &&
                        ni.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                    {
                        var ipProps = ni.GetIPProperties();
                        foreach (var addr in ipProps.UnicastAddresses)
                        {
                            if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                            {
                                string ip = addr.Address.ToString();
                                if (!ip.StartsWith("169.254.") && !ip.StartsWith("127."))
                                {
                                    return ip;
                                }
                            }
                        }
                    }
                }
            }
            catch {}
            return "127.0.0.1";
        }
    }
}
