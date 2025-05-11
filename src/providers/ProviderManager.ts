import { PublicError } from "../PublicError";
import { ProgressCallback } from "../Rizumu";
import RizumuItem from "../RizumuItem";
import { RizumuProvider } from "./RizumuProvider";
import { ICancellationToken } from "../CancellationToken";

type ProviderManager = {
    providers: RizumuProvider[]
}

export function createProviderManager(providers: RizumuProvider[]): ProviderManager {
    return {
        providers: providers
    }
}

export async function processUrlAsync(manager: ProviderManager, url: URL, emitItem: (item: RizumuItem) => void, progress?: ProgressCallback, ct?: ICancellationToken) {
    for (const provider of manager.providers) {
        if (provider.match(url)) {
            await provider.processAsync(url, emitItem, progress, ct);
            return;
        }
    }

    throw new PublicError(`This URL is not suppoted.`);
};

export default ProviderManager;