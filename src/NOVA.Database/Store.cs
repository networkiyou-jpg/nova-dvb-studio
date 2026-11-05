using Microsoft.Data.Sqlite;

namespace NOVA.Database;

/// <summary>Local SQLite storage. The file stays in the user's profile, so updates keep it.</summary>
public sealed class Store : IDisposable
{
    private const int SchemaVersion = 1;
    private readonly SqliteConnection _db;

    public Store(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        _db = new SqliteConnection($"Data Source={path}");
        _db.Open();
        Exec("PRAGMA journal_mode=WAL;");
        Exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL);");
        Migrate();
    }

    private void Migrate()
    {
        int current = int.TryParse(Get("schema_version"), out var v) ? v : 0;
        if (current < SchemaVersion) Set("schema_version", SchemaVersion.ToString());
    }

    public string? Get(string key)
    {
        using var c = _db.CreateCommand();
        c.CommandText = "SELECT value FROM kv WHERE key=$k";
        c.Parameters.AddWithValue("$k", key);
        return c.ExecuteScalar() as string;
    }

    public void Set(string key, string value)
    {
        using var c = _db.CreateCommand();
        c.CommandText = "INSERT INTO kv(key,value,updated) VALUES($k,$v,$t) ON CONFLICT(key) DO UPDATE SET value=$v, updated=$t";
        c.Parameters.AddWithValue("$k", key);
        c.Parameters.AddWithValue("$v", value);
        c.Parameters.AddWithValue("$t", DateTime.UtcNow.ToString("O"));
        c.ExecuteNonQuery();
    }

    private void Exec(string sql)
    {
        using var c = _db.CreateCommand();
        c.CommandText = sql;
        c.ExecuteNonQuery();
    }

    public void Dispose() => _db.Dispose();
}
