// deno-lint-ignore-file no-explicit-any
import { type Provider, type DS, type NameDS } from './provider.ts'
import { getDefaultProvider } from './provider/provider.ts'


/**
 * Define various options for the envoy xds project
 */
export interface EnvoyOptions {
    /**
     * Configure output folder
     */
    dir: string
    /**
     * Envoy monitors the folder, which is usually the same as dir. However, if you deploy Envoy in Docker and execute the script in the host machine, you should change it to the path in the Envoy container.
     */
    watch?: string

    /**
     * Wraps the platform API for easy porting, usually you don't want to set it up
     */
    provider?: Provider

    /**
     * Fixed configuration other than xDS
     */
    fixed?: Record<string, DS>
}

/**
 * Define an envoy xDS project
 * {@link https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/bootstrap/v3/bootstrap.proto#config-bootstrap-v3-bootstrap}
 */
export class Envoy {
    private opts: EnvoyOptions
    private lds_: NameDS[] = []
    private ldsSet_ = new Set<string>()
    private cds_: NameDS[] = []
    private cdsSet_ = new Set<string>()
    private sds_: NameDS[] = []
    private sdsSet_ = new Set<string>()
    constructor(opts: EnvoyOptions) {
        this.opts = {
            ...opts,
            provider: opts.provider ?? getDefaultProvider()
        }
    }
    /**
     * Adding a Listener
     */
    lds(...vals: NameDS[]) {
        this._add('lds', this.ldsSet_, this.lds_, vals)
        return this
    }
    /**
     * Adding backend services
     */
    cds(...vals: NameDS[]) {
        this._add('cds', this.cdsSet_, this.cds_, vals)
        return this
    }
    /**
     * Adding a TLS certificate
     */
    sds(...vals: NameDS[]) {
        this._add('sds', this.sdsSet_, this.sds_, vals)
        return this
    }
    private _add(tag: string, set: Set<string>, dst: NameDS[], vals: NameDS[]) {
        const add = new Set<string>()
        for (const val of vals) {
            const name = val.name
            if (set.has(name)) {
                throw new Error(`${tag} already exists: ${name}`)
            } else if (add.has(name)) {
                throw new Error(`${tag} name repeat: ${name}`)
            }
            add.add(name)
        }
        for (const val of vals) {
            dst.push(val)
            set.add(val.name)
        }
    }
    /**
     * Compile the configuration and update (move) xDS for envoy
     */
    async build(): Promise<void> {
        const provider = this.opts.provider!
        const list: { from: string, to: string, hash: string }[] = []

        // create all xDS files
        await this._write(list, 'envoy.yaml', await this._generate())
        await this._write(list, 'lds.yaml', await this._generateResources(this.lds_))
        await this._write(list, 'cds.yaml', await this._generateResources(this.cds_))
        for (const sds of this.sds_) {
            const name = `${sds.name}.yaml`
            await this._write(list, name, await this._generateResources([sds]))
        }
        // move triggers envoy update
        for (const iterator of list.reverse()) {
            const hash = await provider.fileHash(iterator.to)
            if (hash !== iterator.hash) {
                console.log("move", iterator.to)
                await provider.move(iterator.from, iterator.to)
            }
        }
    }
    /**
     * Print the generated xDS to stdout for reviewing the generated xDS content
     */
    async stdout(): Promise<void> {
        console.log('# --- envoy.yaml ---')
        console.log(await this._generate())

        console.log('# --- lds.yaml ---')
        console.log(await this._generateResources(this.lds_))

        console.log('# --- cds.yaml ---')
        console.log(await this._generateResources(this.cds_))

        for (const sds of this.sds_) {
            console.log(`# --- ${sds.name}.yaml ---`)
            console.log(await this._generateResources([sds]))
        }
    }
    private async _write(list: { from: string, to: string, hash: string }[], name: string, data: string) {
        const opts = this.opts
        const provider = opts.provider!
        const dir = opts.dir
        const from = `${dir}/.${name}`
        const to = `${dir}/${name}`

        const hash = await provider.textHash(data)
        await provider.writeTextFile(from, data)

        list.push({
            from: from,
            to: to,
            hash: hash,
        })
    }
    private _generate() {
        const opts = this.opts
        const watch = opts.watch ?? opts.dir
        const provider = opts.provider!

        const o: Record<string, any> = {
            "dynamic_resources": {
                "cds_config": {
                    "path_config_source": {
                        "path": `${watch}/cds.yaml`
                    },
                    "resource_api_version": "V3"
                },
                "lds_config": {
                    "path_config_source": {
                        "path": `${watch}/lds.yaml`
                    },
                    "resource_api_version": "V3"
                }
            }
        }
        // user fixed
        if (opts.fixed) {
            for (const key in opts.fixed) {
                if (key === 'dynamic_resources') {
                    throw new Error("fixed cannot specify dynamic_resources")
                }
                if (Object.prototype.hasOwnProperty.call(opts.fixed, key)) {
                    o[key] = opts.fixed[key].toJSON()
                }
            }
        }
        // default fixed
        if (!o['node']) {
            o['node'] = {
                cluster: 'envoy-xDS-cluster',
                id: 'envoy-xDS-id',
            }
        }
        if (!o['layered_runtime']) {
            o['layered_runtime'] = {
                "layers": [
                    {
                        "name": "static_layer_conns",
                        "static_layer": {
                            "envoy": {
                                "resource_limits": {
                                    "listener": {
                                        "http_listener": {
                                            "connection_limit": 10000
                                        },
                                        "https_listener": {
                                            "connection_limit": 10000
                                        }
                                    }
                                }
                            },
                            "overload": {
                                "global_downstream_max_connections": 50000
                            }
                        }
                    }
                ]
            }
        }
        return provider.toYaml(o)
    }
    private _generateResources(ds: DS[]) {
        const opts = this.opts
        const provider = opts.provider!
        return provider.toYaml({
            resources: ds.map((v) => v.toJSON())
        })
    }
}