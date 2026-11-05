using System.Runtime.InteropServices;
using NOVA.Logging;

namespace NOVA.DVB;

/// <summary>
/// A minimal DirectShow renderer that receives the transport stream.
/// It replaces the Windows Sample Grabber, which refuses the stream on some BDA drivers.
/// It takes whatever media type the tuner offers and hands each sample's bytes to a callback.
/// </summary>
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class TsSinkFilter : IBaseFilter, IMediaFilter, IPersist
{
    private const int ENotImpl = unchecked((int)0x80004001), VfwNotFound = unchecked((int)0x80040216);
    private static readonly Guid ClassId = new("3F0C7D6A-52B1-4E1C-9A77-5D7E4C1B8A21");
    private readonly TsSinkPin _pin;
    private IntPtr _graph;
    private string _name = "TS Sink";
    private volatile int _state;                         // 0 stopped, 1 paused, 2 running

    internal bool IsStopped => _state == 0;

    public TsSinkFilter(Action<IntPtr, int> onData) => _pin = new TsSinkPin(this, onData);

    public int GetClassID(out Guid id) { id = ClassId; return 0; }
    public int Stop() { _state = 0; return 0; }
    public int Pause() { _state = 1; return 0; }
    public int Run(long start) { _state = 2; return 0; }
    public int GetState(int timeoutMs, out int state) { state = _state; return 0; }
    public int SetSyncSource(IntPtr clock) => 0;
    public int GetSyncSource(out IntPtr clock) { clock = IntPtr.Zero; return 0; }
    public int EnumPins(out IEnumPins pins) { pins = new TsPinEnum(_pin); return 0; }

    public int FindPin(string id, out IPin? pin)
    {
        pin = id == TsSinkPin.PinName ? _pin : null;
        return pin is null ? VfwNotFound : 0;
    }

    public int QueryFilterInfo(IntPtr info)
    {
        TsSinkPin.WriteName(info, 0, _name);
        Marshal.WriteIntPtr(info, 256, _graph);          // FILTER_INFO.pGraph, after 128 wide chars
        if (_graph != IntPtr.Zero) Marshal.AddRef(_graph);
        return 0;
    }

    public int JoinFilterGraph(IntPtr graph, string? name)
    {
        _graph = graph;                                  // not counted, as DirectShow requires
        _name = name ?? "";
        return 0;
    }

    public int QueryVendorInfo(out IntPtr info) { info = IntPtr.Zero; return ENotImpl; }
}

