import {Transform, Readable, Writable} from 'stream';

class BatchTransform<T> extends Transform {
	
	_batchSize: number;
	_buffer: T[];

	constructor(batchSize: number) {
		super({objectMode: true});
		this._batchSize = batchSize;
		this._buffer = [];
	}

	_transform(data: T, encoding: string, callback: (error?: any, result?: any) => void) {
		this._buffer.push(data);

		if (this._buffer.length === this._batchSize) {
			this.push((this._buffer));
			this._buffer = [];
		}

		callback();
	}

	_flush(callback: (error?: any, result?: any) => void ) {
		if (this._buffer.length > 0) {
			this.push((this._buffer));
		}

		callback();
	}
}

function isPromise<T>(t: any): t is Promise<T> {
	return (typeof t.then === 'function');
}

class MapTransform<T, U> extends Transform  {
	
	_mapFunction: (t: T) => (U | Promise<U>)
	
	constructor(mapFunction : (t: T) => (U | Promise<U>) ) {
		super({objectMode: true});
		if (typeof mapFunction !== 'function') {
			throw new TypeError('mapFunction must be a function');
		}
		this._mapFunction = mapFunction;
	}
	_transform(data: T , encoding: string , callback: (error?: any, result?: any) => void) {
		const result = this._mapFunction(data) ;
		if (isPromise(result)) {
			result.then( (syncResult) => {
				this.push((syncResult));
				callback();
			});
		} else {
			this.push((result));
			callback();
		}
	}
}

class FilterTransform<T> extends Transform {
	
	_filterFunction: (t: T) => boolean | Promise<boolean>
	
	constructor(filterFunction: (t:T) => (boolean | Promise<boolean>) ) {
		super({objectMode: true});
		if (typeof filterFunction !== 'function') {
			throw new TypeError('filterFunction must be a function');
		}
		this._filterFunction = filterFunction;
	}
	_transform(data: T, encoding: string, callback: (error?: any, result?: any) => void) {
		const result = this._filterFunction(data);

		const filter = (testResult: boolean) => {
			if (testResult) {
				this.push(data);
			}
			callback();
		};
		
		if (isPromise(result)) {
			result.then( (syncResult) => {
				filter(syncResult);
			});
		} else {
			filter(result);
		}
	}
}

class ReduceTransform<T, R> extends Writable implements PromiseLike<R> {

	private _reduceFunction: (cumulative: R | undefined, newItem: T) => R | Promise<R>;
	private _cumulative: R | undefined;

	constructor(reduceFunction: (cumulative: R | undefined, newItem: T) => R | Promise<R>, begin?: R) {
		super({objectMode: true});
		this._reduceFunction = reduceFunction;
		this._cumulative = begin;



	}

	_write(data: T, encoding: string, callback: (error?: any, result?: any) => void) {
		const result = this._reduceFunction(this._cumulative, data);

		if (isPromise(result)) {
			result.then( (r) => {
				this._cumulative = r;
				callback();
			})
		} else {
			this._cumulative = result;
			callback();
		}
	}


	then<T>(f: (r: R) => T | Promise<T>) {
		return new Promise((resolve, reject) => {
			this.on('finish', () => {
				resolve(this._cumulative);
			})
		})
		.then(f);
	}

}





export {BatchTransform as Batch, MapTransform as Map, FilterTransform as Filter, ReduceTransform as Reduce};