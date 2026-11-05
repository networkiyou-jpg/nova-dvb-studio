namespace NOVA.Core;

/// <summary>Builds raw DiSEqC messages. Framing byte E0 = command from master, no reply expected.</summary>
public static class Diseqc
{
    private const byte Master = 0xE0, AnySwitch = 0x10, Positioner = 0x31;

    /// <summary>DiSEqC 1.0 committed switch. Port 0..3 is A..D.</summary>
    public static byte[] Committed(int port, bool horizontal, bool highBand)
    {
        if (port is < 0 or > 3) throw new ArgumentOutOfRangeException(nameof(port));
        int data = 0xF0 | (port << 2) | (horizontal ? 2 : 0) | (highBand ? 1 : 0);
        return [Master, AnySwitch, 0x38, (byte)data];
    }

    /// <summary>DiSEqC 1.1 uncommitted switch. Port 0..15 is 1..16.</summary>
    public static byte[] Uncommitted(int port)
    {
        if (port is < 0 or > 15) throw new ArgumentOutOfRangeException(nameof(port));
        return [Master, AnySwitch, 0x39, (byte)(0xF0 | port)];
    }

    // DiSEqC 1.2 positioner commands
    public static byte[] MotorHalt() => [Master, Positioner, 0x60];
    public static byte[] MotorLimitsOff() => [Master, Positioner, 0x63];
    public static byte[] MotorLimitEast() => [Master, Positioner, 0x66];
    public static byte[] MotorLimitWest() => [Master, Positioner, 0x67];

    /// <summary>Drive east. 0 = continuous until halt, otherwise a number of small steps (1..127).</summary>
    public static byte[] MotorEast(int steps = 0) => [Master, Positioner, 0x68, StepByte(steps)];

    /// <summary>Drive west. 0 = continuous until halt, otherwise a number of small steps (1..127).</summary>
    public static byte[] MotorWest(int steps = 0) => [Master, Positioner, 0x69, StepByte(steps)];

    public static byte[] MotorStore(int position)
    {
        if (position is < 1 or > 255) throw new ArgumentOutOfRangeException(nameof(position));
        return [Master, Positioner, 0x6A, (byte)position];
    }

    /// <summary>Go to a stored position. Position 0 is the reference (zero) position.</summary>
    public static byte[] MotorGoto(int position)
    {
        if (position is < 0 or > 255) throw new ArgumentOutOfRangeException(nameof(position));
        return [Master, Positioner, 0x6B, (byte)position];
    }

    private static byte StepByte(int steps)
    {
        if (steps is < 0 or > 127) throw new ArgumentOutOfRangeException(nameof(steps));
        return steps == 0 ? (byte)0 : (byte)(0x100 - steps);
    }
}
