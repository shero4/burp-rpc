package burp.montoya.bridge;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.core.ByteArray;
import burp.api.montoya.collaborator.CollaboratorClient;
import burp.api.montoya.collaborator.Interaction;
import burp.api.montoya.collaborator.SecretKey;
import burp.api.montoya.http.message.requests.HttpRequest;
import burp.api.montoya.http.message.responses.HttpResponse;
import burp.api.montoya.logging.Logging;
import burp.api.montoya.proxy.ProxyHttpRequestResponse;
import burp.api.montoya.sitemap.SiteMap;
import burp.montoya.bridge.proto.*;
import io.grpc.stub.StreamObserver;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * gRPC service implementation - bridges Montoya API to protobuf RPCs.
 * All operations run on the gRPC thread pool (async) to avoid blocking Burp UI.
 */
public class BurpConnectorServiceImpl extends BurpConnectorGrpc.BurpConnectorImplBase {

    private final MontoyaApi api;
    private final Logging log;
    private final Map<String, CollaboratorClient> collaboratorClients = new ConcurrentHashMap<>();

    public BurpConnectorServiceImpl(MontoyaApi api) {
        this.api = api;
        this.log = api.logging();
    }

    @Override
    public void getProxyHistory(GetProxyHistoryRequest request,
                               StreamObserver<GetProxyHistoryResponse> responseObserver) {
        try {
            List<ProxyHttpRequestResponse> history = api.proxy().history();
            log.logToOutput(String.format("[GetProxyHistory] Returning %d entries", history.size()));

            GetProxyHistoryResponse.Builder responseBuilder = GetProxyHistoryResponse.newBuilder();

            for (ProxyHttpRequestResponse entry : history) {
                ProxyHistoryEntry protoEntry = Serialization.toProxyHistoryEntry(entry);
                responseBuilder.addEntries(protoEntry);
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[GetProxyHistory] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void sendHttpRequest(SendHttpRequestRequest request,
                                StreamObserver<SendHttpRequestResponse> responseObserver) {
        try {
            HttpRequestMessage reqMsg = request.getRequest();
            String target = reqMsg.getHttpService().getHost() + ":"
                    + reqMsg.getHttpService().getPort()
                    + (reqMsg.getHttpService().getSecure() ? " (TLS)" : "");
            log.logToOutput(String.format("[SendHttpRequest] Sending to %s", target));

            HttpRequest httpRequest = Serialization.toHttpRequest(api, reqMsg);
            var httpRequestResponse = api.http().sendRequest(httpRequest);

            SendHttpRequestResponse.Builder responseBuilder = SendHttpRequestResponse.newBuilder();
            responseBuilder.setRequest(Serialization.toProtoHttpRequest(httpRequestResponse.request()));
            responseBuilder.setHasResponse(httpRequestResponse.hasResponse());
            if (httpRequestResponse.hasResponse()) {
                responseBuilder.setResponse(Serialization.toProtoHttpResponse(httpRequestResponse.response()));
                log.logToOutput(String.format("[SendHttpRequest] Got response from %s (status %d)",
                        target, httpRequestResponse.response().statusCode()));
            } else {
                log.logToOutput(String.format("[SendHttpRequest] No response from %s", target));
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[SendHttpRequest] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void getSiteMap(GetSiteMapRequest request,
                          StreamObserver<GetSiteMapResponse> responseObserver) {
        try {
            SiteMap siteMap = api.siteMap();
            List<burp.api.montoya.http.message.HttpRequestResponse> items = siteMap.requestResponses();
            log.logToOutput(String.format("[GetSiteMap] Returning %d entries", items.size()));

            GetSiteMapResponse.Builder responseBuilder = GetSiteMapResponse.newBuilder();

            for (var item : items) {
                SiteMapEntry protoEntry = Serialization.toSiteMapEntry(item);
                responseBuilder.addEntries(protoEntry);
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[GetSiteMap] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void sendToRepeater(SendToRepeaterRequest request,
                               StreamObserver<SendToRepeaterResponse> responseObserver) {
        try {
            HttpRequestMessage reqMsg = request.getRequest();
            String tabName = request.getTabName();
            String target = reqMsg.getHttpService().getHost() + ":"
                    + reqMsg.getHttpService().getPort()
                    + (reqMsg.getHttpService().getSecure() ? " (TLS)" : "");

            HttpRequest httpRequest = Serialization.toHttpRequest(api, reqMsg);

            if (tabName != null && !tabName.isEmpty()) {
                api.repeater().sendToRepeater(httpRequest, tabName);
                log.logToOutput(String.format("[SendToRepeater] Sent to Repeater tab \"%s\" — %s", tabName, target));
            } else {
                api.repeater().sendToRepeater(httpRequest);
                log.logToOutput(String.format("[SendToRepeater] Sent to Repeater — %s", target));
            }

            responseObserver.onNext(SendToRepeaterResponse.getDefaultInstance());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[SendToRepeater] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    // ─── New RPCs ─────────────────────────────────────────────────────

    private static final java.util.regex.Pattern ASSET_EXT_PATTERN =
            java.util.regex.Pattern.compile("\\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|map)(\\?|$)", java.util.regex.Pattern.CASE_INSENSITIVE);
    private static final java.util.regex.Pattern ASSET_TYPE_PATTERN =
            java.util.regex.Pattern.compile("^(image|font)/", java.util.regex.Pattern.CASE_INSENSITIVE);

    @Override
    public void getProxyHistorySummary(GetProxyHistorySummaryRequest request,
                                       StreamObserver<GetProxyHistorySummaryResponse> responseObserver) {
        try {
            List<ProxyHttpRequestResponse> history = api.proxy().history();

            String search = request.getSearch().toLowerCase();
            List<String> methods = request.getMethodsList().stream()
                    .map(String::toUpperCase).collect(java.util.stream.Collectors.toList());
            int statusMin = request.getStatusMin();
            int statusMax = request.getStatusMax();
            boolean hideAssets = request.getHideAssets();

            GetProxyHistorySummaryResponse.Builder responseBuilder = GetProxyHistorySummaryResponse.newBuilder();
            int added = 0;

            for (int i = 0; i < history.size(); i++) {
                ProxyHistorySummaryEntry entry = Serialization.toProxyHistorySummaryEntry(history.get(i));
                entry = entry.toBuilder().setId(i).build();

                if (!search.isEmpty()) {
                    boolean matches = entry.getHost().toLowerCase().contains(search)
                            || entry.getPath().toLowerCase().contains(search)
                            || entry.getContentType().toLowerCase().contains(search);
                    if (!matches) continue;
                }

                if (!methods.isEmpty() && !methods.contains(entry.getMethod().toUpperCase())) {
                    continue;
                }

                if (statusMin > 0 && entry.getStatusCode() < statusMin) continue;
                if (statusMax > 0 && entry.getStatusCode() > statusMax) continue;

                if (hideAssets) {
                    if (ASSET_EXT_PATTERN.matcher(entry.getPath()).find()) continue;
                    if (ASSET_TYPE_PATTERN.matcher(entry.getContentType()).find()) continue;
                }

                responseBuilder.addEntries(entry);
                added++;
            }

            log.logToOutput(String.format("[GetProxyHistorySummary] %d/%d entries after filtering", added, history.size()));
            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[GetProxyHistorySummary] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void getProxyEntry(GetProxyEntryRequest request,
                              StreamObserver<GetProxyEntryResponse> responseObserver) {
        try {
            int id = request.getId();
            List<ProxyHttpRequestResponse> history = api.proxy().history();

            if (id < 0 || id >= history.size()) {
                responseObserver.onError(
                        io.grpc.Status.NOT_FOUND.withDescription("Proxy entry " + id + " not found").asException());
                return;
            }

            ProxyHttpRequestResponse entry = history.get(id);
            ProxyHistoryEntry protoEntry = Serialization.toProxyHistoryEntry(entry).toBuilder().setId(id).build();

            log.logToOutput(String.format("[GetProxyEntry] Returning entry %d", id));
            responseObserver.onNext(GetProxyEntryResponse.newBuilder().setEntry(protoEntry).build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[GetProxyEntry] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void sendToIntruder(SendToIntruderRequest request,
                               StreamObserver<SendToIntruderResponse> responseObserver) {
        try {
            HttpRequest httpRequest = Serialization.toHttpRequest(api, request.getRequest());
            String tabName = request.getTabName();
            String target = request.getRequest().getHttpService().getHost();

            if (tabName != null && !tabName.isEmpty()) {
                api.intruder().sendToIntruder(httpRequest, tabName);
                log.logToOutput(String.format("[SendToIntruder] Sent to Intruder tab \"%s\" — %s", tabName, target));
            } else {
                api.intruder().sendToIntruder(httpRequest);
                log.logToOutput(String.format("[SendToIntruder] Sent to Intruder — %s", target));
            }

            responseObserver.onNext(SendToIntruderResponse.getDefaultInstance());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[SendToIntruder] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void sendAndReceiveRepeater(SendAndReceiveRepeaterRequest request,
                                       StreamObserver<SendAndReceiveRepeaterResponse> responseObserver) {
        try {
            HttpRequest httpRequest = Serialization.toHttpRequest(api, request.getRequest());
            String target = request.getRequest().getHttpService().getHost() + ":"
                    + request.getRequest().getHttpService().getPort();

            api.repeater().sendToRepeater(httpRequest, "RPC-" + System.currentTimeMillis());

            var httpRequestResponse = api.http().sendRequest(httpRequest);

            SendAndReceiveRepeaterResponse.Builder responseBuilder = SendAndReceiveRepeaterResponse.newBuilder();
            responseBuilder.setRequest(Serialization.toProtoHttpRequest(httpRequestResponse.request()));
            responseBuilder.setHasResponse(httpRequestResponse.hasResponse());
            if (httpRequestResponse.hasResponse()) {
                responseBuilder.setResponse(Serialization.toProtoHttpResponse(httpRequestResponse.response()));
                log.logToOutput(String.format("[SendAndReceiveRepeater] Got response from %s (status %d)",
                        target, httpRequestResponse.response().statusCode()));
            } else {
                log.logToOutput(String.format("[SendAndReceiveRepeater] No response from %s", target));
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[SendAndReceiveRepeater] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void generateCollaboratorPayload(GenerateCollaboratorPayloadRequest request,
                                            StreamObserver<GenerateCollaboratorPayloadResponse> responseObserver) {
        try {
            CollaboratorClient client = api.collaborator().createClient();
            String customData = request.getCustomData();
            String payload = (customData != null && !customData.isEmpty())
                    ? client.generatePayload(customData).toString()
                    : client.generatePayload().toString();

            String secretKey = client.getSecretKey().toString();
            collaboratorClients.put(secretKey, client);

            String server = client.server().address();

            log.logToOutput(String.format("[GenerateCollaboratorPayload] Generated payload: %s (server: %s)", payload, server));

            responseObserver.onNext(GenerateCollaboratorPayloadResponse.newBuilder()
                    .setPayload(payload)
                    .setServer(server)
                    .setSecretKey(secretKey)
                    .build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[GenerateCollaboratorPayload] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void pollCollaborator(PollCollaboratorRequest request,
                                 StreamObserver<PollCollaboratorResponse> responseObserver) {
        try {
            String secretKey = request.getSecretKey();
            CollaboratorClient client = collaboratorClients.get(secretKey);

            if (client == null) {
                client = api.collaborator().restoreClient(SecretKey.secretKey(secretKey));
                collaboratorClients.put(secretKey, client);
            }

            List<Interaction> interactions = client.getAllInteractions();
            log.logToOutput(String.format("[PollCollaborator] Found %d interactions", interactions.size()));

            PollCollaboratorResponse.Builder responseBuilder = PollCollaboratorResponse.newBuilder();
            for (Interaction interaction : interactions) {
                responseBuilder.addInteractions(Serialization.toProtoCollaboratorInteraction(interaction));
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[PollCollaborator] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void getProxyInterceptStatus(GetProxyInterceptStatusRequest request,
                                        StreamObserver<GetProxyInterceptStatusResponse> responseObserver) {
        try {
            boolean enabled = api.proxy().isInterceptEnabled();
            log.logToOutput(String.format("[GetProxyInterceptStatus] Intercept enabled: %b", enabled));

            responseObserver.onNext(GetProxyInterceptStatusResponse.newBuilder()
                    .setEnabled(enabled)
                    .build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[GetProxyInterceptStatus] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    @Override
    public void setProxyIntercept(SetProxyInterceptRequest request,
                                  StreamObserver<SetProxyInterceptResponse> responseObserver) {
        try {
            if (request.getEnabled()) {
                api.proxy().enableIntercept();
                log.logToOutput("[SetProxyIntercept] Intercept ENABLED");
            } else {
                api.proxy().disableIntercept();
                log.logToOutput("[SetProxyIntercept] Intercept DISABLED");
            }

            responseObserver.onNext(SetProxyInterceptResponse.getDefaultInstance());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.logToError("[SetProxyIntercept] Error: " + e.getMessage());
            log.logToError(stackTraceToString(e));
            responseObserver.onError(e);
        }
    }

    private static String stackTraceToString(Exception e) {
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }
}
