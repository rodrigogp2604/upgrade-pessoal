# Descobre o IPv4 da máquina na rede local.
#
# Por que isso existe: dentro do container, o servidor só enxerga a rede do Docker
# (172.x), que não serve para o celular achar o PC. Então quem descobre o IP de verdade
# é o script que sobe o serviço, e ele passa o valor em HOST_LAN_IP.
#
# Uso:  . "$PSScriptRoot\lan-ip.ps1"   →  $ip = Get-LanIPv4

function Get-LanIPv4 {
    # 1ª tentativa: a interface que tem gateway padrão é, por definição, a que fala
    # com o roteador — é dela que o celular vai receber a resposta.
    $viaGateway = Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        Select-Object -First 1

    if ($viaGateway -and $viaGateway.IPv4Address) {
        return $viaGateway.IPv4Address[0].IPAddress
    }

    # 2ª tentativa: qualquer IPv4 privado que não seja de adaptador virtual
    # (Hyper-V, WSL e Docker criam vEthernet e faixas 172.x que enganam).
    $candidato = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.InterfaceAlias -notlike '*vEthernet*' -and
            $_.InterfaceAlias -notlike '*WSL*' -and
            $_.InterfaceAlias -notlike '*Loopback*' -and
            ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*')
        } |
        Select-Object -First 1

    if ($candidato) { return $candidato.IPAddress }

    return $null
}
