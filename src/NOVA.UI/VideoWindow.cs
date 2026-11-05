using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Web.WebView2.Wpf;

namespace NOVA.UI;

/// <summary>
/// A borderless window owned by the main window and kept exactly over the picture area of the interface.
/// LibVLC draws into it. A web view cannot show native video inside itself, so the interface reports
/// the picture rectangle and hides this window while a dialog or menu needs that area.
/// </summary>
internal sealed class VideoWindow : Window
{
    private const uint SwpNoActivate = 0x0010, SwpNoZOrder = 0x0004;
    private const int CornerRadius = 9;
    private readonly FrameworkElement _host;
    private double _x, _y, _w, _h, _dpr = 1;
    private bool _show;

    public IntPtr Handle { get; }

    public VideoWindow(Window owner, WebView2 host)
    {
        _host = host;
        Owner = owner;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        ShowActivated = false;
        Background = Brushes.Black;
        Width = 16;
        Height = 9;
        Handle = new WindowInteropHelper(this).EnsureHandle();
    }

    public void SetRect(double x, double y, double w, double h, double dpr, bool show)
    {
        (_x, _y, _w, _h, _dpr, _show) = (x, y, w, h, dpr, show);
        Reposition();
    }

    public void Reposition()
    {
        bool visible = _show && _w > 1 && _h > 1 && Owner?.WindowState != WindowState.Minimized;
        if (!visible)
        {
            if (IsVisible) Hide();
            return;
        }
        if (!IsVisible) Show();
        var origin = _host.PointToScreen(new Point(0, 0));
        int px = (int)Math.Round(origin.X + _x * _dpr), py = (int)Math.Round(origin.Y + _y * _dpr);
        int pw = (int)Math.Round(_w * _dpr), ph = (int)Math.Round(_h * _dpr);
        SetWindowPos(Handle, IntPtr.Zero, px, py, pw, ph, SwpNoActivate | SwpNoZOrder);
        int r = (int)(CornerRadius * _dpr) * 2;
        SetWindowRgn(Handle, CreateRoundRectRgn(0, 0, pw + 1, ph + 1, r, r), true);
    }

    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
    [DllImport("user32.dll")] private static extern int SetWindowRgn(IntPtr hwnd, IntPtr region, bool redraw);
    [DllImport("gdi32.dll")] private static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int w, int h);
}
