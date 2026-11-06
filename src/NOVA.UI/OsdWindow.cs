using System.IO;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using NOVA.Logging;
using Shapes = System.Windows.Shapes;

namespace NOVA.UI;

/// <summary>
/// The info bar over the live picture. The picture is a native LibVLC window, so the banner that the
/// interface draws in HTML cannot appear on top of it. This transparent window does instead: it is owned
/// by the video window, so Windows keeps it above the picture. The interface sends translated, ready text;
/// this class only lays it out. Design size is 1600 x 414 and a Viewbox scales it to the picture width.
/// </summary>
internal sealed class OsdWindow : Window
{
    private const double DesignW = 1600, DesignH = 414;
    private static readonly Color White = Colors.White;
    private readonly string _piconDir;
    private readonly FontFamily _font;
    private readonly FontFamily _glyphs = new("Segoe MDL2 Assets");

    private readonly Border _panel = new(), _logoTile = new(), _numPill = new(), _epgBox = new(), _sigBox = new();
    private readonly Image _logo = new() { Stretch = Stretch.Uniform, Margin = new Thickness(30) };
    private readonly Border _logoFallback = new() { CornerRadius = new CornerRadius(18), Margin = new Thickness(38, 70, 38, 70) };
    private readonly TextBlock _logoCode = new(), _star = new(), _num = new(), _name = new(), _accessGlyph = new(), _access = new();
    private readonly StackPanel _badges = new() { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
    private readonly TextBlock _time = new(), _date = new();
    private readonly TextBlock _nowTime = new(), _nowTitle = new(), _nowLeft = new(), _nextTime = new(), _nextTitle = new(), _noEpg = new();
    private readonly ColumnDefinition _progDone = new(), _progRest = new();
    private readonly Grid _epgRows = new();
    private readonly TextBlock _sat = new(), _tp = new();
    private readonly Meter _snr, _agc;
    private readonly OsdButton _audio, _sub, _txt;

    private bool _want, _videoVisible, _shown;
    private double _x, _y, _w, _h, _dpr = 1;
    private string _logoKey = "";
    private double _share = 0.46;

    /// <summary>"audio", "sub" or "txt" when the viewer clicks a button on the bar.</summary>
    public event Action<string>? ActionRequested;

    public OsdWindow(IntPtr owner, string piconDir)
    {
        _piconDir = piconDir;
        var fonts = Path.Combine(AppContext.BaseDirectory, "wwwroot", "fonts") + Path.DirectorySeparatorChar;
        _font = new FontFamily(new Uri(fonts), "./#IBM Plex Sans Arabic, Segoe UI");
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        ShowActivated = false;
        Focusable = false;
        FontFamily = _font;
        Width = 800;
        Height = 207;
        _snr = new Meter(this);
        _agc = new Meter(this);
        _audio = new OsdButton(this, "\uE767", () => ActionRequested?.Invoke("audio"));
        _sub = new OsdButton(this, "\uE7F0", () => ActionRequested?.Invoke("sub"));
        _txt = new OsdButton(this, "\uE8A5", () => ActionRequested?.Invoke("txt"));
        Content = new Viewbox { Stretch = Stretch.Uniform, Child = Build() };
        new WindowInteropHelper(this) { Owner = owner }.EnsureHandle();
    }

    // ---------- Layout ----------

    private TextBlock Text(TextBlock t, double size, Color color, FontWeight weight)
    {
        t.FontFamily = _font;
        t.FontSize = size;
        t.Foreground = new SolidColorBrush(color);
        t.FontWeight = weight;
        t.VerticalAlignment = VerticalAlignment.Center;
        t.TextTrimming = TextTrimming.CharacterEllipsis;
        return t;
    }

    private TextBlock Glyph(TextBlock t, string glyph, double size, Color color)
    {
        t.FontFamily = _glyphs;
        t.Text = glyph;
        t.FontSize = size;
        t.Foreground = new SolidColorBrush(color);
        t.VerticalAlignment = VerticalAlignment.Center;
        return t;
    }

    private static T At<T>(T el, int row, int col, int rowSpan = 1, int colSpan = 1) where T : UIElement
    {
        Grid.SetRow(el, row);
        Grid.SetColumn(el, col);
        if (rowSpan > 1) Grid.SetRowSpan(el, rowSpan);
        if (colSpan > 1) Grid.SetColumnSpan(el, colSpan);
        return el;
    }

    private static Grid Cols(params GridLength[] widths)
    {
        var g = new Grid();
        foreach (var w in widths) g.ColumnDefinitions.Add(new ColumnDefinition { Width = w });
        return g;
    }

    private static GridLength Px(double v) => new(v);
    private static GridLength Star(double v = 1) => new(v, GridUnitType.Star);
    private static readonly GridLength Auto = GridLength.Auto;

    private static Shapes.Path StrokeIcon(string data, Color color) => new()
    {
        Data = Geometry.Parse(data),
        Stroke = new SolidColorBrush(color),
        StrokeThickness = 2,
        StrokeStartLineCap = PenLineCap.Round,
        StrokeEndLineCap = PenLineCap.Round,
        StrokeLineJoin = PenLineJoin.Round,
        Stretch = Stretch.Uniform,
        Width = 30,
        Height = 30,
        Margin = new Thickness(0, 0, 12, 0),
        VerticalAlignment = VerticalAlignment.Center,
    };

    private static Border Separator() => new()
    {
        Width = 1.5,
        Background = new SolidColorBrush(Color.FromArgb(0x30, 0xFF, 0xFF, 0xFF)),
        Margin = new Thickness(0, 12, 0, 12),
    };

    private UIElement Build()
    {
        var root = new Grid { Width = DesignW, Height = DesignH };
        _panel.CornerRadius = new CornerRadius(30);
        _panel.BorderThickness = new Thickness(2.5);
        _panel.Margin = new Thickness(14);
        _panel.Background = new LinearGradientBrush(Color.FromArgb(0xF0, 0x16, 0x11, 0x34), Color.FromArgb(0xF4, 0x09, 0x09, 0x1C), 90);
        root.Children.Add(_panel);

        var g = new Grid { Margin = new Thickness(18, 16, 22, 14) };
        foreach (var w in new[] { Px(300), Px(18), Star() }) g.ColumnDefinitions.Add(new ColumnDefinition { Width = w });
        foreach (var h in new[] { Px(92), Px(8), Px(132), Px(10), Px(58), Px(8), Px(48) }) g.RowDefinitions.Add(new RowDefinition { Height = h });
        _panel.Child = g;

        // Channel logo tile with the favorite star
        _logoTile.CornerRadius = new CornerRadius(28);
        _logoTile.BorderThickness = new Thickness(2.5);
        _logoTile.Background = new RadialGradientBrush(Color.FromRgb(0x36, 0x27, 0x86), Color.FromRgb(0x11, 0x0B, 0x31));
        var tile = new Grid();
        RenderOptions.SetBitmapScalingMode(_logo, BitmapScalingMode.HighQuality);
        _logoFallback.Child = Text(_logoCode, 64, White, FontWeights.Bold);
        _logoCode.HorizontalAlignment = HorizontalAlignment.Center;
        tile.Children.Add(_logoFallback);
        tile.Children.Add(_logo);
        Glyph(_star, "\uE735", 40, Color.FromRgb(0xFF, 0xC5, 0x31));
        _star.HorizontalAlignment = HorizontalAlignment.Left;
        _star.VerticalAlignment = VerticalAlignment.Top;
        _star.Margin = new Thickness(18, 16, 0, 0);
        tile.Children.Add(_star);
        _logoTile.Child = tile;
        g.Children.Add(At(_logoTile, 0, 0, rowSpan: 5));

        g.Children.Add(At(BuildHeader(), 0, 2));
        g.Children.Add(At(BuildEpg(), 2, 2));
        g.Children.Add(At(BuildSignal(), 4, 2));

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(14, 0, 0, 0) };
        buttons.Children.Add(_audio.Root);
        buttons.Children.Add(_sub.Root);
        buttons.Children.Add(_txt.Root);
        g.Children.Add(At(buttons, 6, 0, colSpan: 3));
        return root;
    }

