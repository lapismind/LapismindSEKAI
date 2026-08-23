$d = "D:/LapismindSEKAI/blog/sekai-demo/live2d-preview/mafuyu"
Remove-Item "$d/18mafuyu_normal_3.0_f_t05.moc3" -Force -ErrorAction SilentlyContinue
Remove-Item "$d/18mafuyu_normal_3.0_f_t05.model3.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$d/18mafuyu_normal_3.0_f_t05.physics3.json" -Force -ErrorAction SilentlyContinue
Get-ChildItem $d -File | Select-Object Name,Length
