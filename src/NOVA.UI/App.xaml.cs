using System.IO;
using System.Windows;
using System.Windows.Threading;
using NOVA.Logging;

namespace NOVA.UI;

public partial class App : Application
{
    public static string DataDir { get; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NOVA DVB Studio");

    protected override void OnStartup(StartupEventArgs e)
    {
        Directory.CreateDirectory(DataDir);
        Log.Init(DataDir, "app");
        Log.Info("NOVA DVB Studio starting");
        DispatcherUnhandledException += OnUiError;
        AppDomain.CurrentDomain.UnhandledException += (_, a) => Log.Error("Unhandled", a.ExceptionObject as Exception);
        base.OnStartup(e);
    }

    private static void OnUiError(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        Log.Error("UI error", e.Exception);
        e.Handled = true;
    }
}
