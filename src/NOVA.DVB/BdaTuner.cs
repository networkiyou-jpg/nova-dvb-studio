using System.Runtime.InteropServices;
using NOVA.Core;
using NOVA.Logging;

namespace NOVA.DVB;

/// <summary>
/// One BDA satellite tuner as a DirectShow graph:
/// network provider, tuner, optional capture filter, then a tee with two branches.
/// Branch one is our own sink filter, which hands the transport stream to the engine.
/// Branch two is the MPEG-2 demux and TIF that many BDA drivers need before they will run.
/// </summary>
public sealed class BdaTuner : ITunerDevice
{
    private const int DvbSatellite = 2, FecViterbi = 1;
    private const int ModQpsk = 20, Mod8Psk = 27;
    private static readonly Guid DvbsNetworkType = new("FA4B375A-45B4-4D45-8440-263957B11623");

    private readonly List<object> _com = [];
    private readonly IGraphBuilder _graph;
    private readonly IMediaControl _control;
    private readonly ITuner _tuner;
    private readonly IBaseFilter _tunerFilter;
    private readonly IVendorExtension? _vendor;
    private readonly byte[] _copy = new byte[1 << 20];
    private TsSinkFilter? _sink;                         // kept alive here while the graph uses it
    private IDvbsTuningSpace? _space;
    private LnbConfig? _spaceLnb;
    private IBdaSignalStatistics? _stats;
    private bool _running, _disposed;
    private int _lastMotor;
    private long _bytes;
    private long _lastBytes, _lastTicks = Environment.TickCount64;

    public event Action<byte[], int>? Data;
    public string Name { get; }
    public TunerCapabilities Capabilities { get; } = new();

    public BdaTuner(int index)
    {
        var device = Bda.Devices(Category.BdaNetworkTuner).ElementAtOrDefault(index);
        if (device.Moniker is null) throw new InvalidOperationException($"Tuner {index} is not present");
        Name = device.Name;
        Log.Info($"Opening tuner {index}: {Name}");

        try
        {
            _graph = Track(Bda.Create<IGraphBuilder>(Clsid.FilterGraph));
            _control = (IMediaControl)_graph;
            _tunerFilter = Track(Bda.Bind(device.Moniker));
            Bda.Check(_graph.AddFilter(_tunerFilter, "Tuner"), "Adding the tuner");

            _tuner = ConnectProvider();
            var tail = ConnectReceiver();
            BuildOutput(tail);

            _vendor = TbsExtension.TryCreate(_tunerFilter, Name);
            _vendor?.Fill(Capabilities);
            _stats = FindSignalStatistics();
            Log.Info($"Graph ready. Extension={Capabilities.Extension}, signal statistics={(_stats != null)}");
        }
        catch
        {
            ReleaseAll();                                // a failed open must not keep the tuner busy
            throw;
        }
    }

    private T Track<T>(T com) where T : class
    {
        _com.Add(com);
        return com;
    }

    private ITuner ConnectProvider()
    {
        foreach (var clsid in new[] { Clsid.NetworkProvider, Clsid.DvbsNetworkProvider })
        {
            IBaseFilter provider;
            try { provider = Track(Bda.Create<IBaseFilter>(clsid)); }
            catch (COMException) { continue; }
            Bda.Check(_graph.AddFilter(provider, "Network Provider"), "Adding the network provider");
            if (Bda.Connect(_graph, provider, _tunerFilter))
            {
                Log.Info($"Network provider connected ({clsid})");
                return (ITuner)provider;
            }
            _graph.RemoveFilter(provider);
        }
        throw new InvalidOperationException("No network provider would connect to this tuner");
    }

    /// <summary>Some cards need a capture filter after the tuner, some deliver the stream directly.</summary>
    private IBaseFilter ConnectReceiver()
    {
        foreach (var (moniker, name, _) in Bda.Devices(Category.BdaReceiver))
        {
            IBaseFilter f;
            try { f = Bda.Bind(moniker); }
            catch (COMException) { continue; }
            if (_graph.AddFilter(f, name) < 0) { Bda.Release(f); continue; }
            if (Bda.Connect(_graph, _tunerFilter, f))
            {
                Log.Info($"Capture filter connected: {name}");
                return Track(f);
            }
            _graph.RemoveFilter(f);
            Bda.Release(f);
        }
        Log.Info("No separate capture filter, using the tuner output directly");
        return _tunerFilter;
    }

