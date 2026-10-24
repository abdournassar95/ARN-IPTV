; =============================================================================
; ARN IPTV Desktop Pro — Official Inno Setup Installer Script
; Developer & Owner: عبده رجب نصار — شركة ARN Technology © 2026
; =============================================================================

#define MyAppName "ARN IPTV Pro"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "ARN Technology — Abdo Ragab Nassar"
#define MyAppURL "https://github.com/abdournassar95/ARN-IPTV"
#define MyAppExeName "ARN IPTV Pro.exe"

[Setup]
AppId={{8E9A7410-4D32-4C61-B9A1-2026ARNIPTV02}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\ARN Technology\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=ARN-IPTV-Setup-v{#MyAppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "cert\ARN_Technology_Root.cer"; DestDir: "{app}\cert"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; تثبيت شهادة ARN Technology الرقمية تلقائياً في مخزن الجذر والناشرين الموثوقين عند توفرها
Filename: "certutil.exe"; Parameters: "-addstore -f ""Root"" ""{app}\cert\ARN_Technology_Root.cer"""; Flags: runhidden waituntilterminated; Check: FileExists(ExpandConstant('{app}\cert\ARN_Technology_Root.cer'))
Filename: "certutil.exe"; Parameters: "-addstore -f ""TrustedPublisher"" ""{app}\cert\ARN_Technology_Root.cer"""; Flags: runhidden waituntilterminated; Check: FileExists(ExpandConstant('{app}\cert\ARN_Technology_Root.cer'))
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent
