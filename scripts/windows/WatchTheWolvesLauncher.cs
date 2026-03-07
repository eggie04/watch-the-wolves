using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    private const string ProjectDir = @"C:\opt\watch-the-wolves";
    private const string MediaMtxDir = @"C:\opt\mediamtx";
    private const string MediaMtxExe = "mediamtx.exe";
    private const string ManifestUrl = "https://streamio.watchthewolves.com/manifest.json";
    private const int AddonPort = 7010;
    private const int MediaMtxHlsPort = 8888;
    private const int MediaMtxRtmpPort = 1935;
    private static Process _addonProcess;
    private static Process _mediaMtxProcess;
    private static Label _status;
    private static TextBox _log;

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(CreateMainForm());
    }

    private static Form CreateMainForm()
    {
        var form = new Form();
        form.Text = "Watch The Wolves";
        form.Width = 720;
        form.Height = 460;

        var startButton = new Button();
        startButton.Text = "Start";
        startButton.Left = 20;
        startButton.Top = 20;
        startButton.Width = 100;
        startButton.Click += delegate { StartAll(); };

        var stopButton = new Button();
        stopButton.Text = "Stop";
        stopButton.Left = 130;
        stopButton.Top = 20;
        stopButton.Width = 100;
        stopButton.Click += delegate { StopAddon(); };

        var openButton = new Button();
        openButton.Text = "Open Manifest";
        openButton.Left = 240;
        openButton.Top = 20;
        openButton.Width = 130;
        openButton.Click += delegate { OpenManifest(); };

        _status = new Label();
        _status.Left = 20;
        _status.Top = 60;
        _status.Width = 650;
        _status.Text = "Status: idle";

        _log = new TextBox();
        _log.Multiline = true;
        _log.ScrollBars = ScrollBars.Vertical;
        _log.ReadOnly = true;
        _log.Left = 20;
        _log.Top = 90;
        _log.Width = 660;
        _log.Height = 320;

        form.Controls.Add(startButton);
        form.Controls.Add(stopButton);
        form.Controls.Add(openButton);
        form.Controls.Add(_status);
        form.Controls.Add(_log);

        form.FormClosing += delegate { StopAddon(); };
        form.Shown += delegate { StartAll(); };
        return form;
    }

    private static void StartAll()
    {
        try
        {
            StartCloudflaredService();
            StartMediaMtxBackground();
            StartAddonBackground();
            SetStatus("running");
        }
        catch (Exception ex)
        {
            SetStatus("error");
            AppendLog("[WTW] " + ex.Message);
        }
    }

    private static void StartCloudflaredService()
    {
        var psi = new ProcessStartInfo();
        psi.FileName = "cmd.exe";
        psi.Arguments = "/c sc start cloudflared";
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        using (var p = Process.Start(psi))
        {
            if (p != null) p.WaitForExit(8000);
        }
        AppendLog("[WTW] cloudflared service start requested.");
    }

    private static void StartAddonBackground()
    {
        if (!Directory.Exists(ProjectDir))
        {
            throw new DirectoryNotFoundException("Project folder not found: " + ProjectDir);
        }
        if (IsPortListening(AddonPort))
        {
            AppendLog("[WTW] addon already listening on port " + AddonPort + ".");
            SetStatus("running");
            return;
        }
        if (_addonProcess != null && !_addonProcess.HasExited)
        {
            AppendLog("[WTW] addon already running.");
            return;
        }

        var psi = new ProcessStartInfo();
        psi.FileName = "cmd.exe";
        psi.Arguments = "/c npm run stremio:addon";
        psi.WorkingDirectory = ProjectDir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;

        _addonProcess = new Process();
        _addonProcess.StartInfo = psi;
        _addonProcess.EnableRaisingEvents = true;
        _addonProcess.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) { if (!string.IsNullOrEmpty(e.Data)) AppendLog(e.Data); };
        _addonProcess.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) { if (!string.IsNullOrEmpty(e.Data)) AppendLog(e.Data); };
        _addonProcess.Exited += delegate { SetStatus("stopped"); };

        _addonProcess.Start();
        _addonProcess.BeginOutputReadLine();
        _addonProcess.BeginErrorReadLine();
        AppendLog("[WTW] addon process started.");
    }

    private static void StartMediaMtxBackground()
    {
        if (IsPortListening(MediaMtxHlsPort) || IsPortListening(MediaMtxRtmpPort))
        {
            AppendLog("[WTW] MediaMTX already listening (RTMP/HLS).");
            return;
        }
        if (!Directory.Exists(MediaMtxDir))
        {
            AppendLog("[WTW] MediaMTX folder not found: " + MediaMtxDir);
            return;
        }

        string exePath = Path.Combine(MediaMtxDir, MediaMtxExe);
        if (!File.Exists(exePath))
        {
            AppendLog("[WTW] MediaMTX binary not found: " + exePath);
            return;
        }

        if (_mediaMtxProcess != null && !_mediaMtxProcess.HasExited)
        {
            AppendLog("[WTW] MediaMTX already running.");
            return;
        }

        var psi = new ProcessStartInfo();
        psi.FileName = exePath;
        psi.WorkingDirectory = MediaMtxDir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;

        _mediaMtxProcess = new Process();
        _mediaMtxProcess.StartInfo = psi;
        _mediaMtxProcess.EnableRaisingEvents = true;
        _mediaMtxProcess.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) { if (!string.IsNullOrEmpty(e.Data)) AppendLog("[MediaMTX] " + e.Data); };
        _mediaMtxProcess.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) { if (!string.IsNullOrEmpty(e.Data)) AppendLog("[MediaMTX] " + e.Data); };
        _mediaMtxProcess.Exited += delegate { AppendLog("[WTW] MediaMTX exited."); };

        _mediaMtxProcess.Start();
        _mediaMtxProcess.BeginOutputReadLine();
        _mediaMtxProcess.BeginErrorReadLine();
        AppendLog("[WTW] MediaMTX process started.");
    }

    private static bool IsPortListening(int port)
    {
        var psi = new ProcessStartInfo();
        psi.FileName = "cmd.exe";
        psi.Arguments = "/c netstat -ano -p tcp | findstr LISTENING | findstr :" + port;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true;

        using (var p = Process.Start(psi))
        {
            if (p == null) return false;
            string output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(3000);
            return !string.IsNullOrWhiteSpace(output);
        }
    }

    private static void StopAddon()
    {
        try
        {
            if (_addonProcess != null && !_addonProcess.HasExited)
            {
                _addonProcess.Kill();
                _addonProcess.WaitForExit(3000);
                AppendLog("[WTW] addon process stopped.");
            }
        }
        catch (Exception ex)
        {
            AppendLog("[WTW] stop error: " + ex.Message);
        }
        try
        {
            if (_mediaMtxProcess != null && !_mediaMtxProcess.HasExited)
            {
                _mediaMtxProcess.Kill();
                _mediaMtxProcess.WaitForExit(3000);
                AppendLog("[WTW] MediaMTX process stopped.");
            }
        }
        catch (Exception ex)
        {
            AppendLog("[WTW] MediaMTX stop error: " + ex.Message);
        }
        SetStatus("stopped");
    }

    private static void OpenManifest()
    {
        var psi = new ProcessStartInfo();
        psi.FileName = ManifestUrl;
        psi.UseShellExecute = true;
        Process.Start(psi);
    }

    private static void SetStatus(string value)
    {
        if (_status == null) return;
        if (_status.InvokeRequired)
        {
            _status.BeginInvoke(new Action<string>(SetStatus), value);
            return;
        }
        _status.Text = "Status: " + value;
    }

    private static void AppendLog(string line)
    {
        if (_log == null) return;
        if (_log.InvokeRequired)
        {
            _log.BeginInvoke(new Action<string>(AppendLog), line);
            return;
        }
        _log.AppendText(line + Environment.NewLine);
    }
}
