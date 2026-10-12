// Xbox mode home app bridge. Windows starts this packaged entry point as the gaming home app;
// it opens the installed Xbox Preview UI full screen and stays alive while the launcher runs,
// so Windows does not restart the home app.
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Windows.Forms;

static class XboxPreviewUIHome
{
    [STAThread]
    static int Main()
    {
        string localPrograms = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Xbox Preview UI", "Xbox Preview UI.exe");
        string configured = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Xbox Preview UI", "xbox-mode-target.txt");
        string target = File.Exists(configured) ? File.ReadAllText(configured).Trim() : localPrograms;
        if (!File.Exists(target)) target = localPrograms;
        if (!File.Exists(target))
        {
            MessageBox.Show("Xbox Preview UI is not installed. Install it, then choose it again in Xbox mode settings.", "Xbox Preview UI", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
        try
        {
            Process.Start(new ProcessStartInfo(target, "--xbox-mode") { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(target) });
        }
        catch (Exception error)
        {
            MessageBox.Show("Xbox Preview UI could not start: " + error.Message, "Xbox Preview UI", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        // The launcher is single instance; wait for whichever copy is running to close.
        string name = Path.GetFileNameWithoutExtension(target);
        Thread.Sleep(4000);
        while (Process.GetProcessesByName(name).Any()) Thread.Sleep(2000);
        return 0;
    }
}
