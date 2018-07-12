///<reference types="mocha" />

import assert = require('assert');
import assertThrowsAsync = require('assert-throws-async');
import { PassThrough, Readable } from 'stream';
import {
	Map as MapStream,
	Filter as FilterStream,
	Batch,
	Reduce as ReduceStream
} from './streams';
import { resolve } from 'path';
import sms = require('source-map-support');
sms.install();

function collect<T>(stream: Readable) {
	const dest: T[] = [];
	return new Promise((resolve, reject) => {
		stream.on('readable', () => {
			let result;

			while ((result = stream.read()) !== null) {
				dest.push(result);
			}
		});
		stream.on('end', () => {
			resolve(dest);
		});
		stream.on('error', reject);
	});
}

describe('MapStream', () => {
	it('should function as a normal map', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		function myMap(n: number): string {
			return n.toString(2);
		}

		const mapStream = new MapStream(myMap);
		sourceStream.pipe(mapStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		const result = await collect(mapStream);
		assert.deepStrictEqual(result, source.map(myMap));
	});

	it('should emit errors when the map function throws synchronously', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		function myMap(n: number): string {
			if (n == 3) {
				throw new Error('kablam');
			}
			return n.toString(2);
		}

		const mapStream = new MapStream(myMap);
		sourceStream.pipe(mapStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		await assertThrowsAsync(() => collect(mapStream), Error, 'kablam');
	});

	it('should emit errors when the map function rejects', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		const error = new Error('kablam');

		async function myMap(n: number): Promise<string> {
			if (n == 3) {
				throw error;
			}
			return n.toString(2);
		}

		const mapStream = new MapStream(myMap);
		sourceStream.pipe(mapStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		await assertThrowsAsync(() => collect(mapStream), Error, 'kablam');
	});
});

describe('FilterStream', () => {
	it('should function as a normal filter', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		function myFilter(n: number): boolean {
			return n % 2 === 0;
		}

		const filterStream = new FilterStream(myFilter);
		sourceStream.pipe(filterStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		const result = await collect(filterStream);
		assert.deepStrictEqual(result, source.filter(myFilter));
	});

	it('should emit errors when the filter function throws synchronously', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		function myFilter(n: number): boolean {
			if (n === 3) {
				throw new Error('boom!');
			}
			return n % 2 === 0;
		}

		const filterStream = new FilterStream(myFilter);
		sourceStream.pipe(filterStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		await assertThrowsAsync(() => collect(filterStream), Error, 'boom!');
	});

	it('should emit errors when the filter function rejects', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		async function myFilter(n: number): Promise<boolean> {
			if (n === 3) {
				throw new Error('boom!');
			}
			return n % 2 === 0;
		}

		const filterStream = new FilterStream(myFilter);
		sourceStream.pipe(filterStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		await assertThrowsAsync(() => collect(filterStream), Error, 'boom!');
	});
});

describe('ReduceStream', () => {
	it('should function as a normal reduce', async () => {
		const source = [0, 1, 2, 3, 4, 5];
		const sourceStream = new PassThrough({ objectMode: true });

		function myReduce(result: string, n: number): string {
			return result + n.toString();
		}

		const reduceStream = new ReduceStream(myReduce, '' as string);
		sourceStream.pipe(reduceStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		const result = await reduceStream;
		assert.deepStrictEqual(result, source.reduce(myReduce, ''));
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

		return reduceStream.then((result) => {
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
		const reduceStream = new ReduceStream((s, n: number) => {
			const result = s + arr[n];
			if (n == 3) {
				throw new Error('kablam!');
			}
			return result;
		}, '');
		sourceStream.pipe(reduceStream);

		await assertThrowsAsync(() => reduceStream, Error, 'kablam!');
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

		await assertThrowsAsync(() => reduceStream, Error, 'expected');
	});
});

describe('BatchStream', () => {
	it('should batch correctly', async () => {
		const source = [0, 1, 2, 3, 4, 5, 6];
		const sourceStream = new PassThrough({ objectMode: true });

		const batchStream = new Batch(3);
		sourceStream.pipe(batchStream);

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		const result = await collect(batchStream);

		assert.deepStrictEqual(result, [[0, 1, 2], [3, 4, 5], [6]]);
	});
});
