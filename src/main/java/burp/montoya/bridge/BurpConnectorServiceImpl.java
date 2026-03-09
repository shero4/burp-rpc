package burp.montoya.bridge;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.core.ByteArray;
import burp.api.montoya.http.message.requests.HttpRequest;
import burp.api.montoya.http.message.responses.HttpResponse;
import burp.api.montoya.proxy.ProxyHttpRequestResponse;
import burp.api.montoya.sitemap.SiteMap;
import burp.montoya.bridge.proto.*;
import io.grpc.stub.StreamObserver;

import java.util.Base64;
import java.util.List;

/**
 * gRPC service implementation - bridges Montoya API to protobuf RPCs.
 * All operations run on the gRPC thread pool (async) to avoid blocking Burp UI.
 */
public class BurpConnectorServiceImpl extends BurpConnectorGrpc.BurpConnectorImplBase {

    private final MontoyaApi api;

    public BurpConnectorServiceImpl(MontoyaApi api) {
        this.api = api;
    }

    @Override
    public void getProxyHistory(GetProxyHistoryRequest request,
                               StreamObserver<GetProxyHistoryResponse> responseObserver) {
        try {
            List<ProxyHttpRequestResponse> history = api.proxy().history();
            GetProxyHistoryResponse.Builder responseBuilder = GetProxyHistoryResponse.newBuilder();

            for (ProxyHttpRequestResponse entry : history) {
                ProxyHistoryEntry protoEntry = Serialization.toProxyHistoryEntry(entry);
                responseBuilder.addEntries(protoEntry);
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(e);
        }
    }

    @Override
    public void sendHttpRequest(SendHttpRequestRequest request,
                                StreamObserver<SendHttpRequestResponse> responseObserver) {
        try {
            HttpRequest httpRequest = Serialization.toHttpRequest(api, request.getRequest());
            var httpRequestResponse = api.http().sendRequest(httpRequest);

            SendHttpRequestResponse.Builder responseBuilder = SendHttpRequestResponse.newBuilder();
            responseBuilder.setRequest(Serialization.toProtoHttpRequest(httpRequestResponse.request()));
            responseBuilder.setHasResponse(httpRequestResponse.hasResponse());
            if (httpRequestResponse.hasResponse()) {
                responseBuilder.setResponse(Serialization.toProtoHttpResponse(httpRequestResponse.response()));
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(e);
        }
    }

    @Override
    public void getSiteMap(GetSiteMapRequest request,
                          StreamObserver<GetSiteMapResponse> responseObserver) {
        try {
            SiteMap siteMap = api.siteMap();
            List<burp.api.montoya.http.message.HttpRequestResponse> items = siteMap.requestResponses();

            GetSiteMapResponse.Builder responseBuilder = GetSiteMapResponse.newBuilder();

            for (var item : items) {
                SiteMapEntry protoEntry = Serialization.toSiteMapEntry(item);
                responseBuilder.addEntries(protoEntry);
            }

            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(e);
        }
    }
}