    private void BuildOutput(IBaseFilter source)
    {
        var tee = Track(Bda.Create<IBaseFilter>(Clsid.InfTee));
        Bda.Check(_graph.AddFilter(tee, "Tee"), "Adding the tee");
        if (!Bda.Connect(_graph, source, tee)) throw new InvalidOperationException("The tuner output would not connect");

        _sink = new TsSinkFilter(OnStream);
        Bda.Check(_graph.AddFilter(_sink, "TS Sink"), "Adding the stream sink");
        ConnectSink(tee, _sink);

        var demux = Track(Bda.Create<IBaseFilter>(Clsid.Mpeg2Demux));
        Bda.Check(_graph.AddFilter(demux, "Demux"), "Adding the demux");
        if (!Bda.Connect(_graph, tee, demux)) { Log.Warn("Demux branch would not connect"); return; }
        if (!ConnectTif(demux)) Log.Warn("No transport information filter connected. Some drivers still run without it.");
    }

    private void ConnectSink(IBaseFilter tee, IBaseFilter sink)
    {
        if (Bda.Connect(_graph, tee, sink)) return;
        int hr = 0;
        foreach (var output in Bda.Pins(tee, input: false).ToList())
            foreach (var input in Bda.Pins(sink, input: true).ToList())
                if (output.ConnectedTo(out _) != 0) hr = _graph.ConnectDirect(output, input, IntPtr.Zero);
        Log.Error($"The stream sink was refused, hr=0x{hr:X8}");
        throw new InvalidOperationException($"The stream sink would not connect (0x{hr:X8})");
    }

    private bool ConnectTif(IBaseFilter demux)
    {
        try
        {
            var tif = Bda.Create<IBaseFilter>(Clsid.BdaMpeg2Tif);
            if (_graph.AddFilter(tif, "TIF") >= 0)
            {
                if (Bda.Connect(_graph, demux, tif)) { Track(tif); return true; }
                _graph.RemoveFilter(tif);
            }
        }
        catch (COMException) { /* falls through to enumeration */ }

        foreach (var (moniker, name, _) in Bda.Devices(Category.BdaTransportInformation))
        {
            var tif = Bda.Bind(moniker);
            if (_graph.AddFilter(tif, name) < 0) continue;
            if (Bda.Connect(_graph, demux, tif)) { Track(tif); return true; }
            _graph.RemoveFilter(tif);
        }
        return false;
    }

    private IBdaSignalStatistics? FindSignalStatistics()
    {
        if (_tunerFilter is not IBdaTopology topology) return null;
        var types = new int[32];
        if (topology.GetNodeTypes(out int count, types.Length, types) < 0) return null;
        var wanted = typeof(IBdaSignalStatistics).GUID;
        for (int i = 0; i < count; i++)
        {
            var ifaces = new Guid[32];
            if (topology.GetNodeInterfaces(types[i], out int n, ifaces.Length, ifaces) < 0) continue;
            if (!ifaces.Take(n).Contains(wanted)) continue;
            if (topology.GetControlNode(0, 1, types[i], out var node) >= 0 && node is IBdaSignalStatistics s) return s;
        }
        return null;
    }

    private IDvbsTuningSpace Space(LnbConfig lnb)
    {
        if (_space != null && _spaceLnb is { } l && l.LowMHz == lnb.LowMHz && l.HighMHz == lnb.HighMHz && l.SwitchMHz == lnb.SwitchMHz)
            return _space;

        var space = Bda.Create<IDvbsTuningSpace>(Clsid.DvbsTuningSpace);
        var net = DvbsNetworkType;
        Bda.Check(space.put_UniqueName("NOVA DVB-S"), "Tuning space name");
        Bda.Check(space.put_FriendlyName("NOVA DVB-S"), "Tuning space name");
        Bda.Check(space.put__NetworkType(ref net), "Tuning space network type");
        Bda.Check(space.put_SystemType(DvbSatellite), "Tuning space system type");
        space.put_NetworkID(-1);
        Bda.Check(space.put_LowOscillator(lnb.LowMHz * 1000), "LNB low oscillator");
        Bda.Check(space.put_HighOscillator(lnb.HighMHz * 1000), "LNB high oscillator");
        Bda.Check(space.put_LNBSwitch(lnb.SwitchMHz * 1000), "LNB switch frequency");
        var locator = Bda.Create<IDvbsLocator>(Clsid.DvbsLocator);
        Bda.Check(space.put_DefaultLocator((ILocator)locator), "Default locator");
        Bda.Check(_tuner.put_TuningSpace((ITuningSpace)space), "Selecting the tuning space");
        _space = space;
        _spaceLnb = lnb;
        return space;
    }

