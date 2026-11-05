using System.Text;

namespace NOVA.Core.Psi;

/// <summary>Decodes DVB SI strings (EN 300 468 annex A). Arabic services usually use ISO 8859-6.</summary>
public static class DvbText
{
    static DvbText() => Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

    public static string Decode(ReadOnlySpan<byte> b)
    {
        if (b.IsEmpty) return "";
        try
        {
            Encoding enc;
            int skip = 0;
            byte first = b[0];
            if (first >= 0x20) enc = Encoding.Latin1;
            else if (first is >= 0x01 and <= 0x0B) { enc = Encoding.GetEncoding($"iso-8859-{first + 4}"); skip = 1; }
            else if (first == 0x10 && b.Length >= 3) { enc = Encoding.GetEncoding($"iso-8859-{(b[1] << 8) | b[2]}"); skip = 3; }
            else if (first == 0x11) { enc = Encoding.BigEndianUnicode; skip = 1; }
            else if (first == 0x15) { enc = Encoding.UTF8; skip = 1; }
            else { enc = Encoding.Latin1; skip = 1; }

            var text = enc.GetString(b[skip..]);
            var sb = new StringBuilder(text.Length);
            foreach (var c in text)
            {
                if (c == '\u008A') sb.Append(' ');
                else if (c >= ' ' && c is not (>= '\u0080' and <= '\u009F')) sb.Append(c);
            }
            return sb.ToString().Trim();
        }
        catch (ArgumentException) { return ""; }
    }
}
