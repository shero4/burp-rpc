import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import type {
  HttpService,
  HttpRequestMessage,
  HttpResponseMessage,
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

export interface BurpClientOptions {
  host?: string;
  port?: number;
}

export class BurpClient {
  private client: any;

  constructor(options: BurpClientOptions = {}) {
    const host = options.host ?? "localhost";
    const port = options.port ?? 50051;
    this.client = new BurpConnectorService(
      `${host}:${port}`,
      grpc.credentials.createInsecure()
    );
  }

  readonly proxy = {
    getHistory: (): Promise<ProxyHistoryEntry[]> => {
      return new Promise((resolve, reject) => {
        this.client.getProxyHistory({}, (err: grpc.ServiceError | null, res: GetProxyHistoryResponse) => {
          if (err) return reject(err);
          resolve(res.entries ?? []);
        });
      });
    },

    getLastN: async (n: number): Promise<ProxyHistoryEntry[]> => {
      const entries = await this.proxy.getHistory();
      return entries.slice(-n);
    },
  };

  readonly http = {
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
        this.client.sendHttpRequest({ request }, (err: grpc.ServiceError | null, res: SendHttpRequestResponse) => {
          if (err) return reject(err);
          resolve(res);
        });
      });
    },

    /**
     * Convenience: send a raw HTTP request string (auto base64-encodes it).
     */
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

  readonly siteMap = {
    getEntries: (): Promise<SiteMapEntry[]> => {
      return new Promise((resolve, reject) => {
        this.client.getSiteMap({}, (err: grpc.ServiceError | null, res: GetSiteMapResponse) => {
          if (err) return reject(err);
          resolve(res.entries ?? []);
        });
      });
    },
  };

  readonly repeater = {
    sendToRepeater: (
      request: HttpRequestMessage,
      tabName?: string
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        this.client.sendToRepeater(
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
        return Promise.reject(new Error("Proxy history entry has no request"));
      }
      return this.repeater.sendToRepeater(entry.request, tabName);
    },
  };

  close(): void {
    this.client.close();
  }
}

/**
 * Decode a base64-encoded HTTP request/response body back to a string.
 */
export function decodeBase64Body(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Encode a raw HTTP request/response string to base64.
 */
export function encodeBase64Body(raw: string): string {
  return Buffer.from(raw).toString("base64");
}
