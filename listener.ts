// deno-lint-ignore-file no-explicit-any
import { splitHostPort } from "./ip.ts";
import type { NameDS } from "./provider.ts";

export interface ListenerOptions {
    /**
     * cluster name, must be unique
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
        return {
            ...this.init,
            "@type": "type.googleapis.com/envoy.config.cluster.v3.Cluster",
            ...this.overlay,
        }
    }
}