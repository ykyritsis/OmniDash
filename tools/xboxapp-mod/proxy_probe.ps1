param(
    [int]$Port = 8899,
    [string]$Uri = "msxbox://game/?productId=steam:3228590",
    [int]$WaitSeconds = 14
)

$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$saved = Get-ItemProperty -Path $key
$hadProxy = $saved.ProxyEnable
$oldServer = $saved.ProxyServer
$oldOverride = $saved.ProxyOverride

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
"listening on 127.0.0.1:$Port"

try {
    Set-ItemProperty -Path $key -Name ProxyEnable -Value 1 -Type DWord
    Set-ItemProperty -Path $key -Name ProxyServer -Value "127.0.0.1:$Port" -Type String
    Set-ItemProperty -Path $key -Name ProxyOverride -Value "<local>" -Type String
    "user proxy set to 127.0.0.1:$Port"

    Start-Process $Uri
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    $hits = 0
    while ((Get-Date) -lt $deadline) {
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $stream = $client.GetStream()
            $stream.ReadTimeout = 1500
            $buffer = New-Object byte[] 512
            try {
                $read = $stream.Read($buffer, 0, $buffer.Length)
                $text = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
                $firstLine = ($text -split "`r?`n")[0]
            } catch {
                $firstLine = "<no data>"
            }
            $hits++
            "CONNECTION $hits from $($client.Client.RemoteEndPoint): $firstLine"
            $client.Close()
        } else {
            Start-Sleep -Milliseconds 250
        }
    }
    if ($hits -eq 0) { "no traffic reached the proxy: the app does not use the per-user WinINET proxy" }
} finally {
    if ($hadProxy -eq 1) {
        Set-ItemProperty -Path $key -Name ProxyEnable -Value 1 -Type DWord
        Set-ItemProperty -Path $key -Name ProxyServer -Value $oldServer -Type String
        Set-ItemProperty -Path $key -Name ProxyOverride -Value $oldOverride -Type String
        "restored previous proxy: $oldServer"
    } else {
        Set-ItemProperty -Path $key -Name ProxyEnable -Value 0 -Type DWord
        "proxy disabled again"
    }
    $listener.Stop()
}
