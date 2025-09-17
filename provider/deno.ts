// deno-lint-ignore-file no-explicit-any
import { type Provider } from '../provider.ts'
import { crypto } from "https://deno.land/std@0.200.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.200.0/encoding/hex.ts";
import { dump } from "https://esm.sh/js-yaml@4.1.0";

export class DenoProvider implements Provider {
    /**
     * Create a text file, usually used to generate xDS files
     */
    writeTextFile(path: string, data: string): Promise<void> {
        return Deno.writeTextFile(path, data, {
            mode: 0o644,
        })
    }
    /**
     * Move files, usually used to move xDS to trigger envoy updates
     */
    move(oldpath: string, newpath: string): Promise<void> {
        return Deno.rename(oldpath, newpath)
    }
    /**
     * 
     * Read text files, usually used to read old configurations to determine which xDSs need to be updated
     */
    readTextFile(path: string): Promise<string> {
        return Deno.readTextFile(path)
    }
    /**
     * Calculate the hash of the text, usually used to compare whether xDS has changed
     */
    async textHash(text: string): Promise<string> {
        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(text),
        )
        const hashArray = new Uint8Array(hashBuffer)
        const hashHex = encode(hashArray)
        return new TextDecoder().decode(hashHex)
    }
    /**
    * Calculate the hash of the file, usually used to compare whether xDS has changed
    * @returns If the file does not exist, it will return undefined.
    */
    async fileHash(path: string): Promise<string | undefined> {
        let fileContent: Uint8Array
        try {
            fileContent = await Deno.readFile(path)
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                return
            }
            throw e
        }
        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            fileContent,
        )
        const hashArray = new Uint8Array(hashBuffer)
        const hashHex = encode(hashArray)
        return new TextDecoder().decode(hashHex)
    }
    /**
     * Generate yaml for xDS
     */
    toYaml(value: any): string {
        return dump(value)
    }
}