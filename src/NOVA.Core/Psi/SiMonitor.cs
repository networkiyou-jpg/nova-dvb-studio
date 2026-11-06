namespace NOVA.Core.Psi;

/// <summary>
/// Reads the program guide (EIT, PID 0x12) from the tuned transponder for as long as it runs.
/// Sections repeat every few seconds, so each one is parsed once per version.
/// Packets arrive on the tuner thread; <see cref="Drain"/> is called from another thread.
/// </summary>
public sealed class SiMonitor
{
    private const int PidEit = 0x12;
    private readonly object _gate = new();
    private readonly List<EpgEvent> _pending = [];
    private readonly HashSet<(int Table, int Sid, int Tsid, int Onid, int VerSec)> _seen = [];
    private SectionAssembler _eit;
    private string[] _langs = [];

    public SiMonitor() => _eit = new SectionAssembler(OnSection);

    public bool Enabled { get; set; } = true;

    /// <summary>Three-letter codes in order of preference, for example "ara,eng".</summary>
    public string PreferredLanguages
    {
        set => _langs = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    public void FeedPacket(byte[] p, int off)
    {
        if (!Enabled || (p[off + 1] & 0x80) != 0) return;
        int pid = ((p[off + 1] & 0x1F) << 8) | p[off + 2];
        if (pid == PidEit) _eit.Feed(p, off);
    }

    /// <summary>Drops a half-read section after a retune.</summary>
    public void Retuned() => _eit = new SectionAssembler(OnSection);

    /// <summary>Events read since the last call.</summary>
    public List<EpgEvent> Drain()
    {
        lock (_gate)
        {
            var list = new List<EpgEvent>(_pending);
            _pending.Clear();
            return list;
        }
    }

    private void OnSection(byte[] s)
    {
        if (s.Length < 18 || s[0] < 0x4E || s[0] > 0x6F) return;
        (int, int, int, int, int) key = ((int)s[0], (s[3] << 8) | s[4], (s[8] << 8) | s[9], (s[10] << 8) | s[11], (((s[5] >> 1) & 0x1F) << 8) | s[6]);
        if (_seen.Count > 300_000) _seen.Clear();
        if (!_seen.Add(key)) return;
        var events = Si.ParseEit(s, _langs);
        if (events.Count == 0) return;
        lock (_gate)
        {
            if (_pending.Count < 200_000) _pending.AddRange(events);
        }
    }
}
