// deno-lint-ignore-file
/**
 * Platform-related APIs, although currently only deno is supported, we will extract specific APIs to facilitate future porting work
 */
export interface Provider {
    /**
     * Create a text file, usually used to generate xDS files
     */
    writeTextFile(path: string, data: string): Promise<void> | void
    /**
    * Move files, usually used to move xDS to trigger envoy updates
    */
    move(oldpath: string, newpath: string): Promise<void> | void
    /**
     * 
     * Read text files, usually used to read old configurations to determine which xDSs need to be updated
     */
    readTextFile(path: string): Promise<string> | string
    /**
     * Calculate the hash of the text, usually used to compare whether xDS has changed
     */
    textHash(text: string): Promise<string> | string
    /**
     * Calculate the hash of the file, usually used to compare whether xDS has changed
     * @returns If the file does not exist, it will return undefined.
     */
    fileHash(path: string): Promise<string | undefined> | string | undefined

    /**
     * Generate yaml for xDS
     */
    toYaml(value: any): Promise<string> | string
}
/**
 * define xDS
 */
export interface DS {
    toJSON(): Record<string, any> | Promise<Record<string, any>>
}
export interface NameDS extends DS {
    readonly name: string
}
