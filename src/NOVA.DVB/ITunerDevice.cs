using NOVA.Core;

namespace NOVA.DVB;

/// <summary>What the rest of the app needs from a tuner. New hardware plugs in behind this interface.</summary>
public interface ITunerDevice : IDisposable
{
    /// <summary>Raw transport stream bytes. The buffer is only valid during the call.</summary>
    event Action<byte[], int>? Data;

    string Name { get; }
    TunerCapabilities Capabilities { get; }

    void Tune(TuneRequest request);
    SignalStatus ReadSignal();
    bool SendDiseqc(byte[] message);
}

/// <summary>Only what has been confirmed from the driver is set to true.</summary>
public sealed class TunerCapabilities
{
    public bool RawDiseqc { get; set; }
    public bool LnbPowerControl { get; set; }
    public bool ToneControl { get; set; }
    public bool Dvbs2Params { get; set; }
    public string Extension { get; set; } = "none";
}

/// <summary>Maker-specific control beyond standard BDA. One class per maker.</summary>
internal interface IVendorExtension : IDisposable
{
    string Id { get; }
    void Fill(TunerCapabilities caps);
    bool SendDiseqc(byte[] message);
    bool SetLnbPower(bool on);
    bool SetTone(bool on);
    bool SetDvbS2(int rollOff, bool pilot, int fecRate, int modulation);
    int ModulationFor(TuneRequest request);
}
