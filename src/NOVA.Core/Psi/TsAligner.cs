namespace NOVA.Core.Psi;

/// <summary>Cuts an arbitrary byte stream into 188-byte packets, resynchronising on 0x47.</summary>
public sealed class TsAligner(Action<byte[], int> onPacket)
{
    public const int PacketSize = 188;
    private readonly byte[] _carry = new byte[PacketSize * 2];
    private int _carryLen;

    public void Feed(byte[] data, int length)
    {
        int pos = 0;
        if (_carryLen > 0)
        {
            int take = Math.Min(PacketSize - _carryLen, length);
            Buffer.BlockCopy(data, 0, _carry, _carryLen, take);
            _carryLen += take;
            pos = take;
            if (_carryLen < PacketSize) return;
            if (_carry[0] == 0x47) onPacket(_carry, 0);
            _carryLen = 0;
        }
        while (pos < length)
        {
            if (data[pos] != 0x47) { pos++; continue; }
            if (length - pos < PacketSize)
            {
                _carryLen = length - pos;
                Buffer.BlockCopy(data, pos, _carry, 0, _carryLen);
                return;
            }
            onPacket(data, pos);
            pos += PacketSize;
        }
    }
}
