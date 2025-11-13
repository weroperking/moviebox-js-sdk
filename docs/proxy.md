# Proxy & VPN Guidance

This project supports outbound HTTP(S) proxy configuration to help route requests through VPN or tunnel providers when Moviebox domains are geo-restricted.

## Environment Variable

Set MOVIEBOX_API_PROXY to an absolute proxy URL (e.g. http://127.0.0.1:8080 or socks5://localhost:1080). The SDK automatically routes all API calls through this proxy.

`ash
export MOVIEBOX_API_PROXY="http://127.0.0.1:8080"
`

On Windows PowerShell:

`powershell
 = "http://127.0.0.1:8080"
`

## Programmatic Configuration

When constructing MovieboxSession, supply a proxyUrl or a custom dispatcher (e.g. an Undici ProxyAgent). Example:

`	s
import { MovieboxSession } from 'moviebox-js-sdk';

const session = new MovieboxSession({
  proxyUrl: 'socks5://localhost:1080'
});
`

## VPN Considerations

- Ensure your VPN allows outbound connections to Moviebox mirrors (h5.aoneroom.com, etc.).
- If the VPN application exposes a local proxy port, set MOVIEBOX_API_PROXY to that port so the SDK routes through it.
- Update fixtures (etch_moviebox_fixtures.py) after changing VPN/proxy so captured responses match the routed environment.

## Troubleshooting

- **GeoBlockedError**: indicates the current endpoint is inaccessible from your region. Confirm the proxy/VPN is active and routing traffic properly.
- **MirrorExhaustedError**: all mirrors failed. Check proxy/VPN connectivity and consider updating mirror hosts.
- Enable debug logging via createLogger({ level: 'debug' }) and pass to MovieboxSession for detailed mirror attempt logs.
