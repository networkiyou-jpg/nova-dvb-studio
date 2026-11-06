using System.Text;

namespace NOVA.Core.Psi;

/// <summary>Field decoders from EN 300 468: BCD numbers, MJD times, delivery descriptors and EIT sections.</summary>
public static class Si
{
    public static int Bcd(byte b) => (b >> 4) * 10 + (b & 0x0F);

    /// <summary>MJD date and BCD time (EN 300 468 annex C) as Unix seconds, or null when the field is undefined.</summary>
    public static long? UtcTime(ReadOnlySpan<byte> b)
    {
        if (b.Length < 5 || (b[0] == 0xFF && b[1] == 0xFF)) return null;
        int mjd = (b[0] << 8) | b[1];
        int h = Bcd(b[2]), m = Bcd(b[3]), s = Bcd(b[4]);
        if (h > 23 || m > 59 || s > 59) return null;
        const int UnixEpochMjd = 40587;                  // 1970-01-01
        return (long)(mjd - UnixEpochMjd) * 86400 + h * 3600 + m * 60 + s;
    }

    /// <summary>BCD hhmmss as seconds.</summary>
    public static int Duration(ReadOnlySpan<byte> b) => Bcd(b[0]) * 3600 + Bcd(b[1]) * 60 + Bcd(b[2]);

    private static readonly string[] Fecs = ["Auto", "1/2", "2/3", "3/4", "5/6", "7/8", "8/9", "3/5", "4/5", "9/10"];
    private static readonly string[] Pols = ["H", "V", "L", "R"];
    private static readonly string[] RollOffs = ["0.35", "0.25", "0.20", "0.35"];

    /// <summary>Decodes the body of a satellite_delivery_system_descriptor (tag 0x43, 11 bytes).</summary>
    public static TransponderInfo? SatelliteDelivery(ReadOnlySpan<byte> d)
    {
        if (d.Length < 11) return null;
        long freq = 0;                                   // 8 BCD digits, 10 kHz units
        for (int i = 0; i < 4; i++) freq = freq * 100 + Bcd(d[i]);
        int orbital = Bcd(d[4]) * 100 + Bcd(d[5]);       // 4 BCD digits, tenths of a degree
        bool east = (d[6] & 0x80) != 0;
        int pol = (d[6] >> 5) & 3, rollOff = (d[6] >> 3) & 3, modType = d[6] & 3;
        bool s2 = (d[6] & 0x04) != 0;
        long sr = 0;                                     // 7 BCD digits, 100 symbol/s units
        for (int i = 7; i < 10; i++) sr = sr * 100 + Bcd(d[i]);
        sr = sr * 10 + (d[10] >> 4);
        int fec = d[10] & 0x0F;
        string mod = modType switch { 2 => "8PSK", 3 => s2 ? "16APSK" : "QPSK", _ => "QPSK" };
        return new TransponderInfo
        {
            FreqMHz = (int)Math.Round(freq / 100.0),
            Pol = Pols[pol],
            SymbolRate = (int)(sr / 10),
            Fec = fec < Fecs.Length ? Fecs[fec] : "Auto",
            Mod = mod,
            Std = s2 ? "DVB-S2" : "DVB-S",
            RollOff = s2 ? RollOffs[rollOff] : "0.35",
            Orbital = east ? orbital : -orbital,
        };
    }

    /// <summary>
    /// Reads the events of one EIT section (tables 0x4E to 0x6F). The short event descriptor in
    /// <paramref name="preferredLangs"/> wins over the others; extended text in the same language is appended.
    /// </summary>
    public static List<EpgEvent> ParseEit(byte[] s, IReadOnlyList<string> preferredLangs)
    {
        var list = new List<EpgEvent>();
        if (s.Length < 18 || s[0] < 0x4E || s[0] > 0x6F) return list;
        int sid = (s[3] << 8) | s[4], tsid = (s[8] << 8) | s[9], onid = (s[10] << 8) | s[11];
        int i = 14, end = s.Length - 4;
        while (i + 12 <= end)
        {
            int eventId = (s[i] << 8) | s[i + 1];
            long? start = UtcTime(s.AsSpan(i + 2, 5));
            int dur = Duration(s.AsSpan(i + 7, 3));
            int loop = ((s[i + 10] & 0x0F) << 8) | s[i + 11];
            int dEnd = Math.Min(i + 12 + loop, end);

            string? title = null, text = null, lang = null;
            int rank = int.MaxValue, genre = 0;
            var extended = new Dictionary<string, StringBuilder>();
            for (int d = i + 12; d + 2 <= dEnd; d += 2 + s[d + 1])
            {
                int tag = s[d], len = s[d + 1];
                if (d + 2 + len > dEnd) break;
                var body = s.AsSpan(d + 2, len);
                if (tag == 0x4D && len >= 5)
                {
                    string l = Encoding.ASCII.GetString(body[..3]);
                    int nl = body[3];
                    if (4 + nl > len) continue;
                    int tl = 4 + nl < len ? body[4 + nl] : 0;
                    int r = RankOf(l, preferredLangs);
                    if (title is null || r < rank)
                    {
                        title = DvbText.Decode(body.Slice(4, nl));
                        text = tl > 0 && 5 + nl + tl <= len ? DvbText.Decode(body.Slice(5 + nl, tl)) : "";
                        lang = l;
                        rank = r;
                    }
                }
                else if (tag == 0x4E && len >= 6)
                {
                    string l = Encoding.ASCII.GetString(body.Slice(1, 3));
                    int items = body[4], p = 5 + items;
                    if (p >= len) continue;
                    int tl = body[p];
                    if (p + 1 + tl > len) continue;
                    if (!extended.TryGetValue(l, out var sb)) extended[l] = sb = new StringBuilder();
                    sb.Append(DvbText.Decode(body.Slice(p + 1, tl)));
                }
                else if (tag == 0x54 && len >= 2 && genre == 0)
                {
                    genre = body[0] >> 4;
                }
            }
            if (start is long st && title is { Length: > 0 })
            {
                if (lang is not null && extended.TryGetValue(lang, out var more) && more.Length > 0)
                    text = string.IsNullOrEmpty(text) ? more.ToString() : $"{text} {more}";
                if (text is { Length: > 900 }) text = text[..900];
                list.Add(new EpgEvent { Onid = onid, Tsid = tsid, Sid = sid, Id = eventId, Start = st, Duration = dur, Title = title, Text = text ?? "", Genre = genre });
            }
            i += 12 + loop;
        }
        return list;
    }

    private static int RankOf(string lang, IReadOnlyList<string> preferred)
    {
        for (int i = 0; i < preferred.Count; i++)
            if (string.Equals(lang, preferred[i], StringComparison.OrdinalIgnoreCase)) return i;
        return preferred.Count;
    }
}
