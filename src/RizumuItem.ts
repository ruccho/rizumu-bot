export default interface RizumuItem {
    get type(): string;
    get title(): string;
    get author(): string;
    get url(): string;
    get lengthSec(): number | undefined;
 }