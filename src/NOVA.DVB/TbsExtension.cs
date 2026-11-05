using System.Runtime.InteropServices;
using NOVA.Core;
using NOVA.Logging;

namespace NOVA.DVB;

/// <summary>
/// TBS BDA driver extension, reached through IKsPropertySet.
/// PCIe cards such as the TBS6902 expose it on the tuner filter's input pin.
/// USB cards expose it on the tuner filter under a different property set.
/// Property numbers and the buffer layout follow what the TBS drivers are known to accept;
/// they need confirming on a real card.
/// </summary>
internal sealed class TbsExtension : IVendorExtension
{
    private static readonly Guid PcieSet = new("FAA8F3E5-31D4-4E41-88EF-D9EB716F6EC9");
    private static readonly Guid UsbSet = new("C6EFE5EB-855A-4F1B-B7AA-87B5E1DC4113");

    private const int PropNbcParams = 10, PropAccessPcie = 21, PropAccessUsb = 18;
    private const int AccessSize = 0x218, NbcSize = 20;
    private const int ModeLnbPower = 0, ModeDiseqc = 1, ModeTone = 2;
    private const int OffMode = 0, OffTone = 4, OffLnb = 12, OffTx = 16, OffTxLen = 144;
    private const int MaxDiseqc = 0x80;
    private const int ToneOff = 0, ToneOn = 1, PowerOff = 0, PowerOn = 3;
    private const int ModNbcQpsk = 31, ModNbc8Psk = 32, ModQpsk = 20;

    private readonly IKsPropertySet _props;
    private readonly IntPtr _buffer;
    private readonly int _accessProp;
    private readonly bool _nbc;
    private Guid _set;

    public string Id => "tbs";

    private TbsExtension(IKsPropertySet props, Guid set, int accessProp)
    {
        _props = props;
        _set = set;
        _accessProp = accessProp;
        _buffer = Marshal.AllocCoTaskMem(AccessSize);
        if (props.QuerySupported(ref _set, PropNbcParams, out int support) == 0 && (support & 2) != 0) _nbc = true;
    }

    public static TbsExtension? TryCreate(IBaseFilter tuner, string name)
    {
        if (!name.Contains("TBS", StringComparison.OrdinalIgnoreCase) && !name.Contains("QBOX", StringComparison.OrdinalIgnoreCase))
            return null;
        var pcie = PcieSet;
        foreach (var pin in Bda.Pins(tuner, input: true))
        {
            if (pin is IKsPropertySet p && p.QuerySupported(ref pcie, PropAccessPcie, out _) == 0)
            {
                Log.Info($"TBS extension found on the tuner input pin of {name}");
                return new TbsExtension(p, PcieSet, PropAccessPcie);
            }
        }
        var usb = UsbSet;
        if (tuner is IKsPropertySet f && f.QuerySupported(ref usb, 1, out _) == 0)
        {
            Log.Info($"TBS USB extension found on {name}");
            return new TbsExtension(f, UsbSet, PropAccessUsb);
        }
        Log.Warn($"{name} looks like a TBS card but its extension did not answer");
        return null;
    }

    public void Fill(TunerCapabilities caps)
    {
        caps.RawDiseqc = caps.LnbPowerControl = caps.ToneControl = true;
        caps.Dvbs2Params = _nbc;
        caps.Extension = Id;
    }

    private void Clear()
    {
        for (int i = 0; i < AccessSize; i++) Marshal.WriteByte(_buffer, i, 0);
    }

    private bool Send(string what)
    {
        int hr = _props.Set(ref _set, _accessProp, _buffer, AccessSize, _buffer, AccessSize);
        if (hr != 0) Log.Warn($"TBS {what} failed, hr=0x{hr:X8}");
        return hr == 0;
    }

    public bool SendDiseqc(byte[] message)
    {
        if (message.Length is 0 or > MaxDiseqc) return false;
        Clear();
        Marshal.WriteInt32(_buffer, OffMode, ModeDiseqc);
        Marshal.Copy(message, 0, _buffer + OffTx, message.Length);
        Marshal.WriteInt32(_buffer, OffTxLen, message.Length);
        return Send("DiSEqC");
    }

    public bool SetLnbPower(bool on)
    {
        Clear();
        Marshal.WriteInt32(_buffer, OffMode, ModeLnbPower);
        Marshal.WriteInt32(_buffer, OffLnb, on ? PowerOn : PowerOff);
        return Send("LNB power");
    }

    public bool SetTone(bool on)
    {
        Clear();
        Marshal.WriteInt32(_buffer, OffMode, ModeTone);
        Marshal.WriteInt32(_buffer, OffTone, on ? ToneOn : ToneOff);
        return Send("22 kHz tone");
    }

    public bool SetDvbS2(int rollOff, bool pilot, int fecRate, int modulation)
    {
        if (!_nbc) return false;
        Clear();
        Marshal.WriteInt32(_buffer, 0, rollOff);
        Marshal.WriteInt32(_buffer, 4, pilot ? 1 : 0);
        Marshal.WriteInt32(_buffer, 8, 2);               // DVB-S2
        Marshal.WriteInt32(_buffer, 12, fecRate);
        Marshal.WriteInt32(_buffer, 16, modulation);
        int hr = _props.Set(ref _set, PropNbcParams, _buffer, NbcSize, _buffer, NbcSize);
        if (hr != 0) Log.Warn($"TBS DVB-S2 parameters failed, hr=0x{hr:X8}");
        return hr == 0;
    }

    public int ModulationFor(TuneRequest r)
    {
        bool s2 = r.Std != "DVB-S";
        if (!s2) return ModQpsk;
        return r.Mod == "QPSK" ? ModNbcQpsk : ModNbc8Psk;
    }

    public static int RollOffCode(string v) => v switch { "0.20" => 0, "0.25" => 1, "0.35" => 2, _ => 0xFF };

    public void Dispose()
    {
        Marshal.FreeCoTaskMem(_buffer);
    }
}
