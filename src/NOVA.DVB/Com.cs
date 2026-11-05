using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

namespace NOVA.DVB;

/// <summary>
/// DirectShow and BDA COM declarations, written from the Windows SDK headers.
/// Method order matches each interface's vtable, so unused methods stay as placeholders.
/// </summary>
internal static class Clsid
{
    public static readonly Guid FilterGraph = new("E436EBB3-524F-11CE-9F53-0020AF0BA770");
    public static readonly Guid SystemDeviceEnum = new("62BE5D10-60EB-11D0-BD3B-00A0C911CE86");
    public static readonly Guid NetworkProvider = new("B2F3A67C-29DA-4C78-8831-091ED509A475");
    public static readonly Guid DvbsNetworkProvider = new("FA4B375A-45B4-4D45-8440-263957B11623");
    public static readonly Guid DvbsTuningSpace = new("B64016F3-C9A2-4066-96F0-BD9563314726");
    public static readonly Guid DvbsLocator = new("1DF7D126-4050-47F0-A7CF-4C4CA9241333");
    public static readonly Guid InfTee = new("F8388A40-D5BB-11D0-BE5A-0080C706568E");
    public static readonly Guid Mpeg2Demux = new("AFB6C280-2C41-11D3-8A60-0000F81E0E4A");
    public static readonly Guid BdaMpeg2Tif = new("FC772AB0-0C7F-11D3-8FF2-00A0C9224CF4");
}

internal static class Category
{
    public static readonly Guid BdaNetworkTuner = new("71985F48-1CA1-11D3-9CC8-00C04F7971E0");
    public static readonly Guid BdaReceiver = new("FD0A5AF4-B41D-11D2-9C95-00C04F7971E0");
    public static readonly Guid BdaTransportInformation = new("A2E3074F-6C3D-11D3-B653-00C04F79498E");
}

[StructLayout(LayoutKind.Sequential)]
internal struct AmMediaType
{
    public Guid MajorType;
    public Guid SubType;
    [MarshalAs(UnmanagedType.Bool)] public bool FixedSizeSamples;
    [MarshalAs(UnmanagedType.Bool)] public bool TemporalCompression;
    public int SampleSize;
    public Guid FormatType;
    public IntPtr Unk;
    public int FormatSize;
    public IntPtr FormatPtr;
}

