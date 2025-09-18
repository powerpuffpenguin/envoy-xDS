// deno-lint-ignore-file no-explicit-any
import type { Envoy } from "./envoy.ts";

interface Flag<T> {
    short: string
    long: string
    value?: T
    describe: string
}
class Flags {
    private readonly boolShort = new Map<string, Flag<boolean>>()
    private readonly boolLong = new Map<string, Flag<boolean>>()
    private readonly strShort = new Map<string, Flag<string>>()
    private readonly strLong = new Map<string, Flag<string>>()

    private _checkName<T>(flag: Flag<T>) {
        if (flag.short == '' || flag.short.startsWith('-') || flag.short.indexOf('=') >= 0) {
            throw new Error(`short name invalid: ${flag.short}`)
        }
        if (flag.long == '' || flag.long.startsWith('-') || flag.long.indexOf('=') >= 0) {
            throw new Error(`long name invalid: ${flag.long}`)
        }
        if (this.boolShort.has(flag.short) || this.strShort.has(flag.short)) {
            throw new Error(`short name already exists: ${flag.short}`)
        }
        if (this.boolLong.has(flag.long) || this.strLong.has(flag.long)) {
            throw new Error(`long name already exists: ${flag.long}`)
        }
    }
    bools(...flag: Flag<boolean>[]) {
        for (const v of flag) {
            this._checkName(v)
            this.boolShort.set(v.short, v)
            this.boolLong.set(v.long, v)
        }
        return this
    }
    strs(...flag: Flag<string>[]) {
        for (const v of flag) {
            this._checkName(v)
            this.strShort.set(v.short, v)
            this.strLong.set(v.long, v)
        }
        return this
    }
    displayHelp() {
        console.log(`envoy xDS automation script

Usage:
    deno run -A envoy.ts [flags]

Flags:`)
        const flags = [...this.strLong.values(), ...this.boolLong.values()]
        flags.sort((a, b) => {
            if (a.long === b.long) {
                return 0
            }
            return a.long < b.long ? 1 : -1
        })
        for (const flag of flags) {
            console.log(` -${flag.short}, --${flag.long.padEnd(10)}  ${flag.describe}`)
        }
        console.log(`
Use "deno run -A envoy.ts --help" for more information about the envoy.ts.`)
    }
    parse(args: Array<string>) {
        let flag: Flag<string> | undefined
        let found: { flag: Flag<any>, value?: string } | undefined
        let key: string
        for (const s of args) {
            if (flag) {
                flag.value = s
                flag = undefined
                continue
            }
            if (s.startsWith('--')) {
                key = s.substring(2)
                found = this._found(this.boolLong, key)
                if (found) {
                    this._parseBool(found.flag, found.value)
                    continue
                }
                found = this._found(this.strLong, key)
                if (found) {
                    flag = this._parseStr(found.flag, found.value)
                    continue
                }
            } else if (s.startsWith('-')) {
                key = s.substring(1)
                found = this._found(this.boolShort, key)
                if (found) {
                    this._parseBool(found.flag, found.value)
                    continue
                }
                found = this._found(this.strShort, key)
                if (found) {
                    flag = this._parseStr(found.flag, found.value)
                    continue
                }
            } else {
                continue
            }
            console.log(`unknow flag: `, s + "\n")
            this.displayHelp()
            Deno.exit(1)
        }
        if (flag) {
            console.log(`flag value miss: -${flag.short}/--${flag.long}` + "\n")
            this.displayHelp()
            Deno.exit(1)
        }
    }
    private _found(keys: Map<string, Flag<any>>, key: string) {
        const flag = keys.get(key)
        if (flag) {
            return { flag: flag }
        }

        const parts = key.split('=', 2)
        if (parts.length === 2) {
            const flag = keys.get(parts[0])
            if (flag) {
                return { flag, value: parts[1] }
            }
        }
    }
    private _parseBool(flag: Flag<boolean>, val?: string) {
        if (val === undefined) {
            flag.value = true
            return
        }
        switch (val.toLowerCase()) {
            case '0':
            case 'false':
                flag.value = false
                break
            default:
                flag.value = true
                break
        }
    }
    private _parseStr(flag: Flag<string>, val?: string) {
        if (val === undefined) {
            flag.value = undefined
            return flag
        }
        flag.value = val
    }
}
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
