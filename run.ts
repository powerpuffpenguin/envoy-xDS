import type { Envoy } from "./envoy.ts";

function help() {
    console.log(`envoy xDS automation script

Usage:
  deno run -A envoy.ts [flags]

Flags:
  -h, --help      help for envoy.ts
  -b, --build   build xDS to envoy
  -t, --test   print xDS to stdout

Use "deno run -A envoy.ts --help" for more information about the envoy.ts.`)
}
export function run(args: Array<string>, envoy: Envoy) {
    for (const s of args) {
        switch (s) {
            case '-h':
            case '--help':
                return
        }
    }
    for (const s of args.reverse()) {
        switch (s) {
            case '-b':
            case '--build':
                return envoy.build()
            case '-t':
            case '--test':
                return envoy.stdout()
        }
    }
    help()
}
