namespace NOVA.Core.Psi;

/// <summary>Reads PAT, PMT and SDT from packets of one transponder and builds the list of services.</summary>
public sealed class ServiceScanner
{
    private const int PidPat = 0, PidSdt = 0x11;
    private readonly Dictionary<int, SectionAssembler> _assemblers = [];
    private readonly Dictionary<int, ServiceInfo> _services = [];
    private readonly HashSet<int> _pmtDone = [];
    private readonly Dictionary<int, HashSet<int>> _sdtSeen = [];
    private bool _patDone, _sdtDone;
    private int _tsid = -1;

    public bool IsComplete => _patDone && _sdtDone && _pmtDone.Count >= _services.Count(s => s.Value.PmtPid > 0);
    public bool HasPat => _patDone;
    public IReadOnlyCollection<ServiceInfo> Services => _services.Values;

    public void FeedPacket(byte[] p, int off)
    {
        if ((p[off + 1] & 0x80) != 0) return;            // transport error
        int pid = ((p[off + 1] & 0x1F) << 8) | p[off + 2];
        if (pid == PidPat || pid == PidSdt || _assemblers.ContainsKey(pid))
            Assembler(pid).Feed(p, off);
    }

    private SectionAssembler Assembler(int pid)
    {
        if (!_assemblers.TryGetValue(pid, out var a))
            _assemblers[pid] = a = new SectionAssembler(s => OnSection(pid, s));
        return a;
    }

    private void OnSection(int pid, byte[] s)
    {
        switch (s[0])
        {
            case 0x00 when pid == PidPat: ParsePat(s); break;
            case 0x02: ParsePmt(s); break;
            case 0x42 when pid == PidSdt: ParseSdt(s); break;
        }
    }

    private ServiceInfo Service(int sid)
    {
        if (!_services.TryGetValue(sid, out var svc))
            _services[sid] = svc = new ServiceInfo { Sid = sid, Tsid = _tsid };
        return svc;
    }

    private void ParsePat(byte[] s)
    {
        _tsid = (s[3] << 8) | s[4];
        for (int i = 8; i + 4 <= s.Length - 4; i += 4)
        {
            int program = (s[i] << 8) | s[i + 1];
            int pmt = ((s[i + 2] & 0x1F) << 8) | s[i + 3];
            if (program == 0) continue;                  // network PID
            var svc = Service(program);
            svc.Tsid = _tsid;
            svc.PmtPid = pmt;
            Assembler(pmt);
        }
        if (s[6] == s[7]) _patDone = true;
    }

    private void ParsePmt(byte[] s)
    {
        int sid = (s[3] << 8) | s[4];
        if (!_services.TryGetValue(sid, out var svc)) return;
        svc.PcrPid = ((s[8] & 0x1F) << 8) | s[9];
        int progInfo = ((s[10] & 0x0F) << 8) | s[11];
        if (HasCaDescriptor(s, 12, progInfo)) svc.FreeToAir = false;
        svc.Streams.Clear();
        int i = 12 + progInfo, end = s.Length - 4;
        while (i + 5 <= end)
        {
            int type = s[i];
            int pid = ((s[i + 1] & 0x1F) << 8) | s[i + 2];
            int esInfo = ((s[i + 3] & 0x0F) << 8) | s[i + 4];
            if (HasCaDescriptor(s, i + 5, esInfo)) svc.FreeToAir = false;
            var st = Classify(type, s, i + 5, esInfo);
            st.Pid = pid;
            if (st.Kind.Length > 0) svc.Streams.Add(st);
            i += 5 + esInfo;
        }
        _pmtDone.Add(sid);
    }

    private static bool HasCaDescriptor(byte[] s, int off, int len)
    {
        for (int i = off, end = Math.Min(off + len, s.Length); i + 2 <= end; i += 2 + s[i + 1])
            if (s[i] == 0x09) return true;
        return false;
    }

    private static StreamInfo Classify(int type, byte[] s, int off, int len)
    {
        var st = new StreamInfo { Type = type };
        switch (type)
        {
            case 0x01: case 0x02: st.Kind = "video"; st.Codec = "MPEG-2"; break;
            case 0x1B: st.Kind = "video"; st.Codec = "H.264"; break;
            case 0x24: st.Kind = "video"; st.Codec = "H.265"; break;
            case 0x03: case 0x04: st.Kind = "audio"; st.Codec = "MPEG Audio"; break;
            case 0x0F: case 0x11: st.Kind = "audio"; st.Codec = "AAC"; break;
            case 0x81: st.Kind = "audio"; st.Codec = "AC3"; break;
            case 0x87: st.Kind = "audio"; st.Codec = "E-AC3"; break;
        }
        for (int i = off, end = Math.Min(off + len, s.Length); i + 2 <= end; i += 2 + s[i + 1])
        {
            int tag = s[i], dl = s[i + 1];
            if (i + 2 + dl > end) break;
            switch (tag)
            {
                case 0x0A when dl >= 3: st.Lang = Lang(s, i + 2); break;
                case 0x59 when dl >= 3: st.Kind = "subtitle"; st.Codec = "DVB subtitles"; st.Lang = Lang(s, i + 2); break;
                case 0x56 when dl >= 3 && st.Kind.Length == 0: st.Kind = "teletext"; st.Codec = "Teletext"; st.Lang = Lang(s, i + 2); break;
                case 0x6A when type == 0x06: st.Kind = "audio"; st.Codec = "AC3"; break;
                case 0x7A when type == 0x06: st.Kind = "audio"; st.Codec = "E-AC3"; break;
                case 0x7C when type == 0x06: st.Kind = "audio"; st.Codec = "AAC"; break;
            }
        }
        return st;
    }

    private static string Lang(byte[] s, int i) => System.Text.Encoding.ASCII.GetString(s, i, 3);

    private void ParseSdt(byte[] s)
    {
        int tsid = (s[3] << 8) | s[4];
        int i = 11, end = s.Length - 4;
        while (i + 5 <= end)
        {
            int sid = (s[i] << 8) | s[i + 1];
            bool scrambled = (s[i + 3] & 0x10) != 0;
            int loop = ((s[i + 3] & 0x0F) << 8) | s[i + 4];
            var svc = Service(sid);
            if (scrambled) svc.FreeToAir = false;
            for (int d = i + 5, dEnd = Math.Min(i + 5 + loop, end); d + 2 <= dEnd; d += 2 + s[d + 1])
            {
                if (s[d] != 0x48) continue;
                svc.ServiceType = s[d + 2];
                int pl = s[d + 3];
                svc.Provider = DvbText.Decode(s.AsSpan(d + 4, pl));
                int nl = s[d + 4 + pl];
                svc.Name = DvbText.Decode(s.AsSpan(d + 5 + pl, nl));
            }
            i += 5 + loop;
        }
        if (!_sdtSeen.TryGetValue(tsid, out var seen)) _sdtSeen[tsid] = seen = [];
        seen.Add(s[6]);
        if (seen.Count > s[7]) _sdtDone = true;
    }
}
