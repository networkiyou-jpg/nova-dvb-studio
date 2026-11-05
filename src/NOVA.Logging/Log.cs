using System.Text.RegularExpressions;

namespace NOVA.Logging;

/// <summary>Small rolling file log. Anything that looks like a password or key is masked before writing.</summary>
public static partial class Log
{
    private static readonly object Gate = new();
    private static string? _path;

    public static string Directory_ { get; private set; } = "";

    public static void Init(string appDataDir, string name, int keepDays = 14)
    {
        Directory_ = Path.Combine(appDataDir, "logs");
        Directory.CreateDirectory(Directory_);
        _path = Path.Combine(Directory_, $"{name}-{DateTime.Now:yyyyMMdd}.log");
        foreach (var f in new DirectoryInfo(Directory_).GetFiles("*.log"))
            if (f.LastWriteTime < DateTime.Now.AddDays(-keepDays))
                try { f.Delete(); } catch (IOException) { /* a file in use is removed next time */ }
    }

    public static void Info(string message) => Write("INF", message);
    public static void Warn(string message) => Write("WRN", message);
    public static void Error(string message, Exception? ex = null) => Write("ERR", ex is null ? message : $"{message}: {ex}");

    /// <summary>Masks values of password, pass, pwd and key fields, in JSON or key=value text.</summary>
    public static string Redact(string text) => SecretPattern().Replace(text, m => $"{m.Groups[1].Value}***");

    [GeneratedRegex("((?:\"?(?:password|passwd|pass|pwd|key)\"?\\s*[:=]\\s*\"?))[^\",\\s}]+", RegexOptions.IgnoreCase)]
    private static partial Regex SecretPattern();

    private static void Write(string level, string message)
    {
        if (_path is null) return;
        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {level} {Redact(message)}{Environment.NewLine}";
        lock (Gate)
        {
            try { File.AppendAllText(_path, line); } catch (IOException) { /* logging must never stop the app */ }
        }
    }
}
