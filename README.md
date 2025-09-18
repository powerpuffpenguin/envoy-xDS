# envoy-xDS

Use typescript to simplify the use of envoy xDS

- [Overview](#Overview)

# Overview

envoy-xDS is a powerful command-line tool built with Deno, designed to simplify
the management of Envoy proxies in non-Kubernetes environments. Instead of
running a continuous control plane server, this project allows you to define
your Envoy configuration in Deno scripts. When executed, these scripts use a
local API to generate Envoy configuration files and strategically place them to
trigger Envoy's hot reloading mechanism.

This approach provides the benefits of dynamic configuration without the
complexity of a persistent gRPC server. It's an ideal solution for single-server
setups, personal projects, or any scenario where you want programmatic control
over Envoy without the overhead of a full-fledged service mesh.

Features Scripted Configuration: Define your Envoy listeners, routes, and
clusters using familiar Deno/TypeScript.

No Service Required: The tool generates static xDS configuration files. No need
to run a continuous gRPC server or manage long-running processes.

Lightweight & Minimalist: Built with Deno, the tool is a single, self-contained
executable with no heavy dependencies.

Hot Reloading: Automatically triggers Envoy to load the new configuration by
writing to a designated file system path, making updates seamless.

No Kubernetes Required: Specifically designed for scenarios where a full-blown
service mesh is overkill, such as personal servers or virtual machines.

How It Works Define Your Configuration: You write a Deno script using the
envoy-xDS API to programmatically define your Envoy configuration.

Generate & Update: You run the Deno script from your terminal. The script's API
calls will generate the necessary Envoy configuration files (e.g.,
listener.yaml, route.yaml, etc.) and save them to a specified directory.

Envoy Hot Reload: Your Envoy proxy is configured to watch this directory. As
soon as the new configuration files appear, Envoy automatically detects the
change and loads the new settings without a restart.

# Example

Below is an envoy environment deployed using docker compose:

```
services:
  envoy:
    image: envoyproxy/envoy:v1.35-latest
    ports:
      - 80:80
      - 443:443/tcp
      - 443:443/udp
    restart: unless-stopped
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /etc/timezone:/etc/timezone:ro
      - ./etc/envoy:/etc/envoy:ro
```

You can create an envoy.ts file and write the following code to create an xDS
files

```
import { Cluster, Envoy, run } from 'https://raw.githubusercontent.com/powerpuffpenguin/envoy-xDS/1.35/mod.ts'
const scriptUrl = import.meta.url
const dir = scriptUrl.substring(7, scriptUrl.lastIndexOf('/'))


// Defining xDS project
const envoy = new Envoy({
    dir: `${dir}/etc/envoy`, // The directory where envoy xDS files are stored on the host machine
    watch: '/etc/envoy', // Mount the xDS directory in the Docker container
}).createClusters(
    // Defining upstream
    {
        name: 'bing',
        addr: 'bing.com:443',
        protocol: 'https',
        type: 'STRICT_DNS',
        overlay: {
            lb_policy: 'ROUND_ROBIN',
            dns_lookup_family: 'V4_ONLY',
        },
    },
    {
        name: 'google',
        addr: 'google.com:443',
        protocol: 'auto',
        type: 'STRICT_DNS',
        overlay: {
            lb_policy: 'ROUND_ROBIN',
            dns_lookup_family: 'V4_ONLY',
        },
    },
    // ...
)
// create router
const router = new Router({
    name: 'demo',
    hosts: [
        {
            name: 'search',
            routes: [
                {
                    path: '/',
                    response: 'bing',
                    headers: [
                        {
                            name: ':authority',
                            value: 'bing.com',
                        }
                    ],
                    rewriteHost: 'www.bing.com',
                },
                {
                    path: '/',
                    response: 'google',
                    websocket: 'both', // enable websocekt
                    headers: [
                        {
                            name: ':authority',
                            value: 'google.com',
                        }
                    ],
                    rewriteHost: 'www.google.com',
                },
            ],
        },
    ],
})

// tls and listener
envoy.createCertificates(
    // Defining tls certificates
    {
        name: 'abc',
        cert: 'fullchain.pem',
        key: 'privkey.pem',
    },
    // ...
).createListeners(
    // Defining Listeners
    {
        name: 'http',
        addr: ':80',
        // clone router
        http: router.clone(
            'http_' + router.name // new router name
        ),
    },
    {
        name: 'h2',
        addr: ':443',
        https: [
            new FilterChain({
                name: 'demo',
                tls: 'abc',
                dir: '/etc/envoy',
                router: router.clone('h2_' + router.name),
            })
        ],
    },
    {
        name: 'h3',
        addr: ':443',
        network: 'udp',
        https: [
            new FilterChain({
                name: 'demo',
                tls: 'abc',
                dir: '/etc/envoy',
                h3: true,
                router: router.clone('h3_' + router.name),
            })
        ],
    },
)

// run cli
run(Deno.args, envoy)
```

Then you can execute the -b/--build command to update xDS:

```
deno run -A envoy.ts -b
```

Or execute the -t/--test command to print the generated xDS:

```
deno run -A envoy.ts -t
```

> When importing envoy-xDS/1.35/mod.ts , please switch the version number to the
> one compatible with the envoy you are using.
