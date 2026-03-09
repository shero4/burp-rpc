package burp.montoya.bridge;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.core.ByteArray;
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

/**
 * gRPC service implementation - bridges Montoya API to protobuf RPCs.
 * All operations run on the gRPC thread pool (async) to avoid blocking Burp UI.
 */
public class BurpConnectorServiceImpl extends BurpConnectorGrpc.BurpConnectorImplBase {

    private final MontoyaApi api;
    private final Logging log;

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

    private static String stackTraceToString(Exception e) {
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }
}
