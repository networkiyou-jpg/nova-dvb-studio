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

    public event Action<string>? StateChanged;

    public TvPlayer(IntPtr hwnd, bool hardwareDecoding)
    {
        VlcCore.Initialize();
        _vlc = new LibVLC(
            "--no-osd", "--no-video-title-show", "--no-snapshot-preview", "--quiet",
            "--network-caching=600", "--live-caching=600", "--clock-jitter=0", "--clock-synchro=0",
            hardwareDecoding ? "--avcodec-hw=d3d11va" : "--avcodec-hw=none");
        _player = new MediaPlayer(_vlc) { Hwnd = hwnd, EnableHardwareDecoding = hardwareDecoding, EnableKeyInput = false, EnableMouseInput = false };
        _player.Playing += (_, _) => StateChanged?.Invoke("playing");
        _player.EncounteredError += (_, _) => StateChanged?.Invoke("error");
        _player.EndReached += (_, _) => StateChanged?.Invoke("ended");
    }

    public void Push(byte[] data, int length) => _ring?.Push(data, length);

    public void Play(int serviceId)
    {
        Stop();
        _ring = new TsRingStream();
        _media = new VlcMedia(_vlc, new StreamMediaInput(_ring), ":demux=ts", $":program={serviceId}", ":deinterlace=1", ":deinterlace-mode=yadif");
        _player.Play(_media);
        Log.Info($"Playing service {serviceId}");
    }

    public void PlayFile(string path)
    {
        Stop();
        _media = new VlcMedia(_vlc, new Uri(path), ":deinterlace=1", ":deinterlace-mode=yadif");
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

    public void SetVolume(int volume) => _player.Volume = Math.Clamp(volume, 0, 100);
    public void SetMute(bool mute) => _player.Mute = mute;
    public void SetAudioTrack(int id) => _player.SetAudioTrack(id);
    public void SetSubtitle(int id) => _player.SetSpu(id);

    public void SetAspect(string mode)
    {
        _player.AspectRatio = mode == "Fill" ? null : mode;
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
