using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using NutritionQRHub.Database;
using NutritionQRHub.Server;
using NutritionQRHub.Utils;

namespace NutritionQRHub
{
    public class MainForm : Form
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, IntPtr lParam);
        private const int WM_SETICON = 0x80;
        private const int ICON_SMALL = 0;
        private const int ICON_BIG = 1;

        private DatabaseManager _dbManager;
        private EmbeddedWebServer _webServer;
        private List<TeachingModule> _allModules = new List<TeachingModule>();
        private List<TeachingModule> _displayedModules = new List<TeachingModule>();
        private TeachingModule _selectedModule;
        private Process _tunnelProcess;
        private string _tunnelUrl = null;

        // UI Controls
        private Panel _topPanel;
        private Panel _leftPanel;
        private Panel _centerPanel;
        private Panel _rightPanel;
        private Panel _previewContainer;

        private ComboBox _cboCourseFilter;
        private Button _btnAddCourse;
        private ComboBox _cboUnitFilter;
        private ListBox _lstModules;
        private ComboBox _cboMoveTargetCourse;
        private ComboBox _cboMoveTargetUnit;
        private Button _btnMoveToUnit;
        private Button _btnCopyToUnit;
        private PictureBox _pbQrCode;
        private Label _lblTargetUrl;
        private Label _lblModuleTitle;

        private Button _btnCopyQr;
        private Button _btnCopyPptLink;
        private Button _btnCopyUrl;

        private Button _btnZoomQr;

        private Button _btnAddUnit;
        private Button _btnAddQuestion;
        private Button _btnDeleteModule;
        private Button _btnEditUnit;
        private Button _btnEditUnitDefinition;
        private Button _btnOpenBrowser;
        private Button _btnEmbedPpt;
        private Button _btnMobileView;
        private Button _btnDesktopView;
        private Button _btnRefreshPreview;
        private Label _lblStatus;

        // Teacher Live Master Control Panel
        private GroupBox _grpTeacherControl;
        private Label _lblMasterStage;
        private Label _lblMasterVotes;
        private ComboBox _cboGameMode;
        private Button _btnMasterStart;
        private Button _btnMasterNext;
        private Button _btnMasterPrev;
        private Button _btnMasterReveal;
        private Button _btnMasterLeaderboard;
        private Button _btnMasterReset;
        private Timer _masterSyncTimer;

        private WebView2 _webView;
        private string _webViewUserDataFolder;
        private bool _isMobileMode = true;
        private Bitmap _currentQrBitmap;
        private bool _isInitializing = true;
        private bool _isRefreshingMoveTargets;
        private bool _isUpdatingFilters;

        
        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            ApplyWindowIcon();
        }

        private void ApplyWindowIcon()
        {
            try
            {
                if (this.Icon != null && this.IsHandleCreated)
                {
                    SendMessage(this.Handle, WM_SETICON, ICON_BIG, this.Icon.Handle);
                    SendMessage(this.Handle, WM_SETICON, ICON_SMALL, this.Icon.Handle);
                }
            }
            catch { }
        }

        public MainForm()
        {
            _isInitializing = true;
            InitializeApp();
            InitializeComponent();
            LoadData();
            _isInitializing = false;
            EmbeddedWebServer.IsGameStarted = true;
            EmbeddedWebServer.CurrentStage = 1;
            if (_lstModules.Items.Count > 0)
            {
                _lstModules.SelectedIndex = 0;
                EnterSelectedModuleStage();
            }
            UpdateMasterUi();
            RefreshPreview();
        }

        private void InitializeApp()
        {
            Text = "營養教學平台互動教學系統";
            Size = new Size(1200, 720);
            MinimumSize = new Size(960, 560);
            WindowState = FormWindowState.Maximized;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(15, 23, 42);
            ForeColor = Color.FromArgb(248, 250, 252);
            Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Regular);

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string iconPath = Path.Combine(appDir, "營養教學平台.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(appDir, "app.ico");
            }
            if (File.Exists(iconPath))
            {
                try { this.Icon = new Icon(iconPath); } catch { }
            }
            if (this.Icon == null)
            {
                try { this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            }
            ApplyWindowIcon();

            string dbPath = Path.Combine(appDir, "nutrition_hub.db");
            string webPath = Path.Combine(appDir, "web");
            if (!Directory.Exists(webPath))
            {
                string altWeb = Path.Combine(appDir, "..", "..", "web");
                if (Directory.Exists(altWeb)) webPath = Path.GetFullPath(altWeb);
            }

            try
            {
                foreach (var proc in Process.GetProcessesByName("cloudflared"))
                {
                    try { proc.Kill(); } catch { }
                }
            }
            catch { }

            _dbManager = new DatabaseManager(dbPath);
            _webServer = new EmbeddedWebServer(webPath, 5050, _dbManager);
            _webServer.Start();
        }

        private void InitializeComponent()
        {
            // 1. Top Panel
            _topPanel = new Panel();
            _topPanel.Dock = DockStyle.Top;
            _topPanel.Height = 60;
            _topPanel.BackColor = Color.FromArgb(19, 78, 74);
            _topPanel.Padding = new Padding(15, 10, 15, 10);

            var lblHeaderTitle = new Label();
            lblHeaderTitle.Text = "🍎 營養教學平台互動教學系統";
            lblHeaderTitle.Font = new Font("Microsoft JhengHei", 12f, FontStyle.Bold);
            lblHeaderTitle.ForeColor = Color.White;
            lblHeaderTitle.AutoSize = true;
            lblHeaderTitle.Location = new Point(15, 16);

            _btnOpenBrowser = new Button();
            _btnOpenBrowser.Text = "🌐 瀏覽器開啟";
            _btnOpenBrowser.Location = new Point(880, 13);
            _btnOpenBrowser.Size = new Size(115, 32);
            _btnOpenBrowser.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _btnOpenBrowser.BackColor = Color.FromArgb(13, 148, 136);
            _btnOpenBrowser.ForeColor = Color.White;
            _btnOpenBrowser.FlatStyle = FlatStyle.Flat;
            _btnOpenBrowser.Cursor = Cursors.Hand;
            _btnOpenBrowser.Click += (s, e) => {
                string teacherUrl = string.Format("http://127.0.0.1:{0}/index.html?role=teacher", _webServer.Port);
                Process.Start(new ProcessStartInfo(teacherUrl) { UseShellExecute = true });
            };

            _btnEmbedPpt = new Button();
            _btnEmbedPpt.Text = "📽️ 一鍵置入 PPT 投影片";
            _btnEmbedPpt.Location = new Point(1010, 13);
            _btnEmbedPpt.Size = new Size(165, 32);
            _btnEmbedPpt.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _btnEmbedPpt.BackColor = Color.FromArgb(217, 119, 6);
            _btnEmbedPpt.ForeColor = Color.White;
            _btnEmbedPpt.FlatStyle = FlatStyle.Flat;
            _btnEmbedPpt.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnEmbedPpt.Cursor = Cursors.Hand;
            _btnEmbedPpt.Click += BtnEmbedPpt_Click;

            _topPanel.Controls.Add(lblHeaderTitle);
            _topPanel.Controls.Add(_btnOpenBrowser);
            _topPanel.Controls.Add(_btnEmbedPpt);

            // 2. Right Panel (formerly Left Panel: Modules list & Master Control) -> Moved to RIGHT
            _leftPanel = new Panel();
            _leftPanel.Dock = DockStyle.Right;
            _leftPanel.Width = 365;
            _leftPanel.BackColor = Color.FromArgb(30, 41, 59);
            _leftPanel.Padding = new Padding(12);
            _leftPanel.AutoScroll = true;

            var lblModulesTitle = new Label();
            lblModulesTitle.Text = "📚 課程教學單元與題目清單：";
            lblModulesTitle.Font = new Font("Microsoft JhengHei", 10f, FontStyle.Bold);
            lblModulesTitle.ForeColor = Color.FromArgb(148, 163, 184);
            lblModulesTitle.Dock = DockStyle.Top;
            lblModulesTitle.Height = 22;

            var pnlModuleAction = new Panel();
            pnlModuleAction.Dock = DockStyle.Top;
            pnlModuleAction.Height = 66;
            pnlModuleAction.Padding = new Padding(0, 2, 0, 2);

            _btnAddUnit = new Button();
            _btnAddUnit.Text = "➕ 新增單元";
            _btnAddUnit.Location = new Point(0, 2);
            _btnAddUnit.Size = new Size(108, 28);
            _btnAddUnit.BackColor = Color.FromArgb(13, 148, 136);
            _btnAddUnit.ForeColor = Color.White;
            _btnAddUnit.FlatStyle = FlatStyle.Flat;
            _btnAddUnit.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnAddUnit.Cursor = Cursors.Hand;
            _btnAddUnit.Click += (s, e) => ShowAddUnitOnlyDialog();

            _btnAddQuestion = new Button();
            _btnAddQuestion.Text = "➕ 新增題目";
            _btnAddQuestion.Location = new Point(114, 2);
            _btnAddQuestion.Size = new Size(108, 28);
            _btnAddQuestion.BackColor = Color.FromArgb(13, 148, 136);
            _btnAddQuestion.ForeColor = Color.White;
            _btnAddQuestion.FlatStyle = FlatStyle.Flat;
            _btnAddQuestion.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnAddQuestion.Cursor = Cursors.Hand;
            _btnAddQuestion.Click += (s, e) => ShowAddQuestionDialog();

            _btnDeleteModule = new Button();
            _btnDeleteModule.Text = "🗑️ 刪除題目";
            _btnDeleteModule.Location = new Point(228, 2);
            _btnDeleteModule.Size = new Size(112, 28);
            _btnDeleteModule.BackColor = Color.FromArgb(225, 29, 72);
            _btnDeleteModule.ForeColor = Color.White;
            _btnDeleteModule.FlatStyle = FlatStyle.Flat;
            _btnDeleteModule.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnDeleteModule.Cursor = Cursors.Hand;
            _btnDeleteModule.Click += (s, e) => DeleteSelectedModule();

            _btnEditUnit = new Button();
            _btnEditUnit.Text = "✏️ 編輯題目";
            _btnEditUnit.Location = new Point(0, 34);
            _btnEditUnit.Size = new Size(165, 28);
            _btnEditUnit.BackColor = Color.FromArgb(217, 119, 6);
            _btnEditUnit.ForeColor = Color.White;
            _btnEditUnit.FlatStyle = FlatStyle.Flat;
            _btnEditUnit.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnEditUnit.Cursor = Cursors.Hand;
            _btnEditUnit.Click += (s, e) => ShowEditModuleDialog();

            _btnEditUnitDefinition = new Button();
            _btnEditUnitDefinition.Text = "✏️ 修改單元";
            _btnEditUnitDefinition.Location = new Point(175, 34);
            _btnEditUnitDefinition.Size = new Size(165, 28);
            _btnEditUnitDefinition.BackColor = Color.FromArgb(217, 119, 6);
            _btnEditUnitDefinition.ForeColor = Color.White;
            _btnEditUnitDefinition.FlatStyle = FlatStyle.Flat;
            _btnEditUnitDefinition.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnEditUnitDefinition.Cursor = Cursors.Hand;
            _btnEditUnitDefinition.Click += (s, e) => ShowEditUnitDialog();

            pnlModuleAction.Controls.Add(_btnAddUnit);
            pnlModuleAction.Controls.Add(_btnAddQuestion);
            pnlModuleAction.Controls.Add(_btnDeleteModule);
            pnlModuleAction.Controls.Add(_btnEditUnit);
            pnlModuleAction.Controls.Add(_btnEditUnitDefinition);

            // 科目選擇 / 篩選面板
            var pnlCourseFilter = new Panel();
            pnlCourseFilter.Dock = DockStyle.Top;
            pnlCourseFilter.Height = 32;
            pnlCourseFilter.Padding = new Padding(0, 2, 0, 2);

            var lblCourse = new Label();
            lblCourse.Text = "科目：";
            lblCourse.ForeColor = Color.FromArgb(56, 189, 248);
            lblCourse.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            lblCourse.AutoSize = true;
            lblCourse.Location = new Point(0, 6);

            _cboCourseFilter = new ComboBox();
            _cboCourseFilter.DropDownStyle = ComboBoxStyle.DropDownList;
            _cboCourseFilter.Font = new Font("Microsoft JhengHei", 9f);
            _cboCourseFilter.BackColor = Color.FromArgb(15, 23, 42);
            _cboCourseFilter.ForeColor = Color.White;
            _cboCourseFilter.Location = new Point(48, 3);
            _cboCourseFilter.Width = 205;
            _cboCourseFilter.SelectedIndexChanged += (s, e) => OnCourseFilterChanged();

            _btnAddCourse = new Button();
            _btnAddCourse.Text = "➕ 新增科目";
            _btnAddCourse.Location = new Point(258, 3);
            _btnAddCourse.Size = new Size(82, 25);
            _btnAddCourse.BackColor = Color.FromArgb(13, 148, 136);
            _btnAddCourse.ForeColor = Color.White;
            _btnAddCourse.FlatStyle = FlatStyle.Flat;
            _btnAddCourse.Font = new Font("Microsoft JhengHei", 8f, FontStyle.Bold);
            _btnAddCourse.Cursor = Cursors.Hand;
            _btnAddCourse.Click += (s, e) => ShowAddCourseDialog();

            pnlCourseFilter.Controls.Add(lblCourse);
            pnlCourseFilter.Controls.Add(_cboCourseFilter);
            pnlCourseFilter.Controls.Add(_btnAddCourse);

            // 單元選擇 / 篩選面板
            var pnlUnitFilter = new Panel();
            pnlUnitFilter.Dock = DockStyle.Top;
            pnlUnitFilter.Height = 32;
            pnlUnitFilter.Padding = new Padding(0, 2, 0, 2);

            var lblFilter = new Label();
            lblFilter.Text = "單元：";
            lblFilter.ForeColor = Color.FromArgb(253, 224, 71);
            lblFilter.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            lblFilter.AutoSize = true;
            lblFilter.Location = new Point(0, 6);

            _cboUnitFilter = new ComboBox();
            _cboUnitFilter.DropDownStyle = ComboBoxStyle.DropDownList;
            _cboUnitFilter.Font = new Font("Microsoft JhengHei", 9f);
            _cboUnitFilter.BackColor = Color.FromArgb(15, 23, 42);
            _cboUnitFilter.ForeColor = Color.White;
            _cboUnitFilter.Location = new Point(48, 3);
            _cboUnitFilter.Width = 292;
            _cboUnitFilter.SelectedIndexChanged += (s, e) => ApplyUnitFilter();

            pnlUnitFilter.Controls.Add(lblFilter);
            pnlUnitFilter.Controls.Add(_cboUnitFilter);

            _lstModules = new ListBox();
            _lstModules.Dock = DockStyle.Top;
            _lstModules.Height = 135;
            _lstModules.BackColor = Color.FromArgb(15, 23, 42);
            _lstModules.ForeColor = Color.FromArgb(226, 232, 240);
            _lstModules.BorderStyle = BorderStyle.FixedSingle;
            _lstModules.Font = new Font("Microsoft JhengHei", 9f);
            _lstModules.SelectedIndexChanged += (s, e) => OnModuleSelected();
            _lstModules.Click += (s, e) => {
                EnterSelectedModuleStage();
            };
            _lstModules.MouseDoubleClick += (s, e) => {
                EnterSelectedModuleStage();
            };

            // 移動與複製題目至單元面板
            var pnlMove = new Panel();
            pnlMove.Dock = DockStyle.Top;
            pnlMove.Height = 60;
            pnlMove.Padding = new Padding(0, 2, 0, 2);

            _cboMoveTargetCourse = new ComboBox();
            _cboMoveTargetCourse.DropDownStyle = ComboBoxStyle.DropDownList;
            _cboMoveTargetCourse.Font = new Font("Microsoft JhengHei", 8.5f);
            _cboMoveTargetCourse.BackColor = Color.FromArgb(15, 23, 42);
            _cboMoveTargetCourse.ForeColor = Color.White;
            _cboMoveTargetCourse.Location = new Point(0, 3);
            _cboMoveTargetCourse.Width = 135;
            _cboMoveTargetCourse.DropDownWidth = 250;
            _cboMoveTargetCourse.SelectedIndexChanged += (s, e) =>
            {
                if (!_isRefreshingMoveTargets) ReloadMoveTargetUnits(null);
            };

            _cboMoveTargetUnit = new ComboBox();
            _cboMoveTargetUnit.DropDownStyle = ComboBoxStyle.DropDownList;
            _cboMoveTargetUnit.Font = new Font("Microsoft JhengHei", 8.5f);
            _cboMoveTargetUnit.BackColor = Color.FromArgb(15, 23, 42);
            _cboMoveTargetUnit.ForeColor = Color.White;
            _cboMoveTargetUnit.Location = new Point(140, 3);
            _cboMoveTargetUnit.Width = 200;
            _cboMoveTargetUnit.DropDownWidth = 330;

            _btnMoveToUnit = new Button();
            _btnMoveToUnit.Text = "↔️ 移動題目至目標單元";
            _btnMoveToUnit.Location = new Point(0, 31);
            _btnMoveToUnit.Size = new Size(165, 26);
            _btnMoveToUnit.BackColor = Color.FromArgb(37, 99, 235);
            _btnMoveToUnit.ForeColor = Color.White;
            _btnMoveToUnit.FlatStyle = FlatStyle.Flat;
            _btnMoveToUnit.Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold);
            _btnMoveToUnit.Cursor = Cursors.Hand;
            _btnMoveToUnit.Click += BtnMoveToUnit_Click;

            _btnCopyToUnit = new Button();
            _btnCopyToUnit.Text = "📋 複製題目至目標單元";
            _btnCopyToUnit.Location = new Point(175, 31);
            _btnCopyToUnit.Size = new Size(165, 26);
            _btnCopyToUnit.BackColor = Color.FromArgb(13, 148, 136);
            _btnCopyToUnit.ForeColor = Color.White;
            _btnCopyToUnit.FlatStyle = FlatStyle.Flat;
            _btnCopyToUnit.Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold);
            _btnCopyToUnit.Cursor = Cursors.Hand;
            _btnCopyToUnit.Click += BtnCopyToUnit_Click;

            pnlMove.Controls.Add(_cboMoveTargetCourse);
            pnlMove.Controls.Add(_cboMoveTargetUnit);
            pnlMove.Controls.Add(_btnMoveToUnit);
            pnlMove.Controls.Add(_btnCopyToUnit);

            // Teacher Live Master Control Panel
            _grpTeacherControl = new GroupBox();
            _grpTeacherControl.Text = "🎮 授課教師課堂即時主控台 (Master Control)";
            _grpTeacherControl.Dock = DockStyle.Top;
            _grpTeacherControl.Height = 275;
            _grpTeacherControl.ForeColor = Color.FromArgb(253, 224, 71);
            _grpTeacherControl.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _grpTeacherControl.Padding = new Padding(8);

            _cboGameMode = new ComboBox();
            _cboGameMode.DropDownStyle = ComboBoxStyle.DropDownList;
            _cboGameMode.Items.Add("🏆 個人競賽模式");
            _cboGameMode.Items.Add("⚔️ 隨機分組對抗 (由參與人數自動分配組數)");
            _cboGameMode.SelectedIndex = 0;
            _cboGameMode.Location = new Point(10, 20);
            _cboGameMode.Size = new Size(322, 24);
            _cboGameMode.SelectedIndexChanged += (s, e) => {
                string mode = _cboGameMode.SelectedIndex == 0 ? "individual" : "team";
                EmbeddedWebServer.GameMode = mode;
            };

            _lblMasterStage = new Label();
            _lblMasterStage.Text = "狀態：等候大廳 (等待點擊開始)";
            _lblMasterStage.ForeColor = Color.FromArgb(56, 189, 248);
            _lblMasterStage.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _lblMasterStage.Location = new Point(10, 47);
            _lblMasterStage.Size = new Size(322, 20);

            _lblMasterVotes = new Label();
            _lblMasterVotes.Text = "在線人數：0 人 ｜ 投票：0 人";
            _lblMasterVotes.ForeColor = Color.FromArgb(148, 163, 184);
            _lblMasterVotes.Font = new Font("Microsoft JhengHei", 8.5f);
            _lblMasterVotes.Location = new Point(10, 68);
            _lblMasterVotes.Size = new Size(322, 32);

            _btnMasterStart = new Button();
            _btnMasterStart.Text = "🚀 全員到齊，開始遊戲！";
            _btnMasterStart.Location = new Point(10, 102);
            _btnMasterStart.Size = new Size(322, 32);
            _btnMasterStart.BackColor = Color.FromArgb(16, 185, 129);
            _btnMasterStart.ForeColor = Color.White;
            _btnMasterStart.FlatStyle = FlatStyle.Flat;
            _btnMasterStart.Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold);
            _btnMasterStart.Cursor = Cursors.Hand;
            _btnMasterStart.Click += (s, e) => {
                string mode = _cboGameMode.SelectedIndex == 0 ? "individual" : "team";
                int targetStage = -1;
                if (_selectedModule != null)
                {
                    if (!string.IsNullOrEmpty(_selectedModule.UnitId))
                    {
                        EmbeddedWebServer.CurrentUnit = _selectedModule.UnitId.Replace("unit_", "");
                    }
                    EmbeddedWebServer.CurrentUnitTitle = _selectedModule.UnitTitle;
                    var mStage = System.Text.RegularExpressions.Regex.Match(_selectedModule.LocalRoute ?? "", @"stage=(\d+)");
                    if (mStage.Success)
                    {
                        int stParsed;
                        if (int.TryParse(mStage.Groups[1].Value, out stParsed)) targetStage = stParsed;
                    }
                }
                EmbeddedWebServer.StartGame(mode, targetStage);
                UpdateMasterUi();
                RefreshPreview();
            };

            _btnMasterNext = new Button();
            _btnMasterNext.Text = "⏭️ 推進至下一關 (廣播全班)";
            _btnMasterNext.Location = new Point(10, 137);
            _btnMasterNext.Size = new Size(322, 30);
            _btnMasterNext.BackColor = Color.FromArgb(13, 148, 136);
            _btnMasterNext.ForeColor = Color.White;
            _btnMasterNext.FlatStyle = FlatStyle.Flat;
            _btnMasterNext.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnMasterNext.Cursor = Cursors.Hand;
            _btnMasterNext.Click += (s, e) => {
                EmbeddedWebServer.AdvanceStage();
                UpdateMasterUi();
                RefreshPreview();
            };

            _btnMasterPrev = new Button();
            _btnMasterPrev.Text = "◀ 上一關";
            _btnMasterPrev.Location = new Point(10, 170);
            _btnMasterPrev.Size = new Size(155, 28);
            _btnMasterPrev.BackColor = Color.FromArgb(51, 65, 85);
            _btnMasterPrev.ForeColor = Color.White;
            _btnMasterPrev.FlatStyle = FlatStyle.Flat;
            _btnMasterPrev.Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold);
            _btnMasterPrev.Cursor = Cursors.Hand;
            _btnMasterPrev.Click += (s, e) => {
                EmbeddedWebServer.PreviousStage();
                UpdateMasterUi();
                RefreshPreview();
            };

            _btnMasterReveal = new Button();
            _btnMasterReveal.Text = "📢 公佈統計";
            _btnMasterReveal.Location = new Point(172, 170);
            _btnMasterReveal.Size = new Size(160, 28);
            _btnMasterReveal.BackColor = Color.FromArgb(14, 165, 233);
            _btnMasterReveal.ForeColor = Color.White;
            _btnMasterReveal.FlatStyle = FlatStyle.Flat;
            _btnMasterReveal.Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold);
            _btnMasterReveal.Cursor = Cursors.Hand;
            _btnMasterReveal.Click += async (s, e) => {
                string currentUnit = (EmbeddedWebServer.CurrentUnit ?? "").Replace("unit_", "");
                bool requiresUnit3Stage6Video =
                    string.Equals(currentUnit, "curriculum_03", StringComparison.OrdinalIgnoreCase) &&
                    EmbeddedWebServer.CurrentStage == 6 &&
                    !EmbeddedWebServer.IsRevealed;
                if (requiresUnit3Stage6Video)
                {
                    if (_webView == null || _webView.CoreWebView2 == null)
                    {
                        MessageBox.Show("課程預覽尚未就緒，未公布答案。請確認預覽載入後再試。",
                            "答案影片尚未播放", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }
                    try
                    {
                        string bridgeResult = await _webView.CoreWebView2.ExecuteScriptAsync(
                            "typeof window.revealAnswersFromNativeControl === 'function' ? window.revealAnswersFromNativeControl() : false;");
                        if (bridgeResult == "true")
                        {
                            UpdateMasterUi();
                            return;
                        }
                        MessageBox.Show("課程預覽尚未載入答案影片流程，未公布答案。請重新載入課程預覽後再試。",
                            "答案影片尚未播放", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("無法啟動答案影片，未公布答案。\n" + ex.Message,
                            "答案影片播放失敗", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                    return;
                }

                EmbeddedWebServer.ToggleReveal();
                UpdateMasterUi();
                try
                {
                    if (_webView != null && _webView.CoreWebView2 != null)
                    {
                        _webView.CoreWebView2.ExecuteScriptAsync("if(typeof window.forceFetchStatus==='function'){window.forceFetchStatus();}");
                    }
                }
                catch { }
            };

            _btnMasterLeaderboard = new Button();
            _btnMasterLeaderboard.Text = "🏆 結算 ‧ 公佈全班 TOP 5 榮譽榜";
            _btnMasterLeaderboard.Location = new Point(10, 202);
            _btnMasterLeaderboard.Size = new Size(322, 30);
            _btnMasterLeaderboard.BackColor = Color.FromArgb(217, 119, 6);
            _btnMasterLeaderboard.ForeColor = Color.White;
            _btnMasterLeaderboard.FlatStyle = FlatStyle.Flat;
            _btnMasterLeaderboard.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnMasterLeaderboard.Cursor = Cursors.Hand;
            _btnMasterLeaderboard.Click += (s, e) => {
                int maxSt = EmbeddedWebServer.GetMaxStagesForUnit(EmbeddedWebServer.CurrentUnit);
                int returnStage = Math.Max(1, Math.Min(EmbeddedWebServer.CurrentStage, maxSt));
                EmbeddedWebServer.SetStage(maxSt + 1); // Triggers final victory & leaderboard
                UpdateMasterUi();
                RefreshPreview(true, returnStage);
            };

            _btnMasterReset = new Button();
            _btnMasterReset.Text = "🔄 重設遊戲 ‧ 返回等候大廳";
            _btnMasterReset.Location = new Point(10, 236);
            _btnMasterReset.Size = new Size(322, 26);
            _btnMasterReset.BackColor = Color.FromArgb(185, 28, 28);
            _btnMasterReset.ForeColor = Color.White;
            _btnMasterReset.FlatStyle = FlatStyle.Flat;
            _btnMasterReset.Font = new Font("Microsoft JhengHei", 8f, FontStyle.Bold);
            _btnMasterReset.Cursor = Cursors.Hand;
            _btnMasterReset.Click += (s, e) => {
                var dr = MessageBox.Show(
                    "確定要重設遊戲並讓全體學生退回等待室重新連線嗎？\n\n（全體學生將被踢回登入室，需重新掃描 QR code 進入，避免重複玩家）",
                    "重設遊戲確認",
                    MessageBoxButtons.OKCancel,
                    MessageBoxIcon.Question
                );

                if (dr == DialogResult.OK)
                {
                    EmbeddedWebServer.ResetVotes(clearStudents: true);
                    UpdateMasterUi();
                    RefreshPreviewToLobby();
                }
            };

            _grpTeacherControl.Controls.Add(_cboGameMode);
            _grpTeacherControl.Controls.Add(_lblMasterStage);
            _grpTeacherControl.Controls.Add(_lblMasterVotes);
            _grpTeacherControl.Controls.Add(_btnMasterStart);
            _grpTeacherControl.Controls.Add(_btnMasterNext);
            _grpTeacherControl.Controls.Add(_btnMasterPrev);
            _grpTeacherControl.Controls.Add(_btnMasterReveal);
            _grpTeacherControl.Controls.Add(_btnMasterLeaderboard);
            _grpTeacherControl.Controls.Add(_btnMasterReset);

            _leftPanel.Controls.Add(_grpTeacherControl);
            _leftPanel.Controls.Add(pnlMove);
            _leftPanel.Controls.Add(_lstModules);
            _leftPanel.Controls.Add(pnlUnitFilter);
            _leftPanel.Controls.Add(pnlCourseFilter);
            _leftPanel.Controls.Add(pnlModuleAction);
            _leftPanel.Controls.Add(lblModulesTitle);

            // Timer for master UI sync
            _masterSyncTimer = new Timer();
            _masterSyncTimer.Interval = 1000;
            _masterSyncTimer.Tick += (s, e) => UpdateMasterUi();
            _masterSyncTimer.Start();

            // 3. QR Code Hub Panel (formerly Right Panel) -> Moved to LEFT
            _rightPanel = new Panel();
            _rightPanel.Dock = DockStyle.Left;
            _rightPanel.Width = 330;
            _rightPanel.BackColor = Color.FromArgb(30, 41, 59);
            _rightPanel.Padding = new Padding(15);

            var lblQrHeader = new Label();
            lblQrHeader.Text = "📱 課堂互動專屬 QR Code";
            lblQrHeader.Font = new Font("Microsoft JhengHei", 11f, FontStyle.Bold);
            lblQrHeader.ForeColor = Color.FromArgb(253, 224, 71);
            lblQrHeader.Dock = DockStyle.Top;
            lblQrHeader.Height = 28;

            _pbQrCode = new PictureBox();
            _pbQrCode.Dock = DockStyle.Top;
            _pbQrCode.Height = 260;
            _pbQrCode.SizeMode = PictureBoxSizeMode.Zoom;
            _pbQrCode.BackColor = Color.White;
            _pbQrCode.BorderStyle = BorderStyle.FixedSingle;

            _lblTargetUrl = new Label();
            _lblTargetUrl.Dock = DockStyle.Top;
            _lblTargetUrl.Height = 44;
            _lblTargetUrl.ForeColor = Color.FromArgb(56, 189, 248);
            _lblTargetUrl.Font = new Font("Share Tech Mono", 9f);
            _lblTargetUrl.Text = "http://127.0.0.1:5050/";
            _lblTargetUrl.Cursor = Cursors.Hand;
            _lblTargetUrl.Click += (s, e) => CopyUrlToClipboard();

            _pbQrCode.Cursor = Cursors.Hand;
            _pbQrCode.Click += (s, e) => ShowEnlargedQrCode();

            var pnlQrButtons = new Panel();
            pnlQrButtons.Dock = DockStyle.Top;
            pnlQrButtons.Height = 152;

            _btnZoomQr = new Button();
            _btnZoomQr.Text = "🔍 點擊放大 QR Code 投影視窗";
            _btnZoomQr.Location = new Point(0, 5);
            _btnZoomQr.Size = new Size(295, 34);
            _btnZoomQr.BackColor = Color.FromArgb(217, 119, 6);
            _btnZoomQr.ForeColor = Color.White;
            _btnZoomQr.FlatStyle = FlatStyle.Flat;
            _btnZoomQr.Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold);
            _btnZoomQr.Cursor = Cursors.Hand;
            _btnZoomQr.Click += (s, e) => ShowEnlargedQrCode();

            _btnCopyQr = new Button();
            _btnCopyQr.Text = "📋 複製題目與 QR Code 圖片";
            _btnCopyQr.Location = new Point(0, 42);
            _btnCopyQr.Size = new Size(295, 32);
            _btnCopyQr.BackColor = Color.FromArgb(13, 148, 136);
            _btnCopyQr.ForeColor = Color.White;
            _btnCopyQr.FlatStyle = FlatStyle.Flat;
            _btnCopyQr.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnCopyQr.Cursor = Cursors.Hand;
            _btnCopyQr.Click += BtnCopyQr_Click;

            _btnCopyPptLink = new Button();
            _btnCopyPptLink.Text = "📋 一鍵複製 PPT 跳題超連結";
            _btnCopyPptLink.Location = new Point(0, 78);
            _btnCopyPptLink.Size = new Size(295, 32);
            _btnCopyPptLink.BackColor = Color.FromArgb(99, 102, 241);
            _btnCopyPptLink.ForeColor = Color.White;
            _btnCopyPptLink.FlatStyle = FlatStyle.Flat;
            _btnCopyPptLink.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnCopyPptLink.Cursor = Cursors.Hand;
            _btnCopyPptLink.Click += (s, e) => CopyPptHyperlinkToClipboard();

            _btnCopyUrl = new Button();
            _btnCopyUrl.Text = "🔗 複製專屬課程連線網址";
            _btnCopyUrl.Location = new Point(0, 114);
            _btnCopyUrl.Size = new Size(295, 32);
            _btnCopyUrl.BackColor = Color.FromArgb(2, 132, 199);
            _btnCopyUrl.ForeColor = Color.White;
            _btnCopyUrl.FlatStyle = FlatStyle.Flat;
            _btnCopyUrl.Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold);
            _btnCopyUrl.Cursor = Cursors.Hand;
            _btnCopyUrl.Click += (s, e) => CopyUrlToClipboard();

            pnlQrButtons.Controls.Add(_btnZoomQr);
            pnlQrButtons.Controls.Add(_btnCopyQr);
            pnlQrButtons.Controls.Add(_btnCopyPptLink);
            pnlQrButtons.Controls.Add(_btnCopyUrl);

            _lblStatus = new Label();
            _lblStatus.Dock = DockStyle.Bottom;
            _lblStatus.Height = 48;
            _lblStatus.ForeColor = Color.FromArgb(52, 211, 153);
            _lblStatus.Font = new Font("Microsoft JhengHei", 9f);
            _lblStatus.Text = "✅ 平台就緒！本地 HTTP 伺服器運行於 Port 5050";

            _rightPanel.Controls.Add(_lblStatus);
            _rightPanel.Controls.Add(pnlQrButtons);
            _rightPanel.Controls.Add(_lblTargetUrl);
            _rightPanel.Controls.Add(_pbQrCode);
            _rightPanel.Controls.Add(lblQrHeader);

            // 4. Center Panel (Live Simulation Preview)
            _centerPanel = new Panel();
            _centerPanel.Dock = DockStyle.Fill;
            _centerPanel.BackColor = Color.FromArgb(15, 23, 42);
            _centerPanel.Padding = new Padding(12);

            var pnlPreviewToolbar = new Panel();
            pnlPreviewToolbar.Dock = DockStyle.Top;
            pnlPreviewToolbar.Height = 40;

            _lblModuleTitle = new Label();
            _lblModuleTitle.Text = "🔍 課堂互動即時預覽 (Live Simulation)";
            _lblModuleTitle.Font = new Font("Microsoft JhengHei", 10.5f, FontStyle.Bold);
            _lblModuleTitle.ForeColor = Color.FromArgb(248, 250, 252);
            _lblModuleTitle.AutoSize = true;
            _lblModuleTitle.Location = new Point(0, 10);

            _btnMobileView = new Button();
            _btnMobileView.Text = "📱 手機視角";
            _btnMobileView.Location = new Point(360, 6);
            _btnMobileView.Size = new Size(90, 28);
            _btnMobileView.BackColor = Color.FromArgb(16, 185, 129);
            _btnMobileView.ForeColor = Color.White;
            _btnMobileView.FlatStyle = FlatStyle.Flat;
            _btnMobileView.Click += (s, e) => SwitchPreviewMode(true);

            _btnDesktopView = new Button();
            _btnDesktopView.Text = "💻 講台大螢幕";
            _btnDesktopView.Location = new Point(458, 6);
            _btnDesktopView.Size = new Size(95, 28);
            _btnDesktopView.BackColor = Color.FromArgb(51, 65, 85);
            _btnDesktopView.ForeColor = Color.White;
            _btnDesktopView.FlatStyle = FlatStyle.Flat;
            _btnDesktopView.Click += (s, e) => SwitchPreviewMode(false);

            _btnRefreshPreview = new Button();
            _btnRefreshPreview.Text = "🔄 重整";
            _btnRefreshPreview.Location = new Point(560, 6);
            _btnRefreshPreview.Size = new Size(65, 28);
            _btnRefreshPreview.BackColor = Color.FromArgb(51, 65, 85);
            _btnRefreshPreview.ForeColor = Color.White;
            _btnRefreshPreview.FlatStyle = FlatStyle.Flat;
            _btnRefreshPreview.Click += (s, e) => RefreshPreview();

            pnlPreviewToolbar.Controls.Add(_lblModuleTitle);
            pnlPreviewToolbar.Controls.Add(_btnMobileView);
            pnlPreviewToolbar.Controls.Add(_btnDesktopView);
            pnlPreviewToolbar.Controls.Add(_btnRefreshPreview);

            _previewContainer = new Panel();
            _previewContainer.Dock = DockStyle.Fill;
            _previewContainer.BackColor = Color.FromArgb(11, 15, 25);
            _previewContainer.BorderStyle = BorderStyle.FixedSingle;

            _centerPanel.Controls.Add(_previewContainer);
            _centerPanel.Controls.Add(pnlPreviewToolbar);

            Controls.Add(_centerPanel);
            Controls.Add(_leftPanel);
            Controls.Add(_rightPanel);
            Controls.Add(_topPanel);

            InitializeBrowser();
        }

        private void UpdateMasterUi()
        {
            if (!EmbeddedWebServer.IsGameStarted)
            {
                _lblMasterStage.Text = "狀態：等候大廳 (等待點擊開始)";
                _lblMasterStage.ForeColor = Color.FromArgb(56, 189, 248);
            }
            else
            {
                int unitMaxSt = EmbeddedWebServer.GetMaxStagesForUnit(EmbeddedWebServer.CurrentUnit);
                if (EmbeddedWebServer.CurrentStage > unitMaxSt)
                {
                    _lblMasterStage.Text = "狀態：🏆 全班結算 ‧ TOP 5 榮譽榜";
                    _lblMasterStage.ForeColor = Color.FromArgb(253, 224, 71);
                }
                else
                {
                    _lblMasterStage.Text = string.Format("狀態：第 {0} 題 (共 {1} 題)", EmbeddedWebServer.CurrentStage, unitMaxSt);
                    _lblMasterStage.ForeColor = Color.FromArgb(52, 211, 153);
                }
            }

            int st = EmbeddedWebServer.CurrentStage;
            int totalV = 0;
            string voteBreakdown = "";
            if (EmbeddedWebServer.VotesByStage.ContainsKey(st))
            {
                var optVotes = EmbeddedWebServer.VotesByStage[st];
                foreach (var v in optVotes.Values) totalV += v;
                var parts = new List<string>();
                foreach (var kvp in optVotes)
                {
                    parts.Add(string.Format("選項{0}: {1}票", kvp.Key, kvp.Value));
                }
                if (parts.Count > 0)
                {
                    voteBreakdown = " (" + string.Join(" ｜ ", parts) + ")";
                }
            }

            if (EmbeddedWebServer.IsRevealed)
            {
                string ansInfo = EmbeddedWebServer.GetStageAnswerInfo(EmbeddedWebServer.CurrentUnit, st);
                _lblMasterVotes.Text = string.Format("在線：{0} 人 ({1}組) ｜ 投票：{2} 人{3}\n✅ 正確答案：{4}",
                    EmbeddedWebServer.Students.Count,
                    EmbeddedWebServer.TeamCount,
                    totalV,
                    voteBreakdown,
                    ansInfo
                );
                _lblMasterVotes.ForeColor = Color.FromArgb(52, 211, 153);
                _btnMasterReveal.Text = "💡 隱藏公布答案";
                _btnMasterReveal.BackColor = Color.FromArgb(16, 185, 129);
            }
            else
            {
                _lblMasterVotes.Text = string.Format("在線學員：{0} 人 (已分 {1} 組)\n本關已投票：{2} 人{3}",
                    EmbeddedWebServer.Students.Count,
                    EmbeddedWebServer.TeamCount,
                    totalV,
                    voteBreakdown
                );
                _lblMasterVotes.ForeColor = Color.FromArgb(148, 163, 184);
                _btnMasterReveal.Text = "📢 公布答案與統計";
                _btnMasterReveal.BackColor = Color.FromArgb(14, 165, 233);
            }
        }

        private void LoadData()
        {
            string prevSelCourse = _cboCourseFilter.SelectedItem != null ? _cboCourseFilter.SelectedItem.ToString() : null;
            _cboCourseFilter.Items.Clear();
            _cboCourseFilter.Items.Add("所有科目");

            var courses = _dbManager.GetAllCourses();
            foreach (var c in courses)
            {
                _cboCourseFilter.Items.Add(c);
            }

            if (prevSelCourse != null && _cboCourseFilter.Items.Contains(prevSelCourse))
            {
                _cboCourseFilter.SelectedItem = prevSelCourse;
            }
            else if (_cboCourseFilter.Items.Count > 1)
            {
                _cboCourseFilter.SelectedIndex = 1; // 預設選中具體科目
            }
            else
            {
                _cboCourseFilter.SelectedIndex = 0;
            }

            ReloadUnitsAndModules();
            StartCloudflareTunnel();
        }

        private void OnCourseFilterChanged()
        {
            ReloadUnitsAndModules();
        }

        private void ReloadUnitsAndModules()
        {
            if (_isUpdatingFilters) return;
            _isUpdatingFilters = true;
            try
            {
                string selCourse = _cboCourseFilter.SelectedItem != null ? _cboCourseFilter.SelectedItem.ToString() : "所有科目";
                _allModules = _dbManager.GetAllModules(selCourse);

                string prevFilterUnitId = null;
                TeachingModule prevSelUnit = _cboUnitFilter.SelectedItem as TeachingModule;
                if (prevSelUnit != null)
                {
                    prevFilterUnitId = prevSelUnit.UnitId;
                }

                string prevMoveUnitId = null;
                var prevMoveItem = _cboMoveTargetUnit.SelectedItem as MoveTargetUnitItem;
                if (prevMoveItem != null && prevMoveItem.Unit != null)
                {
                    prevMoveUnitId = prevMoveItem.Unit.UnitId;
                }

                _cboUnitFilter.Items.Clear();
                _cboUnitFilter.Items.Add("顯示所有單元題目");

                _cboMoveTargetUnit.Items.Clear();

                var units = _dbManager.GetDistinctUnits(selCourse);
                int matchedFilterIdx = 0;


                for (int i = 0; i < units.Count; i++)
                {
                    var u = units[i];
                    _cboUnitFilter.Items.Add(u);
                    if (prevFilterUnitId != null && u.UnitId == prevFilterUnitId)
                    {
                        matchedFilterIdx = i + 1; // offset by 1 because index 0 is "顯示所有單元題目"
                    }
                }

                if (_cboUnitFilter.Items.Count > 0)
                {
                    _cboUnitFilter.SelectedIndex = matchedFilterIdx < _cboUnitFilter.Items.Count ? matchedFilterIdx : 0;
                }

                string targetCourse = _cboMoveTargetCourse.SelectedItem != null
                    ? _cboMoveTargetCourse.SelectedItem.ToString()
                    : null;
                if (string.IsNullOrEmpty(targetCourse) || !_dbManager.GetAllCourses().Contains(targetCourse))
                {
                    targetCourse = selCourse != "所有科目" && selCourse != "🌟 所有科目"
                        ? selCourse
                        : (_dbManager.GetAllCourses().Count > 0 ? _dbManager.GetAllCourses()[0] : null);
                }
                ReloadMoveTargetCourses(targetCourse, prevMoveUnitId);
            }
            finally
            {
                _isUpdatingFilters = false;
            }

            ApplyUnitFilter();
        }

        private void ReloadMoveTargetCourses(string selectedCourse, string selectedUnitId)
        {
            _isRefreshingMoveTargets = true;
            try
            {
                _cboMoveTargetCourse.Items.Clear();
                foreach (string course in _dbManager.GetAllCourses())
                    _cboMoveTargetCourse.Items.Add(course);

                if (_cboMoveTargetCourse.Items.Count > 0)
                {
                    int selectedIndex = selectedCourse != null ? _cboMoveTargetCourse.Items.IndexOf(selectedCourse) : -1;
                    _cboMoveTargetCourse.SelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
                }
            }
            finally
            {
                _isRefreshingMoveTargets = false;
            }
            ReloadMoveTargetUnits(selectedUnitId);
        }

        private void ReloadMoveTargetUnits(string selectedUnitId)
        {
            string course = _cboMoveTargetCourse.SelectedItem != null
                ? _cboMoveTargetCourse.SelectedItem.ToString()
                : null;
            _cboMoveTargetUnit.Items.Clear();
            if (string.IsNullOrEmpty(course)) return;

            var targetUnits = _dbManager.GetDistinctUnits(course);
            int selectedIndex = 0;
            for (int i = 0; i < targetUnits.Count; i++)
            {
                _cboMoveTargetUnit.Items.Add(new MoveTargetUnitItem { Unit = targetUnits[i] });
                if (selectedUnitId != null && targetUnits[i].UnitId == selectedUnitId)
                    selectedIndex = i;
            }
            if (_cboMoveTargetUnit.Items.Count > 0)
                _cboMoveTargetUnit.SelectedIndex = selectedIndex;
        }

        private void ShowAddCourseDialog()
        {
            using (Form dlg = new Form())
            {
                dlg.Text = "➕ 新增教學科目";
                dlg.Size = new Size(440, 210);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.BackColor = Color.FromArgb(15, 23, 42);
                dlg.ForeColor = Color.White;
                dlg.Font = new Font("Microsoft JhengHei", 9.5f);
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                var lbl = new Label
                {
                    Text = "請輸入新科目名稱 (例如：膳食療養學(二)、臨床營養學)：",
                    Location = new Point(20, 20),
                    Size = new Size(380, 25),
                    ForeColor = Color.FromArgb(253, 224, 71),
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                };

                var txt = new TextBox
                {
                    Location = new Point(20, 52),
                    Width = 380,
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.White,
                    Font = new Font("Microsoft JhengHei", 10f)
                };

                var btnOk = new Button
                {
                    Text = "確認新增",
                    Location = new Point(160, 105),
                    Size = new Size(110, 34),
                    BackColor = Color.FromArgb(16, 185, 129),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };

                var btnCancel = new Button
                {
                    Text = "取消",
                    Location = new Point(285, 105),
                    Size = new Size(95, 34),
                    BackColor = Color.FromArgb(51, 65, 85),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Cursor = Cursors.Hand
                };

                btnOk.Click += (s, e) =>
                {
                    string name = txt.Text.Trim();
                    if (string.IsNullOrEmpty(name))
                    {
                        MessageBox.Show("科目名稱不可為空！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }
                    _dbManager.AddCourse(name);
                    dlg.DialogResult = DialogResult.OK;
                    dlg.Close();
                };

                btnCancel.Click += (s, e) => dlg.Close();

                dlg.Controls.Add(lbl);
                dlg.Controls.Add(txt);
                dlg.Controls.Add(btnOk);
                dlg.Controls.Add(btnCancel);

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    string newName = txt.Text.Trim();
                    LoadData();
                    if (_cboCourseFilter.Items.Contains(newName))
                    {
                        _cboCourseFilter.SelectedItem = newName;
                    }
                }
            }
        }

        private string GetModuleDisplayPrefix(TeachingModule m)
        {
            if (m == null) return "【單元】";
            string title = (m.UnitTitle ?? "").Trim();
            if (string.IsNullOrEmpty(title))
            {
                int ord = DatabaseManager.GetUnitOrder("", m.UnitId);
                if (ord == 999) return "【單元】";
                string[] cNums = new string[] { "", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十" };
                string numStr = (ord >= 1 && ord <= 10) ? cNums[ord] : ord.ToString();
                return string.Format("【單元{0}】", numStr);
            }

            // 移除補充說明的括弧 (如 "(302床 林奶奶)", "（獨立題目）", "‧ 校園生活特別篇")
            string clean = Regex.Replace(title, @"[\(（][^\)）]*[\)）]", "").Trim();
            clean = Regex.Replace(clean, @"\s*‧.*$", "").Trim();

            // 若符合 【單元一】名稱 格式，組合為 【單元一 名稱】
            var m1 = Regex.Match(clean, @"^【(單元[一二三四五六七八九十0-9]+)】\s*(.*)$");
            if (m1.Success)
            {
                string uNum = m1.Groups[1].Value;
                string uName = m1.Groups[2].Value.Trim();
                if (!string.IsNullOrEmpty(uName))
                {
                    if (uName.Length > 12) uName = uName.Substring(0, 12);
                    return string.Format("【{0} {1}】", uNum, uName);
                }
                return string.Format("【{0}】", uNum);
            }

            // 若符合 【自訂單元】名稱 或 【任何標籤】名稱 格式
            var mTag = Regex.Match(clean, @"^【([^】]+)】\s*(.*)$");
            if (mTag.Success)
            {
                string tag = mTag.Groups[1].Value.Trim();
                string rest = mTag.Groups[2].Value.Trim();
                if (!string.IsNullOrEmpty(rest))
                {
                    string combined = tag + " " + rest;
                    if (combined.Length > 15) combined = combined.Substring(0, 15);
                    return string.Format("【{0}】", combined);
                }
                if (tag.Length > 15) tag = tag.Substring(0, 15);
                return string.Format("【{0}】", tag);
            }

            // 若無包含括號，依據單元順序自動補上【單元X 名稱】
            int uOrder = DatabaseManager.GetUnitOrder(title, m.UnitId);
            if (uOrder == 999)
            {
                if (clean.Length > 15) clean = clean.Substring(0, 15);
                return string.Format("【{0}】", clean);
            }
            string[] nums = new string[] { "", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十" };
            string ordStr = (uOrder >= 1 && uOrder <= 10) ? nums[uOrder] : uOrder.ToString();
            if (clean.Length > 12) clean = clean.Substring(0, 12);
            return string.Format("【單元{0} {1}】", ordStr, clean);
        }

        private void ApplyUnitFilter()
        {
            if (_isUpdatingFilters) return;
            _displayedModules = new List<TeachingModule>();
            string filterUnitId = null;
            TeachingModule selUnit = _cboUnitFilter.SelectedItem as TeachingModule;
            if (_cboUnitFilter.SelectedIndex > 0 && selUnit != null)
            {
                filterUnitId = selUnit.UnitId;
                if (!string.IsNullOrEmpty(filterUnitId))
                {
                    EmbeddedWebServer.CurrentUnit = filterUnitId.Replace("unit_", "");
                    EmbeddedWebServer.CurrentUnitTitle = selUnit.UnitTitle;
                    EmbeddedWebServer.CurrentStage = 1;
                    if (!_isInitializing)
                    {
                        EmbeddedWebServer.IsGameStarted = true;
                    }
                    EmbeddedWebServer.IsRevealed = false;
                }
            }

            _lstModules.Items.Clear();
            foreach (var m in _allModules)
            {
                if (filterUnitId == null || m.UnitId == filterUnitId)
                {
                    _displayedModules.Add(m);
                    string uPrefix = GetModuleDisplayPrefix(m);
                    _lstModules.Items.Add(string.Format("{0} {1}", uPrefix, m.Title));
                }
            }

            if (_lstModules.Items.Count > 0)
            {
                _lstModules.SelectedIndex = -1;
                _lstModules.SelectedIndex = 0;
            }
            else
            {
                _selectedModule = null;
            }
        }

        private void BtnMoveToUnit_Click(object sender, EventArgs e)
        {
            if (_selectedModule == null)
            {
                MessageBox.Show("請先在題目清單中選擇欲移動的題目！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            var selItem = _cboMoveTargetUnit.SelectedItem as MoveTargetUnitItem;
            var targetUnit = selItem != null ? selItem.Unit : (_cboMoveTargetUnit.SelectedItem as TeachingModule);
            if (targetUnit == null)
            {
                MessageBox.Show("請先選擇欲移動到的目標單元！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            if (_selectedModule.UnitId == targetUnit.UnitId && _selectedModule.CourseName == targetUnit.CourseName)
            {
                MessageBox.Show(string.Format("題目「{0}」已經屬於 【{1}】{2}，無需重複移動！", _selectedModule.Title, targetUnit.CourseName, targetUnit.UnitTitle), "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                _dbManager.MoveModuleToUnit(_selectedModule.Id, targetUnit.UnitId, targetUnit.UnitTitle, targetUnit.UnitRoute, targetUnit.CourseName);
            }
            catch (Exception ex)
            {
                MessageBox.Show("移動題目失敗：" + ex.Message, "移動失敗", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string targetCourseDisplay = !string.IsNullOrEmpty(targetUnit.CourseName) ? string.Format("【{0}】", targetUnit.CourseName) : "";
            MessageBox.Show(string.Format("已成功將題目「{0}」移動至：\n{1}{2}！\n\n同單元題目將共用專屬 QR Code 並連續計分。", _selectedModule.Title, targetCourseDisplay, targetUnit.UnitTitle), "移動成功", MessageBoxButtons.OK, MessageBoxIcon.Information);

            int movedId = _selectedModule.Id;
            ReloadUnitsAndModules();

            for (int i = 0; i < _displayedModules.Count; i++)
            {
                if (_displayedModules[i].Id == movedId)
                {
                    _lstModules.SelectedIndex = i;
                    break;
                }
            }
        }

        private void BtnCopyToUnit_Click(object sender, EventArgs e)
        {
            // 開啟「兩階題目批次複製精靈」：第一階選單元 ➔ 第二階勾選題目 ➔ 複製到所要科目
            ShowTwoTierBatchCopyDialog();
        }

        private void OnModuleSelected()
        {
            int idx = _lstModules.SelectedIndex;
            if (idx >= 0 && idx < _displayedModules.Count)
            {
                _selectedModule = _displayedModules[idx];
                UpdateQrCode();
                if (!_isInitializing)
                {
                    EnterSelectedModuleStage();
                }
            }
        }

        private void EnterSelectedModuleStage()
        {
            int idx = _lstModules.SelectedIndex;
            if (idx >= 0 && idx < _displayedModules.Count)
            {
                _selectedModule = _displayedModules[idx];
            }
            if (_selectedModule == null) return;

            if (!string.IsNullOrEmpty(_selectedModule.UnitId))
            {
                EmbeddedWebServer.CurrentUnit = _selectedModule.UnitId.Replace("unit_", "");
            }
            EmbeddedWebServer.CurrentUnitTitle = _selectedModule.UnitTitle;
            EmbeddedWebServer.IsGameStarted = true;
            EmbeddedWebServer.IsRevealed = false;

            var mStage = System.Text.RegularExpressions.Regex.Match(_selectedModule.LocalRoute ?? "", @"stage=(\d+)");
            if (mStage.Success)
            {
                int stParsed;
                if (int.TryParse(mStage.Groups[1].Value, out stParsed))
                {
                    EmbeddedWebServer.CurrentStage = stParsed;
                }
                else
                {
                    EmbeddedWebServer.CurrentStage = 1;
                }
            }
            else
            {
                EmbeddedWebServer.CurrentStage = 1;
            }
            UpdateMasterUi();
            UpdateQrCode();
            RefreshPreview();
        }

        private void UpdateQrCode()
        {
            if (_selectedModule == null) return;

            // 核心設定：同單元共用相同 QR Code！學生掃碼加入後連續作答計分
            string route = !string.IsNullOrEmpty(_selectedModule.UnitRoute) 
                ? _selectedModule.UnitRoute 
                : (string.IsNullOrEmpty(_selectedModule.LocalRoute) ? "/index.html" : _selectedModule.LocalRoute);

            if (!route.Contains("unit_title="))
            {
                string sep = route.Contains("?") ? "&" : "?";
                route = string.Format("{0}{1}unit_title={2}", route, sep, Uri.EscapeDataString(_selectedModule.UnitTitle));
            }
            // 一律為通用連線 (若 Cloudflare Tunnel 啟動則使用外網通用連線，否則使用區網 LAN IP)
            string targetUrl;
            if (!string.IsNullOrEmpty(_tunnelUrl))
            {
                targetUrl = _tunnelUrl.TrimEnd('/') + route;
            }
            else
            {
                targetUrl = string.Format("http://{0}:{1}{2}", _webServer.LanIp, _webServer.Port, route);
            }

            _lblTargetUrl.Text = targetUrl;

            _currentQrBitmap = QrGenerator.GenerateQrCode(targetUrl, 20);
            _pbQrCode.Image = _currentQrBitmap;
        }

        private async void InitializeBrowser()
        {
            try
            {
                _webView = new WebView2();
                _webView.Dock = DockStyle.Fill;
                _webView.DefaultBackgroundColor = Color.FromArgb(15, 23, 42);
                _previewContainer.Controls.Add(_webView);

                var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions { AdditionalBrowserArguments = "--autoplay-policy=no-user-gesture-required" };
                string profileName = "WV2_" + Process.GetCurrentProcess().Id;
                string[] profileFolders =
                {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NutritionTeachingPlatform", profileName),
                    Path.Combine(Path.GetTempPath(), "NutritionTeachingPlatform", profileName)
                };
                Exception profileError = null;
                bool initialized = false;
                foreach (string profileFolder in profileFolders)
                {
                    try
                    {
                        Directory.CreateDirectory(profileFolder);
                        var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, profileFolder, options);
                        await _webView.EnsureCoreWebView2Async(env);
                        _webViewUserDataFolder = profileFolder;
                        initialized = true;
                        break;
                    }
                    catch (Exception ex)
                    {
                        profileError = ex;
                        try { File.AppendAllText("browser_error.log", ex + Environment.NewLine); } catch { }
                    }
                }
                if (!initialized)
                {
                    throw new InvalidOperationException(
                        "無法初始化內嵌瀏覽器，請確認 Microsoft Edge WebView2 Runtime 已安裝，且使用者資料目錄可寫入。",
                        profileError);
                }

                SwitchPreviewMode(true);
                RefreshPreview();
            }
            catch (Exception ex)
            {
                try { File.AppendAllText("browser_error.log", ex + Environment.NewLine); } catch { }
                if (_webView != null)
                {
                    _previewContainer.Controls.Remove(_webView);
                    _webView.Dispose();
                    _webView = null;
                }
                var errorLabel = new Label
                {
                    Dock = DockStyle.Fill,
                    TextAlign = ContentAlignment.MiddleCenter,
                    ForeColor = Color.White,
                    BackColor = Color.FromArgb(15, 23, 42),
                    Padding = new Padding(24),
                    Text = "內嵌瀏覽器無法啟動，課程預覽無法顯示。\r\n請安裝或修復 Microsoft Edge WebView2 Runtime，再重新開啟平台。\r\n\r\n詳細錯誤已記錄於 browser_error.log。"
                };
                _previewContainer.Controls.Add(errorLabel);
            }
        }

        private void SwitchPreviewMode(bool mobile)
        {
            _isMobileMode = mobile;
            if (mobile)
            {
                _btnMobileView.BackColor = Color.FromArgb(16, 185, 129);
                _btnDesktopView.BackColor = Color.FromArgb(51, 65, 85);
                _previewContainer.Padding = new Padding(120, 10, 120, 10);
            }
            else
            {
                _btnMobileView.BackColor = Color.FromArgb(51, 65, 85);
                _btnDesktopView.BackColor = Color.FromArgb(16, 185, 129);
                _previewContainer.Padding = new Padding(0);
            }
        }

        private void RefreshPreview()
        {
            if (!EmbeddedWebServer.IsGameStarted)
            {
                RefreshPreviewToLobby();
                return;
            }
            RefreshPreview(false);
        }

        private void RefreshPreviewToLobby()
        {
            string unit = !string.IsNullOrEmpty(EmbeddedWebServer.CurrentUnit) ? EmbeddedWebServer.CurrentUnit : "must";
            string url = string.Format(
                "http://127.0.0.1:{0}/index.html?unit={1}&role=teacher&tview=teacher_lobby&in_app=1&previewRevision={2}",
                _webServer.Port,
                Uri.EscapeDataString(unit),
                DateTime.UtcNow.Ticks
            );

            if (_webView != null && _webView.CoreWebView2 != null)
            {
                _webView.CoreWebView2.Navigate(url);
            }
        }

        private void RefreshPreview(bool showLeaderboard)
        {
            RefreshPreview(showLeaderboard, EmbeddedWebServer.CurrentStage);
        }

        private void RefreshPreview(bool showLeaderboard, int returnStage)
        {
            string unit = !string.IsNullOrEmpty(EmbeddedWebServer.CurrentUnit) ? EmbeddedWebServer.CurrentUnit : "must";
            string url;
            if (!EmbeddedWebServer.IsGameStarted && !showLeaderboard)
            {
                url = string.Format("http://127.0.0.1:{0}/index.html?unit={1}&role=teacher&tview=teacher_lobby&in_app=1", _webServer.Port, unit);
            }
            else
            {
                url = string.Format("http://127.0.0.1:{0}/index.html?unit={1}&stage={2}&role=teacher&in_app=1", _webServer.Port, unit, EmbeddedWebServer.CurrentStage);
            }
            if (showLeaderboard)
            {
                url += string.Format("&tview=victory&returnStage={0}", returnStage);
            }
            url += string.Format("&previewRevision={0}", DateTime.UtcNow.Ticks);

            if (_webView != null && _webView.CoreWebView2 != null)
            {
                _webView.CoreWebView2.Navigate(url);
            }
        }

        private static readonly Dictionary<string, string> ModuleBackdropMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "MUST_CASE_1", "rpg_bg_ward.jpg" },
            { "MUST_CASE_2", "rpg_bg_ward.jpg" },
            { "MUST_CASE_3", "rpg_bg_ward.jpg" },
            { "MUST_CASE_4", "rpg_bg_ward.jpg" },
            { "MUST_CASE_5", "rpg_bg_seminar.jpg" },
            { "MUST_CASE_6", "rpg_bg_seminar.jpg" },
            { "MUST_CASE_7", "rpg_bg_zhou_court.jpg" },
            { "SUPPORT_STAGE_1", "rpg_bg_scifi_medical.jpg" },
            { "SUPPORT_STAGE_2", "rpg_bg_icu_aspiration.jpg" },
            { "SUPPORT_STAGE_3", "rpg_bg_icu_aspiration.jpg" },
            { "SUPPORT_STAGE_4", "rpg_bg_support_stage4.png" },
            { "SUPPORT_STAGE_5", "rpg_bg_support_formula.png" },
            { "SUPPORT_STAGE_6", "rpg_bg_icu_tpn.jpg" },
            { "SUPPORT_STAGE_7", "rpg_bg_icu_aspiration.jpg" },
            { "SUPPORT_STAGE_8", "rpg_bg_icu_aspiration.jpg" },
            { "SUPPORT_STAGE_9", "rpg_bg_support_formula.png" },
            { "SUPPORT_STAGE_10", "support_stage10_anatomy.jpg" },
            { "SUPPORT_STAGE_11", "rpg_bg_icu_aspiration.jpg" },
            { "NCP_STAGE_1", "rpg_bg_seminar.jpg" },
            { "NCP_STAGE_2", "rpg_bg_seminar.jpg" },
            { "DM_STAGE_1", "rpg_bg_clinic.jpg" },
            { "DM_STAGE_2", "rpg_bg_dragon_battle.jpg" },
            { "DM_STAGE_3", "rpg_bg_ice_golem.jpg" },
            { "DM_STAGE_4", "rpg_bg_ogtt_swamp.jpg" },
            { "DM_STAGE_5", "rpg_bg_thunder_wolf.jpg" },
            { "DM_STAGE_6", "rpg_bg_tech_company.jpg" },
            { "DM_STAGE_7", "rpg_bg_clinic.jpg" },
            { "DM_STAGE_8", "rpg_bg_clinic.jpg" },
            { "DM_STAGE_9", "rpg_bg_arcane_sanctuary.jpg" },
            { "DM_STAGE_10", "rpg_bg_dm_consultation.jpg" },
            { "DM_STAGE_11", "rpg_bg_clinic.jpg" },
            { "DM_STAGE_12", "rpg_bg_dining_table.jpg" },
            { "DM_STAGE_13", "rpg_bg_midnight_ward.jpg" },
            { "ZHOU_STAGE_1", "rpg_bg_zhou_court.jpg" },
            { "LIFE_STAGE_1", "rpg_bg_classroom.jpg" },
            { "PROTEIN_STAGE_1", "rpg_bg_unit3_stage1_proteins.jpg" },
            { "PROTEIN_STAGE_2", "rpg_bg_anorexia_counseling_v2.jpg" },
            { "PROTEIN_STAGE_3", "rpg_bg_bulimia_binge_eating.jpg" },
            { "PROTEIN_STAGE_4", "rpg_bg_unit3_stage4_anorexia.png" },
            { "PROTEIN_STAGE_5", "rpg_bg_unit3_stage5_adipose.png" },
            { "CURRICULUM_03_STAGE_1", "rpg_bg_ward.jpg" },
            { "CURRICULUM_03_STAGE_2", "rpg_bg_unit3_stage5_adipose.png" },
            { "CURRICULUM_03_STAGE_3", "rpg_bg_anorexia_counseling_v2.jpg" },
            { "CURRICULUM_03_STAGE_4", "rpg_bg_bulimia_binge_eating.jpg" },
            { "CURRICULUM_03_STAGE_5", "rpg_bg_unit3_stage4_anorexia.png" },
            { "CURRICULUM_03_STAGE_6", "rpg_bg_unit3_stage1_proteins.jpg" },
            { "CURRICULUM_07_STAGE_1", "rpg_bg_moba_battlefield_1080p.jpg" },
            { "CURRICULUM_07_STAGE_2", "rpg_bg_clinic.jpg" },
            { "CURRICULUM_07_STAGE_3", "kidney_stage3_question_custom.png" },
            { "CURRICULUM_07_STAGE_4", "rpg_bg_clinic.jpg" },
            { "CURRICULUM_07_STAGE_5", "kidney_stage3_video_final_frame.png" },
            { "CURRICULUM_07_STAGE_6", "kidney_stage4_question_bg.png" },
            { "DETECTIVE_STAGE_1", "rpg_bg_ward.jpg" },
            { "TRIAL_STAGE_1", "new_student_trial_bg.jpg" }
        };

        private string ResolveBackdropFile(TeachingModule mod)
        {
            if (mod == null) return "rpg_bg_ward.jpg";

            if (!string.IsNullOrEmpty(mod.ModuleCode) && ModuleBackdropMap.ContainsKey(mod.ModuleCode))
            {
                return ModuleBackdropMap[mod.ModuleCode];
            }

            string u = (mod.UnitId ?? "").ToLowerInvariant();
            string title = (mod.Title ?? "").ToLowerInvariant();

            if (u.Contains("support") || title.Contains("營養支持"))
            {
                return "rpg_bg_icu_aspiration.jpg";
            }
            if (u.Contains("dm") || title.Contains("糖尿病"))
            {
                return "rpg_bg_dm_consultation.jpg";
            }
            if (u.Contains("protein") || title.Contains("蛋白質"))
            {
                return "rpg_bg_unit3_stage1_proteins.jpg";
            }
            if (u.Contains("life") || title.Contains("校園生活"))
            {
                return "rpg_bg_classroom.jpg";
            }
            if (u.Contains("trial") || title.Contains("新生"))
            {
                return "new_student_trial_bg.jpg";
            }
            if (u.Contains("zhou") || title.Contains("周禮"))
            {
                return "rpg_bg_zhou_court.jpg";
            }

            return "rpg_bg_ward.jpg";
        }

        private static GraphicsPath CreateRoundedRectanglePath(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            if (d > rect.Width) d = rect.Width;
            if (d > rect.Height) d = rect.Height;

            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        private static string CleanHtmlAndFormatText(string input)
        {
            if (string.IsNullOrEmpty(input)) return "";
            string res = input;
            // 移除所有 (正確答案)、（正確答案）、(正確選項) 等答案提示
            res = Regex.Replace(res, @"[\(（\[【]\s*正確(答案|選項)?\s*[\)）\]】]", "", RegexOptions.IgnoreCase);
            res = Regex.Replace(res, @"\*\s*正確(答案|選項)?\s*\*", "", RegexOptions.IgnoreCase);
            res = Regex.Replace(res, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            res = Regex.Replace(res, @"<[^>]+>", "");
            res = res.Replace("&nbsp;", " ")
                     .Replace("&amp;", "&")
                     .Replace("&lt;", "<")
                     .Replace("&gt;", ">")
                     .Replace("&quot;", "\"")
                     .Replace("&ge;", "≥")
                     .Replace("&le;", "≤");
            return res.Trim();
        }

        private static string[] SplitAndCleanDescription(string desc)
        {
            if (string.IsNullOrEmpty(desc)) return new string[0];
            string cleaned = CleanHtmlAndFormatText(desc);
            string[] lines = cleaned.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            List<string> result = new List<string>();
            foreach (var l in lines)
            {
                string t = l.Trim();
                if (!string.IsNullOrEmpty(t))
                {
                    result.Add(t);
                }
            }
            return result.ToArray();
        }

        private string GetWebPath()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string webPath = Path.Combine(appDir, "web");
            if (Directory.Exists(webPath)) return webPath;
            string altWeb = Path.Combine(appDir, "..", "web");
            if (Directory.Exists(altWeb)) return Path.GetFullPath(altWeb);
            altWeb = Path.Combine(appDir, "..", "..", "web");
            if (Directory.Exists(altWeb)) return Path.GetFullPath(altWeb);
            return webPath;
        }

        private Bitmap GenerateQuestionQrCardBitmap(TeachingModule mod, Bitmap qrBmp, string targetUrl)
        {
            int w = 1600;
            int h = 900;
            Bitmap bmp = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppArgb);

            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

                // 1. Draw Backdrop Image
                string backdropName = ResolveBackdropFile(mod);
                string webRoot = GetWebPath();
                string backdropPath = Path.Combine(webRoot, "assets", backdropName);

                Image bgImage = null;
                if (File.Exists(backdropPath))
                {
                    try
                    {
                        using (var fs = new FileStream(backdropPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                        {
                            bgImage = Image.FromStream(fs);
                        }
                    }
                    catch { }
                }

                if (bgImage != null)
                {
                    using (bgImage)
                    {
                        g.DrawImage(bgImage, new Rectangle(0, 0, w, h));
                    }
                }
                else
                {
                    using (var bgBrush = new LinearGradientBrush(new Rectangle(0, 0, w, h), Color.FromArgb(15, 23, 42), Color.FromArgb(30, 41, 59), 45f))
                    {
                        g.FillRectangle(bgBrush, 0, 0, w, h);
                    }
                }

                // Semi-transparent dark overlay for cinematic readability
                using (var overlayBrush = new SolidBrush(Color.FromArgb(165, 15, 23, 42)))
                {
                    g.FillRectangle(overlayBrush, 0, 0, w, h);
                }

                // 2. Top Header / Course & Unit Badge
                string courseText = !string.IsNullOrEmpty(mod.CourseName) ? mod.CourseName : "膳食療養學";
                string unitText = !string.IsNullOrEmpty(mod.UnitTitle) ? mod.UnitTitle : "【單元教學】";
                string headerBadge = string.Format("{0} ‧ {1}", courseText, unitText);

                using (var badgePath = CreateRoundedRectanglePath(new Rectangle(45, 30, 1510, 56), 14))
                using (var badgeBrush = new LinearGradientBrush(new Rectangle(45, 30, 1510, 56), Color.FromArgb(235, 15, 118, 110), Color.FromArgb(235, 13, 148, 136), 0f))
                using (var badgePen = new Pen(Color.FromArgb(94, 234, 212), 1.5f))
                using (var fontBadge = new Font("Microsoft JhengHei", 16f, FontStyle.Bold))
                using (var textBrush = new SolidBrush(Color.White))
                {
                    g.FillPath(badgeBrush, badgePath);
                    g.DrawPath(badgePen, badgePath);

                    var sfBadge = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center };
                    g.DrawString(headerBadge, fontBadge, textBrush, new RectangleF(75, 30, 1450, 56), sfBadge);
                }

                // 3. Left Section: Question Card
                Rectangle leftCardRect = new Rectangle(45, 105, 970, 755);
                using (var leftCardPath = CreateRoundedRectanglePath(leftCardRect, 18))
                using (var leftCardBrush = new SolidBrush(Color.FromArgb(235, 15, 23, 42)))
                using (var leftCardPen = new Pen(Color.FromArgb(200, 56, 189, 248), 2f))
                {
                    g.FillPath(leftCardBrush, leftCardPath);
                    g.DrawPath(leftCardPen, leftCardPath);
                }

                // Question Title (Dynamic layout to prevent any clipping or overlapping)
                string rawTitle = CleanHtmlAndFormatText(mod.Title ?? "課堂互動題目");
                // 圖卡僅呈現題幹，不顯示資料庫內的「第 X 題」編號。
                rawTitle = Regex.Replace(rawTitle, @"^\s*第\s*\d+\s*[題關]\s*(?:[‧:：-]\s*)?", "");
                float titleFontSize = 21f;
                SizeF measuredTitle;
                Font fontTitleToUse = null;

                // Try font sizes from 21f down to 16f to fit comfortably
                for (float fSize = 21f; fSize >= 16f; fSize -= 1f)
                {
                    var testFont = new Font("Microsoft JhengHei", fSize, FontStyle.Bold);
                    measuredTitle = g.MeasureString(rawTitle, testFont, 910);
                    if (measuredTitle.Height <= 105f || fSize == 16f)
                    {
                        fontTitleToUse = testFont;
                        break;
                    }
                    testFont.Dispose();
                }

                measuredTitle = g.MeasureString(rawTitle, fontTitleToUse, 910);
                float titleBoxHeight = Math.Max(48f, measuredTitle.Height + 10f);
                RectangleF titleRect = new RectangleF(75, 125, 910, titleBoxHeight);

                using (fontTitleToUse)
                using (var titleBrush = new SolidBrush(Color.FromArgb(254, 240, 138)))
                {
                    var sfTitle = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Near, Trimming = StringTrimming.EllipsisWord };
                    g.DrawString(rawTitle, fontTitleToUse, titleBrush, titleRect, sfTitle);
                }

                // Decorative Cyan Accent Line under title (placed safely below titleRect)
                float lineY = titleRect.Bottom + 12f;
                using (var penLine = new Pen(Color.FromArgb(140, 56, 189, 248), 2f))
                {
                    g.DrawLine(penLine, 75, lineY, 985, lineY);
                }

                // Question Content / Options
                string rawDesc = mod.Description ?? "";
                string[] descLines = SplitAndCleanDescription(rawDesc);

                float currentY = lineY + 18f;
                float availableHeight = 845f - currentY;
                int validLineCount = 0;
                foreach (var dl in descLines) { if (!string.IsNullOrWhiteSpace(dl)) validLineCount++; }

                float optGap = validLineCount > 4 ? 8f : 12f;
                float optFontSize = (validLineCount > 4 || availableHeight < (validLineCount * 65f)) ? 13.5f : 15f;

                using (var fontOptText = new Font("Microsoft JhengHei", optFontSize, FontStyle.Regular))
                using (var optTextBrush = new SolidBrush(Color.FromArgb(248, 250, 252)))
                using (var optBgBrush = new SolidBrush(Color.FromArgb(180, 30, 41, 59)))
                using (var optBorderPen = new Pen(Color.FromArgb(51, 65, 85), 1.2f))
                {
                    if (descLines.Length == 0 || (descLines.Length == 1 && string.IsNullOrWhiteSpace(descLines[0])))
                    {
                        g.DrawString("請使用手機掃描右方 QR Code 進入作答系統進行互動！", fontOptText, optTextBrush, new RectangleF(75, currentY, 910, 100));
                    }
                    else
                    {
                        for (int i = 0; i < descLines.Length && currentY < 835; i++)
                        {
                            string line = descLines[i].Trim();
                            if (string.IsNullOrEmpty(line)) continue;

                            RectangleF optBoxRect = new RectangleF(75, currentY, 910, 0);
                            SizeF measured = g.MeasureString(line, fontOptText, 880);
                            float boxHeight = Math.Max(46f, measured.Height + 14f);
                            if (currentY + boxHeight > 845)
                            {
                                boxHeight = 845 - currentY;
                            }
                            optBoxRect.Height = boxHeight;

                            using (var optPath = CreateRoundedRectanglePath(Rectangle.Round(optBoxRect), 10))
                            {
                                g.FillPath(optBgBrush, optPath);
                                g.DrawPath(optBorderPen, optPath);
                            }

                            // Left highlight bar on option
                            using (var barBrush = new SolidBrush(Color.FromArgb(56, 189, 248)))
                            {
                                g.FillRectangle(barBrush, 75, currentY, 5, boxHeight);
                            }

                            var sfOpt = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center };
                            g.DrawString(line, fontOptText, optTextBrush, new RectangleF(92, currentY + 3, 880, boxHeight - 6), sfOpt);

                            currentY += boxHeight + optGap;
                        }
                    }
                }

                // 4. Right Section: White QR Code Card
                Rectangle rightCardRect = new Rectangle(1040, 105, 515, 755);
                using (var rightCardPath = CreateRoundedRectanglePath(rightCardRect, 18))
                using (var rightCardBrush = new SolidBrush(Color.White))
                using (var rightCardPen = new Pen(Color.FromArgb(203, 213, 225), 2f))
                {
                    g.FillPath(rightCardBrush, rightCardPath);
                    g.DrawPath(rightCardPen, rightCardPath);
                }

                // QR Card Header
                using (var fontQrHeader = new Font("Microsoft JhengHei", 21f, FontStyle.Bold))
                using (var headerBrush = new SolidBrush(Color.FromArgb(15, 23, 42)))
                {
                    var sfCenter = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                    g.DrawString("手機掃碼 ‧ 即時作答", fontQrHeader, headerBrush, new RectangleF(1040, 135, 515, 40), sfCenter);
                }

                using (var fontQrSub = new Font("Microsoft JhengHei", 12.5f, FontStyle.Regular))
                using (var subBrush = new SolidBrush(Color.FromArgb(100, 116, 139)))
                {
                    var sfCenter = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                    g.DrawString("免安裝 App ‧ 掃描即刻連線參與課堂互動", fontQrSub, subBrush, new RectangleF(1040, 178, 515, 25), sfCenter);
                }

                // QR Code Image
                if (qrBmp != null)
                {
                    int qrSize = 390;
                    int qrX = 1040 + (515 - qrSize) / 2;
                    int qrY = 220;

                    using (var qrFramePen = new Pen(Color.FromArgb(226, 232, 240), 1.5f))
                    {
                        g.DrawRectangle(qrFramePen, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
                    }

                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.DrawImage(qrBmp, new Rectangle(qrX, qrY, qrSize, qrSize));
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                }

                // URL Container Box
                Rectangle urlBoxRect = new Rectangle(1065, 638, 465, 52);
                using (var urlBoxPath = CreateRoundedRectanglePath(urlBoxRect, 10))
                using (var urlBoxBrush = new SolidBrush(Color.FromArgb(241, 245, 249)))
                using (var urlBoxPen = new Pen(Color.FromArgb(203, 213, 225), 1.2f))
                using (var fontUrl = new Font("Consolas", 11f, FontStyle.Bold))
                using (var urlBrush = new SolidBrush(Color.FromArgb(2, 132, 199)))
                {
                    g.FillPath(urlBoxBrush, urlBoxPath);
                    g.DrawPath(urlBoxPen, urlBoxPath);

                    string dispUrl = targetUrl ?? "";
                    var sfUrl = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisPath };
                    g.DrawString(dispUrl, fontUrl, urlBrush, urlBoxRect, sfUrl);
                }

                // Bottom Fast Action Prompt
                using (var fontAction = new Font("Microsoft JhengHei", 12.5f, FontStyle.Bold))
                using (var actionBrush = new SolidBrush(Color.FromArgb(5, 150, 105)))
                {
                    var sfCenter = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                    g.DrawString("支援手機 / 平板 / 筆電 ‧ 即時同步即時回饋", fontAction, actionBrush, new RectangleF(1040, 705, 515, 30), sfCenter);
                }

                // Footer System Watermark
                using (var fontFooter = new Font("Microsoft JhengHei", 10.5f, FontStyle.Regular))
                using (var footerBrush = new SolidBrush(Color.FromArgb(148, 163, 184)))
                {
                    g.DrawString("營養教學平台 ‧ 課堂互動教學系統", fontFooter, footerBrush, 50, 870);
                }
            }

            return bmp;
        }

        private void BtnCopyQr_Click(object sender, EventArgs e)
        {
            if (_currentQrBitmap == null) return;

            try
            {
                if (_selectedModule != null)
                {
                    using (Bitmap cardBmp = GenerateQuestionQrCardBitmap(_selectedModule, _currentQrBitmap, _lblTargetUrl.Text))
                    {
                        Clipboard.SetImage(cardBmp);
                        _lblStatus.Text = "📋 題目與 QR Code 整合圖卡已複製到剪貼簿！可直接在 PPT 按 Ctrl+V 貼上";
                        MessageBox.Show(
                            "題目與 QR Code 專屬圖卡已成功複製到剪貼簿！\n\n包含：該題背景圖片、題目內容/選項、專屬 QR Code 與連線網址。\n您可直接在 PowerPoint 投影片或教學簡報中按下 Ctrl + V 貼上！",
                            "圖卡複製成功",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                }
                else
                {
                    Clipboard.SetImage(_currentQrBitmap);
                    _lblStatus.Text = "📋 QR Code 已複製到剪貼簿！可直接在 PPT 按 Ctrl+V 貼上";
                }
            }
            catch (Exception ex)
            {
                Clipboard.SetImage(_currentQrBitmap);
                _lblStatus.Text = "📋 QR Code 已複製到剪貼簿 (圖卡生成異常: " + ex.Message + ")";
            }
        }

        private void CopyPptHyperlinkToClipboard()
        {
            if (_selectedModule == null)
            {
                MessageBox.Show("請先在左側題目清單中選擇題目！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            string unit = !string.IsNullOrEmpty(_selectedModule.UnitId)
                ? _selectedModule.UnitId.Replace("unit_", "")
                : (!string.IsNullOrEmpty(EmbeddedWebServer.CurrentUnit) ? EmbeddedWebServer.CurrentUnit : "must");

            int stage = 1;
            var mStage = Regex.Match(_selectedModule.LocalRoute ?? "", @"stage=(\d+)");
            if (mStage.Success)
            {
                int.TryParse(mStage.Groups[1].Value, out stage);
            }
            else
            {
                stage = EmbeddedWebServer.CurrentStage > 0 ? EmbeddedWebServer.CurrentStage : 1;
            }

            int port = _webServer != null ? _webServer.Port : 5050;
            string pptJumpUrl = string.Format("http://127.0.0.1:{0}/index.html?unit={1}&stage={2}&role=teacher", port, Uri.EscapeDataString(unit), stage);

            Clipboard.SetText(pptJumpUrl);
            _lblStatus.Text = "🎯 PPT 跳題專屬超連結已複製到剪貼簿！可直接在 PPT 按 Ctrl+K 貼上";

            string qTitle = !string.IsNullOrEmpty(_selectedModule.Title) ? _selectedModule.Title : "當前選取題目";
            string msg = string.Format(
                "已成功複製【{0}】的 PPT 專屬跳題超連結：\n\n{1}\n\n" +
                "【PowerPoint 設定三步驟】：\n" +
                "1. 在 PPT 投影片中點選該題圖卡（或文字/按鈕）\n" +
                "2. 按快捷鍵 Ctrl + K（或點「插入 ➔ 超連結」）\n" +
                "3. 在「網址 (URL)」欄位按 Ctrl + V 貼上並按確定！\n\n" +
                "✨ 課堂放映簡報時，滑鼠點擊該圖卡即可瞬間直達此題開始互動！",
                qTitle,
                pptJumpUrl
            );

            MessageBox.Show(
                msg,
                "PPT 跳題超連結複製成功",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
        }

        private void CopyUrlToClipboard()
        {
            if (!string.IsNullOrEmpty(_lblTargetUrl.Text))
            {
                Clipboard.SetText(_lblTargetUrl.Text);
                _lblStatus.Text = "📋 專屬課程網址已複製到剪貼簿！可直接傳送給學生或貼入瀏覽器";
                MessageBox.Show(
                    "課程連線網址已成功複製到剪貼簿：\n\n" + _lblTargetUrl.Text + "\n\n學生可直接點選連線，或在瀏覽器網址列貼上（Ctrl+V）！",
                    "連線網址複製成功",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
        }

        private void BtnEmbedPpt_Click(object sender, EventArgs e)
        {
            if (_currentQrBitmap == null)
            {
                MessageBox.Show("請先選擇題目以生成 QR Code！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            // 先複製到剪貼簿供隨時貼上
            Clipboard.SetImage(_currentQrBitmap);

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string parentDir = Path.GetFullPath(Path.Combine(baseDir, ".."));
            string pptFilename = (_selectedModule != null && !string.IsNullOrEmpty(_selectedModule.PptFile))
                ? _selectedModule.PptFile
                : "1 營養照顧流程.pptx";
            int slideNum = (_selectedModule != null && _selectedModule.PptSlide > 0)
                ? _selectedModule.PptSlide
                : 1;

            string pptPath = "";
            if (File.Exists(pptFilename))
            {
                pptPath = Path.GetFullPath(pptFilename);
            }
            else if (File.Exists(Path.Combine(parentDir, pptFilename)))
            {
                pptPath = Path.Combine(parentDir, pptFilename);
            }
            else if (File.Exists(Path.Combine(baseDir, pptFilename)))
            {
                pptPath = Path.Combine(baseDir, pptFilename);
            }
            else
            {
                // 智慧模糊比對簡報名稱
                string[] files = Directory.GetFiles(parentDir, "*.pptx");
                string match = null;
                string cleanKey = Path.GetFileNameWithoutExtension(pptFilename).Replace(" ", "");
                foreach (var f in files)
                {
                    string baseF = Path.GetFileName(f);
                    if (cleanKey.Contains("糖尿病") && baseF.Contains("糖尿病")) { match = f; break; }
                    if (cleanKey.Contains("營養照顧") && baseF.Contains("營養照顧")) { match = f; break; }
                }
                if (match != null)
                {
                    pptPath = match;
                }
                else if (files.Length > 0 && File.Exists(Path.Combine(parentDir, "1 營養照顧流程.pptx")))
                {
                    pptPath = Path.Combine(parentDir, "1 營養照顧流程.pptx");
                }
            }

            if (!File.Exists(pptPath))
            {
                using (OpenFileDialog ofd = new OpenFileDialog())
                {
                    ofd.Filter = "PowerPoint 簡報 (*.pptx)|*.pptx";
                    ofd.Title = string.Format("請選擇欲置入 QR Code 的 PowerPoint 簡報檔 (目標頁數: 第 {0} 頁)", slideNum);
                    ofd.InitialDirectory = parentDir;
                    if (ofd.ShowDialog() == DialogResult.OK)
                    {
                        pptPath = ofd.FileName;
                        if (_selectedModule != null)
                        {
                            _selectedModule.PptFile = Path.GetFileName(pptPath);
                            _dbManager.UpdateModuleAndUnit(_selectedModule.Id, _selectedModule.Title, _selectedModule.UnitTitle, _selectedModule.CourseName, slideNum, _selectedModule.Description);
                        }
                    }
                    else
                    {
                        _lblStatus.Text = "📋 QR Code 已複製到剪貼簿！可直接在 PPT 按 Ctrl+V 貼上";
                        return;
                    }
                }
            }

            try
            {
                string qrTempPath = Path.Combine(Path.GetTempPath(), "nutrition_qr.png");
                _currentQrBitmap.Save(qrTempPath, System.Drawing.Imaging.ImageFormat.Png);

                string scriptPath = Path.Combine(baseDir, "embed_qr_to_ppt.py");
                if (!File.Exists(scriptPath))
                {
                    scriptPath = Path.Combine(parentDir, "embed_qr_to_ppt.py");
                }

                if (File.Exists(scriptPath))
                {
                    string taskJsonPath = Path.Combine(Path.GetTempPath(), "nutrition_ppt_task.json");
                    string jsonContent = string.Format(
                        "{{\"ppt_path\":\"{0}\",\"qr_path\":\"{1}\",\"slide_num\":{2}}}",
                        pptPath.Replace("\\", "/"),
                        qrTempPath.Replace("\\", "/"),
                        slideNum
                    );
                    File.WriteAllText(taskJsonPath, jsonContent, Encoding.UTF8);

                    var psi = new ProcessStartInfo
                    {
                        FileName = "python",
                        Arguments = string.Format("\"{0}\" --task \"{1}\"", scriptPath, taskJsonPath),
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };
                    using (Process p = Process.Start(psi))
                    {
                        string stdout = p.StandardOutput.ReadToEnd();
                        string stderr = p.StandardError.ReadToEnd();
                        p.WaitForExit(8000);

                        try { File.Delete(taskJsonPath); } catch {}

                        if (stdout.Contains("SUCCESS_COM"))
                        {
                            _lblStatus.Text = string.Format("📽️ 成功置入已開啟之 PowerPoint 投影片第 {0} 頁！", slideNum);
                            MessageBox.Show(string.Format("✅ 成功置入已開啟之 PowerPoint 投影片！\n\n簡報：{0}\n目標頁數：第 {1} 頁\n位置：右下角 (寬 140 × 高 140)\n\n同時已複製至剪貼簿，可隨時手動按 Ctrl+V 貼上！", Path.GetFileName(pptPath), slideNum), "置入成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                        else if (stdout.Contains("SUCCESS_PPTX") || p.ExitCode == 0)
                        {
                            _lblStatus.Text = string.Format("📽️ 成功為《{0}》第 {1} 頁置入專屬互動 QR Code！", Path.GetFileName(pptPath), slideNum);
                            MessageBox.Show(string.Format("✅ 成功為簡報檔置入 QR Code！\n\n簡報：{0}\n目標頁數：第 {1} 頁\n位置：右下角 (2 吋大小)\n\n同時已複製至剪貼簿，可隨時手動按 Ctrl+V 貼上！", Path.GetFileName(pptPath), slideNum), "置入成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                        else
                        {
                            _lblStatus.Text = "📋 自動置入完成或已備份至剪貼簿，請切換至 PPT 按 Ctrl+V 貼上！";
                            MessageBox.Show("QR Code 已成功複製到剪貼簿！\n\n若投影片已被其他程式完全鎖定，請直接在 PowerPoint 頁面上按下 Ctrl+V 即可置入！", "置入輔助提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                    }
                }
                else
                {
                    _lblStatus.Text = "📋 QR Code 已複製！請切換至 PPT 按 Ctrl+V 置入投影片";
                    MessageBox.Show("QR Code 已成功複製到剪貼簿！請切換至 PowerPoint 頁面按下 Ctrl+V 貼上！", "複製成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception)
            {
                _lblStatus.Text = "📋 自動置入輔助已複製圖檔，請於 PPT 頁面貼上";
                MessageBox.Show("QR Code 已複製到剪貼簿！請於 PPT 頁面上直接按 Ctrl+V 貼上！", "複製成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void StartCloudflareTunnel()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string cfExe = Path.Combine(appDir, "cloudflared.exe");
            if (!File.Exists(cfExe))
            {
                string alt1 = Path.Combine(appDir, @"..\..\bin_publish\cloudflared.exe");
                if (File.Exists(alt1)) cfExe = Path.GetFullPath(alt1);
            }

            if (!File.Exists(cfExe)) return;

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = cfExe,
                    Arguments = string.Format("tunnel --url http://127.0.0.1:{0}", _webServer.Port),
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardError = true,
                    RedirectStandardOutput = true
                };

                _tunnelProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
                _tunnelProcess.ErrorDataReceived += (sender, args) =>
                {
                    if (string.IsNullOrEmpty(args.Data)) return;
                    var match = Regex.Match(args.Data, @"https://[a-zA-Z0-9-]+\.trycloudflare\.com");
                    if (match.Success && string.IsNullOrEmpty(_tunnelUrl))
                    {
                        _tunnelUrl = match.Value;
                        try
                        {
                            this.BeginInvoke(new Action(() =>
                            {
                                UpdateQrCode();
                            }));
                        }
                        catch { }
                    }
                };

                _tunnelProcess.Start();
                _tunnelProcess.BeginErrorReadLine();
                _tunnelProcess.BeginOutputReadLine();
            }
            catch { }
        }

        private void StopCloudflareTunnel()
        {
            try
            {
                if (_tunnelProcess != null && !_tunnelProcess.HasExited)
                {
                    _tunnelProcess.Kill();
                    _tunnelProcess.Dispose();
                    _tunnelProcess = null;
                }
            }
            catch { }

            try
            {
                foreach (var proc in Process.GetProcessesByName("cloudflared"))
                {
                    try { proc.Kill(); } catch { }
                }
            }
            catch { }
        }

                private void ShowEnlargedQrCode()
        {
            if (_currentQrBitmap == null) return;
            using (Form zoomForm = new Form())
            {
                zoomForm.Text = "📱 課堂投影專屬 QR Code (全班掃碼加入)";
                zoomForm.Size = new Size(680, 750);
                zoomForm.StartPosition = FormStartPosition.CenterParent;
                zoomForm.BackColor = Color.FromArgb(15, 23, 42);
                zoomForm.FormBorderStyle = FormBorderStyle.FixedDialog;
                zoomForm.MaximizeBox = false;
                zoomForm.MinimizeBox = false;

                var lblTitle = new Label();
                lblTitle.Text = _selectedModule != null ? _selectedModule.UnitTitle : "【課堂互動專屬 QR Code】";
                lblTitle.Font = new Font("Microsoft JhengHei", 13f, FontStyle.Bold);
                lblTitle.ForeColor = Color.FromArgb(253, 224, 71);
                lblTitle.TextAlign = ContentAlignment.MiddleCenter;
                lblTitle.Dock = DockStyle.Top;
                lblTitle.Height = 45;

                var pbBig = new PictureBox();
                pbBig.Dock = DockStyle.Fill;
                pbBig.SizeMode = PictureBoxSizeMode.Zoom;
                pbBig.Image = _currentQrBitmap;
                pbBig.BackColor = Color.White;
                pbBig.Padding = new Padding(20);

                var pnlBottom = new Panel();
                pnlBottom.Dock = DockStyle.Bottom;
                pnlBottom.Height = 85;
                pnlBottom.BackColor = Color.FromArgb(30, 41, 59);

                var lblUrl = new Label();
                lblUrl.Text = _lblTargetUrl.Text;
                lblUrl.Font = new Font("Share Tech Mono", 10f, FontStyle.Bold);
                lblUrl.ForeColor = Color.FromArgb(56, 189, 248);
                lblUrl.TextAlign = ContentAlignment.MiddleCenter;
                lblUrl.Dock = DockStyle.Top;
                lblUrl.Height = 35;

                var btnClose = new Button();
                btnClose.Text = "關閉視窗 (Esc)";
                btnClose.Size = new Size(130, 34);
                btnClose.Location = new Point(265, 42);
                btnClose.BackColor = Color.FromArgb(13, 148, 136);
                btnClose.ForeColor = Color.White;
                btnClose.FlatStyle = FlatStyle.Flat;
                btnClose.Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold);
                btnClose.Click += (s, e) => zoomForm.Close();

                zoomForm.KeyPreview = true;
                zoomForm.KeyDown += (s, e) => { if (e.KeyCode == Keys.Escape) zoomForm.Close(); };

                pnlBottom.Controls.Add(btnClose);
                pnlBottom.Controls.Add(lblUrl);

                zoomForm.Controls.Add(pbBig);
                zoomForm.Controls.Add(pnlBottom);
                zoomForm.Controls.Add(lblTitle);

                zoomForm.ShowDialog(this);
            }
        }

        private void ShowEditModuleDialog()
        {
            if (_selectedModule == null)
            {
                MessageBox.Show("請先在題目清單中選取欲編輯更正的題目！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using (Form dlg = new Form())
            {
                dlg.Text = "✏️ 編輯與更正課程科目、單元與題目名稱";
                dlg.Size = new Size(580, 680);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.BackColor = Color.FromArgb(15, 23, 42);
                dlg.ForeColor = Color.White;
                dlg.Font = new Font("Microsoft JhengHei", 9.5f);
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                int y = 15;
                var lblCourse = new Label { Text = "所屬課程科目：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(56, 189, 248), Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };
                var cboCourse = new ComboBox { Location = new Point(25, y + 22), Width = 370, DropDownStyle = ComboBoxStyle.DropDownList, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White };
                var btnAddCourseInEdit = new Button { Text = "➕ 新增科目", Location = new Point(405, y + 21), Size = new Size(110, 27), BackColor = Color.FromArgb(13, 148, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold), Cursor = Cursors.Hand };

                Action RefreshCourses = delegate()
                {
                    cboCourse.Items.Clear();
                    var allC = _dbManager.GetAllCourses();
                    foreach (var c in allC) cboCourse.Items.Add(c);
                    string target = !string.IsNullOrEmpty(_selectedModule.CourseName) ? _selectedModule.CourseName : "膳食療養學";
                    if (cboCourse.Items.Contains(target)) cboCourse.SelectedItem = target;
                    else if (cboCourse.Items.Count > 0) cboCourse.SelectedIndex = 0;
                };
                RefreshCourses();

                btnAddCourseInEdit.Click += (s, e) =>
                {
                    ShowAddCourseDialog();
                    RefreshCourses();
                };

                y += 56;
                var lblUnit = new Label { Text = "所屬教學單元名稱：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71) };
                var txtUnit = new TextBox { Location = new Point(25, y + 22), Width = 490, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Text = _selectedModule.UnitTitle };

                y += 56;
                var lblTitle = new Label { Text = "題目名稱：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71) };
                var txtTitle = new TextBox { Location = new Point(25, y + 22), Width = 490, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Text = _selectedModule.Title };

                y += 56;
                var lblSlide = new Label { Text = "PPT 對應頁數：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(148, 163, 184) };
                var numSlide = new NumericUpDown { Location = new Point(25, y + 22), Width = 110, Minimum = 1, Maximum = 999, Value = _selectedModule.PptSlide > 0 ? _selectedModule.PptSlide : 1, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White };

                var lblStage = new Label { Text = "單元題目順序 (第幾題)：", Location = new Point(165, y), AutoSize = true, ForeColor = Color.FromArgb(148, 163, 184) };
                int curStage = DatabaseManager.GetStageFromRouteOrTitle(_selectedModule.LocalRoute, _selectedModule.Title);
                int countInUnit = 0;
                if (_allModules != null)
                {
                    foreach (var mod in _allModules)
                    {
                        if (mod.UnitId == _selectedModule.UnitId) countInUnit++;
                    }
                }
                int maxStageInUnit = Math.Max(10, countInUnit + 2);
                var numStage = new NumericUpDown { Location = new Point(165, y + 22), Width = 80, Minimum = 1, Maximum = maxStageInUnit, Value = Math.Min(maxStageInUnit, Math.Max(1, curStage)), BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };

                var btnStageUp = new Button { Text = "⬆️ 上移", Location = new Point(260, y + 20), Size = new Size(80, 28), BackColor = Color.FromArgb(13, 148, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold), Cursor = Cursors.Hand };
                var btnStageDown = new Button { Text = "⬇️ 下移", Location = new Point(350, y + 20), Size = new Size(80, 28), BackColor = Color.FromArgb(13, 148, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold), Cursor = Cursors.Hand };

                btnStageUp.Click += (s, e) => { if (numStage.Value > 1) numStage.Value--; };
                btnStageDown.Click += (s, e) => { if (numStage.Value < numStage.Maximum) numStage.Value++; };

                y += 56;
                var lblDesc = new Label { Text = "題目作答選項 (打勾即預設為正確答案)：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71), Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };

                // 解析既有選項描述文字
                string[] parsedOptTexts = new string[4] { "", "", "", "" };
                bool[] parsedOptCorrect = new bool[4] { false, false, false, false };

                if (!string.IsNullOrEmpty(_selectedModule.Description))
                {
                    string[] rawLines = _selectedModule.Description.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    int curOptIdx = 0;
                    foreach (var rawLine in rawLines)
                    {
                        string line = rawLine.Trim();
                        if (string.IsNullOrEmpty(line)) continue;
                        if (curOptIdx >= 4) break;

                        bool isCorr = line.Contains("正確答案");
                        parsedOptCorrect[curOptIdx] = isCorr;

                        // 清除「(正確答案)」標註
                        string cleanText = Regex.Replace(line, @"[\(（\[]?\s*正確答案\s*[\)）\]]?", "").Trim();
                        // 清除前方「選項 1：」前綴
                        var mOpt = Regex.Match(cleanText, @"^選項\s*[0-9一二三四1-4]+\s*[：:]\s*(.*)$");
                        if (mOpt.Success)
                        {
                            cleanText = mOpt.Groups[1].Value.Trim();
                        }

                        parsedOptTexts[curOptIdx] = cleanText;
                        curOptIdx++;
                    }
                }

                // 若解析後無任何選項標註為正確答案，預設第 1 項勾選
                bool hasAnyCorrect = false;
                for (int i = 0; i < 4; i++) if (parsedOptCorrect[i]) { hasAnyCorrect = true; break; }
                if (!hasAnyCorrect) parsedOptCorrect[0] = true;

                // 建立 4 個選項行 (前方配置 CheckBox 方框，打勾預設即為正解)
                CheckBox[] chkBoxes = new CheckBox[4];
                TextBox[] txtBoxes = new TextBox[4];
                bool isUpdatingChecks = false;

                for (int i = 0; i < 4; i++)
                {
                    int optIndex = i;
                    int rowY = y + 26 + i * 36;

                    var chk = new CheckBox
                    {
                        Text = "",
                        Location = new Point(25, rowY + 3),
                        Size = new Size(20, 22),
                        Checked = parsedOptCorrect[i],
                        Cursor = Cursors.Hand
                    };

                    chk.CheckedChanged += (s, e) =>
                    {
                        if (isUpdatingChecks) return;
                        if (chk.Checked)
                        {
                            isUpdatingChecks = true;
                            for (int k = 0; k < 4; k++)
                            {
                                if (k != optIndex)
                                {
                                    chkBoxes[k].Checked = false;
                                    chkBoxes[k].ForeColor = Color.FromArgb(148, 163, 184);
                                }
                            }
                            chk.ForeColor = Color.FromArgb(52, 211, 153);
                            isUpdatingChecks = false;
                        }
                        else
                        {
                            // 確保至少有一項為正解
                            bool anyChecked = false;
                            for (int k = 0; k < 4; k++) if (chkBoxes[k].Checked) { anyChecked = true; break; }
                            if (!anyChecked)
                            {
                                chk.Checked = true;
                                chk.ForeColor = Color.FromArgb(52, 211, 153);
                            }
                            else
                            {
                                chk.ForeColor = Color.FromArgb(148, 163, 184);
                            }
                        }
                    };

                    var lblOptNum = new Label
                    {
                        Text = string.Format("選項 {0}：", i + 1),
                        Location = new Point(50, rowY + 5),
                        Size = new Size(58, 22),
                        ForeColor = Color.FromArgb(226, 232, 240),
                        Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                    };

                    var txtOpt = new TextBox
                    {
                        Location = new Point(110, rowY),
                        Width = 405,
                        BackColor = Color.FromArgb(30, 41, 59),
                        ForeColor = Color.White,
                        Font = new Font("Microsoft JhengHei", 9.5f),
                        Text = parsedOptTexts[i]
                    };

                    chkBoxes[i] = chk;
                    txtBoxes[i] = txtOpt;

                    dlg.Controls.Add(chk);
                    dlg.Controls.Add(lblOptNum);
                    dlg.Controls.Add(txtOpt);
                }

                y = y + 26 + 4 * 36 + 18;
                var btnOk = new Button { Text = "💾 儲存更正", Location = new Point(130, y), Size = new Size(140, 38), BackColor = Color.FromArgb(16, 185, 129), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold), Cursor = Cursors.Hand };
                var btnCancel = new Button { Text = "✖️ 取消 / 僅選取", Location = new Point(285, y), Size = new Size(150, 38), BackColor = Color.FromArgb(51, 65, 85), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand };

                btnOk.Click += (s, e) =>
                {
                    string newTitle = txtTitle.Text.Trim();
                    string newUnitTitle = txtUnit.Text.Trim();
                    string selCourse = cboCourse.SelectedItem != null ? cboCourse.SelectedItem.ToString() : "膳食療養學";
                    if (string.IsNullOrEmpty(newTitle) || string.IsNullOrEmpty(newUnitTitle))
                    {
                        MessageBox.Show("單元名稱與題目名稱皆不可為空！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }

                    // 將方框勾選結果自動組合為包含 (正確答案) 之完整說明
                    List<string> assembledLines = new List<string>();
                    for (int i = 0; i < 4; i++)
                    {
                        string optVal = txtBoxes[i].Text.Trim();
                        if (string.IsNullOrEmpty(optVal)) continue;

                        bool isCorr = chkBoxes[i].Checked;
                        string line = string.Format("選項 {0}：{1}{2}", i + 1, optVal, isCorr ? " (正確答案)" : "");
                        assembledLines.Add(line);
                    }

                    string newDesc = assembledLines.Count > 0 ? string.Join("\r\n", assembledLines) : _selectedModule.Description;

                    _dbManager.UpdateModuleAndUnit(_selectedModule.Id, newTitle, newUnitTitle, selCourse, (int)numSlide.Value, newDesc);

                    int targetStage = (int)numStage.Value;
                    if (targetStage != curStage)
                    {
                        _dbManager.ReorderModuleInUnit(_selectedModule.Id, targetStage);
                    }

                    MessageBox.Show("✅ 課程科目、單元與題目選項已成功更正並儲存！\n(已自動將勾選之方框標註為正確答案)", "成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    dlg.DialogResult = DialogResult.OK;
                    dlg.Close();
                };

                btnCancel.Click += (s, e) => dlg.Close();

                dlg.Controls.Add(lblCourse);
                dlg.Controls.Add(cboCourse);
                dlg.Controls.Add(btnAddCourseInEdit);
                dlg.Controls.Add(lblUnit);
                dlg.Controls.Add(txtUnit);
                dlg.Controls.Add(lblTitle);
                dlg.Controls.Add(txtTitle);
                dlg.Controls.Add(lblSlide);
                dlg.Controls.Add(numSlide);
                dlg.Controls.Add(lblStage);
                dlg.Controls.Add(numStage);
                dlg.Controls.Add(btnStageUp);
                dlg.Controls.Add(btnStageDown);
                dlg.Controls.Add(lblDesc);
                dlg.Controls.Add(btnOk);
                dlg.Controls.Add(btnCancel);

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    int curId = _selectedModule.Id;
                    LoadData();
                    for (int i = 0; i < _displayedModules.Count; i++)
                    {
                        if (_displayedModules[i].Id == curId)
                        {
                            _lstModules.SelectedIndex = i;
                            break;
                        }
                    }
                    RefreshPreview();
                }
            }
        }


        private void ShowEditUnitDialog()
        {
            TeachingModule selectedUnit = _cboUnitFilter.SelectedItem as TeachingModule;
            if (_cboUnitFilter.SelectedIndex <= 0 || selectedUnit == null)
            {
                MessageBox.Show("請先選擇科目，再從單元篩選清單選擇要修改的單元。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using (Form dlg = new Form())
            {
                dlg.Text = "✏️ 修改教學單元";
                dlg.Size = new Size(490, 190);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.BackColor = Color.FromArgb(15, 23, 42);
                dlg.ForeColor = Color.White;
                dlg.Font = new Font("Microsoft JhengHei", 9.5f);
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                var lbl = new Label
                {
                    Text = string.Format("科目：{0}　單元代碼：{1}", selectedUnit.CourseName, selectedUnit.UnitId),
                    Location = new Point(22, 18),
                    Size = new Size(430, 24),
                    ForeColor = Color.FromArgb(56, 189, 248),
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                };
                var txt = new TextBox
                {
                    Location = new Point(22, 48),
                    Width = 430,
                    Text = selectedUnit.UnitTitle,
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.White,
                    Font = new Font("Microsoft JhengHei", 10f)
                };
                var btnOk = new Button
                {
                    Text = "儲存修改",
                    Location = new Point(155, 95),
                    Size = new Size(105, 34),
                    BackColor = Color.FromArgb(16, 185, 129),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Cursor = Cursors.Hand
                };
                var btnCancel = new Button
                {
                    Text = "取消",
                    Location = new Point(275, 95),
                    Size = new Size(90, 34),
                    BackColor = Color.FromArgb(51, 65, 85),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Cursor = Cursors.Hand
                };
                btnOk.Click += (s, e) =>
                {
                    if (string.IsNullOrWhiteSpace(txt.Text))
                    {
                        MessageBox.Show("單元名稱不可為空。", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }
                    _dbManager.UpdateUnitOnly(selectedUnit.UnitId, selectedUnit.CourseName, txt.Text);
                    dlg.DialogResult = DialogResult.OK;
                    dlg.Close();
                };
                btnCancel.Click += (s, e) => dlg.Close();

                dlg.Controls.Add(lbl);
                dlg.Controls.Add(txt);
                dlg.Controls.Add(btnOk);
                dlg.Controls.Add(btnCancel);
                if (dlg.ShowDialog(this) == DialogResult.OK)
                    ReloadUnitsAndModules();
            }
        }

        private void ShowAddUnitOnlyDialog()
        {
            using (Form dlg = new Form())
            {
                dlg.Text = "➕ 新增全新教學單元 (可供跨單元移動或新增題目)";
                dlg.Size = new Size(520, 260);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.BackColor = Color.FromArgb(15, 23, 42);
                dlg.ForeColor = Color.White;
                dlg.Font = new Font("Microsoft JhengHei", 9.5f);
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                int y = 18;
                var lblCourse = new Label { Text = "所屬課程科目：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(56, 189, 248), Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };
                var cboCourse = new ComboBox { Location = new Point(25, y + 22), Width = 330, DropDownStyle = ComboBoxStyle.DropDownList, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White };
                var btnAddCourseInAdd = new Button { Text = "➕ 新增科目", Location = new Point(365, y + 21), Size = new Size(110, 27), BackColor = Color.FromArgb(13, 148, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold), Cursor = Cursors.Hand };

                Action RefreshCourses = delegate()
                {
                    cboCourse.Items.Clear();
                    var allC = _dbManager.GetAllCourses();
                    foreach (var c in allC) cboCourse.Items.Add(c);
                    string target = _cboCourseFilter != null && _cboCourseFilter.SelectedIndex > 0 ? _cboCourseFilter.SelectedItem.ToString() : "膳食療養學";
                    if (cboCourse.Items.Contains(target)) cboCourse.SelectedItem = target;
                    else if (cboCourse.Items.Count > 0) cboCourse.SelectedIndex = 0;
                };
                RefreshCourses();

                btnAddCourseInAdd.Click += (s, e) =>
                {
                    ShowAddCourseDialog();
                    RefreshCourses();
                };

                y += 58;
                var lblUnitTitle = new Label { Text = "單元名稱 (請依課程編號填寫，例如：【單元三】體重控制與管理)：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71), Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };
                var txtUnitTitle = new TextBox { Location = new Point(25, y + 24), Width = 450, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Text = "【自訂單元】臨床營養照護" };

                y += 65;
                var btnOk = new Button { Text = "確認建立單元", Location = new Point(135, y), Size = new Size(130, 36), BackColor = Color.FromArgb(16, 185, 129), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold), Cursor = Cursors.Hand };
                var btnCancel = new Button { Text = "取消", Location = new Point(285, y), Size = new Size(100, 36), BackColor = Color.FromArgb(51, 65, 85), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand };

                btnOk.Click += (s, e) =>
                {
                    string uTitle = txtUnitTitle.Text.Trim();
                    if (string.IsNullOrEmpty(uTitle))
                    {
                        MessageBox.Show("請輸入單元名稱！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }
                    string selCourse = cboCourse.SelectedItem != null ? cboCourse.SelectedItem.ToString() : "膳食療養學";
                    string uId = "unit_" + Guid.NewGuid().ToString("N").Substring(0, 6);
                    string uRoute = string.Format("/index.html?unit={0}", uId.Replace("unit_", ""));

                    _dbManager.AddUnitOnly(uId, uTitle, uRoute, selCourse);
                    MessageBox.Show(string.Format("已成功建立全新單元「{0}」！\n\n所屬科目：{1}\n\n您現在可以：\n1. 從下方題目清單選取既有題目，點選「↔️ 移動至此單元」移入。\n2. 或點選「➕ 新增題目」在此單元中直接新增全新題目！", uTitle, selCourse), "單元建立成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    dlg.DialogResult = DialogResult.OK;
                    dlg.Close();
                };

                btnCancel.Click += (s, e) => dlg.Close();

                dlg.Controls.Add(lblCourse);
                dlg.Controls.Add(cboCourse);
                dlg.Controls.Add(btnAddCourseInAdd);
                dlg.Controls.Add(lblUnitTitle);
                dlg.Controls.Add(txtUnitTitle);
                dlg.Controls.Add(btnOk);
                dlg.Controls.Add(btnCancel);

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    LoadData();
                }
            }
        }

        private void DeleteSelectedModule()
        {
            if (_selectedModule == null)
            {
                MessageBox.Show("請先在題目清單中點選欲刪除的題目！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            var dr = MessageBox.Show(
                string.Format("確定要刪除題目「{0}」嗎？\n\n單元：{1}\n科目：{2}\n\n⚠️ 警告：刪除後將無法復原！", _selectedModule.Title, _selectedModule.UnitTitle, _selectedModule.CourseName),
                "確認刪除題目",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning
            );

            if (dr == DialogResult.Yes)
            {
                _dbManager.DeleteModule(_selectedModule.Id);
                MessageBox.Show(string.Format("題目「{0}」已成功刪除！", _selectedModule.Title), "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                LoadData();
            }
        }

        private void ShowAddQuestionDialog()
        {
            using (Form dlg = new Form())
            {
                dlg.Text = "➕ 新增題目至教學單元";
                dlg.Size = new Size(540, 620);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.BackColor = Color.FromArgb(15, 23, 42);
                dlg.ForeColor = Color.White;
                dlg.Font = new Font("Microsoft JhengHei", 9.5f);
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                int y = 15;
                var lblCourse = new Label { Text = "所屬課程科目：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(56, 189, 248), Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };
                var cboCourse = new ComboBox { Location = new Point(25, y + 22), Width = 350, DropDownStyle = ComboBoxStyle.DropDownList, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White };
                var btnAddCourseInAdd = new Button { Text = "➕ 新增科目", Location = new Point(385, y + 21), Size = new Size(110, 27), BackColor = Color.FromArgb(13, 148, 136), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold), Cursor = Cursors.Hand };

                Action RefreshAddCourses = delegate()
                {
                    cboCourse.Items.Clear();
                    var allC = _dbManager.GetAllCourses();
                    foreach (var c in allC) cboCourse.Items.Add(c);
                    string target = _cboCourseFilter != null && _cboCourseFilter.SelectedIndex > 0 ? _cboCourseFilter.SelectedItem.ToString() : "膳食療養學";
                    if (cboCourse.Items.Contains(target)) cboCourse.SelectedItem = target;
                    else if (cboCourse.Items.Count > 0) cboCourse.SelectedIndex = 0;
                };
                RefreshAddCourses();

                btnAddCourseInAdd.Click += (s, e) =>
                {
                    ShowAddCourseDialog();
                    RefreshAddCourses();
                };

                y += 56;
                var lblUnit = new Label { Text = "所屬教學單元：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71) };
                var cboUnit = new ComboBox { Location = new Point(25, y + 22), Width = 470, DropDownStyle = ComboBoxStyle.DropDownList, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White };
                
                Action RefreshUnitsForCourse = delegate()
                {
                    cboUnit.Items.Clear();
                    string selC = cboCourse.SelectedItem != null ? cboCourse.SelectedItem.ToString() : null;
                    var uList = _dbManager.GetDistinctUnits(selC);
                    foreach (var u in uList)
                    {
                        cboUnit.Items.Add(u);
                    }
                    cboUnit.Items.Add("【自訂新單元】建立全新自訂教學單元");
                    if (cboUnit.Items.Count > 1) cboUnit.SelectedIndex = 0;
                };
                RefreshUnitsForCourse();
                cboCourse.SelectedIndexChanged += (s, e) => RefreshUnitsForCourse();

                y += 56;
                var lblCustomUnit = new Label { Text = "自訂單元名稱 (若選擇全新單元)：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(148, 163, 184) };
                var txtCustomUnit = new TextBox { Location = new Point(25, y + 22), Width = 470, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Text = "【自訂單元】臨床重症腸道營養支持實戰" };

                y += 56;
                var lblTitle = new Label { Text = "題目名稱：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71) };
                var txtTitle = new TextBox { Location = new Point(25, y + 22), Width = 470, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Text = "第 6 題：腸道餵養耐受性指標評估" };

                y += 56;
                var lblSlide = new Label { Text = "PPT 對應頁數：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(148, 163, 184) };
                var numSlide = new NumericUpDown { Location = new Point(25, y + 22), Width = 130, Minimum = 1, Maximum = 999, Value = 15, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White };

                y += 56;
                var lblDesc = new Label { Text = "題目作答選項 (每行一個選項，可於正確項目標註「正確答案」)：", Location = new Point(25, y), AutoSize = true, ForeColor = Color.FromArgb(253, 224, 71), Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold) };
                var txtDesc = new TextBox { Location = new Point(25, y + 22), Width = 470, Height = 100, Multiline = true, BackColor = Color.FromArgb(30, 41, 59), ForeColor = Color.White, Text = "選項 1：標準臨床指引建議項目 (正確答案)\r\n選項 2：次要參考指標\r\n選項 3：待評估項目\r\n選項 4：臨床禁忌或非首選", ScrollBars = ScrollBars.Vertical, Font = new Font("Microsoft JhengHei", 9f) };

                y += 135;
                var btnOk = new Button { Text = "確認新增題目", Location = new Point(135, y), Size = new Size(130, 36), BackColor = Color.FromArgb(16, 185, 129), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold) };
                var btnCancel = new Button { Text = "取消", Location = new Point(285, y), Size = new Size(110, 36), BackColor = Color.FromArgb(51, 65, 85), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };

                btnOk.Click += (s, e) =>
                {
                    string selCourse = cboCourse.SelectedItem != null ? cboCourse.SelectedItem.ToString() : "膳食療養學";
                    string uId = "unit_must";
                    string uTitle = "【單元一】MUST 臨床營養評估實戰";
                    string uRoute = "/index.html?unit=must";

                    TeachingModule selectedExistingUnit = cboUnit.SelectedItem as TeachingModule;
                    if (selectedExistingUnit != null)
                    {
                        uId = selectedExistingUnit.UnitId;
                        uTitle = selectedExistingUnit.UnitTitle;
                        uRoute = selectedExistingUnit.UnitRoute;
                    }
                    else
                    {
                        uId = "unit_" + Guid.NewGuid().ToString("N").Substring(0, 6);
                        uTitle = txtCustomUnit.Text.Trim();
                        uRoute = string.Format("/index.html?unit={0}", uId.Replace("unit_", ""));
                    }

                    var newMod = new TeachingModule
                    {
                        UnitId = uId,
                        UnitTitle = uTitle,
                        UnitRoute = uRoute,
                        ModuleCode = "MOD_" + DateTime.Now.ToString("yyyyMMddHHmmss"),
                        Title = txtTitle.Text.Trim(),
                        CourseName = selCourse,
                        PptFile = "1 營養照顧流程.pptx",
                        PptSlide = (int)numSlide.Value,
                        LocalRoute = string.Format("{0}&stage=1", uRoute),
                        Description = txtDesc.Text.Trim()
                    };

                    _dbManager.AddModule(newMod);
                    MessageBox.Show(string.Format("已成功新增題目「{0}」至 {1}！\n所屬科目：{2}\n同單元將共用相同 QR Code 並連續計分。", newMod.Title, uTitle, selCourse), "新增成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    dlg.DialogResult = DialogResult.OK;
                    dlg.Close();
                };

                btnCancel.Click += (s, e) => dlg.Close();

                dlg.Controls.Add(lblCourse);
                dlg.Controls.Add(cboCourse);
                dlg.Controls.Add(btnAddCourseInAdd);
                dlg.Controls.Add(lblUnit);
                dlg.Controls.Add(cboUnit);
                dlg.Controls.Add(lblCustomUnit);
                dlg.Controls.Add(txtCustomUnit);
                dlg.Controls.Add(lblTitle);
                dlg.Controls.Add(txtTitle);
                dlg.Controls.Add(lblSlide);
                dlg.Controls.Add(numSlide);
                dlg.Controls.Add(lblDesc);
                dlg.Controls.Add(txtDesc);
                dlg.Controls.Add(btnOk);
                dlg.Controls.Add(btnCancel);

                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    LoadData();
                    if (_lstModules.Items.Count > 0)
                    {
                        _lstModules.SelectedIndex = _lstModules.Items.Count - 1;
                    }
                }
            }
        }

        private void ShowTwoTierBatchCopyDialog()
        {
            using (Form dlg = new Form())
            {
                dlg.Text = "📋 兩階題目批次複製精靈 (選單元 ➔ 勾選題目 ➔ 複製到所要科目)";
                dlg.Size = new Size(640, 630);
                dlg.StartPosition = FormStartPosition.CenterParent;
                dlg.BackColor = Color.FromArgb(15, 23, 42);
                dlg.ForeColor = Color.White;
                dlg.Font = new Font("Microsoft JhengHei", 9.5f);
                dlg.FormBorderStyle = FormBorderStyle.FixedDialog;
                dlg.MaximizeBox = false;
                dlg.MinimizeBox = false;

                // Group 1: 來源設定 (第一階選單元 ➔ 第二階勾選題目)
                var grpSource = new GroupBox
                {
                    Text = "📌 來源設定 (第一階選單元 ➔ 第二階勾選題目)",
                    Location = new Point(16, 12),
                    Size = new Size(592, 290),
                    ForeColor = Color.FromArgb(56, 189, 248),
                    Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold)
                };

                var lblStep1 = new Label
                {
                    Text = "第一階：來源單元 (下拉選單)：",
                    Location = new Point(14, 26),
                    Size = new Size(200, 22),
                    ForeColor = Color.FromArgb(253, 224, 71),
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                };

                var cboSourceUnit = new ComboBox
                {
                    DropDownStyle = ComboBoxStyle.DropDownList,
                    Location = new Point(220, 24),
                    Size = new Size(356, 26),
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.White,
                    Font = new Font("Microsoft JhengHei", 9f)
                };

                var lblStep2 = new Label
                {
                    Text = "第二階：請勾選要複製的題目 (支援複選)：",
                    Location = new Point(14, 60),
                    Size = new Size(280, 22),
                    ForeColor = Color.FromArgb(253, 224, 71),
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                };

                var btnSelAll = new Button
                {
                    Text = "☑️ 全選",
                    Location = new Point(366, 54),
                    Size = new Size(96, 28),
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.FromArgb(56, 189, 248),
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };

                var btnUnselAll = new Button
                {
                    Text = "🔲 取消全選",
                    Location = new Point(468, 54),
                    Size = new Size(108, 28),
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.FromArgb(148, 163, 184),
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };

                var chkQuestions = new CheckedListBox
                {
                    Location = new Point(14, 88),
                    Size = new Size(562, 186),
                    BackColor = Color.FromArgb(15, 23, 42),
                    ForeColor = Color.FromArgb(241, 245, 249),
                    BorderStyle = BorderStyle.FixedSingle,
                    CheckOnClick = true,
                    Font = new Font("Microsoft JhengHei", 9f)
                };

                var sourceUnitModulesMap = new Dictionary<string, List<TeachingModule>>();
                var distinctUnits = _dbManager.GetDistinctUnits();
                var allModules = _dbManager.GetAllModules();

                foreach (var u in distinctUnits)
                {
                    string key = u.CourseName + "|" + u.UnitId;
                    var uMods = allModules.FindAll(m => m.UnitId == u.UnitId && m.CourseName == u.CourseName);
                    if (uMods.Count > 0)
                    {
                        sourceUnitModulesMap[key] = uMods;
                        cboSourceUnit.Items.Add(new SourceUnitComboItem
                        {
                            Key = key,
                            Unit = u,
                            DisplayText = string.Format("【{0}】{1} (共 {2} 題)", u.CourseName, u.UnitTitle, uMods.Count)
                        });
                    }
                }

                Action populateQuestions = () =>
                {
                    chkQuestions.Items.Clear();
                    var selItem = cboSourceUnit.SelectedItem as SourceUnitComboItem;
                    if (selItem != null && sourceUnitModulesMap.ContainsKey(selItem.Key))
                    {
                        var mods = sourceUnitModulesMap[selItem.Key];
                        for (int i = 0; i < mods.Count; i++)
                        {
                            chkQuestions.Items.Add(new QuestionCheckItem { Module = mods[i] }, false);
                        }
                    }
                };

                cboSourceUnit.SelectedIndexChanged += (s, e) => populateQuestions();

                btnSelAll.Click += (s, e) => {
                    for (int i = 0; i < chkQuestions.Items.Count; i++) chkQuestions.SetItemChecked(i, true);
                };
                btnUnselAll.Click += (s, e) => {
                    for (int i = 0; i < chkQuestions.Items.Count; i++) chkQuestions.SetItemChecked(i, false);
                };

                if (cboSourceUnit.Items.Count > 0)
                {
                    int initIdx = 0;
                    if (_selectedModule != null)
                    {
                        string curKey = _selectedModule.CourseName + "|" + _selectedModule.UnitId;
                        for (int i = 0; i < cboSourceUnit.Items.Count; i++)
                        {
                            var itm = cboSourceUnit.Items[i] as SourceUnitComboItem;
                            if (itm != null && itm.Key == curKey) { initIdx = i; break; }
                        }
                    }
                    cboSourceUnit.SelectedIndex = initIdx;
                }

                grpSource.Controls.Add(lblStep1);
                grpSource.Controls.Add(cboSourceUnit);
                grpSource.Controls.Add(lblStep2);
                grpSource.Controls.Add(btnSelAll);
                grpSource.Controls.Add(btnUnselAll);
                grpSource.Controls.Add(chkQuestions);

                // Group 2: 目標設定 (到所要的科目)
                var grpTarget = new GroupBox
                {
                    Text = "🎯 目標設定 (複製到所要的科目與單元)",
                    Location = new Point(16, 310),
                    Size = new Size(592, 180),
                    ForeColor = Color.FromArgb(56, 189, 248),
                    Font = new Font("Microsoft JhengHei", 9.5f, FontStyle.Bold)
                };

                var lblTgtCourse = new Label
                {
                    Text = "所要的科目 (目標科目)：",
                    Location = new Point(14, 30),
                    Size = new Size(180, 22),
                    ForeColor = Color.FromArgb(253, 224, 71),
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                };

                var cboTargetCourse = new ComboBox
                {
                    DropDownStyle = ComboBoxStyle.DropDownList,
                    Location = new Point(194, 28),
                    Size = new Size(270, 26),
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.White,
                    Font = new Font("Microsoft JhengHei", 9f)
                };

                var btnAddTgtCourse = new Button
                {
                    Text = "➕ 新增科目",
                    Location = new Point(472, 28),
                    Size = new Size(104, 26),
                    BackColor = Color.FromArgb(13, 148, 136),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };

                var lblTgtUnit = new Label
                {
                    Text = "目標單元：",
                    Location = new Point(14, 72),
                    Size = new Size(180, 22),
                    ForeColor = Color.FromArgb(253, 224, 71),
                    Font = new Font("Microsoft JhengHei", 9f, FontStyle.Bold)
                };

                var cboTargetUnit = new ComboBox
                {
                    DropDownStyle = ComboBoxStyle.DropDownList,
                    Location = new Point(194, 70),
                    Size = new Size(270, 26),
                    BackColor = Color.FromArgb(30, 41, 59),
                    ForeColor = Color.White,
                    Font = new Font("Microsoft JhengHei", 9f)
                };

                var btnAddTgtUnit = new Button
                {
                    Text = "➕ 新增單元",
                    Location = new Point(472, 70),
                    Size = new Size(104, 26),
                    BackColor = Color.FromArgb(13, 148, 136),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 8.5f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };

                var lblHint = new Label
                {
                    Text = "💡 提示：複製後系統會自動在目標單元中編排新題號，並共用該單元之 QR Code 進行連續計分！",
                    Location = new Point(14, 114),
                    Size = new Size(560, 50),
                    ForeColor = Color.FromArgb(148, 163, 184),
                    Font = new Font("Microsoft JhengHei", 8.5f)
                };

                Action reloadTargetCourses = () =>
                {
                    string prevCourse = cboTargetCourse.SelectedItem != null ? cboTargetCourse.SelectedItem.ToString() : null;
                    cboTargetCourse.Items.Clear();
                    var courses = _dbManager.GetAllCourses();
                    foreach (var c in courses) cboTargetCourse.Items.Add(c);
                    if (prevCourse != null && cboTargetCourse.Items.Contains(prevCourse))
                        cboTargetCourse.SelectedItem = prevCourse;
                    else if (cboTargetCourse.Items.Count > 0)
                        cboTargetCourse.SelectedIndex = 0;
                };

                Action reloadTargetUnits = () =>
                {
                    cboTargetUnit.Items.Clear();
                    string selCourse = cboTargetCourse.SelectedItem != null ? cboTargetCourse.SelectedItem.ToString() : null;
                    if (!string.IsNullOrEmpty(selCourse))
                    {
                        var units = _dbManager.GetDistinctUnits(selCourse);
                        foreach (var u in units) cboTargetUnit.Items.Add(new MoveTargetUnitItem { Unit = u });
                    }
                    if (cboTargetUnit.Items.Count > 0) cboTargetUnit.SelectedIndex = 0;
                };

                cboTargetCourse.SelectedIndexChanged += (s, e) => reloadTargetUnits();
                reloadTargetCourses();

                btnAddTgtCourse.Click += (s, e) => {
                    ShowAddCourseDialog();
                    reloadTargetCourses();
                };

                btnAddTgtUnit.Click += (s, e) => {
                    ShowAddUnitOnlyDialog();
                    reloadTargetUnits();
                };

                grpTarget.Controls.Add(lblTgtCourse);
                grpTarget.Controls.Add(cboTargetCourse);
                grpTarget.Controls.Add(btnAddTgtCourse);
                grpTarget.Controls.Add(lblTgtUnit);
                grpTarget.Controls.Add(cboTargetUnit);
                grpTarget.Controls.Add(btnAddTgtUnit);
                grpTarget.Controls.Add(lblHint);

                // Bottom Action Buttons
                var btnExecute = new Button
                {
                    Text = "📋 開始批次複製選取題目至目標科目 ➔",
                    Location = new Point(130, 510),
                    Size = new Size(350, 42),
                    BackColor = Color.FromArgb(16, 185, 129),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 10.5f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };

                var btnClose = new Button
                {
                    Text = "關閉",
                    Location = new Point(494, 510),
                    Size = new Size(114, 42),
                    BackColor = Color.FromArgb(71, 85, 105),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Microsoft JhengHei", 10f),
                    Cursor = Cursors.Hand
                };
                btnClose.Click += (s, e) => dlg.Close();

                btnExecute.Click += (s, e) =>
                {
                    var checkedItems = new List<TeachingModule>();
                    for (int i = 0; i < chkQuestions.Items.Count; i++)
                    {
                        if (chkQuestions.GetItemChecked(i))
                        {
                            var qItm = chkQuestions.Items[i] as QuestionCheckItem;
                            if (qItm != null) checkedItems.Add(qItm.Module);
                        }
                    }

                    if (checkedItems.Count == 0)
                    {
                        MessageBox.Show("請至少勾選一題要複製的題目！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return;
                    }

                    string targetCourse = cboTargetCourse.SelectedItem != null ? cboTargetCourse.SelectedItem.ToString() : null;
                    var targetUnitItem = cboTargetUnit.SelectedItem as MoveTargetUnitItem;
                    if (string.IsNullOrEmpty(targetCourse) || targetUnitItem == null || targetUnitItem.Unit == null)
                    {
                        MessageBox.Show("請選擇目標科目與目標單元！", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return;
                    }

                    var tgtUnit = targetUnitItem.Unit;
                    int successCount = 0;
                    int lastCopiedId = -1;

                    try
                    {
                        foreach (var mod in checkedItems)
                        {
                            int newId = _dbManager.CopyModuleToUnit(mod.Id, tgtUnit.UnitId, tgtUnit.UnitTitle, tgtUnit.UnitRoute, targetCourse);
                            if (newId > 0)
                            {
                                successCount++;
                                lastCopiedId = newId;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("複製題目過程發生錯誤：" + ex.Message, "複製失敗", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return;
                    }

                    MessageBox.Show(
                        string.Format("✅ 成功複製 {0} 道題目至：\n科目：【{1}】\n單元：{2}！", successCount, targetCourse, tgtUnit.UnitTitle),
                        "批次複製成功",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );

                    if (_cboCourseFilter.Items.Contains(targetCourse))
                    {
                        _cboCourseFilter.SelectedItem = targetCourse;
                    }
                    ReloadUnitsAndModules();

                    dlg.Close();
                };

                dlg.Controls.Add(grpSource);
                dlg.Controls.Add(grpTarget);
                dlg.Controls.Add(btnExecute);
                dlg.Controls.Add(btnClose);

                dlg.ShowDialog(this);
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            StopCloudflareTunnel();
            if (_webServer != null)
            {
                _webServer.Stop();
            }
            try
            {
                if (!string.IsNullOrEmpty(_webViewUserDataFolder) && Directory.Exists(_webViewUserDataFolder))
                {
                    Directory.Delete(_webViewUserDataFolder, true);
                }
            }
            catch { }
        }
    }

    public class SourceUnitComboItem
    {
        public string Key { get; set; }
        public TeachingModule Unit { get; set; }
        public string DisplayText { get; set; }
        public override string ToString() { return DisplayText; }
    }

    public class QuestionCheckItem
    {
        public TeachingModule Module { get; set; }
        public override string ToString()
        {
            if (Module == null) return "";
            if (!string.IsNullOrEmpty(Module.Title))
            {
                return Module.Title;
            }
            return Module.ModuleCode ?? "";
        }
    }

    public class MoveTargetUnitItem
    {
        public TeachingModule Unit { get; set; }
        public override string ToString()
        {
            if (Unit == null) return "未知單元";
            return Unit.UnitTitle ?? Unit.UnitId;
        }
    }
}
