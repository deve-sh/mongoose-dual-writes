import type {
	ConnectOptions,
	Connection as MongooseConnection,
} from "mongoose";

import Connection from "../classes/Connection";

import createConnection from "../utils/create-connection";
import onMongoDBWriteEvent from "../utils/on-mongoose-write-event";

type InitArgs = {
	secondaryConnections: {
		uri: string;
		options?: ConnectOptions & { enabled?: boolean; primary?: boolean };
	}[];
};

class DualMongooseWritesManager {
	static initialized: boolean = false;
	static errored: boolean = false;
	static connectionErrors: Error[] = [];
	static secondaryConnections: Connection[] = [];

	constructor(args: InitArgs) {
		if (DualMongooseWritesManager.initialized)
			throw new Error(
				"Dual writes manager has already been initialized. Please check your source code for duplicate calls."
			);
		DualMongooseWritesManager.initialized = true;

		if (!args || !args.secondaryConnections)
			throw new Error(
				"Dual writes manager is not passed any secondary connection URIs."
			);

		const connectionPromises: Promise<MongooseConnection>[] = [];
		const parametersForEnabledConnections = args.secondaryConnections.filter(
			(connection) => !connection.options || !connection.options.enabled
		);
		for (const connectionArgs of parametersForEnabledConnections)
			connectionPromises.push(
				createConnection(connectionArgs.uri, connectionArgs.options)
			);

		Promise.allSettled(connectionPromises).then((connectionResults) => {
			// Check for any errors and keep adding them or results to the static connection list.
			for (const connectionResult of connectionResults) {
				if (connectionResult.status === "rejected") {
					DualMongooseWritesManager.errored = true;
					DualMongooseWritesManager.connectionErrors.push(
						connectionResult.reason
					);
				} else {
					const connectionClass = new Connection(connectionResult.value);
					DualMongooseWritesManager.secondaryConnections.push(connectionClass);
				}
			}

			if (DualMongooseWritesManager.errored) {
				console.error(
					"The following connection errors were received: ",
					DualMongooseWritesManager.connectionErrors
				);
				throw new Error("Failed to connect to MongoDB");
			}

			// Setup debug interception
			onMongoDBWriteEvent(async (collectionName, method, ...args) => {
				const opPromises: Promise<any>[] = [];
				for (const connection of DualMongooseWritesManager.secondaryConnections) {
					const connectionDb = connection.nativeConnection.db;
					const collectionRef = connectionDb.collection(collectionName);
					opPromises.push(collectionRef[method](...args));
				}
				Promise.allSettled(opPromises);
			});
		});
	}

	async terminate() {
		const closingPromises: Promise<any>[] = [];
		for (const connection of DualMongooseWritesManager.secondaryConnections)
			closingPromises.push(connection.nativeConnection.close());
		await Promise.all(closingPromises);
	}
}

export default DualMongooseWritesManager;
