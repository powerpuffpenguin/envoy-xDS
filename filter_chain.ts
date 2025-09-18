// deno-lint-ignore-file no-explicit-any
import type { NameDS } from "./provider.ts";

export interface FilterChainOptions {
    name: string
    tls: string
    dir: string
    serverNames?: string[]
    alpn?: string[]
    router?: NameDS
    /**
     * default xDS
     */
    init?: Record<string, any>
    /**
     * overlay xDS
     */
    overlay?: Record<string, any>
}
export class FilterChain implements NameDS {
    private readonly opts: FilterChainOptions
    private readonly init: Record<string, any>
    private readonly overlay: Record<string, any>
    get name() {
        return this.opts.name
    }
    constructor(opts: FilterChainOptions) {
        if (opts.name == '') {
            throw new Error('router name invalid')
        }

        this.opts = { ...opts }
        this.init = { ...opts.init ?? {} }
        this.overlay = { ...opts.overlay ?? {} }
    }
    async toJSON() {
        const opts = this.opts
        const route = opts.router
        return {
            filter_chain_match: opts.serverNames ? {
                server_names: opts.serverNames,
            } : undefined,
            "transport_socket": {
                "name": "envoy.transport_sockets.tls",
                "typed_config": {
                    "@type": "type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext",
                    "common_tls_context": {
                        "alpn_protocols": opts.alpn ?? [
                            "h2",
                            "http/1.1"
                        ],
                        "tls_certificate_sds_secret_configs": {
                            "name": "tls_" + opts.tls,
                            "sds_config": {
                                "path_config_source": {
                                    "path": `${opts.dir}/tls_${opts.tls}.yaml`
                                },
                                "resource_api_version": "V3"
                            }
                        }
                    }
                }
            },
            "filters": [
                {
                    "name": "envoy.filters.network.http_connection_manager",
                    "typed_config": {
                        ...this.init,
                        "@type": "type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager",
                        "access_log": {
                            "name": "envoy.access_loggers.stdout",
                            "typed_config": {
                                "@type": "type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog"
                            }
                        },
                        "generate_request_id": false,
                        "http_filters": [
                            {
                                "name": "envoy.filters.http.router",
                                "typed_config": {
                                    "@type": "type.googleapis.com/envoy.extensions.filters.http.router.v3.Router"
                                }
                            }
                        ],
                        "route_config": route ? await route.toJSON() : undefined,
                        "stat_prefix": opts.name,
                        "strip_any_host_port": true,
                        ...this.overlay,
                    }
                }
            ]
        }
    }
}