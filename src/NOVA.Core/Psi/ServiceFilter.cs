namespace NOVA.Core.Psi;

/// <summary>
/// Keeps one service out of a whole transponder: a new PAT that lists only that service, its PMT,
/// its elementary streams and its PCR. Players on other devices then open the right channel by
/// themselves. Feed whole 188-byte packets from one thread.
/// </summary>
public sealed class ServiceFilter
{
    private readonly int _sid;
    private readonly Action<byte[], int> _output;
    private readonly SectionAssembler _pat;
    private readonly byte[] _patPacket = new byte[TsAligner.PacketSize];
    private SectionAssembler? _pmt;
    private HashSet<int> _pids = [];
    private int _pmtPid = -1;
    private byte _patCc;
    private bool _patReady;

    public ServiceFilter(int sid, Action<byte[], int> output)
    {
        _sid = sid;
        _output = output;
        _pat = new SectionAssembler(OnPat);
    }

    public int ServiceId => _sid;

    public void FeedPacket(byte[] p, int off)
    {
        int pid = ((p[off + 1] & 0x1F) << 8) | p[off + 2];
        if (pid == 0)
        {
            _pat.Feed(p, off);
            if (!_patReady || (p[off + 1] & 0x40) == 0) return;   // one new PAT for every PAT start
            _patPacket[3] = (byte)(0x10 | (_patCc++ & 0x0F));
            _output(_patPacket, 0);
            return;
        }
        if (pid == _pmtPid)
        {
            _pmt?.Feed(p, off);
            _output(p, off);
            return;
        }
        if (_pids.Contains(pid)) _output(p, off);
    }

    private void OnPat(byte[] s)
    {
        if (s[0] != 0x00) return;
        int tsid = (s[3] << 8) | s[4];
        for (int i = 8; i + 4 <= s.Length - 4; i += 4)
        {
            int program = (s[i] << 8) | s[i + 1];
            int pid = ((s[i + 2] & 0x1F) << 8) | s[i + 3];
            if (program != _sid) continue;
            if (pid != _pmtPid)
            {
                _pmtPid = pid;
                _pmt = new SectionAssembler(OnPmt);
                _pids = [];
            }
            BuildPat(tsid, pid);
            return;
        }
    }

    private void OnPmt(byte[] s)
    {
        if (s[0] != 0x02 || ((s[3] << 8) | s[4]) != _sid) return;
        var pids = new HashSet<int> { ((s[8] & 0x1F) << 8) | s[9] };   // PCR
        int info = ((s[10] & 0x0F) << 8) | s[11];
        int i = 12 + info, end = s.Length - 4;
        while (i + 5 <= end)
        {
            pids.Add(((s[i + 1] & 0x1F) << 8) | s[i + 2]);
            i += 5 + (((s[i + 3] & 0x0F) << 8) | s[i + 4]);
        }
        _pids = pids;
    }

    private void BuildPat(int tsid, int pmtPid)
    {
        byte[] sec =
        [
            0x00, 0xB0, 0x0D, (byte)(tsid >> 8), (byte)tsid, 0xC1, 0x00, 0x00,
            (byte)(_sid >> 8), (byte)_sid, (byte)(0xE0 | (pmtPid >> 8)), (byte)pmtPid, 0, 0, 0, 0,
        ];
        uint crc = Crc32Mpeg.Compute(sec.AsSpan(0, 12));
        sec[12] = (byte)(crc >> 24); sec[13] = (byte)(crc >> 16); sec[14] = (byte)(crc >> 8); sec[15] = (byte)crc;
        Array.Fill(_patPacket, (byte)0xFF);
        _patPacket[0] = 0x47;
        _patPacket[1] = 0x40;
        _patPacket[2] = 0x00;
        _patPacket[3] = 0x10;
        _patPacket[4] = 0x00;
        Buffer.BlockCopy(sec, 0, _patPacket, 5, sec.Length);
        _patReady = true;
    }
}
