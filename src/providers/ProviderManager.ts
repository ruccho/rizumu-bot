import { PublicError } from "../PublicError";
import Rizumu, { ProgressCallback } from "../Rizumu";
import RizumuItem from "../RizumuItem";
import { RizumuProvider } from "./RizumuProvider";

type TypeDef<T> = new (...args: any) => T;

export default class ProviderManager {

    private readonly providers: Map<TypeDef<RizumuItem>, RizumuProvider> = new Map<TypeDef<RizumuItem>, RizumuProvider>();

    registerProvider(provider: RizumuProvider) {
        this.providers.set(provider.itemClassDefinition, provider);
    }

    getProvider<TItem extends RizumuItem>(itemClassDef: new (...args: any) => TItem) {
        return this.providers.get(itemClassDef);
    }

    async processAsync(url: URL, emitItem: (item: RizumuItem) => void, progress?: ProgressCallback)
    {
        for(const [_, provider] of this.providers)
        {
            if(provider.match(url))
            {
                await provider.processAsync(url, emitItem, progress);
                return;
            }
        }

        throw new PublicError(`このURLには対応していません。`);
    }

    async playItemAsync(rizumu: Rizumu, item: RizumuItem)
    {
        for(const [itemClassDef, provider] of this.providers)
        {
            if(item instanceof itemClassDef)
            {
                await provider.playItemAsync(rizumu, item);
                return;
            }
        }

        console.warn(`No suitable provider for ${item}`);
    }
}