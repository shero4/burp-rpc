/**
 * Target HTTP service — identifies where a request should be sent.
 */
export interface HttpService {
  /** Hostname or IP address (e.g. `"example.com"`). */
  host: string;
  /** TCP port number (e.g. `443`). */
  port: number;
  /** `true` for HTTPS/TLS, `false` for plain HTTP. */
  secure: boolean;
}

/**
 * User-defined annotations attached to a proxy or site map entry in Burp.
 */
export interface Annotations {
  /** Free-text notes added by the user. */
  notes: string;
  /**
   * Highlight colour name as shown in the Burp UI.
   *
   * One of `"RED"`, `"ORANGE"`, `"YELLOW"`, `"GREEN"`, `"CYAN"`,
   * `"BLUE"`, `"PINK"`, `"MAGENTA"`, `"GRAY"`, or `""` if unset.
   */
  highlightColor: string;
}

/**
 * An HTTP request — the raw bytes are base64-encoded for binary safety.
 */
export interface HttpRequestMessage {
  /** Service the request is addressed to. `undefined` when not available. */
  httpService: HttpService | undefined;
  /** Full HTTP request (including headers and body) as a base64 string. */
  rawBytesBase64: string;
}

/**
 * An HTTP response — the raw bytes are base64-encoded for binary safety.
 */
export interface HttpResponseMessage {
  /** Full HTTP response (including status line, headers, and body) as a base64 string. */
  rawBytesBase64: string;
}

/**
 * A single entry from Burp's Proxy HTTP history.
 */
export interface ProxyHistoryEntry {
  /** Numeric identifier assigned by Burp. */
  id: number;
  /** The intercepted HTTP request, or `undefined` if unavailable. */
  request: HttpRequestMessage | undefined;
  /** The HTTP response, or `undefined` if Burp has not received one yet. */
  response: HttpResponseMessage | undefined;
  /** Whether a response was received for this request. */
  hasResponse: boolean;
  /** User annotations (notes / highlight colour). */
  annotations: Annotations | undefined;
  /** Timestamp when the request was issued, as an ISO-8601 string. */
  timeIso: string;
  /** The Burp proxy listener port that intercepted the request. */
  listenerPort: number;
  /** Whether the request was edited by the user in the Proxy interceptor. */
  edited: boolean;
}

/**
 * A single entry from Burp's Site Map.
 */
export interface SiteMapEntry {
  /** The HTTP request. */
  request: HttpRequestMessage | undefined;
  /** The HTTP response, or `undefined` if none was recorded. */
  response: HttpResponseMessage | undefined;
  /** Whether a response exists for this entry. */
  hasResponse: boolean;
  /** User annotations. */
  annotations: Annotations | undefined;
}

// ---------------------------------------------------------------------------
// RPC request / response envelopes
// ---------------------------------------------------------------------------

/** Request payload for {@link BurpProxy.getHistory}. Currently empty. */
export interface GetProxyHistoryRequest {}

/** Response payload for {@link BurpProxy.getHistory}. */
export interface GetProxyHistoryResponse {
  /** Array of proxy history entries. */
  entries: ProxyHistoryEntry[];
}

/** Request payload for {@link BurpHttp.sendRequest}. */
export interface SendHttpRequestRequest {
  /** The HTTP request to send. */
  request: HttpRequestMessage | undefined;
}

/** Response payload for {@link BurpHttp.sendRequest}. */
export interface SendHttpRequestResponse {
  /** Echo of the request that was sent. */
  request: HttpRequestMessage | undefined;
  /** The response received from the server. */
  response: HttpResponseMessage | undefined;
  /** Whether a response was received. */
  hasResponse: boolean;
}

/** Request payload for {@link BurpSiteMap.getEntries}. Currently empty. */
export interface GetSiteMapRequest {}

/** Response payload for {@link BurpSiteMap.getEntries}. */
export interface GetSiteMapResponse {
  /** Array of site map entries. */
  entries: SiteMapEntry[];
}

/** Request payload for {@link BurpRepeater.sendToRepeater}. */
export interface SendToRepeaterRequest {
  /** The HTTP request to open in Repeater. */
  request: HttpRequestMessage | undefined;
  /** Optional caption for the Repeater tab. */
  tabName: string;
}

/** Response payload for {@link BurpRepeater.sendToRepeater}. Empty on success. */
export interface SendToRepeaterResponse {}
