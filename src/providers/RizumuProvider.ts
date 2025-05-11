import { ICancellationToken } from "../CancellationToken";
import Rizumu, { ProgressCallback } from "../Rizumu";
import RizumuItem from "../RizumuItem";

type RizumuProvider = {
    match(url: URL): boolean;
    processAsync(url: URL, emitItem: (item: RizumuItem) => void, progress?: ProgressCallback, ct?: ICancellationToken): Promise<void>;
    playItemAsync(rizumu: Rizumu, item: RizumuItem): Promise<void>;
}

export { RizumuProvider };