; TockMate 自定义 NSIS 片段：注册 AppUserModelId，使系统通知横幅可以显示
!macro customInstall
  WriteRegStr HKCU "Software\Classes\AppUserModelId\${APP_ID}" "DisplayName" "TockMate"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\${APP_ID}" "ShowInSettings" 1
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\AppUserModelId\${APP_ID}"
!macroend
