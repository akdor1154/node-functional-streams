///<reference types="mocha" />

import assert = require('assert');

import {PassThrough} from 'stream';
import {Map as MapStream, Filter as FilterStream, Batch, Reduce as ReduceStream} from './streams';

describe('MapStream', () => {
	it('should function as a normal map', () => {
		const source = [0,1,2,3,4,5];
		const sourceStream = new PassThrough({objectMode: true});
		const dest: string[] = [];

		function myMap(n: number): string {
			return n.toString(2);
		}

		const mapStream = new MapStream(myMap);
		sourceStream.pipe(mapStream);

		mapStream.on('readable', () => {
			const result = mapStream.read();
			if (result === null) return;

			dest.push(result);
		});

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return new Promise((resolve, reject) => {
			mapStream.on('end', resolve);
		})
		.then( () => {
			assert.deepStrictEqual(dest, source.map(myMap));
		});
	});

})

describe('FilterStream', () => {
	it('should function as a normal filter', () => {
		const source = [0,1,2,3,4,5];
		const sourceStream = new PassThrough({objectMode: true});
		const dest: string[] = [];

		function myFilter(n: number): boolean {
			return n % 2 === 0;
		}

		const filterStream = new FilterStream(myFilter);
		sourceStream.pipe(filterStream);

		filterStream.on('readable', () => {
			const result = filterStream.read();
			if (result === null) return;

			dest.push(result);
		});

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return new Promise((resolve, reject) => {
			filterStream.on('end', resolve);
		})
		.then( () => {
			assert.deepStrictEqual(dest, source.filter(myFilter));
		});
	})
})

describe('ReduceStream', () => {
	it('should function as a normal reduce', () => {
		const source = [0,1,2,3,4,5];
		const sourceStream = new PassThrough({objectMode: true});

		function myReduce(result: string, n: number): string {
			return result + n.toString();
		}

		const reduceStream = new ReduceStream(myReduce, '');
		sourceStream.pipe(reduceStream);


		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return reduceStream
		.then( (result) => {
			assert.deepStrictEqual(result, source.reduce(myReduce, ''));
		});
	})
})

describe('BatchStream', () => {
	it('should batch correctly', () => {
		const source = [0,1,2,3,4,5,6];
		const sourceStream = new PassThrough({objectMode: true});
		const dest: string[] = [];

		const batchStream = new Batch(3);
		sourceStream.pipe(batchStream);

		batchStream.on('readable', () => {
			const result = batchStream.read();
			if (result === null) return;

			dest.push(result);
		});

		source.forEach(sourceStream.write.bind(sourceStream));
		sourceStream.end();

		return new Promise((resolve, reject) => {
			batchStream.on('end', resolve);
		})
		.then( () => {
			assert.deepStrictEqual(dest, [[0,1,2],[3,4,5],[6]]);
		});
	})
});