    private UIElement BuildHeader()
    {
        var h = Cols(Auto, Px(18), Star(), Auto, Px(20), Px(2), Px(22), Auto);
        _numPill.CornerRadius = new CornerRadius(30, 8, 30, 8);
        _numPill.Height = 62;
        _numPill.Padding = new Thickness(26, 0, 30, 0);
        _numPill.VerticalAlignment = VerticalAlignment.Center;
        _numPill.Child = Text(_num, 40, White, FontWeights.Bold);
        h.Children.Add(At(_numPill, 0, 0));

        var id = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        id.Children.Add(Text(_name, 44, White, FontWeights.SemiBold));
        var acc = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(2, 2, 0, 0) };
        Glyph(_accessGlyph, "\uE785", 22, Colors.LimeGreen);
        _accessGlyph.Margin = new Thickness(0, 0, 10, 0);
        acc.Children.Add(_accessGlyph);
        acc.Children.Add(Text(_access, 26, White, FontWeights.Medium));
        id.Children.Add(acc);
        h.Children.Add(At(id, 0, 2));

        h.Children.Add(At(_badges, 0, 3));
        h.Children.Add(At(new Border { Background = new SolidColorBrush(Color.FromArgb(0x60, 0xB0, 0x8C, 0xFF)), Margin = new Thickness(0, 6, 0, 6) }, 0, 5));

