# Beta 35

Remote PC discovery now listens for multicast as well as unicast mDNS responses and prioritizes saved PCs and advertised custom ports. LAN probes have a deadline covering connection setup as well as response time; an unreachable address can no longer block the scan. Wi-Fi/Ethernet is prioritized and subnet probes are interleaved across adapters. Results arrive immediately, with a bounded fallback scan.

Remote game pages now offer **End session** alongside **Resume game** after disconnecting, and alongside **Disconnect** while connected. Ending a session asks for confirmation because the host may close the game. The client authenticates the request, checks the selected game is still the active one, and verifies the host has finished. A denied request displays an error and leaves the session available for retry.

Fixed stale game IDs being treated as running after a host reports FREE. Status checks use authenticated state on paired hosts, and successful exit detection closes the stream and returns to that game's page even if another app page was open. Disconnect continues to leave a running host game available to resume.

The profile menu now has **Your profile**, **Settings**, **Full screen / Switch to window**, and **Power options**. It displays saved PC Gamerscore immediately. Verified Steam scores update automatically in bounded background batches without requiring the profile menu to stay open, and pause during gameplay or inactivity. Background updates preserve controller focus. The calculator and scan shortcuts are removed from the quick menu; the calculator remains in Settings. Steam must be linked for new verified achievement updates.

Automatic game exit still requires the host to track the game's process. Detached launch shortcuts can keep reporting a running session after a game closes. An optional [Windows host tracking wrapper](host-game-tracking.md) is supplied for affected Steam shortcuts; it is not installed or enabled automatically.

Validated discovery deadlines, multicast replies, multiple adapters, custom ports, session cancellation/ownership failures, stale host IDs, automatic page return, cached score/background batches, controller focus and handheld layouts. A read-only scan found the local Vibepollo host. The bundled streaming engine's launch and TLS identity checks passed against a local fixture. The host wrapper passed a harmless process-lifetime test. No live pairing or real game launch was performed.

See the [remote play guide](remote-play.md) and [StreamLight parity audit](streamlight-parity.md).