[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class TsSinkPin : IPin, IMemInputPin
{
    internal const string PinName = "In";
    private const int ENotImpl = unchecked((int)0x80004001), EPointer = unchecked((int)0x80004003);
    private const int VfwNotStopped = unchecked((int)0x80040224), VfwAlreadyConnected = unchecked((int)0x80040204);
    private const int VfwNotConnected = unchecked((int)0x80040209), VfwNoAllocator = unchecked((int)0x8004020A);
    private const int SFalse = 1;

    private readonly TsSinkFilter _filter;
    private readonly Action<IntPtr, int> _onData;
    private IPin? _partner;
    private AmMediaType _type;
    private volatile bool _flushing;
    private bool _logged;

    internal TsSinkPin(TsSinkFilter filter, Action<IntPtr, int> onData)
    {
        _filter = filter;
        _onData = onData;
    }

    internal static void WriteName(IntPtr target, int offset, string name)
    {
        for (int i = 0; i < 127 && i < name.Length; i++) Marshal.WriteInt16(target, offset + i * 2, name[i]);
        Marshal.WriteInt16(target, offset + Math.Min(name.Length, 127) * 2, 0);
    }

    public int Connect(IPin receiver, IntPtr type) => 0;

    public int ReceiveConnection(IPin connector, IntPtr type)
    {
        if (!_filter.IsStopped) return VfwNotStopped;
        if (_partner != null) return VfwAlreadyConnected;
        if (connector is null || type == IntPtr.Zero) return EPointer;
        _type = Marshal.PtrToStructure<AmMediaType>(type);
        Log.Info($"Stream sink connected: major {_type.MajorType}, subtype {_type.SubType}, format {_type.FormatType}");
        _type.Unk = IntPtr.Zero;
        _type.FormatSize = 0;
        _type.FormatPtr = IntPtr.Zero;
        _partner = connector;
        _flushing = false;
        return 0;
    }

    public int Disconnect()
    {
        if (_partner is null) return SFalse;
        if (!_filter.IsStopped) return VfwNotStopped;
        _partner = null;
        return 0;
    }

    public int ConnectedTo(out IPin? pin)
    {
        pin = _partner;
        return pin is null ? VfwNotConnected : 0;
    }

    public int ConnectionMediaType(IntPtr type)
    {
        if (_partner is null) return VfwNotConnected;
        Marshal.StructureToPtr(_type, type, false);
        return 0;
    }

    public int QueryPinInfo(IntPtr info)
    {
        Marshal.WriteIntPtr(info, 0, Marshal.GetComInterfaceForObject(_filter, typeof(IBaseFilter)));
        Marshal.WriteInt32(info, 8, 0);                  // PINDIR_INPUT
        WriteName(info, 12, PinName);
        return 0;
    }

    public int QueryDirection(out int direction) { direction = 0; return 0; }
    public int QueryId(out IntPtr id) { id = Marshal.StringToCoTaskMemUni(PinName); return 0; }

    public int QueryAccept(IntPtr type)
    {
        if (type != IntPtr.Zero)
        {
            var t = Marshal.PtrToStructure<AmMediaType>(type);
            Log.Info($"Stream sink offered: major {t.MajorType}, subtype {t.SubType}");
        }
        return 0;
    }

    public int EnumMediaTypes(out IEnumMediaTypes types) { types = new TsEmptyTypeEnum(); return 0; }
    public int QueryInternalConnections(IntPtr pins, ref int count) => ENotImpl;
    public int EndOfStream() => 0;
    public int BeginFlush() { _flushing = true; return 0; }
    public int EndFlush() { _flushing = false; return 0; }
    public int NewSegment(long start, long stop, double rate) => 0;

    public int GetAllocator(out IntPtr allocator) { allocator = IntPtr.Zero; return VfwNoAllocator; }
    public int NotifyAllocator(IntPtr allocator, bool readOnly) => 0;
    public int GetAllocatorRequirements(IntPtr properties) => ENotImpl;

    public int Receive(IMediaSample sample)
    {
        try
        {
            if (!_flushing && !_filter.IsStopped && sample.GetPointer(out var data) == 0)
            {
                int length = sample.GetActualDataLength();
                if (!_logged)
                {
                    _logged = true;
                    Log.Info($"First stream sample received, {length} bytes");
                }
                if (length > 0) _onData(data, length);
            }
        }
        finally
        {
            Marshal.ReleaseComObject(sample);            // holding it would starve the upstream allocator
        }
        return 0;
    }

    public int ReceiveMultiple(IntPtr samples, int count, out int processed)
    {
        processed = 0;
        for (int i = 0; i < count; i++)
        {
            var ptr = Marshal.ReadIntPtr(samples, i * IntPtr.Size);
            Receive((IMediaSample)Marshal.GetObjectForIUnknown(ptr));
            processed++;
        }
        return 0;
    }

    public int ReceiveCanBlock() => SFalse;
}

[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class TsPinEnum(IPin pin) : IEnumPins
{
    private int _position;

    public int Next(int count, IPin?[] pins, IntPtr fetched)
    {
        int n = 0;
        if (_position == 0 && count > 0)
        {
            pins[0] = pin;
            _position = 1;
            n = 1;
        }
        if (fetched != IntPtr.Zero) Marshal.WriteInt32(fetched, n);
        return n == count ? 0 : 1;
    }

    public int Skip(int count)
    {
        _position += count;
        return _position <= 1 ? 0 : 1;
    }

    public int Reset() { _position = 0; return 0; }
    public int Clone(out IEnumPins copy) { copy = new TsPinEnum(pin) { _position = _position }; return 0; }
}

/// <summary>Offers no preferred types, so the upstream pin proposes its own.</summary>
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class TsEmptyTypeEnum : IEnumMediaTypes
{
    public int Next(int count, IntPtr types, IntPtr fetched)
    {
        if (fetched != IntPtr.Zero) Marshal.WriteInt32(fetched, 0);
        return 1;
    }

    public int Skip(int count) => 1;
    public int Reset() => 0;
    public int Clone(out IEnumMediaTypes copy) { copy = new TsEmptyTypeEnum(); return 0; }
}
