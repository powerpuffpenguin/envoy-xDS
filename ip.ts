export function splitHostPort(hostport: string): [string, number] {
    // The port starts after the last colon.
    const i = hostport.lastIndexOf(':')
    if (i < 0) {
        throw new Error(`missing port: ${hostport}`);
    }
    const s = hostport.substring(i + 1)
    const port = parseInt(s)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`port invalid: ${hostport}`)
    }
    let host = ''
    let j = 0
    let k = 0
    if (hostport[0] == '[') {
        // Expect the first ']' just before the last ':'.
        const end = hostport.indexOf(']', 1)
        if (end < 0) {
            throw new Error(`missing ']': ${hostport}`)
        }
        switch (end + 1) {
            case hostport.length:
                throw new Error(`missing port: ${hostport}`)
            case i:
                // The expected result.
                break
            default:
                // Either ']' isn't followed by a colon, or it is
                // followed by a colon that is not the last one.
                if (hostport[end + 1] == ':') {
                    throw new Error(`too many colons: ${hostport}`)
                }
                throw new Error(`missing port: ${hostport}`)
        }
        // there can't be a '[' resp. ']' before these positions
        host = hostport.substring(1, end)
        j = 1
        k = end + 1
    } else {
        host = hostport.substring(0, i)
        if (host.indexOf(':') >= 0) {
            throw new Error(`too many colons: ${hostport}`)
        }
    }
    if (hostport.indexOf('[', j) >= 0) {
        throw new Error(`unexpected '[': ${hostport}`)
    }
    if (hostport.indexOf('[', k) >= 0) {
        throw new Error(`unexpected ']': ${hostport}`)
    }
    return [host, port]
}