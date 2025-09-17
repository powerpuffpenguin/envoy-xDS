// deno-lint-ignore-file no-explicit-any
import { splitHostPort } from "./ip.ts";
import type { DS } from "./provider.ts";

export interface ClusterOptions {
    /**
     * cluster name, must be unique
     */
    name: string
    /**
     * Upstream connection address
     * 
     */
    addr: string | string[]
    /**
     * addr type
     * @defaultValue 'STATIC'
     */
    type?: 'STATIC' | 'STRICT_DNS' | 'LOGICAL_DNS',
    /**
     * socket type
     * @defaultValue 'tcp' 
     */
    network?: 'tcp' | 'unix'
    /**
     * protocol type
     * - 'http' and 'https' will use http1.1
     * - 'h2c' and 'h2' will use http2
     * - 'auto' will negotiate via alpn
     * @defaultValue 'auto'
     */
    protocol?: 'h2c' | 'h2' | 'http' | 'https' | 'auto'

    /**
     * Only valid when protocol is 'auto'
     * @defaultValue ['h2','http/1.1']
     */
    alpn?: string[]

    /**
     * connect timeout
     * @defaultValue '5s'
     */
    connectTimeout?: string

    /**
     * If true, the certificate validity will not be checked during tls.
     * @defaultValue false
     */
    insecureSkipVerify?: boolean

    /**
     * default xDS
     */
    init?: Record<string, any>
    /**
     * overlay xDS
     */
    overlay?: Record<string, any>
}
/**
 * Upstream cluster
 */
export class Cluster implements DS {
    private readonly opts: ClusterOptions
    private readonly init: Record<string, any>
    private readonly overlay: Record<string, any>
    get name() {
        return this.opts.name
    }
    constructor(opts: ClusterOptions) {
        this.opts = { ...opts }
        this.init = { ...opts.init ?? {} }
        this.overlay = { ...opts.overlay ?? {} }
        this.toJSON()
    }

    toJSON(): Record<string, any> {
        const opts = this.opts
        if (opts.name == '') {
            throw new Error('cluster name invalid')
        }
        const clusterType = opts.type ?? 'STATIC'
        switch (opts.type) {
            case 'STATIC':
            case 'STRICT_DNS':
            case 'LOGICAL_DNS':
                break
            default:
                throw new Error(`cluster unknow type: ${opts.type}`)
        }
        const lb_endpoints = Array.isArray(opts.addr) ?
            opts.addr.map((v) => this._endpoint(v)) :
            [this._endpoint(opts.addr)]
        return {
            ...this.init,
            ...this._protocol(),
            "@type": "type.googleapis.com/envoy.config.cluster.v3.Cluster",
            "connect_timeout": opts?.connectTimeout ?? '5s',
            "load_assignment": {
                "cluster_name": opts.name,
                "endpoints": [
                    {
                        "lb_endpoints": lb_endpoints,
                    }
                ]
            },
            "name": "cds_" + opts.name,
            "type": clusterType,
            ...this.overlay,
        }
    }
    private _protocol() {
        const opts = this.opts
        const protocol = opts.protocol ?? 'http'
        switch (protocol) {
            case "h2c":
                return {
                    typed_extension_protocol_options: {
                        'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': {
                            '@type': 'type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions',
                            explicit_http_config: {
                                http2_protocol_options: {},
                            },
                        },
                    },
                }
            case "h2":
                return {
                    typed_extension_protocol_options: {
                        'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': {
                            '@type': 'type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions',
                            explicit_http_config: {
                                http2_protocol_options: {},
                            },
                        },
                    },
                    transport_socket: {
                        name: 'envoy.transport_sockets.tls',
                        typed_config: {
                            '@type': 'type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext',
                            common_tls_context: {
                                allow_expired_certificate: opts.insecureSkipVerify ? true : undefined,
                                allow_untrusted_root: opts.insecureSkipVerify ? true : undefined,
                            },
                        },
                    },
                }
            case "http":
                return {
                    typed_extension_protocol_options: {
                        'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': {
                            '@type': 'type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions',
                            explicit_http_config: {
                                http_protocol_options: {},
                            },
                        },
                    }
                }
            case "https":
                return {
                    typed_extension_protocol_options: {
                        'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': {
                            '@type': 'type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions',
                            explicit_http_config: {
                                http_protocol_options: {},
                            },
                        },
                    },
                    transport_socket: {
                        name: 'envoy.transport_sockets.tls',
                        typed_config: {
                            '@type': 'type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext',
                            common_tls_context: {
                                allow_expired_certificate: opts.insecureSkipVerify ? true : undefined,
                                allow_untrusted_root: opts.insecureSkipVerify ? true : undefined,
                            },
                        },
                    },
                }
            case "auto":
                return {
                    typed_extension_protocol_options: {
                        'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': {
                            '@type': 'type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions',
                            auto_config: {},
                        },
                    },
                    transport_socket: {
                        name: 'envoy.transport_sockets.tls',
                        typed_config: {
                            '@type': 'type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext',
                            common_tls_context: {
                                allow_expired_certificate: opts.insecureSkipVerify ? true : undefined,
                                allow_untrusted_root: opts.insecureSkipVerify ? true : undefined,
                                alpn_protocols: opts.alpn ?? ['h2', 'http/1.1']
                            },
                        },
                    },
                }

            default:
                throw new Error(`unknow cluster protocol: ${protocol}`)
        }
    }
    private _endpoint(addr: string) {
        if (addr == '') {
            throw new Error('cluster addr invalid')
        }
        const network = this.opts.network ?? 'tcp'
        switch (network) {
            case "unix":
                return {
                    "endpoint": {
                        "pipe": {
                            "path": addr,
                        }
                    }
                }
            case "tcp":
                break
            default:
                throw new Error(`unknow cluster network: ${network}`)
        }
        const [host, port] = splitHostPort(addr)
        return {
            "endpoint": {
                "address": {
                    "socket_address": {
                        "address": host,
                        "port_value": port
                    }
                }
            }
        }
    }
}