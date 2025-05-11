import { RizumuProvider } from "./providers/RizumuProvider"
import Rizumu from "./Rizumu"

type RizumuItem = {
    type: string
    title: string
    author: string
    url: string
    lengthSec?: number,
    provider: RizumuProvider
}

export async function playItemAsync(rizumu: Rizumu, item: RizumuItem) {
    await item.provider.playItemAsync(rizumu, item);
}

export default RizumuItem;