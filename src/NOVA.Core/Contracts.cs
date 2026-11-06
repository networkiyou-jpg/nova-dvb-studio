using System.Text.Json;
using System.Text.Json.Serialization;

namespace NOVA.Core;

/// <summary>Everything the DVB engine needs to tune one transponder.</summary>
public sealed class TuneRequest
{
    public int FreqMHz { get; set; }
    public string Pol { get; set; } = "H";
    public int SymbolRate { get; set; }
    public string Fec { get; set; } = "Auto";
    public string Mod { get; set; } = "QPSK";
    public string Std { get; set; } = "DVB-S";
    public string RollOff { get; set; } = "0.35";
    public string Pilot { get; set; } = "Auto";
    public LnbConfig Lnb { get; set; } = new();
    /// <summary>None, 1.0, 1.1 or 1.2</summary>
    public string Diseqc { get; set; } = "None";
    /// <summary>Committed port 0..3 (A..D), or -1 for none.</summary>
    public int Port { get; set; } = -1;
    /// <summary>Uncommitted port 0..15, or -1 for none.</summary>
    public int Uncommitted { get; set; } = -1;
    /// <summary>Stored motor position 1..255, or 0 for none.</summary>
    public int MotorPosition { get; set; }
}

public sealed class TunerInfo
{
    public int Index { get; set; }
    public string Name { get; set; } = "";
    public string Maker { get; set; } = "";
    public string Path { get; set; } = "";
}

public sealed class SignalStatus
{
    public bool Available { get; set; }
    public bool Locked { get; set; }
    public bool Present { get; set; }
    /// <summary>Raw value from the driver. Units differ between drivers.</summary>
    public int? Strength { get; set; }
    /// <summary>0..100 as reported by the driver.</summary>
    public int? Quality { get; set; }
    public int BitrateKbps { get; set; }
}

public sealed class StreamInfo
{
    public int Pid { get; set; }
    public int Type { get; set; }
    public string Kind { get; set; } = "";
    public string Codec { get; set; } = "";
    public string Lang { get; set; } = "";
}

/// <summary>A transponder announced in the network information table (NIT).</summary>
public sealed class TransponderInfo
{
    public int FreqMHz { get; set; }
    public string Pol { get; set; } = "H";
    public int SymbolRate { get; set; }
    public string Fec { get; set; } = "Auto";
    public string Mod { get; set; } = "QPSK";
    public string Std { get; set; } = "DVB-S";
    public string RollOff { get; set; } = "0.35";
    /// <summary>Orbital position in tenths of a degree, east positive, west negative.</summary>
    public int Orbital { get; set; }
    public int Tsid { get; set; }
    public int Onid { get; set; }
}

/// <summary>One program from the broadcast guide (EIT).</summary>
public sealed class EpgEvent
{
    public int Onid { get; set; }
    public int Tsid { get; set; }
    public int Sid { get; set; }
    public int Id { get; set; }
    /// <summary>Start time in Unix seconds, UTC.</summary>
    public long Start { get; set; }
    /// <summary>Length in seconds.</summary>
    public int Duration { get; set; }
    public string Title { get; set; } = "";
    public string Text { get; set; } = "";
    /// <summary>EN 300 468 content nibble (1 movie, 2 news, 4 sport, 5 children, 6 music ...), 0 when absent.</summary>
    public int Genre { get; set; }
}

public sealed class ServiceInfo
{
    public int Sid { get; set; }
    public int Tsid { get; set; }
    public int Onid { get; set; }
    public string Name { get; set; } = "";
    public string Provider { get; set; } = "";
    public int ServiceType { get; set; }
    public bool FreeToAir { get; set; } = true;
    public int PmtPid { get; set; }
    public int PcrPid { get; set; }
    public List<StreamInfo> Streams { get; set; } = [];
    public bool IsRadio => ServiceType is 0x02 or 0x0A;
    public bool IsTv => ServiceType is 0x01 or 0x11 or 0x16 or 0x19 or 0x1F or 0x20;
}

/// <summary>JSON used on the line between the app and the engine process.</summary>
public static class Wire
{
    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
}
