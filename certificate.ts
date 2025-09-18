// deno-lint-ignore-file
import type { NameDS, Provider } from "./provider.ts";
import { getDefaultProvider } from "./provider/provider.ts";
export interface CertificateOptions {
    /**
     * tls name, must be unique
     */
    name: string
    /**
     * certificate chain
     */
    cert: string
    /**
     * private key
     */
    key: string
    /**
     * cert/key type
     * @defaultValue 'file'
     */
    type?: 'inline' | 'file' | 'inline_file' | 'env'

    /**
     * default xDS
     */
    init?: Record<string, any>
    /**
     * overlay xDS
     */
    overlay?: Record<string, any>
    /**
     * Wraps the platform API for easy porting, usually you don't want to set it up
     */
    provider?: Provider
}
/**
 * TLS certificate
 * {@link https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/transport_sockets/tls/v3/secret.proto#envoy-v3-api-msg-extensions-transport-sockets-tls-v3-secret}
 */
export class Certificate implements NameDS {
    private readonly opts: CertificateOptions
    private readonly init: Record<string, any>
    private readonly overlay: Record<string, any>
    get name() {
        return this.opts.name
    }
    constructor(opts: CertificateOptions) {
        if (opts.name == '') {
            throw new Error('certificate name invalid')
        }
        const certificateType = opts.type ?? 'file'
        switch (certificateType) {
            case "inline":
            case "file":
            case "env":
            case "inline_file":
                break
            default:
                throw new Error(`unknow certificate type: ${certificateType}`)
        }

        this.opts = {
            ...opts,
            provider: opts.provider ?? getDefaultProvider(),
        }
        this.init = { ...opts.init ?? {} }
        this.overlay = { ...opts.overlay ?? {} }
    }

    async toJSON() {
        const opts = this.opts
        return {
            ...this.init,
            "@type": "type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.Secret",
            "name": 'tls_' + opts.name,
            "tls_certificate": await this.tls_certificate(),
            ...this.overlay
        }
    }
    private async tls_certificate() {
        const opts = this.opts
        const certificateType = opts.type ?? 'file'
        switch (certificateType) {
            case "inline":
                return {
                    "certificate_chain": {
                        "inline_string": opts.cert,
                    },
                    "private_key": {
                        "inline_string": opts.key,
                    }
                }
            case "file":
                return {
                    "certificate_chain": {
                        "filename": opts.cert,
                    },
                    "private_key": {
                        "filename": opts.key,
                    }
                }
            case "env":
                return {
                    "certificate_chain": {
                        "environment_variable": opts.cert,
                    },
                    "private_key": {
                        "environment_variable": opts.key,
                    }
                }
            case "inline_file":
                return {
                    "certificate_chain": {
                        "inline_string": await opts.provider!.readTextFile(opts.cert),
                    },
                    "private_key": {
                        "inline_string": await opts.provider!.readTextFile(opts.key),
                    }
                }
            default:
                throw new Error(`unknow certificate type: ${certificateType}`)
        }
    }
}
