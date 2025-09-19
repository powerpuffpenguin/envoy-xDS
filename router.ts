// deno-lint-ignore-file no-explicit-any

import type { NameDS } from "./provider.ts";
export interface RedirectResponse {
    https?: boolean
    scheme?: string
    host?: string
    port?: number
    path?: string
    prefix?: string
    regex?: {
        pattern: string
        substitution?: string
    }
    code?: number
    strip?: boolean
}
function isRedirectResponse(v: any): v is RedirectResponse {
    return typeof v === "object" &&
        (typeof v.https === "boolean" ||
            typeof v.scheme === "string" ||
            typeof v.host === "string" ||
            typeof v.port === "number" ||
            typeof v.path === "string" ||
            typeof v.prefix === "string" ||
            typeof v.regex === "object" ||
            typeof v.code === "number" ||
            typeof v.strip === "boolean")
}
/**
 * Return the http response directly
 */
export interface DirectResponse {
    /**
     * @defaultValue 200
     */
    status?: number
    /**
     * Response content, If body filename is set, use body
     */
    body?: string
    /**
     * Response content,If body filename is set, use body
     */
    filename?: string
    /**
     * If not set, envoy will automatically guess it.
     */
    contentType?: string
}
function isDirectResponse(v: any): v is DirectResponse {
    return typeof v === "object" &&
        (typeof v.body === "string" ||
            typeof v.filename === "string")
}
export interface HeaderMatch {
    /**
     * @defaultValue 'equal'
     */
    match?: 'prefix' | 'equal' | 'regexp' | 'suffix' | 'contains'
    value: string
    name: string
}
export interface Route {
    /**
     * path to match
     */
    path: string
    /**
     * upstream server name, or direct response
     */
    response: string | DirectResponse | RedirectResponse

    /**
     * headers to match
     */
    headers?: HeaderMatch[]
    /**
     * matching Pattern
     */
    match?: 'prefix' | 'equal' | 'regexp'
    /**
     * optional traffic statistics name
     */
    name?: string

    /**
     * Modify the host when connecting to upstream
     */
    rewriteHost?: string

    /**
     * - 'no' No need to match websocket
     * - 'yes' Need to match websocket
     * - 'both' Add two routes, one for websocket and one for non-websocket
     * @defaultValue 'no'
     */
    websocket?: 'both' | 'yes' | 'no'

    /**
     * If set, this upstream is used for websocekt
     */
    websocketCluster?: string

    /**
     * RouteAction default xDS
     * {@link https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/route/v3/route_components.proto#envoy-v3-api-msg-config-route-v3-routeaction}
     */
    init?: Record<string, any>
    /**
     * overlay RouteAction xDS
     */
    overlay?: Record<string, any>
}
export interface Host {
    /**
     * host name, must be unique
     */
    name: string
    /**
     * domain name to match
     */
    domains?: string[]
    /**
     * routing rules
     * {@link https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/route/v3/route_components.proto#envoy-v3-api-msg-config-route-v3-route}
     */
    routes?: Route[]
}
export interface RouterOptions {
    /**
     * router name, must be unique
     */
    name: string
    /**
     * 
     */
    hosts?: Host[]
    /**
     * default xDS
     */
    init?: Record<string, any>
    /**
     * overlay xDS
     */
    overlay?: Record<string, any>
}

