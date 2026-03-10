import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import type {
  HttpRequestMessage,
  ProxyHistoryEntry,
  ProxyHistorySummaryEntry,
  ProxyHistoryFilter,
  SiteMapEntry,
  IntruderInsertionPoint,
  CollaboratorInteraction,
  GetProxyHistoryResponse,
  GetProxyHistorySummaryResponse,
  GetProxyEntryResponse,
  SendHttpRequestResponse,
  SendAndReceiveRepeaterResponse,
  GetSiteMapResponse,
  SendToRepeaterResponse,
  SendToIntruderResponse,
  GenerateCollaboratorPayloadResponse,
  PollCollaboratorResponse,
  GetProxyInterceptStatusResponse,
  SetProxyInterceptResponse,
  PingResponse,
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
 * Methods for reading Burp's Proxy HTTP history and controlling interception.
 */
export interface BurpProxy {
  getHistory(): Promise<ProxyHistoryEntry[]>;
  getLastN(n: number): Promise<ProxyHistoryEntry[]>;
  getHistorySummary(filter?: ProxyHistoryFilter): Promise<ProxyHistorySummaryEntry[]>;
  getEntry(id: number): Promise<ProxyHistoryEntry>;
  isInterceptEnabled(): Promise<boolean>;
  setIntercept(enabled: boolean): Promise<void>;
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
  sendToRepeater(request: HttpRequestMessage, tabName?: string): Promise<void>;
  sendFromHistory(entry: ProxyHistoryEntry, tabName?: string): Promise<void>;
  sendAndReceive(
    host: string,
    port: number,
    secure: boolean,
    rawRequestBase64: string
  ): Promise<SendAndReceiveRepeaterResponse>;
}

/**
 * Methods for interacting with Burp's Intruder tool.
 */
export interface BurpIntruder {
  sendToIntruder(
    host: string,
    port: number,
    secure: boolean,
    rawRequestBase64: string,
    tabName?: string,
    insertionPoints?: IntruderInsertionPoint[]
  ): Promise<void>;
}

/**
 * Methods for interacting with Burp Collaborator.
 */
export interface BurpCollaborator {
  generatePayload(customData?: string): Promise<GenerateCollaboratorPayloadResponse>;
  poll(secretKey: string): Promise<CollaboratorInteraction[]>;
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

  /**
   * Default deadline for all gRPC calls, in milliseconds.
   * Individual methods can override this.
   * @defaultValue `15000` (15 seconds)
   */
  deadlineMs?: number;
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
  private defaultDeadlineMs: number;

  constructor(options: BurpClientOptions = {}) {
    const host = options.host ?? "localhost";
    const port = options.port ?? 50051;
    this.defaultDeadlineMs = options.deadlineMs ?? 15_000;
    this.grpcClient = new BurpConnectorService(
      `${host}:${port}`,
      grpc.credentials.createInsecure()
    );
  }

  private callOpts(overrideMs?: number): { deadline: Date } {
    const ms = overrideMs ?? this.defaultDeadlineMs;
    return { deadline: new Date(Date.now() + ms) };
  }

  /**
   * Ping the Burp RPC extension over gRPC.
   * Returns version info from Burp if reachable; throws on connection failure.
   *
   * @param timeoutMs - Deadline in ms. Defaults to 500 ms.
   *
   * @example
   * ```ts
   * const info = await burp.ping();
   * console.log(`Burp ${info.burpVersion}, extension ${info.extensionVersion}`);
   * ```
   */
  ping(timeoutMs = 500): Promise<PingResponse> {
    return new Promise((resolve, reject) => {
      this.grpcClient.ping(
        {},
        this.callOpts(timeoutMs),
        (err: grpc.ServiceError | null, res: PingResponse) => {
          if (err) return reject(err);
          resolve(res);
        }
      );
    });
  }

  /**
   * Convenience wrapper: returns `true` if Burp is reachable, `false` otherwise.
   * Does not throw.
   *
   * @example
   * ```ts
   * const burp = new BurpClient({ host: "localhost", port: 50051 });
   * if (await burp.checkConnection()) {
   *   console.log("Burp is alive");
   * }
   * burp.close();
   * ```
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.ping();
      return true;
    } catch {
      return false;
    }
  }

  /** Proxy HTTP history and intercept control. */
  readonly proxy: BurpProxy = {
    getHistory: (): Promise<ProxyHistoryEntry[]> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.getProxyHistory(
          {},
          this.callOpts(),
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

    getHistorySummary: (filter?: ProxyHistoryFilter): Promise<ProxyHistorySummaryEntry[]> => {
      const req: any = {};
      if (filter) {
        if (filter.search) req.search = filter.search;
        if (filter.methods?.length) req.methods = filter.methods;
        if (filter.statusMin) req.statusMin = filter.statusMin;
        if (filter.statusMax) req.statusMax = filter.statusMax;
        if (filter.hideAssets) req.hideAssets = filter.hideAssets;
      }
      return new Promise((resolve, reject) => {
        this.grpcClient.getProxyHistorySummary(
          req,
          this.callOpts(),
          (err: grpc.ServiceError | null, res: GetProxyHistorySummaryResponse) => {
            if (err) return reject(err);
            resolve(res.entries ?? []);
          }
        );
      });
    },

    getEntry: (id: number): Promise<ProxyHistoryEntry> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.getProxyEntry(
          { id },
          this.callOpts(),
          (err: grpc.ServiceError | null, res: GetProxyEntryResponse) => {
            if (err) return reject(err);
            if (!res.entry) return reject(new Error(`Entry ${id} not found`));
            resolve(res.entry);
          }
        );
      });
    },

    isInterceptEnabled: (): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.getProxyInterceptStatus(
          {},
          this.callOpts(),
          (err: grpc.ServiceError | null, res: GetProxyInterceptStatusResponse) => {
            if (err) return reject(err);
            resolve(res.enabled);
          }
        );
      });
    },

    setIntercept: (enabled: boolean): Promise<void> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.setProxyIntercept(
          { enabled },
          this.callOpts(),
          (err: grpc.ServiceError | null, _res: SetProxyInterceptResponse) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
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
          this.callOpts(),
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
          this.callOpts(),
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
          this.callOpts(),
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

    sendAndReceive: (
      host: string,
      port: number,
      secure: boolean,
      rawRequestBase64: string
    ): Promise<SendAndReceiveRepeaterResponse> => {
      const request: HttpRequestMessage = {
        httpService: { host, port, secure },
        rawBytesBase64: rawRequestBase64,
      };
      return new Promise((resolve, reject) => {
        this.grpcClient.sendAndReceiveRepeater(
          { request },
          this.callOpts(),
          (err: grpc.ServiceError | null, res: SendAndReceiveRepeaterResponse) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      });
    },
  };

  /** Intruder. */
  readonly intruder: BurpIntruder = {
    sendToIntruder: (
      host: string,
      port: number,
      secure: boolean,
      rawRequestBase64: string,
      tabName?: string,
      insertionPoints?: IntruderInsertionPoint[]
    ): Promise<void> => {
      const request: HttpRequestMessage = {
        httpService: { host, port, secure },
        rawBytesBase64: rawRequestBase64,
      };
      return new Promise((resolve, reject) => {
        this.grpcClient.sendToIntruder(
          {
            request,
            tabName: tabName ?? "",
            insertionPoints: insertionPoints ?? [],
          },
          this.callOpts(),
          (err: grpc.ServiceError | null, _res: SendToIntruderResponse) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    },
  };

  /** Collaborator. */
  readonly collaborator: BurpCollaborator = {
    generatePayload: (customData?: string): Promise<GenerateCollaboratorPayloadResponse> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.generateCollaboratorPayload(
          { customData: customData ?? "" },
          this.callOpts(),
          (err: grpc.ServiceError | null, res: GenerateCollaboratorPayloadResponse) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      });
    },

    poll: (secretKey: string): Promise<CollaboratorInteraction[]> => {
      return new Promise((resolve, reject) => {
        this.grpcClient.pollCollaborator(
          { secretKey },
          this.callOpts(),
          (err: grpc.ServiceError | null, res: PollCollaboratorResponse) => {
            if (err) return reject(err);
            resolve(res.interactions ?? []);
          }
        );
      });
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
