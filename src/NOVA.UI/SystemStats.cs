using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace NOVA.UI;

/// <summary>Real CPU, memory and disk figures for the status bar.</summary>
internal sealed class SystemStats
{
    private ulong _idle, _kernel, _user;

    public string Read(string path)
    {
        var o = new JsonObject { ["evt"] = "stats" };
        if (GetSystemTimes(out var idle, out var kernel, out var user))
        {
            ulong i = idle.Value, k = kernel.Value, u = user.Value;
            ulong total = (k - _kernel) + (u - _user);
            if (_kernel != 0 && total > 0) o["cpu"] = (int)Math.Round(100.0 * (total - (i - _idle)) / total);
            (_idle, _kernel, _user) = (i, k, u);
        }
        var mem = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        if (GlobalMemoryStatusEx(ref mem)) o["ram"] = (int)mem.MemoryLoad;
        var drive = new DriveInfo(Path.GetPathRoot(path)!);
        o["drive"] = drive.Name.TrimEnd('\\');
        o["freeGb"] = Math.Round(drive.AvailableFreeSpace / 1073741824.0, 1);
        return o.ToJsonString();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime
    {
        public uint Low, High;
        public readonly ulong Value => ((ulong)High << 32) | Low;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatus
    {
        public uint Length, MemoryLoad;
        public ulong TotalPhys, AvailPhys, TotalPageFile, AvailPageFile, TotalVirtual, AvailVirtual, AvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetSystemTimes(out FileTime idle, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
}
