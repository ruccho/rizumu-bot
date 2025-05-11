
export interface ICancellationSubscription {
    dispose(): void;
}

export interface ICancellationToken {
    readonly isCancellationRequested: boolean;

    subscribe(onCancellationRequested: () => void): ICancellationSubscription;
}

export interface ICancellationTokenSource {
    readonly token: ICancellationToken;
}

class CancellationSubscription implements ICancellationSubscription {
    private token: CancellationToken;
    private onCancellationRequested: () => void;

    constructor(token: CancellationToken, onCancellationRequested: () => void) {
        this.token = token;
        this.onCancellationRequested = onCancellationRequested;
    }

    dispose(): void {
        this.token.unsubscribe(this.onCancellationRequested);
    }
}

class CancellationToken implements ICancellationToken {
    private _isCancellationRequested: boolean = false;
    private onCancellationRequested: (() => void)[] = [];

    get isCancellationRequested() {
        return this._isCancellationRequested;
    }

    cancel() {
        if (this._isCancellationRequested) return;
        this._isCancellationRequested = true;
        for (const k of this.onCancellationRequested) {
            k();
        }
    }

    subscribe(onCancellationRequested: () => void) {
        this.onCancellationRequested.push(onCancellationRequested);
        return new CancellationSubscription(this, onCancellationRequested);
    }

    unsubscribe(onCancellationRequested: () => void) {
        const index = this.onCancellationRequested.indexOf(onCancellationRequested);
        if (index >= 0) this.onCancellationRequested.splice(index, 1);
    }
}

export class CancellationTokenSource implements ICancellationTokenSource {

    private _token: CancellationToken = new CancellationToken();

    get token(): ICancellationToken {
        return this._token;
    }

    reset() {
        this._token = new CancellationToken();
    }

    cancel() {
        this._token.cancel();
    }

}