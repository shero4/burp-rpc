# burp-rpc

Control [Burp Suite](https://portswigger.net/burp) programmatically from Node.js over gRPC.

`burp-rpc` is a Burp Suite extension that exposes the [Montoya API](https://portswigger.github.io/burp-extensions-montoya-api/javadoc/burp/api/montoya/MontoyaApi.html) as a gRPC service, paired with a TypeScript/JavaScript SDK. Read proxy history, send requests through Burp, query the site map, and push requests to Repeater — all from your terminal or scripts.

**npm:** [burp-rpc](https://www.npmjs.com/package/burp-rpc)

```
┌────────────┐   gRPC (0.0.0.0:50051)   ┌──────────────────┐
│ Burp Suite │◄──────────────────────────│  Node.js / SDK   │
└────────────┘                           └──────────────────┘
```

## Features

- **Proxy history** — fetch all or the last N proxied requests
- **Send HTTP requests** — fire requests through Burp and get responses back
- **Repeater** — send any request to a Repeater tab in the Burp UI
- **Site map** — read all request/response pairs from the site map
- **Remote access** — binds to `0.0.0.0` so you can control Burp from another machine (e.g. over a VPN)
- **Logging** — every RPC call is logged in Burp with client IP, method, duration, and errors

## Quick Start

### 1. Build the extension

```bash
./gradlew shadowJar
```

Produces `build/libs/burp-rpc.jar`.

Or grab a pre-built JAR from [Releases](../../releases).

### 2. Load in Burp

**Extensions → Add → Java → select `burp-rpc.jar`**

The gRPC server starts on `0.0.0.0:50051`. You should see in the extension output:

```
Burp RPC: gRPC server started on 0.0.0.0:50051
```

### 3. Install the SDK

```bash
cd sdk

# npm
npm install && npm run build

# pnpm
pnpm install && pnpm run build
```

### 4. Run the example

```bash
cd sdk

# Burp running locally
node test.js

# Burp running on another host
BURP_RPC_HOST=localhost node test.js

# Custom port
BURP_RPC_HOST=localhost BURP_RPC_PORT=9090 node test.js
```

| Variable | Default | Description |
|---|---|---|
| `BURP_RPC_HOST` | `localhost` | Host where the Burp extension is running |
| `BURP_RPC_PORT` | `50051` | gRPC port |

### Using the published npm package

```bash
# Install from npm
npm install burp-rpc
# or
pnpm add burp-rpc
```

Then run the example in the `examples/` folder:

```bash
cd examples
npm install && npm run test
# or
pnpm install && pnpm test
```

See [examples/README.md](examples/README.md) for full docs.

## SDK API

```javascript
const { BurpClient, decodeBase64Body } = require("burp-rpc");

const burp = new BurpClient({ host: "localhost", port: 50051 });

// Get the last 5 proxy history entries
const recent = await burp.proxy.getLastN(5);
for (const entry of recent) {
  console.log(decodeBase64Body(entry.request.rawBytesBase64));
}

// Send a request to Repeater
await burp.repeater.sendFromHistory(recent[0], "My Tab");

// Fire a request through Burp and get the response
const res = await burp.http.sendRawRequest(
  "example.com", 443, true,
  "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
);

// Query the site map
const sites = await burp.siteMap.getEntries();

burp.close();
```

### `burp.proxy`

| Method | Returns | Description |
|---|---|---|
| `getHistory()` | `ProxyHistoryEntry[]` | All proxy history entries |
| `getLastN(n)` | `ProxyHistoryEntry[]` | Last *n* proxy history entries |

### `burp.http`

| Method | Returns | Description |
|---|---|---|
| `sendRequest(host, port, secure, base64Body)` | `SendHttpRequestResponse` | Send a base64-encoded request through Burp |
| `sendRawRequest(host, port, secure, rawString)` | `SendHttpRequestResponse` | Convenience — auto base64-encodes the request |

### `burp.repeater`

| Method | Returns | Description |
|---|---|---|
| `sendToRepeater(request, tabName?)` | `void` | Open an `HttpRequestMessage` in a Repeater tab |
| `sendFromHistory(entry, tabName?)` | `void` | Send a `ProxyHistoryEntry` to Repeater |

### `burp.siteMap`

| Method | Returns | Description |
|---|---|---|
| `getEntries()` | `SiteMapEntry[]` | All site map entries |

### Helpers

| Function | Description |
|---|---|
| `decodeBase64Body(base64)` | Decode a base64 HTTP body to a UTF-8 string |
| `encodeBase64Body(raw)` | Encode a raw string to base64 |

## gRPC Service

Defined in [`proto/montoya_bridge.proto`](sdk/proto/montoya_bridge.proto).

| RPC | Request | Response | Description |
|---|---|---|---|
| `GetProxyHistory` | `GetProxyHistoryRequest` | `GetProxyHistoryResponse` | All proxy history entries |
| `SendHttpRequest` | `SendHttpRequestRequest` | `SendHttpRequestResponse` | Send a request, get the response |
| `GetSiteMap` | `GetSiteMapRequest` | `GetSiteMapResponse` | All site map entries |
| `SendToRepeater` | `SendToRepeaterRequest` | `SendToRepeaterResponse` | Open a request in Repeater UI |

You can use any gRPC client (Python, Go, Rust, etc.) against this service — the Node.js SDK is just a convenience wrapper.

## Logging

Every RPC call is logged in Burp's extension output with:

- Client IP and port
- gRPC method name
- Duration in milliseconds
- Error details and stack traces (on failure)

Example output:

```
[RPC] burp.montoya.bridge.BurpConnector/GetProxyHistory from 10.69.0.11:48230 — started
[GetProxyHistory] Returning 42 entries
[RPC] burp.montoya.bridge.BurpConnector/GetProxyHistory from 10.69.0.11:48230 — OK (15 ms)
```

## Releases

The GitHub Actions workflow builds and publishes `burp-rpc.jar` automatically when you push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

You can also trigger a release manually from the Actions tab.

## Project Structure

```
burp-rpc/
├── src/main/java/burp/montoya/bridge/   # Burp extension (Java)
│   ├── BurpRpcExtension.java            # Extension entry point
│   ├── GrpcServer.java                  # Netty gRPC server
│   ├── BurpConnectorServiceImpl.java    # RPC handlers
│   ├── LoggingInterceptor.java          # Request logging
│   └── Serialization.java              # Montoya ↔ Protobuf conversion
├── src/main/proto/
│   └── montoya_bridge.proto             # gRPC service definition
├── sdk/                                 # Node.js SDK
│   ├── src/                             # TypeScript source
│   ├── dist/                            # Compiled JavaScript
│   ├── proto/                           # Proto file (copy)
│   └── test.js                          # Local dev test script
├── examples/                            # Example using npm package
│   ├── package.json                     # Depends on burp-rpc
│   ├── test.js                          # Test script
│   └── README.md                        # Usage docs
├── build.gradle.kts                     # Gradle build config
└── .github/workflows/release.yml        # CI/CD
```

## Requirements

- Java 17+
- Node.js 18+
- Burp Suite Professional or Community (with Montoya API support)

## Security

The gRPC server binds to `0.0.0.0` by default, which makes it accessible from any network interface. If you only need local access, pass `{ host: "localhost" }` to `BurpClient` and modify the Java source to bind to `127.0.0.1` instead.

## License

MIT
