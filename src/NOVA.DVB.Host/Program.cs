using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Text.Json;
using System.Text.Json.Nodes;
using NOVA.Core;
using NOVA.Core.Psi;
using NOVA.DVB;
using NOVA.Logging;

namespace NOVA.DVB.Host;

/// <summary>
/// The DVB engine runs in this separate process, so a driver crash cannot freeze the app.
/// Commands arrive as JSON lines on stdin, events leave on stdout, and the transport stream
/// leaves on a named pipe whose name is the first argument.
/// </summary>
internal static class Program
{
    private static readonly object OutGate = new();
    private static readonly BlockingCollection<JsonObject> Commands = new();
    private static ITunerDevice? _tuner;
    private static NamedPipeServerStream? _pipe;
    private static volatile bool _pipeReady;
    private static ServiceScanner? _scanner;
    private static TsAligner? _aligner;
    private static FileStream? _recording;
    private static bool _mock;

    [MTAThread]
    private static int Main(string[] args)
    {
        var dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NOVA DVB Studio");
        Log.Init(dataDir, "engine");
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Error("Unhandled", e.ExceptionObject as Exception);

        _mock = args.Contains("--mock");
        var pipeName = args.FirstOrDefault(a => !a.StartsWith("--")) ?? "nova-ts";
        StartPipe(pipeName);
        new Thread(ReadCommands) { IsBackground = true, Name = "stdin" }.Start();
        using var signalTimer = new Timer(_ => Commands.TryAdd(new JsonObject { ["cmd"] = "pollSignal" }), null, 1000, 1000);

        Emit("ready", new JsonObject { ["pid"] = Environment.ProcessId });
        foreach (var cmd in Commands.GetConsumingEnumerable())
        {
            var name = (string?)cmd["cmd"] ?? "";
            if (name == "quit") break;
            try { Handle(name, cmd); }
            catch (Exception ex)
            {
                Log.Error($"Command {name}", ex);
                Emit("error", new JsonObject { ["cmd"] = name, ["message"] = ex.Message });
            }
        }
        Close();
        return 0;
    }

    private static void ReadCommands()
    {
        string? line;
        while ((line = Console.In.ReadLine()) != null)
        {
            try { if (JsonNode.Parse(line) is JsonObject o) Commands.Add(o); }
            catch (JsonException ex) { Log.Warn($"Bad command line: {ex.Message}"); }
        }
        Commands.Add(new JsonObject { ["cmd"] = "quit" });      // the app went away
    }

    private static void Handle(string name, JsonObject c)
    {
        switch (name)
        {
            case "list":
                var tuners = _mock ? [new TunerInfo { Name = "Mock tuner (tests only)" }] : Bda.ListTuners();
                Emit("devices", new JsonObject { ["tuners"] = JsonSerializer.SerializeToNode(tuners, Wire.Json) });
                break;
            case "open":
                Open((int?)c["index"] ?? 0);
                break;
            case "close":
                Close();
                Emit("closed", new JsonObject());
                break;
            case "tune":
                Require().Tune(c.Deserialize<TuneRequest>(Wire.Json)!);
                Emit("tuned", new JsonObject { ["freqMHz"] = (int?)c["freqMHz"] });
                break;
            case "pollSignal":
                if (_tuner != null) Emit("signal", (JsonObject)JsonSerializer.SerializeToNode(_tuner.ReadSignal(), Wire.Json)!);
                break;
            case "diseqc":
                var bytes = Convert.FromHexString((string?)c["hex"] ?? "");
                Emit("diseqcResult", new JsonObject { ["ok"] = Require().SendDiseqc(bytes), ["hex"] = (string?)c["hex"] });
                break;
            case "scan":
                Scan(c);
                break;
            case "recStart":
                _recording = new FileStream((string)c["path"]!, FileMode.CreateNew, FileAccess.Write, FileShare.Read, 1 << 18);
                Emit("recording", new JsonObject { ["active"] = true });
                break;
            case "recStop":
                var r = _recording;
                _recording = null;
                r?.Dispose();
                Emit("recording", new JsonObject { ["active"] = false });
                break;
            default:
                Log.Warn($"Unknown command {name}");
                break;
        }
    }

    private static ITunerDevice Require() => _tuner ?? throw new InvalidOperationException("No tuner is open");

    private static void Open(int index)
    {
        Close();
        _tuner = _mock ? new MockTuner() : new BdaTuner(index);
        _tuner.Data += OnData;
        _aligner = new TsAligner((p, o) => _scanner?.FeedPacket(p, o));
        Emit("opened", new JsonObject { ["name"] = _tuner.Name, ["capabilities"] = JsonSerializer.SerializeToNode(_tuner.Capabilities, Wire.Json) });
    }

    private static void Close()
    {
        var r = _recording;
        _recording = null;
        r?.Dispose();
        var t = _tuner;
        _tuner = null;
        if (t != null) { t.Data -= OnData; t.Dispose(); }
    }

    /// <summary>Waits for lock, reads PAT, PMT and SDT, and returns the services found.</summary>
    private static void Scan(JsonObject c)
    {
        var tuner = Require();
        int timeout = (int?)c["timeoutMs"] ?? 12000;
        var scanner = new ServiceScanner();
        _scanner = scanner;
        tuner.Tune(c["tune"].Deserialize<TuneRequest>(Wire.Json)!);

        long deadline = Environment.TickCount64 + timeout, lockDeadline = Environment.TickCount64 + 3500;
        bool locked = false;
        while (Environment.TickCount64 < deadline && !scanner.IsComplete)
        {
            Thread.Sleep(150);
            locked |= tuner.ReadSignal().Locked;
            if (!locked && !scanner.HasPat && Environment.TickCount64 > lockDeadline) break;
        }
        _scanner = null;
        var services = scanner.Services.Where(s => s.Name.Length > 0 || s.Streams.Count > 0).ToList();
        Emit("scanResult", new JsonObject
        {
            ["id"] = c["id"]?.DeepClone(),
            ["locked"] = locked || scanner.HasPat,
            ["complete"] = scanner.IsComplete,
            ["services"] = JsonSerializer.SerializeToNode(services, Wire.Json),
        });
    }

    private static void OnData(byte[] data, int length)
    {
        if (_scanner != null) _aligner?.Feed(data, length);
        try { _recording?.Write(data, 0, length); }
        catch (IOException ex)
        {
            Log.Error("Recording stopped", ex);
            _recording = null;
            Emit("error", new JsonObject { ["cmd"] = "recording", ["message"] = ex.Message });
        }
        if (!_pipeReady) return;
        try { _pipe!.Write(data, 0, length); }
        catch (IOException) { _pipeReady = false; }      // the player went away, it reconnects
    }

    private static void StartPipe(string name)
    {
        new Thread(() =>
        {
            while (true)
            {
                var pipe = new NamedPipeServerStream(name, PipeDirection.Out, 1, PipeTransmissionMode.Byte, PipeOptions.None, 0, 4 << 20);
                pipe.WaitForConnection();
                _pipe = pipe;
                _pipeReady = true;
                while (_pipeReady && pipe.IsConnected) Thread.Sleep(200);
                _pipeReady = false;
                pipe.Dispose();
            }
        }) { IsBackground = true, Name = "ts-pipe" }.Start();
    }

    private static void Emit(string evt, JsonObject data)
    {
        data["evt"] = evt;
        lock (OutGate)
        {
            Console.Out.WriteLine(data.ToJsonString());
            Console.Out.Flush();
        }
    }
}
