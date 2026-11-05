using NOVA.Core;
using NOVA.Core.Psi;

namespace NOVA.DVB;

/// <summary>
/// For automated tests only: emits a small synthetic transport stream.
/// It is selected with --mock, and passing tests here says nothing about a real card.
/// </summary>
public sealed class MockTuner : ITunerDevice
{
    private readonly Timer _timer;
    private bool _tuned;
    private byte _cc;

    public event Action<byte[], int>? Data;
    public string Name => "Mock tuner (tests only)";
    public TunerCapabilities Capabilities { get; } = new() { RawDiseqc = true, Extension = "mock" };
    public List<byte[]> SentDiseqc { get; } = [];

    public MockTuner() => _timer = new Timer(_ => Emit(), null, 50, 50);

    public void Tune(TuneRequest request) => _tuned = true;
    public SignalStatus ReadSignal() => new() { Available = true, Locked = _tuned, Present = _tuned };
    public bool SendDiseqc(byte[] message) { SentDiseqc.Add(message); return true; }

    private void Emit()
    {
        if (!_tuned) return;
        var pat = Section(0x00, 1, [0x00, 0x65, 0xE0 | 0x01, 0x00]);       // program 101 -> PMT PID 0x100
        var pmt = Section(0x02, 101, [0xE1, 0x01, 0xF0, 0x00, 0x1B, 0xE1, 0x01, 0xF0, 0x00]);
        var name = "Mock"u8.ToArray();
        byte[] sdtBody = [0x00, 0x01, 0xFF, 0x00, 0x65, 0xFC, 0x80, 0x00];
        byte[] desc = [0x48, (byte)(3 + name.Length), 0x01, 0x00, (byte)name.Length, .. name];
        sdtBody[7] = (byte)desc.Length;
        var sdt = Section(0x42, 1, [.. sdtBody, .. desc]);
        var buf = new byte[188 * 3];
        Packet(buf, 0, 0x0000, pat);
        Packet(buf, 188, 0x0100, pmt);
        Packet(buf, 376, 0x0011, sdt);
        Data?.Invoke(buf, buf.Length);
    }

    private void Packet(byte[] b, int off, int pid, byte[] section)
    {
        for (int i = off; i < off + 188; i++) b[i] = 0xFF;
        b[off] = 0x47;
        b[off + 1] = (byte)(0x40 | (pid >> 8));
        b[off + 2] = (byte)pid;
        b[off + 3] = (byte)(0x10 | (_cc++ & 0xF));
        b[off + 4] = 0;
        Buffer.BlockCopy(section, 0, b, off + 5, section.Length);
    }

    private static byte[] Section(byte table, int id, byte[] body)
    {
        int len = 5 + body.Length + 4;
        var s = new byte[3 + len];
        s[0] = table;
        s[1] = (byte)(0xB0 | (len >> 8));
        s[2] = (byte)len;
        s[3] = (byte)(id >> 8);
        s[4] = (byte)id;
        s[5] = 0xC1;
        Buffer.BlockCopy(body, 0, s, 8, body.Length);
        uint crc = Crc32Mpeg.Compute(s.AsSpan(0, s.Length - 4));
        s[^4] = (byte)(crc >> 24); s[^3] = (byte)(crc >> 16); s[^2] = (byte)(crc >> 8); s[^1] = (byte)crc;
        return s;
    }

    public void Dispose() => _timer.Dispose();
}
