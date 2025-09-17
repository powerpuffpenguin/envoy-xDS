import { DenoProvider } from "./deno.ts";

const provider = new DenoProvider()
export function getDefaultProvider() {
    return provider
}