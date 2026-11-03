import subprocess

subprocess.Popen(
    [
        "wt.exe",
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        r"E:\SteamLibrary\steamapps\common\Call of Duty Black Ops III\boiii.ps1",
    ]
)
