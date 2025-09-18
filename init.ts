import { type Flag, Flags } from "./flags.ts"
function mkdir(dir: string) {
    try {
        Deno.statSync(dir)
        console.log("exists:", dir)
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            Deno.mkdirSync('src', {
                mode: 0o755,
            })
            console.log("create:", dir)
        } else {
            console.log(e)
            Deno.exit(1)
        }
    }
}
function writeFile(filename: string, text: string) {
    try {
        Deno.statSync(filename)
        console.log("exists:", filename)
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            Deno.writeTextFileSync(filename, text, {
                mode: 0o644,
                createNew: true,
            })
            console.log("create:", filename)
        } else {
            console.log(e)
            Deno.exit(1)
        }
    }
}
function main(args: string[]) {
    const help: Flag<boolean> = {
        short: 'h',
        long: 'help',
        describe: 'help for init.ts',
    }
    const version: Flag<string> = {
        short: 'v',
        long: 'version',
        describe: 'envoy version, example 1.35',
    }
    const flags = new Flags().
        bools(help).
        strs(version)
    flags.parse(args)

    if (help.value) {
        flags.displayHelp()
        return
    }

    const v = version.value ?? ''
    if (!/^\d+\.\d+$/.test(v)) {
        console.log(`version invalid: ${v}\n`)
        flags.displayHelp()
        Deno.exit(1)
    }

    writeFile('deps.ts', `export * from 'https://raw.githubusercontent.com/powerpuffpenguin/envoy-xDS/${v}/mod.ts'\n`)
    writeFile('deno.jsonc', `{
  "compilerOptions": {
    "checkJs": true
  },
  "tasks": {
    "run": "deno run --lock -A envoy.ts",
    "cache": "deno cache --lock=deno.lock envoy.ts",
    "reload": "deno --reload -A envoy.ts"
  }
}`)
    writeFile('envoy.ts', `import { getEnvoy, FilterChain, run } from './deps.ts'
import { initRouter } from "./src/init.ts";
const scriptUrl = import.meta.url
const dir = scriptUrl.substring(7, scriptUrl.lastIndexOf('/'))

const letsencrypt = \`/letsencrypt/book/letsencrypt/live\`
const domain = 'XXX.example.com'

// Defining xDS project
const envoy = getEnvoy({
    dir: \`\${dir}/etc/envoy\`, // The directory where envoy xDS files are stored on the host machine
    watch: '/etc/envoy', // Mount the xDS directory in the Docker container
})
const router = initRouter()
envoy.createCertificates({
    name: domain,
    cert: \`\${letsencrypt}/\${domain}/fullchain.pem\`,
    key: \`\${letsencrypt}/\${domain}/privkey.pem\`,
}).createListeners(
    {
        name: 'http',
        addr: ':80',
        http: router.clone('http'),
    },
    {
        name: 'h2',
        addr: ':443',
        https: [
            new FilterChain({
                name: 'h2',
                tls: domain,
                dir: '/etc/envoy',
                serverNames: ['*.' + domain],
                router: router.clone('h2'),
            }),
        ]
    },
    {
        name: 'h3',
        addr: ':443',
        network: 'udp',
        https: [
            new FilterChain({
                name: 'h3',
                tls: domain,
                dir: '/etc/envoy',
                h3: true,
                serverNames: ['*.' + domain],
                router: router.clone('h3'),
            }),
        ]
    },
    {
        name: 'unix_http',
        addr: '/unix/ingress/http.sock',
        network: 'unix',
        http: router.clone('unix_http'),
    },
    {
        name: 'unix_https',
        addr: '/unix/ingress/https.sock',
        network: 'unix',
        https: [
            new FilterChain({
                name: 'https',
                tls: domain,
                dir: '/etc/envoy',
                serverNames: ['*.' + domain],
                router: router.clone('unix_https'),
            }),
        ]
    },
)
// run cli
run(Deno.args, envoy)
`)
    mkdir('src')
    writeFile('src/init.ts', `import { getEnvoy, Router, type Host } from "../deps.ts";
export function hostDefault(): Host {
    getEnvoy().createClusters({
        name: 'default',
        addr: '10.89.0.3:80',
    })
    return {
        name: 'default',
        domains: ['*'],
        routes: [
            {
                path: '/',
                response: 'default',
                websocket: "both",
            }
        ]
    }
}
export function initRouter() {
    return new Router({
        name: 'init',
        hosts: [
            hostDefault(),
        ],
    })
}`)
}
main(Deno.args)