# Functional Streams

Provides four native Node streams that mirror the behaviour of basic FP array manipulations. As they extend
directly from Node native streams, they can be `pipe`d and emit events as you are used to. No runtime dependencies, typescript definitions included.

```ts
const FS = require('functional-streams');
```

## Map

```js
const mapStream = new FS.Map((n) => (n+2));
```

## Filter

```js
const filterStream = new FS.Filter((n) => (n % 2 === 0));
```

## Reduce

Provides a `then` method so this can be used in a promise-like fashion to get the end result.

```js
const reduceStream = new FS.Reduce((sum, n) => sum+n, 0);

reduceStream.write(0);
reduceStream.write(1);
reduceStream.write(2);
reduceStream.write(3);
reduceStream.end(4);

reduceStream.then( (result) => {
	console.log(result); // 10
});

```

## Batch

```js
const batchStream = new FS.Batch(3);

batchStream.write(0);
batchStream.write(1);
batchStream.write(2);
batchStream.write(3);
batchStream.end(4);

batchStream.read(); // [0, 1, 2];
batchStream.read(); // [3, 4];
```

