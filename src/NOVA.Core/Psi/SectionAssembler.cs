namespace NOVA.Core.Psi;

/// <summary>Rebuilds PSI/SI sections for one PID from TS packets and checks their CRC.</summary>
public sealed class SectionAssembler(Action<byte[]> onSection)
{
    private byte[]? _buf;
    private int _have, _need;

    public void Feed(byte[] p, int off)
    {
        bool start = (p[off + 1] & 0x40) != 0;
        int afc = (p[off + 3] >> 4) & 3;
        if (afc is 0 or 2) return;                       // no payload
        int i = off + 4;
        if (afc == 3) i += 1 + p[off + 4];
        int end = off + TsAligner.PacketSize;
        if (i >= end) return;

        if (start)
        {
            int ptr = p[i++];
            if (_buf != null && ptr > 0) Append(p, i, Math.Min(ptr, end - i));
            i += ptr;
            _buf = null;
            while (i + 3 <= end && p[i] != 0xFF)
            {
                int len = (((p[i + 1] & 0x0F) << 8) | p[i + 2]) + 3;
                _buf = new byte[len];
                _have = 0;
                _need = len;
                int take = Math.Min(len, end - i);
                Append(p, i, take);
                i += take;
                if (_buf != null) return;                // continues in the next packet
            }
        }
        else if (_buf != null)
        {
            Append(p, i, Math.Min(_need - _have, end - i));
        }
    }

    private void Append(byte[] p, int i, int n)
    {
        if (_buf == null || n <= 0) return;
        n = Math.Min(n, _need - _have);
        Buffer.BlockCopy(p, i, _buf, _have, n);
        _have += n;
        if (_have < _need) return;
        var s = _buf;
        _buf = null;
        bool syntax = (s[1] & 0x80) != 0;
        if (!syntax || Crc32Mpeg.Compute(s) == 0) onSection(s);
    }
}