export class Router implements NameDS {
    private readonly opts: RouterOptions
    private readonly init: Record<string, any>
    private readonly overlay: Record<string, any>
    get name() {
        return this.opts.name
    }
    constructor(opts: RouterOptions) {
        if (opts.name == '') {
            throw new Error('router name invalid')
        }


        this.opts = { ...opts }
        this.init = { ...opts.init ?? {} }
        this.overlay = { ...opts.overlay ?? {} }
    }
    clone(name: string) {
        return new Router({ ...this.opts, name: name })
    }
    toJSON() {
        const opts = this.opts

        return {
            ...this.init,
            name: 'router_' + opts.name,
            virtual_hosts: opts?.hosts?.map((v) => {
                return {
                    name: ['host', opts.name, v.name].join('_'),
                    domains: v.domains ?? ['*'],
                    routes: v.routes?.flatMap((v) => this._route(v)) ?? [],
                }
            }),
            ...this.overlay,
        }
    }
    private _route(opts: Route) {
        const match = this._match(opts)
        const resp = opts.response
        if (isDirectResponse(resp)) {
            const direct_response = {
                status: resp.status ?? 200,
                body: resp.body ? {
                    inline_string: `${resp.body}`,
                } : (resp.filename ? {
                    filename: resp.filename,
                } : {
                    inline_string: ``,
                })
            }

            let response_headers_to_add: Record<string, any> | undefined
            if (resp.contentType) {
                response_headers_to_add = [
                    {
                        header: {
                            key: 'Content-Type',
                            value: resp.contentType
                        }
                    }
                ]
            }
            return {
                match,
                name: opts.name,
                direct_response,
                response_headers_to_add,
            }
        } else if (isRedirectResponse(resp)) {
            const redirect = {
                "https_redirect": resp.https,
                "scheme_redirect": resp.scheme,
                "host_redirect": resp.host,
                "port_redirect": resp.port,
                "path_redirect": resp.path,
                "prefix_rewrite": resp.prefix,
                "regex_rewrite": resp.regex,
                "response_code": resp.code,
                "strip_query": resp.strip,
            }
            return {
                match,
                name: opts.name,
                redirect,
            }
        }
        const websocket = opts.websocket ?? 'no'
        switch (websocket) {
            case 'yes':
                return this._routeWebsocket(opts, match, true)
            case 'no':
                return this._routeWebsocket(opts, match, false)
            case 'both':
                return [
                    this._routeWebsocket(opts, match, true),
                    this._routeWebsocket(opts, this._match(opts), false),]
            default:
                throw new Error(`route unknow websocket options: ${websocket}`)
        }
    }
    private _match(opts: Route): Record<string, any> {
        const match = opts.match ?? 'prefix'
        switch (match) {
            case "equal":
                return {
                    path: opts.path,
                    headers: createHeaderMatch(opts.headers),
                }
            case "prefix":
                return {
                    prefix: opts.path,
                    headers: createHeaderMatch(opts.headers),
                }
            case "regexp":
                return {
                    safe_regex: {
                        google_re2: {},
                        regex: opts.path,
                    },
                    headers: createHeaderMatch(opts.headers),
                }
            default:
                throw new Error(`unknow route match type: ${match}`)
        }
    }
    private _routeWebsocket(opts: Route, match: Record<string, any>, websocket: boolean) {
        const init = opts.init ?? {}
        const overlay = opts.overlay ?? {}
        const route: Record<string, any> = {
            ...init,
            cluster: websocket ? (opts.websocketCluster ?? opts.response) : opts.response,
            host_rewrite_literal: opts.rewriteHost,
            ...overlay,
        }
        if (websocket) {
            arraySet(match,
                'headers',
                {
                    name: 'Upgrade',
                    string_match: {
                        exact: 'websocket',
                    },
                },
                (v) => v.name == 'Upgrade',
            )
            arraySet(route,
                'upgrade_configs',
                {
                    upgrade_type: 'websocket'
                },
                (v) => v.upgrade_type == 'websocket',
            )
        }
        return {
            route,
            match,
            name: opts.name,
        }
    }
}

function arraySet<T>(keys: Record<string, any>, key: string, value: T, match?: (v: T) => boolean) {
    const found = keys[key]
    if (!Array.isArray(found)) {
        keys[key] = [value]
        return
    }
    for (let i = 0; i < found.length; i++) {
        const item = found[i]
        if (match && match(item)) {
            found[i] = value
            return
        }
    }
    found.push(value)
}
function createHeaderMatch(headers?: HeaderMatch[]) {
    if (!headers) {
        return
    }
    return headers.map((opts) => {
        const match = opts.match ?? 'equal'
        switch (match) {
            case "equal":
                return {
                    name: opts.name,
                    string_match: {
                        exact: opts.value,
                    },
                }
            case "prefix":
                return {
                    name: opts.name,
                    string_match: {
                        prefix: opts.value
                    },
                }
            case "suffix":
                return {
                    name: opts.name,
                    string_match: {
                        suffix: opts.value
                    },
                }
            case 'contains':
                return {
                    name: opts.name,
                    string_match: {
                        contains: opts.value
                    },
                }
            case "regexp":
                return {
                    name: opts.name,
                    string_match: {
                        safe_regex: {
                            google_re2: {},
                            regex: opts.value,
                        },
                    }
                }
            default:
                throw new Error(`unknow header match type: ${match}`)
        }
    })
}