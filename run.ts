
import type { Envoy } from "./envoy.ts";
import { type Flag, Flags } from "./flags.ts"

function createRegExp(s?: string) {
    return s === undefined || s === '' ? undefined : new RegExp(s)
}
export function run(args: Array<string>, envoy: Envoy) {
    const help: Flag<boolean> = {
        short: 'h',
        long: 'help',
        describe: 'help for envoy.ts',
    }
    const build: Flag<boolean> = {
        short: 'b',
        long: 'build',
        describe: 'build xDS to envoy',
    }
    const test: Flag<boolean> = {
        short: 't',
        long: 'test',
        describe: 'print xDS to stdout',
    }
    const filter: Flag<string> = {
        short: 'f',
        long: 'filter',
        describe: 'filter xDS filename by regexp',
    }
    const flags = new Flags().
        bools(help, build, test).
        strs(filter)

    flags.parse(args)

    if (help.value) {
        flags.displayHelp()
        return
    }
    else if (test.value) {
        return envoy.stdout(createRegExp(filter.value))
    }
    else if (build.value) {
        return envoy.build(createRegExp(filter.value))
    }
    flags.displayHelp()
    Deno.exit(1)
}
