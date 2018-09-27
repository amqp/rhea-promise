### 0.1.5 - 2018-09-27
- Improved log statements for better debugging
- Any type of `error` event will be emitted with a tick dealy. This would give enough time for the `create()` methods to resolve the promise.

### 0.1.4 - 2018-09-25
- `options` is a required property of `Connection` and `Container`.

### 0.1.3 - 2018-09-25
- Transform relevant objects in rhea EventContext to rhea-promise objects.
- Ensure that `container.createConnection()` creates a connection on that container and not on the default container.

### 0.1.2 - 2018-09-20
- TS target to ES2015. This should help us support node.js version 6.x and above.

### 0.1.1 - 2018-09-20
- Update homepage, repository and bug urls in package.json

### 0.1.0 - 2018-09-20
- Initial version of rhea-promise.