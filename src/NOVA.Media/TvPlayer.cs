using LibVLCSharp.Shared;
using NOVA.Logging;
using VlcMedia = LibVLCSharp.Shared.Media;
using VlcCore = LibVLCSharp.Shared.Core;

namespace NOVA.Media;

/// <summary>Plays the live transport stream with LibVLC into a window handle.</summary>
public sealed class TvPlayer : IDisposable
{
    private readonly LibVLC _vlc;
    private readonly MediaPlayer _player;
    private TsRingStream? _ring;
    private VlcMedia? _media;
    private int _volume = 40;
    private bool _mute;
    private string _aspect = "Fill";
    private int _windowWidth, _windowHeight;

    public event Action<string>? StateChanged;
    public event Action<int, int>? VideoSizeKnown;

    public TvPlayer(IntPtr hwnd, bool hardwareDecoding)
    {
        VlcCore.Initialize();
        _vlc = new LibVLC(
            "--no-osd", "--no-video-title-show", "--no-snapshot-preview", "--quiet",
            "--file-caching=1000", "--network-caching=1000", "--live-caching=1000",
            "--avcodec-skiploopfilter=0", "--no-skip-frames",
            hardwareDecoding ? "--avcodec-hw=d3d11va" : "--avcodec-hw=none");
        _player = new MediaPlayer(_vlc) { Hwnd = hwnd, EnableHardwareDecoding = hardwareDecoding, EnableKeyInput = false, EnableMouseInput = false };
        _player.Playing += (_, _) =>
        {
            StateChanged?.Invoke("playing");
            // LibVLC must not be called from its own event thread.
            ThreadPool.QueueUserWorkItem(_ => AfterStart());
        };
        _player.EncounteredError += (_, _) => StateChanged?.Invoke("error");
        _player.EndReached += (_, _) => StateChanged?.Invoke("ended");
    }

    /// <summary>Sound settings only stick once audio output exists, so they are applied again here.</summary>
    private void AfterStart()
    {
        _player.Volume = _volume;
        _player.Mute = _mute;
        Thread.Sleep(1500);
        uint width = 0, height = 0;
        if (_player.Size(0, ref width, ref height) && width > 0)
        {
            Log.Info($"Video size {width} x {height}");
            VideoSizeKnown?.Invoke((int)width, (int)height);
        }
    }

    public void Push(byte[] data, int length) => _ring?.Push(data, length);

    public void Play(int serviceId)
    {
        Stop();
        _ring = new TsRingStream();
        _media = new VlcMedia(_vlc, new StreamMediaInput(_ring), ":demux=ts", $":program={serviceId}", ":deinterlace=-1", ":deinterlace-mode=yadif2x");
        _player.Play(_media);
        Log.Info($"Playing service {serviceId}");
    }

    public void PlayFile(string path)
    {
        Stop();
        _media = new VlcMedia(_vlc, new Uri(path), ":deinterlace=-1", ":deinterlace-mode=yadif2x");
        _player.Play(_media);
    }

    public void Stop()
    {
        _ring?.Finish();
        _player.Stop();
        _media?.Dispose();
        _media = null;
        _ring = null;
    }

    public void SetVolume(int volume) => _player.Volume = _volume = Math.Clamp(volume, 0, 100);

    public void SetMute(bool mute)
    {
        _mute = mute;
        _player.Mute = mute;
    }

    public void SetAudioTrack(int id) => _player.SetAudioTrack(id);
    public void SetSubtitle(int id) => _player.SetSpu(id);

    public void SetAspect(string mode)
    {
        _aspect = mode;
        ApplyAspect();
    }

    public void SetWindowSize(int width, int height)
    {
        if (width == _windowWidth && height == _windowHeight) return;
        (_windowWidth, _windowHeight) = (width, height);
        ApplyAspect();
    }

    /// <summary>Fill crops to the window's shape, so the picture covers it without being stretched.</summary>
    private void ApplyAspect()
    {
        bool fill = _aspect == "Fill" && _windowWidth > 0 && _windowHeight > 0;
        _player.AspectRatio = _aspect == "Fill" ? null : _aspect;
        _player.CropGeometry = fill ? $"{_windowWidth}:{_windowHeight}" : null;
    }

    public IEnumerable<(int Id, string Name)> AudioTracks() => _player.AudioTrackDescription.Select(t => (t.Id, t.Name));
    public IEnumerable<(int Id, string Name)> Subtitles() => _player.SpuDescription.Select(t => (t.Id, t.Name));

    public void Dispose()
    {
        Stop();
        _player.Dispose();
        _vlc.Dispose();
    }
}
