namespace NOVA.Media;

/// <summary>Bounded buffer between the engine pipe and LibVLC. Drops the oldest data if the player falls behind.</summary>
public sealed class TsRingStream(int capacity = 32 << 20) : Stream
{
    private readonly byte[] _buf = new byte[capacity];
    private readonly object _gate = new();
    private int _read, _count;
    private bool _closed;

    public void Push(byte[] data, int length)
    {
        lock (_gate)
        {
            if (_closed) return;
            if (length > _buf.Length) return;
            int overflow = _count + length - _buf.Length;
            if (overflow > 0)
            {
                _read = (_read + overflow) % _buf.Length;
                _count -= overflow;
            }
            int write = (_read + _count) % _buf.Length;
            int first = Math.Min(length, _buf.Length - write);
            Buffer.BlockCopy(data, 0, _buf, write, first);
            if (first < length) Buffer.BlockCopy(data, first, _buf, 0, length - first);
            _count += length;
            Monitor.PulseAll(_gate);
        }
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        lock (_gate)
        {
            while (_count == 0 && !_closed) Monitor.Wait(_gate, 500);
            if (_count == 0) return 0;
            int n = Math.Min(count, _count);
            int first = Math.Min(n, _buf.Length - _read);
            Buffer.BlockCopy(_buf, _read, buffer, offset, first);
            if (first < n) Buffer.BlockCopy(_buf, 0, buffer, offset + first, n - first);
            _read = (_read + n) % _buf.Length;
            _count -= n;
            return n;
        }
    }

    public void Finish()
    {
        lock (_gate)
        {
            _closed = true;
            Monitor.PulseAll(_gate);
        }
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
