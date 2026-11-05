namespace NOVA.Core;

public sealed class LnbConfig
{
    public int LowMHz { get; set; } = 9750;
    public int HighMHz { get; set; } = 10600;
    public int SwitchMHz { get; set; } = 11700;

    public bool IsHighBand(int freqMHz) => SwitchMHz > 0 && freqMHz >= SwitchMHz;
    public int IntermediateMHz(int freqMHz) => Math.Abs(freqMHz - (IsHighBand(freqMHz) ? HighMHz : LowMHz));
}
