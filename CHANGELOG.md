# v2.0.0

## Breaking Changes

-   Node >= 8 (native async/await)
-   Map and Filter streams now emit `error` events if their map or filter function rejects (previously it was only if their function throw synchronously)
