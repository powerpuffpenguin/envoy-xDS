import { Cluster, Envoy, run } from '../mod.ts'
const scriptUrl = import.meta.url
const dir = scriptUrl.substring(7, scriptUrl.lastIndexOf('/'))

// Defining xDS project
const envoy = new Envoy({
    dir: `${dir}/etc/envoy`, // The directory where envoy xDS files are stored on the host machine
    watch: '/etc/envoy', // Mount the xDS directory in the Docker container
}).cds(
    // Defining upstream
    new Cluster({
        name: 'bing',
        addr: 'bing.com:443',
        protocol: 'auto',
        type: 'STRICT_DNS',
    }),
    new Cluster({
        name: 'google',
        addr: 'google.com:443',
        protocol: 'auto',
        type: 'STRICT_DNS',
    }),
).sds(
    // Defining tls certificates
).lds(
    // Defining Listeners
)

// run cli
run(Deno.args, envoy)