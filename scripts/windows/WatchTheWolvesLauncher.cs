using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    // Adjust these defaults if your server paths/hostnames differ.
    private const string ProjectDir = @"C:\opt\watch-the-wolves";
    private const string ManifestUrl = "https://streamio.watchthewolves.com/manifest.json";

    [STAThread]
    private static void Main()
    {
        try
        {
            StartCloudflaredService();
            StartAddonWindow();
            OpenManifest();
        }
        catch (Exception ex)
        {
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k echo [WTW] Launcher error: " + EscapeForCmd(ex.Message),
                UseShellExecute = true
            };
            Process.Start(psi);
        }
    }

    private static void StartCloudflaredService()
    {
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c sc start cloudflared",
            UseShellExecute = false,
            CreateNoWindow = true
        };

        Process p = Process.Start(psi);
        if (p != null)
        {
            p.WaitForExit(8000);
            p.Dispose();
        }
    }

    private static void StartAddonWindow()
    {
        if (!Directory.Exists(ProjectDir))
        {
            throw new DirectoryNotFoundException("Project folder not found: " + ProjectDir);
        }

        var command = "title Watch The Wolves - Stremio Addon && cd /d \"" + ProjectDir + "\" && npm run stremio:addon";
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/k " + command,
            UseShellExecute = true
        };

        Process.Start(psi);
    }

    private static void OpenManifest()
    {
        var psi = new ProcessStartInfo
        {
            FileName = ManifestUrl,
            UseShellExecute = true
        };

        Process.Start(psi);
    }

    private static string EscapeForCmd(string input)
    {
        return input
            .Replace("^", "^^")
            .Replace("&", "^&")
            .Replace("|", "^|")
            .Replace("<", "^<")
            .Replace(">", "^>");
    }
}
