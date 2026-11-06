using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading.Channels;
using NOVA.Core.Psi;

namespace NOVA.UI;

/// <summary>One HTTP request: method, path, query and a small body.</summary>
internal sealed record LanRequest(string Method, string Path, Dictionary<string, string> Query, string Body, string Remote);

/// <summary>
/// A small HTTP server for the local network, used by plugins (network stream, phone remote).
/// It listens on every interface; Windows asks once whether to allow it through the firewall.
/// </summary>
internal sealed class LanServer : IDisposable
{
    private readonly TcpListener _listener;
    private readonly CancellationTokenSource _cts = new();
    private readonly Func<LanRequest, Stream, CancellationToken, Task> _handler;

    public int Port { get; }

    public LanServer(int port, Func<LanRequest, Stream, CancellationToken, Task> handler)
    {
        Port = port;
        _handler = handler;
        _listener = new TcpListener(IPAddress.Any, port);
        _listener.Start();
        _ = AcceptLoop();
    }

    /// <summary>Addresses other devices on the network can use to reach this computer.</summary>
    public static List<string> LocalAddresses()
    {
        var list = new List<string>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up || nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            foreach (var a in nic.GetIPProperties().UnicastAddresses)
                if (a.Address.AddressFamily == AddressFamily.InterNetwork) list.Add(a.Address.ToString());
        }
        return list;
    }

    private async Task AcceptLoop()
    {
        while (!_cts.IsCancellationRequested)
        {
            TcpClient client;
            try { client = await _listener.AcceptTcpClientAsync(_cts.Token); }
            catch (Exception ex) when (ex is OperationCanceledException or SocketException or ObjectDisposedException) { return; }
            _ = Serve(client);
        }
    }

    private async Task Serve(TcpClient client)
    {
        using (client)
        {
            client.NoDelay = true;
            var stream = client.GetStream();
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token);
                timeout.CancelAfter(TimeSpan.FromSeconds(10));
                var req = await ReadRequest(stream, client.Client.RemoteEndPoint?.ToString() ?? "", timeout.Token);
                if (req is null) return;
                await _handler(req, stream, _cts.Token);
            }
            catch (Exception ex) when (ex is IOException or SocketException or OperationCanceledException or ObjectDisposedException or InvalidOperationException) { }
        }
    }

    private static async Task<LanRequest?> ReadRequest(Stream s, string remote, CancellationToken ct)
    {
        var buf = new byte[16384];
        int have = 0, headEnd = -1;
        while (headEnd < 0)
        {
            if (have == buf.Length) return null;
            int n = await s.ReadAsync(buf.AsMemory(have), ct);
            if (n == 0) return null;
            have += n;
            for (int i = 3; i < have; i++)
                if (buf[i - 3] == '\r' && buf[i - 2] == '\n' && buf[i - 1] == '\r' && buf[i] == '\n') { headEnd = i + 1; break; }
        }
        var head = Encoding.ASCII.GetString(buf, 0, headEnd).Split("\r\n");
        var first = head[0].Split(' ');
        if (first.Length < 2) return null;
        int length = 0;
        foreach (var line in head.Skip(1))
            if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase)) int.TryParse(line[15..].Trim(), out length);
        length = Math.Clamp(length, 0, 65536);
        var body = new byte[length];
        int got = Math.Min(length, have - headEnd);
        Buffer.BlockCopy(buf, headEnd, body, 0, got);
        while (got < length)
        {
            int n = await s.ReadAsync(body.AsMemory(got), ct);
            if (n == 0) break;
            got += n;
        }
        var target = first[1];
        int q = target.IndexOf('?');
        var query = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (q >= 0)
            foreach (var pair in target[(q + 1)..].Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                int e = pair.IndexOf('=');
                if (e > 0) query[Uri.UnescapeDataString(pair[..e])] = Uri.UnescapeDataString(pair[(e + 1)..].Replace('+', ' '));
            }
        return new LanRequest(first[0].ToUpperInvariant(), Uri.UnescapeDataString(q >= 0 ? target[..q] : target), query, Encoding.UTF8.GetString(body, 0, got), remote);
    }

    public static async Task Reply(Stream s, int status, string type, byte[] body, CancellationToken ct)
    {
        string reason = status switch { 200 => "OK", 204 => "No Content", 403 => "Forbidden", 404 => "Not Found", _ => "Error" };
        var head = $"HTTP/1.1 {status} {reason}\r\nContent-Type: {type}\r\nContent-Length: {body.Length}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        await s.WriteAsync(Encoding.ASCII.GetBytes(head), ct);
        if (body.Length > 0) await s.WriteAsync(body, ct);
    }

    public static Task Reply(Stream s, int status, string type, string body, CancellationToken ct) => Reply(s, status, type, Encoding.UTF8.GetBytes(body), ct);

    public void Dispose()
    {
        _cts.Cancel();
        _listener.Stop();
    }
}

