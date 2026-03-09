import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import type {
  HttpRequestMessage,
  ProxyHistoryEntry,
  SiteMapEntry,
  GetProxyHistoryResponse,
  SendHttpRequestResponse,
  GetSiteMapResponse,
  SendToRepeaterResponse,
} from "./types";

const PROTO_PATH = path.resolve(__dirname, "..", "proto", "montoya_bridge.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const BurpConnectorService = protoDescriptor.burp.montoya.bridge.BurpConnector;

// ---------------------------------------------------------------------------
// Public namespace interfaces — consumers can use these to type variables
// ---------------------------------------------------------------------------

/**
 * Methods for reading Burp's Proxy HTTP history.
 */
export interface BurpProxy {
  /**
   * Fetch every entry from the Proxy HTTP history.
   *
   * @returns All proxy history entries, oldest first.
   *
   * @example
   * ```ts
   * const all = await burp.proxy.getHistory();
   * console.log(`Total proxied requests: ${all.length}`);
   * ```
   */
  getHistory(): Promise<ProxyHistoryEntry[]>;

  /**
   * Fetch the last *n* entries from the Proxy HTTP history.
   *
   * @param n - Number of entries to return (from the end of the list).
   * @returns The last *n* entries, oldest first.
   *
   * @example
   * ```ts
   * const recent = await burp.proxy.getLastN(10);
   * ```
   */
  getLastN(n: number): Promise<ProxyHistoryEntry[]>;
}

/**
 * Methods for sending HTTP requests through Burp.
 */
export interface BurpHttp {
  /**
   * Send a base64-encoded HTTP request through Burp and return the response.
   *
   * @param host   - Target hostname or IP.
   * @param port   - Target port.
   * @param secure - `true` for HTTPS.
   * @param rawRequestBase64 - Full HTTP request as a base64 string.
   * @returns The request echo and the server's response.
   *
   * @example
   * ```ts
   * const b64 = Buffer.from("GET / HTTP/1.1\r\nHost: example.com\r\n\r\n").toString("base64");
   * const res = await burp.http.sendRequest("example.com", 443, true, b64);
   * ```
   */
  sendRequest(
    host: string,
    port: number,
    secure: boolean,
    rawRequestBase64: string
  ): Promise<SendHttpRequestResponse>;

  /**
   * Send a raw HTTP request string through Burp (auto base64-encodes it).
   *
   * @param host      - Target hostname or IP.
   * @param port      - Target port.
   * @param secure    - `true` for HTTPS.
   * @param rawRequest - Full HTTP request as a plain string.
   * @returns The request echo and the server's response.
   *
   * @example
   * ```ts
   * const res = await burp.http.sendRawRequest(
   *   "example.com", 443, true,
   *   "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
   * );
   * console.log("Got response:", res.hasResponse);
   * ```
   */
  sendRawRequest(
    host: string,
    port: number,
    secure: boolean,
    rawRequest: string
  ): Promise<SendHttpRequestResponse>;
}

/**
 * Methods for interacting with Burp's Repeater tool.
 */
export interface BurpRepeater {
  /**
   * Open an HTTP request in a new Repeater tab in the Burp UI.
   *
   * The request is **not** sent automatically — the user must click
   * "Send" inside Burp. Use {@link BurpHttp.sendRequest} to fire it
   * programmatically.
   *
   * @param request - The HTTP request to open.
   * @param tabName - Optional caption for the Repeater tab.
   *
   * @example
   * ```ts
   * await burp.repeater.sendToRepeater(entry.request!, "Login");
   * ```
   */
  sendToRepeater(request: HttpRequestMessage, tabName?: string): Promise<void>;

  /**
   * Convenience — extract the request from a {@link ProxyHistoryEntry}
   * and open it in Repeater.
   *
   * @param entry   - A proxy history entry.
   * @param tabName - Optional caption for the Repeater tab.
   * @throws If the entry has no request attached.
   *
   * @example
   * ```ts
   * const recent = await burp.proxy.getLastN(1);
   * await burp.repeater.sendFromHistory(recent[0], "Latest");
   * ```
   */
  sendFromHistory(entry: ProxyHistoryEntry, tabName?: string): Promise<void>;
}

/**
 * Methods for reading Burp's Site Map.
 */
export interface BurpSiteMap {
  /**
   * Fetch all request/response pairs from the Site Map.
   *
   * @returns All site map entries.
   *
   * @example
   * ```ts
   * const sites = await burp.siteMap.getEntries();
   * console.log(`Site map has ${sites.length} entries`);
   * ```
   */
  getEntries(): Promise<SiteMapEntry[]>;
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

/**
 * Connection options for {@link BurpClient}.
 */
export interface BurpClientOptions {
  /**
   * Hostname or IP of the machine running the Burp RPC extension.
   * @defaultValue `"localhost"`
   */
  host?: string;

  /**
   * gRPC port the extension is listening on.
   * @defaultValue `50051`
   */
  port?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * gRPC client for controlling Burp Suite remotely.
 *
 * @example
 * ```ts
 * import { BurpClient } from "burp-rpc";
 *
 * const burp = new BurpClient({ host: "localhost" });
 * const history = await burp.proxy.getLastN(5);
 * burp.close();
 * ```
 */
export class BurpClient {
  private grpcClient: InstanceType<typeof BurpConnectorService>;

  constructor(options: BurpClientOptions = {}) {
    const host = options.host ?? "localhost";
    const port = options.port ?? 50051;
    this.grpcClient = new BurpConnectorService(
      `${host}:${port}`,
      grpc.credentials.createInsecure()
    );
  }

  /** Proxy HTTP history. */
  readonly proxy: BurpProxy = {
    getHistory: (): Promise<ProxyHistoryEntry[]> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.getProxyHistory(
          {},
          (err: grpc.ServiceError | null, res: GetProxyHistoryResponse) => {
            if (err) return reject(err);
            resolve(res.entries ?? []);
          }
        );
      });
    },

    getLastN: async (n: number): Promise<ProxyHistoryEntry[]> => {
      const entries = await this.proxy.getHistory();
      return entries.slice(-n);
    },
  };

  /** Send HTTP requests through Burp. */
  readonly http: BurpHttp = {
    sendRequest: (
      host: string,
      port: number,
      secure: boolean,
      rawRequestBase64: string
    ): Promise<SendHttpRequestResponse> => {
      const request: HttpRequestMessage = {
        httpService: { host, port, secure },
        rawBytesBase64: rawRequestBase64,
      };
      return new Promise((resolve, reject) => {
        this.grpcClient.sendHttpRequest(
          { request },
          (err: grpc.ServiceError | null, res: SendHttpRequestResponse) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      });
    },

    sendRawRequest: (
      host: string,
      port: number,
      secure: boolean,
      rawRequest: string
    ): Promise<SendHttpRequestResponse> => {
      const base64 = Buffer.from(rawRequest).toString("base64");
      return this.http.sendRequest(host, port, secure, base64);
    },
  };

  /** Site Map queries. */
  readonly siteMap: BurpSiteMap = {
    getEntries: (): Promise<SiteMapEntry[]> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.getSiteMap(
          {},
          (err: grpc.ServiceError | null, res: GetSiteMapResponse) => {
            if (err) return reject(err);
            resolve(res.entries ?? []);
          }
        );
      });
    },
  };

  /** Repeater tab management. */
  readonly repeater: BurpRepeater = {
    sendToRepeater: (
      request: HttpRequestMessage,
      tabName?: string
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.sendToRepeater(
          { request, tabName: tabName ?? "" },
          (err: grpc.ServiceError | null, _res: SendToRepeaterResponse) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    },

    sendFromHistory: (
      entry: ProxyHistoryEntry,
      tabName?: string
    ): Promise<void> => {
      if (!entry.request) {
        return Promise.reject(
          new Error("Proxy history entry has no request attached")
        );
      }
      return this.repeater.sendToRepeater(entry.request, tabName);
    },
  };

  /**
   * Close the underlying gRPC channel.
   *
   * Call this when you are done to allow the Node.js process to exit cleanly.
   */
  close(): void {
    this.grpcClient.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a base64-encoded HTTP request or response body back to a UTF-8 string.
 *
 * @param base64 - The base64 string (e.g. from {@link HttpRequestMessage.rawBytesBase64}).
 * @returns The decoded UTF-8 string.
 *
 * @example
 * ```ts
 * const raw = decodeBase64Body(entry.request.rawBytesBase64);
 * console.log(raw); // "GET / HTTP/1.1\r\nHost: ..."
 * ```
 */
export function decodeBase64Body(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Encode a raw HTTP request or response string to base64.
 *
 * @param raw - The plain-text HTTP message.
 * @returns The base64-encoded string.
 *
 * @example
 * ```ts
 * const b64 = encodeBase64Body("GET / HTTP/1.1\r\nHost: example.com\r\n\r\n");
 * ```
 */
export function encodeBase64Body(raw: string): string {
  return Buffer.from(raw).toString("base64");
}
