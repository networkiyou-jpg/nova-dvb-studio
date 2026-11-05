using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using NOVA.Core;

namespace NOVA.DVB;

/// <summary>Device enumeration and small DirectShow helpers.</summary>
public static class Bda
{
    private static readonly Guid PropertyBagIid = typeof(IPropertyBag).GUID;

    internal static T Create<T>(Guid clsid) where T : class
    {
        var type = Type.GetTypeFromCLSID(clsid, throwOnError: true)!;
        return (T)Activator.CreateInstance(type)!;
    }

    internal static void Check(int hr, string what)
    {
        if (hr < 0) throw new InvalidOperationException($"{what} failed (0x{hr:X8})");
    }

    internal static IEnumerable<(IMoniker Moniker, string Name, string Path)> Devices(Guid category)
    {
        var devEnum = Create<ICreateDevEnum>(Clsid.SystemDeviceEnum);
        int hr = devEnum.CreateClassEnumerator(ref category, out var monikers, 0);
        if (hr != 0 || monikers is null) yield break;      // S_FALSE: the category is empty
        var one = new IMoniker[1];
        while (monikers.Next(1, one, IntPtr.Zero) == 0)
        {
            var m = one[0];
            yield return (m, Property(m, "FriendlyName"), Property(m, "DevicePath"));
        }
    }

    private static string Property(IMoniker moniker, string name)
    {
        var iid = PropertyBagIid;
        moniker.BindToStorage(null!, null!, ref iid, out var bag);
        if (bag is IPropertyBag pb && pb.Read(name, out var value, IntPtr.Zero) == 0)
            return value as string ?? "";
        return "";
    }

    internal static IBaseFilter Bind(IMoniker moniker)
    {
        var iid = typeof(IBaseFilter).GUID;
        moniker.BindToObject(null!, null!, ref iid, out var obj);
        return (IBaseFilter)obj;
    }

    internal static IEnumerable<IPin> Pins(IBaseFilter filter, bool input)
    {
        Check(filter.EnumPins(out var pins), "EnumPins");
        var one = new IPin?[1];
        while (pins.Next(1, one, IntPtr.Zero) == 0 && one[0] is { } pin)
        {
            pin.QueryDirection(out int dir);
            if ((dir == 0) == input) yield return pin;
        }
    }

    private static bool IsConnected(IPin pin) => pin.ConnectedTo(out _) == 0;

    /// <summary>Connects the first compatible free pin pair. Medium checks keep tuner A with capture A.</summary>
    internal static bool Connect(IGraphBuilder graph, IBaseFilter from, IBaseFilter to)
    {
        foreach (var o in Pins(from, input: false).Where(p => !IsConnected(p)).ToList())
            foreach (var i in Pins(to, input: true).Where(p => !IsConnected(p)).ToList())
            {
                if (graph.ConnectDirect(o, i, IntPtr.Zero) >= 0) return true;
                if (graph.Connect(o, i) >= 0) return true;
            }
        return false;
    }

    /// <summary>Lists the satellite tuners Windows reports. Never invents one.</summary>
    public static List<TunerInfo> ListTuners()
    {
        var list = new List<TunerInfo>();
        int i = 0;
        foreach (var (_, name, path) in Devices(Category.BdaNetworkTuner))
            list.Add(new TunerInfo { Index = i++, Name = name, Path = path, Maker = Maker(name) });
        return list;
    }

    private static string Maker(string name)
    {
        var n = name.ToUpperInvariant();
        if (n.Contains("TBS") || n.Contains("QBOX")) return "TurboSight (TBS)";
        if (n.Contains("DIGITAL DEVICES") || n.Contains("DD ")) return "Digital Devices";
        if (n.Contains("PROF")) return "Prof";
        return "";
    }

    internal static void Release(object? com)
    {
        if (com != null && Marshal.IsComObject(com)) Marshal.ReleaseComObject(com);
    }
}
