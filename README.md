# Mongoose Dual Writes

Dual/Replicated Writes are a very important feature that need to work when working on [database migrations that need 0 downtime](https://kiranrao.ca/2022/05/04/zero-downtime-migrations.html).

It's natively hard to do with [Mongoose](https://mongoosejs.com/) and difficult to get right.

Mongoose scopes its Models to a single default connection, you have to explicitly create models everytime you use a second connection. And since most codebases that utilize Mongoose have very tight coupling between them and Mongoose's models, it's not feasible to add a duplicated statement each time you write to the database via Mongoose.

You could use [MongoSync](https://www.mongodb.com/docs/cluster-to-cluster-sync/current/reference/mongosync/) but if you're using shared Atlas Clusters, you're out of luck.

This library bridges those gaps and adds a zero-change MongoDB write replication for codebases reliant on Mongoose! 🌟

### Installation

```bash
npm i mongoose-dual-writes
```

### Get Started

The library relies on listening to `mongoose.set('debug')` for operation logs and then natively executing those commands to the other mongoose connections.

```javascript
const MongoDBDualWrites = require('mongoose-dual-writes');

// Make sure your Mongoose default connection is already established.

await MongoDBDualWrites.initialize({
    secondaryConnections: [
        {
            uri: 'mongodb://<secondary-cluster-or-database-url>/<dbName>',
            options: {
                ...allConnectionOptionsSupportedByMongoose,
                enabled: true | false   // Optional, can be used to switch off dual-writes via a
            }
        },
        ... // as many connections you want to replicate writes to
    ]
});
```

That's it! The writes falling under the following operations would get transferred automatically:

- `updateOne`
- `updateMany`
- `insertOne`
- `insertMany`
- `replaceOne`
- `replaceMany`
- `deleteOne`
- `deleteMany`
- `findOneAndUpdate`
- `findOneAndInsert`
- `findOneAndDelete`
- `findOneAndRemove`
- `findOneAndReplace`

### Issues and Feature Requests

[![File An issue](https://img.shields.io/badge/mongoose%20dual%20writes-File%20an%20issue-orangered)](https://github.com/deve-sh/mongoose-dual-writes/issues/new)