[ComImport, Guid("29840822-5B84-11D0-BD3B-00A0C911CE86"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface ICreateDevEnum
{
    [PreserveSig] int CreateClassEnumerator(ref Guid category, out IEnumMoniker? enumerator, int flags);
}

[ComImport, Guid("55272A00-42CB-11CE-8135-00AA004BB851"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPropertyBag
{
    [PreserveSig] int Read([MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.Struct)] out object? value, IntPtr errorLog);
    [PreserveSig] int Write([MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.Struct)] ref object value);
}

[ComImport, Guid("56A868A9-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IGraphBuilder
{
    // IFilterGraph
    [PreserveSig] int AddFilter(IBaseFilter filter, [MarshalAs(UnmanagedType.LPWStr)] string name);
    [PreserveSig] int RemoveFilter(IBaseFilter filter);
    void _EnumFilters();
    void _FindFilterByName();
    [PreserveSig] int ConnectDirect(IPin output, IPin input, IntPtr mediaType);
    void _Reconnect();
    [PreserveSig] int Disconnect(IPin pin);
    void _SetDefaultSyncSource();
    // IGraphBuilder
    [PreserveSig] int Connect(IPin output, IPin input);
}

[ComImport, Guid("0000010C-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPersist
{
    [PreserveSig] int GetClassID(out Guid id);
}

[ComImport, Guid("56A86899-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMediaFilter
{
    [PreserveSig] int GetClassID(out Guid id);
    [PreserveSig] int Stop();
    [PreserveSig] int Pause();
    [PreserveSig] int Run(long start);
    [PreserveSig] int GetState(int timeoutMs, out int state);
    [PreserveSig] int SetSyncSource(IntPtr clock);
    [PreserveSig] int GetSyncSource(out IntPtr clock);
}

[ComImport, Guid("56A86895-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IBaseFilter
{
    // IPersist
    [PreserveSig] int GetClassID(out Guid id);
    // IMediaFilter
    [PreserveSig] int Stop();
    [PreserveSig] int Pause();
    [PreserveSig] int Run(long start);
    [PreserveSig] int GetState(int timeoutMs, out int state);
    [PreserveSig] int SetSyncSource(IntPtr clock);
    [PreserveSig] int GetSyncSource(out IntPtr clock);
    // IBaseFilter
    [PreserveSig] int EnumPins(out IEnumPins pins);
    [PreserveSig] int FindPin([MarshalAs(UnmanagedType.LPWStr)] string id, out IPin? pin);
    [PreserveSig] int QueryFilterInfo(IntPtr info);
    [PreserveSig] int JoinFilterGraph(IntPtr graph, [MarshalAs(UnmanagedType.LPWStr)] string? name);
    [PreserveSig] int QueryVendorInfo(out IntPtr info);
}

[ComImport, Guid("56A86892-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IEnumPins
{
    [PreserveSig] int Next(int count, [Out, MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.Interface, SizeParamIndex = 0)] IPin?[] pins, IntPtr fetched);
    [PreserveSig] int Skip(int count);
    [PreserveSig] int Reset();
    [PreserveSig] int Clone(out IEnumPins copy);
}

[ComImport, Guid("56A86891-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPin
{
    [PreserveSig] int Connect(IPin receiver, IntPtr type);
    [PreserveSig] int ReceiveConnection(IPin connector, IntPtr type);
    [PreserveSig] int Disconnect();
    [PreserveSig] int ConnectedTo(out IPin? pin);
    [PreserveSig] int ConnectionMediaType(IntPtr type);
    [PreserveSig] int QueryPinInfo(IntPtr info);
    [PreserveSig] int QueryDirection(out int direction);   // 0 = input, 1 = output
    [PreserveSig] int QueryId(out IntPtr id);
    [PreserveSig] int QueryAccept(IntPtr type);
    [PreserveSig] int EnumMediaTypes(out IEnumMediaTypes types);
    [PreserveSig] int QueryInternalConnections(IntPtr pins, ref int count);
    [PreserveSig] int EndOfStream();
    [PreserveSig] int BeginFlush();
    [PreserveSig] int EndFlush();
    [PreserveSig] int NewSegment(long start, long stop, double rate);
}

[ComImport, Guid("89C31040-846B-11CE-97D3-00AA0055595A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IEnumMediaTypes
{
    [PreserveSig] int Next(int count, IntPtr types, IntPtr fetched);
    [PreserveSig] int Skip(int count);
    [PreserveSig] int Reset();
    [PreserveSig] int Clone(out IEnumMediaTypes copy);
}

[ComImport, Guid("56A8689D-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMemInputPin
{
    [PreserveSig] int GetAllocator(out IntPtr allocator);
    [PreserveSig] int NotifyAllocator(IntPtr allocator, [MarshalAs(UnmanagedType.Bool)] bool readOnly);
    [PreserveSig] int GetAllocatorRequirements(IntPtr properties);
    [PreserveSig] int Receive(IMediaSample sample);
    [PreserveSig] int ReceiveMultiple(IntPtr samples, int count, out int processed);
    [PreserveSig] int ReceiveCanBlock();
}

[ComImport, Guid("56A8689A-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMediaSample
{
    [PreserveSig] int GetPointer(out IntPtr buffer);
    [PreserveSig] int GetSize();
    void _GetTime();
    void _SetTime();
    void _IsSyncPoint();
    void _SetSyncPoint();
    void _IsPreroll();
    void _SetPreroll();
    [PreserveSig] int GetActualDataLength();
}

[ComImport, Guid("56A868B1-0AD4-11CE-B03A-0020AF0BA770"), InterfaceType(ComInterfaceType.InterfaceIsDual)]
internal interface IMediaControl
{
    [PreserveSig] int Run();
    [PreserveSig] int Pause();
    [PreserveSig] int Stop();
}

[ComImport, Guid("31EFAC30-515C-11D0-A9AA-00AA0061BE93"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IKsPropertySet
{
    [PreserveSig] int Set(ref Guid propSet, int id, IntPtr instance, int instanceLength, IntPtr data, int dataLength);
    [PreserveSig] int Get(ref Guid propSet, int id, IntPtr instance, int instanceLength, IntPtr data, int dataLength, out int returned);
    [PreserveSig] int QuerySupported(ref Guid propSet, int id, out int support);   // 1 = get, 2 = set
}

[ComImport, Guid("28C52640-018A-11D3-9D8E-00C04F72D980"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface ITuner
{
    void _get_TuningSpace();
    [PreserveSig] int put_TuningSpace(ITuningSpace space);
    void _EnumTuningSpaces();
    void _get_TuneRequest();
    [PreserveSig] int put_TuneRequest(ITuneRequest request);
}

[ComImport, Guid("061C6E30-E622-11D2-9493-00C04F72D980"), InterfaceType(ComInterfaceType.InterfaceIsDual)]
internal interface ITuningSpace
{
}

/// <summary>Flattened: ITuningSpace, IDVBTuningSpace, IDVBTuningSpace2, IDVBSTuningSpace.</summary>
[ComImport, Guid("CDF7BE60-D954-42FD-A972-78971958E470"), InterfaceType(ComInterfaceType.InterfaceIsDual)]
internal interface IDvbsTuningSpace
{
    void _get_UniqueName();
    [PreserveSig] int put_UniqueName([MarshalAs(UnmanagedType.BStr)] string name);
    void _get_FriendlyName();
    [PreserveSig] int put_FriendlyName([MarshalAs(UnmanagedType.BStr)] string name);
    void _get_CLSID();
    void _get_NetworkType();
    void _put_NetworkType();
    void _get__NetworkType();
    [PreserveSig] int put__NetworkType(ref Guid networkType);
    [PreserveSig] int CreateTuneRequest(out ITuneRequest request);
    void _EnumCategoryGUIDs();
    void _EnumDeviceMonikers();
    void _get_DefaultPreferredComponentTypes();
    void _put_DefaultPreferredComponentTypes();
    void _get_FrequencyMapping();
    void _put_FrequencyMapping();
    void _get_DefaultLocator();
    [PreserveSig] int put_DefaultLocator(ILocator locator);
    void _Clone();
    void _get_SystemType();
    [PreserveSig] int put_SystemType(int type);            // 2 = DVB_Satellite
    void _get_NetworkID();
    [PreserveSig] int put_NetworkID(int id);
    void _get_LowOscillator();
    [PreserveSig] int put_LowOscillator(int khz);
    void _get_HighOscillator();
    [PreserveSig] int put_HighOscillator(int khz);
    void _get_LNBSwitch();
    [PreserveSig] int put_LNBSwitch(int khz);
}

[ComImport, Guid("286D7F89-760C-4F89-80C4-66841D2507AA"), InterfaceType(ComInterfaceType.InterfaceIsDual)]
internal interface ILocator
{
}

/// <summary>Flattened: ILocator, IDigitalLocator, IDVBSLocator.</summary>
[ComImport, Guid("3D7C353C-0D04-45F1-A742-F97CC1188DC8"), InterfaceType(ComInterfaceType.InterfaceIsDual)]
internal interface IDvbsLocator
{
    void _get_CarrierFrequency();
    [PreserveSig] int put_CarrierFrequency(int khz);
    void _get_InnerFEC();
    [PreserveSig] int put_InnerFEC(int method);            // 1 = Viterbi
    void _get_InnerFECRate();
    [PreserveSig] int put_InnerFECRate(int rate);
    void _get_OuterFEC();
    [PreserveSig] int put_OuterFEC(int method);
    void _get_OuterFECRate();
    [PreserveSig] int put_OuterFECRate(int rate);
    void _get_Modulation();
    [PreserveSig] int put_Modulation(int modulation);
    void _get_SymbolRate();
    [PreserveSig] int put_SymbolRate(int ksps);
    void _Clone();
    void _get_SignalPolarisation();
    [PreserveSig] int put_SignalPolarisation(int polarisation);
}

[ComImport, Guid("07DDC146-FC3D-11D2-9D8C-00C04F72D980"), InterfaceType(ComInterfaceType.InterfaceIsDual)]
internal interface ITuneRequest
{
    void _get_TuningSpace();
    void _get_Components();
    void _Clone();
    void _get_Locator();
    [PreserveSig] int put_Locator(ILocator locator);
}

[ComImport, Guid("79B56888-7FEA-4690-B45D-38FD3C7849BE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IBdaTopology
{
    [PreserveSig] int GetNodeTypes(out int count, int max, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 1)] int[] types);
    void _GetNodeDescriptors();
    [PreserveSig] int GetNodeInterfaces(int nodeType, out int count, int max, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 2)] Guid[] interfaces);
    void _GetPinTypes();
    void _GetTemplateConnections();
    void _CreatePin();
    void _DeletePin();
    void _SetMediaType();
    void _SetMedium();
    void _CreateTopology();
    [PreserveSig] int GetControlNode(int inputPin, int outputPin, int nodeType, [MarshalAs(UnmanagedType.IUnknown)] out object? node);
}

[ComImport, Guid("1347D106-CF3A-428A-A5CB-AC0D9A2A4338"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IBdaSignalStatistics
{
    void _put_SignalStrength();
    [PreserveSig] int get_SignalStrength(out int strength);
    void _put_SignalQuality();
    [PreserveSig] int get_SignalQuality(out int quality);
    void _put_SignalPresent();
    [PreserveSig] int get_SignalPresent([MarshalAs(UnmanagedType.U1)] out bool present);
    void _put_SignalLocked();
    [PreserveSig] int get_SignalLocked([MarshalAs(UnmanagedType.U1)] out bool locked);
}
