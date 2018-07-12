import { Transform, Readable, Writable } from 'stream';

class BatchTransform<T> extends Transform {
	_batchSize: number;
	_buffer: T[];

	constructor(batchSize: number) {
		super({ objectMode: true });
		this._batchSize = batchSize;
		this._buffer = [];
	}

	_transform(
		data: T,
		encoding: string,
		callback: (error?: any, result?: any) => void
	) {
		this._buffer.push(data);

		if (this._buffer.length === this._batchSize) {
			this.push(this._buffer);
			this._buffer = [];
		}

		callback();
	}

	_flush(callback: (error?: any, result?: any) => void) {
		if (this._buffer.length > 0) {
			this.push(this._buffer);
		}

		callback();
	}
}

class MapTransform<T, U> extends Transform {
	_mapFunction: (t: T) => U | Promise<U>;

	constructor(mapFunction: (t: T) => U | Promise<U>) {
		super({ objectMode: true });
		if (typeof mapFunction !== 'function') {
			throw new TypeError('mapFunction must be a function');
		}
		this._mapFunction = mapFunction;
	}
	async _transform(
		data: T,
		encoding: string,
		callback: (error?: Error, result?: U) => void
	) {
		const result = this._mapFunction(data);
		try {
			const result = await this._mapFunction(data);
			this.push(result);
			callback();
		} catch (e) {
			callback(e);
		}
	}
}

class FilterTransform<T> extends Transform {
	_filterFunction: (t: T) => boolean | Promise<boolean>;

	constructor(filterFunction: (t: T) => boolean | Promise<boolean>) {
		super({ objectMode: true });
		if (typeof filterFunction !== 'function') {
			throw new TypeError('filterFunction must be a function');
		}
		this._filterFunction = filterFunction;
	}
	async _transform(
		data: T,
		encoding: string,
		callback: (error?: any, result?: any) => void
	) {
		try {
			const result = await this._filterFunction(data);
			if (result) {
				this.push(data);
			}
			callback();
		} catch (e) {
			callback(e);
		}
	}
}

import { resolve } from 'path';

class ReduceTransform<T, R> extends Writable implements PromiseLike<R> {
	private _reduceFunction: (cumulative: R, newItem: T) => R | Promise<R>;
	private _cumulative: R;
	private _errored: boolean = false;
	private _promise: Promise<R>;

	constructor(
		reduceFunction: (cumulative: R, newItem: T) => R | Promise<R>,
		begin: R
	);
	constructor(reduceFunction: (cumulative: R, newItem: T) => R | Promise<R>);
	constructor(
		reduceFunction: (cumulative: R, newItem: T) => R | Promise<R>,
		begin?: R
	) {
		super({ objectMode: true });
		this._reduceFunction = reduceFunction;
		this._cumulative = begin!;

		this._promise = new Promise<R>((resolve, reject) => {
			this.on('finish', () => {
				if (!this._errored) {
					resolve(this._cumulative);
				}
			});
			this.on('error', (e) => {
				reject(e);
			});
		});
	}

	async _write(
		data: T,
		encoding: string,
		callback: (error?: any, result?: any) => void
	) {
		try {
			const result = await this._reduceFunction(this._cumulative, data);
			this._cumulative = result;
			callback();
		} catch (e) {
			this._errored = true;
			callback(e);
		}
	}

	then<T>(f: (r: R) => T | Promise<T>, e?: (e: Error) => any) {
		return this._promise.then(f, e);
	}

	catch(e?: (e: Error) => any) {
		return this._promise.catch(e);
	}
}

export {
	BatchTransform as Batch,
	MapTransform as Map,
	FilterTransform as Filter,
	ReduceTransform as Reduce
};
