# burp-rpc

Control [Burp Suite](https://portswigger.net/burp) programmatically from Node.js over gRPC.

Read proxy history, send requests through Burp, push requests to Repeater, and query the site map — all from your scripts.

## Install

```bash
# npm
npm install burp-rpc

# pnpm
pnpm add burp-rpc
```

## Prerequisites

You need the **burp-rpc** Burp extension loaded in Burp Suite. See the [extension setup guide](https://github.com/shero4/burp-rpc#quick-start) for build & install instructions.

## Quick Start

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

// Fire a request through Burp
const res = await burp.http.sendRawRequest(
  "example.com", 443, true,
  "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
);
console.log("Status:", res.hasResponse);

// Query the site map
const sites = await burp.siteMap.getEntries();

burp.close();
```

## API

### `new BurpClient(options?)`

| Option | Type     | Default       | Description                        |
|--------|----------|---------------|------------------------------------|
| `host` | `string` | `"localhost"` | Host running the Burp extension    |
| `port` | `number` | `50051`       | gRPC port                          |

### `burp.proxy`

| Method          | Returns                  | Description                          |
|-----------------|--------------------------|--------------------------------------|
| `getHistory()`  | `ProxyHistoryEntry[]`    | All proxy history entries            |
| `getLastN(n)`   | `ProxyHistoryEntry[]`    | Last *n* entries from proxy history  |

### `burp.http`

| Method                                              | Returns                    | Description                                |
|-----------------------------------------------------|----------------------------|--------------------------------------------|
| `sendRequest(host, port, secure, base64Body)`       | `SendHttpRequestResponse`  | Send a base64-encoded request through Burp |
| `sendRawRequest(host, port, secure, rawString)`     | `SendHttpRequestResponse`  | Same, but auto base64-encodes the input    |

### `burp.repeater`

| Method                              | Returns | Description                                    |
|-------------------------------------|---------|------------------------------------------------|
| `sendToRepeater(request, tabName?)` | `void`  | Open an `HttpRequestMessage` in Repeater       |
| `sendFromHistory(entry, tabName?)`  | `void`  | Send a `ProxyHistoryEntry` to Repeater         |

### `burp.siteMap`

| Method         | Returns          | Description             |
|----------------|------------------|-------------------------|
| `getEntries()` | `SiteMapEntry[]` | All site map entries    |

### Helpers

| Function                    | Description                              |
|-----------------------------|------------------------------------------|
| `decodeBase64Body(base64)`  | Decode a base64 HTTP body to UTF-8       |
| `encodeBase64Body(raw)`     | Encode a raw string to base64            |

### `burp.close()`

Close the gRPC channel. Call this when done so the Node.js process can exit.

## TypeScript

Full type declarations are included. All interfaces are exported:

```typescript
import {
  BurpClient,
  BurpProxy,
  BurpHttp,
  BurpRepeater,
  BurpSiteMap,
  ProxyHistoryEntry,
  HttpRequestMessage,
  SendHttpRequestResponse,
} from "burp-rpc";
```

## Environment Variables

| Variable         | Default       | Description                         |
|------------------|---------------|-------------------------------------|
| `BURP_RPC_HOST`  | `localhost`   | Override the default host           |
| `BURP_RPC_PORT`  | `50051`       | Override the default port           |

These are used by the included `test.js` example, not by the SDK itself.

## License

MIT
