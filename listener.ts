// deno-lint-ignore-file no-explicit-any
import { splitHostPort } from "./ip.ts";
import type { NameDS } from "./provider.ts";

export interface ListenerOptions {
    /**
     * listen name, must be unique
     */
    name: string
    /**
     * listen address, :443 [::1]:80
     * 
     */
    addr: string

    /**
     * socket type
     * @defaultValue 'tcp' 
     */
    network?: 'tcp' | 'unix'

    /**
     * Specifying routes for http.
     * When both http and https are specified, http will be ignored.
     */
    http?: NameDS,
    /**
     * Specifying routes for https.
     * When both http and https are specified, http will be ignored.
     */
    https?: NameDS[],
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
 * {@link https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/listener/v3/listener.proto#envoy-v3-api-msg-config-listener-v3-listener}
 */
export class Listener implements NameDS {
    private readonly opts: ListenerOptions
    private readonly init: Record<string, any>
    private readonly overlay: Record<string, any>
    get name() {
        return this.opts.name
    }
    constructor(opts: ListenerOptions) {
        if (opts.name == '') {
            throw new Error('listener name invalid')
        }
        const network = opts.network ?? 'tcp'
        switch (network) {
            case 'tcp':
            case 'unix':
                break
            default:
                throw new Error(`listener unknow network: ${network}`)
        }

        this.opts = { ...opts }
        this.init = { ...opts.init ?? {} }
        this.overlay = { ...opts.overlay ?? {} }
    }

    async toJSON() {
        const opts = this.opts
        const router: Record<string, any> = {}
        if (opts.https) {
            router['filter_chains'] = await this._filter_chains()
            router['listener_filters'] = [
                {
                    "name": "envoy.filters.listener.tls_inspector",
                    "typed_config": {
                        "@type": "type.googleapis.com/envoy.extensions.filters.listener.tls_inspector.v3.TlsInspector"
                    }
                }
            ]
        } else {
            router['default_filter_chain'] = await this._default_filter_chain()
        }
        return {
            ...this.init,
            '@type': "type.googleapis.com/envoy.config.listener.v3.Listener",
            name: 'lds_' + opts.name,
            address: this._address(),
            ...router,
            ...this.overlay,
        }
    }
    private async _default_filter_chain() {
        const opts = this.opts
        const route = opts.http
        return {
            "filters": [
                {
                    "name": "envoy.filters.network.http_connection_manager",
                    "typed_config": {
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
                        "strip_any_host_port": true
                    }
                }
            ]
        }

    }
    private async _filter_chains() {
        const https = this.opts.https ?? []
        const chains = new Array(https.length)
        for (let i = 0; i < https.length; i++) {
            chains[i] = await https[i].toJSON()
        }
        return chains
    }
    private _address() {
        const opts = this.opts
        const network = opts.network ?? 'tcp'
        switch (network) {
            case 'tcp':
                break
            case 'unix':
                return {
                    pipe: {
                        path: opts.addr,
                    }
                }
        }
        const [host, port] = splitHostPort(opts.addr)
        return {
            socket_address: {
                address: host === '' ? '::' : host,
                port_value: port,
            }
        }
    }
}