/// <summary>
/// Sends the live stream to players on the network (VLC, Kodi, a TV app): /live.ts carries the
/// channel on screen, /transponder.ts the whole transponder. Feed it what the engine sends.
/// </summary>
internal sealed class TsStreamer : IDisposable
{
    private const int Batch = 7 * TsAligner.PacketSize;
    private readonly object _gate = new();
    private readonly List<(Channel<byte[]> Queue, bool Whole)> _clients = [];
    private readonly TsAligner _aligner;
    private readonly byte[] _one = new byte[Batch], _all = new byte[Batch];
    private int _oneLen, _allLen;
    private ServiceFilter? _filter;
    private readonly LanServer _server;

    public TsStreamer(int port)
    {
        _aligner = new TsAligner(OnPacket);
        _server = new LanServer(port, Handle);
    }

    public int Port => _server.Port;
    public int Clients { get { lock (_gate) return _clients.Count; } }

    /// <summary>The service that /live.ts carries.</summary>
    public void SetService(int sid)
    {
        lock (_gate)
        {
            _filter = new ServiceFilter(sid, AddOne);
            _oneLen = 0;
        }
    }

    /// <summary>Called on the engine reader thread; the buffer is reused after the call returns.</summary>
    public void Push(byte[] data, int length)
    {
        lock (_gate)
        {
            if (_clients.Count == 0) return;
            _aligner.Feed(data, length);
        }
    }

    private void OnPacket(byte[] p, int off)
    {
        Buffer.BlockCopy(p, off, _all, _allLen, TsAligner.PacketSize);
        _allLen += TsAligner.PacketSize;
        if (_allLen == Batch) { Send(_all, true); _allLen = 0; }
        _filter?.FeedPacket(p, off);
    }

    private void AddOne(byte[] p, int off)
    {
        Buffer.BlockCopy(p, off, _one, _oneLen, TsAligner.PacketSize);
        _oneLen += TsAligner.PacketSize;
        if (_oneLen == Batch) { Send(_one, false); _oneLen = 0; }
    }

    private void Send(byte[] batch, bool whole)
    {
        byte[]? copy = null;
        foreach (var c in _clients)
        {
            if (c.Whole != whole) continue;
            copy ??= (byte[])batch.Clone();
            c.Queue.Writer.TryWrite(copy);
        }
    }

    private async Task Handle(LanRequest req, Stream s, CancellationToken ct)
    {
        bool whole = req.Path.Equals("/transponder.ts", StringComparison.OrdinalIgnoreCase);
        if (!whole && !req.Path.Equals("/live.ts", StringComparison.OrdinalIgnoreCase))
        {
            await LanServer.Reply(s, 404, "text/plain", "Use /live.ts or /transponder.ts", ct);
            return;
        }
        var queue = Channel.CreateBounded<byte[]>(new BoundedChannelOptions(2000) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });
        var entry = (queue, whole);
        await s.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: video/mp2t\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"), ct);
        lock (_gate) _clients.Add(entry);
        try
        {
            await foreach (var chunk in queue.Reader.ReadAllAsync(ct)) await s.WriteAsync(chunk, ct);
        }
        finally
        {
            lock (_gate) _clients.Remove(entry);
        }
    }

    public void Dispose()
    {
        _server.Dispose();
        lock (_gate)
        {
            foreach (var c in _clients) c.Queue.Writer.TryComplete();
            _clients.Clear();
        }
    }
}
