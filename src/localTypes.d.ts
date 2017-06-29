declare module 'promise-native-deferred' {
	class Deferred<T> {
		resolve(t: T): void;
		reject(e: any): void;
		promise: Promise<T>;
		constructor();
	}

	export = Deferred;
}