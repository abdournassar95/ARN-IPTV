; ==============================================================================
; Inno Setup 6 Script — ARN IPTV Pro Setup
; Company: ARN Technology
; Development & Programming: Abdo Ragab Nassar (عبده رجب نصار © 2026)
; WhatsApp: +201556710314 | Telegram: ABDOURNASSAR95
; ==============================================================================

#define MyAppName "ARN IPTV Pro"
#define MyAppVersion "2.6.0"
#define MyAppPublisher "ARN Technology — عبده رجب نصار"
#define MyAppURL "https://wa.me/201556710314"
#define MyAppExeName "ARN IPTV Pro.exe"

[Setup]
AppId={{C7829A41-B892-4C10-91E4-90B8E1D45B01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\ARN Technology\{#MyAppName}
DefaultGroupName=ARN Technology\{#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=LICENSE
OutputDir=dist\setup
OutputBaseFilename=ARN_IPTV_Pro_Setup_v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSmallImageFile=public\assets\icons\app_icon.ico
SetupIconFile=public\assets\icons\app_icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
ShowLanguageDialog=no
LanguageDetectionMethod=uilanguage

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
Source: "release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "cert\*"; DestDir: "{app}\cert"; Flags: ignoreversion recursesubdirs createallsubdirs; Permissions: everyone-full
Source: "public\assets\icons\app_icon.ico"; DestDir: "{app}\resources"; Flags: ignoreversion
Source: "LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\resources\app_icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\resources\app_icon.ico"; Tasks: desktopicon

[Run]
; Auto-install ARN Technology certificate into Trusted Store silently before first launch
Filename: "certutil.exe"; Parameters: "-addstore -f ""Root"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "جاري توثيق شهادة أمان ARN Technology..."; Flags: runhidden waituntilterminated
Filename: "certutil.exe"; Parameters: "-addstore -f ""TrustedPublisher"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "جاري توثيق ناشر التطبيق في قائمة الناشرين الموثوقين..."; Flags: runhidden waituntilterminated
; Launch application
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "taskkill.exe"; Parameters: "/F /IM ""{#MyAppExeName}"""; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\*"
