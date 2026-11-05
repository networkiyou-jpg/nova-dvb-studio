using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using NOVA.Logging;

namespace NOVA.UI;

/// <summary>Starts the DVB engine process, passes JSON lines both ways, and reads the transport stream pipe.</summary>
internal sealed class EngineClient : IDisposable
{
    private readonly object _gate = new();
    private Process? _proc;
    private bool _disposed;

    public event Action<string>? Event;
    public event Action<byte[], int>? TsData;

    public void Start()
    {
        lock (_gate)
        {
            if (_disposed || _proc is { HasExited: false }) return;
            var exe = Path.Combine(AppContext.BaseDirectory, "NOVA.DVB.Host.exe");
            var pipe = $"nova-ts-{Environment.ProcessId}-{Environment.TickCount64}";
            _proc = new Process
            {
                StartInfo = new ProcessStartInfo(exe, pipe)
                {
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    StandardOutputEncoding = System.Text.Encoding.UTF8,
                },
                EnableRaisingEvents = true,
            };
            _proc.OutputDataReceived += (_, e) => { if (e.Data != null) Event?.Invoke(e.Data); };
            _proc.Exited += (_, _) =>
            {
                Log.Warn("The DVB engine stopped");
                if (!_disposed) Event?.Invoke("{\"evt\":\"engineExit\"}");
            };
            _proc.Start();
            _proc.BeginOutputReadLine();
            var p = _proc;
            new Thread(() => ReadStream(pipe, p)) { IsBackground = true, Name = "ts-read" }.Start();
            Log.Info("DVB engine started");
        }
    }

    private void ReadStream(string name, Process owner)
    {
        var buf = new byte[1 << 18];
        try
        {
            using var pipe = new NamedPipeClientStream(".", name, PipeDirection.In);
            pipe.Connect(5000);
            int n;
            while (!owner.HasExited && (n = pipe.Read(buf, 0, buf.Length)) > 0) TsData?.Invoke(buf, n);
        }
        catch (Exception ex) when (ex is IOException or TimeoutException or InvalidOperationException)
        {
            Log.Warn($"Stream pipe closed: {ex.Message}");
        }
    }

    public void Send(string json)
    {
        Start();
        lock (_gate)
        {
            if (_proc is null || _proc.HasExited) return;
            _proc.StandardInput.WriteLine(json);
            _proc.StandardInput.Flush();
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _disposed = true;
            if (_proc is null) return;
            try
            {
                if (!_proc.HasExited)
                {
                    _proc.StandardInput.WriteLine("{\"cmd\":\"quit\"}");
                    _proc.StandardInput.Flush();
                    if (!_proc.WaitForExit(3000)) _proc.Kill();
                }
            }
            catch (Exception ex) when (ex is IOException or InvalidOperationException)
            {
                Log.Warn($"Engine shutdown: {ex.Message}");
            }
            _proc.Dispose();
            _proc = null;
        }
    }
}
