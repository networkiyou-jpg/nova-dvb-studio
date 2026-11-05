using NOVA.Core.Psi;
using NOVA.Database;
using NOVA.DVB;
using NOVA.Logging;
using Xunit;

namespace NOVA.Tests;

public class PsiTests
{
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

    private static byte[] Packet(int pid, byte[] section)
    {
        var p = new byte[188];
        Array.Fill(p, (byte)0xFF);
        p[0] = 0x47;
        p[1] = (byte)(0x40 | (pid >> 8));
        p[2] = (byte)pid;
        p[3] = 0x10;
        p[4] = 0;
        Buffer.BlockCopy(section, 0, p, 5, section.Length);
        return p;
    }

    private static byte[] Sdt(string name, bool scrambled)
    {
        var n = System.Text.Encoding.ASCII.GetBytes(name);
        byte[] desc = [0x48, (byte)(3 + n.Length), 0x19, 0x00, (byte)n.Length, .. n];
        byte[] body = [0x00, 0x01, 0xFF, 0x00, 0x65, 0xFC, (byte)(0x80 | (scrambled ? 0x10 : 0)), (byte)desc.Length, .. desc];
        return Section(0x42, 1, body);
    }

    [Fact]
    public void Crc_of_a_complete_section_is_zero()
    {
        var s = Section(0x00, 1, [0x00, 0x65, 0xE1, 0x00]);
        Assert.Equal(0u, Crc32Mpeg.Compute(s));
    }

    [Fact]
    public void Scanner_builds_a_service_from_pat_pmt_and_sdt()
    {
        var scanner = new ServiceScanner();
        var pat = Packet(0x0000, Section(0x00, 1, [0x00, 0x65, 0xE1, 0x00]));
        byte[] pmtBody = [0xE1, 0x01, 0xF0, 0x00, 0x1B, 0xE1, 0x01, 0xF0, 0x00, 0x03, 0xE1, 0x02, 0xF0, 0x06, 0x0A, 0x04, 0x61, 0x72, 0x61, 0x00];
        var pmt = Packet(0x0100, Section(0x02, 0x65, pmtBody));
        var sdt = Packet(0x0011, Sdt("Test HD", false));

        scanner.FeedPacket(pat, 0);
        scanner.FeedPacket(pmt, 0);
        scanner.FeedPacket(sdt, 0);

        Assert.True(scanner.IsComplete);
        var svc = Assert.Single(scanner.Services);
        Assert.Equal(0x65, svc.Sid);
        Assert.Equal("Test HD", svc.Name);
        Assert.True(svc.IsTv);
        Assert.True(svc.FreeToAir);
        Assert.Equal(2, svc.Streams.Count);
        Assert.Equal("H.264", svc.Streams[0].Codec);
        Assert.Equal("MPEG Audio", svc.Streams[1].Codec);
        Assert.Equal("ara", svc.Streams[1].Lang);
    }

    [Fact]
    public void Scrambled_flag_marks_the_service()
    {
        var scanner = new ServiceScanner();
        scanner.FeedPacket(Packet(0x0011, Sdt("Pay", true)), 0);
        Assert.False(Assert.Single(scanner.Services).FreeToAir);
    }

    [Fact]
    public void Corrupt_section_is_ignored()
    {
        var scanner = new ServiceScanner();
        var section = Section(0x00, 1, [0x00, 0x65, 0xE1, 0x00]);
        section[9] ^= 0xFF;
        scanner.FeedPacket(Packet(0, section), 0);
        Assert.Empty(scanner.Services);
    }

    [Fact]
    public void Arabic_text_is_decoded_from_iso_8859_6()
    {
        byte[] raw = [0x02, 0xC7, 0xE4, 0xD9, 0xD1, 0xC8, 0xEA, 0xC9];     // selector, then Arabic letters
        Assert.Equal("العربية", DvbText.Decode(raw));
    }

    [Fact]
    public void Aligner_recovers_packets_after_garbage_and_across_buffers()
    {
        int count = 0;
        var aligner = new TsAligner((_, _) => count++);
        var p = Packet(0x20, []);
        var data = new byte[5 + 188 * 2];
        Buffer.BlockCopy(p, 0, data, 5, 188);
        Buffer.BlockCopy(p, 0, data, 5 + 188, 188);
        aligner.Feed(data, 100);
        var rest = data[100..];
        aligner.Feed(rest, rest.Length);
        Assert.Equal(2, count);
    }

    [Fact]
    public void Mock_tuner_stream_can_be_scanned()
    {
        using var mock = new MockTuner();
        var scanner = new ServiceScanner();
        var aligner = new TsAligner(scanner.FeedPacket);
        mock.Data += aligner.Feed;
        mock.Tune(new NOVA.Core.TuneRequest { FreqMHz = 12245, SymbolRate = 27500 });
        var end = Environment.TickCount64 + 3000;
        while (!scanner.IsComplete && Environment.TickCount64 < end) Thread.Sleep(20);
        Assert.True(scanner.IsComplete);
        Assert.Equal("Mock", Assert.Single(scanner.Services).Name);
    }

    [Fact]
    public void Store_keeps_values_between_sessions()
    {
        var path = Path.Combine(Path.GetTempPath(), $"nova-test-{Guid.NewGuid():N}.db");
        using (var s = new Store(path)) s.Set("a", "1");
        using (var s = new Store(path))
        {
            Assert.Equal("1", s.Get("a"));
            s.Set("a", "2");
            Assert.Equal("2", s.Get("a"));
            Assert.Null(s.Get("missing"));
        }
    }

    [Theory]
    [InlineData("{\"password\":\"abc\"}")]
    [InlineData("pass=abc other")]
    [InlineData("\"key\": \"11223366\"")]
    public void Log_redacts_secrets(string text)
    {
        var redacted = Log.Redact(text);
        Assert.DoesNotContain("abc", redacted);
        Assert.DoesNotContain("11223366", redacted);
    }
}
