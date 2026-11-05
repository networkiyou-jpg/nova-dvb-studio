using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using NOVA.Database;
using NOVA.Logging;
using NOVA.Media;

namespace NOVA.UI;

/// <summary>Hosts the interface and connects it to the engine, the player and local storage.</summary>
public partial class MainWindow : Window
{
    private const string StateKey = "app_state";
    private readonly Store _store = new(Path.Combine(App.DataDir, "nova.db"));
    private readonly EngineClient _engine = new();
    private readonly SystemStats _stats = new();
    private readonly DispatcherTimer _statsTimer = new() { Interval = TimeSpan.FromSeconds(2) };
    private VideoWindow? _video;
    private TvPlayer? _player;
    private CoreWebView2? _core;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(45) };
    private bool _webReady, _fullscreen;
    private WindowState _beforeFullscreen;
    private bool _muted = true;
    private int _volume = 40;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) => await StartAsync();
        Closed += (_, _) => Shutdown();
        LocationChanged += (_, _) => _video?.Reposition();
        SizeChanged += (_, _) => _video?.Reposition();
        StateChanged += (_, _) => _video?.Reposition();
        _engine.Event += line => Dispatcher.BeginInvoke(() => Post(line));
        _engine.TsData += (buf, n) => _player?.Push(buf, n);
        _statsTimer.Tick += (_, _) => Post(_stats.Read(App.DataDir));
    }

    private async Task StartAsync()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(App.DataDir, "webview"));
            await Web.EnsureCoreWebView2Async(env);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(this, "NOVA DVB Studio needs the Microsoft Edge WebView2 Runtime. Install it from Microsoft, then start NOVA again.", "NOVA DVB Studio");
            Close();
            return;
        }

        _core = Web.CoreWebView2;
        var s = _core.Settings;
        s.AreDefaultContextMenusEnabled = false;
        s.AreDevToolsEnabled = false;
        s.IsZoomControlEnabled = false;
        s.IsStatusBarEnabled = false;
        s.AreBrowserAcceleratorKeysEnabled = false;
        s.IsNonClientRegionSupportEnabled = true;

        var www = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        _core.SetVirtualHostNameToFolderMapping("nova.app", www, CoreWebView2HostResourceAccessKind.Deny);
        var state = _store.Get(StateKey) ?? "null";
        await _core.AddScriptToExecuteOnDocumentCreatedAsync($"window.__NOVA_STATE={state};");
        _core.WebMessageReceived += OnMessage;
        _core.Navigate("https://nova.app/index.html");

        _video = new VideoWindow(this, Web);
        _player = new TvPlayer(_video.Handle, hardwareDecoding: true);
        _video.FullscreenToggle += () => Post("{\"evt\":\"toggleFs\"}");
        _player.VideoSizeKnown += (w, h) => Dispatcher.BeginInvoke(() => Post(new JsonObject { ["evt"] = "videoInfo", ["width"] = w, ["height"] = h }.ToJsonString()));
        _player.StateChanged += st => Dispatcher.BeginInvoke(() => Post(new JsonObject { ["evt"] = "player", ["state"] = st }.ToJsonString()));
        _engine.Start();
        _statsTimer.Start();
    }

    private void Post(string json)
    {
        if (_webReady) _core?.PostWebMessageAsJson(json);
    }

    private void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var msg = JsonNode.Parse(e.WebMessageAsJson)!.AsObject();
            var cmd = (string?)msg["cmd"] ?? "";
            if ((string?)msg["to"] == "engine")
            {
                msg.Remove("to");
                _engine.Send(msg.ToJsonString());
                return;
            }
            Handle(cmd, msg);
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or IOException or UnauthorizedAccessException)
        {
            Log.Error("Interface message", ex);
        }
    }

    private void Handle(string cmd, JsonObject m)
    {
        switch (cmd)
        {
            case "uiReady":
                _webReady = true;
                _engine.Send("{\"cmd\":\"list\"}");
                break;
            case "saveState":
                _store.Set(StateKey, m["state"]!.ToJsonString());
                break;
            case "videoRect":
                _video?.SetRect((double)m["x"]!, (double)m["y"]!, (double)m["w"]!, (double)m["h"]!, (double)m["dpr"]!, (bool)m["show"]!);
                _player?.SetWindowSize((int)(double)m["w"]!, (int)(double)m["h"]!);
                break;
            case "play":
                _player?.Play((int)m["sid"]!);
                _player?.SetVolume(_volume);
                _player?.SetMute(_muted);
                break;
            case "playFile":
                _player?.PlayFile((string)m["path"]!);
                _player?.SetVolume(_volume);
                _player?.SetMute(_muted);
                break;
            case "stop":
                _player?.Stop();
                break;
            case "volume":
                _volume = (int)m["value"]!;
                _player?.SetVolume(_volume);
                break;
            case "mute":
                _muted = (bool)m["value"]!;
                _player?.SetMute(_muted);
                break;
            case "aspect":
                _player?.SetAspect((string)m["value"]!);
                break;
            case "tracks":
                SendTracks();
                break;
            case "setAudio":
                _player?.SetAudioTrack((int)m["id"]!);
                break;
            case "setSub":
                _player?.SetSubtitle((int)m["id"]!);
                break;
            case "windowMin":
                WindowState = WindowState.Minimized;
                break;
            case "windowMax":
                WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
                break;
            case "windowClose":
                Close();
                break;
            case "fullscreen":
                SetFullscreen((bool)m["on"]!);
                break;
            case "fetchText":
                _ = FetchAsync((string)m["url"]!);
                break;
            case "saveFile":
                SaveFile((string)m["name"]!, (string)m["text"]!);
                break;
            case "pickFolder":
                PickFolder((string)m["key"]!);
                break;
            case "recPath":
                Post(new JsonObject { ["evt"] = "recPath", ["path"] = RecordingPath((string)m["folder"]!, (string)m["title"]!) }.ToJsonString());
                break;
            case "openLogs":
                System.Diagnostics.Process.Start("explorer.exe", Log.Directory_);
                break;
        }
    }

    private static string RecordingPath(string folder, string title)
    {
        Directory.CreateDirectory(folder);
        foreach (var c in Path.GetInvalidFileNameChars()) title = title.Replace(c, '_');
        return Path.Combine(folder, $"{DateTime.Now:yyyy-MM-dd HHmm} {title}.ts");
    }

    private void SendTracks()
    {
        if (_player is null) return;
        var msg = new JsonObject
        {
            ["evt"] = "tracks",
            ["audio"] = new JsonArray(_player.AudioTracks().Select(t => (JsonNode)new JsonObject { ["id"] = t.Id, ["name"] = t.Name }).ToArray()),
            ["subs"] = new JsonArray(_player.Subtitles().Select(t => (JsonNode)new JsonObject { ["id"] = t.Id, ["name"] = t.Name }).ToArray()),
        };
        Post(msg.ToJsonString());
    }

    private void SetFullscreen(bool on)
    {
        if (on == _fullscreen) return;
        _fullscreen = on;
        if (on) _beforeFullscreen = WindowState;
        WindowState = WindowState.Normal;
        ResizeMode = on ? ResizeMode.NoResize : ResizeMode.CanResize;
        Topmost = on;
        WindowState = on ? WindowState.Maximized : _beforeFullscreen;
    }

    private async Task FetchAsync(string url)
    {
        var reply = new JsonObject { ["evt"] = "fetched", ["ok"] = false };
        try
        {
            reply["text"] = await Http.GetStringAsync(url);
            reply["ok"] = true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            Log.Warn($"Download failed: {ex.Message}");
        }
        Post(reply.ToJsonString());
    }

    private void SaveFile(string name, string text)
    {
        var dlg = new SaveFileDialog { FileName = name, Filter = "JSON|*.json|All files|*.*" };
        if (dlg.ShowDialog(this) != true) return;
        File.WriteAllText(dlg.FileName, text);
        Post(new JsonObject { ["evt"] = "fileSaved", ["path"] = dlg.FileName }.ToJsonString());
    }

    private void PickFolder(string key)
    {
        var dlg = new OpenFolderDialog();
        if (dlg.ShowDialog(this) != true) return;
        Post(new JsonObject { ["evt"] = "folderPicked", ["key"] = key, ["path"] = dlg.FolderName }.ToJsonString());
    }

    private void Shutdown()
    {
        _statsTimer.Stop();
        _player?.Dispose();
        _engine.Dispose();
        _store.Dispose();
        Log.Info("NOVA DVB Studio closed");
    }
}
