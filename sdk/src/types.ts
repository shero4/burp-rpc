export interface HttpService {
  host: string;
  port: number;
  secure: boolean;
}

export interface Annotations {
  notes: string;
  highlightColor: string;
}

export interface HttpRequestMessage {
  httpService: HttpService | undefined;
  rawBytesBase64: string;
}

export interface HttpResponseMessage {
  rawBytesBase64: string;
}

export interface ProxyHistoryEntry {
  id: number;
  request: HttpRequestMessage | undefined;
  response: HttpResponseMessage | undefined;
  hasResponse: boolean;
  annotations: Annotations | undefined;
  timeIso: string;
  listenerPort: number;
  edited: boolean;
}

export interface SiteMapEntry {
  request: HttpRequestMessage | undefined;
  response: HttpResponseMessage | undefined;
  hasResponse: boolean;
  annotations: Annotations | undefined;
}

export interface GetProxyHistoryRequest {}

export interface GetProxyHistoryResponse {
  entries: ProxyHistoryEntry[];
}

export interface SendHttpRequestRequest {
  request: HttpRequestMessage | undefined;
}

export interface SendHttpRequestResponse {
  request: HttpRequestMessage | undefined;
  response: HttpResponseMessage | undefined;
  hasResponse: boolean;
}

export interface GetSiteMapRequest {}

export interface GetSiteMapResponse {
  entries: SiteMapEntry[];
}
