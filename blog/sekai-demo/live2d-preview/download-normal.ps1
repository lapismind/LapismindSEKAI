$ProgressPreference = "SilentlyContinue"
$dir = "D:/LapismindSEKAI/blog/sekai-demo/live2d-preview/mafuyu"
if (Test-Path "$dir/18mafuyu_darkunit_3.0_f_t02.moc3") { Remove-Item "$dir/18mafuyu_darkunit_3.0_f_t02.moc3" -Force }
if (Test-Path "$dir/18mafuyu_darkunit_3.0_f_t02.physics3.json") { Remove-Item "$dir/18mafuyu_darkunit_3.0_f_t02.physics3.json" -Force }
$b = "https://storage.exmeaning.com/sekai-jp-assets/live2d/model/18mafuyu_normal"
curl.exe -L --retry 5 --retry-delay 2 --max-time 120 -o "$dir/model.moc3" "$b/18mafuyu_normal_3.0_f_t05.moc3" | Out-Null
Write-Output ("moc3: " + (Get-Item "$dir/model.moc3").Length)
curl.exe -sL --max-time 30 -o "$dir/model.model3.json" "$b/18mafuyu_normal_3.0_f_t05.model3"
Write-Output ("model3: " + (Get-Item "$dir/model.model3.json").Length)
curl.exe -sL --max-time 30 -o "$dir/model.physics3.json" "$b/18mafuyu_normal_3.0_f_t05.physics3"
Write-Output ("physics: " + (Get-Item "$dir/model.physics3.json").Length)
curl.exe -L --retry 5 --retry-delay 2 --max-time 180 -o "$dir/texture_00.png" "$b/texture_00.png" | Out-Null
Write-Output ("tex: " + (Get-Item "$dir/texture_00.png").Length)
