; NOVA DVB Studio installer. Built by the GitHub workflow with Inno Setup.
#define AppVersion GetEnv("NOVA_VERSION")
#if AppVersion == ""
  #define AppVersion "0.2.0"
#endif

[Setup]
AppId={{6B1F2C57-3E0A-4D7E-9B55-5A3C7E2D9F10}
AppName=NOVA DVB Studio
AppVersion={#AppVersion}
AppPublisher=NOVA DVB Studio
DefaultDirName={autopf}\NOVA DVB Studio
DefaultGroupName=NOVA DVB Studio
UninstallDisplayIcon={app}\NOVADVBStudio.exe
SetupIconFile=..\src\NOVA.UI\Assets\nova.ico
OutputDir=..\artifacts
OutputBaseFilename=NOVA-DVB-Studio-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\NOVA DVB Studio"; Filename: "{app}\NOVADVBStudio.exe"
Name: "{group}\Uninstall NOVA DVB Studio"; Filename: "{uninstallexe}"
Name: "{autodesktop}\NOVA DVB Studio"; Filename: "{app}\NOVADVBStudio.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\NOVADVBStudio.exe"; Description: "Start NOVA DVB Studio"; Flags: nowait postinstall skipifsilent

; User data lives in %LOCALAPPDATA%\NOVA DVB Studio, so updates and uninstalling keep channels and settings.
