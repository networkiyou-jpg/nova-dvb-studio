using NOVA.Core.Psi;
using Xunit;

namespace NOVA.Tests;

public class SiTests
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

    private static byte[] Ascii(string s) => System.Text.Encoding.ASCII.GetBytes(s);

    /// <summary>EIT present/following for service 0x65 with an Arabic and an English short event, genre news.</summary>
    private static byte[] Eit()
    {
        byte[] ara = [0x4D, 19, .. Ascii("ara"), 4, .. Ascii("News"), 10, .. Ascii("Daily news")];
        byte[] eng = [0x4D, 13, .. Ascii("eng"), 8, .. Ascii("Bulletin"), 0];
        byte[] content = [0x54, 2, 0x20, 0x00];
        byte[] desc = [.. ara, .. eng, .. content];
        byte[] evt = [0x00, 0x01, 0xC0, 0x79, 0x12, 0x45, 0x00, 0x01, 0x30, 0x00, (byte)(0x80 | (desc.Length >> 8)), (byte)desc.Length, .. desc];
        byte[] body = [0x00, 0x0A, 0x00, 0x01, 0x00, 0x4E, .. evt];
        return Section(0x4E, 0x65, body);
    }

    [Fact]
    public void Mjd_time_follows_the_standard_example()
    {
        long expected = new DateTimeOffset(1993, 10, 13, 12, 45, 0, TimeSpan.Zero).ToUnixTimeSeconds();
        Assert.Equal(expected, Si.UtcTime([0xC0, 0x79, 0x12, 0x45, 0x00]));
        Assert.Null(Si.UtcTime([0xFF, 0xFF, 0xFF, 0xFF, 0xFF]));
        Assert.Equal(5400, Si.Duration([0x01, 0x30, 0x00]));
    }

    [Fact]
    public void Eit_event_is_read_in_the_preferred_language()
    {
        var e = Assert.Single(Si.ParseEit(Eit(), ["eng"]));
        Assert.Equal("Bulletin", e.Title);
        Assert.Equal(0x65, e.Sid);
        Assert.Equal(0x0A, e.Tsid);
        Assert.Equal(1, e.Onid);
        Assert.Equal(5400, e.Duration);
        Assert.Equal(2, e.Genre);
        Assert.Equal(new DateTimeOffset(1993, 10, 13, 12, 45, 0, TimeSpan.Zero).ToUnixTimeSeconds(), e.Start);
    }

    [Fact]
    public void Eit_uses_the_first_language_when_none_is_preferred()
    {
        var e = Assert.Single(Si.ParseEit(Eit(), []));
        Assert.Equal("News", e.Title);
        Assert.Equal("Daily news", e.Text);
    }

    [Fact]
    public void Guide_monitor_reads_each_section_version_once()
    {
        var guide = new SiMonitor();
        var p = Packet(0x12, Eit());
        guide.FeedPacket(p, 0);
        guide.FeedPacket(p, 0);
        Assert.Single(guide.Drain());
        Assert.Empty(guide.Drain());
    }

    [Fact]
    public void Satellite_delivery_descriptor_is_decoded()
    {
        var tp = Si.SatelliteDelivery([0x01, 0x17, 0x27, 0x00, 0x00, 0x70, 0x26, 0x02, 0x75, 0x00, 0x03]);
        Assert.NotNull(tp);
        Assert.Equal(11727, tp!.FreqMHz);
        Assert.Equal("V", tp.Pol);
        Assert.Equal(27500, tp.SymbolRate);
        Assert.Equal("3/4", tp.Fec);
        Assert.Equal("DVB-S2", tp.Std);
        Assert.Equal("8PSK", tp.Mod);
        Assert.Equal(-70, tp.Orbital);
    }

    [Fact]
    public void Scanner_reads_transponders_from_the_nit_and_the_network_id_from_the_sdt()
    {
        byte[] sat = [0x43, 11, 0x01, 0x17, 0x27, 0x00, 0x00, 0x70, 0x26, 0x02, 0x75, 0x00, 0x03];
        byte[] ts = [0x00, 0x0A, 0x00, 0x01, 0xF0, (byte)sat.Length, .. sat];
        byte[] body = [0xF0, 0x00, 0xF0, (byte)ts.Length, .. ts];
        var scanner = new ServiceScanner();
        scanner.FeedPacket(Packet(0x10, Section(0x40, 1, body)), 0);
        Assert.True(scanner.HasNit);
        var tp = Assert.Single(scanner.Transponders);
        Assert.Equal(11727, tp.FreqMHz);
        Assert.Equal(0x0A, tp.Tsid);

        var n = Ascii("Test");
        byte[] desc = [0x48, (byte)(3 + n.Length), 0x19, 0x00, (byte)n.Length, .. n];
        byte[] sdt = [0x00, 0x7E, 0xFF, 0x00, 0x65, 0xFC, 0x80, (byte)desc.Length, .. desc];
        scanner.FeedPacket(Packet(0x11, Section(0x42, 1, sdt)), 0);
        Assert.Equal(0x7E, scanner.Onid);
        Assert.Equal(0x7E, Assert.Single(scanner.Services).Onid);
    }

    [Fact]
    public void Service_filter_keeps_one_service_with_a_new_pat()
    {
        var output = new List<byte[]>();
        var filter = new ServiceFilter(0x65, (p, o) => output.Add(p.AsSpan(o, 188).ToArray()));
        byte[] pat = [0x00, 0x65, 0xE1, 0x00, 0x00, 0x66, 0xE2, 0x00];
        byte[] pmt = [0xE1, 0x01, 0xF0, 0x00, 0x1B, 0xE1, 0x01, 0xF0, 0x00, 0x0F, 0xE1, 0x02, 0xF0, 0x00];
        filter.FeedPacket(Packet(0x000, Section(0x00, 1, pat)), 0);
        filter.FeedPacket(Packet(0x100, Section(0x02, 0x65, pmt)), 0);
        filter.FeedPacket(Packet(0x101, [0x01]), 0);
        filter.FeedPacket(Packet(0x201, [0x01]), 0);
        filter.FeedPacket(Packet(0x102, [0x01]), 0);
        Assert.Equal(4, output.Count);
        int Pid(byte[] p) => ((p[1] & 0x1F) << 8) | p[2];
        Assert.Equal(new[] { 0x000, 0x100, 0x101, 0x102 }, output.Select(Pid).ToArray());

        byte[]? newPat = null;
        new SectionAssembler(s => newPat = s).Feed(output[0], 0);
        Assert.NotNull(newPat);
        Assert.Equal(16, newPat!.Length);
        Assert.Equal(0x65, (newPat[8] << 8) | newPat[9]);
        Assert.Equal(0x100, ((newPat[10] & 0x1F) << 8) | newPat[11]);
    }
}
