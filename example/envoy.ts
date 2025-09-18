import { Envoy, run, Router } from '../mod.ts'
const scriptUrl = import.meta.url
const dir = scriptUrl.substring(7, scriptUrl.lastIndexOf('/'))


const router = new Router({
    name: 'demo',
    hosts: [
        {
            name: 'search',
            routes: [
                {
                    path: '/',
                    response: 'bing',
                    websocket: 'both',
                },
            ],
        },
    ],
})


// Defining xDS project
const envoy = new Envoy({
    dir: `${dir}/etc/envoy`, // The directory where envoy xDS files are stored on the host machine
    watch: '/etc/envoy', // Mount the xDS directory in the Docker container
}).createClusters(
    // Defining upstream
    {
        name: 'bing',
        addr: 'bing.com:443',
        protocol: 'auto',
        type: 'STRICT_DNS',
    },
    {
        name: 'google',
        addr: 'google.com:443',
        protocol: 'auto',
        type: 'STRICT_DNS',
    },
    // ...
).createCertificates(
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
        http: router.clone('http_' + router.name),
    },
    {
        name: 'https',
        addr: ':443',
        http: router.clone('https_' + router.name),
    },
)

// run cli
run(Deno.args, envoy)