    public void Tune(TuneRequest r)
    {
        _vendor?.SetLnbPower(true);
        ApplySwitching(r);

        var space = Space(r.Lnb);
        int modulation = _vendor?.ModulationFor(r) ?? (r.Mod == "8PSK" ? Mod8Psk : ModQpsk);
        int fec = FecCode(r.Fec);
        bool high = r.Lnb.IsHighBand(r.FreqMHz);

        if (r.Std != "DVB-S")
            _vendor?.SetDvbS2(TbsExtension.RollOffCode(r.RollOff), r.Pilot != "Off", fec, modulation);

        var locator = Bda.Create<IDvbsLocator>(Clsid.DvbsLocator);
        Bda.Check(locator.put_CarrierFrequency(r.FreqMHz * 1000), "Frequency");
        Bda.Check(locator.put_SymbolRate(r.SymbolRate), "Symbol rate");
        Bda.Check(locator.put_SignalPolarisation(PolarisationCode(r.Pol)), "Polarisation");
        Bda.Check(locator.put_Modulation(modulation), "Modulation");
        Bda.Check(locator.put_InnerFEC(FecViterbi), "FEC method");
        Bda.Check(locator.put_InnerFECRate(fec), "FEC rate");

        Bda.Check(space.CreateTuneRequest(out var request), "Creating the tune request");
        Bda.Check(request.put_Locator((ILocator)locator), "Setting the locator");
        Bda.Check(_tuner.put_TuneRequest(request), "Tuning");

        if (!_running)
        {
            Bda.Check(_control.Run(), "Starting the graph");
            _running = true;
        }
        Log.Info($"Tuned {r.FreqMHz} {r.Pol} {r.SymbolRate} {r.Std} {r.Mod} {r.Fec}, high band={high}");
    }

    /// <summary>
    /// Order on the bus: tone off, committed switch, uncommitted switch, motor, then the band tone is
    /// restored by the tuning call. DiSEqC needs the 22 kHz tone quiet while messages are sent.
    /// </summary>
    private void ApplySwitching(TuneRequest r)
    {
        if (r.Diseqc == "None" || _vendor is null) return;
        bool horizontal = r.Pol is "H" or "L";
        bool high = r.Lnb.IsHighBand(r.FreqMHz);
        _vendor.SetTone(false);
        Thread.Sleep(20);
        if (r.Port >= 0)
        {
            _vendor.SendDiseqc(Diseqc.Committed(r.Port, horizontal, high));
            Thread.Sleep(60);
        }
        if (r.Diseqc is "1.1" or "1.2" && r.Uncommitted >= 0)
        {
            _vendor.SendDiseqc(Diseqc.Uncommitted(r.Uncommitted));
            Thread.Sleep(60);
        }
        if (r.Diseqc == "1.2" && r.MotorPosition > 0 && r.MotorPosition != _lastMotor)
        {
            _vendor.SendDiseqc(Diseqc.MotorGoto(r.MotorPosition));
            _lastMotor = r.MotorPosition;
            Thread.Sleep(60);
        }
        _vendor.SetTone(high);
    }

    public bool SendDiseqc(byte[] message) => _vendor?.SendDiseqc(message) ?? false;

    public SignalStatus ReadSignal()
    {
        long now = Environment.TickCount64, total = Interlocked.Read(ref _bytes);
        int kbps = now > _lastTicks ? (int)((total - _lastBytes) * 8 / (now - _lastTicks)) : 0;
        _lastTicks = now;
        _lastBytes = total;

        var s = new SignalStatus { BitrateKbps = kbps };
        if (_stats is null) return s;
        s.Available = true;
        if (_stats.get_SignalLocked(out bool locked) >= 0) s.Locked = locked;
        if (_stats.get_SignalPresent(out bool present) >= 0) s.Present = present;
        if (_stats.get_SignalStrength(out int strength) >= 0) s.Strength = strength;
        if (_stats.get_SignalQuality(out int quality) >= 0) s.Quality = quality;
        return s;
    }

    public static int PolarisationCode(string p) => p switch { "H" => 1, "V" => 2, "L" => 3, "R" => 4, _ => 1 };

    public static int FecCode(string f) => f switch
    {
        "1/2" => 1, "2/3" => 2, "3/4" => 3, "3/5" => 4, "4/5" => 5, "5/6" => 6, "7/8" => 8,
        "6/7" => 12, "8/9" => 13, "9/10" => 14, _ => -1,
    };

    private void OnStream(IntPtr buffer, int length)
    {
        if (_disposed || length <= 0) return;
        int n = Math.Min(length, _copy.Length);
        Marshal.Copy(buffer, _copy, 0, n);
        Interlocked.Add(ref _bytes, n);
        Data?.Invoke(_copy, n);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            if (_running) _control.Stop();
            _vendor?.SetLnbPower(false);
        }
        catch (COMException ex) { Log.Warn($"Stopping the tuner: {ex.Message}"); }
        _vendor?.Dispose();
        ReleaseAll();
        Log.Info("Tuner released");
    }

    private void ReleaseAll()
    {
        for (int i = _com.Count - 1; i >= 0; i--) Bda.Release(_com[i]);
        _com.Clear();
    }
}