        var clock = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        Text(_time, 50, White, FontWeights.Bold).HorizontalAlignment = HorizontalAlignment.Right;
        clock.Children.Add(_time);
        var day = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        day.Children.Add(Glyph(new TextBlock { Margin = new Thickness(0, 0, 10, 0) }, "\uE787", 22, Color.FromRgb(0xB9, 0xA8, 0xFF)));
        day.Children.Add(Text(_date, 23, Color.FromRgb(0xE4, 0xE7, 0xF3), FontWeights.Medium));
        clock.Children.Add(day);
        h.Children.Add(At(clock, 0, 7));
        return h;
    }

    private UIElement BuildEpg()
    {
        _epgBox.CornerRadius = new CornerRadius(18);
        _epgBox.BorderThickness = new Thickness(1.5);
        _epgBox.Background = new SolidColorBrush(Color.FromArgb(0x40, 0x08, 0x08, 0x1A));
        var outer = new Grid();
        _epgRows.RowDefinitions.Add(new RowDefinition { Height = Star() });
        _epgRows.RowDefinitions.Add(new RowDefinition { Height = Star() });

        var nowBg = new Border { CornerRadius = new CornerRadius(17, 17, 0, 0) };
        nowBg.Background = new LinearGradientBrush(Color.FromArgb(0x70, 0x3B, 0x2A, 0xA6), Color.FromArgb(0x30, 0x22, 0x18, 0x55), 0);
        _epgRows.Children.Add(At(nowBg, 0, 0));
        var now = Cols(Px(250), Star(), Auto);
        now.Margin = new Thickness(40, 0, 0, 0);
        now.Children.Add(At(Text(_nowTime, 28, Color.FromRgb(0xEE, 0xF0, 0xF8), FontWeights.Medium), 0, 0));
        var mid = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        mid.Children.Add(Text(_nowTitle, 30, White, FontWeights.SemiBold));
        var bar = new Grid { Height = 10, Margin = new Thickness(0, 8, 0, 0) };
        bar.Children.Add(new Border { CornerRadius = new CornerRadius(5), Background = new SolidColorBrush(Color.FromArgb(0x38, 0xFF, 0xFF, 0xFF)) });
        var fill = new Grid();
        fill.ColumnDefinitions.Add(_progDone);
        fill.ColumnDefinitions.Add(_progRest);
        fill.Children.Add(new Border { CornerRadius = new CornerRadius(5), Background = new LinearGradientBrush(Color.FromRgb(0xC0, 0x4E, 0xE6), Color.FromRgb(0x8A, 0x5C, 0xF6), 0) });
        bar.Children.Add(fill);
        mid.Children.Add(bar);
        now.Children.Add(At(mid, 0, 1));
        Text(_nowLeft, 28, Color.FromRgb(0xB9, 0xA8, 0xFF), FontWeights.SemiBold).Margin = new Thickness(26, 0, 26, 0);
        now.Children.Add(At(_nowLeft, 0, 2));
        _epgRows.Children.Add(At(now, 0, 0));

        _epgRows.Children.Add(At(new Border { Height = 1.5, VerticalAlignment = VerticalAlignment.Top, Background = new SolidColorBrush(Color.FromArgb(0x28, 0xFF, 0xFF, 0xFF)) }, 1, 0));
        var next = Cols(Px(250), Star());
        next.Margin = new Thickness(40, 0, 26, 0);
        next.Children.Add(At(Text(_nextTime, 28, Color.FromRgb(0xCF, 0xD4, 0xE6), FontWeights.Medium), 0, 0));
        next.Children.Add(At(Text(_nextTitle, 30, Color.FromRgb(0xF3, 0xF5, 0xFA), FontWeights.Medium), 0, 1));
        _epgRows.Children.Add(At(next, 1, 0));

        outer.Children.Add(_epgRows);
        Text(_noEpg, 28, Color.FromRgb(0xA3, 0xAD, 0xC2), FontWeights.Medium).HorizontalAlignment = HorizontalAlignment.Center;
        outer.Children.Add(_noEpg);
        _epgBox.Child = outer;
        return _epgBox;
    }

    private UIElement BuildSignal()
    {
        _sigBox.CornerRadius = new CornerRadius(16);
        _sigBox.BorderThickness = new Thickness(1);
        _sigBox.BorderBrush = new SolidColorBrush(Color.FromArgb(0x22, 0xFF, 0xFF, 0xFF));
        _sigBox.Background = new SolidColorBrush(Color.FromArgb(0x1E, 0xFF, 0xFF, 0xFF));
        var row = Cols(Auto, Auto, Auto, Auto, Star(), Auto, Star());
        row.Margin = new Thickness(22, 0, 22, 0);

        var sat = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 22, 0) };
        sat.Children.Add(StrokeIcon("M4,10 A7.31,7.31 0 0 0 14,20 Z M9,15 L12,12 M17,13 A6,6 0 0 0 11,7 M21,13 A10,10 0 0 0 11,3", Color.FromRgb(0x9E, 0xB0, 0xFF)));
        sat.Children.Add(Text(_sat, 27, Color.FromRgb(0xE6, 0xE9, 0xF5), FontWeights.Medium));
        row.Children.Add(At(sat, 0, 0));
        row.Children.Add(At(Separator(), 0, 1));

        var tp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(22, 0, 22, 0) };
        tp.Children.Add(StrokeIcon("M4.9,16.1 A10,10 0 0 1 4.9,2.9 M7.8,13.2 A6,6 0 0 1 7.8,5.8 M16.2,5.8 A6,6 0 0 1 16.2,13.2 M19.1,2.9 A10,10 0 0 1 19.1,16.1 M12,11 L12,21 M9,21 L15,21 M10.5,9.5 A1.5,1.5 0 1 0 13.5,9.5 A1.5,1.5 0 1 0 10.5,9.5", Color.FromRgb(0x5F, 0xA8, 0xFF)));
        tp.Children.Add(Text(_tp, 27, Color.FromRgb(0x7F, 0xB8, 0xFF), FontWeights.Medium));
        row.Children.Add(At(tp, 0, 2));
        row.Children.Add(At(Separator(), 0, 3));
        _snr.Root.Margin = new Thickness(22, 0, 22, 0);
        row.Children.Add(At(_snr.Root, 0, 4));
        row.Children.Add(At(Separator(), 0, 5));
        _agc.Root.Margin = new Thickness(22, 0, 0, 0);
        row.Children.Add(At(_agc.Root, 0, 6));
        _sigBox.Child = row;
        return _sigBox;
    }

    // ---------- Data ----------

    private static string Str(JsonNode? o, string key) => o is JsonObject j && j[key] is JsonValue v && v.TryGetValue(out string? s) ? s ?? "" : "";
    private static bool Bool(JsonNode? o, string key) => o is JsonObject j && j[key] is JsonValue v && v.TryGetValue(out bool b) && b;
    private static double? Num(JsonNode? o, string key) => o is JsonObject j && j[key] is JsonValue v && v.TryGetValue(out double d) ? d : null;

    private static Color ColorOf(string text, Color fallback)
    {
        try { return string.IsNullOrEmpty(text) ? fallback : (Color)ColorConverter.ConvertFromString(text); }
        catch (FormatException) { return fallback; }
    }

    /// <summary>New content from the interface, and whether the bar should be visible.</summary>
    public void Update(JsonObject? d, bool show)
    {
        _want = show && d is not null;
        if (d is not null) Apply(d);
        Sync();
    }

    private void Apply(JsonObject d)
    {
        var accent = ColorOf(Str(d, "accent"), Color.FromRgb(0x78, 0x68, 0xF0));
        var accent2 = ColorOf(Str(d, "accent2"), Color.FromRgb(0x28, 0xB8, 0xFF));
        var edge = new LinearGradientBrush(new GradientStopCollection
        {
            new(accent, 0), new(accent2, 0.5), new(accent, 1),
        }, 0);
        _panel.BorderBrush = edge;
        _panel.Effect = new DropShadowEffect { Color = accent, BlurRadius = 26, ShadowDepth = 0, Opacity = 0.7 };
        _logoTile.BorderBrush = new LinearGradientBrush(accent, accent2, 45);
        _logoTile.Effect = new DropShadowEffect { Color = accent, BlurRadius = 18, ShadowDepth = 0, Opacity = 0.55 };
        _numPill.Background = new LinearGradientBrush(accent, Color.FromRgb((byte)(accent.R * 0.55), (byte)(accent.G * 0.55), (byte)(accent.B * 0.55)), 0);
        _epgBox.BorderBrush = new SolidColorBrush(Color.FromArgb(0x55, accent.R, accent.G, accent.B));

        // Share of the picture width: small by default so the bar never hides the picture.
        _share = Str(d, "size") switch { "normal" => 0.6, "large" => 0.78, _ => 0.46 };
        _num.Text = Str(d, "num");
        _name.Text = Str(d, "name");
        _star.Visibility = Bool(d, "fav") ? Visibility.Visible : Visibility.Collapsed;
        bool fta = Bool(d, "fta");
        _accessGlyph.Text = fta ? "\uE785" : "\uE72E";
        var accColor = fta ? Color.FromRgb(0x3D, 0xDC, 0x84) : Color.FromRgb(0xFF, 0x6B, 0x78);
        _accessGlyph.Foreground = new SolidColorBrush(accColor);
        _access.Foreground = new SolidColorBrush(accColor);
        _access.Text = Str(d, "access");

        _badges.Children.Clear();
        foreach (var b in (d["badges"] as JsonArray) ?? new JsonArray())
            _badges.Children.Add(Badge(Str(b, "t"), Str(b, "k")));

        _time.Text = Str(d, "time");
        _date.Text = Str(d, "date");

        var now = d["now"] as JsonObject;
        var next = d["next"] as JsonObject;
        bool hasEpg = now is not null || next is not null;
        _epgRows.Visibility = hasEpg ? Visibility.Visible : Visibility.Collapsed;
        _noEpg.Visibility = hasEpg ? Visibility.Collapsed : Visibility.Visible;
        _noEpg.Text = Str(d, "noEpg");
        _nowTime.Text = Str(now, "time");
        _nowTitle.Text = now is null ? "—" : Str(now, "title");
        _nowLeft.Text = Str(now, "left");
        double pct = Math.Clamp(Num(now, "pct") ?? 0, 0, 100);
        _progDone.Width = Star(Math.Max(pct, 0.001));
        _progRest.Width = Star(Math.Max(100 - pct, 0.001));
        _nextTime.Text = Str(next, "time");
        _nextTitle.Text = next is null ? "—" : Str(next, "title");

        _sat.Text = Str(d, "sat");
        _tp.Text = Str(d, "tp");
        _snr.Set(d["snr"]);
        _agc.Set(d["agc"]);
        _audio.Set(d["audio"]);
        _sub.Set(d["sub"]);
        _txt.Set(d["txt"]);
        SetLogo(d["picon"] as JsonObject);
    }

    private Border Badge(string text, string kind)
    {
        var (edge, fg) = kind switch
        {
            "q" => (Color.FromRgb(0x3D, 0x8B, 0xFF), Color.FromRgb(0x8F, 0xC0, 0xFF)),
            "res" => (Color.FromRgb(0xE8, 0xB3, 0x3A), Color.FromRgb(0xFF, 0xCB, 0x52)),
            _ => (Color.FromArgb(0x60, 0xFF, 0xFF, 0xFF), Color.FromRgb(0xE6, 0xE9, 0xF5)),
        };
        var t = Text(new TextBlock { Text = text }, 28, fg, FontWeights.Bold);
        if (kind == "q") t.FontStyle = FontStyles.Italic;
        return new Border
        {
            CornerRadius = new CornerRadius(12),
            BorderThickness = new Thickness(2),
            BorderBrush = new SolidColorBrush(edge),
            Background = new SolidColorBrush(Color.FromArgb(0x70, 0x0E, 0x14, 0x2C)),
            Padding = new Thickness(14, 2, 14, 4),
            Margin = new Thickness(10, 0, 0, 0),
            VerticalAlignment = VerticalAlignment.Center,
            Child = t,
        };
    }

    private void SetLogo(JsonObject? p)
    {
        string src = Str(p, "src"), code = Str(p, "code");
        string key = $"{src}|{code}|{Str(p, "c1")}";
        if (key == _logoKey) return;
        _logoKey = key;
        _logo.Source = LoadImage(src);
        _logoFallback.Visibility = _logo.Source is null ? Visibility.Visible : Visibility.Collapsed;
        _logoCode.Text = code;
        _logoFallback.Background = new LinearGradientBrush(ColorOf(Str(p, "c1"), Color.FromRgb(0x3A, 0x46, 0x78)), ColorOf(Str(p, "c2"), Color.FromRgb(0x1D, 0x25, 0x47)), 30);
    }

    /// <summary>Logos come from the picon folder (https://picons.nova.app/...) or as PNG data. SVG data is left to the fallback tile.</summary>
    private ImageSource? LoadImage(string src)
    {
        if (string.IsNullOrEmpty(src)) return null;
        try
        {
            var bmp = new BitmapImage();
            if (src.StartsWith("https://picons.nova.app/", StringComparison.OrdinalIgnoreCase))
            {
                var name = Path.GetFileName(new Uri(src).AbsolutePath);
                var path = Path.Combine(_piconDir, name);
                if (!File.Exists(path) || path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase)) return null;
                bmp.BeginInit();
                bmp.UriSource = new Uri(path);
            }
            else if (src.StartsWith("data:image/png;base64,", StringComparison.OrdinalIgnoreCase) || src.StartsWith("data:image/jpeg;base64,", StringComparison.OrdinalIgnoreCase))
            {
                var bytes = Convert.FromBase64String(src[(src.IndexOf(',') + 1)..]);
                bmp.BeginInit();
                bmp.StreamSource = new MemoryStream(bytes);
            }
            else return null;
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.CreateOptions = BitmapCreateOptions.IgnoreImageCache;
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch (Exception ex) when (ex is IOException or NotSupportedException or FormatException or ArgumentException or InvalidOperationException)
        {
            Log.Warn($"Info bar logo: {ex.Message}");
            return null;
        }
    }

    // ---------- Placement ----------

    /// <summary>Called with the picture rectangle in screen pixels whenever the video window moves.</summary>
    public void Follow(double x, double y, double w, double h, double dpr, bool videoVisible)
    {
        (_x, _y, _w, _h, _dpr, _videoVisible) = (x, y, w, h, dpr <= 0 ? 1 : dpr, videoVisible);
        Sync();
    }

    private void Sync()
    {
        bool visible = _want && _videoVisible && _w > 200 && _h > 120;
        if (!visible)
        {
            if (_shown) { Hide(); _shown = false; }
            return;
        }
        double margin = Math.Round(_w * 0.02);
        double width = Math.Max(_w * _share, Math.Min(560 * _dpr, _w - margin * 2)), height = width * DesignH / DesignW;
        double maxH = _h * (_share > 0.7 ? 0.4 : 0.3);
        if (height > maxH)
        {
            height = maxH;
            width = height * DesignW / DesignH;
        }
        double left = _x + (_w - width) / 2, top = _y + _h - height - margin;
        Left = left / _dpr;
        Top = top / _dpr;
        Width = width / _dpr;
        Height = height / _dpr;
        if (_shown) return;
        Opacity = 0;
        Show();
        _shown = true;
        BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(180)));
    }

    // ---------- Parts ----------

    private sealed class Meter
    {
        private readonly TextBlock _label = new(), _value = new();
        private readonly ColumnDefinition _on = new(), _off = new();
        private readonly Grid _bar = new() { Height = 12, Margin = new Thickness(16, 0, 16, 0), VerticalAlignment = VerticalAlignment.Center };
        public Grid Root { get; } = Cols(Auto, Star(), Auto);

        public Meter(OsdWindow w)
        {
            Root.Children.Add(At(w.Text(_label, 27, Color.FromRgb(0xE6, 0xE9, 0xF5), FontWeights.SemiBold), 0, 0));
            _bar.Children.Add(new Border { CornerRadius = new CornerRadius(6), Background = new SolidColorBrush(Color.FromArgb(0x38, 0xFF, 0xFF, 0xFF)) });
            var fill = new Grid();
            fill.ColumnDefinitions.Add(_on);
            fill.ColumnDefinitions.Add(_off);
            fill.Children.Add(new Border { CornerRadius = new CornerRadius(6), Background = new LinearGradientBrush(Color.FromRgb(0x16, 0xB8, 0x5A), Color.FromRgb(0x4A, 0xE6, 0x86), 0) });
            _bar.Children.Add(fill);
            Root.Children.Add(At(_bar, 0, 1));
            Root.Children.Add(At(w.Text(_value, 27, Color.FromRgb(0xE6, 0xE9, 0xF5), FontWeights.SemiBold), 0, 2));
        }

        public void Set(JsonNode? m)
        {
            _label.Text = Str(m, "label");
            double? pct = Num(m, "pct");
            _value.Text = pct is double p ? $"{Math.Round(p)}%" : "—";
            double v = Math.Clamp(pct ?? 0, 0, 100);
            _on.Width = Star(Math.Max(v, 0.001));
            _off.Width = Star(Math.Max(100 - v, 0.001));
        }
    }

    private sealed class OsdButton
    {
        private static readonly Brush Normal = new SolidColorBrush(Color.FromArgb(0x26, 0xFF, 0xFF, 0xFF));
        private static readonly Brush Hover = new SolidColorBrush(Color.FromArgb(0x44, 0xFF, 0xFF, 0xFF));
        private readonly TextBlock _label = new(), _sub = new();
        public Border Root { get; } = new()
        {
            CornerRadius = new CornerRadius(24),
            Height = 48,
            Padding = new Thickness(20, 0, 22, 0),
            Margin = new Thickness(0, 0, 16, 0),
            BorderThickness = new Thickness(1.5),
            BorderBrush = new SolidColorBrush(Color.FromArgb(0x38, 0xFF, 0xFF, 0xFF)),
            Background = Normal,
            Cursor = Cursors.Hand,
        };

        public OsdButton(OsdWindow w, string glyph, Action click)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            row.Children.Add(w.Glyph(new TextBlock { Margin = new Thickness(0, 0, 12, 0) }, glyph, 24, Colors.White));
            row.Children.Add(w.Text(_label, 22, Colors.White, FontWeights.SemiBold));
            w.Text(_sub, 18, Color.FromRgb(0xAE, 0xB6, 0xCF), FontWeights.Medium).Margin = new Thickness(10, 0, 0, 0);
            row.Children.Add(_sub);
            Root.Child = row;
            Root.MouseEnter += (_, _) => Root.Background = Hover;
            Root.MouseLeave += (_, _) => Root.Background = Normal;
            Root.MouseLeftButtonUp += (_, e) => { e.Handled = true; click(); };
        }

        public void Set(JsonNode? b)
        {
            _label.Text = Str(b, "label");
            _sub.Text = Str(b, "sub");
            _sub.Visibility = _sub.Text.Length > 0 ? Visibility.Visible : Visibility.Collapsed;
            Root.Opacity = Bool(b, "on") ? 1 : 0.45;
        }
    }
}
