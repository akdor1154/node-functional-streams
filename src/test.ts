///<reference types="mocha" />

import assert = require('assert');

import { PassThrough, Readable } from 'stream';
import {
	Map as MapStream,
	Filter as FilterStream,
	Batch,
	Reduce as ReduceStream
} from './streams';

describe('MapStream', () => {
	it('should function as a normal map', () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });
		const dest: string[] = [];

		function myMap(n: number): string {
			return n.toString(2);
		}

		const mapStream = new MapStream(myMap);
		sourceStream.pipe(mapStream);

		mapStream.on('readable', () => {
			let result;

			while ((result = mapStream.read()) !== null) {
				dest.push(result);
			}
		});

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return new Promise((resolve, reject) => {
			mapStream.on('end', resolve);
			mapStream.on('error', reject);
		}).then(() => {
			assert.deepStrictEqual(dest, source.map(myMap));
		});
	});
});

describe('FilterStream', () => {
	it('should function as a normal filter', () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });
		const dest: string[] = [];

		function myFilter(n: number): boolean {
			return n % 2 === 0;
		}

		const filterStream = new FilterStream(myFilter);
		sourceStream.pipe(filterStream);

		filterStream.on('readable', () => {
			let result;

			while ((result = filterStream.read()) !== null) {
				dest.push(result);
			}
		});

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return new Promise((resolve, reject) => {
			filterStream.on('end', resolve);
		}).then(() => {
			assert.deepStrictEqual(dest, source.filter(myFilter));
		});
	});
});

describe('ReduceStream', () => {
	it('should function as a normal reduce', () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		function myReduce(result: string, n: number): string {
			return result + n.toString();
		}

		const reduceStream = new ReduceStream(myReduce, '');
		sourceStream.pipe(reduceStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return reduceStream.then(result => {
			assert.deepStrictEqual(result, source.reduce(myReduce, ''));
		});
	});

	class SourceStream extends Readable {
		data = [1, 2, 3];
		i = 0;

		constructor() {
			super({ objectMode: true });
		}

		_read() {
			if (this.i >= this.data.length) {
				return this.push(null);
			}
			return this.push(this.data[this.i++]);
		}
	}

	it('should finish after piping from a readablestream', () => {
		const sourceStream = new SourceStream();
		const mapStream = new MapStream((n: number) => n * 2);
		const reduceStream = new ReduceStream((s, n) => s + n.toString(), '');
		sourceStream.pipe(mapStream).pipe(reduceStream);

		return reduceStream.then(result => {
			assert.deepStrictEqual(result, '246');
		});
	});

	it('should finish when awaited with typescript', async () => {
		const sourceStream = new SourceStream();
		const reduceStream = new ReduceStream((s, n) => s + n.toString(), '');
		sourceStream.pipe(reduceStream);

		const result = await reduceStream;
		assert.deepStrictEqual(result, '123');
	});

	it('should throw when awaited with typescript', async () => {
		const arr = ['a', 'b'];
		const sourceStream = new SourceStream();
		const reduceStream = new ReduceStream((s, n: number) => s + arr[n], '');
		sourceStream.pipe(reduceStream);

		try {
			const result = await reduceStream;
			assert.fail('no error', 'error', 'should have thrown', '==');
		} catch (e) {
			// all good;
			return;
		}
	});

	const jsTest = eval(`(async () => {

		const ReduceStream = require('./streams').Reduce;

		const sourceStream = new SourceStream();
		const reduceStream = new ReduceStream((s, n) => s + n.toString(), '');
		sourceStream.pipe(reduceStream);

		const result = await reduceStream;
		assert.deepStrictEqual(result, '123');

	})`);

	it('should finish when awaited with javascript', jsTest);

	function wait(ms: number) {
		return new Promise((resolve, reject) => {
			setTimeout(resolve, ms);
		});
	}

	it('should await throw when an async reduce function throws an error', async () => {
		const sourceStream = new SourceStream();
		const reduceStream = new ReduceStream(async (s, n: number) => {
			s += n.toString();
			await wait(10);
			if (n == 3) {
				throw new Error('expected');
			}
			return s;
		}, '');

		sourceStream.pipe(reduceStream);

		let r: any;
		try {
			r = await reduceStream;
			assert.throws(() => r, Error, 'expected');
		} catch (e) {
			if (e instanceof assert.AssertionError) {
				throw e;
			}
			assert.throws(
				() => {
					throw e;
				},
				Error,
				'expected'
			);
		}
	});

	it('should promise catch when an async reduce function throws an error', async () => {
		const sourceStream = new SourceStream();
		const reduceStream = new ReduceStream(async (s, n: number) => {
			s += n.toString();
			await wait(10);
			if (n == 3) {
				throw new Error('expected');
			}
			return s;
		}, '');

		sourceStream.pipe(reduceStream);

		return reduceStream.then(
			(r: string) => {
				assert.throws(() => r, 'expected');
			},
			(e: Error) => {
				//console.error(e);
				//assert.throws(() => { throw e }, 'expected');
			}
		);
	});
});

describe('BatchStream', () => {
	it('should batch correctly', () => {
		const source = [0, 1, 2, 3, 4, 5, 6];
		const sourceStream = new PassThrough({ objectMode: true });
		const dest: string[] = [];

		const batchStream = new Batch(3);
		sourceStream.pipe(batchStream);

		batchStream.on('readable', () => {
			let result;

			while ((result = batchStream.read()) !== null) {
				dest.push(result);
			}
		});

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return new Promise((resolve, reject) => {
			batchStream.on('end', resolve);
		}).then(() => {
			assert.deepStrictEqual(dest, [[0, 1, 2], [3, 4, 5], [6]]);
		});
	});
});
