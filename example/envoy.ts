import { Envoy, run, Router, FilterChain } from '../mod.ts'
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
envoy
    .createCertificates(
        // Defining tls certificates
        {
            name: 'abc',
            cert: 'fullchain.pem',
            key: 'privkey.pem',
        },
        // ...
    )
    .createListeners(
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