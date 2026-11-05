using NOVA.Core;
using Xunit;

namespace NOVA.Tests;

public class DiseqcTests
{
    [Theory]
    [InlineData(0, false, false, 0xF0)]
    [InlineData(0, true, true, 0xF3)]
    [InlineData(1, true, false, 0xF6)]
    [InlineData(2, false, true, 0xF9)]
    [InlineData(3, true, true, 0xFF)]
    public void Committed_switch_bits(int port, bool horizontal, bool high, byte data) =>
        Assert.Equal(new byte[] { 0xE0, 0x10, 0x38, data }, Diseqc.Committed(port, horizontal, high));

    [Theory]
    [InlineData(0, 0xF0)]
    [InlineData(15, 0xFF)]
    public void Uncommitted_switch(int port, byte data) =>
        Assert.Equal(new byte[] { 0xE0, 0x10, 0x39, data }, Diseqc.Uncommitted(port));

    [Fact]
    public void Motor_commands()
    {
        Assert.Equal(new byte[] { 0xE0, 0x31, 0x60 }, Diseqc.MotorHalt());
        Assert.Equal(new byte[] { 0xE0, 0x31, 0x68, 0x00 }, Diseqc.MotorEast());
        Assert.Equal(new byte[] { 0xE0, 0x31, 0x69, 0xFF }, Diseqc.MotorWest(1));
        Assert.Equal(new byte[] { 0xE0, 0x31, 0x6A, 0x05 }, Diseqc.MotorStore(5));
        Assert.Equal(new byte[] { 0xE0, 0x31, 0x6B, 0x00 }, Diseqc.MotorGoto(0));
    }

    [Fact]
    public void Out_of_range_ports_are_refused()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Diseqc.Committed(4, false, false));
        Assert.Throws<ArgumentOutOfRangeException>(() => Diseqc.Uncommitted(16));
        Assert.Throws<ArgumentOutOfRangeException>(() => Diseqc.MotorStore(0));
    }

    [Theory]
    [InlineData(11600, false, 1850)]
    [InlineData(11747, true, 1147)]
    [InlineData(12245, true, 1645)]
    public void Universal_lnb(int freq, bool high, int intermediate)
    {
        var lnb = new LnbConfig();
        Assert.Equal(high, lnb.IsHighBand(freq));
        Assert.Equal(intermediate, lnb.IntermediateMHz(freq));
    }
}
