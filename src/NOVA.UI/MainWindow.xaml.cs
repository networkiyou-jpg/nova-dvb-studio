using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text;
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
    private const string StateKey = "app_state", EpgKey = "epg_cache";
    private static readonly string PiconDir = Path.Combine(App.DataDir, "picons");
    private readonly Store _store = new(Path.Combine(App.DataDir, "nova.db"));
    private readonly EngineClient _engine = new();
    private readonly SystemStats _stats = new();
    private readonly DispatcherTimer _statsTimer = new() { Interval = TimeSpan.FromSeconds(2) };
    private VideoWindow? _video;
    private OsdWindow? _osd;
    private TvPlayer? _player;
    private CoreWebView2? _core;
    private static readonly HttpClient Http = CreateHttp();
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
        Directory.CreateDirectory(PiconDir);
        _core.SetVirtualHostNameToFolderMapping("picons.nova.app", PiconDir, CoreWebView2HostResourceAccessKind.Allow);
        var state = _store.Get(StateKey) ?? "null";
        await _core.AddScriptToExecuteOnDocumentCreatedAsync($"window.__NOVA_STATE={state};");
        _core.WebMessageReceived += OnMessage;
        _core.Navigate("https://nova.app/index.html");

        _video = new VideoWindow(this, Web);
        _player = new TvPlayer(_video.Handle, hardwareDecoding: true);
        _osd = new OsdWindow(_video.Handle, PiconDir);
        _video.Osd = _osd;
        _osd.ActionRequested += OnTrackAction;
        _video.FullscreenToggle += () => Post("{\"evt\":\"toggleFs\"}");
        _video.PointerMoved += () => Post("{\"evt\":\"videoMouse\"}");
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
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or IOException or UnauthorizedAccessException or FormatException or ArgumentException)
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
                _ = FetchAsync((string)m["url"]!, (string?)m["id"], (string?)m["cache"], (bool?)m["preferCache"] ?? false);
                break;
            case "osd":
                _osd?.Update(m["data"] as JsonObject, (bool?)m["show"] ?? false);
                break;
            case "cycleAudio":
                OnTrackAction("audio");
                break;
            case "cycleSub":
                OnTrackAction("sub");
                break;
            case "teletext":
                OnTrackAction("txt");
                break;
            case "piconFetch":
                _ = PiconFetchAsync(m);
                break;
            case "piconWrite":
                PiconWrite(m);
                break;
            case "epgSave":
                _store.Set(EpgKey, m["data"]!.ToJsonString());
                break;
            case "epgLoad":
                Post("{\"evt\":\"epgData\",\"data\":" + (_store.Get(EpgKey) ?? "null") + "}");
                break;
            case "openUrl":
                OpenUrl((string?)m["url"]);
                break;
            case "openFolder":
                Process.Start("explorer.exe", (string?)m["key"] == "picons" ? PiconDir : App.DataDir);
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

    private static HttpClient CreateHttp()
    {
        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("NOVA-DVB-Studio/0.2");
        return http;
    }

    private static string CachePath(string name) => Path.Combine(PiconDir, Path.GetFileName(name));

    /// <summary>
    /// Downloads text for the interface. Gzip files (XMLTV guides) are unpacked. With a cache name the text
    /// is also kept on disk, so logo indexes work offline; preferCache uses a copy younger than a week.
    /// </summary>
    private async Task FetchAsync(string url, string? id, string? cache, bool preferCache)
    {
        var reply = new JsonObject { ["evt"] = "fetched", ["ok"] = false, ["id"] = id };
        try
        {
            if (cache is not null && preferCache && File.Exists(CachePath(cache)) && File.GetLastWriteTimeUtc(CachePath(cache)) > DateTime.UtcNow.AddDays(-7))
            {
                reply["text"] = await File.ReadAllTextAsync(CachePath(cache));
                reply["ok"] = true;
                reply["cached"] = true;
                Post(reply.ToJsonString());
                return;
            }
            if (!url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                throw new HttpRequestException("Only http and https addresses are allowed");
            var bytes = await Http.GetByteArrayAsync(url);
            if (bytes.Length > 2 && bytes[0] == 0x1F && bytes[1] == 0x8B)
            {
                using var gz = new GZipStream(new MemoryStream(bytes), CompressionMode.Decompress);
                using var plain = new MemoryStream();
                await gz.CopyToAsync(plain);
                bytes = plain.ToArray();
            }
            var text = Encoding.UTF8.GetString(bytes);
            reply["text"] = text;
            reply["ok"] = true;
            if (cache is not null) await File.WriteAllTextAsync(CachePath(cache), text);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException or InvalidDataException or UnauthorizedAccessException)
        {
            Log.Warn($"Download failed: {ex.Message}");
            if (cache is not null && File.Exists(CachePath(cache)))
            {
                try
                {
                    reply["text"] = await File.ReadAllTextAsync(CachePath(cache));
                    reply["ok"] = true;
                    reply["cached"] = true;
                }
                catch (IOException) { /* the reply stays a failure */ }
            }
        }
        Post(reply.ToJsonString());
    }

    private static string SafeName(string name)
    {
        var sb = new StringBuilder();
        foreach (var c in name.ToLowerInvariant())
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '-') sb.Append(c);
        var s = sb.ToString();
        return s.Length == 0 ? "logo" : s.Length > 80 ? s[..80] : s;
    }

    /// <summary>
    /// Downloads a channel logo, trying each address in turn. PNG and JPEG are saved in the picon folder;
    /// SVG text goes back to the interface, which turns it into a PNG (the info bar window cannot draw SVG).
    /// </summary>
    private async Task PiconFetchAsync(JsonObject m)
    {
        var reply = new JsonObject { ["evt"] = "piconFetched", ["id"] = (string?)m["id"], ["ok"] = false };
        var name = SafeName((string?)m["name"] ?? "logo");
        foreach (var node in (m["urls"] as JsonArray) ?? new JsonArray())
        {
            var url = (string?)node;
            if (url is null || !(url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || url.StartsWith("http://", StringComparison.OrdinalIgnoreCase))) continue;
            try
            {
                using var resp = await Http.GetAsync(url);
                if (!resp.IsSuccessStatusCode) continue;
                var bytes = await resp.Content.ReadAsByteArrayAsync();
                if (bytes.Length < 8 || bytes.Length > 4_000_000) continue;
                bool png = bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
                bool jpg = bytes[0] == 0xFF && bytes[1] == 0xD8;
                if (png || jpg)
                {
                    var file = name + (png ? ".png" : ".jpg");
                    await File.WriteAllBytesAsync(Path.Combine(PiconDir, file), bytes);
                    reply["file"] = file;
                }
                else
                {
                    var text = Encoding.UTF8.GetString(bytes);
                    if (!text.Contains("<svg", StringComparison.OrdinalIgnoreCase)) continue;
                    reply["svg"] = text;
                }
                reply["ok"] = true;
                reply["url"] = url;
                break;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException or UnauthorizedAccessException)
            {
                Log.Warn($"Logo download failed: {ex.Message}");
            }
        }
        Post(reply.ToJsonString());
    }

    private void PiconWrite(JsonObject m)
    {
        var file = SafeName((string?)m["name"] ?? "logo") + ".png";
        File.WriteAllBytes(Path.Combine(PiconDir, file), Convert.FromBase64String((string)m["b64"]!));
        Post(new JsonObject { ["evt"] = "piconSaved", ["id"] = (string?)m["id"], ["file"] = file }.ToJsonString());
    }

    private static void OpenUrl(string? url)
    {
        if (url is null || !Uri.TryCreate(url, UriKind.Absolute, out var u) || (u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeHttp)) return;
        Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true });
    }

    /// <summary>Audio, subtitle and teletext buttons on the info bar, or their keyboard shortcuts.</summary>
    private void OnTrackAction(string act)
    {
        if (_player is null) return;
        string? name = act switch
        {
            "audio" => _player.CycleAudio(),
            "sub" => _player.CycleSubtitle(),
            "txt" => _player.ToggleTeletext() ? "on" : "off",
            _ => null,
        };
        Post(new JsonObject { ["evt"] = "trackChanged", ["act"] = act, ["name"] = name }.ToJsonString());
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
        try { _osd?.Close(); }
        catch (InvalidOperationException) { /* already closed with the video window */ }
        _player?.Dispose();
        _engine.Dispose();
        _store.Dispose();
        Log.Info("NOVA DVB Studio closed");
    }
}
